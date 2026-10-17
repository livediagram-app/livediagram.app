'use client';

import { useEffect } from 'react';
import { VIEWPORT_EDGE_MARGIN } from '@/lib/clamp-to-viewport';

// Floating surfaces stay in view above an on-screen keyboard (docs/specs/004-interface-design/
// tooltips-hover-cards-popovers.md "On-screen keyboard"). Popovers, menus, floating panels and bottom sheets are
// placed against the window, but a touch screen's keyboard covers the bottom of the VISUAL viewport, so a field low on
// the screen (a Sheet chart's Range, a slot's picker) went under it, out of view, as soon as it was tapped. While a
// text field inside such a surface has focus on a touch screen, every visual-viewport change re-checks it: the whole
// surface moves into the visible area when it fits there, else just far enough to show the field. A surface capped
// at the little room its placement had (an anchored popover low on a short window) first grows to the visible band, so
// it moves up whole instead of scrolling a clipped line under its top edge. When the field lets go of focus, or the
// keyboard goes, the surface returns to where, and to the size, its own placement put it.

// What counts as a floating surface: the shared popover, panel, sheet and menu primitives, and any dialog.
const FLOATING_SURFACE =
  '[data-anchored-popover], [data-floating-panel], [data-bottom-sheet], [data-menu-surface], [role="dialog"], [role="menu"]';

type Box = { top: number; bottom: number };

// How far (px) to move a surface UP (negative: down) so it sits in the visible band, given where it and the field
// would be unmoved. The surface fits: all of it in view. Taller than the band: the field in view, top first.
export function liftFor(
  surface: Box,
  field: Box,
  visible: Box,
  margin = VIEWPORT_EDGE_MARGIN,
): number {
  const top = visible.top + margin;
  const bottom = visible.bottom - margin;
  const fits = surface.bottom - surface.top <= bottom - top;
  const box = fits ? surface : field;
  if (box.top < top) return box.top - top;
  if (box.bottom > bottom) return Math.min(box.bottom - bottom, box.top - top);
  return 0;
}

function isTextField(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(
    el.type,
  );
}

// The surface a field floats in: one of the primitives, or failing that its nearest fixed ancestor that is not a
// whole-screen layer (a full-height layer scrolls its own content).
function surfaceOf(field: HTMLElement): HTMLElement | null {
  const known = field.closest<HTMLElement>(FLOATING_SURFACE);
  if (known) return known;
  for (let el = field.parentElement; el && el !== document.body; el = el.parentElement) {
    if (getComputedStyle(el).position !== 'fixed') continue;
    return el.getBoundingClientRect().height < window.innerHeight * 0.9 ? el : null;
  }
  return null;
}

// A surface that scrolls (a popover capped at the room it had) shows the field in its own scroll first.
function revealWithin(surface: HTMLElement, field: HTMLElement) {
  for (let el = field.parentElement; el; el = el.parentElement) {
    if (el.scrollHeight > el.clientHeight + 1) {
      const box = el.getBoundingClientRect();
      const f = field.getBoundingClientRect();
      if (f.bottom > box.bottom) el.scrollTop += f.bottom - box.bottom;
      else if (f.top < box.top) el.scrollTop -= box.top - f.top;
    }
    if (el === surface) return;
  }
}

// The lift each surface carries now, and the inline transform it had before it.
const lifted = new Map<HTMLElement, { dy: number; base: string }>();
// The inline max-height each grown surface had before it grew.
const grown = new Map<HTMLElement, string>();

// Lets a surface that scrolls because its placement capped it take up to `room` px, its content's full height at most.
function grow(el: HTMLElement, room: number) {
  if (el.scrollHeight <= el.clientHeight + 1) return;
  if (!grown.has(el)) grown.set(el, el.style.maxHeight);
  const frame = el.offsetHeight - el.clientHeight; // borders
  el.style.maxHeight = `${Math.max(el.clientHeight, Math.min(el.scrollHeight + frame, room))}px`;
}

function shrink(el: HTMLElement) {
  const was = grown.get(el);
  if (was === undefined) return;
  el.style.maxHeight = was;
  grown.delete(el);
}

function apply(el: HTMLElement, dy: number) {
  const was = lifted.get(el);
  const base = was ? was.base : el.style.transform;
  if (dy === 0) {
    if (was) el.style.transform = base;
    lifted.delete(el);
    return;
  }
  lifted.set(el, { dy, base });
  el.style.transform = `translateY(${-dy}px)${base ? ` ${base}` : ''}`;
}

export function releaseAll(except?: HTMLElement | null) {
  for (const el of [...lifted.keys()]) if (el !== except) apply(el, 0);
  for (const el of [...grown.keys()]) if (el !== except) shrink(el);
}

export function checkFloatingField() {
  const vv = window.visualViewport;
  const field = document.activeElement;
  const surface = vv && isTextField(field) ? surfaceOf(field) : null;
  releaseAll(surface);
  if (!vv || !surface || !isTextField(field)) return;
  // A re-render that set the surface's own transform dropped the lift: it starts again from there.
  const was = lifted.get(surface);
  if (was && !surface.style.transform.startsWith(`translateY(${-was.dy}px)`))
    lifted.delete(surface);
  grow(surface, vv.height - 2 * VIEWPORT_EDGE_MARGIN);
  revealWithin(surface, field);
  // Where both would be without the lift this surface carries now.
  const dy = lifted.get(surface)?.dy ?? 0;
  const s = surface.getBoundingClientRect();
  const f = field.getBoundingClientRect();
  const next = liftFor(
    { top: s.top + dy, bottom: s.bottom + dy },
    { top: f.top + dy, bottom: f.bottom + dy },
    { top: vv.offsetTop, bottom: vv.offsetTop + vv.height },
  );
  apply(surface, next);
}

export function useFloatingKeyboardAvoidance(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    // Only a touch screen raises a keyboard over the page.
    if (!vv || !window.matchMedia?.('(hover: none)').matches) return;
    let frame = 0;
    // After the frame's layout: the surface's own placement runs on the same resize and scroll.
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(checkFloatingField);
    };
    vv.addEventListener('resize', onChange);
    vv.addEventListener('scroll', onChange);
    // Focus lands before the keyboard finishes rising; the resize above catches the rest.
    document.addEventListener('focusin', onChange);
    document.addEventListener('focusout', onChange);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', onChange);
      vv.removeEventListener('scroll', onChange);
      document.removeEventListener('focusin', onChange);
      document.removeEventListener('focusout', onChange);
      releaseAll();
    };
  }, []);
}
