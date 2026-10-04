// On-element badge chrome for BoxedElementView: the remote-selector
// avatar strip (who else has this element selected) and the badge strip
// (lock / link / comment / note indicators), plus their small icon +
// button primitives. Extracted from BoxedElementView verbatim; only
// RemoteSelectorsStrip + BadgeStrip are public, the rest are internal.
//
// Adornments scale WITH the canvas zoom (they render in canvas units, no
// counter-scaling): they used to hold their on-screen size, which at low
// zoom left a full-size pill squatting over a thumbnail-sized element.
// Below ADORNMENT_MIN_ZOOM they hide entirely — too small to read or hit,
// and an overview zoom is for shape, not affordances. Resize handles are
// deliberately NOT treated this way (element-parts.tsx): interaction
// grips need a constant hit size.
import { initialsOf } from '@/lib/identity';
import {
  ActionIcon,
  CommentIcon,
  LinkIcon,
  MindOutlineIcon,
  NoteIcon,
  TidyMapIcon,
  HoverCard,
  GlyphDisc,
} from '@livediagram/ui';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import { useCanvasZoom } from '@/components/canvas/CanvasZoomContext';
import type { BadgeInset } from '@/lib/badge-anchor';

// A corner this round or rounder gets a fully round chip; sharper ones a softly squared chip.
const ROUND_CHIP_FROM_PX = 10;

// Below this canvas zoom the on-element adornments (badge pill, lock
// badge, remote-selector avatars) disappear entirely.
export const ADORNMENT_MIN_ZOOM = 0.4;

export function RemoteSelectorsStrip({
  selectors,
}: {
  selectors: { id: string; name: string; color: string }[];
}) {
  const zoom = useCanvasZoom();
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute -left-1 -top-1 flex"
    >
      {selectors.map((p, i) => (
        // Margin / z-index live on the outer wrapper so the HoverCard's
        // inline-flex span doesn't disturb the overlap stack.
        <div
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            zIndex: selectors.length - i,
          }}
        >
          <HoverCard
            title={`Locked to ${p.name}`}
            description="Selected by them; you can't edit it right now."
          >
            <GlyphDisc
              size={20}
              as="div"
              aria-label={`Locked to ${p.name}`}
              style={identityVars(p.color)}
              className={`border border-white text-[9px] font-semibold text-white shadow-sm ${IDENTITY_FILL}`}
            >
              {initialsOf(p.name)}
            </GlyphDisc>
          </HoverCard>
        </div>
      ))}
    </div>
  );
}

