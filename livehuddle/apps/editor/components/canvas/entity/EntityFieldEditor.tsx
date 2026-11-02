'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import {
  ENTITY_KEY_LABELS,
  ENTITY_MAX_TEXT,
  ENTITY_MONO_FONT,
  ENTITY_ROW_TEXT_PX,
  nextEntityKey,
  type EntityField,
} from '@livehuddle/document';
import { useCommitOnLeave } from '@liveworkspace/workbench/hooks/ui/useCommitOnLeave';
import { EntityKeyGlyph } from './EntityKeyGlyph';

// Where the editor goes once a row is saved: the next field (adding one after the last), the previous one,
// or nowhere.
export type FieldEditExit = 'next' | 'prev' | 'close';

// One field edited in place over its row (docs/specs/009-elements/entity.md "Editing on the canvas"): a key
// button, the name and the type. Enter saves and moves on, Tab steps name, type, next field, Shift+Tab
// steps back, Escape cancels, and focus leaving the row saves it.
export function EntityFieldEditor({
  field,
  top,
  onSave,
  onCancel,
}: {
  // The field as it reads now; absent for the new field after the last.
  field: EntityField | undefined;
  // The row's top, from the top of the fields area.
  top: number;
  onSave: (draft: EntityField, exit: FieldEditExit) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<EntityField>(field ?? { name: '' });
  const rootRef = useRef<HTMLDivElement>(null);
  // Set once the row has been saved or cancelled, so the blur that follows (or the unmount) adds nothing.
  const done = useRef(false);
  const finish = (exit: FieldEditExit | 'cancel') => {
    if (done.current) return;
    done.current = true;
    if (exit === 'cancel') onCancel();
    else onSave(draft, exit);
  };
  // The page going fires no blur: save the row before the unload flush reads the tabs.
  useCommitOnLeave(true, () => finish('close'));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, part: 'name' | 'type') => {
    // The canvas's shortcuts (Delete, Tab to grow, arrows to nudge) are not for a row being typed in.
    e.stopPropagation();
    if (e.key === 'Escape') {
      // Escape keeps what was typed, as on every canvas label (canvas-and-palette.md "Labels"); a blank new row
      // still adds nothing.
      e.preventDefault();
      finish('close');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      finish('next');
    } else if (e.key === 'Tab' && part === 'type' && !e.shiftKey) {
      e.preventDefault();
      finish('next');
    } else if (e.key === 'Tab' && part === 'name' && e.shiftKey) {
      e.preventDefault();
      finish('prev');
    }
  };

  return (
    <div
      ref={rootRef}
      data-entity-field-editor=""
      className="absolute inset-x-[3px] z-10 flex items-center gap-1 rounded-[4px] bg-white px-1 shadow-md ring-2 ring-brand-400 dark:bg-slate-900"
      style={{ top: top - 3, height: ENTITY_ROW_TEXT_PX + 6 }}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={(e) => {
        if (rootRef.current?.contains(e.relatedTarget)) return;
        finish('close');
      }}
    >
      <button
        type="button"
        aria-label={`Key: ${draft.key ? ENTITY_KEY_LABELS[draft.key] : 'None'}. Change key`}
        tabIndex={-1}
        // Keeps the caret in the input the press came from.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const key = nextEntityKey(draft.key);
          const { key: _old, ...rest } = draft;
          setDraft(key ? { ...rest, key } : rest);
        }}
        className="flex h-[14px] min-w-[14px] shrink-0 cursor-pointer items-center justify-center rounded-[3px] text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {draft.key ? (
          <EntityKeyGlyph fieldKey={draft.key} color="currentColor" />
        ) : (
          <span className="opacity-60">
            <EntityKeyGlyph fieldKey="pk" color="currentColor" muted />
          </span>
        )}
      </button>
      <input
        autoFocus
        value={draft.name}
        placeholder="name"
        aria-label="Field name"
        maxLength={ENTITY_MAX_TEXT}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        onKeyDown={(e) => onKeyDown(e, 'name')}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent text-[11px] leading-tight text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
      />
      <input
        value={draft.type ?? ''}
        placeholder="type"
        aria-label="Field type"
        maxLength={ENTITY_MAX_TEXT}
        onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value || undefined }))}
        onKeyDown={(e) => onKeyDown(e, 'type')}
        className="w-[42%] min-w-0 bg-transparent text-right text-[10px] leading-tight text-slate-500 outline-none placeholder:text-slate-300 dark:text-slate-400"
        style={{ fontFamily: ENTITY_MONO_FONT }}
      />
    </div>
  );
}
