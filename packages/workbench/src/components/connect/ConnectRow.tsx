'use client';

// One file in the Connect list (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks"): its app's logo on a
// tile, its name, and its app and when it was last opened. One press connects it. A row already connected says so and
// goes to its tab; one that cannot be picked is dimmed and says why; a connect in progress spins; a failure says why
// under the name. Painted from the list's ink (ConnectPicker's CSS variables).
import { useId } from 'react';
import type { Item } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { lucideGlyph, relativeSince } from '@liveworkspace/ui';
import { lucideCheck, lucidePlus } from '@liveworkspace/icons/lucide';
import { Spinner } from '../palette/template-picker-icons';
import { appName } from './connect-words';

const CheckGlyph = lucideGlyph(lucideCheck, 13);
const PlusGlyph = lucideGlyph(lucidePlus, 15);

export type ConnectRowState =
  | { kind: 'open' }
  | { kind: 'connected' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'busy' }
  // Another row is connecting: this one waits.
  | { kind: 'waiting' };

export function ConnectRow({
  item,
  state,
  error,
  now,
  onPress,
}: {
  item: Item;
  state: ConnectRowState;
  // The last connect's failure on this row, in words.
  error: string | null;
  now: number;
  onPress: () => void;
}) {
  const errorId = useId();
  const reasonId = useId();
  const kind = state.kind;
  const inert = kind === 'blocked' || kind === 'busy' || kind === 'waiting';
  const when = item.lastOpenedAt ?? item.updatedAt;
  const detail =
    state.kind === 'blocked'
      ? state.reason
      : `${appName(item.app)} · Opened ${relativeSince(when, now)}`;
  return (
    <li className="relative">
      <button
        type="button"
        data-connect-row={item.id}
        data-connect-state={kind}
        aria-disabled={inert || undefined}
        aria-busy={kind === 'busy' || undefined}
        aria-describedby={
          [state.kind === 'blocked' ? reasonId : null, error ? errorId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onClick={inert ? undefined : onPress}
        className={`group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] motion-reduce:transition-none ${
          inert ? 'cursor-default' : 'cursor-pointer hover:bg-[var(--cp-hover)]'
        } ${kind === 'blocked' ? 'opacity-55' : ''} ${kind === 'waiting' ? 'opacity-70' : ''}`}
      >
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cp-border)] bg-[var(--cp-surface)]"
        >
          <BrandMark app={item.app} className="size-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-medium text-[var(--cp-text)]">
            {item.title}
          </span>
          <span
            id={state.kind === 'blocked' ? reasonId : undefined}
            className="truncate text-[12px] text-[var(--cp-muted)]"
          >
            {detail}
          </span>
        </span>
        <RowEnd kind={kind} />
      </button>
      {error ? (
        <p
          id={errorId}
          role="status"
          className="-mt-0.5 mb-1 pl-[3.625rem] pr-2.5 text-[12px] font-medium text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
    </li>
  );
}

// The row's trailing mark: what a press does.
function RowEnd({ kind }: { kind: ConnectRowState['kind'] }) {
  if (kind === 'connected')
    return (
      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--cp-column)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cp-text)]">
        <CheckGlyph />
        Connected
      </span>
    );
  if (kind === 'busy')
    return (
      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-[var(--cp-muted)]">
        <Spinner />
        Connecting
      </span>
    );
  if (kind === 'blocked') return null;
  // A plus that wakes on hover and focus; a touch screen, with no hover, always shows it.
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--cp-border)] text-[var(--cp-muted)] transition-colors duration-micro group-hover:border-[var(--cp-accent)] group-hover:bg-[var(--cp-accent)] group-hover:text-[var(--cp-on-accent)] group-focus-visible:border-[var(--cp-accent)] group-focus-visible:text-[var(--cp-accent)] motion-reduce:transition-none"
    >
      <PlusGlyph />
    </span>
  );
}
