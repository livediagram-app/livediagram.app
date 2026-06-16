'use client';

// The custom-theme builder (spec/44). Fast by default, deep on demand:
// it opens on three base colours (Background / Fill / Stroke) from which
// sane defaults for everything else are derived, then expands to the
// granular controls (text colour, pattern, per-shape colours). A live
// preview at the top renders the in-progress theme as a real mini
// diagram (the shared ThemeSwatch scene) so the user sees the result as
// they build. Shared by the Tab Appearance Theme tab and the Explorer
// Themes pane, so the two entry points can't drift. Purely a form: it
// owns a draft and hands the finished { name, definition } back via
// onSave.

import { useState } from 'react';
import {
  deriveTextColorForBg,
  elementKindLabel,
  tint,
  type BackgroundPattern,
  type ShapeKind,
} from '@livediagram/diagram';
import type { CustomThemeDefinition } from '@livediagram/api-schema';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { hexish, PATTERNS, PatternButton } from './palette-controls';
import { ShapeIcon } from './shape-icon';
import { ThemeSwatch } from './ThemeSwatch';

// The shape kinds offered in the per-shape editor: the flowchart /
// diagram vocabulary where a per-kind colour is meaningful. Device
// frames, the icon glyph, the frame container and the actor figure are
// left out (their colour is intrinsic or not a fill/stroke box).
const PER_SHAPE_KINDS: ShapeKind[] = [
  'square',
  'circle',
  'diamond',
  'stadium',
  'parallelogram',
  'hexagon',
  'document',
  'triangle',
  'trapezoid',
  'cylinder',
  'cloud',
  'star',
];

export type CustomThemeDraft = { name: string; definition: CustomThemeDefinition };

const FALLBACK_FILL = '#dbeafe';
const FALLBACK_STROKE = '#2563eb';
const FALLBACK_TEXT = '#0f172a';

function resolved(
  def: CustomThemeDefinition,
  kind: ShapeKind,
): { fill: string; stroke: string; text: string } {
  const o = def.shapeColors?.[kind];
  return {
    fill: o?.fill ?? def.elementFill ?? FALLBACK_FILL,
    stroke: o?.stroke ?? def.elementStroke ?? FALLBACK_STROKE,
    text: o?.text ?? def.elementText ?? FALLBACK_TEXT,
  };
}

