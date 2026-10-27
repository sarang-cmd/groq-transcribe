import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Groq Transcribe: Audio, made readable',
  description: 'Bring your own Groq API key. Send audio directly to Groq, prepare large recordings in your browser, and export subtitles or text.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
