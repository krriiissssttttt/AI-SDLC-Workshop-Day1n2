import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { deleteSubtask, updateSubtask } from '@/lib/db';

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
  const subtaskId = parseId(id);
  if (!subtaskId) {
    return NextResponse.json({ error: 'Invalid subtask id.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { title?: string; completed?: boolean };
    const subtask = updateSubtask(session.userId, subtaskId, body);
    return NextResponse.json({ subtask });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update subtask.';
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
  const subtaskId = parseId(id);
  if (!subtaskId) {
    return NextResponse.json({ error: 'Invalid subtask id.' }, { status: 400 });
  }

  try {
    deleteSubtask(session.userId, subtaskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete subtask.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
