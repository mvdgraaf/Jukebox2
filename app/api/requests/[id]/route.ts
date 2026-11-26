import { NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { isDJ } from '@/src/dj-guard';
import { requestsCache } from '@/src/request-cache';

const requestsDB = db.orm.public.Request;

const STATUSES = ['pending', 'approved', 'played', 'rejected'];

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        // Actie 1: Upvote door bezoeker (publiek)
        if (body.action === 'upvote') {
            const current = await requestsDB.where({ id }).first();
            if (!current) {
                return NextResponse.json({ error: 'Verzoek niet gevonden' }, { status: 404 });
            }
            const updated = await requestsDB
                .where({ id })
                .update({ upvotes: current.upvotes + 1 });
            requestsCache.invalidate();
            return NextResponse.json(updated);
        }

        // Actie 2: Status update door DJ (alleen met login)
        if (body.status) {
            if (!(await isDJ())) {
                return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
            }
            if (!STATUSES.includes(body.status)) {
                return NextResponse.json({ error: 'Ongeldige status' }, { status: 400 });
            }

            const current = await requestsDB.where({ id }).first();
            if (!current) {
                return NextResponse.json({ error: 'Verzoek niet gevonden' }, { status: 404 });
            }
            const updated = await requestsDB.where({ id }).update({ status: body.status });
            requestsCache.invalidate();
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: 'Ongeldige actie' }, { status: 400 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Fout bij bijwerken' }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!(await isDJ())) {
        return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
    }

    try {
        const { id } = await params;
        await requestsDB.where({ id }).delete();
        requestsCache.invalidate();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Fout bij verwijderen' }, { status: 500 });
    }
}