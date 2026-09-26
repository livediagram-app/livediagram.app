// Copy / paste for the editor, lifted out of editor-page.tsx.
//
// Cmd+C puts the selection on the OS CLIPBOARD, serialised (docs/specs/008-canvas/canvas-and-palette.md
// "Clipboard", lib/clipboard-payload.ts). Cmd+V reads it back, re-mints it
// through duplicateElements so ids are remapped and pinned arrows
// re-wired, and drops the copies on the active tab.
//
// It used to be in-app only: the snapshot lived in React state and the OS
// clipboard got a sentinel string, written purely to displace a lingering
// image. That works within one editor instance and nowhere else — component
// state cannot cross a browser tab, a second window, or a reload, which is
// where "copy this and put it in that diagram" actually happens. The real
// elements go on the clipboard now.
//
// The in-app buffer is KEPT as a fallback rather than deleted. Clipboard
// writes are best-effort (writeText rejects when the document isn't focused,
// and permission can be denied outright), and a copy that silently did
// nothing would be much worse than one that still pastes in the tab you are
// in. So copy writes both, and paste prefers what is actually on the
// clipboard — which is the newer of the two whenever they disagree, because
// it is the one another window could have written since.
//
// Three sources compete on paste, in this order: an image file (a screenshot
// on the system clipboard), our own serialised elements, then the in-app
// buffer. Ordinary text is left to the browser.
//
// Only `copySelection` is returned — it's wired into the keyboard
// shortcut hook. Paste is driven entirely by the native `paste` event
// the hook registers, so `pasteFromClipboard` / `pasteImageFile` stay
// internal.

import { useEffect, useRef, useState } from 'react';
import { duplicateElements, type Element, type Tab } from '@livediagram/diagram';
import { anyModalOpen } from '@/lib/modal-guard';
import { parseElementsPayload, serialiseElements, stripIdentity } from '@/lib/clipboard-payload';
import { addImageFileForDiagram } from '@/lib/upload-image';
import { track } from '@/lib/telemetry';
import { trackDuplicated } from '@/lib/element-telemetry';
import type { useToast } from '@/hooks/ui/useToast';

type ImageDescriptor = {
  id: string;
  width: number;
  height: number;
  originalName?: string;
};

type ClipboardDeps = {
  isReadOnly: boolean;
  // Editable embeds (docs/specs/013-workspace/embeds.md) still don't paste-upload images — see
  // pasteImageFile.
  embedMode: boolean;
  selectedId: string | null;
  multiSelectedIds: Set<string>;
  editingId: string | null;
  // Ends typing in a label: pasting copied elements while a note is open for
  // typing puts them on the canvas, not in the note.
  setEditingId: (id: string | null) => void;
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
  // The current diagram id (null before hydration). Offline diagrams embed
  // pasted images locally instead of uploading (docs/specs/006-diagram/offline-mode.md).
  diagramId: string | null;
  toast: ReturnType<typeof useToast>;
  // Read a pasted PHOTO as a piece of wall instead of placing it as an image
  // (docs/specs/021-event-storming/event-storming.md Phase 8). Supplied only on an event-storming board with the
  // reader available; absent everywhere else, where paste is untouched.
  onPastePhoto?: (file: File) => void;
};

