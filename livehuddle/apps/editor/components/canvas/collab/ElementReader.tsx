'use client';

// An element opened large while walking (docs/specs/008-canvas/avatar-mode.md "The reader"): a `read` kind, or a
// `use` piece with no main action right now (an idle Screen, a Room Sign nobody may knock on). Sticky and Text show
// their words at reading size, an Image its picture; a Screen says what it shows and a Room Sign opens its own door panel (RoomSignReader); everything else is
// a still, read-only copy of its own face scaled to fit. Mounted only while open.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { BoxedElement, Element } from '@livehuddle/document';
import { kindLabel } from '@/lib/element-names';
import { CompactEmptyState, lazyPanel, lucideGlyph } from '@livehuddle/ui';
import { lucideImage, lucideMusic } from '@liveworkspace/icons/lucide';
import { loadRoomSignReader } from '@/lib/editor-deferred-code';
import { ReaderShell } from './ReaderShell';
import { ScreenReaderBody } from './ScreenReaderBody';

// The Room Sign's door panel loads the first time one is read (docs/specs/016-platform/web-performance.md "A piece's
// panel"), fetched as soon as someone walks, the only way to read one.
const RoomSignReader = lazyPanel('room-sign', loadRoomSignReader);

// A copy is never blown up past this: a tiny badge at 3x already reads, and more only pixelates.
const MAX_SCALE = 3;
// The reader's body, less its padding: what a copy is scaled to fit.
const BODY_W = 672;
const BODY_H = 560;

const elementNode = (id: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`);

/**
 * The canvas's reader: `open(id)` shows that element large; `reader` is the dialog to mount (null while shut).
 * `walking`: someone walks, so a reader can open; the Room Sign's is fetched then.
 */
export function useElementReader(
  elements: readonly Element[],
  walking = false,
): {
  open: (elementId: string) => void;
  reader: ReactNode;
} {
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (walking) void RoomSignReader.preload();
  }, [walking]);
  // Looked up as it renders, so a deleted element closes it and a changed one shows its latest words.
  const element = openId ? elements.find((el) => el.id === openId) : undefined;
  return {
    open: setOpenId,
    reader: element ? <ElementReader element={element} onClose={() => setOpenId(null)} /> : null,
  };
}

export function ElementReader({ element, onClose }: { element: Element; onClose: () => void }) {
  // The Room Sign is a door panel of its own: its room's name, status, who is inside, Knock and Walk In.
  if (element.type === 'shape' && element.shape === 'room-sign')
    return <RoomSignReader elementId={element.id} onClose={onClose} />;
  const label = 'label' in element && typeof element.label === 'string' ? element.label.trim() : '';
  const title =
    label && element.type !== 'text' && element.type !== 'sticky' ? label : kindLabel(element);
  return (
    <ReaderShell title={title} onClose={onClose} data-element-reader={element.id}>
      <div className="p-4 sm:p-6">
        <ReaderBody element={element} />
      </div>
    </ReaderShell>
  );
}

function ReaderBody({ element }: { element: Element }) {
  if (element.type === 'sticky' || element.type === 'text') {
    const words = element.label?.trim() ?? '';
    return (
      <p
        className={`whitespace-pre-wrap break-words text-[20px] leading-relaxed ${
          element.type === 'sticky'
            ? 'rounded-lg bg-amber-100 px-5 py-4 text-slate-800 shadow-sm'
            : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {words || <span className="text-slate-500">Nothing written here yet.</span>}
      </p>
    );
  }
  if (element.type === 'image') return <ImageBody id={element.id} />;
  if (element.type === 'shape' && element.shape === 'screen')
    return <ScreenReaderBody element={element} />;
  if (element.type === 'shape' && element.shape === 'jukebox')
    return (
      <CompactEmptyState
        className="py-6"
        icon={<MusicIcon />}
        title="No music set"
        description="An Editor sets what it plays in its menu. Then a press anywhere on it plays or mutes it."
      />
    );
  // Arrows are never under a walking click (lib/avatar-press-target), so nothing else reaches here.
  return element.type === 'arrow' ? null : <FaceCopy element={element} />;
}

// Empty states (docs/specs/004-interface-design/empty-states.md) draw the shared CompactEmptyState.
const MusicIcon = lucideGlyph(lucideMusic, 20);
const ImageIcon = lucideGlyph(lucideImage, 20);

function ImageBody({ id }: { id: string }) {
  // The picture the canvas already loaded, so nothing fetches again and a private image needs no second grant.
  const [src] = useState(() => elementNode(id)?.querySelector('img')?.currentSrc ?? null);
  if (!src)
    return (
      <CompactEmptyState
        className="py-6"
        icon={<ImageIcon />}
        title="No picture here yet"
        description="Its picture has not loaded on the canvas."
      />
    );
  return <img src={src} alt="" className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-lg" />;
}

// A still copy of the element's own face, scaled to fit: taken once as the reader opens, its ids stripped so no
// lookup by id (a comment popover, the main-action press) ever finds the copy, and pointer-inert.
function FaceCopy({ element }: { element: BoxedElement }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const node = elementNode(element.id);
    if (!host || !node) return;
    const copy = node.cloneNode(true) as HTMLElement;
    for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
      el.removeAttribute('id');
      el.removeAttribute('data-element-id');
      el.removeAttribute('data-ride-id');
      el.removeAttribute('data-piece-main');
      el.removeAttribute('tabindex');
    }
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      transform: 'none',
      translate: 'none',
      animation: 'none',
      pointerEvents: 'none',
    });
    host.replaceChildren(copy);
    // The reader is narrower on a phone: fit what it has, less the body's padding.
    const width = host.closest('[role="dialog"]')?.clientWidth ?? 0;
    const room = width > 0 ? Math.min(BODY_W, width - 48) : BODY_W;
    setScale(Math.min(MAX_SCALE, room / element.width, BODY_H / element.height));
    return () => host.replaceChildren();
  }, [element.id, element.width, element.height]);
  return (
    <div
      className="relative mx-auto max-w-full overflow-hidden"
      style={{ width: element.width * scale, height: element.height * scale }}
    >
      <div
        ref={hostRef}
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: element.width, height: element.height, transform: `scale(${scale})` }}
      />
    </div>
  );
}
