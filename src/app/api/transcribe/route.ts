import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const allowedExtensions = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'The service is not configured yet. Add GROQ_API_KEY to the deployment environment.' }, { status: 503 });

  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: 'Could not read the uploaded audio. Please try again.' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an audio file to transcribe.' }, { status: 400 });
  if (!allowedExtensions.test(file.name)) return NextResponse.json({ error: 'Use an MP3, MP4, MPEG, M4A, WAV, WebM, OGG, or FLAC audio file.' }, { status: 415 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'This file is over the 4 MB upload limit. Compress it or split it into smaller files.' }, { status: 413 });

  const upstream = new FormData();
  upstream.append('file', file, file.name);
  upstream.append('model', 'whisper-large-v3-turbo');
  upstream.append('response_format', 'verbose_json');
  upstream.append('timestamp_granularities[]', 'segment');
  const language = String(form.get('language') || '').trim();
  if (language && language !== 'auto') upstream.append('language', language);

  try {
    const result = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: upstream,
    });
    const data = await result.json();
    if (!result.ok) {
      const message = typeof data?.error?.message === 'string' ? data.error.message : 'The transcription service could not process this file.';
      return NextResponse.json({ error: message }, { status: result.status === 429 ? 429 : 502 });
    }

    const segments: { start: number; end: number; text: string }[] = Array.isArray(data.segments)
      ? data.segments.map((segment: { start: number; end: number; text: string }) => ({ start: segment.start, end: segment.end, text: segment.text })) : [];
    let enhancedText = data.text || '';
    let enhanced = false;
    if (form.get('enhance') === 'true' && enhancedText.trim()) {
      const cleanup = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile', temperature: 0.1, max_tokens: 8000,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Improve readability of each speech transcript segment with punctuation, capitalization, and obvious transcription corrections. Keep exactly the same meaning, language, names, order, and number of segments. Never summarize or add content. Reply as a JSON object with a single "segments" array of strings, one cleaned string per input segment.' },
            { role: 'user', content: JSON.stringify({ segments: segments.length ? segments.map(segment => segment.text) : [enhancedText] }) },
          ],
        }),
      });
      if (cleanup.ok) {
        const cleaned = await cleanup.json();
        try {
          const values = JSON.parse(cleaned.choices?.[0]?.message?.content || '{}').segments;
          if (Array.isArray(values) && values.length === (segments.length || 1) && values.every((value: unknown) => typeof value === 'string')) {
            if (segments.length) segments.forEach((segment, index) => { segment.text = values[index]; });
            enhancedText = values.join(' ').replace(/\s+/g, ' ').trim();
            enhanced = true;
          }
        } catch { /* Keep the original, timestamp-aligned transcript if cleanup is malformed. */ }
      }
    }
    return NextResponse.json({
      text: enhancedText,
      originalText: data.text || '',
      segments,
      duration: typeof data.duration === 'number' ? data.duration : null,
      language: data.language || null,
      enhanced,
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the transcription service. Check your connection and try again.' }, { status: 502 });
  }
}
