'use client';

import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import JSZip from 'jszip';

type Segment = { start: number; end: number; text: string };
type Job = {
  id: string; file: File; status: 'queued' | 'working' | 'done' | 'error';
  text?: string; segments?: Segment[]; duration?: number | null; language?: string | null;
  enhanced?: boolean; error?: string;
};
type Format = 'txt' | 'srt' | 'vtt' | 'json';
const ACCEPT = '.mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm,.ogg,.oga,.flac';
const MAX_BYTES = 4 * 1024 * 1024;

function stamp(seconds: number, comma = true) {
  const ms = Math.max(0, Math.floor(seconds * 1000));
  const hours = Math.floor(ms / 3600000), minutes = Math.floor(ms / 60000) % 60;
  const secs = Math.floor(ms / 1000) % 60, millis = ms % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${comma ? ',' : '.'}${String(millis).padStart(3, '0')}`;
}
function output(job: Job, format: Format) {
  const segments = job.segments || [];
  if (format === 'txt') return job.text || '';
  if (format === 'json') return JSON.stringify({ file: job.file.name, text: job.text, language: job.language, duration: job.duration, segments }, null, 2);
  if (format === 'vtt') return `WEBVTT\n\n${segments.map((segment, index) => `${index + 1}\n${stamp(segment.start, false)} --> ${stamp(segment.end, false)}\n${segment.text.trim()}`).join('\n\n')}\n`;
  return segments.map((segment, index) => `${index + 1}\n${stamp(segment.start)} --> ${stamp(segment.end)}\n${segment.text.trim()}`).join('\n\n') + '\n';
}
function sizeLabel(bytes: number) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
function stem(name: string) { return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '_'); }

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [format, setFormat] = useState<Format>('srt');
  const [language, setLanguage] = useState('auto');
  const [enhance, setEnhance] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const doneCount = jobs.filter(job => job.status === 'done').length;
  const busy = jobs.some(job => job.status === 'working');

  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files);
    const valid: Job[] = [];
    const problems: string[] = [];
    for (const file of incoming) {
      if (!/\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i.test(file.name)) { problems.push(`${file.name}: unsupported format`); continue; }
      if (file.size > MAX_BYTES) { problems.push(`${file.name}: over 4 MB`); continue; }
      if (jobs.some(job => job.file.name === file.name && job.file.size === file.size) || valid.some(job => job.file.name === file.name && job.file.size === file.size)) continue;
      valid.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, status: 'queued' });
    }
    if (valid.length) { setJobs(current => [...current, ...valid]); setNotice(''); }
    if (problems.length) setNotice(problems.slice(0, 3).join('. ') + (problems.length > 3 ? `, and ${problems.length - 3} more.` : '.'));
  }
  function onPick(event: ChangeEvent<HTMLInputElement>) { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }
  function onDrop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }

  async function transcribe(job: Job) {
    setJobs(current => current.map(item => item.id === job.id ? { ...item, status: 'working', error: undefined } : item));
    const body = new FormData(); body.append('file', job.file); body.append('language', language); body.append('enhance', String(enhance));
    try {
      const response = await fetch('/api/transcribe', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Transcription failed.');
      setJobs(current => current.map(item => item.id === job.id ? { ...item, status: 'done', text: result.text, segments: result.segments, duration: result.duration, language: result.language, enhanced: result.enhanced } : item));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setJobs(current => current.map(item => item.id === job.id ? { ...item, status: 'error', error: message } : item));
    }
  }
  async function runAll() {
    const queued = jobs.filter(job => job.status === 'queued' || job.status === 'error');
    for (let index = 0; index < queued.length; index += 2) await Promise.all(queued.slice(index, index + 2).map(transcribe));
  }
  function download(job: Job, as = format) {
    if (as !== 'txt' && !job.segments?.length && as !== 'json') { setNotice('This transcription did not include timestamped segments. Try TXT or JSON.'); return; }
    const blob = new Blob([output(job, as)], { type: as === 'json' ? 'application/json' : as === 'txt' ? 'text/plain' : 'text/plain;charset=utf-8' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${stem(job.file.name)}.${as}`; link.click(); URL.revokeObjectURL(link.href);
  }
  async function downloadAll() {
    const complete = jobs.filter(job => job.status === 'done');
    if (!complete.length) return;
    const zip = new JSZip();
    for (const job of complete) zip.file(`${stem(job.file.name)}.${format}`, output(job, format));
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `groq-transcribe-${format}-exports.zip`; link.click(); URL.revokeObjectURL(link.href);
  }
  function remove(id: string) { setJobs(current => current.filter(job => job.id !== id)); if (active === id) setActive(null); }
  function updateText(id: string, text: string) { setJobs(current => current.map(job => job.id === id ? { ...job, text } : job)); }
  const current = jobs.find(job => job.id === active) || jobs.find(job => job.status === 'done');

  return <main>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Groq Transcribe home"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/></span><span>groq<span className="brand-light">transcribe</span></span></a>
      <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#exports">Exports</a><a href="#footer">About</a></nav>
      <a className="nav-action" href="#studio">Open studio <span aria-hidden="true">↗</span></a>
    </header>

    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="overline">A quieter way to work with audio</p>
        <h1>Audio in.<br/><em>Words out.</em></h1>
        <p className="hero-summary">Turn recordings into clear transcripts and ready-to-use subtitles. Drop in a file, choose your output, and keep everything in one place.</p>
        <a className="hero-link" href="#studio">Start with an audio file <span aria-hidden="true">↓</span></a>
      </div>
      <div className="hero-note" aria-label="Supported audio file types"><span className="note-rule"/><p>For interviews, lectures,<br/>voice notes and video audio.</p><span className="note-meta">MP3 · WAV · M4A · MP4 · MORE</span></div>
    </section>

    <section className="studio" id="studio" aria-labelledby="studio-title">
      <div className="studio-heading"><div><p className="section-index">01 / YOUR WORKSPACE</p><h2 id="studio-title">Start with a file.</h2><p className="section-intro">Upload one recording or a whole batch. Your files stay in this session.</p></div><span className="engine-label"><span className="engine-dot"/> GROQ AUDIO</span></div>
      <div className="studio-grid">
        <div className="work-panel">
          <div className={`dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={onPick} aria-label="Choose audio files" />
            <div className="upload-glyph" aria-hidden="true"><span>↑</span></div>
            <h3>Drop audio files here</h3><p>or <button className="text-button" onClick={() => inputRef.current?.click()}>browse your device</button></p>
            <span className="upload-note">MP3, WAV, M4A, MP4, WebM, OGG or FLAC · up to 4 MB each</span>
          </div>
          <div className="options-row">
            <label className="select-wrap"><span>Audio language</span><select value={language} onChange={event => setLanguage(event.target.value)}><option value="auto">Detect automatically</option><option value="en">English</option><option value="de">German</option><option value="es">Spanish</option><option value="fr">French</option><option value="it">Italian</option><option value="pt">Portuguese</option><option value="nl">Dutch</option><option value="ja">Japanese</option><option value="zh">Chinese</option></select></label>
            <label className="enhance-toggle"><input type="checkbox" checked={enhance} onChange={event => setEnhance(event.target.checked)}/><span className="switch" aria-hidden="true"/><span><b>Clean up transcript</b><small>Improve punctuation and readability</small></span></label>
          </div>
          <div className="queue-head"><h3>Queue <span>{jobs.length}</span></h3>{jobs.length > 0 && <button className="quiet-button" onClick={() => { setJobs([]); setActive(null); setNotice(''); }}>Clear all</button>}</div>
          {jobs.length === 0 ? <div className="empty-queue">Your audio files will appear here.</div> : <ul className="file-list">{jobs.map(job => <li className="file-row" key={job.id}>
            <div className="file-type" aria-hidden="true">♪</div><div className="file-info"><strong title={job.file.name}>{job.file.name}</strong><span>{sizeLabel(job.file.size)}{job.duration ? ` · ${Math.floor(job.duration / 60)}:${String(Math.floor(job.duration % 60)).padStart(2, '0')}` : ''}</span></div>
            <div className={`file-status status-${job.status}`} aria-live="polite">{job.status === 'working' ? <><span className="spinner"/>Transcribing</> : job.status === 'done' ? 'Ready' : job.status === 'error' ? 'Needs attention' : 'In queue'}</div>
            {job.status === 'done' ? <button className="row-action" aria-label={`View ${job.file.name} transcript`} onClick={() => setActive(job.id)}>Open</button> : job.status === 'error' ? <button className="row-action" onClick={() => transcribe(job)}>Retry</button> : null}
            <button className="remove-button" aria-label={`Remove ${job.file.name}`} onClick={() => remove(job.id)}>×</button>
            {job.error && <p className="row-error">{job.error}</p>}
          </li>)}</ul>}
          {notice && <p className="notice" role="alert">{notice}</p>}
          <div className="queue-actions"><p>{doneCount > 0 ? `${doneCount} of ${jobs.length} file${jobs.length === 1 ? '' : 's'} ready` : 'Files are processed securely with your Groq API key.'}</p><button className="primary-button" onClick={runAll} disabled={!jobs.some(job => job.status === 'queued' || job.status === 'error') || busy}>{busy ? 'Transcribing…' : doneCount ? 'Transcribe remaining' : 'Transcribe audio'} <span aria-hidden="true">↗</span></button></div>
        </div>
        <aside className="result-panel" aria-label="Transcript results">
          <div className="result-head"><div><p className="section-index">02 / RESULT</p><h3>{current ? 'Transcript' : 'Your transcript'}</h3></div>{current && <span className="ready-label">READY</span>}</div>
          {!current ? <div className="result-empty"><div className="paper-icon" aria-hidden="true"><span/><span/><span/></div><p>Your transcript will appear here, ready to review and export.</p><small>No sample text. Your own recording is the preview.</small></div> : <div className="transcript-view"><p className="transcript-file">{current.file.name}{current.enhanced && <span> CLEANED UP</span>}</p><textarea aria-label={`Transcript for ${current.file.name}`} value={current.text || ''} onChange={event => updateText(current.id, event.target.value)} spellCheck />{current.language && <small className="detected-language">Detected language: {current.language}</small>}<button className="copy-button" onClick={() => navigator.clipboard?.writeText(current.text || '')}>Copy transcript</button></div>}
          <div className="export-box" id="exports"><label htmlFor="format-select">Export as</label><div className="export-controls"><select id="format-select" value={format} onChange={event => setFormat(event.target.value as Format)}><option value="srt">SubRip subtitle (.srt)</option><option value="vtt">WebVTT subtitle (.vtt)</option><option value="txt">Plain text (.txt)</option><option value="json">JSON with timestamps (.json)</option></select><button className="download-button" disabled={!current} onClick={() => current && download(current)}>Download</button></div><button className="batch-link" disabled={!doneCount} onClick={downloadAll}>↓ Download all {doneCount > 0 ? `${doneCount} files` : 'files'} as ZIP</button><p>Subtitle exports include timing from the original audio.</p></div>
        </aside>
      </div>
      <p className="privacy-note"><span aria-hidden="true">⌑</span> Your Groq key stays on the server. Audio is sent to Groq for processing and is not stored by this app.</p>
    </section>

    <section className="workflow" id="how-it-works">
      <div className="workflow-title"><p className="section-index">A SMALL, COMPLETE WORKFLOW</p><h2>From recording<br/>to ready-to-use.</h2></div>
      <div className="workflow-steps"><article><span>01</span><h3>Bring your audio</h3><p>Add a single recording or select a batch. Common audio and video formats are accepted up to 4 MB per file.</p></article><article><span>02</span><h3>Get a readable transcript</h3><p>Groq turns speech into text. Optional cleanup improves punctuation while keeping subtitle timing attached to each segment.</p></article><article><span>03</span><h3>Take it with you</h3><p>Export an SRT or WebVTT subtitle, plain text, or timestamped JSON. Download one result or package the batch together.</p></article></div>
    </section>

    <footer id="footer"><a className="brand footer-brand" href="#top"><span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/></span><span>groq<span className="brand-light">transcribe</span></span></a><p>Audio, made readable.</p><div className="footer-links"><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a><a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Get a Groq API key ↗</a></div><span className="copyright">© 2026 Groq Transcribe</span></footer>
  </main>;
}
