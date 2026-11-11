// The editor's paste listeners (docs/specs/008-canvas/canvas-and-palette.md "Clipboard"): the document's
// `paste` event, read in the order useClipboard.ts describes, and the capture-phase one that lands copied
// elements pasted into an open label. Called by useClipboard, which owns the copy, the in-app buffer and the
// paste functions these call through `pasteRef`.

import { useEffect, useRef, type RefObject } from 'react';
import type { Element } from '@livediagram/document';
import { anyModalOpen } from '@liveworkspace/workbench/lib/modal-guard';
import { watchPrimarySelectionPaste } from '@liveworkspace/workbench/lib/primary-selection-paste';
import { inAppCopyIdOf, parseElementsPayload } from '@/lib/clipboard-payload';
import { excalidrawTextFromPaste, isExcalidrawFileCandidate } from '@/lib/excalidraw-paste';
import { isTypingTarget, passesHistoryChords } from '@liveworkspace/workbench/lib/typing-target';
import { CANVAS_ROOT_SELECTOR } from '@liveworkspace/workbench/lib/canvas-selectors';

// Whether a paste carries something for the canvas rather than words: a file, an Excalidraw scene, or elements
// copied here (their JSON or the in-app copy's id).
function pasteHoldsCanvasContent(data: DataTransfer | null, canPasteScene: boolean): boolean {
  if (!data) return false;
  if (data.files.length > 0) return true;
  if (canPasteScene && excalidrawTextFromPaste(data)) return true;
  const text = data.getData('text/plain');
  return parseElementsPayload(text) !== null || inAppCopyIdOf(text) !== null;
}

// The paste functions useClipboard hands its listeners, read at their newest.
export type PasteHandlers = {
  pasteFromClipboard: (source?: Element[], at?: { x: number; y: number } | null) => void;
  pasteInAppCopy: (id: string) => void;
  pasteImageFile: (file: File, at?: { x: number; y: number }) => Promise<void>;
  onPastePhoto: ((file: File) => void) | undefined;
  pasteExcalidrawText: (text: string) => Promise<void>;
  pasteExcalidrawFile: (
    file: File,
    otherwise: () => void,
    at?: { x: number; y: number },
  ) => Promise<void>;
  canPasteScene: boolean;
};

export function useClipboardPaste({
  isReadOnly,
  editingId,
  setEditingId,
  pasteRef,
  osWriteOk,
}: {
  isReadOnly: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  pasteRef: RefObject<PasteHandlers>;
  // Whether the last copy reached the OS clipboard (useClipboard's `osWriteOk`).
  osWriteOk: RefObject<boolean>;
}): void {
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
      // A modal dialog owns paste while open: Cmd+V with a dialog up
      // must not drop elements on the canvas behind it.
      if (anyModalOpen()) return;
      // A closer handler already claimed the paste (the table's
      // selected-cell paste runs in the capture phase), so don't also drop
      // the element clipboard on the canvas.
      if (e.defaultPrevented) return;
      if (primaryPaste.current?.isPrimarySelectionPaste()) return;
      // A DOM target: `Element` in this file is the diagram element type.
      const target = e.target;
      // An empty start search hands the editor a paste of canvas content (docs/specs/007-editor/start-diagramming.md
      // "Undo and redo reach the editor through an empty search"): elements copied from another tab land on this
      // new one rather than their JSON in the search. Text still searches.
      const intoEmptySearch =
        passesHistoryChords(target) &&
        pasteHoldsCanvasContent(e.clipboardData ?? null, pasteRef.current.canPasteScene);
      if (!intoEmptySearch && isTypingTarget(target)) {
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
          const file = chosen;
          const asImage = () => {
            const readPhoto = pasteRef.current.onPastePhoto;
            if (readPhoto && file.type.startsWith('image/')) {
              readPhoto(file);
              return;
            }
            void pasteRef.current.pasteImageFile(file);
          };
          // An Excalidraw file, or a PNG / SVG export holding a scene, lands as that scene;
          // anything else pastes exactly as before.
          if (pasteRef.current.canPasteScene && isExcalidrawFileCandidate(file)) {
            void pasteRef.current.pasteExcalidrawFile(file, asImage);
            return;
          }
          asImage();
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
      // An Excalidraw copy, before our own payload (their envelopes cannot be confused).
      const excalidraw = pasteRef.current.canPasteScene
        ? excalidrawTextFromPaste(e.clipboardData ?? null)
        : null;
      if (excalidraw) {
        e.preventDefault();
        void pasteRef.current.pasteExcalidrawText(excalidraw);
        return;
      }
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
      // deliberately not done here: it needs the viewport centre in canvas
      // coordinates, which lives in Canvas rather than in this hook.
      if (text.trim().length > 0 && osWriteOk.current) return;
      // Nothing readable on the system clipboard (or our write was refused,
      // making the in-app buffer the only record of the copy).
      e.preventDefault();
      pasteRef.current.pasteFromClipboard();
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [isReadOnly, editingId, pasteRef, osWriteOk]);

  // Copied ELEMENTS pasted while a label on the canvas is open for typing. The
  // clipboard carries them as JSON text, and every label editor pastes plain
  // text, so without this the JSON was typed into the note. Claimed in the
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
      const excalidraw = pasteRef.current.canPasteScene
        ? excalidrawTextFromPaste(e.clipboardData ?? null)
        : null;
      if (excalidraw) {
        e.preventDefault();
        e.stopPropagation();
        setEditingId(null);
        void pasteRef.current.pasteExcalidrawText(excalidraw);
        return;
      }
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
}
