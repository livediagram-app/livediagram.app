'use client';

// A template's offer in the Connect list (liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it",
// Work Tracker 1281): "Make a plan beside it", the target app's logo on a tile with a small plus, and what it makes. It
// sits under a Suggested heading above Find a file, in a quiet dashed frame so it reads as a suggestion, not a file.
// One press makes the file and connects it; it spins while it runs and says why on a failure, as a file's row does.
// Painted from the list's ink (ConnectPicker's CSS variables).
import { useId } from 'react';
import type { App } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucidePlus } from '@liveworkspace/icons/lucide';
import { RowEnd } from './ConnectRow';

const BadgeGlyph = lucideGlyph(lucidePlus, 9);

export type ConnectOfferState = 'open' | 'busy' | 'waiting';

export function ConnectOfferRow({
  app,
  title,
  line,
  state,
  error,
  onPress,
}: {
  app: App;
  title: string;
  line: string;
  state: ConnectOfferState;
  // The last press's failure, in words.
  error: string | null;
  onPress: () => void;
}) {
  const errorId = useId();
  const inert = state !== 'open';
  return (
    <div>
      <button
        type="button"
        data-connect-offer={app}
        data-connect-state={state}
        aria-disabled={inert || undefined}
        aria-busy={state === 'busy' || undefined}
        aria-describedby={error ? errorId : undefined}
        onClick={inert ? undefined : onPress}
        className={`group flex w-full items-center gap-3 rounded-xl border border-dashed border-[var(--cp-border)] px-2.5 py-2 text-left outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-[var(--cp-accent)] motion-reduce:transition-none ${
          inert
            ? 'cursor-default'
            : 'cursor-pointer hover:border-[var(--cp-accent)] hover:bg-[var(--cp-hover)]'
        } ${state === 'waiting' ? 'opacity-70' : ''}`}
      >
        <span
          aria-hidden
          className="relative flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--cp-border)] bg-[var(--cp-surface)]"
        >
          <BrandMark app={app} className="size-5" />
          <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-[var(--cp-accent)] text-[var(--cp-on-accent)] ring-2 ring-[var(--cp-card)]">
            <BadgeGlyph />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-medium text-[var(--cp-text)]">{title}</span>
          <span className="truncate text-[12px] text-[var(--cp-muted)]">{line}</span>
        </span>
        <RowEnd kind={state} busyLabel="Making" />
      </button>
      {error ? (
        <p
          id={errorId}
          role="status"
          className="mt-1 pl-[3.625rem] pr-2.5 text-[12px] font-medium text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
