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
// where "copy this and put it in that document" actually happens. The real
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

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { useRef, useState, type RefObject } from 'react';
import {
  duplicateElements,
  withMindBranches,
  withAttached,
  type Element,
  type Tab,
} from '@livediagram/document';
import {
  clipboardWriteFor,
  copyTooLargeMessage,
  IN_APP_COPY_ELSEWHERE,
  stripIdentity,
} from '@/lib/clipboard-payload';
import { landPastedCopies, pasteTranslation } from '@/lib/paste-placement';
import { addImageFileForDocument } from '@/lib/upload-image';
import { DROP_NOT_A_SCENE, isExcalidrawFileCandidate } from '@/lib/excalidraw-paste';
import type { BoardScene } from '@/lib/board-scene/scene';
import { track } from '@/lib/telemetry';
import { trackDuplicated } from '@/lib/element-telemetry';
import type { useToast } from '@/hooks/ui/useToast';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { dropImportHint } from '@/lib/drop-import-hint';
import { useClipboardPaste, type PasteHandlers } from './useClipboardPaste';

type ImageDescriptor = {
  id: string;
  width: number;
  height: number;
  originalName?: string;
};

type ClipboardDeps = {
  isReadOnly: boolean;
  // True while new elements can't land: edits are blocked, or the active layer
  // is hidden or locked (docs/specs/006-document/layers.md). A paste adds
  // elements, so it obeys the same guard as every other creation path.
  createBlocked?: boolean;
  // Says why a paste was refused (the layers slice's blocked-creation notice).
  // A paste is a deliberate keystroke with nothing on screen to show it was
  // ignored, so unlike the palette gates it explains itself every time.
  explainCreateBlocked?: () => void;
  // Editable embeds (docs/specs/013-workspace/embeds.md) still don't paste-upload images — see
  // pasteImageFile.
  embedMode: boolean;
  // Read when a copy runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  editingId: string | null;
  // Ends typing in a label: pasting copied elements while a note is open for
  // typing puts them on the canvas, not in the note.
  setEditingId: (id: string | null) => void;
  activeTab: Tab;
  // Elements on a locked layer (docs/specs/006-document/layers.md): a delete leaves them, so a Cut copies none.
  layerLockedIds?: ReadonlySet<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  // Drops a new image element pre-filled with an uploaded image. From
  // useEditorImages; undefined when image support is unavailable (no
  // document id / read-only), in which case image paste is a no-op.
  addImageFromGallery?: (image: ImageDescriptor, at?: { x: number; y: number }) => void;
  // The local participant id — owner of uploaded paste images.
  ownerId: string;
  // The current document id (null before hydration). Offline documents embed
  // pasted images locally instead of uploading (docs/specs/006-document/offline-mode.md).
  documentId: string | null;
  toast: ReturnType<typeof useToast>;
  // Read a pasted PHOTO as a piece of wall instead of placing it as an image
  // (docs/specs/021-event-storming/event-storming.md Phase 8). Supplied only on an event-storming board with the
  // reader available; absent everywhere else, where paste is untouched.
  onPastePhoto?: (file: File) => void;
  // Where the pointer is on the canvas, in canvas coords; null while it is
  // off the canvas (over a panel, outside the window). On an event-storming
  // board a paste holding a workshop note lands there
  // (docs/specs/021-event-storming/event-storming.md "Always on a lane").
  canvasPointerRef?: RefObject<{ x: number; y: number } | null>;
  // The canvas-coord rectangle on screen; a paste whose usual spot is outside
  // it lands in its middle (docs/specs/008-canvas/canvas-and-palette.md Clipboard).
  getViewportCanvasRect?: () => { x: number; y: number; width: number; height: number } | null;
  // Lands a board scene pasted from another tool (an Excalidraw copy or file,
  // docs/specs/020-import-export/excalidraw-import-export.md "Paste"): one undo step, selected, for
  // the tab's profile. Absent, such a paste is left alone.
  insertBoardScene?: (scene: BoardScene, at?: { x: number; y: number }) => void;
};

