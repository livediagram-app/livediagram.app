import type { TimingBucket, TimingScaleKey } from '@livediagram/api-schema';
import type { Noun } from './app';
import type { CtaFunnel } from './cta-funnel';
import { articleTitle, CANVAS_CONTROLS, eventLabel, typeLabel } from './event-vocab';
import { createTimingSentence } from './timing-explanation';

// The plain-language sentence under every metric (docs/specs/017-telemetry/telemetry.md): what someone did
// to make the event, for a reader who has never seen the code. Looked up in
// order:
//  1. an exact sentence for this category·action·type (the app's event-explanations.ts);
//  2. a pattern, for types that are computed at runtime and so can't all be
//     listed: a help article, an error code, an element kind, a template;
//  3. a sentence for the category·action that fits any type;
//  4. a last resort naming the event, which no event the code sends should
//     reach (each app's event-explanation.test.ts).
//
// The patterns are every app's; what they name (the app, the thing it makes, its CLI's commands,
// its call-to-action buttons, its timings) is the app's own, handed in.

export type ExplanationSources = {
  /** The app's name, as a failing request names its server: 'livediagram'. */
  name: string;
  noun: Noun;
  /** One sentence per `Category|Action|Type`. */
  exact: Readonly<Record<string, string>>;
  /** One sentence per `Category|Action`, for any type. */
  byAction: Readonly<Record<string, string>>;
  /** The plain phrase for each operation an `Error·Api` type names. */
  apiOperations: Readonly<Record<string, string>>;
  cliCommandSentence: (type: string) => string | null;
  funnel: CtaFunnel;
  /** The app's own timing parser: its metrics, so another app's timing is not read as its own. */
  parseTimingType: (
    type: string,
  ) => { metric: string; bucket: TimingBucket; scale: TimingScaleKey } | null;
};

const SIDEBAR_PREFIX = 'Sidebar.';
const PANEL_PREFIX = 'ExplorerPanel.';

export function createEventExplanation(
  sources: ExplanationSources,
): (category: string, action: string, type: string | null) => string {
  const { name, noun, exact, byAction, apiOperations, funnel } = sources;
  const timingSentence = createTimingSentence(noun);

  function pattern(category: string, action: string, type: string): string | null {
    // The thing the app makes is its own category (Document, Project, Design).
    const key = category === noun.Title ? `Noun|${action}` : `${category}|${action}`;
    switch (key) {
      case 'Cli|Used':
        return sources.cliCommandSentence(type);
      // Timings (docs/specs/017-telemetry/timing-telemetry.md): which moment, and the bucket it fell in.
      case 'Timing|Measured': {
        const parsed = sources.parseTimingType(type);
        return parsed ? timingSentence(parsed) : null;
      }
      case 'Page|View':
        return `Someone viewed the page ${type}, by loading it or following a link to it within the site.`;
      // The landing funnel (docs/specs/019-marketing/landing-funnel.md): which public-page button it was.
      case 'Cta|Opened': {
        const surface = funnel.surfaceOfSource(type);
        return surface
          ? `Someone followed the ${funnel.sourceLabel(type)} button on the ${funnel.surfaceLabel(surface)} and reached the New ${noun.Title} page.`
          : null;
      }
      case 'Cta|Created': {
        const surface = funnel.surfaceOfSource(type);
        return surface
          ? `Someone who arrived from the ${funnel.sourceLabel(type)} button on the ${funnel.surfaceLabel(surface)} went on to create a ${noun.one}.`
          : null;
      }
      case 'Element|Added':
        return `Someone added ${withArticle(words(type))} to the canvas.`;
      case 'Noun|Exported':
        return `Someone exported a tab as ${type}.`;
      case 'Noun|Joined':
        return `Someone came into a ${noun.one} through ${withArticle(`${words(type)}-role`)} share link. Counted once per person per ${noun.one}, not on every revisit.`;
      case 'Tab|Imported':
        return `Someone imported a tab from ${withArticle(type)} file.`;
      case 'Theme|Changed':
        return `A tab was given the ${typeLabel(type)} theme: switched to it, or picked when a ${noun.one} or template was created with it.`;
      case 'Canvas|Changed': {
        const control = CANVAS_CONTROLS[type];
        return control
          ? `Someone adjusted a tab's ${control} in the canvas panel.`
          : `Someone switched a tab's background pattern to ${titleWords(type)}.`;
      }
      case 'Template|Used':
        return `Someone started a fresh tab from the ${titleWords(type)} template.`;
      case 'Search|Selected':
        return `Someone picked ${withArticle(words(type))} result from the editor's search.`;
      // The Explorer sidebar (docs/specs/013-workspace/explorer-structure.md): which row.
      case 'UI|Selected':
        if (type.startsWith(SIDEBAR_PREFIX))
          return `Someone picked the ${words(type.slice(SIDEBAR_PREFIX.length))} row in the Explorer's sidebar.`;
        return type.startsWith(PANEL_PREFIX)
          ? `Someone picked the ${words(type.slice(PANEL_PREFIX.length))} row in the editor's Explorer panel.`
          : null;
      case 'UI|Opened':
        return isArticleSlug(type)
          ? `Someone opened the "${articleTitle(type)}" help article from inside the editor, through a help link or a search result.`
          : null;
      case 'Help|View':
        return `Someone read the "${articleTitle(type)}" help article.`;
      case 'Help|Helpful':
        return `Someone answered "Was this helpful?" with yes at the end of the "${articleTitle(type)}" help article. Counted once per visit, by the reader's final answer.`;
      case 'Help|Unhelpful':
        return `Someone answered "Was this helpful?" with no at the end of the "${articleTitle(type)}" help article. Counted once per visit, by the reader's final answer.`;
      case 'Error|Api':
        return apiError(type);
      case 'Error|Client':
        return clientError(type);
      default:
        return null;
    }
  }

  // `Http403.SaveTab.Forbidden`, `Network.SendEmail`, `Internal.Put.Documents.Tabs`,
  // `Internal.FindDocuments`, `Auth.NoSessionToken`, `SaveFailed.TypeError`: the
  // error-telemetry shapes (packages/api-schema, apps/editor/lib/api/error-report.ts).
  function apiError(type: string): string | null {
    const [kind = '', ...rest] = type.split('.');
    const operation = (op: string | undefined) =>
      op ? capitalise(apiOperations[op] ?? words(op)) : `A request to ${name}`;
    const http = /^Http(\d{3})$/.exec(kind);
    if (http) return `${operation(rest[0])} ${statusPhrase(Number(http[1]))}.`;
    if (kind === 'Network')
      return `${operation(rest[0])} never got an answer: the connection dropped, or the service could not be reached.`;
    if (type === 'Auth.NoSessionToken')
      return "A signed-in visitor's request was held back because no sign-in token was available to send with it.";
    if (kind === 'SaveFailed')
      return `Saving changes failed with ${errorKind(rest[0])} before any request was answered.`;
    if (kind === 'Internal' && rest.length >= 2)
      return `A ${name} server crashed while handling a request to its ${words(rest.slice(1).join(' '))} endpoint.`;
    if (kind === 'Internal' && rest.length === 1)
      return `An AI tool's ${words(rest[0]!)} request never completed, because the ${name} server behind it failed.`;
    return null;
  }

  return (category, action, type) =>
    exact[`${category}|${action}|${type ?? ''}`] ??
    (type ? pattern(category, action, type) : null) ??
    byAction[`${category}|${action}`] ??
    `Someone did ${eventLabel({ action, type })} (${category}).`;
}

