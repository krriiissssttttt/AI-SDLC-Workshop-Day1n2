import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { findUserByUsername, listAuthenticatorsByUserId } from '@/lib/db';
import { getWebAuthnConfig, isValidUsername, normalizeUsername, setPendingChallenge } from '@/lib/webauthn';

function parseTransports(raw: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    return parsed.filter((item): item is AuthenticatorTransportFuture => typeof item === 'string');
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string };
    const username = normalizeUsername(body.username ?? '');

    if (!isValidUsername(username)) {
      return NextResponse.json({ error: 'Invalid username. Use 3-32 letters, numbers, "_" or "-".' }, { status: 400 });
    }

    const user = findUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const authenticators = listAuthenticatorsByUserId(user.id);
    if (authenticators.length === 0) {
      return NextResponse.json({ error: 'No passkey registered for this user.' }, { status: 400 });
    }

    const webAuthnConfig = getWebAuthnConfig(request);
    const options = await generateAuthenticationOptions({
      rpID: webAuthnConfig.expectedRPID,
      timeout: 60_000,
      userVerification: 'preferred',
      allowCredentials: authenticators.map((authenticator) => ({
        id: authenticator.credential_id,
        type: 'public-key',
        transports: parseTransports(authenticator.transports),
      })),
    });

    await setPendingChallenge({
      challenge: options.challenge,
      username,
      flow: 'login',
    });

    return NextResponse.json(options);
  } catch {
    return NextResponse.json({ error: 'Unable to generate login challenge.' }, { status: 400 });
  }
}
