import type { ShapeElement } from '@livediagram/diagram';

// The checklist's canvas view (spec/83): a themed card of checkbox rows.
// Clicking a box toggles that row's done state (edit-role only, like the
// rating's stars); row text is edited from the context menu's Checklist
// section. Done rows tick, strike through, and mute; a done-count footer
// appears once anything is ticked.
export function ChecklistView({
  element,
  accent,
  fill,
  textColor,
  fontFamily,
  editable,
  onToggle,
}: {
  element: ShapeElement;
  accent: string;
  fill: string;
  textColor: string;
  fontFamily?: string;
  editable: boolean;
  onToggle?: (elementId: string, index: number) => void;
}) {
  const items = element.checklistItems ?? [];
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-lg border"
      style={{ backgroundColor: fill, borderColor: accent, fontFamily }}
    >
      <div className="flex h-full flex-col gap-1 overflow-hidden p-3">
        {items.map((item, index) => (
          <div key={index} className="flex min-h-6 shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={item.done ? `Mark "${item.text}" not done` : `Mark "${item.text}" done`}
              aria-pressed={item.done}
              disabled={!editable}
              // Stop the press from starting an element drag so a quick
              // tick doesn't nudge the card (the rail's inline editor
              // does the same).
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (editable) onToggle?.(element.id, index);
              }}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition enabled:cursor-pointer"
              style={{
                borderColor: accent,
                backgroundColor: item.done ? accent : 'transparent',
              }}
            >
              {item.done ? (
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                  <path
                    d="M2 5.2 L4.2 7.4 L8 3"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </button>
            <span
              className="truncate text-[13px]"
              style={{
                color: textColor,
                textDecoration: item.done ? 'line-through' : undefined,
                opacity: item.done ? 0.55 : 1,
              }}
            >
              {item.text}
            </span>
          </div>
        ))}
      </div>
      {doneCount > 0 ? (
        <span
          className="pointer-events-none absolute bottom-1.5 right-2.5 text-[10px]"
          style={{ color: textColor, opacity: 0.6 }}
        >
          {doneCount}/{items.length}
        </span>
      ) : null}
    </div>
  );
}
