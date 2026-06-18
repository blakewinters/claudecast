export type SourceType = "google_doc" | "paste" | "markdown" | "json";

export interface Chunk {
  index: number;
  text: string;
  charStart: number;
  charEnd: number;
  estimatedSeconds: number;
}

export interface Section {
  id: string;
  title: string;
  order: number;
  text: string;
  chunks: Chunk[];
  estimatedStartSeconds: number;
  estimatedDurationSeconds: number;
}

export interface Cast {
  id: string;
  title: string;
  topic?: string;
  sourcePrompt?: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceDocumentId?: string;
  createdAt: number;
  updatedAt: number;
  importedAt: number;
  totalDurationSeconds: number;
  totalWords: number;
  sections: Section[];
}

export interface PlaybackState {
  castId: string;
  currentSectionId: string;
  currentChunkIndex: number;
  currentCharacterOffset: number;
  estimatedCurrentSeconds: number;
  playbackRate: number;
  selectedVoiceURI?: string;
  updatedAt: number;
}

export interface Settings {
  id: "singleton";
  ttsProvider: "google" | "browser";
  ttsVoice: string;
  voiceURI?: string;
  rate: number;
  pitch: number;
  wpm: number;
  rewindSeconds: number;
  forwardSeconds: number;
}

export interface ParsedDoc {
  title: string;
  sections: Array<{ title: string; text: string }>;
  rawText: string;
}
