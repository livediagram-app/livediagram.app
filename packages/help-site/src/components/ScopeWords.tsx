import {
  appList,
  SCOPE_WORDS,
  scopeName,
  type AppId,
  type HelpScope,
} from '@liveworkspace/help-registry';
import { capital as capitalise } from '../art/noun';
import { AppMarkRow, rowOrder } from './AppMarks';

// The words shared copy reads per scope (liveworkspace/docs/specs/017-help/help-centre.md "The work's name"), and the
// article header's Applies To row. Bound to the help centre's scope by createUseMdxComponents, so an article writes
// `<Noun />` and `<AppName />` with no import.

/** The scope's word for the work: canvas, plan, document, design or Space, and "file" under All Apps. */
export function Noun({
  scope,
  plural = false,
  capital = false,
}: {
  scope: HelpScope;
  plural?: boolean;
  capital?: boolean;
}) {
  const words = SCOPE_WORDS[scope];
  const word = plural ? words.nouns : words.noun;
  return <>{capital ? capitalise(word) : word}</>;
}

/** The scope's app's name, lower case like its logo; "every app" under All Apps. */
export function AppName({ scope }: { scope: HelpScope }) {
  return <>{scopeName(scope)}</>;
}

/** The line under the Applies To row: "Every liveworkspace app", or the apps by name. */
export function appliesToLine(apps: readonly AppId[], scope: HelpScope | undefined): string {
  if (apps.length >= 5) return 'Every liveworkspace app';
  return appList(rowOrder(apps, scope));
}

/** An article header's Applies To row (help-centre.md "The logos"): the apps' marks, the current app first and
 *  ringed, with the line naming them under it. */
export function AppliesTo({
  apps,
  scope,
}: {
  apps: readonly AppId[];
  scope: HelpScope | undefined;
}) {
  if (apps.length === 0) return null;
  return (
    <div data-applies-to="" className="flex flex-col items-start gap-1.5 md:items-end">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-(--hero-muted)">
        Applies To
      </p>
      <AppMarkRow apps={apps} scope={scope} size={22} />
      <p className="text-xs text-(--hero-muted)">{appliesToLine(apps, scope)}</p>
    </div>
  );
}
