'use client';

// Cell comments' wiring (docs/specs/029-sheets/sheet.md "Cell comments"): the editor hands every Sheet its comment
// actions (open a cell's thread, which one is open, whether this session may take part), and each Sheet hands its
// grid its element's cell threads. Two small contexts so neither the sheets bridge nor the controller carries
// comments, and a grid drawn outside the editor (an export, a test) simply draws no markers.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { CellCommentThreads } from '@livepages/document';
import { useLatest } from '@/hooks/ui/useLatest';
import { SheetsBridgeContext, type SheetsBridge } from './useSheetsBridge';

// The anchor a cell's thread popover finds (CommentThreadPopover `anchorSelector`), drawn by the grid over the
// cell: the selector, and the attribute's value.
export const CELL_COMMENT_ANCHOR_ATTR = 'data-cell-comment-anchor';
export function cellCommentAnchor(elementId: string, cell: string): string {
  return `${elementId}:${cell}`;
}
export function cellCommentAnchorSelector(elementId: string, cell: string): string {
  return `[${CELL_COMMENT_ANCHOR_ATTR}="${cellCommentAnchor(elementId, cell)}"]`;
}

type SheetComments = {
  // Opens (or, pressed again, closes) the thread of `cell` on Sheet `elementId`.
  open: (elementId: string, cell: string) => void;
  // The thread open now, when it is a cell's.
  openCell: { elementId: string; cell: string } | null;
  // An Editor or a Participant (docs/specs/013-workspace/share-roles.md): may start a thread. A Viewer reads.
  canComment: boolean;
};

const SheetCommentsContext = createContext<SheetComments | null>(null);

export function SheetCommentsProvider({
  open,
  openId,
  openCell,
  canComment,
  off,
  children,
}: {
  open: (elementId: string, cell?: string) => void;
  openId: string | null;
  openCell: string | null;
  canComment: boolean;
  // No comments at all (a Community visitor).
  off?: boolean;
  children: ReactNode;
}) {
  // `open` is a fresh closure each render: read through the latest, so the value changes only with what it says.
  const latestOpen = useLatest(open);
  const value = useMemo<SheetComments | null>(
    () =>
      off
        ? null
        : {
            open: (elementId, cell) => latestOpen.current(elementId, cell),
            openCell:
              openId !== null && openCell !== null ? { elementId: openId, cell: openCell } : null,
            canComment,
          },
    [off, openId, openCell, canComment, latestOpen],
  );
  return <SheetCommentsContext.Provider value={value}>{children}</SheetCommentsContext.Provider>;
}

export function useSheetComments(): SheetComments | null {
  return useContext(SheetCommentsContext);
}

// One Sheet element's cell threads, for its grid.
type SheetCellThreads = { elementId: string; threads: CellCommentThreads | undefined };

const SheetCellThreadsContext = createContext<SheetCellThreads | null>(null);

export const SheetCellThreadsProvider = SheetCellThreadsContext.Provider;

export function useSheetCellThreads(): SheetCellThreads | null {
  return useContext(SheetCellThreadsContext);
}

// The editor's sheet contexts in one: the sheets bridge and the comment actions.
export function SheetsProviders({
  bridge,
  openComments,
  ...comments
}: {
  bridge: SheetsBridge | null;
  openComments: (elementId: string, cell?: string) => void;
  openId: string | null;
  openCell: string | null;
  canComment: boolean;
  children: ReactNode;
}) {
  return (
    <SheetsBridgeContext.Provider value={bridge}>
      <SheetCommentsProvider open={openComments} {...comments} />
    </SheetsBridgeContext.Provider>
  );
}
