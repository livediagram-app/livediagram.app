'use client';

// A card's Labels in the item panel (docs/specs/026-plan/plan-board.md "Working on a board"): coloured chips in one
// field, and under it, while the field has focus, the label menu: the plan's labels the card does not have, as the
// same chips with how many cards carry each, most used first, narrowed as you type, ending in Create when the text
// names no label. So the plan's labels are reused rather than retyped a little differently: text that differs from
// a plan label only by case takes the plan's spelling. The menu is drawn over the page (AnchoredPopover, focus left
// in the field), so the side column never clips it.
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ITEM_LABEL_MAX,
  ITEM_LABELS_MAX,
  matchLabels,
  planSpellingOf,
  type ItemFieldValue,
  type LabelUse,
} from '@liveplanner/items';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { ChipField } from '@/components/primitives/ChipField';
import { labelColour } from './label-colour';
import { LabelMenu } from './LabelMenu';

type Save = (value: ItemFieldValue | undefined) => void | boolean | Promise<boolean>;

// The menu's least width: a few chips to a row, however narrow the field.
export const LABEL_MENU_MIN_PX = 280;

const NO_USES: readonly LabelUse[] = [];

export function LabelsEditor({
  id,
  value,
  disabled,
  suggestions = NO_USES,
  onSave,
}: {
  id: string;
  value: ItemFieldValue | undefined;
  disabled: boolean;
  // The plan's labels with their counts (labelUsage), worked out once per change of the plan's cards.
  suggestions?: readonly LabelUse[];
  onSave: Save;
}) {
  const labels = Array.isArray(value)
    ? value.filter((l): l is string => typeof l === 'string')
    : [];
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  // The highlighted option; null follows the text (the first label starting with it, else Create).
  const [picked, setPicked] = useState<number | null>(null);

  // One pass over the plan's labels per keystroke: no card is read here.
  const { matches, creatable } = useMemo(
    () => matchLabels(suggestions, draft, labels),
    // `labels` is a fresh array each render; its text is what matters.
    // oxlint-disable-next-line react/exhaustive-deps
    [suggestions, draft, labels.join('\n')],
  );
  const query = draft.trim().replace(/^#/, '');
  const options = matches.length + (creatable ? 1 : 0);
  const auto = !query
    ? -1
    : matches[0]?.label.toLowerCase().startsWith(query.toLowerCase())
      ? 0
      : creatable
        ? matches.length
        : matches.length
          ? 0
          : -1;
  const active = picked === null ? auto : Math.min(picked, options - 1);
  const full = labels.length >= ITEM_LABELS_MAX;

  const addLabels = (texts: readonly string[]) => {
    const next = [...labels];
    for (const t of texts) {
      const typed = t.trim().replace(/^#/, '');
      if (!typed) continue;
      const l = planSpellingOf(typed, suggestions);
      if (!next.some((x) => x.toLowerCase() === l.toLowerCase())) next.push(l);
    }
    // A card holds up to ITEM_LABELS_MAX labels; the menu says so once it is full.
    if (next.length !== labels.length && next.length <= ITEM_LABELS_MAX) void onSave(next);
  };
  const remove = (l: string) => {
    const next = labels.filter((x) => x !== l);
    void onSave(next.length ? next : undefined);
  };
  const setText = (text: string) => {
    setDraft(text);
    setPicked(null);
    setOpen(true);
  };
  // Adds an option (a plan label, or Create's text) and keeps the menu open for the next.
  const choose = (index: number) => {
    const use = matches[index];
    addLabels([use ? use.label : query]);
    setText('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (!options) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // From nothing highlighted, Down starts at the first and Up at the last; both wrap.
      const from = active < 0 ? (step > 0 ? -1 : options) : active;
      setPicked((from + step + options) % options);
    } else if (e.key === 'Enter' && open && active >= 0 && !full) {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') setOpen(false);
  };

  const anchor = boxRef.current;
  return (
    <div ref={boxRef} className="w-full">
      <ChipField
        compact
        id={id}
        chips={labels}
        chipColour={labelColour}
        removeLabel={(l) => `Remove label ${l}`}
        draft={draft}
        onDraftChange={(text) => {
          // A comma (typed or pasted) adds what comes before it.
          if (!text.includes(',')) return setText(text);
          const parts = text.split(',');
          addLabels(parts.slice(0, -1));
          setText(parts[parts.length - 1]!);
        }}
        onCommit={() => {
          addLabels([draft]);
          setText('');
        }}
        onBlur={() => {
          addLabels([draft]);
          setDraft('');
          setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onRemove={remove}
        readOnly={disabled}
        emptyText="None"
        maxLength={ITEM_LABEL_MAX}
        placeholder={labels.length ? 'Add…' : 'Add a label'}
        combobox={{
          expanded: open,
          controls: listId,
          activeId: open && active >= 0 ? `${listId}-${active}` : undefined,
        }}
      />
      {open && anchor && !disabled ? (
        <AnchoredPopover
          anchor={anchor}
          name="Labels on this plan"
          width={Math.max(LABEL_MENU_MIN_PX, anchor.offsetWidth)}
          initialFocus="none"
          onClose={() => setOpen(false)}
        >
          <LabelMenu
            listId={listId}
            matches={matches}
            query={query}
            creatable={creatable}
            active={active}
            full={full}
            planHasLabels={suggestions.length > 0}
            onHover={setPicked}
            onChoose={choose}
          />
        </AnchoredPopover>
      ) : null}
    </div>
  );
}
