import { useEffect, useRef, useState } from 'react';
import { NAME_MAX_LENGTH } from '@liveworkspace/model-core/names';
import { isComposingKey } from '@liveworkspace/ui';
import { refocusAfterField } from './refocus-after-field';

// Inline rename input shared by every editor's title (EditorHeader), tabs
// (TabBar), and tab folders (TabFolderGroup). Mounts focused with the
// text selected, commits on blur or Enter, cancels on Escape. The raw
// value is handed to onCommit; callers decide how to trim / validate
// (e.g. fall back to the original name on an empty string). Styling is
// caller-supplied via className since each surface sizes it differently.
// `label` names the field for a screen reader (it has no visible label of its
// own): "Tab name", "Folder name", "Document name". `typed` is a name the person already began typing elsewhere (a
// letter at a menu that renames, liveknowledge's knowledgebase menu): the field opens holding it, the caret after it,
// so the next keys carry on typing rather than replacing it.
export function NameEditor({
  label,
  initial,
  typed,
  onCommit,
  onCancel,
  className,
}: {
  label: string;
  initial: string;
  typed?: string | undefined;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className: string;
}) {
  const [value, setValue] = useState(typed ?? initial);
  const ref = useRef<HTMLInputElement>(null);
  const continues = typed !== undefined;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.focus();
    if (continues) node.setSelectionRange(node.value.length, node.value.length);
    else node.select();
  }, [continues]);
  return (
    <input
      ref={ref}
      aria-label={label}
      value={value}
      // Names are capped (each product's docs/specs/006-*/name-length.md) — enforced here too so the limit shows
      // while typing rather than truncating silently on commit.
      maxLength={NAME_MAX_LENGTH}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        // Enter and Escape confirm or drop an input method's word first (design-principles.md).
        if (isComposingKey(e)) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          refocusAfterField(e.currentTarget);
          onCommit(value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          refocusAfterField(e.currentTarget);
          onCancel();
        }
      }}
      className={className}
    />
  );
}
