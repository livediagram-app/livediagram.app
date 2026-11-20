'use client';

// Deleting an unused picture (each product's docs/specs/009-elements/images.md "Deleting an unused picture"), the hook
// every canvas editor wires: it hands back `offer(removedImageIds)`, which a delete calls with the pictures of the
// image elements it removed. `enabled` is the editor's gate (the picture's possible owner, signed in, with the whole
// cloud item open as its owner or an Editor); off, an offer does nothing and asks nothing. The decision and the toast
// are ../../lib/unused-image-prompt.ts. Stable: the deps are read when an offer runs.
import { useLayoutEffect, useRef, useState } from 'react';
import { useToast } from '@liveworkspace/ui/toast';
import {
  createUnusedImagePrompt,
  nextTask,
  type UnusedImagePromptDeps,
} from '../../lib/unused-image-prompt';

export type UseUnusedImagePromptDeps = Omit<UnusedImagePromptDeps, 'toast'> & { enabled: boolean };

export function useUnusedImagePrompt(
  deps: UseUnusedImagePromptDeps,
): (removedImageIds: Iterable<string>) => void {
  const toast = useToast();
  const latest = useRef({ ...deps, toast });
  useLayoutEffect(() => {
    latest.current = { ...deps, toast };
  });
  // Made once: everything it reads is read through `latest` when an offer runs.
  const [offerOnce] = useState(() => {
    const offer = createUnusedImagePrompt({
      placed: () => latest.current.placed(),
      allTabsLoaded: () => latest.current.allTabsLoaded(),
      loadAllTabs: () => latest.current.loadAllTabs(),
      check: (ids) => latest.current.check(ids),
      remove: (id) => latest.current.remove(id),
      toast: {
        action: (spec) => latest.current.toast.action(spec),
        dismissAction: (key) => latest.current.toast.dismissAction(key),
        error: (message, options) => latest.current.toast.error(message, options),
      },
      settle: () => (latest.current.settle ?? nextTask)(),
    });
    return (removedImageIds: Iterable<string>) => {
      if (!latest.current.enabled) return;
      void offer(removedImageIds);
    };
  });
  return offerOnce;
}
