'use client';

// The Photo panel's Layers tab (docs/specs/031-photo/photo-layers.md "The Layers tab"): over the list
// the active layer's blend mode, opacity and locks; the list, top layer first (drag a row to move it,
// onto a group's middle to put it in); under it New Layer, New Group, Add Mask (Alt: Hide All), New
// Fill or Adjustment, Effects and Delete. A Participant sees it read-only; an empty stack shows its
// empty state.
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  lucideFolderPlus,
  lucideLock,
  lucideMove,
  lucidePaintbrush,
  lucidePlus,
  lucideSlidersHorizontal,
  lucideSparkles,
  lucideSquareDashed,
  lucideTrash2,
  lucideLayers,
} from '@livedesign/icons/lucide';
import { CompactEmptyState, lucideGlyph, Tooltip } from '@livedesign/ui';
import {
  BLEND_MODE_GROUPS,
  PHOTO_ADJUST_COMMIT_MS,
  listedLayers,
  moveLayer,
  setLayer,
  type BlendMode,
  type LayerLocks,
  type PhotoLayer,
} from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { addMask } from '@/lib/photo-editor/mask-ops';
import { stepActive } from '@/lib/photo-editor/layer-ops';
import { runPhotoAction } from '@/lib/photo-editor/photo-actions';
import { exportLayerPng } from '@/lib/photo-editor/photo-export';
import { track } from '@/lib/telemetry';
import { OptionSlider } from './photo-controls';
import { PhotoBlendPicker } from './PhotoBlendPicker';
import { PhotoEffectsEditor } from './PhotoEffectsEditor';
import { useRowPointerDrag } from '@/components/primitives/useRowPointerDrag';
import { PhotoLayerRow } from './PhotoLayerRow';
import { PhotoLayerAddMenus } from './PhotoLayerAddMenus';

const ICON = 15;
const NewLayerIcon = lucideGlyph(lucidePlus, ICON);
const NewGroupIcon = lucideGlyph(lucideFolderPlus, ICON);
const MaskIcon = lucideGlyph(lucideSquareDashed, ICON);
const FillIcon = lucideGlyph(lucideSlidersHorizontal, ICON);
const EffectsIcon = lucideGlyph(lucideSparkles, ICON);
const DeleteIcon = lucideGlyph(lucideTrash2, ICON);
const LayersIcon = lucideGlyph(lucideLayers, 20);

const LOCK_ICONS: Record<keyof LayerLocks, ReturnType<typeof lucideGlyph>> = {
  transparency: lucideGlyph(lucideSquareDashed, 13),
  pixels: lucideGlyph(lucidePaintbrush, 13),
  position: lucideGlyph(lucideMove, 13),
  all: lucideGlyph(lucideLock, 13),
};
const LOCK_NAMES: Record<keyof LayerLocks, string> = {
  transparency: 'Lock Transparency',
  pixels: 'Lock Pixels',
  position: 'Lock Position',
  all: 'Lock All',
};

const ACTION_BUTTON =
  'flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

/** A setting changed by a slider: shown at once, committed once it rests (one edit). */
export function useRestingCommit(photo: PhotoEditorView) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ label: string } | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    patch: (p: ReturnType<typeof setLayer>) => ReturnType<typeof setLayer>,
    label: string,
  ) => {
    const s = photo.session;
    if (!s) return;
    s.preview(patch(s.photo));
    pending.current = { label };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pending.current) s.commitStack(s.photo, pending.current.label);
      pending.current = null;
    }, PHOTO_ADJUST_COMMIT_MS);
  };
}

