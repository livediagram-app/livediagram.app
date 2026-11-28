'use client';

// Sprint Review's Follow-up dialog (docs/specs/026-plan/session-tabs.md "Sprint Review"): a centred dialog (a sheet on
// a phone) with an illustrated header naming the reviewed card, a Title (from the newest feedback this screen added),
// a Card Type (the card's own first), where the new card goes and how it links, then Cancel and Create Follow-up.
// Create needs a title; Enter in the title presses it and Escape cancels. The facilitator's alone.
import { useEffect, useId, useRef, useState } from 'react';
import {
  FOLLOW_UP_TITLE_MAX,
  followUpFieldOf,
  followUpStatus,
  itemTitle,
  typeIn,
  type Item,
  type ItemTypeDef,
} from '@liveplanner/items';
import { lucideArrowRight } from '@liveworkspace/icons/lucide';
import { Button, DialogFooter, Select, TextInput } from '@liveworkspace/ui';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { lucideGlyph } from '@liveplanner/ui';
import { newCardStatus } from '@/components/plan/new-card-status';
import { refOf } from '../session-words';
import { followUpHeroArt } from './FollowUpHeroArt';

const ArrowIcon = lucideGlyph(lucideArrowRight, 14);
const HEADING = 'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

export function FollowUpDialog({
  item,
  items,
  types,
  statusNames,
  initialTitle,
  onCancel,
  onCreate,
}: {
  item: Item;
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusNames: ReadonlyMap<string, string>;
  initialTitle: string;
  onCancel: () => void;
  onCreate: (input: { title: string; typeId: string }) => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(() => initialTitle.slice(0, FOLLOW_UP_TITLE_MAX));
  const [typeId, setTypeId] = useState(item.type);
  // With a mouse the title takes focus at once; on a touch screen the keyboard would cover the sheet.
  useEffect(() => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) inputRef.current?.select();
  }, []);
  const ready = title.trim().length > 0;
  const create = () => {
    if (ready) onCreate({ title: title.trim(), typeId });
  };
  const type = typeIn(types, typeId);
  const status = followUpStatus(type, statusNames) ?? newCardStatus(type, statusNames);
  const field = followUpFieldOf(type, item.type);
  const ref = refOf(item.id, items, types);
  return (
    <Dialog open onClose={onCancel} titleId={titleId} size="md" phoneSheet>
      <HeroDialogHeader
        art={followUpHeroArt}
        titleId={titleId}
        title="New Follow-up"
        subtitle={`From ${ref} · ${itemTitle(item)}`}
        onClose={onCancel}
      />
      <div
        className="scrollbar-slim flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
        data-follow-up-dialog=""
      >
        <section className="flex flex-col gap-2">
          <label htmlFor={`${id}-name`} className={HEADING}>
            Title
          </label>
          <TextInput
            id={`${id}-name`}
            ref={inputRef}
            value={title}
            maxLength={FOLLOW_UP_TITLE_MAX}
            placeholder="What needs doing next?"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                create();
              }
            }}
          />
        </section>
        <section className="flex flex-col gap-2">
          <label htmlFor={`${id}-type`} className={HEADING}>
            Card Type
          </label>
          <Select
            id={`${id}-type`}
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            selectClassName="text-[13px]"
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
        </section>
        <p
          className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300"
          role="status"
          data-follow-up-goes=""
        >
          <span className="mt-0.5 text-slate-500 dark:text-slate-400">
            <ArrowIcon aria-hidden />
          </span>
          <span>
            Added to{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              {statusNames.get(status) ?? status}
            </strong>
            {field
              ? `, linked to ${ref} through ${field.label}`
              : type.fields.includes('description')
                ? `, its description naming ${ref}`
                : ''}
          </span>
        </p>
      </div>
      <DialogFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!ready} onClick={create}>
          Create Follow-up
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
