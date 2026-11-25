'use client';

// The toast stack (liveworkspace/docs/specs/016-notifications/toasts.md "Placement", "One place for everything that
// pops up" and "Keyboard and screen readers"): an always-mounted "Notifications" region at the bottom centre, the
// newest toast nearest the edge, standing on whatever bottom chrome sits beneath it (useToastFloor). Above the toasts,
// its notice row, where every notice that is not a toast is drawn (ToastNotice: an Inbox notice, a suggestion, the
// paste notice); the row waits, undrawn, while a dialog is open. Each toast here owns its timer (paused on hover,
// focus and a hidden page), its Escape and its exit.
//
// Its keys ("Keyboard and screen readers"): F6 from anywhere, a focus-trapping popover or drawer included, moves focus to
// the newest toast's action (Undo), and focus goes back where it was once that toast is answered, closed or sent away
// with Escape. Escape closes a toast only while focus is in it, so an Escape that closes a panel never takes a toast
// with it. One window listener, in the capture phase and added before any popover's, so a trap never hears these keys.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent,
  type FocusEvent,
} from 'react';
import { Portal } from '../Portal';
import { dialogOpenNow, subscribeDialogs } from './dialog-open';
import { noticeCount, onNoticeRow, registerNoticeRow } from './notice-slot';
import { atLeastInset, safeInset } from '../safe-area';
import { ToastCard, type ToastCardAction } from './ToastCard';
import { TOAST_COLLAPSE_MS, collapseIntoBell } from './toast-collapse';
import { toastTimeout, type ToastEntry } from './toast-queue';
import { useToastFloor } from './useToastFloor';
import { useToastTimer } from './useToastTimer';
import { TOAST_STACK_ATTR } from './toast-keys';

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
const noDialog = () => false;

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

/** The key that reaches the newest toast's action, said to screen readers on every toast that has one. */
export const TOAST_REACH_KEY = 'F6';

const ACTION = '[data-toast-action]:not([disabled])';

// The newest toast with an action, and the action F6 lands on: its primary, else its last.
function newestAction(stack: HTMLElement): HTMLElement | null {
  const cards = [...stack.querySelectorAll<HTMLElement>('[data-toast-id]:not([aria-hidden])')];
  for (let i = cards.length - 1; i >= 0; i--) {
    const card = cards[i]!;
    const target =
      card.querySelector<HTMLElement>(`${ACTION}[data-toast-primary]`) ??
      [...card.querySelectorAll<HTMLElement>(ACTION)].at(-1);
    if (target) return target;
  }
  return null;
}

export function ToastStack({ toasts, on }: { toasts: ToastEntry[]; on: ToastAnswers }) {
  // Mounted after hydration (the static HTML has no stack), then always, so a toast added to it is announced.
  const hydrated = useSyncExternalStore(subscribeNever, onClient, onServer);
  const notices = useSyncExternalStore(onNoticeRow, noticeCount, () => 0);
  // A dialog over the page: the notices wait (toasts stay, as a failure must show). Watched only while one is up.
  const dialog = useSyncExternalStore(
    notices > 0 ? subscribeDialogs : subscribeNever,
    notices > 0 ? dialogOpenNow : noDialog,
    onServer,
  );
  const showing = toasts.length > 0 || notices > 0;
  const placement = useToastFloor(showing, toasts.length + notices);
  const row = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!hydrated || !row.current) return;
    return registerNoticeRow(row.current);
  }, [hydrated]);
  const stack = useRef<HTMLElement>(null);
  // Where focus was when F6 brought it to a toast, to hand it back to.
  const returnTo = useRef<HTMLElement | null>(null);
  const latest = useRef({ toasts, on });
  useLayoutEffect(() => {
    latest.current = { toasts, on };
  });
  // Focus back where F6 found it, when it is still in the stack (a toast answered by keyboard, not a click elsewhere).
  const giveBack = useCallback(() => {
    const to = returnTo.current;
    returnTo.current = null;
    const inStack = stack.current?.contains(document.activeElement) ?? false;
    if (to && to.isConnected && inStack) to.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const onKey = (e: KeyboardEvent) => {
      const root = stack.current;
      if (!root || e.defaultPrevented) return;
      const inStack = e.target instanceof Node && root.contains(e.target);
      if (e.key === 'Escape' && inStack) {
        const card = (e.target as Element).closest?.('[data-toast-id]');
        const entry = latest.current.toasts.find(
          (t) => String(t.id) === card?.getAttribute('data-toast-id'),
        );
        if (!entry) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        latest.current.on.close(entry);
        giveBack();
        return;
      }
      if (e.key !== TOAST_REACH_KEY || e.altKey || e.ctrlKey || e.metaKey || inStack) return;
      const target = newestAction(root);
      if (!target) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const from = document.activeElement;
      returnTo.current = from instanceof HTMLElement && from !== document.body ? from : null;
      target.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [hydrated, giveBack]);
  const beside = placement.right !== null;
  const atStart = placement.left != null;
  if (!hydrated) return null;
  return (
    <Portal>
      <section
        ref={stack}
        {...{ [TOAST_STACK_ATTR]: '' }}
        aria-label="Notifications"
        // Above the modal rung (z-toast) so a failure shows over an open dialog. Side padding clears a
        // landscape notch; the bottom clears the home indicator and the bottom chrome (toast-floor.ts).
        className={`pointer-events-none fixed inset-x-0 z-[var(--z-toast)] flex flex-col gap-2 ${atStart ? 'items-start' : beside ? 'items-end' : 'items-center'}`}
        style={{
          bottom: `max(${placement.bottom}px, calc(16px + ${safeInset('bottom')}))`,
          // At a start column's left edge (liveknowledge's page column), else clear of a landscape notch.
          ...(atStart
            ? { left: `${placement.left}px` }
            : { paddingLeft: atLeastInset('1rem', 'left') }),
          // Beside the bottom-right cluster on desktop: the stack's right edge stands just left of Undo.
          ...(beside
            ? { right: `${placement.right}px` }
            : { paddingRight: atLeastInset('1rem', 'right') }),
        }}
      >
        {/* The notice row: `contents`, so each notice is one of the stack's own items, 8px from the next. */}
        <div ref={row} data-toast-notices="" className={dialog ? 'hidden' : 'contents'} />
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} on={on} answered={giveBack} />
        ))}
      </section>
    </Portal>
  );
}

