'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { installErrorHandlers } from '../../src/analytics/error-tracking';
import { AppErrorBoundary } from '../../src/components/AppErrorBoundary';
import { MatrixLoader } from '../../src/components/MatrixLoader';
import { installWebObservability } from '../../src/observability/install';

// Install browser exception handlers at module-load time, before any other
// client code can throw. The hooks buffer events until AnalyticsProvider
// finishes `bootstrapExceptionTracking()` with the PostHog key, so even
// errors thrown during the dynamic import of `src/App` are captured.
installErrorHandlers();

// Install the rest of the observability surface (long tasks, white-screen
// detector, resource-error capture, boot timing, visibility tracking).
// Same buffer + consent-bypass transport as the exception handler above
// so events fired before AnalyticsProvider initialises still flush.
installWebObservability();

const loadingShell = (
  <div className="od-loading-shell">
    <MatrixLoader />
    <span>Loading OpenDesign…</span>
  </div>
);

// Shown while the daemon probe below is undecided: deliberately brand-free,
// because on daemon-less static hosts it is the only thing the Personajes
// preview visitor ever sees before the standalone surface mounts.
const neutralShell = (
  <div className="od-loading-shell">
    <MatrixLoader />
  </div>
);

// The product is a fully client-driven SPA — every component reads
// localStorage, window.location, etc. — so we opt out of static-time
// rendering for the entire tree. This keeps `next build --output export`
// from trying to evaluate browser-only code while still emitting a real
// shell HTML the daemon can serve as the SPA fallback.
const App = dynamic(() => import('../../src/App').then((m) => m.App), {
  ssr: false,
  // Keeps the `od-loading-shell` class on the outer node: the white-screen
  // detector filters this whole subtree out by that class when deciding
  // whether the app really mounted (`src/observability/white-screen.ts`).
  loading: () => loadingShell,
});

// Personajes deep links must also work where no daemon exists: the same
// static `out/` export the daemon serves in production is published verbatim
// on static hosts (Vercel previews), where every /api call dead-ends into
// the SPA fallback. `CharactersStandalone` is kept behind its own dynamic
// import so the whole `src/App` bundle — boot effects, daemon probes,
// onboarding gate — never loads in that mode.
const CharactersStandalone = dynamic(
  () =>
    import('../../src/features/characters/components/CharactersStandalone').then(
      (m) => m.CharactersStandalone,
    ),
  // Brand-free fallback too: this chunk only ever loads on daemon-less
  // static hosts, where "Loading OpenDesign…" is the wrong label.
  { ssr: false, loading: () => neutralShell },
);

const CHARACTERS_PATH = /^\/(characters|personajes)(\/|$)/;

// null = still waiting on the daemon probe. The probe checks content-type,
// not just status: static hosts answer /api/health with the SPA shell HTML
// (200 text/html), while a real daemon answers JSON.
//
// The probe runs for every SPA entry path, not just /characters: on a
// daemon-less static host the whole preview exists for Personajes, so any
// other route (/, /settings, /projects…) is landed on /characters instead
// of the dead sign-in gate. When a daemon does answer, the full App mounts
// untouched — including for the Personajes routes inside EntryShell.
function useStandaloneCharacters(): boolean | null {
  const [standalone, setStandalone] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let daemon = false;
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        daemon = res.ok && (res.headers.get('content-type') ?? '').includes('application/json');
      } catch {
        daemon = false;
      }
      if (cancelled) return;
      if (!daemon && !CHARACTERS_PATH.test(window.location.pathname)) {
        // replaceState, not a reload: the standalone surface below mounts in
        // the same pass and the address bar already reads /characters.
        window.history.replaceState(null, '', '/characters');
      }
      setStandalone(!daemon);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return standalone;
}

export function ClientApp() {
  const standalone = useStandaloneCharacters();
  return (
    <AppErrorBoundary>
      {standalone === null ? neutralShell : standalone ? <CharactersStandalone /> : <App />}
    </AppErrorBoundary>
  );
}
