'use client';

// The Layers tab's add menus (docs/specs/031-photo/photo-layers.md "The Layers tab"): New Fill or Adjustment (Solid
// Colour and Gradient, then the adjustments in the Adjust tab's sections) and Effects (Drop Shadow, Outer Glow,
// Stroke, Colour Overlay), each a menu of icon-left rows under a header, as the app's verb menus read.
import { Fragment } from 'react';
import {
  lucideBlend,
  lucideCopy,
  lucidePaintBucket,
  lucideSquare,
  lucideSun,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import { LAYER_ADJUSTMENT_IDS, adjustmentName, setLayer } from '@livedesign/photo-engine';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@/components/primitives/PortalMenu';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { ADJUST_SECTIONS } from '@/lib/photo-editor/adjust-showcase';
import { newAdjustmentLayer, newFillLayer } from '@/lib/photo-editor/layer-ops';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { track } from '@/lib/telemetry';
import { AdjustGlyph } from './photo-menu-icons';

const SolidIcon = lucideGlyph(lucideSquare, 16);
const GradientIcon = lucideGlyph(lucideBlend, 16);

const EFFECT_GLYPHS = {
  shadow: lucideGlyph(lucideCopy, 16),
  glow: lucideGlyph(lucideSun, 16),
  stroke: lucideGlyph(lucideSquare, 16),
  overlay: lucideGlyph(lucidePaintBucket, 16),
} as const;
function EffectGlyph({ kind }: { kind: keyof typeof EFFECT_GLYPHS }) {
  const G = EFFECT_GLYPHS[kind];
  return <G />;
}

export function PhotoLayerAddMenus({
  photo,
  menu,
  onClose,
  fillAnchor,
  fxAnchor,
  onOpenAdjust,
  onEffectsOpen,
}: {
  photo: PhotoEditorView;
  menu: 'fill' | 'effects' | null;
  onClose: () => void;
  fillAnchor: HTMLElement | null;
  fxAnchor: HTMLElement | null;
  onOpenAdjust: () => void;
  onEffectsOpen: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const active = s.layer(s.active);
  const commit = (next: typeof s.photo, label: string) => s.commitStack(next, label);
  // Beside the Photo panel, as the layer row's menu opens.
  const panel =
    (fillAnchor ?? fxAnchor)?.closest<HTMLElement>('[data-tour-id="photo-panel"]') ?? null;
  return (
    <>
      {menu === 'fill' ? (
        <PortalMenu anchor={fillAnchor} placement="above" beside={panel} onClose={() => onClose()}>
          <MenuHeader title="New Fill or Adjustment" />
          <MenuActionRow
            plain
            icon={<SolidIcon />}
            label="Solid Colour"
            onClick={() => {
              onClose();
              newFillLayer(s, { kind: 'solid', colour: photoTools.get().foreground });
              track('Element', 'Changed', 'PhotoLayerNewFill');
            }}
          />
          <MenuActionRow
            plain
            icon={<GradientIcon />}
            label="Gradient"
            onClick={() => {
              onClose();
              const { foreground, background } = photoTools.get();
              newFillLayer(s, {
                kind: 'gradient',
                style: 'linear',
                angle: 90,
                scale: 1,
                gradient: {
                  colours: [
                    { at: 0, colour: foreground },
                    { at: 1, colour: background },
                  ],
                  opacities: [
                    { at: 0, opacity: 1 },
                    { at: 1, opacity: 1 },
                  ],
                },
              });
              track('Element', 'Changed', 'PhotoLayerNewGradientFill');
            }}
          />
          {ADJUST_SECTIONS.map((section) => (
            <Fragment key={section.title}>
              <MenuGroupSeparator />
              {section.ids
                .filter((id) => LAYER_ADJUSTMENT_IDS.includes(id))
                .map((id) => (
                  <MenuActionRow
                    key={id}
                    plain
                    icon={<AdjustGlyph id={id} />}
                    label={adjustmentName(id)}
                    onClick={(e) => {
                      onClose();
                      newAdjustmentLayer(s, id, e.altKey);
                      track(
                        'Element',
                        'Changed',
                        `PhotoAdjust${id.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase())}`,
                      );
                      onOpenAdjust();
                    }}
                  />
                ))}
            </Fragment>
          ))}
        </PortalMenu>
      ) : null}
      {menu === 'effects' && active ? (
        <PortalMenu anchor={fxAnchor} placement="above" beside={panel} onClose={() => onClose()}>
          <MenuHeader title="Effects" />
          {(
            [
              [
                'shadow',
                'Drop Shadow',
                { colour: '#000000', opacity: 0.6, angle: 120, distance: 8, size: 8, spread: 0 },
              ],
              ['glow', 'Outer Glow', { colour: '#ffffbe', opacity: 0.75, size: 12, spread: 0 }],
              ['stroke', 'Stroke', { colour: '#000000', size: 3, position: 'outside' }],
              [
                'overlay',
                'Colour Overlay',
                { colour: photoTools.get().foreground, opacity: 1, blend: 'normal' },
              ],
            ] as const
          ).map(([key, label, defaults]) => (
            <MenuActionRow
              key={key}
              plain
              icon={<EffectGlyph kind={key} />}
              label={label}
              onClick={() => {
                onClose();
                const fx = { ...('effects' in active ? active.effects : undefined) };
                if (!(key in fx)) (fx as Record<string, unknown>)[key] = defaults;
                commit(setLayer(s.photo, active.id, { effects: fx }), label);
                onEffectsOpen();
                track('Element', 'Changed', `PhotoLayerEffect${label.replace(/\s/g, '')}`);
              }}
            />
          ))}
        </PortalMenu>
      ) : null}
    </>
  );
}
