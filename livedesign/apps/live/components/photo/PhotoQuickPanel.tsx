'use client';

// The quick panel (docs/specs/031-photo/photo-pages.md "The quick panel"): while a tool with numbers to set is in
// hand, a slim card at the canvas's left edge holds its main ones (a brush's Size, Hardness, Opacity and Flow;
// a selection's Feather; the Magic Wand's Tolerance), always in reach without opening anything: the tool's glyph and
// name, the tip drawn for a tool with one, up to four quiet slider rows, and All Options opening the options flyout.
// It steps aside while that flyout is open (it holds the same settings), while a crop or transform is under way,
// and on a phone.
import { lucideSlidersHorizontal } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { setToolOption } from '@/lib/photo-editor/set-tool-option';
import { fieldsFor, type OptionField } from '@/lib/photo-editor/tool-option-fields';
import { toolFlyout, useToolFlyoutOpen } from '@/lib/photo-editor/tool-flyout';
import {
  optionsKey,
  TOOL_NAMES,
  usePhotoTools,
  type PhotoToolId,
} from '@/lib/photo-editor/tool-state';
import { useCropBox } from '@/lib/photo-editor/tools/crop-tool';
import { useFreeTransform } from '@/lib/photo-editor/tools/transform-tool';
import { SliderRow } from './flyout-controls';
import { TipPreview } from './slider-scale';
import { TOOL_ICONS } from './photo-icons';
import { sectionFields } from './PhotoToolOptionsBody';

const MoreIcon = lucideGlyph(lucideSlidersHorizontal, 14);

// The most numbers the panel holds.
export const QUICK_FIELDS = 4;

/** The tool's numbers the panel shows, in the flyout's section order (Tip first), up to QUICK_FIELDS. */
export function quickFields(tool: PhotoToolId): Extract<OptionField, { kind: 'slider' }>[] {
  return sectionFields(fieldsFor(tool, optionsKey(tool)), tool)
    .flatMap((s) => s.fields.map((f) => f.field))
    .filter((f): f is Extract<OptionField, { kind: 'slider' }> => f.kind === 'slider')
    .slice(0, QUICK_FIELDS);
}

export function PhotoQuickPanel({
  photo,
  top,
  left,
}: {
  photo: PhotoEditorView;
  top: number;
  left: number;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { tool, options } = usePhotoTools();
  const flyoutOpen = useToolFlyoutOpen();
  const transform = useFreeTransform();
  const crop = useCropBox();
  const ctx = photo.ctx;
  if (!tool || !ctx || flyoutOpen || transform || crop) return null;
  const fields = quickFields(tool);
  if (!fields.length) return null;
  const key = optionsKey(tool);
  const group = options[key] as unknown as Record<string, unknown>;
  const Icon = TOOL_ICONS[tool];
  const tip =
    typeof group.size === 'number' && typeof group.hardness === 'number' && tool !== 'text'
      ? { size: group.size, hardness: group.hardness }
      : null;
  return (
    <aside
      data-photo-quick=""
      aria-label={`${TOOL_NAMES[tool]} Quick Settings`}
      className="absolute z-[var(--z-panel)] flex w-[200px] animate-fade-in flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
      style={{ top, left }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 text-brand-700 ring-1 ring-brand-200/70 dark:from-brand-500/20 dark:to-brand-500/10 dark:text-brand-200 dark:ring-brand-500/30 [&_svg]:h-4 [&_svg]:w-4"
        >
          <Icon />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {TOOL_NAMES[tool]}
        </span>
        <Tooltip label="All Options">
          <button
            type="button"
            aria-label="All Options"
            onClick={() => toolFlyout.open()}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <MoreIcon />
          </button>
        </Tooltip>
      </div>
      {tip ? <TipPreview size={tip.size} hardness={tip.hardness} small /> : null}
      {fields.map((f) => (
        <SliderRow
          key={f.key}
          compact
          label={f.label}
          guide={f.key}
          value={typeof group[f.key] === 'number' ? (group[f.key] as number) : f.min}
          min={f.min}
          max={f.max}
          step={f.step ?? 1}
          unit={f.percent ? '%' : (f.unit ?? '')}
          scale={f.percent ? 100 : 1}
          onChange={(v) => setToolOption(ctx, photo.textEdit?.layerId ?? null, key, f.key, v)}
        />
      ))}
    </aside>
  );
}
