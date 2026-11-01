'use client';

// The Style tab's Header and Footer (docs/specs/007-editor/article-pages.md "Headers and footers"): a
// header and a footer, each a Left, a Centre and a Right field; the four fields' buttons, which put a
// field at the caret of the box last used; and Different First Page. Typing previews on the page; a box
// is written as one edit when it is left or Enter is pressed.
import { useLayoutEffect, useRef, useState } from 'react';
import {
  ARTICLE_BAND_FIELDS,
  ARTICLE_BAND_MAX,
  parseArticleBand,
  type ArticleBand,
  type ArticleStyle,
} from '@livedocuments/document';
import { Switch, Tooltip } from '@livedocuments/ui';
import { PanelSection } from '../page-panel-sections';

type Band = 'header' | 'footer';
type Part = 'left' | 'center' | 'right';
const PARTS: { part: Part; label: string }[] = [
  { part: 'left', label: 'Left' },
  { part: 'center', label: 'Centre' },
  { part: 'right', label: 'Right' },
];
type Drafts = Record<Band, Record<Part, string>>;

const draftsOf = (style: ArticleStyle | undefined): Drafts => {
  const of = (b: ArticleBand | undefined) => ({
    left: b?.left ?? '',
    center: b?.center ?? '',
    right: b?.right ?? '',
  });
  return { header: of(style?.header), footer: of(style?.footer) };
};

const sameBand = (a: ArticleBand | undefined, b: ArticleBand | undefined) =>
  (a?.left ?? '') === (b?.left ?? '') &&
  (a?.center ?? '') === (b?.center ?? '') &&
  (a?.right ?? '') === (b?.right ?? '');

const FIELD_HINT: Record<string, string> = {
  '{page}': "Put the page's number at the caret",
  '{pages}': "Put the article's page count at the caret",
  '{name}': "Put the document's name at the caret",
  '{date}': "Put today's date at the caret",
};

export function ArticleBandsSection({
  style,
  onChange,
  onPreview,
}: {
  style: ArticleStyle | undefined;
  onChange: (patch: Partial<ArticleStyle>) => void;
  onPreview: (style: ArticleStyle | null) => void;
}) {
  const [drafts, setDrafts] = useState<Drafts>(() => draftsOf(style));
  // The style as the boxes last took it: a change from elsewhere (an undo, a collaborator) refills
  // them, unless one is being typed in.
  const [seen, setSeen] = useState(style);
  // Whether a box is being typed in (a change from elsewhere then leaves the boxes alone).
  const [typing, setTyping] = useState(false);
  const last = useRef<{ band: Band; part: Part; input: HTMLInputElement } | null>(null);
  // Where the caret goes once a field put in has rendered (before the next key, so nothing typed after
  // the field lands ahead of it).
  const caretAfter = useRef<{ input: HTMLInputElement; at: number } | null>(null);
  useLayoutEffect(() => {
    const c = caretAfter.current;
    if (!c) return;
    caretAfter.current = null;
    c.input.focus();
    c.input.setSelectionRange(c.at, c.at);
  });
  if (style !== seen) {
    setSeen(style);
    if (!typing) setDrafts(draftsOf(style));
  }
  const bandOf = (d: Drafts, band: Band) => parseArticleBand(d[band]);
  const previewWith = (d: Drafts) =>
    onPreview({ ...style, header: bandOf(d, 'header'), footer: bandOf(d, 'footer') });
  const setPart = (band: Band, part: Part, value: string) => {
    const next = {
      ...drafts,
      [band]: { ...drafts[band], [part]: value.slice(0, ARTICLE_BAND_MAX) },
    };
    setDrafts(next);
    previewWith(next);
  };
  const commit = (band: Band) => {
    setTyping(false);
    const next = bandOf(drafts, band);
    onPreview(null);
    if (!sameBand(next, style?.[band])) onChange({ [band]: next });
  };
  const insertField = (token: string) => {
    const at = last.current;
    if (!at) return;
    const value = drafts[at.band][at.part];
    const from = at.input.selectionStart ?? value.length;
    const to = at.input.selectionEnd ?? from;
    const nextValue = `${value.slice(0, from)}${token}${value.slice(to)}`;
    setPart(at.band, at.part, nextValue);
    setTyping(true);
    caretAfter.current = { input: at.input, at: from + token.length };
  };
  const box = (band: Band) => (
    <div className="mt-1 grid grid-cols-3 gap-1.5">
      {PARTS.map(({ part, label }) => {
        const name = `${band === 'header' ? 'Header' : 'Footer'} ${label}`;
        return (
          <label key={part} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {label}
            </span>
            <input
              type="text"
              aria-label={name}
              data-band-field={`${band}-${part}`}
              value={drafts[band][part]}
              maxLength={ARTICLE_BAND_MAX}
              onFocus={(e) => {
                setTyping(true);
                last.current = { band, part, input: e.currentTarget };
              }}
              onChange={(e) => setPart(band, part, e.target.value)}
              onBlur={() => commit(band)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commit(band);
                  setTyping(true);
                }
              }}
              className="h-8 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        );
      })}
    </div>
  );
  return (
    <PanelSection title="Header and Footer">
      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Header</p>
      {box('header')}
      <p className="mt-3 text-[11px] font-semibold text-slate-700 dark:text-slate-200">Footer</p>
      {box('footer')}
      <div role="group" aria-label="Fields" className="mt-2 flex flex-wrap gap-1">
        {ARTICLE_BAND_FIELDS.map((f) => (
          <Tooltip key={f.token} label={FIELD_HINT[f.token] ?? f.label}>
            <button
              type="button"
              data-band-token={f.token}
              // Keeps the caret in the box last used.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insertField(f.token)}
              className="cursor-pointer rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
            >
              {f.label}
            </button>
          </Tooltip>
        ))}
      </div>
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
        Different First Page
        <Switch
          size="sm"
          checked={style?.differentFirstPage === true}
          label="Different First Page"
          onChange={(v) => onChange({ differentFirstPage: v ? true : undefined })}
        />
      </label>
    </PanelSection>
  );
}
