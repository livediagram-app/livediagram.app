// On-element badge chrome for BoxedElementView: the remote-selector
// avatar strip (who else has this element selected) and the badge strip
// (lock / link / comment / note indicators), plus their small icon +
// button primitives. Extracted from BoxedElementView verbatim; only
// RemoteSelectorsStrip + BadgeStrip are public, the rest are internal.
import { initialsOf } from '@/lib/identity';
import { Tooltip } from '@/components/primitives/Tooltip';

export function RemoteSelectorsStrip({
  zoom,
  selectors,
}: {
  zoom: number;
  selectors: { id: string; name: string; color: string }[];
}) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'left top' }}
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

// Floating cluster at the top-right of the element. Holds the link badge
// (if linked) and the comment badge (if there are unresolved comments) as
// individual buttons inside a single rounded card — same shape language as
// ZoomControls. Counter-scaled so the badges keep their on-screen size at
// any canvas zoom.
export function BadgeStrip({
  zoom,
  linked,
  linkLabel,
  commentCount,
  hasNote,
  badgeColor,
  onFollowLink,
  onOpenComments,
  onOpenNote,
}: {
  zoom: number;
  linked: boolean;
  // Destination shown in the link badge's hover tooltip (e.g. the URL),
  // so a user sees where a link goes before clicking. Undefined when
  // unlinked.
  linkLabel?: string;
  commentCount: number;
  hasNote: boolean;
  badgeColor: string;
  onFollowLink: () => void;
  onOpenComments: () => void;
  onOpenNote?: () => void;
}) {
  // Order (LTR inside the flex strip, which is anchored to the top-
  // right of the element): link, note, comment. Comment sits at the
  // far right because it's the highest-traffic affordance: an
  // unresolved comment count needs the most visible perch. Note sits
  // to its left, link to the far left.
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{ transform: `scale(${1 / zoom})`, transformOrigin: 'right top' }}
      className="pointer-events-auto absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white p-0.5 shadow-sm"
    >
      {linked ? (
        <Tooltip title="Follow link" description={linkLabel ?? 'Open the linked destination.'}>
          <BadgeButton label="Follow link" color={badgeColor} onClick={onFollowLink}>
            <LinkBadgeIcon />
          </BadgeButton>
        </Tooltip>
      ) : null}
      {hasNote && onOpenNote ? (
        <BadgeButton label="Open note" color={badgeColor} onClick={onOpenNote}>
          <NoteBadgeIcon />
        </BadgeButton>
      ) : null}
      {commentCount > 0 ? (
        <BadgeButton
          label={`Open ${commentCount} comment${commentCount === 1 ? '' : 's'}`}
          color={badgeColor}
          onClick={onOpenComments}
          dataAttr="data-comment-trigger"
        >
          <CommentBadgeIcon />
          <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold leading-none text-white">
            {commentCount}
          </span>
        </BadgeButton>
      ) : null}
    </div>
  );
}

function NoteBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
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
      // Theme-driven background via inline style so any hex/rgb the
      // theme provides works — Tailwind utility classes only cover the
      // brand palette. Tailwind keeps the layout / shape.
      style={{ backgroundColor: color }}
      className="relative flex h-5 w-5 items-center justify-center rounded-full text-white shadow-sm transition hover:brightness-110"
      {...extra}
    >
      {children}
    </button>
  );
}

function LinkBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
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

function CommentBadgeIcon() {
  return (
    <svg
      width="11"
      height="11"
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
