import type {
  SynthesizeRequest,
  SynthesizeResult,
  TTSProvider,
  VoiceInfo,
} from "./types";
import { DEFAULT_GOOGLE_VOICES } from "./types";

export class GoogleTTSError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = "tts_failed",
  ) {
    super(message);
  }
}

export class GoogleTTSProvider implements TTSProvider {
  id = "google" as const;

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error("GoogleTTSProvider: apiKey is required");
  }

  async synthesize(req: SynthesizeRequest): Promise<SynthesizeResult> {
    const voice = req.voice;
    const lang = voice.split("-").slice(0, 2).join("-"); // "en-US-Neural2-J" -> "en-US"

    const body = {
      input: { text: req.text },
      voice: { languageCode: lang, name: voice },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: req.rate ?? 1.0,
        pitch: req.pitch != null ? (req.pitch - 1) * 10 : 0,
        // Slight gain boost — mobile speakers can be quiet.
        volumeGainDb: 0,
        sampleRateHertz: 24000,
      },
    };

    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new GoogleTTSError(
        `Google TTS ${res.status}: ${errText.slice(0, 200)}`,
        res.status,
        res.status === 403 ? "forbidden" : res.status === 429 ? "rate_limited" : "tts_failed",
      );
    }

    const data = (await res.json()) as { audioContent?: string };
    if (!data.audioContent) {
      throw new GoogleTTSError("No audioContent in response", 500);
    }
    const audio = base64ToArrayBuffer(data.audioContent);
    return { audio, mimeType: "audio/mpeg" };
  }

  async listVoices(): Promise<VoiceInfo[]> {
    return DEFAULT_GOOGLE_VOICES;
  }
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, "base64");
  return bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
}