export function PhotoLayersTab({
  photo,
  onOpenAdjust,
  others,
}: {
  photo: PhotoEditorView;
  onOpenAdjust: () => void;
  others: (layerId: string) => readonly { name: string; colour: string }[];
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const s = photo.session!;
  const editable = photo.canEdit;
  // Rows restack by the shared pointer drag (useRowPointerDrag); a group takes a drop into it.
  const listRef = useRef<HTMLDivElement>(null);
  const drag = useRowPointerDrag({
    listRef,
    renamingId: null,
    canHold: (id) => s.layer(id)?.layerKind === 'group',
    onDrop: (id, targetId, at) =>
      commit(
        moveLayer(
          s.photo,
          id,
          at === 'into'
            ? { into: targetId }
            : at === 'above'
              ? { above: targetId }
              : { below: targetId },
        ),
        'Move Layer',
      ),
  });
  const [menu, setMenu] = useState<'fill' | 'effects' | null>(null);
  const [effectsOpen, setEffectsOpen] = useState(false);
  // In state, not refs: the menus are anchored to them while rendering.
  const [fillAnchor, setFillAnchor] = useState<HTMLButtonElement | null>(null);
  const [fxAnchor, setFxAnchor] = useState<HTMLButtonElement | null>(null);
  const resting = useRestingCommit(photo);
  const layers = s.photo.layers;
  const active = s.layer(s.active);
  const rows = listedLayers(layers);

  const press = (l: PhotoLayer, e: MouseEvent) => {
    // The chosen layers are the session's, so the menus, the keys and the Move tool act on them too.
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      const next = new Set(s.chosen);
      if (s.active) next.add(s.active);
      if (next.has(l.id) && (e.metaKey || e.ctrlKey)) next.delete(l.id);
      else next.add(l.id);
      s.setChosen(next);
    } else if (s.chosen.size) s.setChosen(new Set());
    s.choose(l.id, s.target);
  };
  const commit = (next: typeof s.photo, label: string) => s.commitStack(next, label);
  const act = (id: string) => runPhotoAction(id, photo);
  // A group passes through by default, so it offers that first.
  const blendGroups: readonly (readonly BlendMode[])[] =
    active?.layerKind === 'group' ? [['pass-through'], ...BLEND_MODE_GROUPS] : BLEND_MODE_GROUPS;
  // The photo before a hovered blend mode was shown, while one is.
  const previewBase = useRef<typeof s.photo | null>(null);

  return (
    <div className="flex min-h-0 flex-col" data-photo-layers="">
      {active && editable ? (
        <div className="mx-3 mb-2 flex flex-col gap-2.5 rounded-xl bg-white p-2.5 ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700">
          <div className="flex items-center gap-2">
            <PhotoBlendPicker
              value={active.blend ?? (active.layerKind === 'group' ? 'pass-through' : 'normal')}
              groups={blendGroups}
              onPreview={(m) => {
                // The photo as committed, with the mode pointed at shown over it.
                const base = previewBase.current ?? s.photo;
                previewBase.current = m ? base : null;
                s.preview(
                  m ? setLayer(base, active.id, { blend: m === 'normal' ? undefined : m }) : base,
                );
              }}
              onChange={(m) => {
                const base = previewBase.current ?? s.photo;
                previewBase.current = null;
                commit(
                  setLayer(base, active.id, { blend: m === 'normal' ? undefined : m }),
                  'Blend Mode',
                );
                track('Element', 'Changed', 'PhotoLayerBlend');
              }}
            />
          </div>
          <OptionSlider
            label="Opacity"
            value={active.opacity ?? 1}
            min={0}
            max={1}
            step={0.01}
            unit="%"
            scale={100}
            onChange={(v) =>
              resting((p) => setLayer(p, active.id, { opacity: v >= 1 ? undefined : v }), 'Opacity')
            }
          />
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[12.5px] font-medium text-slate-700 dark:text-slate-200">
              Lock
            </span>
            <div
              className="flex flex-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800"
              role="group"
              aria-label="Locks"
            >
              {(Object.keys(LOCK_NAMES) as (keyof LayerLocks)[]).map((k) => {
                const on = !!active.locks?.[k];
                return (
                  <Tooltip key={k} label={LOCK_NAMES[k]}>
                    <button
                      type="button"
                      aria-label={LOCK_NAMES[k]}
                      aria-pressed={on}
                      onClick={() => {
                        const locks: LayerLocks = { ...active.locks };
                        if (on) delete locks[k];
                        else locks[k] = true;
                        commit(
                          setLayer(s.photo, active.id, {
                            locks: Object.keys(locks).length ? locks : undefined,
                          }),
                          LOCK_NAMES[k],
                        );
                      }}
                      className={`flex h-7 flex-1 items-center justify-center rounded-md transition ${
                        on
                          ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-200 dark:bg-slate-900 dark:text-brand-200 dark:ring-brand-500/40'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                      }`}
                    >
                      {(() => {
                        const I = LOCK_ICONS[k];
                        return <I />;
                      })()}
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {effectsOpen &&
      active &&
      editable &&
      (active.layerKind === 'pixel' || active.layerKind === 'text') ? (
        <PhotoEffectsEditor photo={photo} layer={active} onClose={() => setEffectsOpen(false)} />
      ) : null}
      <div
        role="listbox"
        aria-label="Layers"
        ref={listRef}
        className="mx-2 min-h-0 flex-1 overflow-y-auto py-0.5"
        onKeyDown={(e) => {
          // The list's own keys while a row has focus (photo-layers.md "The Layers tab"): the arrows
          // step the active layer (the top layer is first), Delete and Backspace delete it.
          if ((e.target as HTMLElement).closest('input, textarea')) return;
          const list = e.currentTarget;
          const refocus = () =>
            requestAnimationFrame(() =>
              list.querySelector<HTMLElement>('[role="option"][tabindex="0"]')?.focus(),
            );
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            stepActive(s, e.key === 'ArrowUp' ? 1 : -1);
            refocus();
          } else if (editable && (e.key === 'Delete' || e.key === 'Backspace')) {
            e.preventDefault();
            e.stopPropagation();
            act('delete-layer');
            refocus();
          }
        }}
      >
        {rows.length === 0 ? (
          <CompactEmptyState
            icon={<LayersIcon />}
            title="No layers yet"
            description={editable ? 'Add one, or paint to make one.' : 'This photo has no layers.'}
            action={
              editable ? (
                <button
                  type="button"
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                  onClick={() => act('new-layer')}
                >
                  New Layer
                </button>
              ) : undefined
            }
          />
        ) : (
          rows.map(({ layer, depth }) => (
            <PhotoLayerRow
              key={layer.id}
              layer={layer}
              depth={depth}
              session={s}
              version={photo.version}
              active={layer.id === s.active}
              chosen={s.chosen.has(layer.id)}
              editable={editable}
              others={others(layer.id)}
              onPress={(e) => press(layer, e)}
              onEye={(alt) => {
                if (alt) {
                  s.setSolo(s.solo === layer.id ? null : layer.id);
                  return;
                }
                commit(
                  setLayer(s.photo, layer.id, {
                    visible: layer.visible === false ? undefined : false,
                  }),
                  layer.visible === false ? 'Show Layer' : 'Hide Layer',
                );
              }}
              onTarget={(t) => s.choose(layer.id, t)}
              onRename={(name) => commit(setLayer(s.photo, layer.id, { name }), 'Rename Layer')}
              onFold={() =>
                // A fold is the view of the stack, not an edit to undo.
                s.commitStack(
                  setLayer(s.photo, layer.id, {
                    collapsed: layer.layerKind === 'group' && layer.collapsed ? undefined : true,
                  }),
                  'Fold',
                  { undoable: false },
                )
              }
              onAction={(id) => {
                s.choose(layer.id, s.target);
                if (id === 'export-layer') return void exportLayerPng(s, layer.id);
                act(id);
              }}
              dropAt={drag.dragId && drag.over?.id === layer.id ? drag.over.at : null}
              drag={{
                onPointerDown: drag.rowPointerDown(layer.id),
                onPointerMove: drag.rowPointerMove,
                onPointerUp: drag.rowPointerUp,
                onPointerCancel: drag.rowPointerCancel,
              }}
            />
          ))
        )}
      </div>
      {editable ? (
        <div className="mx-3 mt-1 flex items-center gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
          <button
            type="button"
            aria-label="New Layer"
            onClick={() => act('new-layer')}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-[12.5px] font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40 dark:hover:bg-brand-500/25"
          >
            <NewLayerIcon />
            New Layer
          </button>
          <Tooltip label="New Group">
            <button
              type="button"
              aria-label="New Group"
              className={ACTION_BUTTON}
              onClick={() => act('new-group')}
            >
              <NewGroupIcon />
            </button>
          </Tooltip>
          <Tooltip label="Add Mask">
            <button
              type="button"
              aria-label="Add Mask"
              className={ACTION_BUTTON}
              disabled={!active || !!active.mask}
              onClick={(e) => {
                if (!active) return;
                const r = addMask(
                  s,
                  active.id,
                  e.altKey ? 'hide' : s.selection ? 'selection' : 'reveal',
                );
                if (r) photo.toast(r);
                else track('Element', 'Changed', 'PhotoLayerAddMask');
              }}
            >
              <MaskIcon />
            </button>
          </Tooltip>
          <Tooltip label="New Fill or Adjustment">
            <button
              ref={setFillAnchor}
              type="button"
              aria-label="New Fill or Adjustment"
              aria-haspopup="menu"
              className={ACTION_BUTTON}
              onClick={() => setMenu(menu === 'fill' ? null : 'fill')}
            >
              <FillIcon />
            </button>
          </Tooltip>
          <Tooltip label="Effects">
            <button
              ref={setFxAnchor}
              type="button"
              aria-label="Effects"
              aria-haspopup="menu"
              className={ACTION_BUTTON}
              disabled={!active || (active.layerKind !== 'pixel' && active.layerKind !== 'text')}
              onClick={() => setMenu(menu === 'effects' ? null : 'effects')}
            >
              <EffectsIcon />
            </button>
          </Tooltip>
          <span className="flex-1" />
          <Tooltip label="Delete Layer">
            <button
              type="button"
              aria-label="Delete Layer"
              className={`${ACTION_BUTTON} hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/15 dark:hover:text-rose-300`}
              disabled={!active}
              onClick={() => act('delete-layer')}
            >
              <DeleteIcon />
            </button>
          </Tooltip>
        </div>
      ) : null}
      <PhotoLayerAddMenus
        photo={photo}
        menu={menu}
        onClose={() => setMenu(null)}
        fillAnchor={fillAnchor}
        fxAnchor={fxAnchor}
        onOpenAdjust={onOpenAdjust}
        onEffectsOpen={() => setEffectsOpen(true)}
      />
    </div>
  );
}
