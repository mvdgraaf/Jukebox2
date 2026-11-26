import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'node:crypto';
import { DJ_COOKIE, SESSION_SECONDS, createSessionToken } from '@/src/dj-auth';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

const sha = (value: string) => createHash('sha256').update(value).digest();

function clientIp(request: Request): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'onbekend';
}

export async function POST(request: Request) {
    const expected = process.env.DJ_PASSWORD;
    if (!expected) {
        console.error('DJ_PASSWORD ontbreekt in .env');
        return NextResponse.json({ error: 'Inloggen is niet ingesteld.' }, { status: 500 });
    }

    const ip = clientIp(request);
    const now = Date.now();
    const entry = attempts.get(ip);

    if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
        return NextResponse.json(
            { error: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.' },
            { status: 429 }
        );
    }

    let password = '';
    try {
        const body = await request.json();
        if (typeof body.password === 'string') password = body.password;
    } catch {
        /* ongeldige body: behandelen als leeg wachtwoord */
    }

    if (!timingSafeEqual(sha(password), sha(expected))) {
        if (!entry || entry.resetAt <= now) {
            attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        } else {
            entry.count += 1;
        }
        return NextResponse.json({ error: 'Wachtwoord klopt niet.' }, { status: 401 });
    }

    attempts.delete(ip);

    const jar = await cookies();
    jar.set(DJ_COOKIE, await createSessionToken(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_SECONDS,
    });

    return NextResponse.json({ success: true });
}