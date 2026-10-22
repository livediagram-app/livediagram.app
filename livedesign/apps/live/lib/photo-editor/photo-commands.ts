// A photo page's commands in the command palette (docs/specs/031-photo/photo-pages.md "The title
// bar"): every menu item prefixed `Photo:`, the applied adjustments and the filters, while a photo
// page is in focus for someone who may edit it. Each runs what its menu row runs.
import {
  ADJUSTMENT_IDS,
  adjustmentName,
  FILTERS,
  type AdjustmentId,
} from '@livedesign/photo-engine';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import type { CommandSearchItem } from '../search';
import { photoDialogs } from './photo-dialog-store';
import { openAdjustment, PHOTO_ACTIONS, runPhotoAction } from './photo-actions';

const PREFIX = 'photo:';

export function photoCommandItems(): CommandSearchItem[] {
  return [
    ...PHOTO_ACTIONS.map((a) => ({
      id: `${PREFIX}${a.id}`,
      name: `Photo: ${a.label.replace(/…$/, '')}`,
      keywords: `photo image ${a.menu.toLowerCase()} ${a.label.toLowerCase()}`,
    })),
    ...ADJUSTMENT_IDS.map((id) => ({
      id: `${PREFIX}adjust:${id}`,
      name: `Photo: ${adjustmentName(id)}`,
      keywords: `photo adjustment ${adjustmentName(id).toLowerCase()}`,
    })),
    ...Object.values(FILTERS).map((f) => ({
      id: `${PREFIX}filter:${f.id}`,
      name: `Photo: ${f.name}`,
      keywords: `photo filter ${f.category} ${f.name.toLowerCase()}`,
    })),
  ];
}

/** Runs a photo command by its id; false when the id is not a photo command. */
export function runPhotoCommand(id: string, photo: PhotoEditorView | undefined): boolean {
  if (!id.startsWith(PREFIX)) return false;
  if (!photo?.session || !photo.canEdit) return true;
  const rest = id.slice(PREFIX.length);
  if (rest.startsWith('adjust:')) openAdjustment(rest.slice('adjust:'.length) as AdjustmentId);
  else if (rest.startsWith('filter:'))
    photoDialogs.open({ kind: 'filter', id: rest.slice('filter:'.length) });
  else runPhotoAction(rest, photo);
  return true;
}
