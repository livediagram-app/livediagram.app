// Where the tool in hand's button (or the category holding it) sits in the palette strip (docs/specs/031-photo/photo-pages.md "The options flyout"),
// for the options card that hangs below it: the button's rect, measured again when the tool changes, the window
// resizes or the strip's card changes size (a category bar's names, Search opening). Null with no tool in hand.
import { useEffect, useState } from 'react';

export type ToolAnchor = { left: number; right: number; bottom: number };

// The tool's own button when it is pinned on the strip, else the category button holding it.
const PRESSED = '[data-photo-rail] button[aria-pressed="true"]';
const HOLDS = '[data-photo-rail] [data-photo-holds]';

export function useToolAnchor(tool: string | null): ToolAnchor | null {
  const [anchor, setAnchor] = useState<ToolAnchor | null>(null);
  useEffect(() => {
    if (!tool) return;
    const measure = () => {
      const r = (
        document.querySelector(PRESSED) ?? document.querySelector(HOLDS)
      )?.getBoundingClientRect();
      setAnchor((was) =>
        !r
          ? null
          : was && was.left === r.left && was.right === r.right && was.bottom === r.bottom
            ? was
            : { left: r.left, right: r.right, bottom: r.bottom },
      );
    };
    // After the strip has rendered the pressed button.
    const raf = requestAnimationFrame(measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    const card = document.querySelector('[data-tour-id="palette"]');
    if (card) ro?.observe(card);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [tool]);
  return tool ? anchor : null;
}
