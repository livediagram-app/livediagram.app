'use client';

// A layer's effects (docs/specs/031-photo/photo-layers.md "A layer" effects): Drop Shadow, Outer
// Glow, Stroke and Colour Overlay, each switched on or off, its colour from the shared picker and its
// settings as sliders; a change shows at once and commits once it rests. Opened by the `fx` mark or
// the Effects menu.
import { lucideTrash2 } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import { setLayer, type LayerEffects, type PhotoLayer } from '@livedesign/photo-engine';
import { standardGroup } from '@/components/colour/colour-options';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { OptionChoice, OptionSlider, OptionToggle } from './photo-controls';
import { useRestingCommit } from './PhotoLayersTab';

const RemoveIcon = lucideGlyph(lucideTrash2, 12);
const STANDARD = [standardGroup('strong', 'light', 'hex')];

type Key = keyof LayerEffects;
const NAMES: Record<Key, string> = {
  shadow: 'Drop Shadow',
  glow: 'Outer Glow',
  stroke: 'Stroke',
  overlay: 'Colour Overlay',
};

type Num = {
  key: string;
  label: string;
  min: number;
  max: number;
  unit?: string;
  percent?: boolean;
};
const NUMBERS: Record<Key, readonly Num[]> = {
  shadow: [
    { key: 'opacity', label: 'Opacity', min: 0, max: 1, percent: true },
    { key: 'angle', label: 'Angle', min: -180, max: 180, unit: '°' },
    { key: 'distance', label: 'Distance', min: 0, max: 500, unit: 'px' },
    { key: 'size', label: 'Size', min: 0, max: 250, unit: 'px' },
    { key: 'spread', label: 'Spread', min: 0, max: 1, percent: true },
  ],
  glow: [
    { key: 'opacity', label: 'Opacity', min: 0, max: 1, percent: true },
    { key: 'size', label: 'Size', min: 0, max: 250, unit: 'px' },
    { key: 'spread', label: 'Spread', min: 0, max: 1, percent: true },
  ],
  stroke: [{ key: 'size', label: 'Size', min: 1, max: 250, unit: 'px' }],
  overlay: [{ key: 'opacity', label: 'Opacity', min: 0, max: 1, percent: true }],
};

export function PhotoEffectsEditor({
  photo,
  layer,
  onClose,
}: {
  photo: PhotoEditorView;
  layer: PhotoLayer;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const resting = useRestingCommit(photo);
  const fx: LayerEffects = ('effects' in layer ? layer.effects : undefined) ?? {};
  const keys = (Object.keys(NAMES) as Key[]).filter((k) => fx[k]);
  const put = (k: Key, patch: Record<string, unknown>, now = false) => {
    const next = { ...fx, [k]: { ...fx[k], ...patch } };
    if (now) s.commitStack(setLayer(s.photo, layer.id, { effects: next }), NAMES[k]);
    else resting((p) => setLayer(p, layer.id, { effects: next }), NAMES[k]);
  };
  return (
    <div
      className="flex flex-col gap-2 border-b border-slate-100 p-2 dark:border-slate-800"
      role="group"
      aria-label="Effects"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
          Effects
        </span>
        <button
          type="button"
          className="text-[11px] text-slate-500 hover:underline"
          onClick={onClose}
        >
          Done
        </button>
      </div>
      {keys.length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Add an effect from the Effects menu.
        </p>
      ) : null}
      {keys.map((k) => {
        const e = fx[k] as Record<string, unknown>;
        return (
          <div
            key={k}
            className="flex flex-col gap-1 rounded-md bg-slate-50 p-1.5 dark:bg-slate-800/60"
          >
            <div className="flex items-center gap-2">
              <OptionToggle
                label={NAMES[k]}
                on={e.enabled !== false}
                onChange={(on) => put(k, { enabled: on ? undefined : false }, true)}
              />
              <ColourSwatchButton
                label={`${NAMES[k]} Colour`}
                swatch={String(e.colour)}
                value={String(e.colour)}
                standard={STANDARD}
                onPick={(id) =>
                  /^#[0-9a-f]{6}$/i.test(id) && put(k, { colour: id.toLowerCase() }, true)
                }
              />
              <span className="flex-1" />
              <Tooltip label={`Remove ${NAMES[k]}`}>
                <button
                  type="button"
                  aria-label={`Remove ${NAMES[k]}`}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  onClick={() => {
                    const { [k]: _gone, ...rest } = fx;
                    void _gone;
                    s.commitStack(
                      setLayer(s.photo, layer.id, {
                        effects: Object.keys(rest).length ? rest : undefined,
                      }),
                      `Remove ${NAMES[k]}`,
                    );
                  }}
                >
                  <RemoveIcon />
                </button>
              </Tooltip>
            </div>
            {NUMBERS[k].map((n) => (
              <OptionSlider
                key={n.key}
                label={n.label}
                value={typeof e[n.key] === 'number' ? (e[n.key] as number) : n.min}
                min={n.min}
                max={n.max}
                step={n.percent ? 0.01 : 1}
                unit={n.percent ? '%' : (n.unit ?? '')}
                scale={n.percent ? 100 : 1}
                onChange={(v) => put(k, { [n.key]: v })}
              />
            ))}
            {k === 'stroke' ? (
              <OptionChoice
                label="Position"
                value={String(e.position)}
                choices={[
                  { value: 'outside', label: 'Outside' },
                  { value: 'inside', label: 'Inside' },
                  { value: 'centre', label: 'Centre' },
                ]}
                onChange={(v) => put(k, { position: v }, true)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
