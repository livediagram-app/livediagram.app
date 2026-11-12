'use client';

// A file dropped on the Import dialog, on any of its steps (docs/specs/026-plan/plan-tabs.md "The Import dialog"): the
// handlers its body wears and whether a file is over it, for the Drop to Import outline. Only a drag that carries
// files counts, and only while the dialog can take one (`enabled`): a drop while a file is read or imported is let
// go, and the browser never opens the file in its place.
import { useRef, useState, type DragEvent } from 'react';

export type FileDrop = {
  over: boolean;
  handlers: {
    onDragEnter: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent) => void;
  };
};

const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');

export function useFileDrop(onFile: (file: File) => void, enabled = true): FileDrop {
  // Entering a child fires before leaving its parent: a count keeps the outline steady over the rows.
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  return {
    over: over && enabled,
    handlers: {
      onDragEnter: (e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      // Taken (so a drop lands here, not in the browser's tab) whether or not it can be used now.
      onDragOver: (e) => {
        if (hasFiles(e)) e.preventDefault();
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop: (e) => {
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file && enabled) onFile(file);
      },
    },
  };
}
