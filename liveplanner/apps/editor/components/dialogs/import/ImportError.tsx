import type { ReactNode } from 'react';
import { Callout } from '@liveworkspace/ui/callout';

// Why a file was not taken, in the Import dialog: under its list or its preview, announced as it appears.
export function ImportError({ children }: { children: ReactNode }) {
  return (
    <Callout tone="error" role="alert">
      {children}
    </Callout>
  );
}
