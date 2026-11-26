'use client';

import { useState, useEffect, FormEvent } from 'react';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display' });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

type SongRequest = {
  id: string;
  spotifyId: string;
  title: string;
  artist: string;
  albumArt?: string | null;
  requesterName: string;
  message?: string | null;
  upvotes: number;
  status: string;
};

type SpotifyTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  albumArt: string | null;
};

const css = `
.dj-root{--night:#11131f;--panel:#1a1d2e;--line:#2d3149;--ink:#f1ede4;--muted:#9b9db5;--amber:#ffb340;--on-amber:#1c1303;--amber-soft:rgba(255,179,64,.14);--amber-line:rgba(255,179,64,.45);--mint:#5fd4a0;background:var(--night);color:var(--ink)}
.dj-panel{background:var(--panel);border:1px solid var(--line)}
.dj-muted{color:var(--muted)}
.dj-amber{color:var(--amber)}
.dj-input{background:var(--night);border:1px solid var(--line);color:var(--ink)}
.dj-input::placeholder{color:var(--muted)}
.dj-input:focus{outline:none;border-color:var(--amber);box-shadow:0 0 0 3px var(--amber-soft)}
.dj-primary{background:var(--amber);color:var(--on-amber)}
.dj-primary:hover:not(:disabled){filter:brightness(1.08)}
.dj-selected{background:var(--amber-soft);border:1px solid var(--amber-line)}
.dj-list>li+li{border-top:1px solid var(--line)}
.dj-row:hover{background:rgba(255,255,255,.03)}
.dj-focus:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.dj-vote{border:1px solid var(--line);color:var(--ink)}
.dj-vote:hover:not(:disabled){border-color:var(--amber);color:var(--amber)}
.dj-vote[aria-pressed=true]{background:var(--amber);border-color:var(--amber);color:var(--on-amber)}
.dj-ok{color:var(--mint);border:1px solid rgba(95,212,160,.35)}
.dj-quote{color:var(--amber)}
.eq-bar{height:100%;transform-origin:bottom;animation:eq 1s ease-in-out infinite}
@keyframes eq{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@media (prefers-reduced-motion:reduce){.eq-bar{animation:none;transform:scaleY(.6)}}
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

function Equalizer() {
  return (
      <span className="inline-flex items-end gap-[2px] h-3.5" aria-hidden>
      {[0, 1, 2].map((i) => (
          <span
              key={i}
              className="eq-bar w-[3px] rounded-sm"
              style={{ background: 'var(--amber)', animationDelay: `${i * 0.18}s` }}
          />
      ))}
    </span>
  );
}

function VoteButton({
                      count,
                      voted,
                      onVote,
                      big,
                    }: {
  count: number;
  voted: boolean;
  onVote: () => void;
  big?: boolean;
}) {
  return (
      <button
          type="button"
          onClick={onVote}
          disabled={voted}
          aria-pressed={voted}
          aria-label={voted ? 'Je hebt al gestemd' : 'Stem op dit verzoek'}
          className={`dj-vote dj-focus shrink-0 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer disabled:cursor-default ${
              big ? 'w-16 h-16 rounded-2xl' : 'w-12 h-14 rounded-xl'
          }`}
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
        >
          <path d="M6 15l6-6 6 6" />
        </svg>
        <span className={`${displayFont} font-bold text-base leading-none`}>{count}</span>
      </button>
  );
}

export default function GuestPage() {
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Formulier state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Spotify state
  const [spotifyId, setSpotifyId] = useState<string | null>(null);
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState('');
  const [searchError, setSearchError] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } finally {
      setLoading(false);
    }
  };

  // Opgeslagen stemmen laden + live updates elke 5 seconden
  useEffect(() => {
    const savedVotes = JSON.parse(localStorage.getItem('dj_voted_ids') || '[]');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVotedIds(savedVotes);
    fetchRequests();

    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, []);

  // Spotify zoeken met debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(false);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          setResults(await res.json());
          setSearchedFor(q);
        } else {
          setSearchError(true);
          setManual(true);
        }
      } catch {
        if (!controller.signal.aborted) {
          setSearchError(true);
          setManual(true);
        }
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectTrack = (t: SpotifyTrack) => {
    setTitle(t.title);
    setArtist(t.artist);
    setSpotifyId(t.spotifyId);
    setAlbumArt(t.albumArt);
    setManual(false);
    setQuery('');
    setResults([]);
  };

  const clearSelection = () => {
    setTitle('');
    setArtist('');
    setSpotifyId(null);
    setAlbumArt(null);
  };

  const canSubmit = title.trim().length > 0 && artist.trim().length > 0;
  const trimmedQuery = query.trim();
  const noResults =
      trimmedQuery.length >= 2 &&
      !searching &&
      !searchError &&
      searchedFor === trimmedQuery &&
      results.length === 0;
  const showDropdown = searching || results.length > 0 || noResults;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
          spotifyId,
          albumArt,
          requesterName: requesterName.trim() || 'Anoniem',
          message: message.trim() || null,
        }),
      });

      if (res.ok) {
        setNotice(
            res.status === 200
                ? 'Dit nummer stond er al. Jouw stem is toegevoegd.'
                : 'Verzoek ingediend.'
        );
        setTimeout(() => setNotice(null), 4000);
        setTitle('');
        setArtist('');
        setMessage('');
        setSpotifyId(null);
        setAlbumArt(null);
        setManual(false);
        await fetchRequests();
      } else {
        setFormError('Indienen lukt nu niet. Probeer het zo opnieuw.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpvote = async (id: string) => {
    if (votedIds.includes(id)) return;

    // Optimistische UI update
    const updatedVotes = [...votedIds, id];
    setVotedIds(updatedVotes);
    localStorage.setItem('dj_voted_ids', JSON.stringify(updatedVotes));
    setRequests((prev) =>
        prev
            .map((r) => (r.id === id ? { ...r, upvotes: r.upvotes + 1 } : r))
            .sort((a, b) => b.upvotes - a.upvotes)
    );

    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upvote' }),
    });
  };

  const [top, ...rest] = requests;

  return (
      <div
          className={`dj-root ${display.variable} ${body.variable} font-[family-name:var(--font-body)] min-h-screen`}
      >
        <style>{css}</style>
        <main className="mx-auto max-w-xl px-4 py-8 md:py-12 space-y-10">
          {/* Header */}
          <header className="space-y-2">
            <h1
                className={`${displayFont} text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight`}
            >
              Wat wil je horen?
            </h1>
            <p className="dj-muted text-base">
              Zoek een nummer, of stem op een verzoek in de wachtrij.
            </p>
          </header>

          {/* Formulier */}
          <form onSubmit={handleSubmit} className="dj-panel rounded-3xl p-5 space-y-4">
            {/* Spotify zoeken */}
            <div className="relative">
              <label htmlFor="search" className="block text-sm font-medium mb-1.5">
                Zoek een nummer
              </label>
              <div className="relative">
                <svg
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 dj-muted pointer-events-none"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                    id="search"
                    type="text"
                    autoComplete="off"
                    placeholder="Titel of artiest"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setQuery('');
                        setResults([]);
                      }
                    }}
                    className="dj-input w-full rounded-xl pl-10 pr-3.5 py-3 text-base"
                />
              </div>

              {showDropdown && (
                  <ul
                      className="dj-panel dj-list absolute z-10 mt-2 w-full max-h-80 overflow-y-auto rounded-2xl"
                      style={{ boxShadow: '0 16px 40px rgba(0,0,0,.45)' }}
                  >
                    {searching && results.length === 0 && (
                        <li className="px-4 py-3 text-sm dj-muted">Zoeken…</li>
                    )}
                    {noResults && (
                        <li className="px-4 py-3 text-sm dj-muted">
                          Niets gevonden. Vul het nummer hieronder zelf in.
                        </li>
                    )}
                    {results.map((t) => (
                        <li key={t.spotifyId}>
                          <button
                              type="button"
                              onClick={() => selectTrack(t)}
                              className="dj-row dj-focus w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
                          >
                            <Cover src={t.albumArt} className="w-11 h-11 rounded-md" />
                            <span className="min-w-0">
                        <span className="block text-sm font-semibold truncate">{t.title}</span>
                        <span className="block text-sm dj-muted truncate">{t.artist}</span>
                      </span>
                          </button>
                        </li>
                    ))}
                  </ul>
              )}
            </div>

            {searchError && (
                <p className="text-sm dj-muted" role="status">
                  Zoeken lukt nu niet. Vul het nummer zelf in.
                </p>
            )}

            {/* Geselecteerd nummer */}
            {spotifyId && (
                <div className="dj-selected flex items-center gap-3 rounded-2xl p-3">
                  <Cover src={albumArt} className="w-12 h-12 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{title}</p>
                    <p className="text-sm dj-muted truncate">{artist}</p>
                  </div>
                  <button
                      type="button"
                      onClick={clearSelection}
                      className="dj-focus text-sm dj-muted hover:underline cursor-pointer px-1"
                  >
                    Wijzig
                  </button>
                </div>
            )}

            {/* Handmatig invullen */}
            {!spotifyId && (
                <div className="space-y-3">
                  <button
                      type="button"
                      onClick={() => setManual((m) => !m)}
                      aria-expanded={manual}
                      className="dj-focus text-sm dj-amber hover:underline cursor-pointer"
                  >
                    {manual ? 'Terug naar zoeken' : 'Staat het nummer er niet tussen? Vul het zelf in'}
                  </button>

                  {manual && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="title" className="block text-sm font-medium mb-1.5">
                            Nummer
                          </label>
                          <input
                              id="title"
                              type="text"
                              required
                              placeholder="Bijv. Engelbewaarder"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              className="dj-input w-full rounded-xl px-3.5 py-3 text-base"
                          />
                        </div>
                        <div>
                          <label htmlFor="artist" className="block text-sm font-medium mb-1.5">
                            Artiest
                          </label>
                          <input
                              id="artist"
                              type="text"
                              required
                              placeholder="Bijv. Marco Schuitmaker"
                              value={artist}
                              onChange={(e) => setArtist(e.target.value)}
                              className="dj-input w-full rounded-xl px-3.5 py-3 text-base"
                          />
                        </div>
                      </div>
                  )}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1.5">
                  Jouw naam <span className="dj-muted font-normal">(optioneel)</span>
                </label>
                <input
                    id="name"
                    type="text"
                    placeholder="Anoniem"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="dj-input w-full rounded-xl px-3.5 py-3 text-base"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-1.5">
                  Berichtje voor de DJ <span className="dj-muted font-normal">(optioneel)</span>
                </label>
                <input
                    id="message"
                    type="text"
                    placeholder="Voor de jarige!"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="dj-input w-full rounded-xl px-3.5 py-3 text-base"
                />
              </div>
            </div>

            <button
                type="submit"
                disabled={submitting || !canSubmit}
                className={`dj-primary dj-focus w-full rounded-xl py-3.5 text-base font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${displayFont}`}
            >
              {submitting ? 'Bezig…' : 'Verzoek indienen'}
            </button>

            {(notice || formError) && (
                <p
                    role="status"
                    className={`text-sm text-center ${notice ? '' : 'dj-muted'}`}
                    style={notice ? { color: 'var(--mint)' } : undefined}
                >
                  {notice ?? formError}
                </p>
            )}
          </form>

          {/* Wachtrij */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className={`${displayFont} text-2xl font-bold tracking-tight`}>Wachtrij</h2>
              <span className="text-sm dj-muted">
              {requests.length} {requests.length === 1 ? 'verzoek' : 'verzoeken'}
            </span>
            </div>

            {loading ? (
                <div className="space-y-3 animate-pulse" aria-label="Wachtrij laden">
                  {[0, 1, 2].map((i) => (
                      <div key={i} className="h-16 rounded-2xl" style={{ background: 'var(--panel)' }} />
                  ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="dj-panel rounded-3xl px-6 py-10 text-center space-y-1">
                  <p className={`${displayFont} text-lg font-semibold`}>De wachtrij is nog leeg</p>
                  <p className="text-sm dj-muted">
                    Zoek hierboven een nummer en wees de eerste met een verzoek.
                  </p>
                </div>
            ) : (
                <div className="space-y-4">
                  {/* Staat bovenaan */}
                  <article className="dj-panel relative overflow-hidden rounded-3xl">
                    {top.albumArt && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={top.albumArt}
                            alt=""
                            aria-hidden
                            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-40"
                        />
                    )}
                    <div className="relative p-5 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium dj-amber">
                        <Equalizer />
                        Staat bovenaan
                        {top.status === 'approved' && (
                            <span className="dj-ok ml-1 rounded-full px-2 py-0.5 text-xs font-semibold">
                        Goedgekeurd
                      </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <Cover src={top.albumArt} className="w-24 h-24 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <h3
                              className={`${displayFont} text-2xl font-bold leading-tight tracking-tight`}
                          >
                            {top.title}
                          </h3>
                          <p className="dj-muted truncate">{top.artist}</p>
                          <p className="text-sm mt-1.5">
                            Door {top.requesterName}
                            {top.message && (
                                <span className="dj-quote"> · “{top.message}”</span>
                            )}
                          </p>
                        </div>
                        <VoteButton
                            big
                            count={top.upvotes}
                            voted={votedIds.includes(top.id)}
                            onVote={() => handleUpvote(top.id)}
                        />
                      </div>
                    </div>
                  </article>

                  {/* Rest van de lijst */}
                  {rest.length > 0 && (
                      <ul className="dj-list">
                        {rest.map((req, i) => (
                            <li key={req.id}>
                              <div className="dj-row flex items-center gap-3 rounded-xl px-2 py-3">
                        <span
                            className={`${displayFont} w-6 text-right text-lg font-bold dj-muted tabular-nums`}
                        >
                          {i + 2}
                        </span>
                                <Cover src={req.albumArt} className="w-12 h-12 rounded-lg" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold truncate">{req.title}</h3>
                                    {req.status === 'approved' && (
                                        <span className="dj-ok shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold">
                                Goedgekeurd
                              </span>
                                    )}
                                  </div>
                                  <p className="text-sm dj-muted truncate">{req.artist}</p>
                                  <p className="text-xs dj-muted truncate mt-0.5">
                                    Door {req.requesterName}
                                    {req.message && ` · “${req.message}”`}
                                  </p>
                                </div>
                                <VoteButton
                                    count={req.upvotes}
                                    voted={votedIds.includes(req.id)}
                                    onVote={() => handleUpvote(req.id)}
                                />
                              </div>
                            </li>
                        ))}
                      </ul>
                  )}
                </div>
            )}
          </section>
        </main>
      </div>
  );
}