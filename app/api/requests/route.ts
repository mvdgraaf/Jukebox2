import { NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';

const requestsDB = db.orm.public.Request;

export async function GET() {
    try {
        const requests = await requestsDB
            .where((r) => r.status.in(['pending', 'approved']))
            .orderBy([(r) => r.upvotes.desc(), (r) => r.createdAt.asc()])
            .all();

        return NextResponse.json(requests);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Fout bij ophalen' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        if (!body.title || !body.artist) {
            return NextResponse.json({ error: 'Titel en artiest zijn verplicht' }, { status: 400 });
        }

        const activeStatus = (r: { status: { in: (arg0: string[]) => any; }; }) => r.status.in(['pending', 'approved']);

        const existing = body.spotifyId
            ? await requestsDB.where({ spotifyId: body.spotifyId }).where(activeStatus).first()
            : await requestsDB
                .where({ title: body.title, artist: body.artist })
                .where(activeStatus)
                .first();

        if (existing) {
            const updated = await requestsDB
                .where({ id: existing.id })
                .update({ upvotes: existing.upvotes + 1 });
            return NextResponse.json(updated, { status: 200 });
        }

        const newRequest = await requestsDB.create({
            spotifyId: body.spotifyId || `manual-${Date.now()}`,
            title: body.title,
            artist: body.artist,
            albumArt: body.albumArt || null,
            requesterName: body.requesterName || 'Anoniem',
            message: body.message || null,
        });

        return NextResponse.json(newRequest, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Fout bij aanmaken' }, { status: 500 });
    }
}