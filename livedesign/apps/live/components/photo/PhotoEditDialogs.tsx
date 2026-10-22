'use client';

// The Fill… dialog, the Select menu's Colour Range… and Modify dialogs, and Flatten's confirmation
// (docs/specs/031-photo/photo-tools.md "Retouching" Fill, "Selecting"; photo-layers.md "Layer
// operations" Flatten).
import { useMemo, useState } from 'react';
import { Button, DialogHeader } from '@livedesign/ui';
import {
  BLEND_MODE_GROUPS,
  BLEND_MODE_NAMES,
  hexToBytes,
  type BlendMode,
} from '@livedesign/photo-engine';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { standardGroup } from '@/components/colour/colour-options';
import { ColourSwatchButton } from '@/components/colour/ColourSwatchButton';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { fillSelection, type FillContents } from '@/lib/photo-editor/edit-ops';
import { flatten } from '@/lib/photo-editor/layer-ops';
import { setSelection } from '@/lib/photo-editor/mask-ops';
import {
  grow,
  modifySelection,
  selectColourRange,
  type ModifyHow,
} from '@/lib/photo-editor/selection-ops';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { track } from '@/lib/telemetry';
import { OptionChoice, OptionSlider, OptionToggle } from './photo-controls';

const STANDARD = [standardGroup('strong', 'light', 'hex')];
const BLENDS = BLEND_MODE_GROUPS.flat().map((m) => ({ value: m, label: BLEND_MODE_NAMES[m] }));

function Actions({
  onCancel,
  onOk,
  ok = 'OK',
  disabled = false,
}: {
  onCancel: () => void;
  onOk: () => void;
  ok?: string;
  disabled?: boolean;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <DialogFooter>
      <Button variant="secondary" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onOk} disabled={disabled}>
        {ok}
      </Button>
    </DialogFooter>
  );
}

export function FillDialog({ photo, onClose }: { photo: PhotoEditorView; onClose: () => void }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const [contents, setContents] = useState<FillContents>('foreground');
  const [colour, setColour] = useState(photoTools.get().foreground);
  const [mode, setMode] = useState<BlendMode>('normal');
  const [opacity, setOpacity] = useState(1);
  const [keep, setKeep] = useState(false);
  const s = photo.session!;
  return (
    <Dialog open onClose={onClose} ariaLabel="Fill" backdrop="desktop-light">
      <DialogHeader
        title="Fill"
        subtitle={
          s.selection ? 'Fills the selection on the active layer.' : 'Fills the whole active layer.'
        }
      />
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex items-center gap-2">
          <OptionChoice<FillContents>
            label="Contents"
            value={contents}
            choices={[
              { value: 'foreground', label: 'Foreground Colour' },
              { value: 'background', label: 'Background Colour' },
              { value: 'colour', label: 'Colour' },
              { value: 'content-aware', label: 'Content-Aware' },
              { value: 'black', label: 'Black' },
              { value: 'grey', label: '50% Grey' },
              { value: 'white', label: 'White' },
            ]}
            onChange={setContents}
          />
          {contents === 'colour' ? (
            <ColourSwatchButton
              label="Fill Colour"
              swatch={colour}
              value={colour}
              standard={STANDARD}
              onPick={(id) => /^#[0-9a-f]{6}$/i.test(id) && setColour(id.toLowerCase())}
            />
          ) : null}
        </div>
        {contents !== 'content-aware' ? (
          <>
            <OptionChoice<BlendMode>
              label="Mode"
              value={mode}
              choices={BLENDS}
              onChange={setMode}
            />
            <OptionSlider
              label="Opacity"
              value={opacity}
              min={0}
              max={1}
              step={0.01}
              unit="%"
              scale={100}
              width="w-full"
              onChange={setOpacity}
            />
            <OptionToggle label="Preserve Transparency" on={keep} onChange={setKeep} />
          </>
        ) : null}
      </div>
      <Actions
        onCancel={onClose}
        onOk={() => {
          const r = fillSelection(
            s,
            { contents, colour, mode, opacity, preserveTransparency: keep },
            photoTools.get(),
          );
          const done = (msg: string | null) => {
            if (msg) photo.toast(msg);
            else
              track(
                'Element',
                'Changed',
                contents === 'content-aware' ? 'PhotoContentAwareFill' : 'PhotoFill',
              );
          };
          if (r instanceof Promise) void r.then(done);
          else done(r);
          onClose();
        }}
      />
    </Dialog>
  );
}

export function ColourRangeDialog({
  photo,
  onClose,
}: {
  photo: PhotoEditorView;
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const [colours, setColours] = useState<string[]>(() => [photoTools.get().foreground]);
  const [fuzziness, setFuzziness] = useState(40);
  const mask = useMemo(
    () =>
      colours.length
        ? selectColourRange(
            s,
            colours.map((c) => [...hexToBytes(c)]),
            fuzziness,
          )
        : null,
    [s, colours, fuzziness],
  );
  return (
    <Dialog open onClose={onClose} ariaLabel="Colour Range" backdrop="desktop-light">
      <DialogHeader title="Colour Range" subtitle="Selects every pixel near the colours chosen." />
      <div className="flex flex-col gap-3 px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {colours.map((c, i) => (
            <ColourSwatchButton
              key={i}
              label={`Colour ${i + 1}`}
              swatch={c}
              value={c}
              standard={STANDARD}
              onPick={(id) =>
                /^#[0-9a-f]{6}$/i.test(id) &&
                setColours((cs) => cs.map((x, j) => (j === i ? id.toLowerCase() : x)))
              }
            />
          ))}
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setColours((cs) => [...cs, photoTools.get().foreground])}
          >
            Add Foreground Colour
          </Button>
          {colours.length > 1 ? (
            <Button variant="ghost" size="xs" onClick={() => setColours((cs) => cs.slice(0, -1))}>
              Remove Last
            </Button>
          ) : null}
        </div>
        <OptionSlider
          label="Fuzziness"
          value={fuzziness}
          min={0}
          max={200}
          width="w-full"
          onChange={setFuzziness}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Pick a colour with the Eyedropper first to make it the foreground colour.
        </p>
      </div>
      <Actions
        onCancel={onClose}
        onOk={() => {
          setSelection(s, mask);
          track('Element', 'Used', 'PhotoColourRange');
          onClose();
        }}
      />
    </Dialog>
  );
}

