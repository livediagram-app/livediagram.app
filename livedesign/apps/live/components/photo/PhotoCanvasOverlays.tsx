'use client';

// A photo page's tools on the canvas (docs/specs/031-photo/photo-pages.md "The photo tools",
// photo-tools.md): with a photo tool in hand, a press on the photo in focus is the tool's (Space held
// is the hand, as everywhere); its overlays (the ants, a marquee, the crop box, floating pixels), the
// brush's ring and the text being typed sit over the sheet. A press on any photo page takes it into
// focus. Mounted in the canvas's transformed layer, so it pans and zooms with the page.
import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { LaidOutPage } from '@livedesign/design';
import { hexToBytes } from '@livedesign/photo-engine';
import { takeNeutral, useNeutralPicking } from '@/lib/photo-editor/neutral-pick';
import { pickColour } from '@/lib/photo-editor/tools/fill-tools';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { optionsKey, usePhotoTools, type PhotoToolId } from '@/lib/photo-editor/tool-state';
import { toolHandler } from '@/lib/photo-editor/tools';
import { useCropBox } from '@/lib/photo-editor/tools/crop-tool';
import type { PhotoPoint } from '@/lib/photo-editor/tools/tool-context';
import { useFreeTransform } from '@/lib/photo-editor/tools/transform-tool';
import { photoPointer, photoPress } from '@/lib/photo-editor/photo-pointer';
import { track } from '@/lib/telemetry';
import { photoStarted } from '@/lib/photo-editor/start-photo';
import { PhotoTextEditor } from './PhotoTextEditor';
import { StartPhotoCard } from './StartPhotoCard';
import { PhotoToolOverlay } from './PhotoToolOverlay';

// The tools that show their tip as a ring under the pointer.
const RING_TOOLS: ReadonlySet<PhotoToolId> = new Set([
  'brush',
  'pencil',
  'eraser',
  'background-eraser',
  'clone',
  'heal',
  'spot-heal',
  'blur',
  'sharpen',
  'smudge',
  'dodge',
  'burn',
  'sponge',
  'quick-select',
]);

// Under this many screen px across, a tip's ring gives way to a crosshair.
export const PRECISE_CURSOR_PX = 4;

const CURSOR: Record<string, string> = {
  brush: 'none',
  crosshair: 'crosshair',
  move: 'move',
  text: 'text',
  default: 'default',
  eyedropper: 'crosshair',
  bucket: 'crosshair',
};

