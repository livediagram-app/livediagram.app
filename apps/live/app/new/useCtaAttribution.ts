import { useCallback, useEffect, useRef } from 'react';
import { CTA_VIA_PARAM, ctaSourceFromSearch, type CtaSource } from '@livediagram/api-schema';
import { track } from '@/lib/telemetry';

// Landing funnel (docs/specs/019-marketing/landing-funnel.md): which public-page CTA brought this visit to /new.
//
// The CTA's href carries `via=<Surface>.<Slot>`. On arrival this reads it
// once, sends `Cta·Opened·<source>`, and strips the parameter from the
// address bar (keeping every other one), so a reload, a bookmark or Back from
// the editor can't count the same arrival again and nobody shares a URL with
// a tracking parameter in it. The returned `trackCreated` sends
// `Cta·Created·<source>` when the diagram is committed: at most once per
// arrival, since the funnel asks whether the visit converted, not how often.
export function useCtaAttribution(): { trackCreated: () => void } {
  const source = useRef<CtaSource | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(CTA_VIA_PARAM)) return;
    // StrictMode runs this twice in dev; the second run finds the parameter
    // already stripped and returns above, so the arrival is counted once.
    const found = ctaSourceFromSearch(url.search);
    url.searchParams.delete(CTA_VIA_PARAM);
    window.history.replaceState(window.history.state, '', url);
    if (!found) return;
    source.current = found;
    track('Cta', 'Opened', found);
  }, []);

  const trackCreated = useCallback(() => {
    if (!source.current) return;
    track('Cta', 'Created', source.current);
    source.current = null;
  }, []);

  return { trackCreated };
}
