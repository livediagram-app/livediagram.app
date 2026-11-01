// Every photo command by name (docs/specs/031-photo/photo-pages.md "The title bar", photo-tools.md
// "Keyboard summary", photo-layers.md "Layer operations"): what the Image, Select and Layer menus,
// the shortcuts and the command palette run, each one place. A refusal is said as a toast.
import { photoBusy } from './photo-busy';
import {
  autoColour,
  autoContrast,
  autoTone,
  histogramOf,
  maskBounds,
  removeLayers,
  type AdjustmentId,
} from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { track } from '@/lib/telemetry';
import { adjustArea, commitApplying, filterArea, startApplying } from './apply-ops';
import { copy, cut, paste } from './clipboard';
import { clearSelection, contentAwareFill, fillSelection } from './edit-ops';
import { cropTo, flipImage, rotateQuarterTurn, trimTransparent } from './image-ops';
import {
  arrangeLayer,
  deleteLayers,
  duplicate,
  flatten,
  flattenDiscards,
  layerVia,
  mergeDown,
  mergeLayers,
  mergeVisible,
  newGroup,
  newLayer,
  rasterize,
  rasterizeEffects,
  stepActive,
  toggleClip,
  ungroupLayer,
} from './layer-ops';
import {
  addMask,
  applyMask,
  deleteMask,
  invertMask,
  selectMask,
  selectPixels,
  toggleMask,
} from './mask-ops';
import { photoDialogs, lastPhotoFilter } from './photo-dialog-store';
import {
  deselect,
  inverse,
  removeBackground,
  reselect,
  selectAll,
  selectSubject,
} from './selection-ops';
import { photoTools } from './tool-state';
import { photoViewOptions } from './view-options';
import { beginTransform } from './tools/transform-tool';

// The View items are the command palette's alone (photo-pages.md "Navigating").
export type PhotoMenu = 'Image' | 'Select' | 'Layer' | 'Edit' | 'View';

export type PhotoAction = {
  id: string;
  label: string;
  menu: PhotoMenu;
  keys?: string;
  section?: number;
};

