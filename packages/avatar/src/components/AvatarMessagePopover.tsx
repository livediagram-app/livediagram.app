'use client';

// The message popover (docs/specs/008-canvas/avatar-mode.md "The message popover"): type a message, then Send or
// Cancel. The phone's way to speak, since a phone has no Enter key to open the composer; a desktop has both.
//
// A product dresses it in its own popover parts: livehuddle hangs it from the avatar palette's Say, under its flyout
// header with its actions in the flyout's footer bar (`header`, `bodyClassName`, `footerClassName`); livediagram
// shows it in place of its Avatar panel's body, with its small title and the actions under the field. Either way the
// message is the app's standard text field and the actions are Cancel then Send, right-aligned, as every dialog's.

import { useState, type ReactNode } from 'react';
import { Button } from '@liveworkspace/ui';
import { SendIcon, SpeechCounter, SpeechDraftField } from './AvatarSpeechBubble';

export function AvatarMessagePopover({
  coolingDown,
  onSend,
  onCancel,
  header,
  bodyClassName = '',
  footerClassName = '',
}: {
  coolingDown: boolean;
  // Sends; answers whether it went.
  onSend: (text: string) => boolean;
  onCancel: () => void;
  // The popover's header (livehuddle's flyout header). Without one it names itself with a small title.
  header?: ReactNode;
  // The field's section and the actions' bar, when the host lays out the popover's edges (a bare popover).
  bodyClassName?: string;
  footerClassName?: string;
}) {
  const [draft, setDraft] = useState('');
  const blank = !draft.trim();
  const submit = () => {
    if (blank || coolingDown) return;
    if (onSend(draft)) setDraft('');
  };
  return (
    <form
      className={header ? 'flex flex-col' : 'flex flex-col gap-2'}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {header ?? (
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Send a Message
        </div>
      )}
      <div className={`flex flex-col gap-1.5 ${bodyClassName}`}>
        <SpeechDraftField
          framed
          autoFocus
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={onCancel}
          minRows={3}
          maxRows={6}
        />
        <div className="flex min-h-4 items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {coolingDown ? 'One moment…' : 'Up to 50 words.'}
          </span>
          <SpeechCounter text={draft} />
        </div>
      </div>
      <div className={`flex items-center justify-end gap-2 ${footerClassName}`}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={blank || coolingDown}>
          <SendIcon />
          Send
        </Button>
      </div>
    </form>
  );
}