/** Whether keys typed now are someone's writing (a field has the caret), not the photo's. */
export const typingSomewhere = (): boolean => {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

// Open menus and popovers that take the keys while they are up (Escape closes them, the arrows walk them), wherever
// the focus is: a menu opened with the pointer leaves the focus on the page.
const KEY_TAKERS =
  '[role="menu"], [data-anchored-popover], [data-photo-category], [role="dialog"][aria-modal="true"]';

/** Whether keys now are someone else's: a field has the caret, a popover or dialog has the focus, or a menu or
 *  popover is open (an option's popover, a title-bar menu, a category's flyout take Escape to close, not to put the
 *  tool down or clear the selection). */
export const keysElsewhere = (): boolean =>
  typingSomewhere() ||
  !!document.activeElement?.closest?.('[role="dialog"]') ||
  !!document.querySelector(KEY_TAKERS);

export function PhotoCanvasOverlays({
  pages,
  photo,
  zoom,
  spaceHeld,
}: {
  pages: readonly LaidOutPage[];
  photo: PhotoEditorView;
  zoom: number;
  spaceHeld: boolean;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { tool, options } = usePhotoTools();
  const transform = useFreeTransform();
  const crop = useCropBox();
  const { session, ctx } = photo;
  const page = pages.find((p) => p.id === photo.focusId && p.kind === 'photo');
  const may = !!tool && (photo.canEdit || (tool === 'eyedropper' && photo.canInspect));
  // White Balance's picker waiting: the next press is the neutral grey's, whatever is in hand.
  const picking = useNeutralPicking() && photo.canEdit;
  const active =
    !!session && !!ctx && !!page && (may || picking || (photo.canEdit && (!!transform || !!crop)));
  const handler = useMemo(() => (tool && ctx ? toolHandler(tool, ctx) : null), [tool, ctx]);
  // A tool put down (or the photo left) mid-gesture cancels what it had begun.
  useEffect(
    () => () => {
      photoPress.set(false);
      handler?.cancel?.();
    },
    [handler],
  );
  const layerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // A press on any photo page takes it into focus.
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-page-id]');
      const id = el?.getAttribute('data-page-id');
      if (id && pages.some((p) => p.id === id && p.kind === 'photo')) photo.press(id);
      else
        for (const p of document.querySelectorAll('[data-photo-page]')) {
          const r = p.getBoundingClientRect();
          if (
            e.clientX >= r.left &&
            e.clientX < r.right &&
            e.clientY >= r.top &&
            e.clientY < r.bottom
          )
            photo.press(p.getAttribute('data-photo-page')!);
        }
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  }, [pages, photo]);

  // The tool's keys (Enter, Escape, arrows, Backspace) while it is in hand and nobody is typing.
  useEffect(() => {
    if (!active || !handler?.key) return;
    const key = (e: KeyboardEvent) => {
      if (keysElsewhere()) return;
      if (handler.key!(e.key, { shift: e.shiftKey, alt: e.altKey, mod: e.metaKey || e.ctrlKey })) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [active, handler]);

  // An unstarted photo page offers its New Photo card, for someone who may edit.
  const starts =
    photo.canEdit && !transform
      ? pages.filter(
          (p) =>
            p.kind === 'photo' &&
            !photoStarted(photo.photos[p.id] ?? { width: 1, height: 1, layers: [] }),
        )
      : [];
  const cards = starts.map((p) => (
    <div
      key={`start-${p.id}`}
      className="pointer-events-none absolute"
      style={{ left: p.rect.x, top: p.rect.y, width: p.rect.width, height: p.rect.height }}
    >
      <StartPhotoCard page={p} photo={photo} zoom={zoom} />
    </div>
  ));
  if (!session || !page) return <>{cards}</>;
  const photoSize = { width: session.photo.width, height: session.photo.height };
  const perPx = (page.rect.width / photoSize.width) * zoom;

  const point = (e: {
    clientX: number;
    clientY: number;
    pressure: number;
    pointerType: string;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
  }): PhotoPoint => {
    const r = layerRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * photoSize.width,
      y: ((e.clientY - r.top) / r.height) * photoSize.height,
      // A mouse presses at half pressure: as full.
      pressure: e.pointerType === 'mouse' ? 1 : e.pressure || 0.5,
      shift: e.shiftKey,
      alt: e.altKey,
      mod: e.metaKey || e.ctrlKey,
      scale: r.width / photoSize.width,
    };
  };

  // The brush's ring, moved without a render.
  const showRing = (e: ReactPointerEvent) => {
    const ring = ringRef.current;
    if (!ring || !tool || !RING_TOOLS.has(tool)) return;
    const o = options[optionsKey(tool)] as { size?: number };
    const size = (o.size ?? 20) * (page.rect.width / photoSize.width);
    const r = layerRef.current!.getBoundingClientRect();
    const scale = r.width / page.rect.width;
    // A crosshair once the tip is under 4 screen px, or with Caps Lock (photo-tools.md "Shared gestures").
    const precise = size * scale < PRECISE_CURSOR_PX || e.getModifierState('CapsLock');
    layerRef.current!.style.cursor = precise ? 'crosshair' : 'none';
    if (precise) {
      ring.style.display = 'none';
      return;
    }
    ring.style.display = '';
    ring.style.width = `${size}px`;
    ring.style.height = `${size}px`;
    ring.style.left = `${(e.clientX - r.left) / scale}px`;
    ring.style.top = `${(e.clientY - r.top) / scale}px`;
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (picking && ctx) {
      e.stopPropagation();
      e.preventDefault();
      const hex = pickColour(ctx, point(e), 5, true);
      takeNeutral(hex ? hexToBytes(hex) : null);
      return;
    }
    if (!handler) return;
    e.stopPropagation();
    e.preventDefault();
    // Each use of a tool, once (photo-pages.md "Telemetry").
    if (tool)
      track(
        'Element',
        'Used',
        `Photo${tool.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase())}`,
      );
    if (handler.down(point(e))) {
      dragging.current = true;
      photoPress.set(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    showRing(e);
    const at = point(e);
    photoPointer.set({ x: at.x, y: at.y });
    if (!dragging.current || !handler?.move) return;
    // Every point the pointer passed, for a smooth stroke.
    const all = e.nativeEvent.getCoalescedEvents?.() ?? [];
    if (all.length) for (const c of all) handler.move(point(c));
    else handler.move(point(e));
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    photoPress.set(false);
    handler?.up?.(point(e));
  };

  return (
    <>
      <div
        ref={layerRef}
        data-photo-overlay=""
        className="absolute"
        style={{
          left: page.rect.x,
          top: page.rect.y,
          width: page.rect.width,
          height: page.rect.height,
          // Space held is the hand; with no photo tool in hand the canvas has the press.
          pointerEvents: active && !spaceHeld ? 'auto' : 'none',
          cursor: picking ? 'crosshair' : active && handler ? CURSOR[handler.cursor] : undefined,
          touchAction: 'none',
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          dragging.current = false;
          photoPress.set(false);
          handler?.cancel?.();
        }}
        onPointerLeave={() => {
          if (ringRef.current) ringRef.current.style.display = 'none';
          photoPointer.set(null);
        }}
        onDoubleClick={(e) => handler?.double?.(point({ ...e, pressure: 0, pointerType: 'mouse' }))}
      >
        <PhotoToolOverlay
          store={photo.overlay}
          selection={session.selection}
          photo={photoSize}
          page={page.rect}
          perPx={perPx}
          showBox={!!transform}
        />
        <div
          ref={ringRef}
          aria-hidden
          className="pointer-events-none absolute rounded-full border border-white shadow-[0_0_0_1px_rgb(0_0_0_/_0.8)]"
          style={{ display: 'none', transform: 'translate(-50%, -50%)' }}
        />
        {photo.textEdit && photo.canEdit ? (
          <PhotoTextEditor
            key={photo.textEdit.layerId}
            session={session}
            edit={photo.textEdit}
            page={page.rect}
            onEnd={photo.endTextEdit}
          />
        ) : null}
      </div>
      {/* After the tool's layer, so a tool in hand never covers an unstarted page's card. */}
      {cards}
    </>
  );
}
