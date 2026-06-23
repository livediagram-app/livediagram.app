'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmDialog, type ConfirmDialogProps } from '@/components/ConfirmDialog';

// Imperative `confirm({...}) => Promise<boolean>` adapter around
// the declarative ConfirmDialog. Call sites stay declarative even
// though they want to gate an action behind a yes/no:
//
//   const confirm = useConfirm();
//   if (!await confirm({ title: 'Delete tab?', message: '...' })) return;
//   // ...do the destructive thing
//
// Provider renders the dialog once at the app root and routes
// every confirm() call through a single resolve queue so an
// open dialog supersedes anything new (the prior promise resolves
// false, the new prompt takes the slot). Matches the way the OS
// confirm modal behaves (only one at a time).

type ConfirmOptions = Pick<
  ConfirmDialogProps,
  'title' | 'message' | 'confirmLabel' | 'cancelLabel' | 'variant'
>;

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  // Hold the active pending state in a ref so the close handlers
  // can resolve the right promise even if React batches multiple
  // calls in the same tick. setPending alone races.
  const activeRef = useRef<Pending | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      // Supersede: any in-flight prompt resolves false so the prior
      // caller's await unblocks before the new dialog appears.
      const prior = activeRef.current;
      if (prior) prior.resolve(false);
      const next: Pending = { ...opts, resolve };
      activeRef.current = next;
      setPending(next);
    });
  }, []);

  const finish = useCallback((ok: boolean) => {
    const active = activeRef.current;
    if (!active) return;
    activeRef.current = null;
    setPending(null);
    active.resolve(ok);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.confirmLabel}
        cancelLabel={pending?.cancelLabel}
        variant={pending?.variant}
        onConfirm={() => finish(true)}
        onCancel={() => finish(false)}
      />
    </ConfirmContext.Provider>
  );
}

// Outside-provider fallback: returns a no-op that resolves true so
// destructive flows degrade to "just do it" rather than hanging
// forever. The provider lives at the root layout so this only
// fires in test harnesses that mount components in isolation.
const fallback = async () => true;

export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  return useContext(ConfirmContext) ?? fallback;
}
