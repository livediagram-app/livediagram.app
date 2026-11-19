import type { ReactNode } from 'react';
import { Callout, type CalloutAction } from '@liveworkspace/ui/callout';

// The account panels' error note, in a module of its own so a row outside them (Reset All Settings, drawn in each
// editor's own Settings) can say a refusal the same way without bringing the panels' other parts along. It is the
// shared callout (liveworkspace/docs/specs/016-notifications/callouts.md), with its Try Again as the callout's action.
export function ErrorNote({ children, action }: { children: ReactNode; action?: CalloutAction }) {
  return (
    <Callout tone="error" role="alert" size="md" action={action} className="mt-3">
      {children}
    </Callout>
  );
}
