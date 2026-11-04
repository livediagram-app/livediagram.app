'use client';

// A gallery's rail and list kept in step (docs/specs/026-plan/board-widgets.md "The rail", item-types.md "Fields and
// Tabs": Add Field), shared by Add a Widget and Add Field: the list holds every section (each marked
// `data-gallery-section`), pressing a rail entry scrolls its section to the list's top, and scrolling marks the section
// in view current. The list is measured on its own scroll events (one a frame at most, as the browser sends them), and
// the current section is set only when it changes (React drops an equal one), so a scroll never re-renders per event.
// A new search (`resetOn`) starts the list at its top, on its first section.
import { useEffect, useState, type RefObject } from 'react';

const SECTION = '[data-gallery-section]';

// Where a section starts in the list's scrolled content. Measured on screen: the list is `relative`, so a section's
// offsetTop is already from the list, and taking the list's own offsetTop off as well left each section the gallery's
// header height (about 50 px) short of the top, the end of the section before it showing above.
export function sectionTop(box: HTMLElement, el: HTMLElement): number {
  return el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
}

// The section in view: the last whose top has reached the list's top; scrolled to the end, the last whose top shows
// (a short last section never reaches the top, yet it is the one in view). The first section when none has.
export function sectionInView(box: HTMLElement): string | null {
  const sections = box.querySelectorAll<HTMLElement>(SECTION);
  let at: string | null = sections[0]?.dataset.gallerySection ?? null;
  const atEnd = box.scrollHeight - box.clientHeight - box.scrollTop <= 1 && box.scrollTop > 0;
  for (const el of sections) {
    const top = sectionTop(box, el);
    if (top <= box.scrollTop + 8 || (atEnd && top < box.scrollTop + box.clientHeight))
      at = el.dataset.gallerySection ?? at;
  }
  return at;
}

export function useGallerySpy(
  list: RefObject<HTMLElement | null>,
  first: string | null,
  resetOn: unknown,
) {
  const [current, setCurrent] = useState<string | null>(first);

  // The list's onScroll (and after the list is put back, as Add Field's is on coming back from a kind's form).
  const spy = () => {
    if (list.current) setCurrent(sectionInView(list.current));
  };

  // Scrolls a section to the list's top (smoothly, unless reduced motion is asked for, or `instant`) and marks it.
  const goTo = (key: string, instant = false) => {
    const box = list.current;
    const el = box?.querySelector<HTMLElement>(`[data-gallery-section="${key}"]`);
    if (!box || !el) return;
    const top = sectionTop(box, el);
    const smooth = !instant && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (box.scrollTo) box.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    else box.scrollTop = top;
    setCurrent(key);
  };

  // A search may drop the current section: back to the first, at the top. On a new search only, never as the
  // sections' contents change under it.
  useEffect(() => {
    setCurrent(first);
    list.current?.scrollTo?.({ top: 0 });
    // oxlint-disable-next-line react/exhaustive-deps
  }, [resetOn]);

  return { current, spy, goTo };
}
