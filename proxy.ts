import { NextResponse, type NextRequest } from 'next/server';
import { DJ_COOKIE, verifySessionToken } from '@/src/dj-auth';

export async function proxy(request: NextRequest) {
    const loggedIn = await verifySessionToken(request.cookies.get(DJ_COOKIE)?.value);
    const onLogin = request.nextUrl.pathname === '/dj/login';

    if (onLogin) {
        // Al ingelogd? Dan direct door naar het dashboard.
        return loggedIn
            ? NextResponse.redirect(new URL('/dj', request.url))
            : NextResponse.next();
    }

    if (loggedIn) return NextResponse.next();
    return NextResponse.redirect(new URL('/dj/login', request.url));
}

export const config = {
    matcher: ['/dj/:path*'],
};