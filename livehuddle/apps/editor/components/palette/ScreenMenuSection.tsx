'use client';

// The Screen's setting in the element menu (docs/specs/009-elements/screen-and-room-sign.md "Screen"): its Video Link,
// a YouTube, Vimeo or Loom address it shows when nobody in its room is sharing. Typed locally and committed with Set
// or Enter, like the portal's name; a link that is not a video says so and is not saved. Only an Editor's menu
// renders it.
import { useState } from 'react';
import { screenVideoTarget, SCREEN_URL_MAX, type ShapeElement } from '@livehuddle/document';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useFollowingDraft } from '@liveworkspace/workbench/hooks/ui/useFollowingDraft';
import { ToolsMenuGlyph } from '@/components/palette/context-menu-icons';

// A bare youtu.be/... is judged as the https:// address that would be stored, as the video element's picker does.
function normalised(raw: string): string {
  const v = raw.trim();
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
}

export function ScreenMenuSection({
  target,
  sectionProps,
  onSetScreenUrl,
}: {
  target: ShapeElement;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void };
  onSetScreenUrl: (url: string | undefined) => void;
}) {
  const saved = target.screenUrl ?? '';
  const [draft, setDraft] = useFollowingDraft(`${target.id}\u0000${saved}`, () => saved);
  const [error, setError] = useState(false);
  const url = normalised(draft);
  const commit = () => {
    if (!url) return;
    if (url.length > SCREEN_URL_MAX || !screenVideoTarget(url)) {
      setError(true);
      return;
    }
    setError(false);
    if (url !== saved) onSetScreenUrl(url);
  };
  return (
    <MenuAccordionSection title="Screen" icon={<ToolsMenuGlyph />} {...sectionProps('screen')}>
      <div className="px-3 pt-1">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Video Link
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
              // The menu listens for keys; typing a link must not trigger them.
              e.stopPropagation();
            }}
            placeholder="A YouTube, Vimeo or Loom link"
            aria-invalid={error}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
        </label>
        {error ? (
          <p role="alert" className="pt-1 text-[10px] text-rose-600 dark:text-rose-400">
            That isn&apos;t a video link
          </p>
        ) : null}
        <div className="flex gap-1.5 py-2">
          <button
            type="button"
            onClick={commit}
            disabled={!url || url === saved}
            className="h-7 flex-1 cursor-pointer rounded-md bg-brand-700 px-2 text-[11px] font-semibold text-white transition hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 disabled:cursor-default disabled:opacity-50"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft('');
              setError(false);
              onSetScreenUrl(undefined);
            }}
            disabled={!saved}
            className="h-7 flex-1 cursor-pointer rounded-md bg-slate-100 px-2 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200 disabled:cursor-default disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear
          </button>
        </div>
        <p className="pb-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Shown when nobody in the room is sharing their screen. Plays for whoever opens it.
        </p>
      </div>
    </MenuAccordionSection>
  );
}
