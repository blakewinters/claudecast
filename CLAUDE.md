# CLAUDE.md — ClaudeCast

Mobile-first web app that turns Claude responses (delivered via Google Docs) into podcast-style audio.

## How it actually works

1. Blake asks Claude.ai (mobile) for a podcast-style summary.
2. Claude writes a structured script into a Google Doc (one of Blake's named Docs, or a new one).
3. Blake opens ClaudeCast on his phone, pastes the Doc URL.
4. `/api/import/google-doc` exports the Doc as HTML (preferred) or text, parses into sections, returns to the client.
5. Blake reviews/edits sections, saves; cast lands in IndexedDB.
6. Player uses browser SpeechSynthesis to read it back, persists position in IndexedDB so resume works after closing the browser.

## Stack

- Next.js 14 (app router) + TypeScript
- Tailwind CSS for styling — dark by default
- Dexie (IndexedDB) for local persistence
- Browser SpeechSynthesis API for TTS
- Vitest for unit tests

## Key files

- `lib/parser.ts` — pure text/markdown/HTML → sections + chunks. Heading detection covers `#`, `Section/Part/Chapter N`, and named (`Recap`, `Conclusion`, …).
- `lib/google-doc.ts` — URL → docID extraction (covers `/edit`, `/view`, `/mobilebasic`, `/d/e/` published, `drive.google.com/file/d/…`).
- `lib/google-docs-importer.ts` — server-side fetch of public Google Docs. Tries HTML first, falls back to txt. Detects login-redirect and surfaces a clear error.
- `lib/speech.ts` — `SpeechEngine` class. Pure logic for chunk advancement, seek-to-time, rate/voice changes. UI subscribes via `subscribe()`. Pure helpers `flattenCast` and `findChunkIndexForTime` are exported for tests.
- `lib/db.ts` — Dexie wrapper. Tables: `casts`, `playback`, `settings`. Also backup export/import.
- `hooks/usePlayer.ts` — wraps the engine in a React hook; persists position every 4s and on `pagehide` / `visibilitychange`.
- `app/api/import/google-doc/route.ts` — server route Blake's phone hits to avoid CORS on the Docs export.
- `app/player/[id]/page.tsx` — player screen, ties it all together.

## Conventions

- **No scraping of Claude.ai.** Google Docs is the handoff layer.
- **Mobile-first.** Tap targets ≥ 40px, sticky bottom player, single-column max-width 2xl.
- **Pure parser, mockable importer.** The parser is a pure function from string → `ParsedDoc`. Easy to test.
- **Engine ↔ UI split.** `SpeechEngine` doesn't touch React; `usePlayer` adapts it.
- **OAuth is optional, not required.** Public/shared docs work without auth. Private docs would need OAuth (placeholder env vars in `.env.example`, not implemented).

## Known limitations (intentional, MVP)

- Browser SpeechSynthesis isn't true audio — seeking restarts speech from the nearest chunk (~240 chars / ~10–15s at 160 wpm).
- Voice availability varies by device/OS.
- Background and lock-screen playback are subject to browser policy on mobile.
- Private Google Docs aren't supported until OAuth is wired up.

## Future extensions (placeholders, not built)

- Optional high-quality TTS provider (ElevenLabs / OpenAI / Google).
- Real audio file generation + caching.
- Media Session API for lock-screen controls.
- Claude API generation inside the app.
- PWA install support.
- Cloud sync (Firestore/Supabase) — currently local-only.

## Run

```bash
./setup.sh        # one-time
npm run dev       # http://localhost:3000
```

To use on your phone over the LAN, run `npm run dev -- -H 0.0.0.0` and visit `http://<mac-ip>:3000` from the phone (same WiFi).

## Tests

```bash
npm test          # runs vitest once
npm run typecheck
npm run lint
npm run build
```
