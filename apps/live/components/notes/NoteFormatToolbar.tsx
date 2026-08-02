'use client';

// The note editor's formatting toolbar (spec/92). Unlike the label editor's
// floating toolbar, this one is ALWAYS VISIBLE and docked at the top of the
// popover: a note is read about as often as it is written, and a toolbar that
// appears on focus makes the popover jump the moment you click into it.
//
// Presentation + the link field only; every command is dispatched by the
// editor, which owns the runs and the selection.

import { useEffect, useRef, useState } from 'react';
import type { ListStyle, RunBoolKey, RunHeading } from '@livediagram/diagram';
import { LinkMenuIcon } from '@/components/palette/context-menu-icons';
import { noFocusSteal } from '@/components/rich-text/ToolbarDropdown';
import {
  runToggles,
  TOOLBAR_DIVIDER,
  toolbarButtonClass,
} from '@/components/rich-text/toolbar-chrome';
import { BlockTypePicker } from '@/components/rich-text/BlockTypePicker';
import type { ActiveFormat } from '@/components/rich-text/rich-text-format';
import { Tooltip } from '@/components/primitives/Tooltip';
import { normaliseUrl } from '@/lib/url-safety';

// preventDefault on mousedown keeps focus + the live selection in the
// contentEditable when a control is clicked (the classic rich-text-toolbar
// bug). Shared by every button so the editor never blurs mid-format.
export function NoteFormatToolbar({
  active,
  listStyle,
  onToggle,
  onApplyList,
  onApplyHeading,
  onApplyLink,
}: {
  active: ActiveFormat;
  // The list style of the line the caret sits on, read from the note's plain
  // text (a list is a literal line prefix, spec/92) — the picker needs it to
  // show what the current line already is.
  listStyle: ListStyle;
  onToggle: (key: RunBoolKey) => void;
  onApplyList: (style: ListStyle) => void;
  onApplyHeading: (level: RunHeading | null) => void;
  onApplyLink: (url: string | null) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);

  const toggles = runToggles('bold', 'italic', 'underline');

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
        {toggles.map((t) => (
          <Tooltip key={t.key} title={t.label} description={t.description}>
            <button
              type="button"
              aria-label={t.label}
              aria-pressed={active[t.key]}
              onMouseDown={noFocusSteal}
              onClick={() => onToggle(t.key)}
              className={toolbarButtonClass(active[t.key], 'shrink-0')}
            >
              {t.icon}
            </button>
          </Tooltip>
        ))}
        {TOOLBAR_DIVIDER}
        {/* One block-type picker (spec/102) rather than three heading buttons
            beside bullet / numbered / remove-list: to a writer a line is a
            heading, or a paragraph, or a bullet, and five toggles made that
            one decision look like several. Same control as the label
            toolbar. */}
        <BlockTypePicker
          heading={active.heading}
          listStyle={listStyle}
          onApplyHeading={onApplyHeading}
          onApplyList={onApplyList}
        />
        {TOOLBAR_DIVIDER}
        <Tooltip title="Link" description="Point the selected text at a web address.">
          <button
            type="button"
            aria-label="Link"
            aria-pressed={!!active.link}
            aria-expanded={linkOpen}
            onMouseDown={noFocusSteal}
            onClick={() => setLinkOpen((o) => !o)}
            className={toolbarButtonClass(!!active.link || linkOpen, 'shrink-0')}
          >
            <LinkMenuIcon />
          </button>
        </Tooltip>
      </div>
      {linkOpen ? (
        <NoteLinkField
          initial={active.link}
          onApply={(url) => {
            onApplyLink(url);
            setLinkOpen(false);
          }}
          onClose={() => setLinkOpen(false)}
        />
      ) : null}
    </div>
  );
}

// The inline address field the Link button reveals. Applying runs the same
// `normaliseUrl` guard the element link picker uses, so a bare host gains
// https:// and an unsafe scheme is refused rather than stored.
function NoteLinkField({
  initial,
  onApply,
  onClose,
}: {
  initial: string | null;
  onApply: (url: string | null) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const apply = () => {
    const url = normaliseUrl(value);
    if (!url) {
      setInvalid(true);
      return;
    }
    onApply(url);
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setInvalid(false);
        }}
        onKeyDown={(e) => {
          // Keep Enter / Esc inside the field: the popover treats them as
          // save / cancel for the whole note otherwise.
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            apply();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder="example.com"
        aria-label="Link address"
        aria-invalid={invalid}
        className={`min-w-0 flex-1 rounded-md border bg-white px-2 py-1 text-xs text-slate-800 outline-none placeholder:text-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 ${
          invalid
            ? 'border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-rose-500'
            : 'border-slate-200 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700'
        }`}
      />
      <button
        type="button"
        onMouseDown={noFocusSteal}
        onClick={apply}
        className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-brand-700"
      >
        Apply
      </button>
      {initial ? (
        <button
          type="button"
          onMouseDown={noFocusSteal}
          onClick={() => onApply(null)}
          className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