export function useClipboard(deps: ClipboardDeps) {
  const {
    isReadOnly,
    createBlocked = false,
    explainCreateBlocked,
    embedMode,
    readSelection,
    editingId,
    setEditingId,
    activeTab,
    layerLockedIds,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    addImageFromGallery,
    ownerId,
    documentId,
    toast,
    onPastePhoto,
    canvasPointerRef,
    getViewportCanvasRect,
    insertBoardScene,
  } = deps;

  const [clipboard, setClipboard] = useState<Element[] | null>(null);
  // True (after explaining) when nothing may be created right now. Every
  // paste and drop path that adds elements asks this first.
  const refuseCreate = () => {
    if (!createBlocked) return false;
    explainCreateBlocked?.();
    return true;
  };
  // Did the last copy actually reach the OS clipboard? It decides who wins
  // when the clipboard holds text that ISN'T ours (see the paste handler):
  // if our write landed, foreign text means the user copied something else
  // afterwards, so the in-app buffer is stale and must not paste. If the
  // write was refused, that buffer is the only record of the copy and has to
  // keep working.
  const osWriteOk = useRef(false);
  // Names the copy in the in-app buffer, so a too-large copy's clipboard
  // marker (lib/clipboard-payload.ts `clipboardWriteFor`) is recognised as
  // this window's own and not another's.
  const copyId = useRef('');

  // A Cut copies what its delete takes: a mind node's branch with it (docs/specs/009-elements/mind-node.md
  // "Deleting"), so the paste puts the whole branch back. A plain Copy takes only what is selected. `opts` may be a
  // click event: only a literal `cut: true` counts.
  const copySelection = (opts?: { cut?: boolean }) => {
    if (isReadOnly) return;
    const { selectedId, multiSelectedIds } = readSelection();
    const idSet =
      multiSelectedIds.size > 0
        ? new Set(multiSelectedIds)
        : selectedId !== null
          ? new Set([selectedId])
          : null;
    if (!idSet || idSet.size === 0) return;
    // What a Cut's delete leaves (useElementSelectionActions): a locked element, or one on a locked layer. A Cut
    // copies none of it, nor the branch under it, so a paste never doubles what stayed.
    const isProtected = (el: Element) => el.locked === true || !!layerLockedIds?.has(el.id);
    const cutIds = () => {
      const taken = new Set(withMindBranches(activeTab.elements, idSet, isProtected));
      for (const el of activeTab.elements)
        if (taken.has(el.id) && isProtected(el)) taken.delete(el.id);
      return taken;
    };
    // A host's badges and step numbers copy with it (docs/specs/009-elements/badge.md).
    const copied = withAttached(activeTab.elements, opts?.cut === true ? cutIds() : idSet);
    const snapshot = activeTab.elements
      .filter((el) => copied.has(el.id))
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
    //
    // A selection too large for the system clipboard writes a marker instead,
    // pastes from the buffer in this window, and says so: it cannot reach
    // another window, and a paste there must not land part of it.
    osWriteOk.current = false;
    copyId.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const write = clipboardWriteFor(snapshot, copyId.current);
    if (write.inAppOnly) toast.info(copyTooLargeMessage(snapshot.length));
    void navigator.clipboard
      ?.writeText?.(write.text)
      .then(() => {
        osWriteOk.current = true;
      })
      .catch(() => {});
    track('Element', 'Copied');
  };

  // `source` is what the OS clipboard carried, when it carried ours. Absent
  // for a paste that found nothing on the system clipboard, which falls back
  // to the in-app buffer. `at` is where the paste was asked for (the canvas
  // menu's right-click point); absent, the live canvas pointer decides.
  const pasteFromClipboard = (source?: Element[], at?: { x: number; y: number } | null) => {
    if (isReadOnly) return;
    const copied = source && source.length > 0 ? source : clipboard;
    if (!copied || copied.length === 0) return;
    if (refuseCreate()) return;
    const pasting = copied;
    const pointer = at !== undefined ? at : (canvasPointerRef?.current ?? null);
    const { dx, dy, atPointer } = pasteTranslation(
      pasting,
      activeTab,
      pointer,
      getViewportCanvasRect?.() ?? null,
    );
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
    // An uncopied end stays pinned only to what is on this tab, never to a clipboard element that did not land.
    const onTab = new Set(activeTab.elements.map((el) => el.id));
    const { newElements } = duplicateElements(merged, clipIds, dx, dy, onTab);
    if (newElements.length === 0) return;
    const copyIds = new Set(newElements.map((el) => el.id));
    commit((els) => landPastedCopies([...els, ...newElements], copyIds, atPointer));
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
  const pasteImageFile = async (file: File, at?: { x: number; y: number }) => {
    if (!addImageFromGallery) return;
    // Embeds never upload (docs/specs/013-workspace/embeds.md): the upload endpoint authorises by owner
    // identity, which inside a partitioned iframe is a throwaway guest.
    if (embedMode) return;
    if (refuseCreate()) return;
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
      // Cloud documents upload; offline documents embed the paste locally
      // as a data URI (docs/specs/006-document/offline-mode.md) so no server copy is created.
      const { image } = await addImageFileForDocument(ownerId, documentId, named);
      addImageFromGallery(
        {
          id: image.id,
          width: image.width,
          height: image.height,
          originalName: image.originalName,
        },
        at,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not paste the image.');
    }
  };
  // An Excalidraw copy or file: read lazily (the parser stays out of the editor bundle), then
  // landed by the board-scene insert. A file that turns out not to hold a scene is `otherwise`'s.
  const pasteExcalidrawText = async (text: string) => {
    if (!insertBoardScene) return;
    if (refuseCreate()) return;
    const { sceneFromExcalidrawText } = await import('@/lib/excalidraw-read');
    const read = sceneFromExcalidrawText(text);
    if (!read.ok) {
      toast.error(read.error);
      return;
    }
    insertBoardScene(read.scene);
    track('Element', 'Imported', 'Excalidraw');
  };
  const pasteExcalidrawFile = async (
    file: File,
    otherwise: () => void,
    at?: { x: number; y: number },
  ) => {
    if (!insertBoardScene) return otherwise();
    if (refuseCreate()) return;
    const { readExcalidrawFile } = await import('@/lib/excalidraw-read');
    const read = await readExcalidrawFile(file);
    if (read.kind === 'not-excalidraw') return otherwise();
    if (read.kind === 'error') return toast.error(read.error);
    insertBoardScene(read.scene, at);
    track('Element', 'Imported', 'Excalidraw');
  };

  // A file dropped on the canvas, at its canvas point (docs/specs/020-import-export/excalidraw-import-export.md
  // "Dropped files"): an Excalidraw file or export lands as its scene there; any other image lands as an image
  // element there, as a pasted one does; a file Import reads is pointed at Import; anything else is not something
  // the canvas takes, and says so.
  const dropBoardFile = (file: File, at: { x: number; y: number }) => {
    if (isReadOnly) return;
    const refuse = () => toast.info(DROP_NOT_A_SCENE);
    const asImage = () => void pasteImageFile(file, at);
    // A draw.io, Mermaid, Markdown or JSON file replaces the tab through Import, and is told so.
    const importHint = dropImportHint(file);
    if (importHint) return toast.info(importHint);
    const image = file.type.startsWith('image/');
    // A PNG or SVG may carry an Excalidraw scene: read for one first, the picture itself otherwise.
    if (insertBoardScene && isExcalidrawFileCandidate(file)) {
      void pasteExcalidrawFile(file, image ? asImage : refuse, at);
      return;
    }
    if (image) return asImage();
    refuse();
  };

  // Single mutable ref holding the latest paste functions. The paste
  // event listener is only re-registered when isReadOnly/editingId
  // changes, so without this the listener would call stale closures
  // that see clipboard=null even after the user has copied elements.
  // A too-large copy's marker: this window's own copy pastes from the buffer;
  // another window's cannot be reached from here, and says so.
  const pasteInAppCopy = (id: string) => {
    if (id === copyId.current) pasteFromClipboard();
    else toast.info(IN_APP_COPY_ELSEWHERE);
  };
  const pasteRef = useLatest<PasteHandlers>({
    pasteFromClipboard,
    pasteInAppCopy,
    pasteImageFile,
    // A photo read onto the board adds notes, so the creation guard applies.
    onPastePhoto:
      onPastePhoto &&
      ((file: File) => {
        if (!refuseCreate()) onPastePhoto(file);
      }),
    pasteExcalidrawText,
    pasteExcalidrawFile,
    canPasteScene: !!insertBoardScene,
  });
  // The document's paste listeners, and the middle-button primary-selection watch (useClipboardPaste.ts).
  useClipboardPaste({ isReadOnly, editingId, setEditingId, pasteRef, osWriteOk });

  // `hasClipboard` backs the canvas menu's Paste row (docs/specs/008-canvas/canvas-and-palette.md): the row is
  // always THERE — a menu that changes shape with invisible state is a menu
  // you can't learn — and greys out when the buffer is empty. It reports the
  // in-app buffer only; a copy made in another window lives on the OS
  // clipboard, which can't be read synchronously while rendering a menu, and
  // Cmd+V still pastes it.
  return {
    copySelection,
    pasteFromClipboard,
    dropBoardFile,
    hasClipboard: (clipboard?.length ?? 0) > 0,
  };
}
