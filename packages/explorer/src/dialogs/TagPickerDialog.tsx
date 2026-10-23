'use client';

// Tag an item (liveplanner's TagPicker, as a small dialog): every tag as a checkbox row, and a field that
// makes a new tag and puts it on. Each toggle shows at once on every row.

import { useState, useSyncExternalStore } from 'react';
import { TAG_COLOURS, TAG_LIMIT, TAG_NAME_MAX } from '@liveworkspace/index-client';
import type { ShownItem } from '../data/overlay';
import { Button } from '../ui/Button';
import { Dialog, DialogCloseButton, DialogFooter, DialogHeader } from '../ui/Dialog';
import { CheckIcon } from '../ui/icons';
import { TagDot } from '../explorer/badges';
import { useExplorer } from '../explorer/context';

export function TagPickerDialog({ onClose }: { onClose: () => void }) {
  const { tags, actions, overlay, dialog } = useExplorer();
  // The item as it now shows (a toggle patches it), from the dialog's own copy plus the overlay.
  const base = dialog && dialog.kind === 'tags' ? dialog.item : null;
  // Re-renders when a toggle patches the item.
  useSyncExternalStore(overlay.subscribe, overlay.version, overlay.version);
  const item = base ? (overlay.apply(base) as ShownItem) : null;
  const [name, setName] = useState('');
  if (!item) return null;
  const toggle = (tagId: string) => actions.setTagged(item, tagId, !item.tagIds.includes(tagId));
  return (
    <Dialog onClose={onClose} ariaLabel="Tags" size="sm">
      <DialogHeader title="Tags" subtitle={item.title || 'Untitled'}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div
        className="flex max-h-80 flex-col gap-0.5 overflow-y-auto px-3 py-2"
        role="group"
        aria-label="Tags"
      >
        {tags.tags.length === 0 ? (
          <p className="px-2 py-2 text-sm text-slate-500 dark:text-slate-400">No tags yet.</p>
        ) : (
          tags.tags.map((t) => {
            const on = item.tagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => void toggle(t.id)}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span
                  className={`grid size-4 place-items-center rounded border ${
                    on
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {on ? <CheckIcon size={10} /> : null}
                </span>
                <TagDot colour={t.colour} />
                <span className="truncate">{t.name}</span>
              </button>
            );
          })
        )}
      </div>
      {tags.tags.length < TAG_LIMIT ? (
        <form
          className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800"
          onSubmit={async (e) => {
            e.preventDefault();
            const next = name.trim();
            if (!next) return;
            setName('');
            const colour = TAG_COLOURS[(tags.tags.length + 2) % TAG_COLOURS.length]!;
            const tag = await tags.create(next, colour);
            if (tag) await actions.setTagged(overlay.apply(item), tag.id, true);
          }}
        >
          <input
            value={name}
            maxLength={TAG_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            placeholder="New tag"
            aria-label="New tag"
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
          <Button type="submit" size="xs" variant="secondary" disabled={!name.trim()}>
            Add
          </Button>
        </form>
      ) : null}
      <DialogFooter>
        <Button size="sm" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
