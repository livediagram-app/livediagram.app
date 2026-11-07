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
// Three sources compete on paste, in this order: a file on the system clipboard
// (a picture lands as an image element through the media service, any other
// file is refused; docs/specs/009-elements/images.md "Paste and drop"), our own
// serialised elements, then the in-app buffer. Ordinary text is left to the browser.
//
// Only `copySelection` is returned — it's wired into the keyboard
// shortcut hook. Paste is driven entirely by the native `paste` event
// the hook registers, so `pasteFromClipboard` and `pasteImageFile` stay internal.

import type { Selection } from '@liveworkspace/workbench/lib/selection-store';
import { useEffect, useRef, useState } from 'react';
import { duplicateElements, withAttached, type Element, type Tab } from '@livehuddle/document';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { watchPrimarySelectionPaste } from '@liveworkspace/workbench/lib/primary-selection-paste';
import {
  clipboardWriteFor,
  copyTooLargeMessage,
  IN_APP_COPY_ELSEWHERE,
  inAppCopyIdOf,
  parseElementsPayload,
  stripIdentity,
} from '@/lib/clipboard-payload';
import { pasteTranslation } from '@/lib/paste-placement';
import { track } from '@/lib/telemetry';
import { trackDuplicated } from '@/lib/element-telemetry';
import type { useToast } from '@/hooks/ui/useToast';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { isTypingTarget, passesHistoryChords } from '@liveworkspace/workbench/lib/typing-target';
import { DROP_NOT_TAKEN, dropImportHint } from '@/lib/drop-import-hint';
import {
  isImageFile,
  namedPastedFile,
  pastedImageFile,
  pasteHoldsFile,
  placedImage,
  uploadImageFile,
  type UploadedImage,
} from './image-file-place';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';

// Whether a paste carries something for the canvas rather than words: a file, or elements copied here (their JSON
// or the in-app copy's id).
function pasteHoldsCanvasContent(data: DataTransfer | null): boolean {
  if (!data) return false;
  if (data.files.length > 0) return true;
  const text = data.getData('text/plain');
  return parseElementsPayload(text) !== null || inAppCopyIdOf(text) !== null;
}

type ClipboardDeps = {
  isReadOnly: boolean;
  // True while new elements can't land (edits are blocked). A paste adds elements, so it obeys the
  // same guard as every other creation path.
  createBlocked?: boolean;
  // Read when a copy runs (docs/specs/008-canvas/blueprints/selection-store.md).
  readSelection: () => Selection;
  editingId: string | null;
  // Ends typing in a label: pasting copied elements while a note is open for
  // typing puts them on the canvas, not in the note.
  setEditingId: (id: string | null) => void;
  activeTab: Tab;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  setSelectedId: (id: string | null) => void;
  setMultiSelectedIds: (ids: Set<string>) => void;
  toast: ReturnType<typeof useToast>;
  // The canvas-coord rectangle on screen; a paste whose usual spot is outside
  // it lands in its middle (docs/specs/008-canvas/canvas-and-palette.md Clipboard).
  getViewportCanvasRect?: () => { x: number; y: number; width: number; height: number } | null;
  // Who uploads a pasted or dropped picture (the gallery's owner) and into which Space: a This Browser Space embeds it
  // instead (docs/specs/009-elements/images.md "Paste and drop").
  ownerId: string;
  documentId: string | null;
  // An embed adds no picture: uploads authorise by owner, and inside a partitioned iframe that is a throwaway guest
  // (useEditorImages).
  embedMode?: boolean;
};

