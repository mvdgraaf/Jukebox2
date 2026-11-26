import { NextResponse } from 'next/server';
import { searchTracks } from '@/src/spotify';

export async function GET(request: Request) {
    const q = new URL(request.url).searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json([]);

    try {
        return NextResponse.json(await searchTracks(q));
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Zoeken mislukt' }, { status: 502 });
    }
}