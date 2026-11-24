'use client';

// An idle Screen opened in the walking reader (docs/specs/008-canvas/avatar-mode.md "The reader"): what fills a
// Screen, with the ways to fill it for whoever may. Share Your Screen is the call control's own action
// (useCallActions().toggleScreen), gated as that button is: in a live call an Editor shares to the room, and with no
// call (or as a Participant) it is the local preview only you see. Choose What It Shows is an Editor's: it closes the
// reader and opens Show on the Screen (docs/specs/009-elements/screen-and-room-sign.md "Choosing what it shows") for
// this Screen. Someone who may do neither sees the empty state alone.
import type { ShapeElement } from '@livehuddle/document';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { useCallActions, useCallSelf } from '@/lib/calls/calls-store';
import { selfScreen } from '@/lib/calls/local-preview';
import { openScreenPicker } from '@/lib/office/screen-picker-store';
import { ScreenSourcePanel } from '@/components/dialogs/screen-source-panel';
import { screenWords } from './screen-words';

const BUTTON =
  'h-9 cursor-pointer rounded-lg px-3.5 text-[14px] font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-50';

const preload = () => void ScreenSourcePanel.preload();

export function ScreenReaderBody({
  element,
  onClose,
}: {
  element: ShapeElement;
  // Closes the reader: Choose What It Shows opens its dialog in the reader's place.
  onClose?: () => void;
}) {
  const editor = useOptionalEditorContext();
  const self = useCallSelf();
  const actions = useCallActions();
  const screen = selfScreen(self);
  const live = self.phase === 'live';
  // The call control's own rule for showing its Share button (CallStripGroup).
  const mayShare =
    !!actions && ((live && self.canShare) || self.canPreviewScreen || screen !== 'off');
  const mayChoose = editor?.can.level === 'edit' && !!editor.setScreenSourceOf;
  const sharing = screen === 'on' || screen === 'starting';
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-[16px] font-semibold">Nothing on the Screen yet</p>
        <p className="max-w-[28rem] text-[14px] text-slate-500 dark:text-slate-400">
          It shows a screen shared by someone in its room. Without one it shows its file, live for
          everyone with access, or plays its video.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
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
        {mayChoose ? (
          <button
            type="button"
            onPointerEnter={preload}
            onFocus={preload}
            onClick={() => {
              onClose?.();
              openScreenPicker(element.id, element.screenUrl ? 'video' : 'file');
            }}
            className={`${BUTTON} bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`}
          >
            {screenWords.chooseWhatItShows}
          </button>
        ) : null}
      </div>
    </div>
  );
}
