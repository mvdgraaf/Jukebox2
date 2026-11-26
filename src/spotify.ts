type CachedToken = { value: string; expiresAt: number };
let cached: CachedToken | null = null;

async function getToken(): Promise<string> {
    if (cached && Date.now() < cached.expiresAt) return cached.value;

    const id = process.env.SPOTIFY_CLIENT_ID;
    const secret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!id || !secret) throw new Error('SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET ontbreken');

    const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials' }),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Spotify token-fout: ${res.status}`);

    const data = await res.json();
    // 60s marge zodat het token nooit net tijdens een request verloopt
    cached = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return cached.value;
}

export type SpotifyTrack = {
    spotifyId: string;
    title: string;
    artist: string;
    albumArt: string | null;
};

export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
    const token = await getToken();
    const params = new URLSearchParams({
        q: query,
        type: 'track',
        limit: '10', // max sinds feb 2026
        market: 'NL',
    });

    const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Spotify zoek-fout: ${res.status}`);

    const data = await res.json();
    return (data.tracks?.items ?? [])
        .filter(Boolean)
        .map((t: any) => ({
            spotifyId: t.id,
            title: t.name,
            artist: t.artists.map((a: { name: string }) => a.name).join(', '),
            albumArt: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? null,
        }));
}