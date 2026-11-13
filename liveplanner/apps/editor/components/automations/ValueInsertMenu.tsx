'use client';

// Insert a Value (docs/specs/026-plan/automations.md "Values"): the button inside a rule's text field and what it opens.
// On a wide screen a popover pointing at the button; on a phone a sheet over the step's drawer, titled Insert a Value.
// Both hold a search ("Find a value") driving a list of the values in groups, as a combobox: Up and Down walk it,
// Enter inserts the one marked, a click or a tap inserts too, and Escape closes. Webhook Field… turns it to the path line.

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { DialogCloseButton, HoverCard, lucideGlyph, useDialogDismiss } from '@liveplanner/ui';
import { lucideBraces } from '@liveworkspace/icons/lucide';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { SearchInput } from '@liveworkspace/workbench/components/primitives/SearchInput';
import { filterValueGroups, type ValueGroup, type ValueOption } from './value-insert-options';
import { WebhookPathForm } from './WebhookFieldInsert';

const BracesIcon = lucideGlyph(lucideBraces, 16);

export const VALUE_INSERT_TITLE = 'Insert a Value';

/** The button at the field's top right. */
export function ValueInsertButton({
  label,
  open,
  onOpen,
}: {
  // The field's label, for the button's name.
  label: string;
  open: boolean;
  onOpen: (anchor: HTMLButtonElement) => void;
}) {
  return (
    <span className="absolute right-1.5 top-1.5 z-10">
      <HoverCard
        title={VALUE_INSERT_TITLE}
        description="Put a value of the card, like its title or due date, at the caret."
      >
        <button
          type="button"
          data-value-insert=""
          aria-label={`${VALUE_INSERT_TITLE} into ${label}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={(e) => onOpen(e.currentTarget)}
          className={`touch-target relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition motion-reduce:transition-none ${
            open
              ? 'bg-brand-100 text-brand-800 dark:bg-brand-500/25 dark:text-brand-100'
              : 'text-slate-500 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-500/15 dark:hover:text-brand-200'
          }`}
        >
          <BracesIcon />
        </button>
      </HoverCard>
    </span>
  );
}

/** The search and the grouped values, as a combobox over a listbox. */
export function ValueInsertList({
  groups,
  onPick,
  onWebhook,
  autoFocus,
  phone = false,
}: {
  groups: readonly ValueGroup[];
  onPick: (name: string) => void;
  onWebhook: () => void;
  autoFocus: boolean;
  phone?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = useMemo(() => filterValueGroups(groups, query), [groups, query]);
  const flat = useMemo(() => shown.flatMap((g) => g.options), [shown]);
  const at = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optionId = (i: number) => `${id}-o${i}`;
  const choose = (o: ValueOption) => (o.kind === 'webhook' ? onWebhook() : onPick(o.name));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!flat.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((at + step + flat.length) % flat.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = flat[at];
      if (o) choose(o);
    }
  };
  let index = -1;
  return (
    <div className="flex min-h-0 flex-col">
      <div className={phone ? 'flex px-4 pb-2' : 'flex p-2 pb-1'}>
        <SearchInput
          value={query}
          onChange={(v) => {
            setQuery(v);
            setActive(0);
          }}
          placeholder="Find a value"
          ariaLabel="Find a value"
          clearAriaLabel="Clear Search"
          clearDescription="Show every value again."
          onKeyDown={onKey}
          listboxId={`${id}-list`}
          {...(at >= 0 ? { activeDescendantId: optionId(at) } : {})}
          autoFocus={autoFocus}
          size={phone ? 'lg' : 'md'}
        />
      </div>
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label="Values"
        className={`min-h-0 overflow-y-auto overscroll-contain ${phone ? 'px-2 pb-3' : 'max-h-72 px-1 pb-1.5'}`}
      >
        {shown.length === 0 ? (
          <p
            role="status"
            className="px-3 py-4 text-center text-[13px] text-slate-500 dark:text-slate-400"
          >
            No values match.
          </p>
        ) : (
          shown.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`${id}-g-${g.id}`}>
              <div
                id={`${id}-g-${g.id}`}
                className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                {g.label}
              </div>
              {g.options.map((o) => {
                index += 1;
                const i = index;
                const on = i === at;
                return (
                  <div
                    key={o.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={on}
                    // Keep focus in the search, so the combobox stays the one control.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 text-[13px] ${phone ? 'min-h-11' : 'py-1.5'} ${
                      on
                        ? 'bg-brand-50 text-brand-800 dark:bg-brand-500/15 dark:text-brand-100'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <span className="min-w-0 truncate font-medium">{o.label}</span>
                    {o.kind === 'value' ? (
                      // On the marked row's violet wash slate 500 falls short of 4.5:1 (axe); 600 holds it.
                      <span
                        data-value-token=""
                        className={`min-w-0 shrink truncate font-mono text-[11px] ${on ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}
                      >
                        {`{{${o.name}}}`}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// A phone's sheet body: a pick slides the sheet away first, then inserts.
function PhoneBody({
  groups,
  onInsert,
  onClose,
}: {
  groups: readonly ValueGroup[];
  onInsert: (name: string) => void;
  onClose: () => void;
}) {
  const dismiss = useDialogDismiss();
  const [webhook, setWebhook] = useState(false);
  const pick = (name: string) =>
    dismiss(() => {
      onClose();
      onInsert(name);
    });
  return webhook ? (
    <WebhookPathForm onInsert={pick} onBack={() => setWebhook(false)} />
  ) : (
    <ValueInsertList
      groups={groups}
      onPick={pick}
      onWebhook={() => setWebhook(true)}
      autoFocus={false}
      phone
    />
  );
}

export function ValueInsertMenu({
  anchor,
  groups,
  phone,
  onInsert,
  onClose,
}: {
  anchor: HTMLElement;
  groups: readonly ValueGroup[];
  phone: boolean;
  onInsert: (name: string) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [webhook, setWebhook] = useState(false);
  if (phone)
    return (
      <Dialog
        open
        onClose={onClose}
        titleId={titleId}
        size="md"
        phoneSheet
        initialFocus="container"
        className="max-h-[85dvh] overflow-hidden"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-2">
          <h2 id={titleId} className="text-[16px] font-semibold text-slate-900 dark:text-slate-50">
            {VALUE_INSERT_TITLE}
          </h2>
          <DialogCloseButton onClick={onClose} />
        </div>
        <PhoneBody groups={groups} onInsert={onInsert} onClose={onClose} />
      </Dialog>
    );
  const pick = (name: string) => {
    onClose();
    onInsert(name);
  };
  return (
    <AnchoredPopover
      anchor={anchor}
      name={VALUE_INSERT_TITLE}
      width={300}
      pointer
      onClose={onClose}
      onEscape={() => {
        if (!webhook) return false;
        setWebhook(false);
        return true;
      }}
    >
      {webhook ? (
        <WebhookPathForm onInsert={pick} onBack={() => setWebhook(false)} />
      ) : (
        <ValueInsertList
          groups={groups}
          onPick={pick}
          onWebhook={() => setWebhook(true)}
          autoFocus
        />
      )}
    </AnchoredPopover>
  );
}
