'use client';

// The options flyout's body (docs/specs/031-photo/photo-pages.md "The options flyout"): the tool in hand's options in
// their sections (option-guides OPTION_SECTIONS), each laid out in place (flyout-controls): a tip's Size and Hardness
// with the tip drawn over them, a short choice as tiles, a long one as a row opening its popover, the on and off
// options as switches. After them the tool's own: brush presets, the Move tool's Align, the Crop tool's actions. While
// a Free Transform is open it is the box's numbers, mode, interpolation, flips, and Cancel and Commit.
import {
  lucideAlignCenterHorizontal,
  lucideAlignCenterVertical,
  lucideAlignEndHorizontal,
  lucideAlignEndVertical,
  lucideAlignStartHorizontal,
  lucideAlignStartVertical,
} from '@livedesign/icons/lucide';
import { Button, lucideGlyph, Tooltip } from '@livedesign/ui';
import type { Gradient } from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { track } from '@/lib/telemetry';
import { setToolOption } from '@/lib/photo-editor/set-tool-option';
import {
  fieldsFor,
  SELECT_MODES,
  SELECTING,
  type OptionField,
} from '@/lib/photo-editor/tool-option-fields';
import {
  groupOf,
  optionsKey,
  photoTools,
  usePhotoTools,
  type PhotoToolId,
} from '@/lib/photo-editor/tool-state';
import { OPTION_SECTIONS } from '@/lib/photo-editor/option-guides';
import { PhotoToolPicker as ToolPicker } from './PhotoToolPicker';
import { alignLayers, type AlignHow } from '@/lib/photo-editor/tools/move-tool';
import {
  beginCrop,
  cancelCrop,
  commitCrop,
  setStraighten,
  useCropBox,
} from '@/lib/photo-editor/tools/crop-tool';
import {
  ControlRow,
  FlyoutSection,
  SliderRow,
  SwitchRow,
  TileChoice,
  type Pointed,
} from './flyout-controls';
import { OptionChoicePopover } from './OptionPopover';
import { TipPreview } from './slider-scale';
import { BrushPresetGrid } from './PhotoBrushPresets';
import { PhotoGradientField } from './PhotoGradientField';

