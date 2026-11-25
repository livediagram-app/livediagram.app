'use client';

import { useEffect, useEffectEvent, type ReactNode } from 'react';
import { Callout, type CalloutAction, type CalloutSize } from '@liveworkspace/ui/callout';
import { errorMessage, errorWords, whenBackOnline } from '@liveworkspace/ui/error-words';

// The account panels' error note, in a module of its own so a row outside them (Reset All Settings, drawn in each
// editor's own Settings) can say a refusal the same way without bringing the panels' other parts along. It is the
// shared callout (liveworkspace/docs/specs/016-notifications/callouts.md), with its Try Again as the callout's action.
//
// Given a failed read's `error` (liveworkspace/docs/specs/022-interface-design/error-words.md), it offers Try Again only
// where trying again can help (never when signed out, without access or gone), and a read that failed offline says so
// and runs its action again by itself once the browser is back online. An action's refusal (a save, a reset) passes no
// `error`: it is never sent again behind the person's back.
export function ErrorNote({
  children,
  action,
  error,
  className = 'mt-3',
  size = 'md',
}: {
  children: ReactNode;
  action?: CalloutAction;
  error?: string;
  className?: string;
  size?: CalloutSize;
}) {
  const words = error === undefined ? null : errorWords(error);
  const retriesItself = words?.kind === 'offline' && action !== undefined;
  // The newest action, so a parent's new callback each render doesn't resubscribe.
  const retry = useEffectEvent(() => action?.onSelect());

  useEffect(() => {
    if (!retriesItself) return;
    return whenBackOnline(retry);
  }, [retriesItself]);

  const shown = retriesItself || (words && !words.canRetry) ? undefined : action;
  return (
    <Callout tone="error" role="alert" size={size} action={shown} className={className}>
      {retriesItself ? errorMessage(error, { retriesItself: true }) : children}
    </Callout>
  );
}