function ToastItem({
  toast,
  on,
  answered,
}: {
  toast: ToastEntry;
  on: ToastAnswers;
  // After any answer or close: focus back where F6 found it.
  answered: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hidden = useSyncExternalStore(subscribeVisibility, pageHidden, onServer);
  const leaving = !!toast.leaving;
  const card = useRef<HTMLDivElement>(null);
  // Collapsing into the footer's bell (toast-collapse.ts): its own animation decides when the toast is removed, and
  // the card's `toast-out` ending first is ignored.
  const collapsing = useRef(false);
  useToastTimer(leaving ? null : toastTimeout(toast), hovered || focused || hidden, () =>
    on.expire(toast.id),
  );
  useLayoutEffect(() => {
    if (!toast.leaving || toast.leaving === 'closed' || !card.current) return;
    const motion = collapseIntoBell(card.current);
    if (!motion) return;
    collapsing.current = true;
    motion.finished.then(
      () => on.remove(toast.id),
      () => {},
    );
    return () => motion.cancel();
  }, [toast.leaving, on, toast.id]);
  // The fallback for an exit whose end never comes (a hidden tab, a test environment).
  useEffect(() => {
    if (!leaving) return;
    const hold = collapsing.current ? TOAST_COLLAPSE_MS + TOAST_EXIT_HOLD_MS : TOAST_EXIT_HOLD_MS;
    const id = setTimeout(() => on.remove(toast.id), hold);
    return () => clearTimeout(id);
  }, [leaving, on, toast.id]);

  const offer = toast.offer;
  const then = (run: () => void) => () => {
    run();
    answered();
  };
  const actions: ToastCardAction[] = offer
    ? [
        { label: offer.declineLabel, onSelect: then(() => on.answer(toast, false)) },
        { label: offer.confirmLabel, onSelect: then(() => on.answer(toast, true)), primary: true },
      ]
    : (toast.actions ?? []).map((a, i, all) => ({
        ...a,
        onSelect: a.onSelect ? then(a.onSelect) : undefined,
        primary: i === all.length - 1,
      }));
  const reach = actions.find((a) => a.primary) ?? actions.at(-1);

  return (
    <ToastCard
      ref={card}
      tone={toast.tone}
      message={toast.message}
      actions={actions}
      toggle={toast.toggle}
      leaving={leaving}
      full={toast.full === true}
      highlight={toast.highlight === true}
      aria-hidden={leaving || undefined}
      data-toast-id={toast.id}
      hint={reach && !leaving ? `Press ${TOAST_REACH_KEY} to reach ${reach.label}.` : undefined}
      onClose={then(() => on.close(toast))}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onAnimationEnd={(e: AnimationEvent<HTMLDivElement>) => {
        if (leaving && !collapsing.current && e.target === e.currentTarget) on.remove(toast.id);
      }}
    />
  );
}