export function CustomThemeBuilder({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  // Provided when editing an existing theme; omitted when creating.
  initial?: CustomThemeDraft;
  onSave: (draft: CustomThemeDraft) => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [def, setDef] = useState<CustomThemeDefinition>(
    initial?.definition ?? {
      backgroundColor: '#ffffff',
      backgroundPattern: 'grid',
      patternColor: '#cbd5e1',
      elementFill: FALLBACK_FILL,
      elementStroke: FALLBACK_STROKE,
      elementText: '#1e3a8a',
    },
  );
  // When editing, the text + pattern colours are already deliberate, so
  // don't auto-derive over them. When creating, derive until touched.
  const [textTouched, setTextTouched] = useState(!!initial);
  const [patternColorTouched, setPatternColorTouched] = useState(!!initial);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [shapesOpen, setShapesOpen] = useState(false);

  const patch = (p: Partial<CustomThemeDefinition>) => setDef((d) => ({ ...d, ...p }));

  // Editing a base colour re-derives the not-yet-touched dependents so
  // three clicks yield a coherent theme.
  const setFill = (fill: string) =>
    patch({
      elementFill: fill,
      ...(textTouched ? {} : { elementText: deriveTextColorForBg(fill) }),
    });
  const setStroke = (stroke: string) =>
    patch({
      elementStroke: stroke,
      ...(patternColorTouched ? {} : { patternColor: tint(stroke, 0.6) }),
    });

  // Per-shape override write: an unset (empty) value clears that channel
  // so the kind falls back to the base element colour.
  const setShapeColour = (kind: ShapeKind, channel: 'fill' | 'stroke' | 'text', value: string) =>
    setDef((d) => {
      const next = { ...(d.shapeColors ?? {}) };
      next[kind] = { ...next[kind], [channel]: value };
      return { ...d, shapeColors: next };
    });
  const clearShape = (kind: ShapeKind) =>
    setDef((d) => {
      if (!d.shapeColors?.[kind]) return d;
      const next = { ...d.shapeColors };
      delete next[kind];
      return { ...d, shapeColors: Object.keys(next).length ? next : undefined };
    });

  const customCount = def.shapeColors ? Object.keys(def.shapeColors).length : 0;
  // Materialise the draft so the live preview reuses the exact ThemeSwatch
  // scene the picker cards show.
  const previewTheme = materialiseCustomTheme({
    id: 'custom:preview',
    ownerId: '',
    name: name || 'Preview',
    definition: def,
    createdAt: 0,
    updatedAt: 0,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path
              d="M7.5 2.5 4 6l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {initial ? 'Edit theme' : 'New theme'}
        </span>
      </div>

      {/* Live preview — the in-progress theme as a real diagram scene. */}
      <ThemeSwatch theme={previewTheme} heightClass="h-24" />

      <label className="flex flex-col gap-1">
        <FieldLabel>Name</FieldLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My theme"
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>

      {/* Three base colours — the fast path. Larger tiles so the colour
          (the whole point) reads at a glance. */}
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Base colours</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          <ColorTile
            label="Background"
            value={def.backgroundColor}
            onChange={(c) => patch({ backgroundColor: c })}
          />
          <ColorTile label="Fill" value={def.elementFill ?? FALLBACK_FILL} onChange={setFill} />
          <ColorTile
            label="Stroke"
            value={def.elementStroke ?? FALLBACK_STROKE}
            onChange={setStroke}
          />
        </div>
      </div>

      <ExpandRow
        label="Customize details"
        open={detailsOpen}
        onToggle={() => setDetailsOpen((o) => !o)}
      >
        <div className="grid grid-cols-2 gap-2">
          <ColorTile
            label="Text"
            value={def.elementText ?? FALLBACK_TEXT}
            onChange={(c) => {
              setTextTouched(true);
              patch({ elementText: c });
            }}
          />
          <ColorTile
            label="Pattern colour"
            value={def.patternColor}
            onChange={(c) => {
              setPatternColorTouched(true);
              patch({ patternColor: c });
            }}
          />
        </div>
        <FieldLabel className="mb-1 mt-3">Pattern</FieldLabel>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {PATTERNS.map((p) => (
            <PatternButton
              key={p.id}
              active={def.backgroundPattern === p.id}
              onClick={() => patch({ backgroundPattern: p.id as BackgroundPattern })}
              label={p.shortLabel}
            >
              <p.icon />
            </PatternButton>
          ))}
        </div>
      </ExpandRow>

      <ExpandRow
        label="Per-shape colours"
        badge={customCount > 0 ? String(customCount) : undefined}
        open={shapesOpen}
        onToggle={() => setShapesOpen((o) => !o)}
      >
        <p className="mb-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          Give a shape kind its own colours (like UML). Leave a kind unset to use the base colours.
        </p>
        {/* Column headers so the three swatches per row are legible. */}
        <div className="mb-1 flex items-center gap-2 pl-[6.5rem] text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <span className="w-6 text-center">Fill</span>
          <span className="w-6 text-center">Line</span>
          <span className="w-6 text-center">Text</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {PER_SHAPE_KINDS.map((kind) => {
            const o = def.shapeColors?.[kind];
            const r = resolved(def, kind);
            return (
              <div key={kind} className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded border"
                  style={{ backgroundColor: r.fill, borderColor: r.stroke, color: r.stroke }}
                >
                  <ShapeIcon kind={kind} />
                </span>
                <span className="w-[4.5rem] shrink-0 truncate text-xs text-slate-600 dark:text-slate-300">
                  {elementKindLabel({ type: 'shape', shape: kind } as Parameters<
                    typeof elementKindLabel
                  >[0])}
                </span>
                <ShapeColorDot
                  label={`${kind} fill`}
                  value={r.fill}
                  onChange={(v) => setShapeColour(kind, 'fill', v)}
                />
                <ShapeColorDot
                  label={`${kind} stroke`}
                  value={r.stroke}
                  onChange={(v) => setShapeColour(kind, 'stroke', v)}
                />
                <ShapeColorDot
                  label={`${kind} text`}
                  value={r.text}
                  onChange={(v) => setShapeColour(kind, 'text', v)}
                />
                <button
                  type="button"
                  onClick={() => clearShape(kind)}
                  disabled={!o}
                  className="ml-auto text-[10px] font-medium text-slate-400 underline-offset-2 transition hover:text-slate-600 hover:underline disabled:invisible dark:text-slate-500 dark:hover:text-slate-300"
                >
                  reset
                </button>
              </div>
            );
          })}
        </div>
      </ExpandRow>

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave({ name: name.trim() || 'My theme', definition: def })}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
        >
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Save theme'}
        </button>
      </div>
    </div>
  );
}

function FieldLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </span>
  );
}

// A base-colour tile: a large colour block (the whole point) with a
// label beneath, the native colour input layered invisibly on top.
function ColorTile({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60">
      <span
        className="relative block h-9 w-full overflow-hidden rounded-md border border-black/5 dark:border-white/10"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={hexish(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>
      <span className="text-center text-[11px] font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </label>
  );
}

// A compact per-shape colour input: a small colour square with the
// native picker layered on top.
function ShapeColorDot({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <span
      className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-slate-300 dark:border-slate-600"
      style={{ backgroundColor: value }}
    >
      <input
        type="color"
        aria-label={label}
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}

function ExpandRow({
  label,
  badge,
  open,
  onToggle,
  children,
}: {
  label: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-2.5 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-2">
          {label}
          {badge ? (
            <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200">
              {badge}
            </span>
          ) : null}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden
          className={open ? 'rotate-180 transition' : 'transition'}
        >
          <path
            d="M3 4.5 6 7.5 9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? <div className="px-2.5 pb-2.5 pt-1">{children}</div> : null}
    </div>
  );
}
