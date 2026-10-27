import { del, get, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const CHUNK_SECONDS = 8 * 60;
const allowedExtensions = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i;
const ffmpegPath = ffmpeg.path;

type Segment = { start: number; end: number; text: string };
type GroqResult = { text?: string; segments?: Segment[]; duration?: number; language?: string };
class HttpError extends Error { constructor(message: string, public status = 500) { super(message); } }

function isOwnedIncomingBlob(blobUrl: string, storeId: string) {
  try {
    const url = new URL(blobUrl);
    return url.origin === `https://${storeId}.private.blob.vercel-storage.com`
      && !url.username && !url.password && url.pathname.startsWith('/incoming/') && !url.search && !url.hash;
  } catch { return false; }
}

export async function GET() {
  return NextResponse.json({
    transcriptionConfigured: Boolean(process.env.GROQ_API_KEY),
    largeUploadsConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN && process.env.BLOB_STORE_ID),
  });
}

async function callGroq(form: FormData, apiKey: string): Promise<GroqResult> {
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form,
  });
  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : 'The transcription service could not process this audio.';
    throw new HttpError(message, response.status === 429 ? 429 : 502);
  }
  return data as GroqResult;
}

function transcriptionForm(language: string, name?: string) {
  const form = new FormData();
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  if (language && language !== 'auto') form.append('language', language);
  if (name) form.append('filename', name);
  return form;
}

