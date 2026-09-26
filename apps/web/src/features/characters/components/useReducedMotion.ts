// G-UX 10 — one `prefers-reduced-motion` reader shared by the stage and
// every animated thumbnail: under `reduce` the character canvases draw
// their first frame statically while bubbles/state keep updating.

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && (window.matchMedia?.(QUERY).matches ?? false),
  );
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
