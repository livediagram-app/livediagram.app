'use client';

// The rule builder on a phone (docs/specs/026-plan/automations.md "The rule builder on a phone"): a tall sheet over the
// Automations screen, which stays behind it. Swiping it down, the dim behind it and Escape go back to the rules, asking
// Discard Changes? first while it has unsaved changes (`beforeClose` answers false, so it springs back while it asks).

import { useId, type ReactNode } from 'react';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';

export function RuleDrawer({
  title,
  onClose,
  beforeClose,
  children,
}: {
  // "New Rule" or "Edit Rule", for screen readers: the header shows the rule's own name.
  title: string;
  onClose: () => void;
  beforeClose: () => boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog
      open
      onClose={onClose}
      beforeClose={beforeClose}
      titleId={titleId}
      size="3xl"
      phoneSheet="tall"
      initialFocus="container"
      className="max-h-none overflow-hidden"
    >
      <h2 id={titleId} className="sr-only">
        {title}
      </h2>
      <div data-rule-drawer="" className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </Dialog>
  );
}
