'use client';

// The toast stack (docs/specs/004-interface-design/toasts.md "Placement" and "Keyboard and screen
// readers"): an always-mounted "Notifications" region at the bottom centre, the newest toast nearest the
// edge, standing on whatever bottom chrome sits beneath it (useToastFloor). Each toast here owns its timer
// (paused on hover, focus and a hidden page), its Escape and its exit.
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type FocusEvent,
} from 'react';
import { Portal, atLeastInset, safeInset } from '@livedesign/ui';
import { ToastCard, type ToastCardAction } from './ToastCard';
import { toastTimeout, type ToastEntry } from './toast-queue';
import { useToastFloor } from './useToastFloor';
import { useToastTimer } from '@liveworkspace/workbench/components/toast/useToastTimer';

/** The exit hold: `toast-out` runs at `micro`; removed then even where `animationend` never fires. */
export const TOAST_EXIT_HOLD_MS = 150;

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

const subscribeVisibility = (fire: () => void) => {
  document.addEventListener('visibilitychange', fire);
  return () => document.removeEventListener('visibilitychange', fire);
};
const pageHidden = () => document.visibilityState === 'hidden';

export type ToastAnswers = {
  // Closed (the close button or Escape): an offer's decline.
  close: (entry: ToastEntry) => void;
  // An offer answered from its own buttons.
  answer: (entry: ToastEntry, confirm: boolean) => void;
  // Timed out.
  expire: (id: number) => void;
  // Exit played: drop it.
  remove: (id: number) => void;
};

export function ToastStack({ toasts, on }: { toasts: ToastEntry[]; on: ToastAnswers }) {
  // Mounted after hydration (the static HTML has no stack), then always, so a toast added to it is announced.
  const hydrated = useSyncExternalStore(subscribeNever, onClient, onServer);
  const showing = toasts.length > 0;
  const floor = useToastFloor(showing, toasts.length);
  if (!hydrated) return null;
  return (
    <Portal>
      <section
        aria-label="Notifications"
        // Above the modal rung (z-toast) so a failure shows over an open dialog. Side padding clears a
        // landscape notch; the bottom clears the home indicator and the bottom chrome (toast-floor.ts).
        className="pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex flex-col items-center gap-2"
        style={{
          bottom: `max(${floor}px, calc(16px + ${safeInset('bottom')}))`,
          paddingLeft: atLeastInset('1rem', 'left'),
          paddingRight: atLeastInset('1rem', 'right'),
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} on={on} />
        ))}
      </section>
    </Portal>
  );
}

function ToastItem({ toast, on }: { toast: ToastEntry; on: ToastAnswers }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hidden = useSyncExternalStore(subscribeVisibility, pageHidden, onServer);
  const leaving = toast.leaving === true;
  useToastTimer(leaving ? null : toastTimeout(toast), hovered || focused || hidden, () =>
    on.expire(toast.id),
  );
  // The fallback for an exit whose animationend never comes (a hidden tab, a test environment).
  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => on.remove(toast.id), TOAST_EXIT_HOLD_MS);
    return () => clearTimeout(id);
  }, [leaving, on, toast.id]);

  const offer = toast.offer;
  const actions: ToastCardAction[] = offer
    ? [
        { label: offer.declineLabel, onSelect: () => on.answer(toast, false) },
        { label: offer.confirmLabel, onSelect: () => on.answer(toast, true), primary: true },
      ]
    : (toast.actions ?? []).map((a, i, all) => ({ ...a, primary: i === all.length - 1 }));

  return (
    <ToastCard
      tone={toast.tone}
      message={toast.message}
      actions={actions}
      leaving={leaving}
      full={toast.full === true}
      aria-hidden={leaving || undefined}
      onClose={() => on.close(toast)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        e.preventDefault();
        on.close(toast);
      }}
      onAnimationEnd={(e: AnimationEvent<HTMLDivElement>) => {
        if (leaving && e.target === e.currentTarget) on.remove(toast.id);
      }}
    />
  );
}
