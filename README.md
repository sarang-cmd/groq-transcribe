# Groq Transcribe

A focused audio-to-text workspace for transcribing recordings, optionally cleaning up punctuation and readability, converting subtitle files, and exporting transcripts as TXT, SRT, WebVTT, or JSON. Queue multiple audio files, follow direct-upload progress, and download completed results individually or as a ZIP.

**Live on Vercel:** [groq-transcribe.vercel.app](https://groq-transcribe.vercel.app). Add `GROQ_API_KEY` and connect a private Blob store to enable audio transcription and large uploads.

## What it does

- Accepts MP3, MP4, MPEG, M4A, WAV, WebM, OGG, and FLAC audio up to **200 MB per file**
- Uploads files over 4 MB directly from the browser to private Vercel Blob storage, using multipart transfers for files over 100 MB
- Normalizes large recordings into eight-minute, mono 16 kHz FLAC segments before sending them to Groq; timestamps are offset and combined into one transcript
- Transcribes with Groq's `whisper-large-v3-turbo` model and uses the same server-side `GROQ_API_KEY` for optional cleanup (`llama-3.3-70b-versatile`)
- Converts SRT and WebVTT cues locally in the browser, preserving their timestamps
- Exports TXT, SRT, WebVTT, or JSON and downloads one result or the completed batch as a ZIP

## Setup

Requirements: Node.js 20.9+ and a Groq API key. A private Vercel Blob store is also required for audio files over 4 MB.

```bash
npm install
cp .env.example .env.local
```

Add your Groq key to `.env.local`:

```dotenv
GROQ_API_KEY=gsk_...
```

Keep the key private. Do not commit `.env.local`, put the key in `NEXT_PUBLIC_*`, or enter it into client-side code.

### Local development with large uploads

Connect a private Blob store to the Vercel project, include the Development environment, and pull its auto-generated environment variables into `.env.local`:

```bash
vercel link
vercel env pull .env.local
```

The Blob store provides `BLOB_STORE_ID` and `BLOB_READ_WRITE_TOKEN`. Vercel rotates its OIDC credentials automatically for deployed functions. The project uses the read-write token only for the browser upload-token route.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Blob credentials, files up to 4 MB still use the direct route; larger files show a setup error.

## Deploy to Vercel

1. Import this GitHub repository in Vercel and select **Next.js**.
2. Add `GROQ_API_KEY` as a server-side environment variable. Create a key in [Groq Console](https://console.groq.com/keys).
3. In the Vercel project, open **Storage → Create Storage → Blob**. Choose **Private**, connect the store to Production, Preview, and Development as needed, then redeploy. Vercel adds the required Blob environment variables to the project.
4. Confirm the deployment has the Blob variables and test with a non-sensitive recording before sharing the site.

No Groq key is stored in this repository. Without `GROQ_API_KEY`, audio transcription returns a configuration error. Without a connected private Blob store, uploads above 4 MB are rejected with a setup message.

## Large-file processing and limits

Vercel Functions reject request bodies above approximately 4.5 MB, so large recordings are uploaded directly from the browser to a **private** Blob store, rather than sent through an API route. Files above 100 MB use Blob multipart upload. The server then reads the private blob, converts it with FFmpeg to mono 16 kHz FLAC chunks of eight minutes, and sends those chunks to Groq one at a time. This stays below Groq's per-request audio limits and combines timestamps back into the original recording timeline. Temporary blobs are deleted after processing completes.

Each audio file is capped at 200 MB. Large audio processing uses temporary disk and a Vercel function that can run for up to five minutes. The user's Groq plan still controls rate limits and billing. Large transcripts may therefore take longer or be rejected by Groq if the account reaches its audio quota.

## Data flow

1. Audio up to 4 MB is submitted to `/api/transcribe`.
2. Larger audio goes directly from the browser to a private Vercel Blob store via a short-lived upload token.
3. The server validates the Blob URL and size, processes larger audio into timestamp-aligned chunks, and calls Groq using the server-side API key.
4. The temporary Blob is deleted after the transcription request completes. Results and editable transcript text remain in browser memory; exports are generated in the browser.
5. SRT and WebVTT conversion stays entirely in the browser and does not call Groq.

Groq processes audio and optional transcript text. Vercel temporarily handles large audio uploads. Hosting-provider logs and Groq's retention practices are governed by their current settings and policies. Review both before processing sensitive recordings. See the draft [Privacy Policy](/privacy) and [Terms of Service](/terms); operator and contact details still need review.

**Access warning:** this prototype has no user accounts or durable rate limiting. Anyone who can reach the deployed site can upload files and use the operator's configured Groq account. Groq usage and temporary Blob storage are billed to the account owner. Add access control or a rate-limiting service before broadly sharing the public URL.

## Output details

- **TXT** exports the editable transcript text.
- **SRT** and **WebVTT** export timestamped segments. Cleanup is applied segment-by-segment where possible. Existing SRT and WebVTT files can be converted directly in the browser, preserving cue timing. Manual transcript edits do not alter timestamped subtitle exports.
- **JSON** includes transcript text and timestamped segment data.
- ZIP filenames are derived from uploaded filenames. Duplicate files with the same name and size are ignored in the same queue.

## Project commands

```bash
npm run dev      # local development
npm run build    # production build and type validation
npm run start    # serve the production build
npm run lint     # lint source files
npm audit        # dependency vulnerability check
```

## License

No license has been provided for this repository. All rights reserved unless the repository owner adds a license.
