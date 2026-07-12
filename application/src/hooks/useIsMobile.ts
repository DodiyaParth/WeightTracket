import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 768px)';

// Bridges the shell's CSS breakpoint into JS for the one piece of chrome that
// can't be done in CSS alone: the off-canvas nav drawer (see Layout.tsx)
// needs to know whether it should be closeable/off-canvas at all, and must
// force itself closed if the viewport grows past the breakpoint while open
// (e.g. rotating a tablet, or a resize during a demo). Every other
// responsive change in the app is pure CSS (see styles.css's @media blocks)
// and doesn't need this hook.
export function useIsMobile(query: string = MOBILE_QUERY): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent | MediaQueryList): void => setIsMobile(e.matches);
    onChange(mql); // query itself may have changed between render and effect
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange); // Safari <14 fallback
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return isMobile;
}