// The menus' rows, each menu's sections in order (a new section starts a separator).
export const PHOTO_ACTIONS: readonly PhotoAction[] = [
  { id: 'auto-tone', label: 'Auto Tone', menu: 'Image', section: 1 },
  { id: 'auto-contrast', label: 'Auto Contrast', menu: 'Image', section: 1 },
  { id: 'auto-colour', label: 'Auto Colour', menu: 'Image', section: 1 },
  { id: 'image-size', label: 'Image Size…', menu: 'Image', section: 2 },
  { id: 'canvas-size', label: 'Canvas Size…', menu: 'Image', section: 2 },
  { id: 'rotate-cw', label: 'Rotate 90° Clockwise', menu: 'Image', section: 3 },
  { id: 'rotate-ccw', label: 'Rotate 90° Anticlockwise', menu: 'Image', section: 3 },
  { id: 'rotate-180', label: 'Rotate 180°', menu: 'Image', section: 3 },
  { id: 'rotate', label: 'Rotate…', menu: 'Image', section: 3 },
  { id: 'flip-h', label: 'Flip Horizontal', menu: 'Image', section: 3 },
  { id: 'flip-v', label: 'Flip Vertical', menu: 'Image', section: 3 },
  { id: 'crop-to-selection', label: 'Crop to Selection', menu: 'Image', section: 4 },
  { id: 'trim', label: 'Trim Transparent', menu: 'Image', section: 4 },
  { id: 'free-transform', label: 'Free Transform', menu: 'Image', keys: 'Mod+T', section: 5 },
  { id: 'place-picture', label: 'Place Picture…', menu: 'Image', section: 5 },
  { id: 'make-sizes', label: 'Make Sizes…', menu: 'Image', section: 6 },
  { id: 'select-all', label: 'All', menu: 'Select', keys: 'Mod+A', section: 1 },
  { id: 'deselect', label: 'Deselect', menu: 'Select', keys: 'Mod+D', section: 1 },
  { id: 'reselect', label: 'Reselect', menu: 'Select', keys: 'Mod+Shift+D', section: 1 },
  { id: 'inverse', label: 'Inverse', menu: 'Select', keys: 'Mod+Shift+I', section: 1 },
  { id: 'subject', label: 'Subject', menu: 'Select', section: 2 },
  { id: 'colour-range', label: 'Colour Range…', menu: 'Select', section: 2 },
  { id: 'select-and-mask', label: 'Select and Mask…', menu: 'Select', section: 2 },
  { id: 'grow', label: 'Grow', menu: 'Select', section: 3 },
  { id: 'expand', label: 'Expand…', menu: 'Select', section: 3 },
  { id: 'contract', label: 'Contract…', menu: 'Select', section: 3 },
  { id: 'border', label: 'Border…', menu: 'Select', section: 3 },
  { id: 'smooth', label: 'Smooth…', menu: 'Select', section: 3 },
  { id: 'feather', label: 'Feather…', menu: 'Select', section: 3 },
  { id: 'remove-background', label: 'Remove Background', menu: 'Select', section: 4 },
  { id: 'new-layer', label: 'New Layer', menu: 'Layer', keys: 'Mod+Shift+N', section: 1 },
  { id: 'new-group', label: 'New Group', menu: 'Layer', section: 1 },
  { id: 'duplicate', label: 'Duplicate', menu: 'Layer', keys: 'Mod+J', section: 1 },
  { id: 'delete-layer', label: 'Delete', menu: 'Layer', section: 1 },
  { id: 'group', label: 'Group', menu: 'Layer', keys: 'Mod+G', section: 2 },
  { id: 'ungroup', label: 'Ungroup', menu: 'Layer', keys: 'Mod+Shift+G', section: 2 },
  { id: 'merge-down', label: 'Merge Down', menu: 'Layer', keys: 'Mod+E', section: 2 },
  { id: 'merge-visible', label: 'Merge Visible', menu: 'Layer', keys: 'Mod+Shift+E', section: 2 },
  { id: 'flatten', label: 'Flatten Image', menu: 'Layer', section: 2 },
  { id: 'clip', label: 'Create Clipping Mask', menu: 'Layer', keys: 'Mod+Alt+G', section: 3 },
  { id: 'add-mask', label: 'Add Mask', menu: 'Layer', section: 3 },
  { id: 'apply-mask', label: 'Apply Mask', menu: 'Layer', section: 3 },
  { id: 'delete-mask', label: 'Delete Mask', menu: 'Layer', section: 3 },
  { id: 'toggle-mask', label: 'Disable Mask', menu: 'Layer', section: 3 },
  { id: 'invert-mask', label: 'Invert Mask', menu: 'Layer', section: 3 },
  { id: 'select-mask', label: 'Select Mask', menu: 'Layer', section: 3 },
  { id: 'rasterize', label: 'Rasterize', menu: 'Layer', section: 4 },
  { id: 'rasterize-effects', label: 'Rasterize Effects', menu: 'Layer', section: 4 },
  { id: 'layer-via-copy', label: 'Layer Via Copy', menu: 'Layer', section: 4 },
  { id: 'layer-via-cut', label: 'Layer Via Cut', menu: 'Layer', keys: 'Mod+Shift+J', section: 4 },
  { id: 'select-pixels', label: 'Select Pixels', menu: 'Layer', section: 4 },
  { id: 'bring-forward', label: 'Bring Forward', menu: 'Layer', keys: 'Mod+]', section: 5 },
  { id: 'send-backward', label: 'Send Backward', menu: 'Layer', keys: 'Mod+[', section: 5 },
  { id: 'bring-to-front', label: 'Bring to Front', menu: 'Layer', keys: 'Mod+Shift+]', section: 5 },
  { id: 'send-to-back', label: 'Send to Back', menu: 'Layer', keys: 'Mod+Shift+[', section: 5 },
  {
    id: 'select-layer-above',
    label: 'Select Layer Above',
    menu: 'Layer',
    keys: 'Alt+]',
    section: 6,
  },
  {
    id: 'select-layer-below',
    label: 'Select Layer Below',
    menu: 'Layer',
    keys: 'Alt+[',
    section: 6,
  },
  { id: 'fill', label: 'Fill…', menu: 'Edit', keys: 'Shift+Backspace', section: 1 },
  { id: 'content-aware', label: 'Content-Aware Fill', menu: 'Edit', section: 1 },
  {
    id: 'fill-foreground',
    label: 'Fill With Foreground',
    menu: 'Edit',
    keys: 'Alt+Backspace',
    section: 1,
  },
  {
    id: 'fill-background',
    label: 'Fill With Background',
    menu: 'Edit',
    keys: 'Mod+Backspace',
    section: 1,
  },
  // Delete (a Mac's delete key is Backspace, taken as Delete): the selected pixels, or with no selection the
  // layers in hand.
  { id: 'clear', label: 'Clear', menu: 'Edit', keys: 'Delete', section: 1 },
  { id: 'copy', label: 'Copy', menu: 'Edit', keys: 'Mod+C', section: 2 },
  { id: 'copy-merged', label: 'Copy Merged', menu: 'Edit', keys: 'Mod+Shift+C', section: 2 },
  { id: 'cut', label: 'Cut', menu: 'Edit', keys: 'Mod+X', section: 2 },
  // Ctrl/Cmd+V and Ctrl/Cmd+Shift+V are the paste event's (usePhotoDropPaste): a keydown taken here
  // would stop the browser handing over the clipboard's picture.
  { id: 'paste', label: 'Paste', menu: 'Edit', section: 2 },
  { id: 'paste-in-place', label: 'Paste in Place', menu: 'Edit', section: 2 },
  { id: 'repeat-filter', label: 'Repeat Filter', menu: 'Edit', keys: 'Mod+Alt+F', section: 3 },
  { id: 'step-backward', label: 'Step Backward', menu: 'Edit', keys: 'Mod+Alt+Z', section: 4 },
  { id: 'fit-photo', label: 'Fit Photo', menu: 'View', keys: 'Mod+0', section: 1 },
  { id: 'actual-pixels', label: 'Actual Pixels', menu: 'View', keys: 'Mod+1', section: 1 },
  { id: 'pixel-grid', label: 'Pixel Grid', menu: 'View', section: 2 },
];

