import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Groq Transcribe — Audio, made readable',
  description: 'Transcribe audio in one focused workspace. Upload a file, clean up the transcript, and export subtitles or text.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
