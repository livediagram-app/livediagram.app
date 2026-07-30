// The face of a Door element (spec/104): a door drawn on the element's box,
// with its label under the frame.
//
// Same interaction rules as the Selection Mode button (spec/103): a real
// <button> so a click travels rather than only selecting, `pointer-events: auto`
// so it still works inside the pointer-inert Avatar / Spotlight / Isometric
// layers, and pointer-down left alone so dragging still moves it.
//
// An UNPAIRED door is inert and says so in its tooltip. A portal to nowhere
// that silently swallows clicks is worse than one that admits it isn't wired up
// yet.

import { Tooltip } from '@/components/primitives/Tooltip';

export function DoorFace({
  label,
  textColor,
  strokeColor,
  targetName,
  onEnter,
}: {
  label: string;
  textColor: string;
  strokeColor: string;
  // The paired door's name, for the tooltip. Null when this door is unpaired.
  targetName: string | null;
  // Undefined when unpaired, or on a read-only surface with no viewport to move.
  onEnter?: () => void;
}) {
  const face = (
    <>
      {/* The door itself: a panel inset into the element's box, with a knob.
          Drawn in the element's stroke colour so recolouring it works. */}
      <svg
        viewBox="0 0 24 36"
        preserveAspectRatio="none"
        className="absolute inset-[10%] h-[70%] w-[80%]"
        aria-hidden
      >
        <rect
          x="1"
          y="1"
          width="22"
          height="34"
          rx="2"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        <rect
          x="4.5"
          y="4.5"
          width="15"
          height="13"
          rx="1"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1"
        />
        <circle cx="19" cy="22" r="1.4" fill={strokeColor} />
      </svg>
      <span
        className="absolute inset-x-0 bottom-1 truncate px-1 text-center leading-tight"
        style={{ color: textColor }}
      >
        {label}
      </span>
    </>
  );
  if (!onEnter) {
    return (
      <Tooltip
        title="Door (not connected)"
        description="Right-click the door and open Tools › Door to pick where it leads."
      >
        <div className="pointer-events-auto h-full w-full cursor-default">{face}</div>
      </Tooltip>
    );
  }
  return (
    <Tooltip
      title={`Go to ${targetName ?? 'the other door'}`}
      description="Click to travel, or walk your Avatar-mode character into it."
    >
      <button
        type="button"
        aria-label={`${label} — go to ${targetName ?? 'the paired door'}`}
        onClick={(e) => {
          e.stopPropagation();
          onEnter();
        }}
        className="pointer-events-auto h-full w-full cursor-pointer transition duration-100 active:scale-[0.97] sm:hover:brightness-[1.08]"
      >
        {face}
      </button>
    </Tooltip>
  );
}
