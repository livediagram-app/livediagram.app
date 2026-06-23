// Copy / paste for the editor, lifted out of editor-page.tsx.
// Two clipboards cooperate here:
//
// - The in-app element clipboard (`clipboard` state): Cmd-C snapshots
//   the current selection; Cmd-V (when the OS clipboard has no image)
//   re-mints the snapshot onto the active tab via duplicateGrouped
//   Elements so ids are remapped and pinned arrows re-wired.
// - The OS clipboard: a global `paste` listener intercepts Cmd-V. If
//   the system clipboard carries an image (screenshot, copy-image),
//   it routes the bytes through the image-upload pipeline instead;
//   otherwise it falls through to the in-app element clipboard.
//
// Session-only on purpose: `clipboard` lives in React state so a
// refresh clears it (matching every browser's "clipboard gone on
// reload"), but it survives tab switches + selection changes so the
// user can copy in one tab and paste in another.
//
// Only `copySelection` is returned — it's wired into the keyboard
// shortcut hook. Paste is driven entirely by the native `paste` event
// the hook registers, so `pasteFromClipboard` / `pasteImageFile` stay
// internal.

import { useEffect, useRef, useState } from 'react';
import { duplicateGroupedElements, type Element, type Tab } from '@livediagram/diagram';
import { uploadImageFile } from '@/lib/upload-image';
import { track } from '@/lib/telemetry';
import type { useToast } from '@/hooks/ui/useToast';

// Written to the OS clipboard on an in-app element copy purely to displace
// any lingering image (see copySelection). The paste handler only inspects
// clipboard files/items, never text, so this string is never read back — it
// just guarantees the OS clipboard no longer carries an image that would
// shadow the in-app element clipboard.
const OS_CLIPBOARD_SENTINEL = 'livediagram:elements-copied';

type ImageDescriptor = {
  id: string;
  width: number;
  height: number;
  originalName?: string;
};

type ClipboardDeps = {
  isReadOnly: boolean;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  // Group members of an element id (the element alone when ungrouped).
  memberIdsOf: (id: string | null) => Set<string>;
  activeTab: Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  // Drops a new image element pre-filled with an uploaded image. From
  // useEditorImages; undefined when image support is unavailable (no
  // diagram id / read-only), in which case image paste is a no-op.
  addImageFromGallery?: (image: ImageDescriptor) => void;
  // The local participant id — owner of uploaded paste images.
  ownerId: string;
  toast: ReturnType<typeof useToast>;
};

