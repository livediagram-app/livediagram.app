'use client';

// The tag picker (docs/specs/013-workspace/tags.md "The tag picker"): a panel that stays open while the reader ticks
// tags on and off a project, finds them by typing, makes a new one from what they typed, and recolours one from its
// swatch. Every tick applies at once; there is no Save.

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CheckIcon, CompactEmptyState } from '@liveplanner/ui';
import { TAG_LIMIT, nextTagColour, normaliseTagName, tagNameKey } from '@liveplanner/api-schema';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { TagIcon } from '@/components/primitives/explorer-icons';
import { useOptionalExplorer } from '@/app/explorer/ExplorerContext';
import { explorerPathFor } from '@/app/explorer/routes';
import { useProjectTags, type TagPickerTarget } from './ProjectTagsProvider';
import { TagColourButton } from './TagColourButton';
import { TagDot } from './TagChip';
import { assignAppLocation } from '@/lib/app-location';

const TAG_PICKER_WIDTH = 288;

const ROW = 'data-tag-row';

// Up / Down through the rows (and from the field into them), wrapping at neither end: Up from the first row goes back
// to the field.
function moveFocus(
  e: KeyboardEvent<HTMLElement>,
  panel: HTMLElement | null,
  field: HTMLElement | null,
) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const rows = Array.from(panel?.querySelectorAll<HTMLElement>(`[${ROW}]`) ?? []);
  if (rows.length === 0) return;
  e.preventDefault();
  const at = rows.indexOf(document.activeElement as HTMLElement);
  if (e.key === 'ArrowDown') rows[Math.min(at + 1, rows.length - 1)]?.focus();
  else if (at <= 0) field?.focus();
  else rows[at - 1]?.focus();
}

export function TagPicker({ target, onClose }: { target: TagPickerTarget; onClose: () => void }) {
  const { tags, tagsFor, status, createTag, updateTag, setProjectTag } = useProjectTags();
  const explorer = useOptionalExplorer();
  const [query, setQuery] = useState('');
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const { projectId, projectName } = target;
  const on = useMemo(() => new Set(tagsFor(projectId).map((t) => t.id)), [tagsFor, projectId]);

  const clean = normaliseTagName(query);
  const key = clean ? tagNameKey(clean) : '';
  const shown = key ? tags.filter((t) => tagNameKey(t.name).includes(key)) : tags;
  const exact = key ? tags.find((t) => tagNameKey(t.name) === key) : undefined;
  const atLimit = tags.length >= TAG_LIMIT;
  const canCreate = clean !== null && !exact && !atLimit;
  const newColour = nextTagColour(tags.map((t) => t.colour));

  const toggle = (tagId: string) => setProjectTag(projectId, tagId, !on.has(tagId));
  const create = () => {
    if (!clean) return;
    if (createTag(clean, { applyTo: projectId })) setQuery('');
    field.current?.focus();
  };
  const onFieldKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exact) toggle(exact.id);
      else if (canCreate) create();
      return;
    }
    moveFocus(e, panel.current, field.current);
  };
  const manage = () => {
    onClose();
    if (explorer) explorer.go({ kind: 'tags' });
    else assignAppLocation(explorerPathFor({ kind: 'tags' }));
  };

  return (
    <AnchoredPopover
      anchor={target.anchor}
      name={`Tags for ${projectName || 'Untitled project'}`}
      width={TAG_PICKER_WIDTH}
      onClose={onClose}
    >
      <div
        ref={panel}
        data-tag-picker=""
        className="flex flex-col rounded-lg border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-slate-100 px-3 pb-2 pt-2.5 dark:border-slate-800">
          <p className="mb-1.5 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
            Tags
            <span className="font-normal text-slate-500 dark:text-slate-400">
              {' '}
              · {projectName || 'Untitled project'}
            </span>
          </p>
          <input
            ref={field}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onFieldKey}
            placeholder="Find or create a tag"
            aria-label="Find or create a tag"
            maxLength={64}
            className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </div>
        <div
          role="group"
          aria-label="Your tags"
          className="max-h-64 overflow-y-auto py-1"
          onKeyDown={(e) => moveFocus(e, panel.current, field.current)}
        >
          {status === 'loading' && tags.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-slate-500 dark:text-slate-400">
              Loading your tags…
            </p>
          ) : null}
          {status !== 'loading' && tags.length === 0 && !clean ? (
            <CompactEmptyState
              size="small"
              icon={<TagIcon />}
              title="No tags yet"
              description="Type a name to make your first."
            />
          ) : null}
          {shown.map((tag) => {
            const checked = on.has(tag.id);
            return (
              <div
                key={tag.id}
                className="group flex items-center gap-1 pr-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  {...{ [ROW]: '' }}
                  onClick={() => toggle(tag.id)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 pl-3 text-left text-[13px] text-slate-700 outline-none focus-visible:bg-slate-100 dark:text-slate-200 dark:focus-visible:bg-slate-800"
                >
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      checked
                        ? 'border-brand-700 bg-brand-700 text-white dark:border-brand-600 dark:bg-brand-600'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {checked ? <CheckIcon size={11} /> : null}
                  </span>
                  <TagDot colour={tag.colour} />
                  <span className="truncate">{tag.name}</span>
                </button>
                <TagColourButton
                  name={tag.name}
                  colour={tag.colour}
                  onPick={(colour) => updateTag(tag.id, { colour })}
                />
              </div>
            );
          })}
          {query.trim() && !clean ? (
            <p className="px-3 py-2 text-[12px] text-slate-500 dark:text-slate-400">
              Keep a tag's name to 32 characters.
            </p>
          ) : null}
          {canCreate ? (
            <button
              type="button"
              {...{ [ROW]: '' }}
              onClick={create}
              className="flex w-full cursor-pointer items-center gap-2.5 py-1.5 pl-3 pr-3 text-left text-[13px] text-slate-700 outline-none hover:bg-slate-50 focus-visible:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/60 dark:focus-visible:bg-slate-800"
            >
              <span
                aria-hidden
                className="flex h-4 w-4 shrink-0 items-center justify-center text-brand-700 dark:text-brand-300"
              >
                +
              </span>
              <TagDot colour={newColour} />
              <span className="truncate">
                Create <span className="font-semibold">“{clean}”</span>
              </span>
            </button>
          ) : null}
          {clean && !exact && atLimit ? (
            <p className="px-3 py-2 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              You have {TAG_LIMIT} tags, the most there can be. Delete one on the Tags page to make
              room.
            </p>
          ) : null}
        </div>
        <div className="border-t border-slate-100 px-1.5 py-1 dark:border-slate-800">
          <button
            type="button"
            onClick={manage}
            className="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-[12px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <TagIcon />
            Manage Tags
          </button>
        </div>
      </div>
    </AnchoredPopover>
  );
}
