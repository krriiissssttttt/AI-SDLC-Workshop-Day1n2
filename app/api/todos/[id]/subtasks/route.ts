import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createSubtask } from '@/lib/db';

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
    const body = (await request.json()) as { title?: string };
    if (!body.title) {
      return NextResponse.json({ error: 'Subtask title is required.' }, { status: 400 });
    }

    const subtask = createSubtask(session.userId, todoId, body.title);
    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create subtask.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
