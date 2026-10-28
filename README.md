# Groq Transcribe

A BYOK tool for audio transcription, subtitle conversion, and transcript export. You enter your Groq API key. Your browser sends audio straight to Groq.

**Live site:** [groq-transcribe.vercel.app](https://groq-transcribe.vercel.app)

## Features

- MP3, MP4, MPEG, M4A, WAV, WebM, OGG, and FLAC audio, up to 200 MiB per file
- Direct Groq transcription with `whisper-large-v3-turbo` and your key
- Browser-side eight-minute mono 16 kHz FLAC chunks for files over 20 MiB
- Combined transcript text and timestamps
- Optional Groq transcript cleanup with `llama-3.3-70b-versatile`
- Local SRT and WebVTT conversion
- TXT, SRT, WebVTT, and JSON exports, plus ZIP download
- AI-suggested or custom filenames for SRT and WebVTT exports
- AI filename requests send up to 6,000 transcript characters to Groq after you choose Name with AI
- Optional browser alerts for upload start and finish, using the app icon

## Groq limits

Groq documents a 25 MB speech-to-text request limit on the free tier and 100 MB on the developer tier. The model limit is 100 MB. This app chunks files above 20 MiB to keep each FLAC request under the free-tier limit. Groq account quotas and rate limits apply to every request. Check the [Groq speech-to-text docs](https://console.groq.com/docs/speech-to-text) for current limits.

## Run locally

Requirements: Node.js 20.9 or newer and a Groq API key from [Groq Console](https://console.groq.com/keys).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Paste your key in the app, then choose audio. The app keeps the key in tab memory. Refresh or close the tab to clear the key. The app does not send the key to its server or save the key in local storage.

The build copies `@ffmpeg/core` WebAssembly files into `public/ffmpeg/`. The build creates this folder, and Git ignores the generated files. The app needs no server key, Vercel Blob store, or transcription API environment variable.

## Large files

The old 4 MB cap came from Vercel Function request limits. This app sends audio from your browser to Groq. Audio does not pass through a Vercel Function, so the Vercel cap no longer applies.

Groq still limits each request. Files over 20 MiB are converted in your browser to eight-minute mono 16 kHz FLAC chunks. Your browser sends each chunk to Groq and combines timestamps into one timeline. The app processes files one at a time to limit memory use. A 100 to 200 MiB recording uses extra browser memory and CPU during conversion. Use a desktop browser for large recordings. Vercel Blob does not store audio.

## Key handling and privacy

- You enter your own Groq API key. The app keeps the key in page memory and does not save the key.
- Your browser sends the key and audio to Groq over HTTPS.
- Scripts on this site access the key while the page stays open. Enter a key only when you trust the site. Revoke an exposed key in Groq Console.
- Groq handles audio and optional cleanup text under its terms, retention settings, plan, and rate limits.
- Browser memory holds transcripts until refresh or close. Your browser creates downloads.

Review the draft [Privacy Policy](/privacy) and [Terms of Service](/terms). Add operator contact details and final legal terms before launch.

## Third-party software

Large-file conversion uses `@ffmpeg/ffmpeg` and `@ffmpeg/core`. `@ffmpeg/ffmpeg` uses the MIT license. `@ffmpeg/core` uses GPL-2.0-or-later. Review the source and distribution requirements before release. See [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) and [FFmpeg licensing](https://ffmpeg.org/legal.html).

## Commands

```bash
npm run dev      # start local development
npm run build    # copy FFmpeg assets and build the app
npm run start    # run the production build
npm run lint     # check source files
npm audit        # check dependencies
```

## License

This repository has no license. All rights reserved unless the owner adds one. See the third-party software section for FFmpeg runtime licenses.
