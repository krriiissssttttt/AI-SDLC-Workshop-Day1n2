import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { useTemplate } from '@/lib/db';

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
  const templateId = parseId(id);
  if (!templateId) {
    return NextResponse.json({ error: 'Invalid template id.' }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { due_date?: string | null };
    const todo = useTemplate(session.userId, templateId, { due_date: body?.due_date ?? null });
    return NextResponse.json({ todo }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to use template.';
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