const pascal = (id: string) => id.replace(/(^|-)(\w)/g, (_m, _d, c: string) => c.toUpperCase());

function auto(photo: PhotoEditorView, which: 'tone' | 'contrast' | 'colour'): string | null {
  const s = photo.session!;
  const a = startApplying(s);
  if (typeof a === 'string')
    return a === 'rasterize' ? 'Rasterize the layer to adjust its pixels.' : a;
  // The levels the histogram calls for, applied as a Levels adjustment.
  const pic = s.raster(a.layerId, a.target).read({
    x: a.area.x - a.at.x,
    y: a.area.y - a.at.y,
    width: a.area.width,
    height: a.area.height,
  });
  const h = histogramOf(pic, 4);
  const params =
    which === 'tone' ? autoTone(h) : which === 'contrast' ? autoContrast(h) : autoColour(h);
  adjustArea(s, a, { id: 'levels', params });
  commitApplying(
    s,
    a,
    which === 'tone' ? 'Auto Tone' : which === 'contrast' ? 'Auto Contrast' : 'Auto Colour',
  );
  track('Element', 'Changed', `PhotoAuto${pascal(which)}`);
  return null;
}

/** Runs a photo command; a refusal is toasted. */
export function runPhotoAction(id: string, photo: PhotoEditorView): void {
  const s = photo.session;
  const ctx = photo.ctx;
  if (!s || !ctx || !photo.canEdit) return;
  const colours = photoTools.get();
  const say = (r: string | null | void) => {
    if (r) photo.toast(r);
  };
  const later = (p: Promise<string | null>) => void p.then(say);
  const layerOp = (name: string, r: string | null | void) => {
    say(r);
    if (!r) track('Element', 'Changed', `PhotoLayer${name}`);
  };
  const size = (name: string, r: string | null | void) => {
    say(r);
    if (!r) track('Tab', 'Changed', name);
  };
  const active = s.active;
  // The layers chosen together (the Layers tab's Shift and Ctrl/Cmd+press), else the active one.
  const hand = s.inHand();
  const letGo = () => {
    s.chosen = new Set();
  };
  switch (id) {
    case 'auto-tone':
      return say(auto(photo, 'tone'));
    case 'auto-contrast':
      return say(auto(photo, 'contrast'));
    case 'auto-colour':
      return say(auto(photo, 'colour'));
    case 'image-size':
      return photoDialogs.open({ kind: 'image-size' });
    case 'canvas-size':
      return photoDialogs.open({ kind: 'canvas-size' });
    case 'rotate':
      return photoDialogs.open({ kind: 'rotate' });
    case 'rotate-cw':
      rotateQuarterTurn(s, 90);
      return size('PhotoRotated', null);
    case 'rotate-ccw':
      rotateQuarterTurn(s, 270);
      return size('PhotoRotated', null);
    case 'rotate-180':
      rotateQuarterTurn(s, 180);
      return size('PhotoRotated', null);
    case 'flip-h':
      flipImage(s, true);
      return size('PhotoFlipped', null);
    case 'flip-v':
      flipImage(s, false);
      return size('PhotoFlipped', null);
    case 'crop-to-selection': {
      const b = s.selection ? maskBounds(s.selection) : null;
      if (!b) return say('Make a selection first.');
      return size('PhotoCropped', cropTo(s, b));
    }
    case 'trim':
      return size('PhotoTrimmed', trimTransparent(s));
    case 'place-picture':
      return photoDialogs.open({ kind: 'place' });
    case 'make-sizes':
      if (!s.photo.layers.length)
        return say('Start the photo first: there is nothing to make sizes from.');
      if (!photo.addSizes || photo.photoRoom < 1)
        return say('A tab holds up to 10 photo pages. Delete one to make sizes.');
      return photoDialogs.open({ kind: 'make-sizes' });
    case 'step-backward':
      return photo.stepHistory(-1);
    case 'fit-photo':
      return photo.fitPhoto();
    case 'actual-pixels':
      return photo.actualPixels();
    case 'pixel-grid':
      photoViewOptions.set({ pixelGrid: !photoViewOptions.get().pixelGrid });
      track('UI', 'Changed', 'PhotoPixelGrid');
      return;
    case 'free-transform':
      if (beginTransform(ctx)) track('Element', 'Used', 'PhotoFreeTransform');
      return;
    case 'select-all':
      return selectAll(s);
    case 'deselect':
      return deselect(s);
    case 'reselect':
      return reselect(s);
    case 'inverse':
      return inverse(s);
    case 'subject':
      track('Element', 'Used', 'PhotoSelectSubject');
      return later(photoBusy.run('Finding the subject…', selectSubject(s)));
    case 'remove-background':
      track('Element', 'Changed', 'PhotoRemoveBackground');
      return later(photoBusy.run('Removing the background…', removeBackground(s)));
    case 'colour-range':
      return photoDialogs.open({ kind: 'colour-range' });
    case 'select-and-mask':
      if (!s.selection) return say('Make a selection first.');
      return photoDialogs.open({ kind: 'select-and-mask' });
    case 'grow':
    case 'expand':
    case 'contract':
    case 'border':
    case 'smooth':
    case 'feather':
      if (!s.selection) return say('Make a selection first.');
      return photoDialogs.open({ kind: 'modify', how: id });
    case 'new-layer':
      newLayer(s);
      return layerOp('New', null);
    case 'new-group':
      newGroup(s, []);
      return layerOp('NewGroup', null);
    case 'duplicate':
      // With a selection, Ctrl/Cmd+J is Layer Via Copy.
      if (s.selection) return layerOp('ViaCopy', layerVia(s, false));
      duplicate(s, hand);
      letGo();
      return layerOp('Duplicate', null);
    case 'delete-layer':
      if (!hand.length) return;
      if (removeLayers(s.photo, hand).layers.length === 0)
        return say('A photo keeps at least one layer: add another first.');
      deleteLayers(s, hand);
      letGo();
      return layerOp('Delete', null);
    case 'group':
      if (hand.length) newGroup(s, hand);
      letGo();
      return layerOp('Group', null);
    case 'ungroup':
      if (active) ungroupLayer(s, active);
      return layerOp('Ungroup', null);
    case 'merge-down':
      // With several chosen, Merge Layers.
      return hand.length > 1
        ? void mergeLayers(s, hand).then((r) => layerOp('MergeLayers', r))
        : void mergeDown(s).then((r) => layerOp('MergeDown', r));
    case 'bring-forward':
      arrangeLayer(s, 'forward');
      return layerOp('Arranged', null);
    case 'send-backward':
      arrangeLayer(s, 'backward');
      return layerOp('Arranged', null);
    case 'bring-to-front':
      arrangeLayer(s, 'front');
      return layerOp('Arranged', null);
    case 'send-to-back':
      arrangeLayer(s, 'back');
      return layerOp('Arranged', null);
    case 'select-layer-above':
      return stepActive(s, 1);
    case 'select-layer-below':
      return stepActive(s, -1);
    case 'merge-visible':
      return void mergeVisible(s).then((r) => layerOp('MergeVisible', r));
    case 'flatten':
      if (flattenDiscards(s.photo)) return photoDialogs.open({ kind: 'flatten' });
      return void flatten(s).then((r) => layerOp('Flatten', r));
    case 'clip':
      if (active) toggleClip(s, active);
      return layerOp('Clip', null);
    case 'add-mask':
      return active
        ? layerOp('AddMask', addMask(s, active, s.selection ? 'selection' : 'reveal'))
        : undefined;
    case 'apply-mask':
      return active ? layerOp('ApplyMask', applyMask(s, active)) : undefined;
    case 'delete-mask':
      if (active) deleteMask(s, active);
      return layerOp('DeleteMask', null);
    case 'toggle-mask':
      if (active) toggleMask(s, active);
      return layerOp('ToggleMask', null);
    case 'invert-mask':
      if (active) invertMask(s, active);
      return layerOp('InvertMask', null);
    case 'select-mask':
      if (active) selectMask(s, active);
      return;
    case 'rasterize':
      return active ? layerOp('Rasterize', rasterize(s, active)) : undefined;
    case 'rasterize-effects':
      return active ? layerOp('RasterizeEffects', rasterizeEffects(s, active)) : undefined;
    case 'layer-via-copy':
      return layerOp('ViaCopy', layerVia(s, false));
    case 'layer-via-cut':
      return layerOp('ViaCut', layerVia(s, true));
    case 'select-pixels':
      return active ? say(selectPixels(s, active)) : undefined;
    case 'fill':
      return photoDialogs.open({ kind: 'fill' });
    case 'content-aware':
      track('Element', 'Changed', 'PhotoContentAwareFill');
      return later(photoBusy.run('Filling from the surroundings…', contentAwareFill(s)));
    case 'fill-foreground':
      return say(fillSelection(s, { contents: 'foreground' }, colours) as string | null);
    case 'fill-background':
      return say(fillSelection(s, { contents: 'background' }, colours) as string | null);
    case 'clear':
      if (!s.selection) return runPhotoAction('delete-layer', photo);
      return say(clearSelection(s, colours.background));
    case 'copy':
      return later(copy(s, false));
    case 'copy-merged':
      return later(copy(s, true));
    case 'cut':
      return later(cut(s, colours.background));
    case 'paste':
    case 'paste-in-place':
      if (!paste(s, id === 'paste-in-place')) say('Nothing copied from a photo yet.');
      return;
    case 'repeat-filter': {
      const last = lastPhotoFilter.get();
      if (!last) return say('No filter used yet.');
      const a = startApplying(s);
      if (typeof a === 'string')
        return say(a === 'rasterize' ? 'Rasterize the layer to filter its pixels.' : a);
      void filterArea(s, a, last.id, last.params, colours).done.then((ok) => {
        if (ok) commitApplying(s, a, 'Filter');
      });
      track('Element', 'Changed', `PhotoFilter${pascal(last.id)}`);
      return;
    }
  }
}

/** An adjustment from the Image menu: its dialog. */
export function openAdjustment(id: AdjustmentId): void {
  photoDialogs.open({ kind: 'adjust', id });
}
