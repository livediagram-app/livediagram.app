'use client';

// The custom-theme builder (spec/44). Fast by default, deep on demand:
// it opens on three base colours (Background / Fill / Stroke) from which
// sane defaults for everything else are derived, then expands to the
// granular controls (text colour, pattern, per-shape colours). A live
// preview at the top renders the in-progress theme as a real mini
// diagram (the shared ThemeSwatch scene, with the actual pattern edge to
// edge) so the user sees the result as they build. A built-in format
// painter copies a colour from one box and pastes it into others.
// Shared by the Tab Appearance Theme tab and the Explorer Themes pane,
// so the two entry points can't drift. Purely a form: it owns a draft
// and hands the finished { name, definition } back via onSave.

import { useState } from 'react';
import {
  deriveTextColorForBg,
  isAnimatedPattern,
  isLightColor,
  shade,
  tint,
  type BackgroundPattern,
  type ShapeKind,
} from '@livediagram/diagram';
import type { CustomThemeDefinition } from '@livediagram/api-schema';
import { materialiseCustomTheme } from '@/lib/custom-theme-registry';
import { PATTERNS, PatternButton } from '@/components/palette/palette-controls';
import {
  ColorTile,
  ExpandRow,
  FieldLabel,
  type Painter,
} from '@/components/palette/custom-theme-builder-parts';
import {
  FALLBACK_FILL,
  FALLBACK_STROKE,
  FALLBACK_TEXT,
  PerShapeColoursSection,
} from './CustomThemeShapeColours';
import { BackBar } from '@/components/palette/ThemeCategoryBrowser';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';

export type CustomThemeDraft = { name: string; definition: CustomThemeDefinition };

// The pattern colour is derived from the BACKGROUND base colour (there's
// no separate control): a subtle darker shade on a light backdrop, a
// lighter tint on a dark one, so the grid / lines read against it without
// the user picking a colour.
function derivePatternColor(background: string): string {
  return isLightColor(background) ? shade(background, 0.16) : tint(background, 0.22);
}

