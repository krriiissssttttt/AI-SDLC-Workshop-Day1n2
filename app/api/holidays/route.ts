import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listHolidays } from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const start = request.nextUrl.searchParams.get('start') ?? undefined;
  const end = request.nextUrl.searchParams.get('end') ?? undefined;

  return NextResponse.json({ holidays: listHolidays(start, end) });
}
