import { useEffect, type RefObject } from 'react';
import { announceToastFloorChange } from '@/components/toast/toast-floor';
import { TOUR_CARD_ATTR } from '../TourBanner';
import { COACH_DOCK_FLOOR_VAR } from './coach-dock-copy';

// The dock floor (docs/specs/007-editor/coach-dock.md "Where it sits"): while the dock shows, how far its top edge
// sits above the bottom of the window, as `--coach-dock-floor` on <html>, which a phone's bottom sheets stand on.
// Toasts and the sign-in banner find the dock themselves (BOTTOM_CHROME_SELECTOR); they are told it came and went.
// The sign-in banner steps aside while a tour is up, as it does for the tour banner (TOUR_CARD_ATTR).

export function useDockFloor(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const measure = () => {
      const floor = Math.max(0, Math.round(window.innerHeight - el.getBoundingClientRect().top));
      root.style.setProperty(COACH_DOCK_FLOOR_VAR, `${floor}px`);
    };
    measure();
    document.body.setAttribute(TOUR_CARD_ATTR, '');
    announceToastFloorChange();
    // Not every browser (or test DOM) has ResizeObserver: the window's resize still keeps the floor right.
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
      root.style.removeProperty(COACH_DOCK_FLOOR_VAR);
      document.body.removeAttribute(TOUR_CARD_ATTR);
      announceToastFloorChange();
    };
  }, [ref]);
}
