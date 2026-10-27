import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const AUDIO_EXTENSIONS = /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i;

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'Large uploads need a private Vercel Blob store connected to this project. Create one in Vercel → Storage, then redeploy.' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('incoming/') || pathname.includes('..') || !AUDIO_EXTENSIONS.test(pathname)) {
          throw new Error('Only supported audio files can be uploaded.');
        }
        return {
          allowedContentTypes: ['audio/*', 'video/mp4', 'video/webm', 'application/octet-stream'],
          maximumSizeInBytes: MAX_AUDIO_BYTES,
          validUntil: Date.now() + 60 * 60 * 1000,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not authorize this upload. Check that a private Vercel Blob store is connected.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
