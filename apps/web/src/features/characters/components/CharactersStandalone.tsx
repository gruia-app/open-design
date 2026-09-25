// Personajes standalone entry — mounted by the app shell only when the SPA
// runs on a daemon-less static host (e.g. a Vercel preview serving the same
// `out/` export the daemon serves in production). It renders the read-only
// review surface directly: no App boot effects, no onboarding gate, and no
// daemon calls. Bundled packs are fetched from `public/character-packs/`.

import { useEffect } from 'react';

import { useRoute } from '../../../router';
import { CharactersView } from './CharactersView';

export function CharactersStandalone() {
  const route = useRoute();
  const emotionId =
    route.kind === 'home' && route.view === 'characters' ? route.emotionId : undefined;
  // The static export's <title> still reads "OpenDesign" — this surface is a
  // standalone review page, so the tab should not carry the product brand.
  // React owns the <title> element via the root layout's metadata and can
  // rewrite it during late hydration commits, so the title is reasserted on
  // every mutation instead of set once.
  useEffect(() => {
    document.title = 'Personajes';
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(() => {
      if (document.title !== 'Personajes') document.title = 'Personajes';
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <CharactersView emotionId={emotionId} />;
}
