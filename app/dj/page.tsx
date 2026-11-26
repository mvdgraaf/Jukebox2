'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

type SongRequest = {
    id: string;
    title: string;
    artist: string;
    albumArt?: string | null;
    requesterName: string;
    message?: string | null;
    upvotes: number;
    status: string;
    createdAt: string;
};

type UndoState = { id: string; title: string; verb: string; prevStatus: string };

const css = `
.dj-root{--night:#11131f;--panel:#1a1d2e;--line:#2d3149;--ink:#f1ede4;--muted:#9b9db5;--amber:#ffb340;--on-amber:#1c1303;--amber-soft:rgba(255,179,64,.14);--mint:#5fd4a0;--danger:#ff8a7a;background:var(--night);color:var(--ink)}
.dj-panel{background:var(--panel);border:1px solid var(--line)}
.dj-muted{color:var(--muted)}
.dj-quote{color:var(--amber)}
.dj-list>li+li{border-top:1px solid var(--line)}
.dj-row:hover{background:rgba(255,255,255,.025)}
.dj-focus:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.dj-btn{min-height:44px;padding:0 16px;border-radius:12px;font-weight:600;font-size:15px;cursor:pointer;transition:filter .15s,border-color .15s}
.dj-btn-primary{background:var(--amber);color:var(--on-amber);border:1px solid var(--amber)}
.dj-btn-primary:hover{filter:brightness(1.08)}
.dj-btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.dj-btn-ghost:hover{border-color:var(--muted)}
.dj-btn-danger{background:transparent;color:var(--danger);border:1px solid var(--line)}
.dj-btn-danger:hover{border-color:var(--danger)}
.dj-votes{border:1px solid var(--line)}
`;

const displayFont = 'font-[family-name:var(--font-display)]';

function Cover({ src, className }: { src?: string | null; className: string }) {
    return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={`${className} object-cover shrink-0`} />
    ) : (
        <div
            className={`${className} shrink-0 grid place-items-center dj-muted`}
            style={{ background: 'var(--line)' }}
            aria-hidden
        >
            <svg width="40%" height="40%" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
        </div>
    );
}

function RequestRow({
                        req,
                        onAction,
                    }: {
    req: SongRequest;
    onAction: (req: SongRequest, status: string) => void;
}) {
    const isApproved = req.status === 'approved';

    return (
        <li className="dj-row flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <Cover src={req.albumArt} className="w-14 h-14 rounded-lg" />

                <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold leading-tight truncate">{req.title}</h3>
                    <p className="dj-muted truncate">{req.artist}</p>
                    <p className="mt-1 text-sm break-words">
                        Door {req.requesterName}
                        {req.message && <span className="dj-quote"> · “{req.message}”</span>}
                    </p>
                </div>

                <div
                    className="dj-votes flex h-14 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl"
                    aria-label={`${req.upvotes} stemmen`}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="dj-muted"
                    >
                        <path d="M6 15l6-6 6 6" />
                    </svg>
                    <span className={`${displayFont} text-base font-bold leading-none`}>
                        {req.upvotes}
                    </span>
                </div>
            </div>

            <div className="flex gap-2 sm:shrink-0">
                {!isApproved && (
                    <button
                        onClick={() => onAction(req, 'approved')}
                        className="dj-btn dj-btn-primary dj-focus flex-1 sm:flex-none"
                    >
                        Goedkeuren
                    </button>
                )}
                <button
                    onClick={() => onAction(req, 'played')}
                    className={`dj-btn dj-focus flex-1 sm:flex-none ${
                        isApproved ? 'dj-btn-primary' : 'dj-btn-ghost'
                    }`}
                >
                    Gedraaid
                </button>
                <button
                    onClick={() => onAction(req, 'rejected')}
                    className="dj-btn dj-btn-danger dj-focus flex-1 sm:flex-none"
                >
                    Weiger
                </button>
            </div>
        </li>
    );
}

