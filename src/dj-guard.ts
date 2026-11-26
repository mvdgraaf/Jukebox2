import { cookies } from 'next/headers';
import { DJ_COOKIE, verifySessionToken } from '@/src/dj-auth';

export async function isDJ(): Promise<boolean> {
    const jar = await cookies();
    return verifySessionToken(jar.get(DJ_COOKIE)?.value);
}