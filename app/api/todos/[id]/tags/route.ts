import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getTodoDetailsById, setTodoTags } from '@/lib/db';

function parseId(id: string): number | null {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const todoId = parseId(id);
  if (!todoId) {
    return NextResponse.json({ error: 'Invalid todo id.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { tag_ids?: number[] };
    setTodoTags(session.userId, todoId, body.tag_ids ?? []);
    const todo = getTodoDetailsById(session.userId, todoId);
    return NextResponse.json({ todo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update todo tags.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const todoId = parseId(id);
  if (!todoId) {
    return NextResponse.json({ error: 'Invalid todo id.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { tag_ids?: number[]; tag_id?: number };
    const current = getTodoDetailsById(session.userId, todoId);
    if (!current) {
      return NextResponse.json({ error: 'Todo not found.' }, { status: 404 });
    }

    let nextTagIds = current.tags.map((tag) => tag.id);
    if (body.tag_id) {
      nextTagIds = nextTagIds.filter((id) => id !== body.tag_id);
    }

    if (body.tag_ids) {
      nextTagIds = nextTagIds.filter((id) => !body.tag_ids?.includes(id));
    }

    setTodoTags(session.userId, todoId, nextTagIds);
    const todo = getTodoDetailsById(session.userId, todoId);
    return NextResponse.json({ todo });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove todo tags.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
