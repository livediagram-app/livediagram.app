// The face of a Roll call (spec/129): who was in the room when the roll was
// taken. A frozen snapshot, not live presence — a card that tracked presence
// would be empty five minutes after the session, which is exactly when anyone
// reads it.

import type { RollCallEntry, ShapeElement } from '@livediagram/diagram';
import { initialsOf } from '@/lib/identity';
import { CollabButton, CollabEmpty, CollabPanel } from './collab-chrome';

// The stored name + colour, drawn as the presence avatar it was copied from.
// NOT ParticipantAvatar: that takes a live Participant with a presence status,
// and the whole point here is that these people are no longer in the room
// (spec/129).
function RollAvatar({ entry }: { entry: RollCallEntry }) {
  return (
    <span
      role="img"
      aria-label={entry.name}
      className="flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
      style={{ backgroundColor: entry.color }}
    >
      {initialsOf(entry.name)}
    </span>
  );
}

export function RollCallFace({
  element,
  label,
  textColor,
  onTakeRoll,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  onTakeRoll?: () => void;
}) {
  const entries = element.rollCall ?? [];
  // Every entry is stamped at the same moment, so the first is the roll's time.
  const takenAt = entries[0]?.at;

  return (
    <CollabPanel
      title={label.trim() || 'Roll call'}
      textColor={textColor}
      aside={entries.length ? `${entries.length} present` : undefined}
      footer={
        <CollabButton
          tone={entries.length ? 'quiet' : 'loud'}
          textColor={textColor}
          onPress={onTakeRoll}
          tooltip={{
            title: entries.length ? 'Take the roll again' : 'Take the roll',
            description: entries.length
              ? 'Replaces the list with whoever is in the room now — the usual reason is latecomers.'
              : 'Records everyone in the room at this moment, and keeps them after they leave.',
          }}
        >
          {entries.length ? 'Take again' : 'Take roll'}
        </CollabButton>
      }
    >
      {entries.length === 0 ? (
        <CollabEmpty textColor={textColor}>
          Nobody recorded yet. Take the roll to freeze who is here into the diagram.
        </CollabEmpty>
      ) : (
        <>
          {takenAt ? (
            <p className="mb-1 text-[10px] opacity-50" style={{ color: textColor }}>
              {new Date(takenAt).toLocaleString()}
            </p>
          ) : null}
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
            {entries.map((entry, i) => (
              <li key={`${i}-${entry.name}`} className="flex min-w-0 items-center gap-1.5">
                <RollAvatar entry={entry} />
                <span className="min-w-0 truncate text-[11px]" style={{ color: textColor }}>
                  {entry.name}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </CollabPanel>
  );
}