async function transcribeBlob(blobUrl: string, filename: string, language: string, apiKey: string) {
  const storeId = process.env.BLOB_STORE_ID;
  if (!storeId || !process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError('Large uploads are not configured. Connect a private Vercel Blob store to this project.', 503);

  if (!isOwnedIncomingBlob(blobUrl, storeId)) throw new HttpError('The uploaded file is not in this project’s private audio store.', 400);

  let metadata;
  try { metadata = await head(blobUrl); }
  catch { throw new HttpError('The uploaded file could not be found in private storage.', 404); }
  if (metadata.size > MAX_AUDIO_BYTES) throw new HttpError('The file exceeds the 200 MB limit.', 413);

  // Use Groq's URL input for small files. Larger audio is normalized and split
  // into eight-minute FLAC segments, below Groq's per-request audio limit.
  if (metadata.size <= 20 * 1024 * 1024) {
    const signedToken = await issueSignedToken({ pathname: metadata.pathname, operations: ['get'], validUntil: Date.now() + 10 * 60 * 1000 });
    const { presignedUrl } = await presignUrl(signedToken, {
      operation: 'get', pathname: metadata.pathname, access: 'private', validUntil: Date.now() + 5 * 60 * 1000,
    });
    const form = transcriptionForm(language);
    form.append('url', presignedUrl);
    const data = await callGroq(form, apiKey);
    return normalizeResult(data);
  }

  const directory = await mkdtemp(join(tmpdir(), 'groq-transcribe-'));
  const inputPath = join(directory, `source${extensionFor(filename)}`);
  const listPath = join(directory, 'segments.csv');
  const outputPattern = join(directory, 'chunk-%03d.flac');
  try {
    const stored = await get(blobUrl, { access: 'private' });
    if (!stored || stored.statusCode !== 200) throw new HttpError('Could not read the uploaded audio from private storage.', 502);
    await pipeline(Readable.fromWeb(stored.stream as unknown as import('node:stream/web').ReadableStream), createWriteStream(inputPath));

    await runFfmpeg([
      '-hide_banner', '-loglevel', 'error', '-i', inputPath,
      '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'flac',
      '-f', 'segment', '-segment_time', String(CHUNK_SECONDS), '-reset_timestamps', '1',
      '-segment_list', listPath, '-segment_list_type', 'csv', outputPattern,
    ]);

    const entries = (await readFile(listPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [file, start, end] = line.split(',');
      return { file: basename(file), start: Number(start), end: Number(end) };
    });
    if (!entries.length || entries.some(entry => !Number.isFinite(entry.start) || !Number.isFinite(entry.end))) {
      throw new HttpError('Could not split this recording into readable audio segments.', 422);
    }

    const results: GroqResult[] = [];
    let prompt = '';
    for (const entry of entries) {
      const bytes = await readFile(join(directory, entry.file));
      const form = transcriptionForm(language);
      form.append('file', new File([bytes], entry.file, { type: 'audio/flac' }));
      if (prompt) form.append('prompt', prompt.slice(-800));
      const data = await callGroq(form, apiKey);
      const offset = entry.start;
      const adjusted: GroqResult = {
        ...data,
        segments: (data.segments || []).map(segment => ({ ...segment, start: segment.start + offset, end: segment.end + offset })),
        duration: entry.end,
      };
      results.push(adjusted);
      prompt = data.text || prompt;
      await rm(join(directory, entry.file), { force: true });
    }
    return {
      text: results.map(result => result.text?.trim()).filter(Boolean).join(' '),
      segments: results.flatMap(result => result.segments || []),
      duration: Math.max(...results.map(result => result.duration || 0)),
      language: results.find(result => result.language)?.language || null,
      enhanced: false,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function extensionFor(filename: string) {
  const extension = filename.match(/\.[a-z0-9]{1,8}$/i)?.[0].toLowerCase();
  return extension && allowedExtensions.test(extension) ? extension : '.audio';
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const process = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    process.stderr.on('data', (chunk: Buffer) => { errorOutput = (errorOutput + chunk.toString()).slice(-4000); });
    process.once('error', reject);
    process.once('close', code => code === 0 ? resolve() : reject(new HttpError(errorOutput.trim() || 'Audio conversion failed. Check that the file contains a supported audio track.', 422)));
  });
}

function normalizeResult(data: GroqResult) {
  return {
    text: data.text || '',
    segments: Array.isArray(data.segments) ? data.segments : [],
    duration: typeof data.duration === 'number' ? data.duration : null,
    language: data.language || null,
    enhanced: false,
  };
}

async function cleanSegments(result: ReturnType<typeof normalizeResult>, apiKey: string) {
  if (!result.text.trim() || !result.segments.length) return result;
  // Small batches keep the structured cleanup response within model token limits
  // even when a long recording produces many timestamped segments.
  let cleanedAny = false;
  for (let offset = 0; offset < result.segments.length; offset += 30) {
    const group = result.segments.slice(offset, offset + 30);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', temperature: 0.1, max_tokens: 3000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Improve readability of each speech transcript segment with punctuation, capitalization, and obvious transcription corrections. Keep exactly the same meaning, language, names, order, and number of segments. Never summarize or add content. Reply as a JSON object with one "segments" array of strings, one cleaned string per input segment.' },
            { role: 'user', content: JSON.stringify({ segments: group.map(segment => segment.text) }) },
          ],
        }),
      });
      if (!response.ok) continue;
      const body = await response.json();
      const values = JSON.parse(body.choices?.[0]?.message?.content || '{}').segments;
      if (Array.isArray(values) && values.length === group.length && values.every((value: unknown) => typeof value === 'string')) {
        group.forEach((segment, index) => { segment.text = values[index]; });
        cleanedAny = true;
      }
    } catch { /* Keep the original text for a group that could not be cleaned. */ }
  }
  return { ...result, text: result.segments.map(segment => segment.text).join(' ').replace(/\s+/g, ' ').trim(), enhanced: cleanedAny };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'The service is not configured yet. Add GROQ_API_KEY to the deployment environment.' }, { status: 503 });

  let blobUrl: string | undefined;
  try {
    const contentType = request.headers.get('content-type') || '';
    let language = 'auto';
    let enhance = false;
    let filename = 'audio.mp3';
    let result: ReturnType<typeof normalizeResult>;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      blobUrl = typeof body.blobUrl === 'string' ? body.blobUrl : undefined;
      filename = typeof body.filename === 'string' ? body.filename : filename;
      language = typeof body.language === 'string' ? body.language : language;
      enhance = body.enhance === true;
      if (!blobUrl || !allowedExtensions.test(filename)) throw new HttpError('Choose a supported audio file.', 400);
      result = await transcribeBlob(blobUrl, filename, language, apiKey);
    } else {
      let form: FormData;
      try { form = await request.formData(); }
      catch { throw new HttpError('Could not read the uploaded audio. Please try again.', 400); }
      const file = form.get('file');
      if (!(file instanceof File)) throw new HttpError('Choose an audio file to transcribe.', 400);
      if (!allowedExtensions.test(file.name)) throw new HttpError('Use an MP3, MP4, MPEG, M4A, WAV, WebM, OGG, or FLAC audio file.', 415);
      if (file.size > DIRECT_UPLOAD_BYTES) throw new HttpError('Large uploads must go through the private multipart upload flow.', 413);
      language = String(form.get('language') || 'auto').trim();
      enhance = form.get('enhance') === 'true';
      const upstream = transcriptionForm(language);
      upstream.append('file', file, file.name);
      result = normalizeResult(await callGroq(upstream, apiKey));
    }

    if (enhance) result = await cleanSegments(result, apiKey);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof Error ? error.message : 'Could not transcribe this recording. Please try again.';
    return NextResponse.json({ error: message }, { status });
  } finally {
    if (blobUrl && process.env.BLOB_STORE_ID && isOwnedIncomingBlob(blobUrl, process.env.BLOB_STORE_ID)) {
      try { await del(blobUrl); } catch { /* Do not hide the transcription result if cleanup fails. */ }
    }
  }
}
