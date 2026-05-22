import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { setSession } from '@/lib/auth';
import { findAuthenticatorByCredentialId, findUserByUsername, updateAuthenticatorCounter } from '@/lib/db';
import { consumePendingChallenge, getWebAuthnConfig, isValidUsername, normalizeUsername } from '@/lib/webauthn';

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
    const body = (await request.json()) as { username?: string; response?: AuthenticationResponseJSON };
    const username = normalizeUsername(body.username ?? '');

    if (!isValidUsername(username) || !body.response?.id) {
      return NextResponse.json({ error: 'Invalid login request.' }, { status: 400 });
    }

    const expectedChallenge = await consumePendingChallenge('login', username);
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Login challenge expired. Please try again.' }, { status: 400 });
    }

    const user = findUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    const authenticator = findAuthenticatorByCredentialId(body.response.id);
    if (!authenticator || authenticator.user_id !== user.id) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    const webAuthnConfig = getWebAuthnConfig(request);
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: webAuthnConfig.expectedOrigin,
      expectedRPID: webAuthnConfig.expectedRPID,
      requireUserVerification: true,
      credential: {
        id: authenticator.credential_id,
        publicKey: isoBase64URL.toBuffer(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
        transports: parseTransports(authenticator.transports),
      },
    });

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
    }

    updateAuthenticatorCounter(authenticator.credential_id, verification.authenticationInfo.newCounter ?? 0);
    await setSession({ userId: user.id, username: user.username });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to complete login.' }, { status: 500 });
  }
}
