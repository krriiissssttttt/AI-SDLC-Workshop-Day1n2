import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteTag, updateTag } from '@/lib/db';

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const tagId = parseId(id);
  if (!tagId) {
    return NextResponse.json({ error: 'Invalid tag id.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { name?: string; color?: string };
    const tag = updateTag(session.userId, tagId, body);
    return NextResponse.json({ tag });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update tag.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const tagId = parseId(id);
  if (!tagId) {
    return NextResponse.json({ error: 'Invalid tag id.' }, { status: 400 });
  }

  try {
    deleteTag(session.userId, tagId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete tag.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
