import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTag, listTagsForUser } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({ tags: listTagsForUser(session.userId) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { name?: string; color?: string };
    if (!body.name || !body.color) {
      return NextResponse.json({ error: 'Tag name and color are required.' }, { status: 400 });
    }

    const tag = createTag(session.userId, { name: body.name, color: body.color });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create tag.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
