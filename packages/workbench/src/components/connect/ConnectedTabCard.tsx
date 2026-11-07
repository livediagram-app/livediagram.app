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
import type { ConnectedPreview } from './useConnectedPreview';

const ArrowGlyph = lucideGlyph(lucideArrowUpRight, 14);
const LinkGlyph = lucideGlyph(lucideLink, 14);
const RetryGlyph = lucideGlyph(lucideRefreshCw, 14);
const TrashGlyph = lucideGlyph(lucideTrash2, 14);

const NO_PREVIEW: ConnectedPreview = { state: 'none' };

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
  preview = NO_PREVIEW,
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
  // The target's picture (useConnectedPreview): over a smaller logo while asked for or drawn, the logo alone for none.
  preview?: ConnectedPreview;
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
        {preview.state === 'none' ? (
          <Logo app={app} broken={broken} spinning={state === 'opening'} size="large" />
        ) : (
          // The picture, the logo sitting on its lower edge. A file that is gone or unreachable keeps its picture
          // greyed, as its logo is.
          <div className="flex w-full flex-col items-center">
            <div
              data-connected-preview={preview.state}
              className={`aspect-[16/10] w-full overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 ${
                preview.state === 'loading' ? 'animate-pulse motion-reduce:animate-none' : ''
              } ${broken ? 'grayscale-[60%]' : ''}`}
            >
              {preview.state === 'ready' ? (
                <img
                  src={preview.src}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-cover object-top"
                />
              ) : null}
            </div>
            <div className="-mt-6">
              <Logo app={app} broken={broken} spinning={state === 'opening'} size="small" />
            </div>
          </div>
        )}
        <h2
          id="connected-tab-title"
          className={`${preview.state === 'none' ? 'mt-5' : 'mt-3'} text-[17px] font-semibold tracking-tight text-slate-900 [overflow-wrap:anywhere] dark:text-slate-100`}
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

// The target app's logo on its tile: large on its own, smaller on a picture's edge (ringed in the card's paper so it
// reads over the picture). An amber dot when the tab opens nothing.
function Logo({
  app,
  broken,
  spinning,
  size,
}: {
  app: App;
  broken: boolean;
  spinning: boolean;
  size: 'large' | 'small';
}) {
  const large = size === 'large';
  return (
    <span
      className={`relative flex items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 ${
        large
          ? 'size-16 ring-1 ring-slate-200 dark:ring-slate-700'
          : 'size-12 shadow-sm ring-4 ring-white dark:ring-slate-900'
      } ${broken ? 'grayscale-[60%]' : ''}`}
    >
      <BrandMark
        app={app}
        variant="full"
        spinning={spinning}
        className={large ? 'size-10' : 'size-8'}
      />
      {broken ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 size-3.5 rounded-full bg-amber-500 ring-2 ring-white dark:bg-amber-400 dark:ring-slate-900"
        />
      ) : null}
    </span>
  );
}
