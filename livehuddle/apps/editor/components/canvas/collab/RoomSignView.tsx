'use client';

// The Room Sign (docs/specs/009-elements/screen-and-room-sign.md "Room Sign"): a plaque by a room's door with the
// room's name and its state from presence, Free, In Use with how many and how long, or Do Not Disturb for a shut
// pod, and a Knock button (docs/specs/012-collaboration/knock.md). Re-renders when its snapshot changes, and once a
// minute while the room is in use; never on a step.
import {
  ROOM_SIGN_ART,
  ROOM_SIGN_TONES,
  inUseFor,
  roomSignLine,
  type ShapeElement,
} from '@livehuddle/document';
import { HoverCard } from '@livehuddle/ui';
import { usePressWithoutDrag } from '@/hooks/ui/usePressWithoutDrag';
import { useKnocker, useMeetingLive, type SignLive } from '@/lib/office/meeting-live';
import { useKnockedRecently, useMinuteClock } from './room-sign-clock';

const A = ROOM_SIGN_ART;
const FREE: SignLive = {
  roomId: null,
  name: 'Room',
  status: 'free',
  count: 0,
  since: null,
  selfInside: false,
  pod: false,
  people: [],
};

/** A knuckle on a door, for the Knock button and the palette tile. */
export function KnockGlyph({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 21V4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5V21" />
      <path d="M3 21h18" />
      <circle cx="15.5" cy="12.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function RoomSignView({
  element,
  animClass,
}: {
  element: ShapeElement;
  animClass?: string;
}) {
  const snapshot = useMeetingLive(element.id);
  const live = snapshot && !('inside' in snapshot) ? snapshot : FREE;
  const t = A.tones;
  const now = useMinuteClock(live.status === 'in-use');
  const inUseMs = live.since === null ? 0 : now - live.since;
  const line = roomSignLine(live.status, live.count, inUseMs);
  // On the plaque the time sits on its own line under the status, clear of the Knock button.
  const status = live.status === 'in-use' ? `In Use · ${live.count}` : line;
  const time = live.status === 'in-use' ? inUseFor(inUseMs) : null;
  const knocker = useKnocker();
  const knocked = useKnockedRecently();
  const roomId = live.roomId;
  const canKnock = live.status !== 'free' && !live.selfInside && !!roomId && !!knocker;
  const press = usePressWithoutDrag(
    canKnock && !knocked && roomId ? () => knocker?.(roomId) : undefined,
  );
  const tone = ROOM_SIGN_TONES[live.status];
  const scale = (v: number, of: number) => `${(v / of) * 100}%`;
  // Type sized to the plaque's width, so a sign resized larger keeps its proportions.
  const type = (px: number) => `${(px / A.plaque.w) * 100}cqw`;
  return (
    <div
      className={`pointer-events-none absolute inset-0 ${animClass ?? ''}`}
      style={{ containerType: 'size' }}
    >
      <div
        role="img"
        aria-label={`${live.name}: ${line}`}
        data-room-sign={live.status}
        className="absolute inset-0"
        style={{
          borderRadius: A.plaque.rx,
          // The walnut frame, lit from above, its own deeper edge and a soft shadow under it.
          background: `linear-gradient(${t.frameLit}, ${t.frame})`,
          boxShadow: `inset 0 0 0 1px ${t.frameEdge}, inset 0 1px 0 rgb(255 255 255 / 0.18), 0 2px 4px rgb(11 18 32 / 0.28)`,
        }}
      >
        {A.screws.map((c, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute size-[4px] rounded-full"
            style={{
              left: `calc(${scale(c.cx, A.plaque.w)} - 2px)`,
              top: `calc(${scale(c.cy, A.plaque.h)} - 2px)`,
              background: `radial-gradient(circle at 35% 35%, ${t.brassLit}, ${t.screw} 60%, ${t.screwEdge})`,
            }}
          />
        ))}
        {/* The cream nameplate, its enamel strip in the status's colour readable from across the room. */}
        <div
          className="absolute overflow-hidden"
          style={{
            left: scale(A.plate.x, A.plaque.w),
            top: scale(A.plate.y, A.plaque.h),
            width: scale(A.plate.w, A.plaque.w),
            height: scale(A.plate.h, A.plaque.h),
            borderRadius: A.plate.rx,
            background: `linear-gradient(${t.plate}, ${t.plateShade})`,
            boxShadow: `inset 0 0 0 0.75px ${t.plateEdge}, inset 0 1px 2px rgb(0 0 0 / 0.18)`,
          }}
        >
          <span
            aria-hidden
            className="lh-sign-stripe absolute inset-y-0 left-0 motion-reduce:transition-none"
            style={{ width: scale(A.stripe.w, A.plate.w), background: tone }}
          />
        </div>
        <span
          className="absolute truncate font-semibold leading-none"
          style={{
            left: scale(A.name.x, A.plaque.w),
            right: scale(14, A.plaque.w),
            top: scale(A.name.y - A.name.size + 2, A.plaque.h),
            fontSize: type(A.name.size),
            color: t.ink,
          }}
        >
          {live.name}
        </span>
        <span
          className="absolute flex items-center gap-[5px] leading-none"
          style={{
            left: scale(A.status.dotX - 4, A.plaque.w),
            right: scale(10, A.plaque.w),
            top: scale(A.status.y - A.status.size + 1, A.plaque.h),
            fontSize: type(A.status.size),
            color: t.soft,
          }}
        >
          {/* The status lamp, glowing in its colour. */}
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 35% 35%, rgb(255 255 255 / 0.7), ${tone} 55%)`,
              boxShadow: `0 0 0 2px ${tone}40, 0 0 6px ${tone}`,
            }}
          />
          <span className="truncate font-medium">{status}</span>
        </span>
        {time ? (
          <span
            data-room-sign-time
            className="absolute truncate leading-none"
            style={{
              left: scale(A.name.x, A.plaque.w),
              width: scale(A.knock.x - A.name.x - 4, A.plaque.w),
              top: scale(A.knock.y + 3, A.plaque.h),
              fontSize: type(A.status.size - 1),
              color: t.soft,
              opacity: 0.85,
            }}
          >
            {time}
          </span>
        ) : null}
      </div>
      {canKnock ? (
        <HoverCard
          title={knocked ? 'Knocked' : `Knock on ${live.name}`}
          description={
            knocked ? 'You can knock again in a moment' : 'Asks the people inside to let you in'
          }
          className="pointer-events-auto absolute"
          style={{
            left: scale(A.knock.x, A.plaque.w),
            top: scale(A.knock.y, A.plaque.h),
            width: scale(A.knock.w, A.plaque.w),
            height: scale(A.knock.h, A.plaque.h),
          }}
        >
          <button
            type="button"
            data-room-sign-knock
            aria-label={knocked ? 'Knocked' : `Knock on ${live.name}`}
            aria-disabled={knocked}
            {...press}
            data-piece-main=""
            // A small brass button, lit from above, its own deeper edge.
            style={{
              fontSize: type(10),
              color: t.ink,
              background: `linear-gradient(${t.brassLit}, ${t.brass})`,
              boxShadow: `inset 0 0 0 1px ${t.brassEdge}, 0 1px 1px rgb(0 0 0 / 0.25)`,
            }}
            className={`flex h-full w-full items-center justify-center gap-1 rounded-full font-semibold leading-none transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600 motion-reduce:transition-none ${
              knocked
                ? 'cursor-default opacity-60'
                : 'cursor-pointer hover:brightness-110 active:scale-95'
            }`}
          >
            <KnockGlyph size={10} />
            {knocked ? 'Knocked' : 'Knock'}
          </button>
        </HoverCard>
      ) : null}
    </div>
  );
}