export function useClipboard(deps: ClipboardDeps) {
  const {
    isReadOnly,
    createBlocked = false,
    readSelection,
    editingId,
    setEditingId,
    activeTab,
    commit,
    setSelectedId,
    setMultiSelectedIds,
    toast,
    getViewportCanvasRect,
    ownerId,
    documentId,
    embedMode = false,
  } = deps;

  const [clipboard, setClipboard] = useState<Element[] | null>(null);
  // True when nothing may be created right now. Every paste and drop path that adds elements asks
  // this first.
  const refuseCreate = () => createBlocked;
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

  // A Copy, and a Cut's copy before its delete, take what is selected.
  const copySelection = () => {
    if (isReadOnly) return;
    const { selectedId, multiSelectedIds } = readSelection();
    const idSet =
      multiSelectedIds.size > 0
        ? new Set(multiSelectedIds)
        : selectedId !== null
          ? new Set([selectedId])
          : null;
    if (!idSet || idSet.size === 0) return;
    // A host's badges and step numbers copy with it (docs/specs/009-elements/badge.md).
    const copied = withAttached(activeTab.elements, idSet);
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
  // to the in-app buffer.
  const pasteFromClipboard = (source?: Element[]) => {
    if (isReadOnly) return;
    const copied = source && source.length > 0 ? source : clipboard;
    if (!copied || copied.length === 0) return;
    if (refuseCreate()) return;
    const pasting = copied;
    const { dx, dy } = pasteTranslation(pasting, getViewportCanvasRect?.() ?? null);
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

  // A file pasted or dropped that the canvas does not take: said, so it neither lands nor (a paste) falls through to
  // the element clipboard.
  const refusePastedFile = () => toast.info(DROP_NOT_TAKEN);

  // A picture pasted or dropped on the canvas (docs/specs/009-elements/images.md "Paste and drop"): uploaded to the
  // person's gallery through the media service (a This Browser Space embeds it), then landed as an image element of
  // its own shape, selected, centred on `at` (where a drop was released) or the middle of the screen (a paste). An
  // Editor's alone: read-only sessions (a Participant, a Viewer) never get here.
  const pasteImageFile = async (file: File, at?: { x: number; y: number }) => {
    if (isReadOnly) return;
    if (embedMode) return refusePastedFile();
    if (refuseCreate()) return;
    let image: UploadedImage;
    try {
      image = await uploadImageFile(ownerId, documentId, namedPastedFile(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add the picture.');
      return;
    }
    const rect = getViewportCanvasRect?.() ?? null;
    const centre =
      at ?? (rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : { x: 0, y: 0 });
    const placed = placedImage(image, centre);
    commit((els) => [...els, placed]);
    setSelectedId(placed.id);
    setMultiSelectedIds(new Set());
    track('Element', 'Added', 'Image');
  };

  // A file dropped on the canvas, at its canvas point: a picture lands there as a pasted one does; a file Import
  // reads is pointed at Import; anything else is not something the canvas takes, and says so
  // (docs/specs/002-project-scope/not-in-livehuddle.md "Imports from other tools").
  const dropBoardFile = (file: File, at?: { x: number; y: number }) => {
    if (isReadOnly) return;
    if (isImageFile(file)) return void pasteImageFile(file, at);
    // A livehuddle JSON file replaces the tab through Import, and is told so.
    const importHint = dropImportHint(file);
    toast.info(importHint ?? DROP_NOT_TAKEN);
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

  const pasteRef = useLatest({
    pasteFromClipboard,
    pasteInAppCopy,
    pasteImageFile,
    refusePastedFile,
  });

  // A middle-button release pastes the Linux primary selection. It is never a
  // request to paste on the canvas: with an empty selection it used to drop
  // the in-app buffer, often right at the end of a middle-drag pan.
  const primaryPaste = useRef<ReturnType<typeof watchPrimarySelectionPaste> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const watch = watchPrimarySelectionPaste(window);
    primaryPaste.current = watch;
    return () => {
      watch.dispose();
      primaryPaste.current = null;
    };
  }, []);

  // System-clipboard paste handler. Cmd/Ctrl+V triggers the browser's
  // native `paste` event, which carries whatever the OS clipboard
  // holds (text, files, images). A picture (a screenshot, a copied
  // image) lands as an image element; any other file is refused with a
  // notice. Otherwise fall back to the element clipboard so pasting copied
  // canvas elements still works. Text-input focus
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
      if (primaryPaste.current?.isPrimarySelectionPaste()) return;
      // A DOM target: `Element` in this file is the diagram element type.
      const target = e.target;
      // An empty start search hands the editor a paste of canvas content (docs/specs/007-editor/start-diagramming.md
      // "Undo and redo reach the editor through an empty search"): elements copied from another tab land on this
      // new one rather than their JSON in the search. Text still searches.
      const intoEmptySearch =
        passesHistoryChords(target) && pasteHoldsCanvasContent(e.clipboardData ?? null);
      if (!intoEmptySearch && isTypingTarget(target)) {
        return;
      }
      if (isReadOnly) return;
      if (editingId !== null) return;
      // A file on the system clipboard never falls through to the element clipboard, which would paste previously
      // copied elements the person did not mean: a picture lands, anything else is refused. `files` is the
      // authoritative list; `items` also catches Safari's image item with an empty `files`.
      const data = e.clipboardData ?? null;
      if (pasteHoldsFile(data)) {
        e.preventDefault();
        const picture = pastedImageFile(data);
        if (picture) void pasteRef.current.pasteImageFile(picture);
        else pasteRef.current.refusePastedFile();
        return;
      }
      // No file on the system clipboard. Our own serialised elements next
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
      const inAppCopy = inAppCopyIdOf(text);
      if (inAppCopy !== null) {
        e.preventDefault();
        pasteRef.current.pasteInAppCopy(inAppCopy);
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
  }, [isReadOnly, editingId, pasteRef]);

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
      if (primaryPaste.current?.isPrimarySelectionPaste()) return;
      const target = e.target as Element | null;
      if (!(target instanceof HTMLElement) || !target.isContentEditable) return;
      if (!target.closest(CANVAS_ROOT_SELECTOR)) return;
      const text = e.clipboardData?.getData('text/plain');
      const elements = parseElementsPayload(text);
      const inAppCopy = elements ? null : inAppCopyIdOf(text);
      if (!elements && inAppCopy === null) return;
      e.preventDefault();
      e.stopPropagation();
      setEditingId(null);
      if (elements) pasteRef.current.pasteFromClipboard(elements);
      else if (inAppCopy !== null) pasteRef.current.pasteInAppCopy(inAppCopy);
    };
    document.addEventListener('paste', onPasteIntoLabel, true);
    return () => document.removeEventListener('paste', onPasteIntoLabel, true);
  }, [isReadOnly, editingId, setEditingId, pasteRef]);

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
