'use client';

// The editor's side of the sheet store (blueprint sheet-store.md "Editor slice"): the one piece of the Sheet that
// lives in the main bundle. It hands the lazily loaded sheet chunk what it needs from the editor (who is writing,
// the document's scope, undo, toasts, presence) and routes the room's `sheets` and `sheet-presence` ops to the
// chunk once it has attached. Before any Sheet is drawn nothing attaches and every op is dropped: the store
// fetches what it needs when it loads.
import { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import type { RoomOp, SheetPresenceOp, SheetsRoomOp } from '@livediagram/api-schema';
import type { SheetPerson } from '@livediagram/sheets';
import type { BoxedElement, Element } from '@livediagram/document';
import type { SheetsScope } from '@/lib/api/sheets';
import type { ItemUndoStep } from '@/hooks/plan/item-undo-journal';
import { useLatest } from '@/hooks/ui/useLatest';

export type SheetPeer = { id: string; name: string; color: string };

export type SheetsHandlers = {
  receive(op: SheetsRoomOp): void;
  // A loaded sheet's title (the delete dialog names it).
  title(sheetId: string): string | undefined;
  // Delete sheets with their elements, kept for Undo (sheet-store.md "Deleting a sheet").
  release(sheetIds: readonly string[]): void;
  presence(from: string, op: SheetPresenceOp): void;
  resync(): void;
  reannounce(): void;
};

export type SheetsBridge = {
  scope: SheetsScope;
  // The tab open now: where a placed Sheet's sheet is made.
  activeTabId: string;
  self: SheetPerson | null;
  // Cells (Editor and Participant), and the Sheet's shape (Editor), docs/specs/013-workspace/share-roles.md.
  canEdit: boolean;
  canShape: boolean;
  locale: string;
  peers: readonly SheetPeer[];
  pushUndo(step: ItemUndoStep): void;
  // A refusal or failure (error toast), and plain news ("Replaced 3 cells").
  toast(message: string): void;
  notify(message: string): void;
  sendPresence(op: SheetPresenceOp): void;
  // Change the open tab's elements (a Sheet dropping its copy mark once its copy is made), as an edit.
  commitElements(map: (els: Element[]) => Element[]): void;
  // Change the open tab's elements quietly: saved and sent, but no undo step (a chart keeping its last read).
  tickElements(map: (els: Element[]) => Element[]): void;
  // Place a new element centred on a canvas point, styled by the theme and selected, as a palette drop is (a chart
  // made from a sheet's cells).
  placeElement(at: { x: number; y: number }, make: (x: number, y: number) => BoxedElement): void;
  // Switch this person to Plan mode (a Sheet double-clicked in another mode offers it).
  switchToPlan(): void;
  // Select an element on the canvas (Escape out of a Sheet's grid selects the Sheet).
  selectElement(id: string): void;
  // The sheet chunk attaches its handlers; the returned function detaches them.
  attach(handlers: SheetsHandlers): () => void;
};

export const SheetsBridgeContext = createContext<SheetsBridge | null>(null);

export function useSheetsBridgeContext(): SheetsBridge | null {
  return useContext(SheetsBridgeContext);
}

export function useSheetsBridge(opts: {
  documentId: string;
  ownerId: string;
  shareCode: string | null;
  tabScope: string | null;
  self: SheetPerson | null;
  canEdit: boolean;
  // Absent: as canEdit.
  canShape?: boolean;
  peers: readonly SheetPeer[];
  pushUndo: (step: ItemUndoStep) => void;
  toast: (message: string) => void;
  notify: (message: string) => void;
  send: (op: RoomOp) => void;
  activeTabId: string;
  commitElements: (map: (els: Element[]) => Element[]) => void;
  placeElement: (
    at: { x: number; y: number },
    make: (x: number, y: number) => BoxedElement,
  ) => void;
  tickElements: (map: (els: Element[]) => Element[]) => void;
  switchToPlan: () => void;
  selectElement: (id: string) => void;
}) {
  const handlers = useRef<SheetsHandlers | null>(null);
  const pushUndo = useLatest(opts.pushUndo);
  const toast = useLatest(opts.toast);
  const notify = useLatest(opts.notify);
  const send = useLatest(opts.send);
  const commitElements = useLatest(opts.commitElements);
  const placeElement = useLatest(opts.placeElement);
  const tickElements = useLatest(opts.tickElements);
  const switchToPlan = useLatest(opts.switchToPlan);
  const selectElement = useLatest(opts.selectElement);
  const attach = useCallback((h: SheetsHandlers) => {
    handlers.current = h;
    return () => {
      if (handlers.current === h) handlers.current = null;
    };
  }, []);
  const { documentId, ownerId, shareCode, tabScope, self, canEdit, peers, activeTabId } = opts;
  const canShape = opts.canShape ?? canEdit;
  const bridge = useMemo<SheetsBridge>(
    () => ({
      scope: { documentId, ownerId, shareCode, tabId: tabScope },
      activeTabId,
      self,
      canEdit,
      canShape,
      locale: typeof navigator === 'undefined' ? 'en-GB' : navigator.language || 'en-GB',
      peers,
      pushUndo: (step) => pushUndo.current(step),
      toast: (m) => toast.current(m),
      notify: (m) => notify.current(m),
      sendPresence: (op) => send.current(op as RoomOp),
      commitElements: (map) => commitElements.current(map),
      placeElement: (at, make) => placeElement.current(at, make),
      tickElements: (map) => tickElements.current(map),
      switchToPlan: () => switchToPlan.current(),
      selectElement: (id) => selectElement.current(id),
      attach,
    }),
    [
      documentId,
      ownerId,
      shareCode,
      tabScope,
      activeTabId,
      self,
      canEdit,
      canShape,
      peers,
      pushUndo,
      toast,
      notify,
      send,
      commitElements,
      placeElement,
      tickElements,
      switchToPlan,
      selectElement,
      attach,
    ],
  );
  return {
    bridge,
    receiveSheets: useCallback((op: SheetsRoomOp) => handlers.current?.receive(op), []),
    receiveSheetPresence: useCallback(
      (from: string, op: SheetPresenceOp) => handlers.current?.presence(from, op),
      [],
    ),
    resync: useCallback(() => handlers.current?.resync(), []),
    // Before a Sheet has drawn nothing is attached: no title, and nothing to release (the sheet is kept, as a Cut's).
    sheetTitle: useCallback((id: string) => handlers.current?.title(id), []),
    releaseSheets: useCallback((ids: readonly string[]) => {
      if (!handlers.current) return false;
      handlers.current.release(ids);
      return true;
    }, []),
    sheetsAttached: useCallback(() => handlers.current !== null, []),
    reannounce: useCallback(() => handlers.current?.reannounce(), []),
  };
}
