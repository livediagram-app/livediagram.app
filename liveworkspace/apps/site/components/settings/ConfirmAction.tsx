'use client';

import { useEffect, useRef, useState } from 'react';
import { BUTTON } from './account-ui';

// A destructive button that asks first, in place: Revoke becomes Revoke now and Keep (TokensPanel), Delete becomes
// Delete now and Keep (webhooks). The button pressed is swapped for the next step's, so the keyboard follows it: to
// Keep (the safe answer) when asked, back to the first button when kept. Not on the first render, where nothing here
// had focus.
export function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const firstRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (!asked.current) return;
    (confirming ? keepRef : firstRef).current?.focus();
  }, [confirming]);
  const ask = (next: boolean) => {
    asked.current = true;
    setConfirming(next);
  };

  return confirming ? (
    <span className="flex gap-1">
      <button type="button" className={BUTTON.danger} onClick={() => void onConfirm()}>
        {confirmLabel}
      </button>
      <button ref={keepRef} type="button" className={BUTTON.secondary} onClick={() => ask(false)}>
        Keep
      </button>
    </span>
  ) : (
    <button ref={firstRef} type="button" className={BUTTON.danger} onClick={() => ask(true)}>
      {label}
    </button>
  );
}
