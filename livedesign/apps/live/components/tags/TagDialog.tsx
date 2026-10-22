'use client';

// The tag dialog (docs/specs/013-workspace/tags.md "Making, renaming, recolouring and deleting"): New Tag and Rename.
// A Name field and the colour picker drawn in place, with a live preview of the chip. Mounted only while open, so each
// opening starts from its own values.

import { useEffect, useId, useRef, useState } from 'react';
import { Button, CloseIcon, TextInput } from '@livedesign/ui';
import { TAG_NAME_MAX, nextTagColour, normaliseTagName, type Tag } from '@livedesign/api-schema';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { ColourPicker } from '@/components/colour/ColourPicker';
import { useDocumentTags } from './DocumentTagsProvider';
import { tagNameProblem } from './useDocumentTagsState';
import { TAG_NO_THEME, TagColourIsolation, useTagColourOptions } from './TagColourButton';
import { TagChip } from './TagChip';

export function TagDialog({
  tag,
  onClose,
  onCreated,
}: {
  // The tag to rename; absent, a new one.
  tag?: Tag;
  onClose: () => void;
  onCreated?: (tag: Tag) => void;
}) {
  const { tags, createTag, updateTag } = useDocumentTags();
  const { standard, yours } = useTagColourOptions();
  const [name, setName] = useState(tag?.name ?? '');
  const [colour, setColour] = useState(tag?.colour ?? nextTagColour(tags.map((t) => t.colour)));
  // The name's problem shows once the reader has tried to save or typed something.
  const [touched, setTouched] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();
  // The name, not the close button, takes focus: it is what the dialog is for.
  useEffect(() => field.current?.focus(), []);
  const problem = tagNameProblem(name, tags, tag?.id);
  const preview: Tag = {
    id: tag?.id ?? 'preview',
    name: normaliseTagName(name) ?? (name.trim() || 'New tag'),
    colour,
    createdAt: 0,
  };

  const submit = () => {
    setTouched(true);
    if (problem) {
      field.current?.focus();
      return;
    }
    if (tag) {
      updateTag(tag.id, { name, colour });
      onClose();
      return;
    }
    const made = createTag(name, { colour });
    if (made) {
      onCreated?.(made);
      onClose();
    }
  };

  return (
    <Dialog open onClose={onClose} titleId={titleId} size="sm" initialFocus="first">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="border-b border-slate-100 px-6 pb-5 pt-5 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              {tag ? 'Edit Tag' : 'New Tag'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1.5 -mt-0.5 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <CloseIcon size={16} />
            </button>
          </div>
          <label className="mt-4 block">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Name
            </span>
            <TextInput
              ref={field}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTouched(true);
              }}
              placeholder="e.g. Client: Acme"
              maxLength={TAG_NAME_MAX + 8}
              aria-invalid={touched && problem !== null}
              aria-describedby={touched && problem ? errorId : undefined}
              className="mt-1"
            />
          </label>
          {touched && problem ? (
            <p id={errorId} className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
              {problem}
            </p>
          ) : null}
          <div className="mt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Colour
            </span>
            <div className="mt-2">
              <TagColourIsolation>
                <ColourPicker
                  label="Tag colour"
                  value={colour}
                  onPick={setColour}
                  theme={TAG_NO_THEME}
                  standard={standard}
                  yours={yours}
                />
              </TagColourIsolation>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Looks like</span>
            <TagChip tag={preview} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{tag ? 'Save' : 'Create Tag'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