// The chip at the top-right of the element (docs/specs/008-canvas/canvas-and-palette.md). Outline and
// tidy (a mind map root) / link / note / action / comment render as SEGMENTS of one connected
// chip, hairline separators between them, so an element carrying several affordances reads as one
// tidy control. A light surface with quiet icons that take the element's accent on hover, rounded
// to suit the element's corners and sitting on its outline (badgeCornerInset). Scales with the
// canvas zoom and hides below ADORNMENT_MIN_ZOOM (see the header comment).
export function BadgeStrip({
  linked,
  linkLabel,
  commentCount,
  hasNote,
  hasOpenAction,
  actionLabel,
  badgeColor,
  onFollowLink,
  onOpenComments,
  onOpenNote,
  onOpenAction,
  onEditOutline,
  onTidyMap,
  inset,
  cornerPx,
}: {
  linked: boolean;
  // Destination shown in the link badge's hover card (e.g. the URL),
  // so a user sees where a link goes before clicking. Undefined when
  // unlinked.
  linkLabel?: string;
  commentCount: number;
  hasNote: boolean;
  // Open assigned action (docs/specs/012-collaboration/assigned-actions.md): shown only while the element's
  // action has status 'open' — finished work should not shout.
  hasOpenAction?: boolean;
  // Hover card body for the action badge ("Assigned to {name}").
  actionLabel?: string;
  badgeColor: string;
  onFollowLink: () => void;
  onOpenComments: () => void;
  onOpenNote?: () => void;
  onOpenAction?: () => void;
  // A mind map root's Edit Outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the
  // first segment, so a map announces it can be edited as a list.
  onEditOutline?: () => void;
  // The same root's Tidy Map, beside it.
  onTidyMap?: () => void;
  // Where on the element's outline the chip sits, in from the top-right corner.
  inset: BadgeInset;
  // The element's corner radius, which the chip's own rounding follows.
  cornerPx: number;
}) {
  const zoom = useCanvasZoom();
  // Order (LTR inside the pill, which is anchored to the top-right of
  // the element): link, note, action, comment. Comment sits at the far
  // right because it's the highest-traffic affordance: an unresolved
  // comment count needs the most visible perch. Built as a uniform
  // segment list so the hairline separators land between every pair
  // regardless of which affordances are present.
  const segments: { key: string; node: React.ReactNode }[] = [];
  if (onEditOutline) {
    segments.push({
      key: 'outline',
      node: (
        <HoverCard title="Edit Outline" description="Edit the whole map as a list.">
          <BadgeButton label="Edit Outline" color={badgeColor} onClick={onEditOutline}>
            <MindOutlineIcon size={15} />
          </BadgeButton>
        </HoverCard>
      ),
    });
  }
  if (onTidyMap) {
    segments.push({
      key: 'tidy',
      node: (
        <HoverCard title="Tidy Map" description="Lay the whole map out neatly again.">
          <BadgeButton label="Tidy Map" color={badgeColor} onClick={onTidyMap}>
            <TidyMapIcon size={15} />
          </BadgeButton>
        </HoverCard>
      ),
    });
  }
  if (linked) {
    segments.push({
      key: 'link',
      node: (
        <HoverCard title="Follow link" description={linkLabel ?? 'Open the linked destination.'}>
          <BadgeButton label="Follow link" color={badgeColor} onClick={onFollowLink}>
            <LinkIcon size={15} />
          </BadgeButton>
        </HoverCard>
      ),
    });
  }
  if (hasNote && onOpenNote) {
    segments.push({
      key: 'note',
      node: (
        <BadgeButton label="Open note" color={badgeColor} onClick={onOpenNote}>
          <NoteIcon size={15} />
        </BadgeButton>
      ),
    });
  }
  if (hasOpenAction && onOpenAction) {
    segments.push({
      key: 'action',
      node: (
        <HoverCard title="Open action" description={actionLabel ?? 'An assigned action is open.'}>
          <BadgeButton
            label="Open action"
            color={badgeColor}
            onClick={onOpenAction}
            dataAttr="data-action-trigger"
          >
            <ActionIcon size={15} />
          </BadgeButton>
        </HoverCard>
      ),
    });
  }
  if (commentCount > 0) {
    segments.push({
      key: 'comment',
      node: (
        <BadgeButton
          label={`Open ${commentCount} comment${commentCount === 1 ? '' : 's'}`}
          color={badgeColor}
          onClick={onOpenComments}
          dataAttr="data-comment-trigger"
        >
          <CommentIcon size={15} />
          <span className="text-[11px] font-semibold tabular-nums leading-none">
            <span className="text-optical-centre">{commentCount}</span>
          </span>
        </BadgeButton>
      ),
    });
  }
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        ...identityVars(badgeColor),
        // Centred on the outline point: half in, half out, the edge through its middle.
        right: inset.x,
        top: inset.y,
        transform: 'translate(50%, -50%)',
      }}
      className={`pointer-events-auto absolute flex items-stretch overflow-hidden bg-white shadow-[0_1px_2px_rgb(15_23_42/0.08),0_2px_8px_-2px_rgb(15_23_42/0.16)] ring-1 ring-slate-900/10 dark:bg-slate-800 dark:ring-white/10 ${
        cornerPx >= ROUND_CHIP_FROM_PX ? 'rounded-full' : 'rounded-md'
      }`}
    >
      {segments.map((seg, i) => (
        <span
          key={seg.key}
          className={`flex ${i > 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''}`}
        >
          {seg.node}
        </span>
      ))}
    </div>
  );
}

function BadgeButton({
  label,
  color,
  onClick,
  dataAttr,
  children,
}: {
  label: string;
  color: string;
  onClick: () => void;
  dataAttr?: string;
  children: React.ReactNode;
}) {
  const extra = dataAttr ? { [dataAttr]: '' } : {};
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      // A SEGMENT of the connected chip (the wrapper owns the surface + rounding): a quiet icon that
      // takes the element's accent colour on hover.
      style={identityVars(color)}
      className="relative flex h-8 min-w-9 items-center justify-center gap-1 px-2 text-slate-500 transition hover:bg-slate-50 hover:text-(--identity) dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white"
      {...extra}
    >
      {children}
    </button>
  );
}
