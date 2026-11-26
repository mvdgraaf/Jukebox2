import { NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { requestsCache } from '@/src/request-cache';

const requestsDB = db.orm.public.Request;

const LIMITS = { title: 200, artist: 200, requesterName: 50, message: 140 } as const;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const ALLOWED_IMAGE_HOSTS = ['i.scdn.co', 'mosaic.scdn.co', 'image-cdn-ak.spotifycdn.com'];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

type ValidInput = {
    title: string;
    artist: string;
    spotifyId: string | null;
    albumArt: string | null;
    requesterName: string;
    message: string | null;
};

type Result = { ok: true; data: ValidInput } | { ok: false; error: string };

function cleanString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
}

function validateBody(body: unknown): Result {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return { ok: false, error: 'Ongeldige aanvraag' };
    }
    const b = body as Record<string, unknown>;

    const title = cleanString(b.title);
    if (!title) return { ok: false, error: 'Titel is verplicht' };
    if (title.length > LIMITS.title) {
        return { ok: false, error: `Titel mag maximaal ${LIMITS.title} tekens zijn` };
    }

    const artist = cleanString(b.artist);
    if (!artist) return { ok: false, error: 'Artiest is verplicht' };
    if (artist.length > LIMITS.artist) {
        return { ok: false, error: `Artiest mag maximaal ${LIMITS.artist} tekens zijn` };
    }

    // Optioneel: naam
    let requesterName = 'Anoniem';
    if (b.requesterName != null && b.requesterName !== '') {
        const name = cleanString(b.requesterName);
        if (name === null) return { ok: false, error: 'Ongeldige naam' };
        if (name.length > LIMITS.requesterName) {
            return { ok: false, error: `Naam mag maximaal ${LIMITS.requesterName} tekens zijn` };
        }
        requesterName = name || 'Anoniem';
    }

    // Optioneel: bericht
    let message: string | null = null;
    if (b.message != null && b.message !== '') {
        const msg = cleanString(b.message);
        if (msg === null) return { ok: false, error: 'Ongeldig bericht' };
        if (msg.length > LIMITS.message) {
            return { ok: false, error: `Bericht mag maximaal ${LIMITS.message} tekens zijn` };
        }
        message = msg || null;
    }

    // Optioneel: Spotify ID
    let spotifyId: string | null = null;
    if (b.spotifyId != null && b.spotifyId !== '') {
        if (typeof b.spotifyId !== 'string' || !SPOTIFY_ID.test(b.spotifyId)) {
            return { ok: false, error: 'Ongeldig Spotify ID' };
        }
        spotifyId = b.spotifyId;
    }

    // Optioneel: albumhoes (komt in een <img src>, dus alleen https van Spotify)
    let albumArt: string | null = null;
    if (b.albumArt != null && b.albumArt !== '') {
        if (typeof b.albumArt !== 'string' || b.albumArt.length > 500) {
            return { ok: false, error: 'Ongeldige albumhoes' };
        }
        try {
            const url = new URL(b.albumArt);
            if (url.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.includes(url.hostname)) {
                return { ok: false, error: 'Ongeldige albumhoes' };
            }
            albumArt = url.toString();
        } catch {
            return { ok: false, error: 'Ongeldige albumhoes' };
        }
    }

    return { ok: true, data: { title, artist, spotifyId, albumArt, requesterName, message } };
}

export async function GET() {
    try {
        const requests = await requestsCache.get(async () =>
            await requestsDB
                .where((r) => r.status.in(['pending', 'approved']))
                .orderBy([(r) => r.upvotes.desc(), (r) => r.createdAt.asc()])
                .all()
        );

        return NextResponse.json(requests);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Fout bij ophalen' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Ongeldige JSON' }, { status: 400 });
    }

    const parsed = validateBody(raw);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const input = parsed.data;

    try {
        const activeStatus = (r: { status: { in: (arg0: string[]) => any } }) =>
            r.status.in(['pending', 'approved']);

        const existing = input.spotifyId
            ? await requestsDB.where({ spotifyId: input.spotifyId }).where(activeStatus).first()
            : await requestsDB
                .where({ title: input.title, artist: input.artist })
                .where(activeStatus)
                .first();

        if (existing) {
            const updated = await requestsDB
                .where({ id: existing.id })
                .update({ upvotes: existing.upvotes + 1 });
            requestsCache.invalidate();
            return NextResponse.json(updated, { status: 200 });
        }

        const newRequest = await requestsDB.create({
            spotifyId: input.spotifyId ?? `manual-${Date.now()}`,
            title: input.title,
            artist: input.artist,
            albumArt: input.albumArt,
            requesterName: input.requesterName,
            message: input.message,
        });

        requestsCache.invalidate();
        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Fout bij aanmaken' }, { status: 500 });
    }
}