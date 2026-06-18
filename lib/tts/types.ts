export interface SynthesizeRequest {
  text: string;
  voice: string;
  rate?: number;
  pitch?: number;
}

export interface SynthesizeResult {
  audio: ArrayBuffer;
  mimeType: string;
}

export interface VoiceInfo {
  id: string;
  label: string;
  gender?: "male" | "female" | "neutral";
  lang: string;
  isPremium?: boolean;
}

export interface TTSProvider {
  id: "google" | "browser";
  synthesize(req: SynthesizeRequest): Promise<SynthesizeResult>;
  listVoices(): Promise<VoiceInfo[]>;
}

export const DEFAULT_GOOGLE_VOICES: VoiceInfo[] = [
  // Neural2 — free-tier, conversational
  { id: "en-US-Neural2-J", label: "Joel (warm male)", gender: "male", lang: "en-US" },
  { id: "en-US-Neural2-D", label: "Daniel (deep male)", gender: "male", lang: "en-US" },
  { id: "en-US-Neural2-A", label: "Aaron (clear male)", gender: "male", lang: "en-US" },
  { id: "en-US-Neural2-F", label: "Fiona (warm female)", gender: "female", lang: "en-US" },
  { id: "en-US-Neural2-H", label: "Hannah (clear female)", gender: "female", lang: "en-US" },
  { id: "en-US-Neural2-C", label: "Cora (smooth female)", gender: "female", lang: "en-US" },
  // WaveNet — also free-tier, slightly different texture
  { id: "en-US-Wavenet-D", label: "Wavenet D (male)", gender: "male", lang: "en-US" },
  { id: "en-US-Wavenet-F", label: "Wavenet F (female)", gender: "female", lang: "en-US" },
  // GB English
  { id: "en-GB-Neural2-B", label: "Ben (UK male)", gender: "male", lang: "en-GB" },
  { id: "en-GB-Neural2-A", label: "Amelia (UK female)", gender: "female", lang: "en-GB" },
];

export const DEFAULT_VOICE_ID = "en-US-Neural2-J";
