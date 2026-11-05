'use client';

// An idle Screen opened in the walking reader (docs/specs/008-canvas/avatar-mode.md "The reader"): what fills a
// Screen, with the two ways to fill it for whoever may. Share Your Screen is the call control's own action
// (useCallActions().toggleScreen), gated as that button is: in a live call an Editor shares to the room, and with no
// call (or as a Participant) it is the local preview only you see. Set Link is the element menu's Video Link, for an
// Editor, committed through the same patch (setScreenUrlOf). Someone who may do neither sees the empty state alone.
import { useState } from 'react';
import type { ShapeElement } from '@livehuddle/document';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { useCallActions, useCallSelf } from '@/lib/calls/calls-store';
import { selfScreen } from '@/lib/calls/local-preview';
import { isScreenLink, normalisedScreenLink } from '@/lib/screen-link';

const BUTTON =
  'h-9 cursor-pointer rounded-lg px-3.5 text-[14px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-50';

export function ScreenReaderBody({ element }: { element: ShapeElement }) {
  const editor = useOptionalEditorContext();
  const self = useCallSelf();
  const actions = useCallActions();
  const screen = selfScreen(self);
  const live = self.phase === 'live';
  // The call control's own rule for showing its Share button (CallClusterButton).
  const mayShare =
    !!actions && ((live && self.canShare) || self.canPreviewScreen || screen !== 'off');
  const maySetLink =
    editor?.can.level === 'edit' && element.locked !== true && !!editor.setScreenUrlOf;
  const sharing = screen === 'on' || screen === 'starting';
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex flex-col items-center gap-2">
        {/* Set from here, the link fills the Screen at once: say so rather than keep calling it empty. */}
        <p className="text-[16px] font-semibold">
          {element.screenUrl ? 'Video link set' : 'Nothing on the Screen yet'}
        </p>
        <p className="max-w-[28rem] text-[14px] text-slate-500 dark:text-slate-400">
          {element.screenUrl
            ? 'The Screen plays it whenever nobody in its room is sharing. Press the Screen to watch it large.'
            : 'It shows a screen shared by someone in its room. Without one it plays its video link.'}
        </p>
      </div>
      {mayShare ? (
        <button
          type="button"
          onClick={actions.toggleScreen}
          disabled={screen === 'starting'}
          className={`${BUTTON} ${
            sharing
              ? 'bg-rose-500 text-white hover:bg-rose-600'
              : 'bg-brand-700 text-white hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700'
          }`}
        >
          {screen === 'starting' ? 'Choosing…' : sharing ? 'Stop Sharing' : 'Share Your Screen'}
        </button>
      ) : null}
      {maySetLink ? (
        <SetLink
          saved={element.screenUrl ?? ''}
          onSet={(url) => editor.setScreenUrlOf(element.id, url)}
        />
      ) : null}
    </div>
  );
}

function SetLink({ saved, onSet }: { saved: string; onSet: (url: string) => void }) {
  const [draft, setDraft] = useState(saved);
  const [error, setError] = useState(false);
  const url = normalisedScreenLink(draft);
  const commit = () => {
    if (!url) return;
    if (!isScreenLink(url)) {
      setError(true);
      return;
    }
    setError(false);
    if (url !== saved) onSet(url);
  };
  return (
    <form
      className="flex w-full max-w-[28rem] flex-col gap-1 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
    >
      <label className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
        Video Link
        <div className="mt-1 flex gap-2">
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(false);
            }}
            // The editor listens for keys (Escape leaves walking, letters pick tools): typing must not reach it.
            onKeyDown={(e) => {
              if (e.key !== 'Escape') e.stopPropagation();
            }}
            placeholder="A YouTube, Vimeo or Loom link"
            aria-invalid={error}
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[14px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!url || url === saved}
            className={`${BUTTON} bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`}
          >
            Set Link
          </button>
        </div>
      </label>
      {error ? (
        <p role="alert" className="text-[13px] text-rose-600 dark:text-rose-400">
          That isn&apos;t a video link
        </p>
      ) : null}
    </form>
  );
}