const MODIFY: Record<
  ModifyHow | 'grow',
  { title: string; label: string; min: number; max: number; def: number }
> = {
  grow: { title: 'Grow', label: 'Tolerance', min: 0, max: 255, def: 32 },
  expand: { title: 'Expand Selection', label: 'Expand By', min: 1, max: 500, def: 4 },
  contract: { title: 'Contract Selection', label: 'Contract By', min: 1, max: 500, def: 4 },
  border: { title: 'Border Selection', label: 'Width', min: 1, max: 200, def: 4 },
  smooth: { title: 'Smooth Selection', label: 'Radius', min: 1, max: 100, def: 4 },
  feather: { title: 'Feather Selection', label: 'Feather Radius', min: 0.1, max: 250, def: 4 },
};

export function ModifyDialog({
  photo,
  how,
  onClose,
}: {
  photo: PhotoEditorView;
  how: ModifyHow | 'grow';
  onClose: () => void;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const m = MODIFY[how];
  const [v, setV] = useState(how === 'grow' ? photoTools.get().options.wand.tolerance : m.def);
  const s = photo.session!;
  return (
    <Dialog open onClose={onClose} ariaLabel={m.title} backdrop="desktop-light">
      <DialogHeader title={m.title} />
      <div className="flex flex-col gap-3 px-6 py-4">
        <OptionSlider
          label={m.label}
          value={v}
          min={m.min}
          max={m.max}
          step={how === 'feather' ? 0.1 : 1}
          unit={how === 'grow' ? '' : 'px'}
          width="w-full"
          onChange={setV}
        />
      </div>
      <Actions
        onCancel={onClose}
        onOk={() => {
          const r = how === 'grow' ? grow(s, v) : modifySelection(s, how, v);
          if (r) photo.toast(r);
          onClose();
        }}
      />
    </Dialog>
  );
}

export function FlattenDialog({ photo, onClose }: { photo: PhotoEditorView; onClose: () => void }) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <Dialog open onClose={onClose} ariaLabel="Flatten Image" backdrop="desktop-light">
      <DialogHeader title="Flatten Image?" subtitle="Flatten discards hidden layers." />
      <Actions
        ok="Flatten"
        onCancel={onClose}
        onOk={() => {
          void flatten(photo.session!).then((r) => r && photo.toast(r));
          track('Element', 'Changed', 'PhotoLayerFlatten');
          onClose();
        }}
      />
    </Dialog>
  );
}
