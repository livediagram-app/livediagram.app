'use client';

// The end of a card panel field's heading line (docs/specs/026-plan/plan-board.md "Main column"): a field with an
// action of its own puts it there where there is no hover (a rich text field's Edit), so its content takes the full
// width below rather than leaving a column beside it for the button. The slot shows itself only where that applies,
// and says which, so the field hides its own in-content copy over the same widths:
// - 'touch': a main-column section's heading, on a phone and on any screen with no hover;
// - 'phone': a Details row's label, on a phone alone (wider, the label sits beside its control, no line to share).
import { createContext, useContext, useState, type ReactNode } from 'react';

export type FieldHeadingSlotMode = 'touch' | 'phone';
type Slot = { el: HTMLElement; mode: FieldHeadingSlotMode } | null;

const FieldHeadingSlotContext = createContext<Slot>(null);

/** The heading line's slot a field may portal its action into, or null outside one. */
export function useFieldHeadingSlot(): Slot {
  return useContext(FieldHeadingSlotContext);
}

// Where the slot (and so the action in it) shows.
const SLOT_SHOWN: Record<FieldHeadingSlotMode, string> = {
  touch: 'hidden max-sm:flex [@media(hover:none)]:flex',
  phone: 'hidden max-sm:flex',
};

/** A heading line's slot element and the provider handing it to the field below; render `slot` at the line's end. */
export function useHeadingSlot(mode: FieldHeadingSlotMode): {
  slot: ReactNode;
  provide: (children: ReactNode) => ReactNode;
} {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return {
    slot: (
      <span
        ref={setEl}
        data-field-heading-slot={mode}
        className={`ml-auto shrink-0 items-center ${SLOT_SHOWN[mode]}`}
      />
    ),
    provide: (children) => (
      <FieldHeadingSlotContext.Provider value={el ? { el, mode } : null}>
        {children}
      </FieldHeadingSlotContext.Provider>
    ),
  };
}
