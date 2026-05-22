import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'session';
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export interface Session {
  userId: number;
  username: string;
}

interface SessionPayload extends JWTPayload {
  userId: number;
  username: string;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session): Promise<string> {
  return await new SignJWT({
    userId: session.userId,
    username: session.username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function setSession(session: Session): Promise<void> {
  const token = await createSessionToken(session);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const result = await jwtVerify<SessionPayload>(token, getJwtSecret());
    const { userId, username } = result.payload;

    if (!userId || !username) {
      return null;
    }

    return {
      userId,
      username,
    };
  } catch {
    return null;
  }
}
