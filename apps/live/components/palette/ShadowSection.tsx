'use client';

// The element context menu's Shadow accordion (spec/86): preset tiles
// (None / Soft / Drop / Lifted / Hard) with the shared hover-preview /
// click-commit flow, plus Offset X / Y, Blur and Opacity sliders on the
// debounced one-undo-step-per-gesture policy (mirroring the Opacity
// slider). Shared by the single-element menu (ElementColourBorderSections)
// and the multi-select Style flyout (MultiStyleSections), so both surfaces
// stay pixel-identical.

import {
  DEFAULT_SHADOW,
  SHADOW_LIMITS,
  SHADOW_PRESETS,
  shadowBoxCss,
  type ElementShadow,
} from '@livediagram/diagram';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import { BorderGrid } from '@/components/palette/context-menu-rows';
import { ShadowMenuGlyph } from '@/components/palette/context-menu-icons';

// A preset tile's swatch: a small rounded chip carrying the preset's own
// shadow at half scale (opacity boosted so the effect reads at 16px).
// `null` renders the bare chip — the None tile.
function ShadowPresetSwatch({ shadow }: { shadow: ElementShadow | null }) {
  const scaled = shadow
    ? {
        offsetX: shadow.offsetX / 2,
        offsetY: shadow.offsetY / 2,
        blur: shadow.blur / 2,
        opacity: Math.min(1, shadow.opacity * 2),
      }
    : null;
  return (
    <span className="flex h-7 w-full items-center justify-center">
      <span
        className="block h-4 w-4 rounded border border-slate-300 bg-white dark:border-slate-400 dark:bg-slate-200"
        style={scaled ? { boxShadow: shadowBoxCss(scaled) } : undefined}
      />
    </span>
  );
}

// A labelled slider row, visually matching PercentSliderRow but with an
// arbitrary numeric range + unit (the shadow axes are px, not %). Non-
// closing like the Opacity row: dragging stays inside the menu.
function ShadowSliderRow({
  label,
  min,
  max,
  value,
  unit,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="px-3 py-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
        <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
          {value}
          {unit}
        </span>
      </div>
    </div>
  );
}

const sameShadow = (a: ElementShadow, b: ElementShadow) =>
  a.offsetX === b.offsetX &&
  a.offsetY === b.offsetY &&
  a.blur === b.blur &&
  a.opacity === b.opacity;

export function ShadowSection({
  shadow,
  section,
  onSetShadow,
  onCommitPreset,
  onPreviewPreset,
  onPreviewEnd,
}: {
  // The (primary) selected element's shadow; undefined = none set.
  shadow: ElementShadow | undefined;
  // The host scaffold's accordion state, spread into MenuAccordionSection.
  section: { open: boolean; onToggle: () => void; flush?: boolean };
  // Debounced slider setter (one undo step per gesture, like Opacity).
  onSetShadow: (shadow: ElementShadow | null) => void;
  // Preset tiles: hover-preview / click-commit (shared useStylePreview flow).
  onCommitPreset: (shadow: ElementShadow | null) => void;
  onPreviewPreset: (shadow: ElementShadow | null) => void;
  onPreviewEnd: () => void;
}) {
  // Sliders display DEFAULT_SHADOW at rest and seed from it on the first
  // drag (spec/86), so dragging any single axis yields a visible shadow.
  const current = shadow ?? DEFAULT_SHADOW;
  const patch = (field: keyof ElementShadow) => (v: number) =>
    onSetShadow({ ...current, [field]: v });
  return (
    <MenuAccordionSection title="Shadow" icon={<ShadowMenuGlyph />} {...section}>
      <div className="px-2 py-1">
        <BorderGrid label="Presets" cols={5}>
          <SizeButton
            active={shadow === undefined}
            title="None"
            onClick={() => onCommitPreset(null)}
            onPointerEnter={onMouseHover(() => onPreviewPreset(null))}
            onPointerLeave={onMouseHover(onPreviewEnd)}
          >
            <ShadowPresetSwatch shadow={null} />
          </SizeButton>
          {SHADOW_PRESETS.map((p) => (
            <SizeButton
              key={p.id}
              active={shadow !== undefined && sameShadow(shadow, p.shadow)}
              title={p.label}
              onClick={() => onCommitPreset(p.shadow)}
              onPointerEnter={onMouseHover(() => onPreviewPreset(p.shadow))}
              onPointerLeave={onMouseHover(onPreviewEnd)}
            >
              <ShadowPresetSwatch shadow={p.shadow} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      <ShadowSliderRow
        label="Offset X"
        min={-SHADOW_LIMITS.offset}
        max={SHADOW_LIMITS.offset}
        value={current.offsetX}
        unit="px"
        onChange={patch('offsetX')}
      />
      <ShadowSliderRow
        label="Offset Y"
        min={-SHADOW_LIMITS.offset}
        max={SHADOW_LIMITS.offset}
        value={current.offsetY}
        unit="px"
        onChange={patch('offsetY')}
      />
      <ShadowSliderRow
        label="Blur"
        min={0}
        max={SHADOW_LIMITS.blur}
        value={current.blur}
        unit="px"
        onChange={patch('blur')}
      />
      <ShadowSliderRow
        label="Opacity"
        min={0}
        max={100}
        value={Math.round(current.opacity * 100)}
        unit="%"
        onChange={(p) => patch('opacity')(p / 100)}
      />
    </MenuAccordionSection>
  );
}
