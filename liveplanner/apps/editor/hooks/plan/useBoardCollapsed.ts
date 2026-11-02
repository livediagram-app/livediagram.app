'use client';

// What this person has collapsed on a Plan board, its columns and its swimlanes (docs/specs/026-plan/plan-board.md
// "Collapse Column"), remembered per board on this browser (board-collapse.ts): read once when the board mounts, and
// written on each toggle. Nothing goes to the plan, to anyone else or to undo. A browser that refuses storage keeps it
// for the session.
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  readLocalStorageSafe,
  removeLocalStorageSafe,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';
import {
  boardCollapsedKey,
  parseBoardCollapsed,
  serialiseBoardCollapsed,
  toggleMember,
  type BoardCollapsed,
} from '@/components/plan/board-collapse';
import { track } from '@/lib/telemetry';

const read = (boardId: string) =>
  parseBoardCollapsed(readLocalStorageSafe(boardCollapsedKey(boardId)));

function write(boardId: string, state: BoardCollapsed): void {
  const text = serialiseBoardCollapsed(state);
  if (text === null) removeLocalStorageSafe(boardCollapsedKey(boardId));
  else writeLocalStorageSafe(boardCollapsedKey(boardId), text);
}

export function useBoardCollapsed(boardId: string): BoardCollapsed & {
  // `onBoard`: the board's column ids now, so a column removed since drops out of what is kept.
  toggleColumn: (columnId: string, onBoard: ReadonlySet<string>) => void;
  toggleLane: (laneKey: string) => void;
} {
  const [held, setHeld] = useState(() => ({ boardId, state: read(boardId) }));
  // Another board in this place (the element swapped under the view): its own, read afresh.
  let state = held.state;
  if (held.boardId !== boardId) {
    state = read(boardId);
    setHeld({ boardId, state });
  }
  // The toggles read the latest without being remade on each change.
  const latest = useRef({ boardId, state });
  useLayoutEffect(() => {
    latest.current = { boardId, state };
  });

  const commit = useCallback(
    (next: BoardCollapsed) => {
      const id = latest.current.boardId;
      write(id, next);
      latest.current = { boardId: id, state: next };
      setHeld({ boardId: id, state: next });
    },
    [latest],
  );
  const toggleColumn = useCallback(
    (columnId: string, onBoard: ReadonlySet<string>) => {
      const was = latest.current.state;
      const columns = toggleMember(was.columns, columnId, onBoard);
      // Tracked before the change is kept, as every view flip is (docs/specs/017-telemetry/telemetry.md).
      track('Plan', 'Toggled', columns.has(columnId) ? 'ColumnCollapsed' : 'ColumnExpanded');
      commit({ ...was, columns });
    },
    [commit, latest],
  );
  const toggleLane = useCallback(
    (laneKey: string) => {
      const was = latest.current.state;
      commit({ ...was, lanes: toggleMember(was.lanes, laneKey) });
    },
    [commit, latest],
  );
  return { columns: state.columns, lanes: state.lanes, toggleColumn, toggleLane };
}
