'use client';

// The Avatar panel's message view (docs/specs/008-canvas/avatar-mode.md "The message popover"): type a message,
// then Send or Cancel. The phone's way to speak, since a phone has no Enter key to open the composer; a desktop
// has both. Shown in place of the panel's body, in the same popover over the Avatar button.

import { useState } from 'react';
import { Button } from '@livediagram/ui';
import { SpeechCounter, SpeechDraftField } from '@/components/canvas/AvatarSpeechBubble';

export function AvatarMessagePopover({
  coolingDown,
  onSend,
  onCancel,
}: {
  coolingDown: boolean;
  // Sends; answers whether it went.
  onSend: (text: string) => boolean;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState('');
  const blank = !draft.trim();
  const submit = () => {
    if (blank || coolingDown) return;
    if (onSend(draft)) setDraft('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Send a Message
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900">
        <SpeechDraftField
          autoFocus
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={onCancel}
          minRows={3}
          maxRows={6}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">
          {coolingDown ? 'One moment…' : 'Up to 50 words. It floats up for everyone.'}
        </span>
        <SpeechCounter text={draft} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={blank || coolingDown} onClick={submit}>
          Send
        </Button>
      </div>
    </div>
  );
}
