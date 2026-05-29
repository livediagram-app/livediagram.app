import { useEffect, useRef, useState } from 'react';
import { Brand } from '@livediagram/ui';
import { MenuItem, PortalMenu } from './PortalMenu';

type EditorHeaderProps = {
  diagramName: string;
  onRename: (name: string) => void;
  onDeleteDiagram: () => void;
};

export function EditorHeader({ diagramName, onRename, onDeleteDiagram }: EditorHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="truncate rounded px-2 py-0.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {diagramName}
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Diagram menu"
              aria-expanded={menuOpen}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                <circle cx="3" cy="7" r="1.25" fill="currentColor" />
                <circle cx="7" cy="7" r="1.25" fill="currentColor" />
                <circle cx="11" cy="7" r="1.25" fill="currentColor" />
              </svg>
            </button>
            {menuOpen ? (
              <PortalMenu
                anchor={menuButtonRef.current}
                placement="below"
                onClose={() => setMenuOpen(false)}
              >
                <MenuItem
                  icon={<PencilIcon />}
                  label="Rename"
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon={<TrashIcon />}
                  label="Delete"
                  danger
                  onClick={() => {
                    onDeleteDiagram();
                    setMenuOpen(false);
                  }}
                />
              </PortalMenu>
            ) : null}
          </div>
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

function PencilIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
      <path d="M10 4l2 2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  );
}
