import { useEffect, useRef, useState } from 'react';

// Inline rename input shared by the diagram title (EditorHeader), tabs
// (TabBar), and tab folders (TabFolderChip). Mounts focused with the
// text selected, commits on blur or Enter, cancels on Escape. The raw
// value is handed to onCommit; callers decide how to trim / validate
// (e.g. fall back to the original name on an empty string). Styling is
// caller-supplied via className since each surface sizes it differently.
export function NameEditor({
  initial,
  onCommit,
  onCancel,
  className,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className: string;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.focus();
      node.select();
    }
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className={className}
    />
  );
}
