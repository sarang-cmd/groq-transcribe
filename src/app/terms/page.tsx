import Link from 'next/link';

export default function Terms() {
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
      <h1>Terms of Service</h1>
      <p className="legal-updated">Draft for review. October 2026</p>
      <div className="draft-notice"><strong>Draft, not legal advice.</strong> The operator’s legal name, address, contact email, governing law, and final terms need review. Complete this page with qualified counsel before public release.</div>
      <p>This draft describes the current Groq Transcribe prototype. The operator must approve final terms before launch.</p>

      <h2>Service</h2>
      <p>Groq Transcribe is a bring-your-own-key tool. Enter your Groq API key. Your browser sends audio and optional cleanup requests directly to Groq. Files above 20 MB are split into eight-minute FLAC chunks in your browser. Vercel’s 4 MB function request limit does not apply because audio bypasses Vercel Functions. SRT and WebVTT files convert locally. The app does not store or proxy your key.</p>

      <h2>Your files</h2>
      <p>You need permission to submit recordings and use transcripts. Do not submit unlawful recordings or content without permission. Transcription errors occur. Review each transcript before publication or any use where accuracy matters.</p>

      <h2>Processing and availability</h2>
      <p>The app has no database. Results stay in browser memory until you refresh, close the tab, or clear the queue. Groq processes audio and optional cleanup text under its terms and data practices. Check Groq’s current file limits, quotas, and service status before use.</p>

      <h2>Costs and acceptable use</h2>
      <p>Groq bills the account tied to your API key. You are responsible for its charges, quotas, rate limits, and use rules. Do not disrupt the service or bypass provider limits.</p>

      <h2>Operator details to complete</h2>
      <ul>
        <li>Legal operator name and contact address</li>
        <li>Support and privacy email</li>
        <li>Governing law and dispute process</li>
        <li>Service fees, limits, warranty, and liability terms</li>
      </ul>
      <p>See the <Link href="https://github.com/sarang-cmd/groq-transcribe">project repository</Link> for source code and setup details.</p>
    </article>
  </main>;
}
