'use client';

// The share-link password gate (@liveworkspace/workbench/components/dialogs/SharePasswordGate), in this
// product's word: "This document is password-protected". Only the noun is this editor's.
import {
  SharePasswordGate as WorkbenchSharePasswordGate,
  type SharePasswordGateProps,
} from '@liveworkspace/workbench/components/dialogs/SharePasswordGate';

export function SharePasswordGate(props: Omit<SharePasswordGateProps, 'noun'>) {
  return <WorkbenchSharePasswordGate noun="document" {...props} />;
}