function statusPhrase(status: number): string {
  if (status === 400) return 'was rejected as a malformed request';
  if (status === 401) return "failed because the visitor wasn't recognised as signed in";
  if (status === 403) return "was refused because the visitor didn't have permission";
  if (status === 404) return 'found nothing there: what it asked for no longer exists';
  if (status === 409) return 'clashed with another change made at the same time';
  if (status === 413) return 'was turned away as too large';
  if (status === 429) return 'was turned away for asking too often';
  if (status >= 500) return 'failed with an error on the server';
  return `failed with status ${status}`;
}

// `Uncaught.<Page>.<Kind>`, `UnhandledRejection.<Page>.<Kind>`,
// `Render.<Area>.<Kind>`.
function clientError(type: string): string | null {
  const [kind, where, jsKind] = type.split('.');
  if (!where) return null;
  const what = errorKind(jsKind);
  if (kind === 'Uncaught')
    return `The ${words(where)} page hit ${what} that nothing in the code caught.`;
  if (kind === 'UnhandledRejection')
    return `A background task on the ${words(where)} page failed with ${what}, and nothing handled it.`;
  if (kind === 'Render')
    return `The ${words(where)} part of the page failed to draw after ${what}, and showed an error message in its place instead of taking the whole page down.`;
  return null;
}

function errorKind(kind: string | undefined): string {
  if (kind === 'TypeError') return 'an unexpected missing or wrong kind of value';
  if (kind === 'RangeError') return 'a value out of its allowed range';
  if (kind === 'ReferenceError') return 'a reference to something that does not exist';
  if (kind === 'SyntaxError') return "data it couldn't read";
  return 'an error';
}

// 'TechIcon' / 'Speech-bubble' / 'tables_row' read as 'tech icon' / 'speech bubble'.
export function words(token: string): string {
  return token
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .trim()
    .toLowerCase();
}

export const withArticle = (phrase: string): string =>
  `${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase}`;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// 'Approval-workflow' -> 'Approval Workflow': a named thing, in Title Case.
const titleWords = (token: string) => words(token).split(' ').map(capitalise).join(' ');

// Help articles are named by their telemetry id, a slug ('api-tokens').
const isArticleSlug = (type: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(type);
