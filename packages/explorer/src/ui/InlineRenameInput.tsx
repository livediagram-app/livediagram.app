'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TITLE_MAX } from '@liveworkspace/index-client';
import { useLatest } from './useLatest';

// liveplanner's InlineRenameInput: type a new name, Enter or a press outside commits, Escape cancels. It
// ends on a mousedown outside rather than on blur, because the rename usually starts from a menu that is
// unmounting and would otherwise blur the new field at once.
export function InlineRenameInput({
  initial,
  onCommit,
  onCancel,
  ariaLabel,
  className,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(initial);
  const draftRef = useLatest(draft);
  const commitRef = useLatest(onCommit);

  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const node = ref.current;
      if (node && e.target instanceof Node && !node.contains(e.target)) {
        commitRef.current(draftRef.current);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [commitRef, draftRef]);

  return (
    <input
      ref={ref}
      value={draft}
      maxLength={TITLE_MAX}
      aria-label={ariaLabel}
      onChange={(e) => setDraft(e.target.value)}
      onClick={(e) => e.stopPropagation()}
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
