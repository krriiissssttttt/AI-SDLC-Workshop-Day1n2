import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { buildExportPayload } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const payload = buildExportPayload(session.userId);
  return NextResponse.json(payload);
}
