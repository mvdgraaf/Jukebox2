'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

const css = `
.dj-root{--night:#11131f;--panel:#1a1d2e;--line:#2d3149;--ink:#f1ede4;--muted:#9b9db5;--amber:#ffb340;--on-amber:#1c1303;--amber-soft:rgba(255,179,64,.14);background:var(--night);color:var(--ink)}
.dj-panel{background:var(--panel);border:1px solid var(--line)}
.dj-muted{color:var(--muted)}
.dj-input{background:var(--night);border:1px solid var(--line);color:var(--ink)}
.dj-input::placeholder{color:var(--muted)}
.dj-input:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px var(--amber-soft)}
.dj-primary{background:var(--amber);color:var(--on-amber)}
.dj-primary:hover:not(:disabled){filter:brightness(1.08)}
.dj-focus:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
`;

const displayFont = 'font-[family-name:var(--font-display)]';

export default function DJLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!password) return;

        setBusy(true);
        setError(null);
        try {
            const res = await fetch('/api/dj/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                router.replace('/dj');
                router.refresh();
                return;
            }

            const data = await res.json().catch(() => ({}));
            setError(data.error ?? 'Inloggen mislukt.');
            setPassword('');
        } catch {
            setError('Geen verbinding. Probeer het opnieuw.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className={`dj-root ${display.variable} ${body.variable} font-[family-name:var(--font-body)] min-h-screen grid place-items-center px-4`}
        >
            <style>{css}</style>
            <form onSubmit={handleSubmit} className="dj-panel w-full max-w-sm rounded-3xl p-6 space-y-5">
                <div className="space-y-1">
                    <h1 className={`${displayFont} text-3xl font-extrabold tracking-tight`}>DJ-booth</h1>
                    <p className="dj-muted text-sm">Log in om de wachtrij te beheren.</p>
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                        Wachtwoord
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="dj-input w-full rounded-xl px-3.5 py-3 text-base"
                    />
                </div>

                {error && (
                    <p role="alert" className="text-sm" style={{ color: '#ff8a7a' }}>
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={busy || !password}
                    className={`dj-primary dj-focus w-full rounded-xl py-3.5 text-base font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${displayFont}`}
                >
                    {busy ? 'Bezig…' : 'Inloggen'}
                </button>
            </form>
        </div>
    );
}