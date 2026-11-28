'use client';

// The social pieces' settings in the element menu (docs/specs/009-elements/social-pieces.md): a Jukebox's source
// (the Clock has nothing to set). Typed locally and committed with Set or Enter, like the Screen's link. Only an
// Editor's menu renders them (EditorContextMenuHost hands a Participant or a Viewer its own short menu).
import { useState, type KeyboardEvent } from 'react';
import { isJukeboxSource, JUKEBOX_SOURCE_MAX, type ShapeElement } from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { ToolsMenuGlyph } from '@liveworkspace/workbench/components/palette/context-menu-icons';

type SectionProps = (id: string) => { open: boolean; onToggle: () => void };

const FIELD =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const PRIMARY =
  'h-7 cursor-pointer rounded-md bg-brand-700 px-2 text-[11px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 disabled:cursor-default disabled:opacity-50';
const SECONDARY =
  'h-7 cursor-pointer rounded-md bg-slate-100 px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-default disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';

// The menu listens for keys; typing in a field must not trigger them. Enter runs `onEnter`.
const fieldKeys = (onEnter: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    onEnter();
  }
  e.stopPropagation();
};

function normalised(raw: string): string {
  const v = raw.trim();
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
}

export function JukeboxMenuSection({
  target,
  sectionProps,
  onSetSource,
}: {
  target: ShapeElement;
  sectionProps: SectionProps;
  onSetSource: (source: string | undefined) => void;
}) {
  const saved = target.jukeboxSource ?? '';
  const [draft, setDraft] = useFollowingDraft(`${target.id}\u0000${saved}`, () => saved);
  const [error, setError] = useState(false);
  const url = normalised(draft);
  const commit = () => {
    if (!url) return;
    if (url.length > JUKEBOX_SOURCE_MAX || !isJukeboxSource(url)) {
      setError(true);
      return;
    }
    setError(false);
    if (url !== saved) onSetSource(url);
  };
  return (
    <MenuAccordionSection title="Jukebox" icon={<ToolsMenuGlyph />} {...sectionProps('jukebox')}>
      <div className="px-3 pt-1">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Music Link
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            onKeyDown={fieldKeys(commit)}
            placeholder="An https link to an MP3, AAC or Ogg stream"
            aria-invalid={error}
            className={`mt-1 ${FIELD}`}
          />
        </label>
        {error ? (
          <p role="alert" className="pt-1 text-[10px] text-rose-600 dark:text-rose-400">
            That isn&apos;t an https link
          </p>
        ) : null}
        <p className="pt-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Use music you have the rights to share. People hear it in this jukebox&apos;s room once
          they press Play on it.
        </p>
        <div className="flex gap-1.5 py-2">
          <button
            type="button"
            onClick={commit}
            disabled={!url || url === saved}
            className={`${PRIMARY} flex-1`}
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setError(false);
              onSetSource(undefined);
            }}
            disabled={!saved}
            className={`${SECONDARY} flex-1`}
          >
            Clear
          </button>
        </div>
      </div>
    </MenuAccordionSection>
  );
}
