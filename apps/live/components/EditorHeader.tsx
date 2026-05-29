import { useEffect, useRef, useState } from 'react';
import { Brand } from '@livediagram/ui';

type EditorHeaderProps = {
  diagramName: string;
  onRename: (name: string) => void;
};

export function EditorHeader({ diagramName, onRename }: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4">
      <div className="flex w-48 items-center">
        <Brand href="/" size="md" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        {editing ? (
          <NameEditor
            initial={diagramName}
            onCommit={(v) => {
              onRename(v);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate rounded px-2 py-0.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {diagramName}
          </button>
        )}
      </div>
      {/* Spacer that mirrors the brand block on the left so the centred title
          stays visually centred even though the right side is intentionally empty. */}
      <div className="w-48" aria-hidden />

    </header>
  );
}

function NameEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
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
      onBlur={() => onCommit(value.trim() || initial)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(value.trim() || initial);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className="rounded border border-slate-300 px-2 py-0.5 text-sm text-slate-800 outline-none focus:border-brand-500"
    />
  );
}
