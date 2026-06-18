# ClaudeCast

Listen to Claude's longform responses as podcasts. Built for mobile.

## The workflow

1. On your phone, ask Claude.ai for a podcast-style summary of whatever you're researching.
2. Have Claude write it into a Google Doc (e.g. *"Update the doc 'Today's Cast' with a 3-section podcast script. Use headings like 'Section 1: …'."*).
3. Share the Doc as **Anyone with the link can view**.
4. Open ClaudeCast, paste the Doc URL, tap **Preview sections**, edit titles if needed, tap **Save cast**.
5. Hit play. The browser reads it aloud.
6. Close the tab whenever. Reopen ClaudeCast — your position is remembered.

## Recommended Claude script format

Put this in your Google Doc and the parser will pick up sections cleanly:

```
Podcast Title

Section 1: Section Title

Spoken script text.

Section 2: Section Title

Spoken script text.

Recap

Spoken recap text.
```

Markdown `#` headings work too. So do `Part 1:`, `Chapter 3 —`, `Conclusion`, etc.

## Setup

```bash
git clone … claudecast && cd claudecast
./setup.sh
npm run dev
```

Open `http://localhost:3000` on your laptop, or visit your Mac's LAN IP on your phone (same WiFi). For the latter:

```bash
npm run dev -- -H 0.0.0.0
# then open http://<your-mac-ip>:3000 on the phone
```

## Import modes

- **Google Doc URL (recommended for mobile).** Paste a Docs URL. The server-side route exports the Doc as HTML (preserving headings) and parses it. The Doc must be shared as *Anyone with the link can view*, or *Published to the web*.
- **Paste raw text.** Drop a Claude response into a textarea.
- **Markdown.** Same as paste but framed as markdown.
- **JSON.** `{"title":"…","sections":[{"title":"…","text":"…"}]}` if you've already structured the script yourself.

## Player features

- Play / pause
- Rewind 15s, forward 30s (both configurable)
- Drag-to-seek progress bar
- Speed: 0.75x / 1x / 1.1x / 1.15x / 1.25x / 1.5x / 2x
- Section list with current-section highlight; tap to jump
- Transcript that scrolls to the active chunk; tap any chunk to seek there
- Position auto-saved every 4 seconds and on tab hide
- Settings: voice, rate, pitch, WPM, skip-second defaults
- Refresh cast from its original Google Doc
- Export / import all data as JSON

## Known limitations (MVP)

- **Browser SpeechSynthesis isn't real audio.** Seeking restarts speech from the nearest chunk (~240 chars). You'll lose a few seconds when you pause/resume or seek.
- **Voices vary by device.** iOS Safari, Chrome desktop, Firefox each ship different voices. The settings page lists what's available on the current device.
- **Mobile background playback is limited.** Most browsers stop SpeechSynthesis when the tab is backgrounded or the screen locks. Plan to listen with the tab in the foreground for now.
- **Private Google Docs need OAuth.** Not in this MVP. The `.env.example` reserves the env vars (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) for when it's added.
- **Google Docs export has size limits.** Very long Docs may truncate.

## Future extensions

- High-quality TTS providers (ElevenLabs, OpenAI, etc.) — isolated behind a `TTSProvider` interface.
- Cached real audio files (download for offline).
- Media Session API for lock-screen / Bluetooth controls.
- Claude API generation built in.
- Claude export importer.
- Playlist / queue support.
- PWA install.
- Cloud sync.

## Tech

Next.js 14 (app router), TypeScript, Tailwind, Dexie (IndexedDB), Browser SpeechSynthesis. Tested with Vitest.

## Tests

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run lint
npm run build
```
