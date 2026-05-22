import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { importTodoPayload, type ImportRequestV1 } from '@/lib/db';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: 'File exceeds size limit (5 MB).' }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const bodySize = Buffer.byteLength(rawBody, 'utf8');

    if (bodySize > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: 'File exceeds size limit (5 MB).' }, { status: 400 });
    }

    const body = JSON.parse(rawBody) as ImportRequestV1;

    if (!body || typeof body !== 'object' || !body.payload || typeof body.payload !== 'object') {
      return NextResponse.json({ error: 'Invalid import payload.' }, { status: 400 });
    }

    if (body.mode && body.mode !== 'merge' && body.mode !== 'replace') {
      return NextResponse.json({ error: 'Invalid import mode.' }, { status: 400 });
    }

    const result = importTodoPayload(session.userId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('Unsupported export version')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message.includes('validation')) {
        return NextResponse.json({ error: 'Import failed validation. No data was written.' }, { status: 400 });
      }

      return NextResponse.json({ error: 'Import failed. Please check the file format.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Import failed.' }, { status: 400 });
  }
}
