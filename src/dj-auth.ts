export const DJ_COOKIE = 'dj_session';
export const SESSION_SECONDS = 60 * 60 * 12; // 12 uur

const encoder = new TextEncoder();

function getSecret(): string {
    const secret = process.env.DJ_SESSION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error('DJ_SESSION_SECRET ontbreekt of is korter dan 32 tekens');
    }
    return secret;
}

function hmacKey(usage: KeyUsage[]) {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(getSecret()),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        usage
    );
}

function toHex(buf: ArrayBuffer): string {
    return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
    if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null;
    const out = new Uint8Array(new ArrayBuffer(hex.length / 2));
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

export async function createSessionToken(): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
    const payload = `dj.${exp}`;
    const sig = await crypto.subtle.sign('HMAC', await hmacKey(['sign']), encoder.encode(payload));
    return `${payload}.${toHex(sig)}`;
}

export async function verifySessionToken(token?: string | null): Promise<boolean> {
    if (!token) return false;

    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'dj') return false;

    const [, expStr, sigHex] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;

    const sig = fromHex(sigHex);
    if (!sig) return false;

    // crypto.subtle.verify vergelijkt in constante tijd
    return crypto.subtle.verify(
        'HMAC',
        await hmacKey(['verify']),
        sig,
        encoder.encode(`dj.${expStr}`)
    );
}