export default function DJDashboard() {
    const router = useRouter();
    const [requests, setRequests] = useState<SongRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [offline, setOffline] = useState(false);
    const [undo, setUndo] = useState<UndoState | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchRequests = async () => {
        try {
            const res = await fetch('/api/requests');
            if (res.ok) {
                setRequests(await res.json());
                setOffline(false);
            } else {
                setOffline(true);
            }
        } catch {
            setOffline(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchRequests().then(r => r);
        const interval = setInterval(fetchRequests, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        return () => {
            if (undoTimer.current) clearTimeout(undoTimer.current);
        };
    }, []);

    // Eén plek voor alle statuswijzigingen: 401 → inloggen, andere fout → lijst herstellen
    const patchStatus = async (id: string, status: string): Promise<boolean> => {
        const res = await fetch(`/api/requests/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });

        if (res.status === 401) {
            router.replace('/dj/login');
            return false;
        }
        if (!res.ok) {
            await fetchRequests();
            return false;
        }
        return true;
    };

    const updateStatus = async (req: SongRequest, status: string) => {
        const removes = status === 'played' || status === 'rejected';

        // Direct uit UI updaten voor snelle DJ-workflow
        setRequests((list) =>
            removes
                ? list.filter((r) => r.id !== req.id)
                : list.map((r) => (r.id === req.id ? { ...r, status } : r))
        );

        const ok = await patchStatus(req.id, status);

        if (ok && removes) {
            if (undoTimer.current) clearTimeout(undoTimer.current);
            setUndo({
                id: req.id,
                title: req.title,
                verb: status === 'played' ? 'gedraaid' : 'geweigerd',
                prevStatus: req.status,
            });
            undoTimer.current = setTimeout(() => setUndo(null), 6000);
        }
    };

    const handleUndo = async () => {
        if (!undo) return;
        const { id, prevStatus } = undo;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndo(null);

        if (await patchStatus(id, prevStatus)) {
            await fetchRequests();
        }
    };

    const logout = async () => {
        await fetch('/api/dj/logout', { method: 'POST' });
        router.replace('/dj/login');
    };

    const approved = requests.filter((r) => r.status === 'approved');
    const pending = requests.filter((r) => r.status === 'pending');

    const sections = [
        { key: 'approved', title: 'Klaar om te draaien', items: approved, dot: 'var(--mint)' },
        { key: 'pending', title: 'Te beoordelen', items: pending, dot: 'var(--amber)' },
    ].filter((s) => s.items.length > 0);

    return (
        <div
            className={`dj-root ${display.variable} ${body.variable} font-[family-name:var(--font-body)] min-h-screen`}
        >
            <style>{css}</style>

            <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:py-10">
                {/* Header */}
                <header className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1
                            className={`${displayFont} text-3xl font-extrabold leading-tight tracking-tight md:text-4xl`}
                        >
                            Wachtrij
                        </h1>
                        <p className="dj-muted text-base">
                            Nieuwe verzoeken verschijnen vanzelf.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        {offline && (
                            <span
                                role="status"
                                className="rounded-full px-3 py-1 text-sm font-medium"
                                style={{
                                    color: 'var(--amber)',
                                    border: '1px solid var(--amber)',
                                }}
                            >
                                Geen verbinding
                            </span>
                        )}
                        <button
                            onClick={logout}
                            className="dj-btn dj-btn-ghost dj-focus !min-h-10 !px-3 !text-sm"
                        >
                            Uitloggen
                        </button>
                    </div>
                </header>

                {/* Inhoud */}
                {loading ? (
                    <div className="space-y-3 animate-pulse" aria-label="Wachtrij laden">
                        {[0, 1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-24 rounded-2xl"
                                style={{ background: 'var(--panel)' }}
                            />
                        ))}
                    </div>
                ) : requests.length === 0 ? (
                    <div className="dj-panel space-y-1 rounded-3xl px-6 py-12 text-center">
                        <p className={`${displayFont} text-lg font-semibold`}>
                            Geen openstaande verzoeken
                        </p>
                        <p className="dj-muted text-sm">
                            Zodra gasten een nummer aanvragen, staat het hier.
                        </p>
                    </div>
                ) : (
                    sections.map((section) => (
                        <section key={section.key} className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ background: section.dot }}
                                    aria-hidden
                                />
                                <h2 className={`${displayFont} text-xl font-bold tracking-tight`}>
                                    {section.title}
                                </h2>
                                <span className="dj-muted text-sm">{section.items.length}</span>
                            </div>

                            <ul className="dj-panel dj-list overflow-hidden rounded-3xl">
                                {section.items.map((req) => (
                                    <RequestRow key={req.id} req={req} onAction={updateStatus} />
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </main>

            {/* Ongedaan maken */}
            {undo && (
                <div
                    role="status"
                    className="dj-panel fixed bottom-4 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-4 rounded-2xl px-4 py-3"
                    style={{ boxShadow: '0 16px 40px rgba(0,0,0,.5)' }}
                >
                    <span className="min-w-0 truncate text-sm">
                        “{undo.title}” {undo.verb}
                    </span>
                    <button
                        onClick={handleUndo}
                        className="dj-focus shrink-0 cursor-pointer text-sm font-semibold underline"
                        style={{ color: 'var(--amber)' }}
                    >
                        Ongedaan maken
                    </button>
                </div>
            )}
        </div>
    );
}