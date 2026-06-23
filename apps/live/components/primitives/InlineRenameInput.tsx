'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Shared inline-rename input used by every "click rename, type a
// new name, press Enter or click away" interaction in the app
// (sidebar folder tree, list-view folder row, list-view diagram
// row, floating Explorer's folder + diagram renames). Three near-
// identical copies of this used to exist; they drifted on focus
// management and the most fragile copy (the standalone /explorer
// page) was the one that exposed the focus-bounce bug. Living
// once, in one file, with one behaviour.
//
// Why click-outside instead of blur:
//
// The rename usually starts on a click that also unmounts a
// PortalMenu (the "Rename" option in an ellipsis menu). When the
// portal unmounts, the focused MenuItem disappears and focus
// transiently bounces to document.body. In some browsers a blur
// fires on the newly-mounted input before the user has done
// anything, the rename commits with the original name, and the
// input vanishes within one or two frames. That's the "input
// appears for a split second and disappears" bug.
//
// mousedown-outside sidesteps focus entirely: as long as the
// input is in the DOM, the user can type into it, and the rename
// ends only on Enter, Escape, or a mousedown outside the input.
// Focus (via useLayoutEffect, synchronous before paint) is just a
// UX nicety so the user can type immediately.
export function InlineRenameInput({
  initial,
  onCommit,
  onCancel,
  className,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(initial);
  // draftRef holds the latest draft for the document-level click
  // handler. That handler is attached once and can't re-close
  // over a fresh draft on every keystroke without re-binding.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // Same idea for onCommit: the parent rebuilds it every render
  // (it closes over the row id / state), and we don't want to
  // thrash document listeners chasing that identity.
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    node.select();
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const node = ref.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        commitRef.current(draftRef.current);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <input
      ref={ref}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(draft);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className={`outline-none focus:border-brand-500 ${className ?? ''}`}
    />
  );
}
