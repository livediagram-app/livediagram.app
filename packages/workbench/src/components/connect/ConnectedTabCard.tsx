'use client';

// A connected tab's page (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks"): one calm card in place of
// a canvas, the target app's logo over its words and what can be done. Remove and Connect Again only for someone who
// may edit the host (`canEdit`, the session's `can('edit')`); Open, Open Again and Try Again are everyone's.
import type { App } from '@liveworkspace/index-client';
import { BrandMark } from '@liveworkspace/brand';
import { Button, buttonClassName, lucideGlyph } from '@liveworkspace/ui';
import {
  lucideArrowUpRight,
  lucideLink,
  lucideRefreshCw,
  lucideTrash2,
} from '@liveworkspace/icons/lucide';
import { connectedTabCopy, isBrokenState, type ConnectedTabView } from './connected-tab-view';
import { appName } from './connect-words';

const ArrowGlyph = lucideGlyph(lucideArrowUpRight, 14);
const LinkGlyph = lucideGlyph(lucideLink, 14);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 14);
const TrashGlyph = lucideGlyph(lucideTrash2, 14);

export function ConnectedTabCard({
  view,
  name,
  app,
  canEdit,
  away = false,
  onOpen,
  onRemove,
  onConnectAgain,
  onRetry,
}: {
  view: ConnectedTabView;
  // The tab's name: the target's title as last seen.
  name: string;
  app: App;
  canEdit: boolean;
  // The target is in another app, so Open goes to a new browser tab.
  away?: boolean;
  // Ready: the person's Open (a press, so a new browser tab is never blocked).
  onOpen?: () => void;
  onRemove: () => void;
  onConnectAgain: () => void;
  onRetry: () => void;
}) {
  const { state } = view;
  const copy = connectedTabCopy(state, name, app, canEdit);
  const broken = isBrokenState(state);
  const mendable = state === 'link_removed' || state === 'copy';
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <section
        aria-labelledby="connected-tab-title"
        aria-busy={state === 'opening' || undefined}
        data-connected-card={state}
        className="flex w-full max-w-sm animate-dialog-in flex-col items-center rounded-3xl border border-slate-200 bg-white px-8 py-9 text-center shadow-xl motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-900"
      >
        <span
          className={`relative flex size-16 items-center justify-center rounded-2xl bg-slate-50 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${
            broken ? 'grayscale-[60%]' : ''
          }`}
        >
          <BrandMark app={app} variant="full" spinning={state === 'opening'} className="size-10" />
          {broken ? (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 size-3.5 rounded-full bg-amber-500 ring-2 ring-white dark:bg-amber-400 dark:ring-slate-900"
            />
          ) : null}
        </span>
        <h2
          id="connected-tab-title"
          className="mt-5 text-[17px] font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100"
        >
          {copy.title}
        </h2>
        <p
          role={state === 'opening' ? undefined : 'status'}
          className="mt-1.5 text-[13px] leading-relaxed text-slate-600 [overflow-wrap:anywhere] dark:text-slate-400"
        >
          {copy.line}
        </p>
        {state === 'ready' && onOpen ? (
          <Button variant="primary" size="sm" className="mt-5" onClick={onOpen}>
            {away ? <ArrowGlyph /> : null}
            {away ? `Open in ${appName(app)}` : 'Open'}
          </Button>
        ) : null}
        {view.state === 'opened' ? (
          <a
            href={view.href}
            target="_blank"
            rel="noopener"
            className={buttonClassName({ variant: 'secondary', size: 'sm', className: 'mt-5' })}
          >
            <ArrowGlyph />
            Open Again
          </a>
        ) : null}
        {state === 'failed' ? (
          <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
            <RetryGlyph />
            Try Again
          </Button>
        ) : null}
        {canEdit && broken ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {mendable ? (
              <Button variant="primary" size="sm" onClick={onConnectAgain}>
                <LinkGlyph />
                Connect Again
              </Button>
            ) : null}
            <Button variant={mendable ? 'ghost' : 'secondary'} size="sm" onClick={onRemove}>
              <TrashGlyph />
              Remove Tab
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
