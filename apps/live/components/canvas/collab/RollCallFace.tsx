// The face of a Roll call (docs/specs/012-collaboration/roll-call.md): who was in the room when the roll was
// taken. A frozen snapshot, not live presence: a card that tracked presence
// would be empty five minutes after the session, which is exactly when anyone
// reads it. Built in the behaviour elements' current look ("The face").

import { useState } from 'react';
import type { RollCallEntry, ShapeElement } from '@livediagram/diagram';
import { GlyphDisc, Glyph } from '@livediagram/ui';
import { initialsOf } from '@/lib/identity';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';
import { CollabPanel, tint } from './collab-chrome';
import { CollabAccentScope } from './collab-accent';
import { AccentBar, EmptyRows } from './qa/qa-parts';

// The stored name + colour, drawn as the presence avatar it was copied from.
// NOT ParticipantAvatar: that takes a live Participant with a presence status,
// and the whole point here is that these people are no longer in the room.
function RollAvatar({ entry, size, ring }: { entry: RollCallEntry; size: number; ring?: string }) {
  return (
    <GlyphDisc
      size={size}
      role="img"
      aria-label={entry.name}
      className={`font-semibold text-white ${IDENTITY_FILL}`}
      style={{
        ...identityVars(entry.color),
        fontSize: size * 0.42,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {initialsOf(entry.name)}
    </GlyphDisc>
  );
}

function ClipboardGlyph() {
  return (
    <Glyph size={12} units={16}>
      <rect x="3.5" y="3" width="9" height="11" rx="1.8" />
      <path d="M6 3V2h4v1M6 8.5l1.5 1.5L10.5 7" />
    </Glyph>
  );
}

// "14:05", or "14:05 · 27 Sep" when it wasn't today, in the reader's locale.
function takenLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const sameDay = new Date(now).toDateString() === d.toDateString();
  return sameDay
    ? time
    : `${time} · ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

const STACK = 5;

export function RollCallFace({
  element,
  label,
  textColor,
  surface,
  onTakeRoll,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  /** The card's own fill, for the accent scope and the avatar stack's rings. */
  surface: string;
  onTakeRoll?: () => void;
}) {
  const entries = element.rollCall ?? [];
  // Every entry is stamped at the same moment, so the first is the roll's time.
  const takenAt = entries[0]?.at;
  // A roll taken while the card is on screen cascades in; one that loaded
  // with the card sits still.
  const [initialAt] = useState(takenAt);
  const fresh = takenAt !== undefined && takenAt !== initialAt;

  return (
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        title={label.trim() || 'Roll call'}
        textColor={textColor}
        footer={
          onTakeRoll ? (
            <AccentBar onPress={onTakeRoll} icon={<ClipboardGlyph />}>
              {entries.length ? 'Take again' : 'Take roll'}
            </AccentBar>
          ) : undefined
        }
      >
        {entries.length === 0 ? (
          <EmptyRows textColor={textColor} title="Nobody recorded yet" rows={0}>
            Take the roll to freeze who is here into the diagram.
          </EmptyRows>
        ) : (
          <div className="flex min-h-0 flex-col gap-2.5">
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ backgroundColor: tint(textColor, 0.04) }}
            >
              <span className="flex flex-col">
                <span
                  className="text-[22px] font-bold leading-none tabular-nums"
                  style={{ color: textColor }}
                >
                  {entries.length}
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: textColor, opacity: 0.55 }}
                >
                  present
                </span>
              </span>
              <span className="flex -space-x-2" aria-hidden>
                {entries.slice(0, STACK).map((entry, i) => (
                  <RollAvatar key={`${i}-${entry.name}`} entry={entry} size={24} ring={surface} />
                ))}
                {entries.length > STACK ? (
                  <span
                    className="flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[9.5px] font-bold"
                    style={{
                      color: textColor,
                      backgroundColor: tint(textColor, 0.12),
                      boxShadow: `0 0 0 2px ${surface}`,
                    }}
                  >
                    <span className="text-optical-centre">+{entries.length - STACK}</span>
                  </span>
                ) : null}
              </span>
              {takenAt ? (
                <span
                  className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
                  style={{ color: textColor, backgroundColor: tint(textColor, 0.07) }}
                >
                  {takenLabel(takenAt)}
                </span>
              ) : null}
            </div>
            <ul className="flex flex-wrap gap-1.5" key={takenAt}>
              {entries.map((entry, i) => (
                <li
                  key={`${i}-${entry.name}`}
                  className={`flex min-w-0 max-w-full items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2.5 ${fresh ? 'qa-enter' : ''}`}
                  style={{
                    backgroundColor: tint(textColor, 0.06),
                    animationDelay: fresh ? `${i * 40}ms` : undefined,
                  }}
                >
                  <RollAvatar entry={entry} size={20} />
                  <span
                    className="min-w-0 truncate text-[11px] font-medium"
                    style={{ color: textColor }}
                  >
                    {entry.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CollabPanel>
    </CollabAccentScope>
  );
}
