import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { findUserByUsername } from '@/lib/db';
import { getWebAuthnConfig, isValidUsername, normalizeUsername, setPendingChallenge } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string };
    const username = normalizeUsername(body.username ?? '');

    if (!isValidUsername(username)) {
      return NextResponse.json({ error: 'Invalid username. Use 3-32 letters, numbers, "_" or "-".' }, { status: 400 });
    }

    const existingUser = findUserByUsername(username);
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }

    const webAuthnConfig = getWebAuthnConfig(request);
    const options = await generateRegistrationOptions({
      rpName: webAuthnConfig.rpName,
      rpID: webAuthnConfig.expectedRPID,
      userName: username,
      userDisplayName: username,
      userID: new TextEncoder().encode(username),
      timeout: 60_000,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await setPendingChallenge({
      challenge: options.challenge,
      username,
      flow: 'register',
    });

    return NextResponse.json(options);
  } catch {
    return NextResponse.json({ error: 'Unable to generate registration challenge.' }, { status: 400 });
  }
}
