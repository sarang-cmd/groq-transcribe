# Groq Transcribe

A focused audio-to-text workspace for transcribing recordings, optionally cleaning up punctuation and readability, and exporting transcripts as TXT, timestamped SRT/VTT subtitles, or JSON. Multiple files can be queued, transcribed in small concurrent batches, and downloaded together as a ZIP.

**Live on Vercel:** [groq-transcribe.vercel.app](https://groq-transcribe.vercel.app). The workspace is deployed, but transcription requires the owner to configure `GROQ_API_KEY` in the Vercel project settings first.

## What it does

- Accepts MP3, MP4, MPEG, M4A, WAV, WebM, OGG, and FLAC audio, plus SRT and WebVTT subtitle files
- Converts uploaded SRT and WebVTT cues locally between subtitle, text, and JSON exports without calling Groq
- Transcribes with Groq's `whisper-large-v3-turbo` model
- Uses one server-side `GROQ_API_KEY` for transcription and optional transcript cleanup (`llama-3.3-70b-versatile`)
- Exports TXT, SRT, WebVTT, or JSON with timing segments
- Downloads an individual result or all completed results as a ZIP
- Keeps queued files and editable transcript text in the current browser session, without an application database

### Upload limit

Each audio file is limited to **4 MB** in this deployment. Groq accepts larger audio inputs, but Vercel Functions impose a request-body limit. The lower limit leaves room for multipart request overhead and avoids uploads that fail before reaching the app. Larger-file support needs a separate upload/storage architecture.

## Run locally

Requirements: Node.js 20.9+ and a Groq API key.

```bash
npm install
cp .env.example .env.local
```

Add your key to `.env.local`:

```dotenv
GROQ_API_KEY=gsk_...
```

Keep the key private. Do not commit `.env.local`, put the key in `NEXT_PUBLIC_*`, or enter it into client-side code.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Import this GitHub repository in Vercel and set the framework to **Next.js** (the default detection).
2. Add `GROQ_API_KEY` as a server-side environment variable for Production, Preview, and Development as needed. Use the Groq key from [Groq Console](https://console.groq.com/keys).
3. Deploy. After adding or rotating the key, trigger a new deployment so the function receives the updated environment.
4. Test with a short, non-sensitive audio file before sharing the site.

No Groq key was committed to this repository. The transcription endpoint returns a configuration error until the deployment owner adds the environment variable.

## How the data flow works

1. The browser posts one audio file at a time to `/api/transcribe`.
2. The Next.js route sends the file to Groq's audio transcription endpoint using the server environment key.
3. When cleanup is selected, timestamped segments are sent to Groq chat completions with instructions to return the same number of segments. If cleanup cannot be parsed, the original timestamp-aligned result is kept.
4. The response is held in browser memory. Exports are generated in the browser; the app has no database or app-level file storage.

Audio and optional transcript text leave the app to be processed by Groq. Hosting-provider request and execution logs, and Groq's current retention practices, are governed by their respective configurations and policies. Review both before processing sensitive recordings. See the draft [Privacy Policy](/privacy) and [Terms of Service](/terms); the service operator and contact details still need to be completed before production launch.

**Access warning:** this prototype has no user accounts or durable rate limiting. Anyone who can reach the deployed site can submit audio using the operator's configured Groq key, and usage is billed to that Groq account. Add appropriate access control or a rate-limiting service before sharing the public URL broadly.

## Output details

- **TXT** exports the editable transcript text.
- **SRT** and **WebVTT** export timestamped segments. Cleanup, when available, is applied per segment so audio timing remains intact. Existing SRT and WebVTT files can be converted directly in the browser, preserving their cue times. Manual edits to the transcript text field are not applied to timestamped subtitle exports.
- **JSON** includes the editable transcript field and original timestamped segment data.
- ZIP filenames are derived from the uploaded audio filenames. Duplicate files with the same name and size are ignored in the same queue.

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