const icon = (g: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(g, 15);

const ALIGNS: readonly { how: AlignHow; label: string; Icon: ReturnType<typeof lucideGlyph> }[] = [
  { how: 'left', label: 'Align Left', Icon: icon(lucideAlignStartVertical) },
  { how: 'centre', label: 'Align Centres', Icon: icon(lucideAlignCenterVertical) },
  { how: 'right', label: 'Align Right', Icon: icon(lucideAlignEndVertical) },
  { how: 'top', label: 'Align Top', Icon: icon(lucideAlignStartHorizontal) },
  { how: 'middle', label: 'Align Middles', Icon: icon(lucideAlignCenterHorizontal) },
  { how: 'bottom', label: 'Align Bottom', Icon: icon(lucideAlignEndHorizontal) },
];

// The keys a selection mode answers to while a selection tool is in hand.
const SELECTION_KEYS: Readonly<Record<string, string>> = {
  add: 'Shift',
  subtract: 'Alt',
  intersect: 'Shift Alt',
};

// A choice this long, or the blend modes and fonts, opens its popover instead of laying its tiles out in place.
const TILES_UP_TO = 4;

const SECONDARY =
  'flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800';

/** The guide key an option is described and drawn by: the gradient's Style is not a marquee's. */
function guideOf(field: OptionField): string {
  return field.kind === 'choice' &&
    field.key === 'style' &&
    field.choices.some((c) => c.value === 'linear')
    ? 'gradientStyle'
    : field.key;
}

type Shown = { field: OptionField; guide: string };

/** A tool's fields in their sections, in the sections' order; on and off options with no section last. The Text
 *  tool's are all its type's look, under Type. */
export function sectionFields(
  fields: readonly OptionField[],
  tool?: PhotoToolId,
): { title: string; fields: Shown[] }[] {
  if (tool === 'text')
    return [{ title: 'Type', fields: fields.map((field) => ({ field, guide: guideOf(field) })) }];
  const out: { title: string; fields: Shown[] }[] = [];
  const add = (title: string, s: Shown) => {
    const at = out.find((o) => o.title === title);
    if (at) at.fields.push(s);
    else out.push({ title, fields: [s] });
  };
  const placed = new Set<OptionField>();
  for (const section of OPTION_SECTIONS)
    for (const key of section.keys)
      for (const field of fields)
        if (!placed.has(field) && guideOf(field) === key) {
          placed.add(field);
          add(section.title, { field, guide: key });
        }
  for (const field of fields)
    if (!placed.has(field))
      add(field.kind === 'toggle' ? 'Behaviour' : 'Options', { field, guide: guideOf(field) });
  return out;
}

function FieldControl({
  shown: { field, guide },
  value,
  onChange,
  onPoint,
}: {
  shown: Shown;
  value: unknown;
  onChange: (v: unknown) => void;
  onPoint: (p: Pointed) => void;
}) {
  if (field.kind === 'toggle')
    return (
      <SwitchRow
        label={field.label}
        guide={guide}
        on={value === true}
        onChange={onChange}
        onPoint={onPoint}
      />
    );
  if (field.kind === 'gradient')
    return (
      <ControlRow label={field.label} guide={guide} onPoint={onPoint}>
        <PhotoGradientField label={field.label} value={value as Gradient} onChange={onChange} />
      </ControlRow>
    );
  if (field.kind === 'choice') {
    const inPlace = field.choices.length <= TILES_UP_TO && guide !== 'mode' && guide !== 'font';
    if (inPlace || guide === 'gradientStyle' || guide === 'ratio')
      return (
        <TileChoice
          label={field.label}
          guide={guide}
          value={value as string | number}
          choices={field.choices}
          onChange={onChange}
          onPoint={onPoint}
        />
      );
    return (
      <ControlRow label={field.label} guide={guide} onPoint={onPoint}>
        <OptionChoicePopover
          label={field.label}
          guide={guide}
          value={value as string | number}
          choices={field.choices}
          inRow
          onChange={onChange}
        />
      </ControlRow>
    );
  }
  return (
    <SliderRow
      label={field.label}
      guide={guide}
      value={typeof value === 'number' ? value : field.min}
      min={field.min}
      max={field.max}
      step={field.step ?? 1}
      unit={field.percent ? '%' : (field.unit ?? '')}
      scale={field.percent ? 100 : 1}
      onChange={onChange}
      onPoint={onPoint}
    />
  );
}

export function PhotoToolOptionsBody({
  photo,
  tool,
  onPoint,
}: {
  photo: PhotoEditorView;
  tool: PhotoToolId;
  onPoint: (p: Pointed) => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { options } = usePhotoTools();
  const crop = useCropBox();
  const ctx = photo.ctx;
  if (!ctx) return null;
  const key = optionsKey(tool);
  const group = options[key] as unknown as Record<string, unknown>;
  const set = (field: string, value: unknown) =>
    setToolOption(ctx, photo.textEdit?.layerId ?? null, key, field, value);
  const sections = sectionFields(fieldsFor(tool, key), tool);
  // A selection tool's four modes lead its Selection section.
  if (SELECTING.has(tool)) {
    const sel = sections.find((s) => s.title === 'Selection');
    if (sel) sel.fields.unshift({ field: MODE_FIELD, guide: 'selection' });
    else
      sections.unshift({ title: 'Selection', fields: [{ field: MODE_FIELD, guide: 'selection' }] });
  }
  const tip =
    typeof group.size === 'number' && typeof group.hardness === 'number'
      ? { size: group.size, hardness: group.hardness }
      : null;
  const brushTip =
    tip && typeof group.flow === 'number' && typeof group.spacing === 'number'
      ? { ...tip, flow: group.flow, spacing: group.spacing }
      : null;
  const toolGroup = groupOf(tool);
  return (
    <>
      {toolGroup.tools.length > 1 ? (
        <FlyoutSection title="Tool">
          <ToolPicker tools={toolGroup.tools} tool={tool} onPoint={onPoint} />
        </FlyoutSection>
      ) : null}
      {sections.map((section) => (
        <FlyoutSection key={section.title} title={section.title}>
          {section.title === 'Tip' && tip ? (
            <TipPreview size={tip.size} hardness={tip.hardness} />
          ) : null}
          {section.fields.map((s) =>
            s.guide === 'selection' ? (
              <TileChoice
                key="selection"
                label="Selection"
                guide="selection"
                named={false}
                value={options.select.mode}
                choices={SELECT_MODES}
                keys={SELECTION_KEYS}
                onChange={(m) => photoTools.setOptions('select', { mode: m })}
                onPoint={onPoint}
              />
            ) : (
              <FieldControl
                key={s.field.key}
                shown={s}
                value={group[s.field.key]}
                onChange={(v) => set(s.field.key, v)}
                onPoint={onPoint}
              />
            ),
          )}
        </FlyoutSection>
      ))}
      {brushTip ? (
        <FlyoutSection title="Presets">
          <BrushPresetGrid tip={brushTip} onTake={(t) => photoTools.setOptions(key, t)} />
        </FlyoutSection>
      ) : null}
      {tool === 'move' ? (
        <FlyoutSection title="Align">
          <div role="group" aria-label="Align" className="grid grid-cols-6 gap-1">
            {ALIGNS.map(({ how, label, Icon }) => (
              <Tooltip key={how} label={label}>
                <button
                  type="button"
                  aria-label={label}
                  className="flex h-9 items-center justify-center rounded-lg text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800"
                  onClick={() => {
                    const refused = alignLayers(ctx.session, how);
                    if (refused) photo.toast(refused);
                    else track('Element', 'Changed', 'PhotoLayerAligned');
                  }}
                >
                  <Icon />
                </button>
              </Tooltip>
            ))}
          </div>
        </FlyoutSection>
      ) : null}
      {tool === 'crop' ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={SECONDARY}
            aria-pressed={crop?.straighten === true}
            onClick={() => setStraighten(ctx, !(crop?.straighten ?? false))}
          >
            Straighten
          </button>
          {crop ? (
            <>
              <span className="flex-1" />
              <button type="button" className={SECONDARY} onClick={() => cancelCrop(ctx)}>
                Cancel
              </button>
              <Button size="sm" onClick={() => commitCrop(ctx)}>
                Crop
              </Button>
            </>
          ) : (
            <button type="button" className={SECONDARY} onClick={() => beginCrop(ctx)}>
              Show Crop Box
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

// The selection modes as a field, for its place in the Selection section.
const MODE_FIELD: OptionField = {
  kind: 'choice',
  key: 'selection',
  label: 'Selection',
  choices: SELECT_MODES,
};
