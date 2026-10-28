import Link from 'next/link';

export default function Privacy() {
  return <main className="legal-page">
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true"><i/><i/><i/><i/><i/></span>
        <span>groq<span className="brand-light">transcribe</span></span>
      </Link>
      <Link className="nav-action" href="/">Back to studio <span aria-hidden="true">↗</span></Link>
    </header>
    <article className="legal-main">
      <p className="section-index">SERVICE INFORMATION</p>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Draft for review. October 2026</p>
      <div className="draft-notice"><strong>Draft, not legal advice.</strong> The operator name, contact details, hosting setup, and retention terms need review before launch. Check local privacy rules and complete this notice.</div>
      <p>This draft describes data flows in the current Groq Transcribe app. Update the notice when the service or operator practices change.</p>

      <h2>Data sent to Groq</h2>
      <p>Your browser sends audio and your Groq API key directly to Groq over HTTPS. Files above 20 MB are converted in your browser to eight-minute FLAC chunks. Your browser sends each chunk to Groq. The app does not send audio or the key through a Vercel API route or Blob store. Transcript cleanup sends text segments to Groq. SRT and WebVTT conversion runs in your browser. If you select Name with AI, your browser sends up to 6,000 characters of transcript text to Groq to create a filename.</p>

      <h2>Storage</h2>
      <p>The app has no database. Your API key and transcripts stay in page memory. Refreshing or closing the tab clears them. Your browser creates downloaded files and stores notification permission. Optional alerts show file counts and completion status, not filenames or transcript text. Vercel serves the app and its static assets. The app sends no audio, transcript, or API key to Vercel endpoints.</p>

      <h2>API key and security</h2>
      <p>You enter your own Groq API key. The browser sends the key in the authorization header to Groq. The app does not save the key. Scripts on this site access the key while the page stays open. Enter a key only when you trust this site. Revoke or rotate an exposed key in Groq Console. The app has no accounts, analytics, or tracking cookies.</p>

      <h2>Third-party processing</h2>
      <p>Groq receives audio, your API key, and optional cleanup text. Review Groq’s current terms, retention settings, and data policies before sending sensitive recordings. Submit only recordings you have permission to process.</p>

      <h2>Your choices and contact</h2>
      <p>Skip audio submission, turn off transcript cleanup, or clear queued files. Send privacy requests to the service operator. The operator’s name, contact email, legal basis, rights process, and jurisdiction still need review before publication.</p>
      <p><Link href="/terms">Read the draft Terms of Service</Link> or return to the <Link href="/">transcription workspace</Link>.</p>
    </article>
  </main>;
}