// The format painter's clipboard: a copied colour the user can paste
// into any other colour box. Threaded to every ColorField.
export function CustomThemeBuilder({
  initial,
  seed,
  onSave,
  onCancel,
  saving,
  error,
  variant = 'inline',
}: {
  // Provided when EDITING an existing theme; omitted when creating.
  initial?: CustomThemeDraft;
  // Prefill values for a NEW theme (e.g. "Copy" of a built-in theme) —
  // seeds the draft but stays in create mode (Save creates a new theme).
  seed?: CustomThemeDraft;
  onSave: (draft: CustomThemeDraft) => void;
  onCancel: () => void;
  saving?: boolean;
  // Set when a save attempt failed (kept open so work isn't lost).
  error?: string | null;
  // 'inline' (default): rendered in place of the theme browse, so it gets
  // the shared BackBar to return. 'modal': hosted in its own dialog (the
  // Explorer Themes pane), which owns the header — so no BackBar here.
  variant?: 'inline' | 'modal';
}) {
  const isEdit = !!initial;
  const source = initial ?? seed;
  const [name, setName] = useState(source?.name ?? '');
  const [def, setDef] = useState<CustomThemeDefinition>(
    source?.definition ?? {
      backgroundColor: '#ffffff',
      backgroundPattern: 'grid',
      patternColor: derivePatternColor('#ffffff'),
      backgroundOpacity: 1,
      elementFill: FALLBACK_FILL,
      elementStroke: FALLBACK_STROKE,
      elementText: '#1e3a8a',
    },
  );
  // Seeded values (edit or copy) are deliberate, so don't auto-derive
  // the text colour over them. A blank new theme derives until touched.
  const [textTouched, setTextTouched] = useState(!!source);
  const [patternOpen, setPatternOpen] = useState(true);
  const [shapesOpen, setShapesOpen] = useState(false);
  // Format-painter clipboard.
  const [copied, setCopied] = useState<string | null>(null);
  const painter: Painter = {
    copied,
    copy: (value) => setCopied(value),
    clear: () => setCopied(null),
  };

  const patch = (p: Partial<CustomThemeDefinition>) => setDef((d) => ({ ...d, ...p }));

  // The background drives the (auto-derived) pattern colour — there's no
  // separate pattern-colour control.
  const setBackground = (background: string) =>
    patch({ backgroundColor: background, patternColor: derivePatternColor(background) });
  // Editing a base colour re-derives the not-yet-touched text colour so
  // a couple of clicks yield a coherent, readable theme.
  const setFill = (fill: string) =>
    patch({
      elementFill: fill,
      ...(textTouched ? {} : { elementText: deriveTextColorForBg(fill) }),
    });
  const setStroke = (stroke: string) => patch({ elementStroke: stroke });

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
      {/* Inline (in the theme browse): the shared BackBar returns. In a
          modal host (Explorer) the dialog owns the header, so no bar. */}
      {variant === 'inline' ? (
        <BackBar label="Back" current={isEdit ? 'Edit theme' : 'New theme'} onClick={onCancel} />
      ) : null}

      {/* Live preview — the in-progress theme as a real diagram scene,
          with the chosen pattern rendered edge to edge. */}
      <div className="relative">
        <ThemeSwatch theme={previewTheme} heightClass="h-24" realPattern />
        <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
          Illustration
        </span>
      </div>

      {/* Format-painter hint: visible while a colour is on the clipboard. */}
      {copied ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-100">
          <span
            className="h-4 w-4 shrink-0 rounded border border-black/10 dark:border-white/20"
            style={{ backgroundColor: copied }}
          />
          <span className="flex-1">Copied colour — click any box to paste it.</span>
          <button
            type="button"
            onClick={() => setCopied(null)}
            className="font-medium underline-offset-2 hover:underline"
          >
            Cancel
          </button>
        </div>
      ) : null}

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
        <div className="grid grid-cols-4 gap-2">
          <ColorTile
            label="Background"
            value={def.backgroundColor}
            onChange={setBackground}
            painter={painter}
          />
          <ColorTile
            label="Fill"
            value={def.elementFill ?? FALLBACK_FILL}
            onChange={setFill}
            painter={painter}
          />
          <ColorTile
            label="Stroke"
            value={def.elementStroke ?? FALLBACK_STROKE}
            onChange={setStroke}
            painter={painter}
          />
          <ColorTile
            label="Text"
            value={def.elementText ?? FALLBACK_TEXT}
            onChange={(c) => {
              setTextTouched(true);
              patch({ elementText: c });
            }}
            painter={painter}
          />
        </div>
      </div>

      <ExpandRow label="Pattern" open={patternOpen} onToggle={() => setPatternOpen((o) => !o)}>
        <p className="mb-2 text-[11px] leading-snug text-slate-500 dark:text-slate-300">
          The pattern tints automatically from your background colour.
        </p>
        <FieldLabel className="mb-1">Style</FieldLabel>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {PATTERNS.filter((p) => !isAnimatedPattern(p.id)).map((p) => (
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
        <FieldLabel className="mb-1 mt-3">Animated</FieldLabel>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {PATTERNS.filter((p) => isAnimatedPattern(p.id)).map((p) => (
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
        {/* Pattern opacity — fades the pattern over the backdrop, mirroring
            the canvas Opacity slider (it writes the theme's backgroundOpacity,
            applied to the tab when the theme is picked). */}
        <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <FieldLabel>Opacity</FieldLabel>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
              {Math.round((def.backgroundOpacity ?? 1) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={def.backgroundOpacity ?? 1}
            onChange={(e) => patch({ backgroundOpacity: parseFloat(e.target.value) })}
            aria-label="Pattern opacity"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
          />
        </div>
      </ExpandRow>

      {/* Per-shape overrides (like UML) — see CustomThemeShapeColours. */}
      <PerShapeColoursSection
        def={def}
        painter={painter}
        open={shapesOpen}
        onToggle={() => setShapesOpen((o) => !o)}
        setShapeColour={setShapeColour}
        clearShape={clearShape}
      />

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200">
          {error}
        </p>
      ) : null}

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
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save theme'}
        </button>
      </div>
    </div>
  );
}
