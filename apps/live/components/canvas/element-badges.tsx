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
import { Tooltip } from '@/components/primitives/Tooltip';

// Below this canvas zoom the on-element adornments (badge pill, lock
// badge, remote-selector avatars) disappear entirely.
export const ADORNMENT_MIN_ZOOM = 0.4;

export function RemoteSelectorsStrip({
  zoom,
  selectors,
}: {
  zoom: number;
  selectors: { id: string; name: string; color: string }[];
}) {
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-none absolute -left-1 -top-1 flex"
    >
      {selectors.map((p, i) => (
        // Margin / z-index live on the outer wrapper so the Tooltip's
        // inline-flex span doesn't disturb the overlap stack.
        <div
          key={p.id}
          style={{
            marginLeft: i === 0 ? 0 : -6,
            zIndex: selectors.length - i,
          }}
        >
          <Tooltip
            title={`Locked to ${p.name}`}
            description="Selected by them; you can't edit it right now."
          >
            <div
              aria-label={`Locked to ${p.name}`}
              style={{ backgroundColor: p.color }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[9px] font-semibold text-white shadow-sm"
            >
              {initialsOf(p.name)}
            </div>
          </Tooltip>
        </div>
      ))}
    </div>
  );
}

// Floating cluster at the top-right of the element. Link / note / action /
// comment render as SEGMENTS of one connected pill — a single control,
// with hairline separators between segments rather than detached circles —
// so an element carrying several affordances reads as one tidy cluster.
// Scales with the canvas zoom and hides below ADORNMENT_MIN_ZOOM (see the
// header comment).
export function BadgeStrip({
  zoom,
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
}: {
  zoom: number;
  linked: boolean;
  // Destination shown in the link badge's hover tooltip (e.g. the URL),
  // so a user sees where a link goes before clicking. Undefined when
  // unlinked.
  linkLabel?: string;
  commentCount: number;
  hasNote: boolean;
  // Open assigned action (spec/68): shown only while the element's
  // action has status 'open' — finished work should not shout.
  hasOpenAction?: boolean;
  // Hover tooltip body for the action badge ("Assigned to {name}").
  actionLabel?: string;
  badgeColor: string;
  onFollowLink: () => void;
  onOpenComments: () => void;
  onOpenNote?: () => void;
  onOpenAction?: () => void;
}) {
  // Order (LTR inside the pill, which is anchored to the top-right of
  // the element): link, note, action, comment. Comment sits at the far
  // right because it's the highest-traffic affordance: an unresolved
  // comment count needs the most visible perch. Built as a uniform
  // segment list so the hairline separators land between every pair
  // regardless of which affordances are present.
  const segments: { key: string; node: React.ReactNode }[] = [];
  if (linked) {
    segments.push({
      key: 'link',
      node: (
        <Tooltip title="Follow link" description={linkLabel ?? 'Open the linked destination.'}>
          <BadgeButton label="Follow link" color={badgeColor} onClick={onFollowLink}>
            <LinkBadgeIcon />
          </BadgeButton>
        </Tooltip>
      ),
    });
  }
  if (hasNote && onOpenNote) {
    segments.push({
      key: 'note',
      node: (
        <BadgeButton label="Open note" color={badgeColor} onClick={onOpenNote}>
          <NoteBadgeIcon />
        </BadgeButton>
      ),
    });
  }
  if (hasOpenAction && onOpenAction) {
    segments.push({
      key: 'action',
      node: (
        <Tooltip title="Open action" description={actionLabel ?? 'An assigned action is open.'}>
          <BadgeButton
            label="Open action"
            color={badgeColor}
            onClick={onOpenAction}
            dataAttr="data-action-trigger"
          >
            <ActionBadgeIcon />
          </BadgeButton>
        </Tooltip>
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
          <CommentBadgeIcon />
          <span className="absolute right-0 top-0 flex h-3 min-w-[12px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-semibold leading-none text-white">
            {commentCount}
          </span>
        </BadgeButton>
      ),
    });
  }
  if (zoom < ADORNMENT_MIN_ZOOM) return null;
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ backgroundColor: badgeColor }}
      className="pointer-events-auto absolute -right-1 -top-1 flex items-stretch overflow-hidden rounded-full shadow-sm ring-1 ring-white/60"
    >
      {segments.map((seg, i) => (
        <span key={seg.key} className={`flex ${i > 0 ? 'border-l border-white/35' : ''}`}>
          {seg.node}
        </span>
      ))}
    </div>
  );
}

function NoteBadgeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 2.5h7l3 3v8a0.5 0.5 0 0 1 -0.5 0.5h-9.5a0.5 0.5 0 0 1 -0.5 -0.5v-10.5a0.5 0.5 0 0 1 0.5 -0.5z" />
      <path d="M10 2.5v3h3" />
      <path d="M5.5 9h5M5.5 11.5h5" />
    </svg>
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
      // A SEGMENT of the connected pill (the wrapper owns the shared
      // theme-coloured background + rounding): rectangular hit area,
      // hover brightens just this segment.
      style={{ backgroundColor: color }}
      className="relative flex h-6 w-7 items-center justify-center text-white transition hover:brightness-110"
      {...extra}
    >
      {children}
    </button>
  );
}

function LinkBadgeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 4.5l1.5-1.5a3.25 3.25 0 0 1 4.6 4.6L11 9.5" />
      <path d="M9 11.5l-1.5 1.5a3.25 3.25 0 0 1-4.6-4.6L5 7" />
      <line x1="6" y1="10" x2="10" y2="6" />
    </svg>
  );
}

// Clipboard-with-tick glyph for the assigned-action badge (spec/68).
function ActionBadgeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 3h-1.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H10" />
      <rect x="6" y="1.75" width="4" height="2.5" rx="0.75" />
      <path d="M5.75 9.25 7.5 11l3-3.5" />
    </svg>
  );
}

function CommentBadgeIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 13.5 4v5A1.5 1.5 0 0 1 12 10.5H7l-3 2.5V10.5A1.5 1.5 0 0 1 2.5 9z" />
    </svg>
  );
}