export function useClipboard(deps: ClipboardDeps) {
  const {
    isReadOnly,
    embedMode,
    selectedId,
    multiSelectedIds,
    editingId,
    setEditingId,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId,
    diagramId,
    toast,
    onPastePhoto,
  } = deps;

  const [clipboard, setClipboard] = useState<Element[] | null>(null);
  // Did the last copy actually reach the OS clipboard? It decides who wins
  // when the clipboard holds text that ISN'T ours (see the paste handler):
  // if our write landed, foreign text means the user copied something else
  // afterwards, so the in-app buffer is stale and must not paste. If the
  // write was refused, that buffer is the only record of the copy and has to
  // keep working.
  const osWriteOk = useRef(false);

  const copySelection = () => {
    if (isReadOnly) return;
    const idSet =
      multiSelectedIds.size > 0
        ? new Set(multiSelectedIds)
        : selectedId !== null
          ? new Set([selectedId])
          : null;
    if (!idSet || idSet.size === 0) return;
    const snapshot = activeTab.elements
      .filter((el) => idSet.has(el.id))
      // Deep clone so a later edit to the originals doesn't bleed
      // into a future paste.
      .map((el) => JSON.parse(JSON.stringify(el)) as Element)
      // Same stripping as the OS clipboard copy: the in-app buffer is the
      // fallback paste, and it used to carry comments, poll answers and
      // assigned actions onto the copies.
      .map(stripIdentity);
    if (snapshot.length === 0) return;
    setClipboard(snapshot);
    // The elements themselves onto the OS clipboard, so another window can
    // paste them. This ALSO does what the old sentinel string was there for:
    // it displaces any image left on the clipboard by an earlier copy, which
    // would otherwise shadow every later element paste (the paste handler
    // prefers an image, and the in-app copy never used to touch the system
    // clipboard, so a stale screenshot re-dropped itself forever).
    //
    // Best-effort by necessity: writeText rejects when the document isn't
    // focused or permission is denied, and there is nothing useful to say to
    // the user about it — the in-app buffer above still pastes in this
    // window, which is what they were about to do anyway.
    osWriteOk.current = false;
    void navigator.clipboard
      ?.writeText?.(serialiseElements(snapshot))
      .then(() => {
        osWriteOk.current = true;
      })
      .catch(() => {});
    track('Element', 'Copied');
  };

  // `source` is what the OS clipboard carried, when it carried ours. Absent
  // for a paste that found nothing on the system clipboard, which falls back
  // to the in-app buffer.
  const pasteFromClipboard = (source?: Element[]) => {
    if (isReadOnly) return;
    const pasting = source && source.length > 0 ? source : clipboard;
    if (!pasting || pasting.length === 0) return;
    const offset = 24;
    const clipIds = new Set(pasting.map((el) => el.id));
    // Clipboard ids may not exist in the current tab (the source
    // was deleted, the user pasted into a different tab, etc.).
    // Temporarily merge them in so duplicateElements can do
    // its id-remap + arrow-rewire. Only the freshly-minted copies
    // get committed back, not the merged sources. The SNAPSHOT copy
    // wins over a live element with the same id — pasting must
    // reproduce what was copied, not the element as it has since
    // been edited (that's what the copy-time deep clone is for).
    const merged = [...activeTab.elements.filter((el) => !clipIds.has(el.id)), ...pasting];
    const { newElements } = duplicateElements(merged, clipIds, offset, offset);
    if (newElements.length === 0) return;
    commit((els) => [...els, ...newElements]);
    if (newElements.length === 1) {
      setSelectedId(newElements[0]!.id);
      setMultiSelectedIds(new Set());
    } else {
      setSelectedId(null);
      setMultiSelectedIds(new Set(newElements.map((el) => el.id)));
    }
    trackDuplicated(newElements);
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
    // Embeds never upload (docs/specs/013-workspace/embeds.md): the upload endpoint authorises by owner
    // identity, which inside a partitioned iframe is a throwaway guest.
    if (embedMode) return;
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
      // Cloud diagrams upload; offline diagrams embed the paste locally
      // as a data URI (docs/specs/006-diagram/offline-mode.md) so no server copy is created.
      const { image } = await addImageFileForDiagram(ownerId, diagramId, named);
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
  const pasteRef = useRef({ pasteFromClipboard, pasteImageFile, onPastePhoto });
  pasteRef.current = { pasteFromClipboard, pasteImageFile, onPastePhoto };

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
      // A modal dialog owns paste while open — Cmd+V with a dialog up
      // must not drop elements on the canvas behind it.
      if (anyModalOpen()) return;
      // A closer handler already claimed the paste (the table's
      // selected-cell paste runs in the capture phase) — don't also drop
      // the element clipboard on the canvas.
      if (e.defaultPrevented) return;
      const target = e.target as Element | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
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
          // On an event-storming board a pasted PHOTO is far more likely a
          // piece of wall than a picture element (docs/specs/021-event-storming/event-storming.md Phase 8), so it
          // goes to the reader instead. Only for a declared image, only on
          // that board, only when the reader is available: everything else
          // pastes exactly as it always has.
          const readPhoto = pasteRef.current.onPastePhoto;
          if (readPhoto && chosen.type.startsWith('image/')) {
            readPhoto(chosen);
            return;
          }
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
              const readPhoto = pasteRef.current.onPastePhoto;
              if (readPhoto) {
                readPhoto(file);
                return;
              }
              void pasteRef.current.pasteImageFile(file);
              return;
            }
          }
        }
      }
      // No image on the system clipboard. Our own serialised elements next
      // (written by Cmd+C, here or in another window), then the in-app buffer.
      //
      // Read from the EVENT rather than navigator.clipboard.readText(): the
      // event's data needs no permission prompt and arrives synchronously, so
      // the paste cannot land a frame later than the preventDefault that
      // claimed it.
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const fromOs = parseElementsPayload(text);
      if (fromOs) {
        e.preventDefault();
        pasteRef.current.pasteFromClipboard(fromOs);
        return;
      }
      // Text on the clipboard that isn't ours, and our own copy DID reach the
      // clipboard: the user has copied something else since, so the in-app
      // buffer is stale. Pasting it would drop elements the user copied ten
      // minutes ago in response to them copying a sentence just now, which is
      // the kind of surprise that makes people stop trusting Cmd+V.
      //
      // Left to the browser, which does nothing with text outside an input.
      // Turning that text into a text element is the obvious next step and is
      // deliberately not done here — it needs the viewport centre in canvas
      // coordinates, which lives in Canvas rather than in this hook.
      if (text.trim().length > 0 && osWriteOk.current) return;
      // Nothing readable on the system clipboard (or our write was refused,
      // making the in-app buffer the only record of the copy).
      e.preventDefault();
      pasteRef.current.pasteFromClipboard();
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isReadOnly, editingId]);

  // Copied ELEMENTS pasted while a label on the canvas is open for typing. The
  // clipboard carries them as JSON text, and every label editor pastes plain
  // text — so without this the JSON was typed into the note. Claimed in the
  // CAPTURE phase, before the editor sees it: typing ends and the elements
  // land on the canvas, exactly as if the note had not been open.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isReadOnly || editingId === null) return;
    const onPasteIntoLabel = (e: ClipboardEvent) => {
      if (anyModalOpen()) return;
      const target = e.target as Element | null;
      if (!(target instanceof HTMLElement) || !target.isContentEditable) return;
      if (!target.closest('[data-canvas-a11y-root]')) return;
      const elements = parseElementsPayload(e.clipboardData?.getData('text/plain'));
      if (!elements) return;
      e.preventDefault();
      e.stopPropagation();
      setEditingId(null);
      pasteRef.current.pasteFromClipboard(elements);
    };
    document.addEventListener('paste', onPasteIntoLabel, true);
    return () => document.removeEventListener('paste', onPasteIntoLabel, true);
  }, [isReadOnly, editingId, setEditingId]);

  // `hasClipboard` backs the canvas menu's Paste row (docs/specs/008-canvas/canvas-and-palette.md): the row is
  // always THERE — a menu that changes shape with invisible state is a menu
  // you can't learn — and greys out when the buffer is empty. It reports the
  // in-app buffer only; a copy made in another window lives on the OS
  // clipboard, which can't be read synchronously while rendering a menu, and
  // Cmd+V still pastes it.
  return { copySelection, pasteFromClipboard, hasClipboard: (clipboard?.length ?? 0) > 0 };
}
