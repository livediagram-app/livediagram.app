'use client';

// An article page's Style tab (docs/specs/007-editor/article-pages.md "Article style"): the looks
// to start from, then each field on its own. Every choice is one edit to the article's style,
// shared by all its pages; hovering a look or a choice previews it on the writing.
import type { ReactNode } from 'react';
import {
  ARTICLE_LOOK_IDS,
  ARTICLE_LOOKS,
  FONTS,
  resolveArticleStyle,
  resolveFontStack,
  type ArticleLookId,
  type ArticleStyle,
} from '@livediagram/document';
import { ACTIVE_SEGMENT, CheckIcon, SEGMENT_TRACK, Select, Tooltip } from '@livediagram/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import { PanelSection } from '../illustrate-page-panel-sections';

// The accents an article can take besides its theme's (docs/specs/007-editor/article-pages.md
// "Article style").
export const ARTICLE_ACCENTS: readonly { label: string; value: string }[] = [
  { label: 'Blue', value: '#2563eb' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Amber', value: '#b45309' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Slate', value: '#334155' },
];

export type ArticleStyleChange = { look: ArticleLookId } | { patch: Partial<ArticleStyle> };

export function ArticleStyleSection({
  part,
  style,
  themeAccent,
  onChange,
  onPreview,
}: {
  // Which of the panel's two article tabs: Style (looks, accent, the page), or Text (fonts, size,
  // spacing, lines under the text).
  part: 'style' | 'text';
  style: ArticleStyle | undefined;
  themeAccent: string;
  onChange: (change: ArticleStyleChange) => void;
  // A style to show on the writing while a choice is hovered; null puts it back.
  onPreview: (style: ArticleStyle | null) => void;
}) {
  const r = resolveArticleStyle(style);
  const accent = r.accent ?? themeAccent;
  const preview = (patch: Partial<ArticleStyle>) => onPreview({ ...style, ...patch });
  return (
    <div onPointerLeave={() => onPreview(null)}>
      {part === 'style' ? (
        <>
          <PanelSection title="Looks">
            <div role="radiogroup" aria-label="Article look" className="grid grid-cols-5 gap-1.5">
              {ARTICLE_LOOK_IDS.map((id) => (
                <LookCard
                  key={id}
                  id={id}
                  accent={accent}
                  selected={style?.look === id}
                  onPick={() => onChange({ look: id })}
                  onHover={() => onPreview({ ...style, look: id, ...lookFields(id) })}
                />
              ))}
            </div>
          </PanelSection>
          <PanelSection title="Accent">
            <div
              role="radiogroup"
              aria-label="Accent colour"
              className="flex flex-wrap items-center gap-1.5"
            >
              <Swatch
                label="Theme"
                color={themeAccent}
                selected={!style?.accent}
                onPick={() => onChange({ patch: { accent: undefined } })}
                onHover={() => preview({ accent: undefined })}
                ring
              />
              {ARTICLE_ACCENTS.map((a) => (
                <Swatch
                  key={a.value}
                  label={a.label}
                  color={a.value}
                  selected={style?.accent?.toLowerCase() === a.value}
                  onPick={() => onChange({ patch: { accent: a.value } })}
                  onHover={() => preview({ accent: a.value })}
                />
              ))}
            </div>
            <Toggle
              label="Headings in the Accent"
              on={r.accentHeadings}
              onChange={(v) => onChange({ patch: { accentHeadings: v } })}
            />
          </PanelSection>
          <PanelSection title="Page">
            <Segmented
              label="Margins"
              value={r.margins}
              options={[
                ['narrow', 'Narrow'],
                ['normal', 'Normal'],
                ['wide', 'Wide'],
              ]}
              onChange={(v) => onChange({ patch: { margins: v } })}
              onHover={(v) => preview({ margins: v })}
            />
            <Toggle
              label="Page Numbers"
              on={r.pageNumbers}
              onChange={(v) => onChange({ patch: { pageNumbers: v } })}
            />
          </PanelSection>
        </>
      ) : (
        <>
          <PanelSection title="Fonts">
            <div className="grid grid-cols-2 gap-2">
              <FontSelect
                label="Headings"
                value={r.headingFont}
                onChange={(f) => onChange({ patch: { headingFont: f } })}
              />
              <FontSelect
                label="Body"
                value={r.bodyFont}
                onChange={(f) => onChange({ patch: { bodyFont: f } })}
              />
            </div>
          </PanelSection>
          <PanelSection title="Size and Spacing">
            <Segmented
              label="Text Size"
              value={r.textSize}
              options={[
                ['small', 'Small'],
                ['normal', 'Normal'],
                ['large', 'Large'],
              ]}
              onChange={(v) => onChange({ patch: { textSize: v } })}
              onHover={(v) => preview({ textSize: v })}
            />
            <Segmented
              label="Line Spacing"
              value={r.lineSpacing}
              options={[
                ['single', 'Single'],
                ['onehalf', '1.5'],
                ['double', 'Double'],
              ]}
              onChange={(v) => onChange({ patch: { lineSpacing: v } })}
              onHover={(v) => preview({ lineSpacing: v })}
            />
            <Segmented
              label="Paragraph Spacing"
              value={r.paragraphSpacing}
              options={[
                ['none', 'None'],
                ['normal', 'Normal'],
                ['wide', 'Wide'],
              ]}
              onChange={(v) => onChange({ patch: { paragraphSpacing: v } })}
              onHover={(v) => preview({ paragraphSpacing: v })}
            />
            <Segmented
              label="Lines Under Text"
              value={r.rules}
              options={[
                ['none', 'None'],
                ['title', 'Title'],
                ['headings', 'Headings'],
              ]}
              onChange={(v) => onChange({ patch: { rules: v } })}
              onHover={(v) => preview({ rules: v })}
            />
          </PanelSection>
        </>
      )}
    </div>
  );
}

const lookFields = (id: ArticleLookId): ArticleStyle => {
  const { label: _l, ruled: _r, ...fields } = ARTICLE_LOOKS[id];
  void _l;
  void _r;
  return fields;
};

// A look as a miniature page: its heading face and colour over lines of body text, a rule where it
// has one, lined paper for Notebook.
function LookCard({
  id,
  accent,
  selected,
  onPick,
  onHover,
}: {
  id: ArticleLookId;
  accent: string;
  selected: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const look = ARTICLE_LOOKS[id];
  const ink = '#1e293b';
  const heading = look.accentHeadings ? accent : ink;
  return (
    <Tooltip label={look.label}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={look.label}
        onClick={onPick}
        onPointerEnter={onHover}
        onFocus={onHover}
        className={`relative flex flex-col items-stretch overflow-hidden rounded-md bg-white px-1.5 pb-1.5 pt-1 text-left shadow-sm ring-1 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-600 motion-reduce:hover:translate-y-0 dark:bg-slate-100 ${
          selected ? 'ring-2 ring-brand-500' : 'ring-slate-900/10'
        }`}
        style={
          look.ruled
            ? {
                backgroundImage:
                  'linear-gradient(transparent calc(100% - 1px), rgb(15 23 42 / 0.12) calc(100% - 1px))',
                backgroundSize: '100% 6px',
              }
            : undefined
        }
      >
        <span
          className="block truncate text-[11px] leading-tight"
          style={{
            fontFamily: resolveFontStack(look.headingFont),
            fontWeight: 700,
            color: heading,
            borderBottom: look.rules !== 'none' ? `1px solid ${accent}` : undefined,
          }}
        >
          Aa
        </span>
        {[90, 70, 85].map((w, i) => (
          <span
            key={i}
            className="mt-1 block h-[2px] rounded-full bg-slate-300"
            style={{ width: `${w}%` }}
          />
        ))}
        <span className="mt-1 block text-[9px] font-medium text-slate-500">{look.label}</span>
        {selected ? (
          <span className="absolute right-0.5 top-0.5 text-brand-600 dark:text-brand-600">
            <CheckIcon className="h-3 w-3" />
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

function FontSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (font: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
      {label}
      <Select
        aria-label={`${label} font`}
        size="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {FONTS.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Swatch({
  label,
  color,
  selected,
  onPick,
  onHover,
  ring,
}: {
  label: string;
  color: string;
  selected: boolean;
  onPick: () => void;
  onHover: () => void;
  ring?: boolean;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-label={label}
        onClick={onPick}
        onPointerEnter={onHover}
        onFocus={onHover}
        className={`relative flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-slate-900/10 transition hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 motion-reduce:hover:scale-100 dark:ring-white/15 ${
          selected ? 'outline-2 outline-offset-2 outline-brand-500' : ''
        }`}
        style={{ background: color }}
      >
        {ring ? (
          <span className="text-[9px] font-bold text-white" aria-hidden>
            T
          </span>
        ) : null}
      </button>
    </Tooltip>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="mt-2 flex cursor-pointer items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
      {label}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
          on ? 'bg-brand-600 dark:bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] motion-reduce:transition-none ${
            on ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  onHover,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  onHover: (v: T) => void;
}): ReactNode {
  return (
    <div className="mt-2 first:mt-0">
      <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={`relative grid rounded-lg p-0.5 ${SEGMENT_TRACK}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <SegmentSlider
          count={options.length}
          index={options.findIndex(([id]) => id === value)}
          className={ACTIVE_SEGMENT}
        />
        {options.map(([id, text]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            onClick={() => onChange(id)}
            onPointerEnter={() => onHover(id)}
            className={`relative z-10 rounded-md py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
              value === id
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
