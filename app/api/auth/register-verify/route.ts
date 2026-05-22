import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse, type RegistrationResponseJSON } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { setSession } from '@/lib/auth';
import { createAuthenticator, createUser, findUserByUsername } from '@/lib/db';
import { consumePendingChallenge, getWebAuthnConfig, isValidUsername, normalizeUsername } from '@/lib/webauthn';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { username?: string; response?: RegistrationResponseJSON };
    const username = normalizeUsername(body.username ?? '');

    if (!isValidUsername(username) || !body.response) {
      return NextResponse.json({ error: 'Invalid registration request.' }, { status: 400 });
    }

    const expectedChallenge = await consumePendingChallenge('register', username);
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Registration challenge expired. Please try again.' }, { status: 400 });
    }

    if (findUserByUsername(username)) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }

    const webAuthnConfig = getWebAuthnConfig(request);
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: webAuthnConfig.expectedOrigin,
      expectedRPID: webAuthnConfig.expectedRPID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration verification failed.' }, { status: 401 });
    }

    const { registrationInfo } = verification;
    const userId = createUser(username);
    const credentialId =
      typeof registrationInfo.credential.id === 'string'
        ? registrationInfo.credential.id
        : isoBase64URL.fromBuffer(registrationInfo.credential.id);
    const credentialPublicKey =
      typeof registrationInfo.credential.publicKey === 'string'
        ? registrationInfo.credential.publicKey
        : isoBase64URL.fromBuffer(registrationInfo.credential.publicKey);

    createAuthenticator({
      userId,
      credentialId,
      credentialPublicKey,
      counter: registrationInfo.credential.counter ?? 0,
      credentialDeviceType: registrationInfo.credentialDeviceType ?? null,
      credentialBackedUp: registrationInfo.credentialBackedUp,
      transports: registrationInfo.credential.transports ? JSON.stringify(registrationInfo.credential.transports) : null,
    });

    await setSession({ userId, username });

    return NextResponse.json({ success: true, userId });
  } catch {
    return NextResponse.json({ error: 'Unable to complete registration.' }, { status: 500 });
  }
}
