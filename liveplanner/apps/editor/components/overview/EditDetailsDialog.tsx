'use client';

import { useId, useState } from 'react';
import { PROJECT_DESCRIPTION_MAX } from '@liveplanner/api-schema';
import { NAME_MAX_LENGTH } from '@liveworkspace/model-core/names';
import { Button, DialogCloseButton, DialogHeader, TextArea, TextInput } from '@liveplanner/ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import { DialogFooter } from '@liveworkspace/workbench/components/dialogs/DialogFooter';

// The description's count shows once it passes this (blueprint DEFAULTS D81).
export const DESCRIPTION_COUNT_FROM = 400;

// Edit Details (docs/specs/026-plan/plan-overview.md "Edit Details"): the plan's name and description in one dialog.
// Save hands back what was typed; the caller writes what changed.
export function EditDetailsDialog({
  name,
  description,
  onSave,
  onClose,
}: {
  name: string;
  description: string;
  onSave: (next: { name: string; description: string }) => void;
  onClose: () => void;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const nameId = useId();
  const descriptionId = useId();
  const countId = useId();
  const nameEmpty = draftName.trim() === '';
  const showCount = draftDescription.length > DESCRIPTION_COUNT_FROM;
  const save = () => {
    if (nameEmpty) return;
    onSave({ name: draftName.trim(), description: draftDescription });
  };
  return (
    <Dialog open onClose={onClose} ariaLabel="Edit Details" size="md" phoneSheet>
      <DialogHeader
        title="Edit Details"
        subtitle="The name and description everyone sees on this plan’s Overview."
      >
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <form
        className="flex flex-col gap-4 px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={nameId}
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Name
          </label>
          <TextInput
            id={nameId}
            value={draftName}
            maxLength={NAME_MAX_LENGTH}
            invalid={nameEmpty}
            onChange={(e) => setDraftName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={descriptionId}
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Description
          </label>
          <TextArea
            id={descriptionId}
            rows={4}
            value={draftDescription}
            maxLength={PROJECT_DESCRIPTION_MAX}
            placeholder="What is this plan for?"
            aria-describedby={showCount ? countId : undefined}
            onChange={(e) => setDraftDescription(e.target.value)}
            className="resize-y"
          />
          {showCount ? (
            <span
              id={countId}
              aria-live="polite"
              className="self-end text-xs tabular-nums text-slate-500 dark:text-slate-400"
            >
              {draftDescription.length} / {PROJECT_DESCRIPTION_MAX}
            </span>
          ) : null}
        </div>
        {/* Enter in the name field saves, as a form does. */}
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
      <DialogFooter>
        <Button variant="secondary" size="xs" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" size="xs" disabled={nameEmpty} onClick={save}>
          Save
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
