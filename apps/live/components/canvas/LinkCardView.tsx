'use client';

import { lucideFile, lucideLink, lucidePanelsTopLeft } from '@livediagram/icons/lucide';
import { useState } from 'react';
import { defaultTextColor, type LinkCardElement } from '@livediagram/document';
import { Glyph, Prims } from '@livediagram/ui';

// Inner content of a link-card element (docs/specs/009-elements/link-cards.md): a favicon / glyph + title +
// destination row, with the OG image as a top banner when a URL has unfurled.
// The card border / background come from the BoxedElementView wrapper
// (describeVariant). The TOP of the card is `pointer-events-none` so dragging /
// selecting / double-click-to-edit still works through it; the BOTTOM half is a
// click target that follows the configured link. Empty state prompts the user
// to add a link; double-clicking opens the link picker (handled in
// BoxedElementView).
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Title (top, bold) + destination (bottom, muted) for each link kind. The
// destination line names exactly where the card goes: the URL, the linked
// diagram, or the tab.
function describeCard(
  link: NonNullable<LinkCardElement['link']>,
  meta: LinkCardElement['meta'],
  tabs: { id: string; name: string }[] | undefined,
): { title: string; destination: string } {
  switch (link.kind) {
    case 'url':
      return { title: meta?.title ?? hostOf(link.url), destination: link.url };
    case 'document':
      return { title: 'Document', destination: link.name };
    case 'tab':
    case 'element': {
      const name = tabs?.find((t) => t.id === link.tabId)?.name?.trim();
      return {
        title: link.kind === 'element' ? 'Element' : 'Tab',
        destination: name ? name : 'this diagram',
      };
    }
  }
}

export function LinkCardView({
  element,
  tabs,
  onFollow,
}: {
  element: LinkCardElement;
  // This diagram's tabs (id + name) so a tab / element link can name its
  // target tab on the destination line.
  tabs?: { id: string; name: string }[];
  // Follow the card's configured link. Provided only when the card HAS a
  // link; wired to the bottom-half click target below. Absent (e.g. the
  // empty card, or read-only without a link) leaves the whole card inert
  // so double-click-to-edit still works.
  onFollow?: () => void;
}) {
  const link = element.link;
  const url = link?.kind === 'url' ? link.url : undefined;
  // Only trust cached meta that matches the CURRENT url (it's stale otherwise).
  const meta = url && element.meta && element.meta.url === url ? element.meta : undefined;
  const [imgOk, setImgOk] = useState(true);
  const [favOk, setFavOk] = useState(true);

  if (!link) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-[12px] font-medium text-slate-400 dark:text-slate-400">
        Add a link — double-click
      </div>
    );
  }

  const { title, destination } = describeCard(link, element.meta, tabs);
  const showImage = !!meta?.image && imgOk;

  // The bottom half is the link hotspot: a click there follows the link.
  // `pointer-events-auto` + stopping pointer-down keeps it from starting a
  // drag / selection, so the lower half acts purely as a link while the top
  // half stays draggable / double-clickable to edit.
  // The bottom info row IS the link hotspot (only it — not a fixed bottom
  // half, which bled into the banner). Stops pointer-down so a click follows
  // the link instead of dragging; the banner above stays draggable.
  const rowInner = (
    <>
      {url && meta?.favicon && favOk ? (
        <img
          src={meta.favicon}
          alt=""
          onError={() => setFavOk(false)}
          referrerPolicy="no-referrer"
          className="h-4 w-4 shrink-0 rounded-sm"
        />
      ) : (
        <LinkGlyph kind={link.kind} />
      )}
      <div className="min-w-0 flex-1">
        <p
          className="line-clamp-2 text-[12px] font-semibold leading-tight"
          style={{ color: element.textColor ?? defaultTextColor(element) }}
        >
          {title}
        </p>
        <p className="truncate text-[10px] text-slate-400 dark:text-slate-400">{destination}</p>
      </div>
      {onFollow ? (
        // Right-arrow affordance: nudges right on hover so the row reads as a
        // "go to link" hotspot.
        <span className="pointer-events-none shrink-0 self-center text-slate-400 transition-transform duration-150 group-hover:translate-x-1 dark:text-slate-400">
          <Glyph size={16} units={16}>
            <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
          </Glyph>
        </span>
      ) : null}
    </>
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col overflow-hidden">
      {showImage ? (
        <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-800">
          <img
            src={meta!.image}
            alt=""
            onError={() => setImgOk(false)}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        // No OG image unfurled: a neutral placeholder banner so the card keeps
        // its image-on-top shape instead of collapsing the layout.
        <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300 dark:from-slate-800 dark:to-slate-700 dark:text-slate-400">
          <Glyph size={28} units={24}>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </Glyph>
        </div>
      )}
      {onFollow ? (
        <button
          type="button"
          aria-label="Open link"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onFollow();
          }}
          className="group pointer-events-auto flex shrink-0 items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          {rowInner}
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2 px-2.5 py-2">{rowInner}</div>
      )}
    </div>
  );
}

// Fallback mark when there's no favicon (every non-URL kind, or a URL whose
// favicon failed / hasn't unfurled): a small kind-appropriate glyph so the
// row never collapses to a bare label.
function LinkGlyph({ kind }: { kind: NonNullable<LinkCardElement['link']>['kind'] }) {
  // A diagram is a document, a tab or element jump a panel, anything else a URL.
  const prims =
    kind === 'document'
      ? lucideFile
      : kind === 'tab' || kind === 'element'
        ? lucidePanelsTopLeft
        : lucideLink;
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-slate-400 dark:text-slate-400">
      <Glyph size={13} units={24}>
        <Prims prims={prims} />
      </Glyph>
    </span>
  );
}
