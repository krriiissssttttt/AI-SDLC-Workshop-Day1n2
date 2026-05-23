import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const CHALLENGE_COOKIE_NAME = 'webauthn_challenge';
const CHALLENGE_COOKIE_MAX_AGE_SECONDS = 5 * 60;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

type ChallengeFlow = 'register' | 'login';

interface PendingChallenge {
  challenge: string;
  username: string;
  flow: ChallengeFlow;
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}

export function normalizeUsername(username: string): string {
  return username.trim();
}

function normalizeConfiguredOrigin(value: string): string {
  const parsed = new URL(value);
  return parsed.origin;
}

function normalizeConfiguredRpId(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.includes('://') || normalized.includes('/')) {
    throw new Error('WEBAUTHN_RP_ID must be a hostname only (for example: example.com)');
  }

  return normalized;
}

function resolveExpectedOrigin(request: NextRequest): string {
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN?.trim();
  if (configuredOrigin) {
    return normalizeConfiguredOrigin(configuredOrigin);
  }

  const requestOrigin = request.headers.get('origin') ?? new URL(request.url).origin;
  return new URL(requestOrigin).origin;
}

export function getWebAuthnConfig(request: NextRequest): { expectedOrigin: string; expectedRPID: string; rpName: string } {
  const configuredOrigin = process.env.WEBAUTHN_ORIGIN?.trim();
  const configuredRpId = process.env.WEBAUTHN_RP_ID?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && (!configuredOrigin || !configuredRpId)) {
    throw new Error('WEBAUTHN_ORIGIN and WEBAUTHN_RP_ID must be configured in production');
  }

  const expectedOrigin = resolveExpectedOrigin(request);
  const expectedRPID = configuredRpId ? normalizeConfiguredRpId(configuredRpId) : new URL(expectedOrigin).hostname;
  const rpName = process.env.WEBAUTHN_RP_NAME?.trim() || 'Todo App';

  return {
    expectedOrigin,
    expectedRPID,
    rpName,
  };
}

export async function setPendingChallenge(challenge: PendingChallenge): Promise<void> {
  const cookieStore = await cookies();
  const encoded = Buffer.from(JSON.stringify(challenge), 'utf8').toString('base64url');

  cookieStore.set(CHALLENGE_COOKIE_NAME, encoded, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CHALLENGE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
  });
}

export async function consumePendingChallenge(flow: ChallengeFlow, username: string): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CHALLENGE_COOKIE_NAME)?.value;
  cookieStore.delete(CHALLENGE_COOKIE_NAME);

  if (!raw) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as PendingChallenge;
    const normalized = normalizeUsername(username);

    if (parsed.flow !== flow || parsed.username !== normalized || !parsed.challenge) {
      return null;
    }

    return parsed.challenge;
  } catch {
    return null;
  }
}
