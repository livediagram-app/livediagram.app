import type { ReactNode } from 'react';
import type { HelpScope } from '@liveworkspace/help-registry';
import { noteApps } from './AppNote';

// An inline version of the app note (liveworkspace/docs/specs/017-help/help-centre.md "App notes"): a phrase or a
// sentence only some apps' help shows, as plain text with no box, so it sits in a paragraph or a list item.
// `<ForApps app="livediagram,livehuddle">…</ForApps>` shows in those apps' helps; `<NotFor app="liveknowledge">…
// </NotFor>` shows in every help but those. Under All Apps both show, as every note does there.

interface InlineProps {
  scope: HelpScope | undefined;
  app?: string;
  apps?: readonly string[];
  children: ReactNode;
}

/** Whether text for `apps` shows in `scope`: always under All Apps and in a help with no scope. */
export function showsFor(apps: readonly string[], scope: HelpScope | undefined): boolean {
  if (!scope || scope === 'all') return true;
  return apps.includes(scope);
}

export function ForApps({ scope, children, ...props }: InlineProps) {
  return showsFor(noteApps(props), scope) ? <>{children}</> : null;
}

export function NotFor({ scope, children, ...props }: InlineProps) {
  const apps = noteApps(props);
  if (!scope || scope === 'all') return <>{children}</>;
  return apps.includes(scope) ? null : <>{children}</>;
}
