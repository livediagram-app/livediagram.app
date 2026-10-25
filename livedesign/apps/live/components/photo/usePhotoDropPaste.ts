'use client';

// Pictures dropped on or pasted into a photo page (docs/specs/031-photo/photo-pages.md "Making a
// photo page", photo-tools.md "The clipboard"): on a photo with no pixels yet, a picture starts it;
// on a started photo, it lands as a new layer, centred, with Free Transform on it. A paste with a
// photo tool in hand pastes the photo's own copy (in place with Shift) when the clipboard holds it.
// With the select pointer on a started photo, a paste stays the canvas's (an image element).
import { useEffect } from 'react';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { paste } from '@/lib/photo-editor/clipboard';
import { photoStarted, readPicture } from '@/lib/photo-editor/start-photo';
import { photoTools } from '@/lib/photo-editor/tool-state';
import { beginTransform } from '@/lib/photo-editor/tools/transform-tool';
import { track } from '@/lib/telemetry';
import { typingSomewhere } from './PhotoCanvasOverlays';
import { startWithPicture } from './StartPhotoCard';

const pictureOf = (list: DataTransferItemList | FileList | null | undefined): File | null => {
  if (!list) return null;
  for (const item of Array.from(list as ArrayLike<DataTransferItem | File>)) {
    const file = 'getAsFile' in item ? (item.kind === 'file' ? item.getAsFile() : null) : item;
    if (file && (file.type.startsWith('image/') || /\.psd$/i.test(file.name))) return file;
  }
  return null;
};

/** The photo page under a screen point, if any. */
function photoPageAt(x: number, y: number): string | null {
  for (const el of document.querySelectorAll('[data-photo-page]')) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x < r.right && y >= r.top && y < r.bottom)
      return el.getAttribute('data-photo-page');
  }
  return null;
}

/** A picture into the photo in focus: it starts an unstarted photo, else becomes a layer. */
async function takePicture(photo: PhotoEditorView, file: File, inPlace = false): Promise<void> {
  const s = photo.session;
  const ctx = photo.ctx;
  if (!s || !ctx) return;
  const read = await readPicture(file);
  if (!photoStarted(s.photo)) return startWithPicture(photo, read);
  if (read.kind === 'refused') return photo.toast(read.reason);
  if (read.kind === 'psd')
    return photo.toast('A PSD opens on a new photo page: add one and drop it there.');
  if (paste(s, inPlace, { raster: read.picture.raster, bytes: file.size })) {
    track('Element', 'Changed', 'PhotoLayerPlacePicture');
    beginTransform(ctx);
  }
}

export function usePhotoDropPaste(live: PhotoEditorView | null): void {
  // The handlers read the photo as it is when they run (a drop waits for the page's session).
  const latest = useLatest(live);
  const on = live !== null;
  useEffect(() => {
    if (!on) return;
    let inPlace = false;
    const keydown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+Shift+V: the paste that follows lands in place.
      inPlace = (e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'v';
    };
    const onPaste = (e: ClipboardEvent) => {
      const photo = latest.current;
      if (typingSomewhere() || !photo?.session) return;
      const file = pictureOf(e.clipboardData?.items);
      const inHand = photoTools.get().tool !== null;
      const started = photoStarted(photo.session.photo);
      if (!inHand && started) return;
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        void takePicture(photo, file, inPlace);
      } else if (inHand && paste(photo.session, inPlace)) {
        e.preventDefault();
        e.stopPropagation();
      }
      inPlace = false;
    };
    const over = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      if (photoPageAt(e.clientX, e.clientY)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    };
    const drop = (e: DragEvent) => {
      const photo = latest.current;
      const id = photoPageAt(e.clientX, e.clientY);
      const file = pictureOf(e.dataTransfer?.files);
      if (!id || !file || !photo?.canEdit) return;
      e.preventDefault();
      e.stopPropagation();
      photo.press(id);
      // The page dropped on is in focus once its session is: then the picture goes in.
      const go = () => {
        const now = latest.current;
        if (now?.session?.pageId === id) void takePicture(now, file);
        else now?.toast('Drop the picture again once the photo has opened.');
      };
      if (photo.session?.pageId === id) go();
      else setTimeout(go, 300);
    };
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('paste', onPaste, true);
    window.addEventListener('dragover', over, true);
    window.addEventListener('drop', drop, true);
    return () => {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('paste', onPaste, true);
      window.removeEventListener('dragover', over, true);
      window.removeEventListener('drop', drop, true);
    };
  }, [on, latest]);
}
