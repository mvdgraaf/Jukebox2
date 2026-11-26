import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { DJ_COOKIE } from '@/src/dj-auth';

export async function POST() {
    const jar = await cookies();
    jar.delete(DJ_COOKIE);
    return NextResponse.json({ success: true });
}