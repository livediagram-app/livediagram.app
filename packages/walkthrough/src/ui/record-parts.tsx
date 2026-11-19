'use client';

// What the recording's set-up (RecordSetup, inside Tools) and its dock (RecordDock) share: a problem's note, the
// shared callout (liveworkspace/docs/specs/016-notifications/callouts.md).
import type { ReactNode } from 'react';
import { Callout } from '@liveworkspace/ui/callout';

export function Problem({
  children,
  tone = 'amber',
}: {
  children: ReactNode;
  tone?: 'amber' | 'rose';
}) {
  return (
    <Callout tone={tone === 'rose' ? 'error' : 'warning'} role="alert">
      {children}
    </Callout>
  );
}