export function useClipboard(deps: ClipboardDeps) {
  const {
    isReadOnly,
    selectedId,
    multiSelectedIds,
    editingId,
    memberIdsOf,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId,
    toast,
  } = deps;

  const [clipboard, setClipboard] = useState<Element[] | null>(null);

  const copySelection = () => {
    if (isReadOnly) return;
    const idSet =
      multiSelectedIds.size > 0
        ? new Set(multiSelectedIds)
        : selectedId !== null
          ? memberIdsOf(selectedId)
          : null;
    if (!idSet || idSet.size === 0) return;
    const snapshot = activeTab.elements
      .filter((el) => idSet.has(el.id))
      // Deep clone so a later edit to the originals doesn't bleed
      // into a future paste.
      .map((el) => JSON.parse(JSON.stringify(el)) as Element);
    if (snapshot.length === 0) return;
    setClipboard(snapshot);
    // Clear the OS clipboard so a previously-copied image stops shadowing
    // this copy. The paste handler prefers an image on the OS clipboard over
    // the in-app element clipboard, but the in-app Cmd+C never touched the OS
    // clipboard — so once a user had pasted an image, that image lingered and
    // every later element paste re-dropped the stale image instead of the new
    // copy. Overwriting with a sentinel (Cmd+C is a user gesture, so writeText
    // is permitted) makes the next paste see no image and fall through to the
    // in-app clipboard. Best-effort: writeText can reject if the document
    // isn't focused or permission is denied; the in-app copy still works.
    void navigator.clipboard?.writeText?.(OS_CLIPBOARD_SENTINEL).catch(() => {});
    track('Element', 'Copied');
  };

  const pasteFromClipboard = () => {
    if (isReadOnly) return;
    if (!clipboard || clipboard.length === 0) return;
    const offset = 24;
    const clipIds = new Set(clipboard.map((el) => el.id));
    // Clipboard ids may not exist in the current tab (the source
    // was deleted, the user pasted into a different tab, etc.).
    // Temporarily merge them in so duplicateGroupedElements can do
    // its id-remap + arrow-rewire. Only the freshly-minted copies
    // get committed back, not the merged sources.
    const existingIds = new Set(activeTab.elements.map((el) => el.id));
    const novel = clipboard.filter((el) => !existingIds.has(el.id));
    const merged = [...activeTab.elements, ...novel];
    const { newElements } = duplicateGroupedElements(merged, clipIds, offset, offset);
    if (newElements.length === 0) return;
    commit((els) => [...els, ...newElements]);
    if (newElements.length === 1) {
      setSelectedId(newElements[0]!.id);
      setMultiSelectedIds(new Set());
    } else {
      setSelectedId(null);
      setMultiSelectedIds(new Set(newElements.map((el) => el.id)));
    }
    track('Element', 'Duplicated');
  };

  // Paste a file (typically a clipboard image) by routing it through
  // the same upload pipeline as the picker: validate + hash, POST to
  // /api/images, then drop a new image element on the canvas
  // pre-filled with the uploaded image's id + natural dimensions.
  // The OS clipboard hand off doesn't carry a filename for inline
  // images (screenshots etc.), so we synthesise one from the MIME
  // suffix so the gallery has something to render in the title slot.
  const pasteImageFile = async (file: File) => {
    if (!addImageFromGallery) return;
    // Browsers hand inline screenshots over with file.name === ""
    // or "image.png"; synthesise a clearer name so the gallery row
    // doesn't read as "image.png" for everything pasted.
    const named =
      file.name && file.name !== 'image.png'
        ? file
        : new File([file], `pasted-${Date.now()}.${file.type.split('/')[1] ?? 'png'}`, {
            type: file.type,
          });
    try {
      const { image } = await uploadImageFile(ownerId, named);
      addImageFromGallery({
        id: image.id,
        width: image.width,
        height: image.height,
        originalName: image.originalName,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not paste the image.');
    }
  };

  // Single mutable ref holding the latest paste functions. The paste
  // event listener is only re-registered when isReadOnly/editingId
  // changes, so without this the listener would call stale closures
  // that see clipboard=null even after the user has copied elements.
  const pasteRef = useRef({ pasteFromClipboard, pasteImageFile });
  pasteRef.current = { pasteFromClipboard, pasteImageFile };

  // System-clipboard paste handler. Cmd/Ctrl+V triggers the browser's
  // native `paste` event, which carries whatever the OS clipboard
  // holds (text, files, images). When the user has an image on
  // their clipboard (a screenshot, a copy-image-from-browser, etc.),
  // route it to the image-upload path so a new image element lands
  // on the canvas pre-filled with the bytes. When the clipboard has
  // no image, fall back to the in-app element clipboard so pasting
  // copied canvas elements still works as before. Text-input focus
  // is left to the browser's default (let users paste text into a
  // label / comment composer the normal way).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as Element | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (isReadOnly) return;
      if (editingId !== null) return;
      // Prefer the typed `files` list over iterating `items`: some
      // browsers / OS clipboards report an image as a `file` item
      // with an empty or generic MIME type (e.g.
      // `application/octet-stream` for a Finder copy), which the
      // old image/* check missed and dropped through to the in-app
      // clipboard, pasting the user's previously-copied canvas
      // elements alongside the expected image. `dataTransfer.files`
      // is the authoritative file list and works the same way for
      // every browser.
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        // Pick the first image file, or the first file overall when
        // none declare an image MIME (some clipboards strip the type
        // hint). pasteImageFile validates the bytes via the upload
        // pipeline, so a non-image file just produces a toast and a
        // no-op without polluting the canvas.
        let chosen: File | null = null;
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            chosen = file;
            break;
          }
        }
        if (!chosen) chosen = files[0] ?? null;
        if (chosen) {
          e.preventDefault();
          void pasteRef.current.pasteImageFile(chosen);
          return;
        }
      }
      // Belt-and-braces: also check items in case `files` is empty
      // but an image item is present (Safari edge case). Same early
      // return so we never fall through to pasteFromClipboard when
      // the system clipboard had image content the user expected.
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]!;
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              void pasteRef.current.pasteImageFile(file);
              return;
            }
          }
        }
      }
      // No image / file on the system clipboard: fall through to the
      // editor's own element clipboard (the Cmd+C copy buffer).
      e.preventDefault();
      pasteRef.current.pasteFromClipboard();
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isReadOnly, editingId]);

  return { copySelection };
}
