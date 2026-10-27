# Groq Transcribe

A BYOK audio-to-text workspace for transcribing recordings, optionally cleaning up punctuation and readability, converting subtitle files, and exporting transcripts as TXT, SRT, WebVTT, or JSON. Queue multiple audio files and download completed results individually or as a ZIP.

**Live on Vercel:** [groq-transcribe.vercel.app](https://groq-transcribe.vercel.app). The site does not need a server-side Groq key or a Blob store: each user enters their own Groq API key, and the browser sends requests directly to Groq.

## What it does

- Accepts MP3, MP4, MPEG, M4A, WAV, WebM, OGG, and FLAC audio up to **200 MiB per file**
- Sends audio directly from the browser to Groq using the key entered by the user; no transcription API route, server-side API key, or temporary Blob upload
- Sends files up to 20 MiB as one request; larger files are converted in the browser to eight-minute, mono 16 kHz FLAC chunks, then sent directly to Groq one chunk at a time
- Combines chunk transcripts and offsets timestamps back onto the original recording timeline
- Uses Groq's `whisper-large-v3-turbo` model and the same user-provided key for optional cleanup (`llama-3.3-70b-versatile`)
- Converts SRT and WebVTT cues locally in the browser, preserving timestamps
- Exports TXT, SRT, WebVTT, or JSON and downloads one result or a completed batch as a ZIP

## Groq limits

Groq currently documents direct speech-to-text request limits of **25 MB on the free tier** and **100 MB on the developer tier**, with a 100 MB model maximum. This app conservatively chunks files larger than 20 MiB so each FLAC segment remains under the documented free-tier size cap. Groq account quotas, audio-second limits, and rate limits still apply to every chunk. See [Groq's speech-to-text documentation](https://console.groq.com/docs/speech-to-text) for current limits.

## Setup and local development

Requirements: Node.js 20.9+ and a Groq API key from [Groq Console](https://console.groq.com/keys).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste your key into the key field, and select audio. The key is held in tab memory only; it is not written to local storage, sent to the app's server, or included in server environment variables. Refreshing or closing the tab clears it.

The production build copies the single-threaded FFmpeg WebAssembly runtime from `@ffmpeg/core` into the generated `public/ffmpeg/` folder. This folder is generated during the build and intentionally excluded from Git. No `GROQ_API_KEY`, Vercel Blob, or transcription-server environment variables are required.

## How large files work

The former 4 MB ceiling was caused by Vercel Functions' request-body limit: audio posted to a server route had to pass through that limit. The BYOK app removes that route. Audio and the `Authorization` header are sent from the user's browser straight to `https://api.groq.com/openai/v1/audio/transcriptions`, so Vercel's 4 MB function limit no longer applies.

Groq still limits the size of each transcription request. For files over 20 MiB, this app loads FFmpeg WebAssembly in the browser, converts the audio locally to mono 16 kHz FLAC segments of eight minutes, and posts each segment directly to Groq. Segment timestamps are offset and combined in the browser. Files are processed sequentially to reduce browser memory pressure. A 100–200 MiB source file can use substantial browser memory and CPU during conversion; desktop browsers are recommended for the largest files. No audio staging or temporary file is created in Vercel Blob.

## BYOK key handling and privacy

- The Groq key is entered by each user and kept only in the current page's JavaScript memory. The app does not persist it.
- The browser sends the key and audio to Groq over HTTPS. The app's server does not receive either through a transcription endpoint.
- Any script executing in the page can technically access a key while the page is open. Only enter a key if you trust the site; revoke it in Groq Console if it may have been exposed.
- Groq processes the audio and optional cleanup text under the key owner's plan and current Groq terms, retention, and rate limits.
- Transcript results remain in browser memory and are cleared on refresh or close. Downloads are created by the browser.

Read the draft [Privacy Policy](/privacy) and [Terms of Service](/terms); operator contact details and applicable legal terms still need review.

## Third-party software

Large-file preprocessing uses `@ffmpeg/ffmpeg` and the `@ffmpeg/core` WebAssembly runtime. `@ffmpeg/ffmpeg` is MIT-licensed; `@ffmpeg/core` is GPL-2.0-or-later. Review the runtime's licensing and source-distribution obligations before distributing or operating the production app. FFmpeg source and licensing information: [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) and [FFmpeg](https://ffmpeg.org/legal.html).

## Project commands

```bash
npm run dev      # local development
npm run build    # copy FFmpeg assets and create production build
npm run start    # serve the production build
npm run lint     # lint source files
npm audit        # dependency vulnerability check
```

## License

No license has been provided for this repository. All rights reserved unless the repository owner adds a license. See the third-party software section for the FFmpeg runtime's separate license.
