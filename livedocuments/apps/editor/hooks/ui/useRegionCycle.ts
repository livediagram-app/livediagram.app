'use client';

// F6 moves between the editor's regions (docs/specs/004-interface-design/canvas-accessibility.md "F6 moves between
// regions"): Tab is busy inside the canvas walking its elements, so the chrome after it in the tab order sat behind
// dozens of presses. F6 goes to the next region and Shift+F6 to the previous, wrapping round, in screen order; a
// region not on screen is skipped. Each region's root carries `data-region` with its name.
import { useEffect } from 'react';

/** The regions, in screen order. */
export const EDITOR_REGIONS = ['header', 'palette', 'canvas', 'controls', 'tabs'] as const;

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const shown = (el: HTMLElement): boolean =>
  el.getClientRects().length > 0 && !el.closest('.hidden, [hidden], [aria-hidden="true"]');

/** The roots of the regions on screen, in screen order (a region's first shown root). */
export function shownRegions(doc: Document): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const name of EDITOR_REGIONS) {
    const root = [...doc.querySelectorAll<HTMLElement>(`[data-region="${name}"]`)].find(shown);
    if (root) out.push(root);
  }
  return out;
}

/** Where focus lands in a region: the root itself when it takes focus (the canvas), else its first shown control. */
export function regionTarget(root: HTMLElement): HTMLElement | null {
  if (root.tabIndex >= 0 && root.hasAttribute('tabindex')) return root;
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].find(shown) ?? null;
}

/** The region F6 (or Shift+F6, `back`) moves to from the focused element, wrapping round. */
export function nextRegion(
  regions: readonly HTMLElement[],
  focused: Element | null,
  back: boolean,
): HTMLElement | null {
  if (regions.length === 0) return null;
  // The innermost region holding focus: the palette strip sits inside the canvas's <main>.
  const here = focused?.closest<HTMLElement>('[data-region]') ?? null;
  const at = here ? regions.indexOf(here) : -1;
  if (at < 0) return back ? regions[regions.length - 1]! : regions[0]!;
  return regions[(at + (back ? -1 : 1) + regions.length) % regions.length]!;
}

/** F6 and Shift+F6 cycle focus through the regions on screen. Off inside a modal dialog, whose trap keeps focus. */
export function useRegionCycle(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F6' || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.activeElement?.closest('[aria-modal="true"]')) return;
      const regions = shownRegions(document);
      let next = nextRegion(regions, document.activeElement, e.shiftKey);
      // A region with nothing to focus is passed over (at most once round).
      for (let i = 0; next && i < regions.length; i++) {
        const target = regionTarget(next);
        if (target) {
          e.preventDefault();
          target.focus();
          return;
        }
        next = nextRegion(regions, next, e.shiftKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
