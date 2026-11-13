import { describe, expect, it } from 'vitest';
import {
  isValidTelemetryEvent,
  TELEMETRY_ACTIONS,
  TELEMETRY_CATEGORIES,
} from '@livehuddle/api-schema';
import { REPO, SCAN_ROOTS, SKIP } from './scan-roots';
import { COMPUTED, scanEmitters } from '../emitter-scan';
import { platformEmitters, sharedClientEmitters, sharedSiteEmitters } from '../platform-emitters';
import { articleTitle } from '../_shared/event-vocab';
import { BY_ACTION, EXACT } from './event-explanations';
import * as CATALOGUE from './metric-catalogue';
import { LIVEHUDDLE as APP } from './config';
import { isInheritedEvent, isRetiredEvent, KEPT_AS_HISTORY } from './retired-events';
import { COMPUTED_EMITTERS } from './computed-emitters';

const eventExplanation = APP.explain;

// Every metric on the dashboard carries a sentence saying what someone did
// (docs/specs/017-telemetry/telemetry.md). These guard that no event the code can send falls through to the
// last resort, and that the copy stays readable to someone who has never seen
// the code.

const EMITS = [
  ...scanEmitters(REPO, SCAN_ROOTS, SKIP),
  ...sharedClientEmitters({ root: REPO, roots: SCAN_ROOTS, skip: SKIP }),
  // Every app's help-centre views, votes and searches, sent by the shared help site.
  ...sharedSiteEmitters(),
];
const LAST_RESORT = /^Someone did /;

// Words a reader shouldn't meet: spec numbers, infra and vendor names, code
// vocabulary, and the old "One occurrence of" filler.
const JARGON =
  /spec\/\d|\bClerk\b|api worker|Durable Object|\bD1\b|\bemit|\bmint|One occurrence|localStorage|IndexedDB|—/;
// A camelCase or PascalCase token ("FillColor", "SessionButton") is a code
// name leaking into the copy. Product and brand names are allowed.
const CODE_NAME =
  /\b(?!JavaScript\b|GitHub\b|PowerPoint\b|iPhone\b|iPad\b)[A-Za-z]*[a-z][A-Z][A-Za-z]*\b/;

const sentences = (): [string, string][] =>
  [...Object.entries(EXACT), ...Object.entries(BY_ACTION)] as [string, string][];

describe('eventExplanation', () => {
  it('gives every event the code can send a real sentence', () => {
    const missing = new Set<string>();
    for (const e of EMITS) {
      if (typeof e.category !== 'string' || typeof e.action !== 'string') continue;
      const type = e.type === COMPUTED ? 'SomeFutureType' : e.type;
      const out = eventExplanation(e.category, e.action, type);
      if (LAST_RESORT.test(out))
        missing.add(
          `${e.category}|${e.action}|${e.type === COMPUTED ? '*' : (e.type ?? '')}  (${e.path})`,
        );
    }
    expect([...missing]).toEqual([]);
  });

  // livehuddle forked livediagram's sentences (Work Tracker #586): one for an event its vocabulary would refuse at
  // ingest (Layer, Plan, Sheet and Form events, Drive's mirror, votes) can never be read, so none is kept.
  it('explains only events the vocabulary accepts', () => {
    const categories: readonly string[] = TELEMETRY_CATEGORIES;
    const actions: readonly string[] = TELEMETRY_ACTIONS;
    const refused = Object.keys(EXACT).filter((key) => {
      const [category = '', action = '', type = ''] = key.split('|');
      return !isValidTelemetryEvent({ category, action, type: type || null });
    });
    const refusedActions = Object.keys(BY_ACTION).filter((key) => {
      const [category = '', action = ''] = key.split('|');
      return !categories.includes(category) || !actions.includes(action);
    });
    expect([...refused, ...refusedActions]).toEqual([]);
  });

  it('keeps no sentence for what livehuddle inherited from livediagram and never had', () => {
    const inherited = Object.keys(EXACT).filter((key) => {
      const [category = '', action = '', type = ''] = key.split('|');
      return isInheritedEvent(category, action, type || null);
    });
    expect(inherited).toEqual([]);
  });

  // Work Tracker #602: about 350 sentences described events the vocabulary accepts but livehuddle's code no longer
  // sends (Draw mode, the home page, tables, the diagram element tours). Each is retired by name in retired-events.ts
  // (its sentence kept as history, the dashboard dropping the event), so every sentence on the dashboard is for an
  // event livehuddle sends or a named retirement.
  it('explains only events livehuddle sends or has retired', { timeout: 30_000 }, () => {
    const sent = new Set<string>();
    // A computed site whose values are samples (an article slug, a page path, a Settings category) can send keys no
    // list names, so its category and action are not held to the exact keys.
    const open = new Set<string>();
    // Plus what liveworkspace's own Workers send in this app's name (emails, the Community, the Explorer's rows).
    const everything = [...EMITS, ...platformEmitters(isValidTelemetryEvent, 'Document')];
    for (const e of everything) {
      if (typeof e.category !== 'string' || typeof e.action !== 'string') continue;
      if (e.type !== COMPUTED) {
        sent.add(`${e.category}|${e.action}|${e.type ?? ''}`);
        continue;
      }
      const site = COMPUTED_EMITTERS[`${e.path} ${e.category}·${e.action}`];
      if (site?.open) open.add(`${e.category}|${e.action}`);
      for (const type of site?.values ?? []) sent.add(`${e.category}|${e.action}|${type ?? ''}`);
    }
    const stale = Object.keys(EXACT).filter((key) => {
      const [category = '', action = '', type = ''] = key.split('|');
      return (
        !sent.has(key) &&
        !open.has(`${category}|${action}`) &&
        !KEPT_AS_HISTORY.has(key) &&
        !isRetiredEvent(category, action, type || null)
      );
    });
    expect(stale).toEqual([]);
  });

  it('keeps a history sentence only for an event that is no longer sent', () => {
    for (const key of KEPT_AS_HISTORY) {
      expect(key in EXACT, key).toBe(true);
      expect(isRetiredEvent(...(key.split('|') as [string, string, string]))).toBe(false);
    }
  });

  it('keeps the Portal tour, the one element tour livehuddle has, and retires the diagram ones', () => {
    expect(isRetiredEvent('UI', 'Started', 'PortalTour')).toBe(false);
    expect(isRetiredEvent('UI', 'View', 'PortalTourStepOutro')).toBe(false);
    expect(isRetiredEvent('UI', 'Started', 'SequenceTour')).toBe(true);
    expect(isRetiredEvent('UI', 'View', 'DiagramKeyTourStepKey')).toBe(true);
    expect(isRetiredEvent('UI', 'Opened', 'SankeyTourOffer')).toBe(true);
    expect(isRetiredEvent('UI', 'Toggled', 'ElementToursSeenOn')).toBe(true);
  });

  it('keeps the copy free of jargon and code names', () => {
    const bad = sentences().filter(([, s]) => JARGON.test(s) || CODE_NAME.test(s));
    expect(bad).toEqual([]);
  });

  it('has a sentence for any future type of every action it describes', () => {
    // A new type, or a computed one no list names, still reads properly.
    const actions = new Set(Object.keys(EXACT).map((k) => k.split('|').slice(0, 2).join('|')));
    expect([...actions].filter((a) => !(a in BY_ACTION))).toEqual([]);
  });

  it('keeps every card and stack blurb free of jargon too', () => {
    // A curated card's blurb replaces the event's sentence, so it answers to
    // the same rules.
    const blurbs: [string, string][] = [];
    const seen = new Set<unknown>();
    const visit = (x: unknown) => {
      if (!x || typeof x !== 'object' || seen.has(x)) return;
      seen.add(x);
      const item = x as { title?: unknown; blurb?: unknown };
      if (typeof item.title === 'string' && typeof item.blurb === 'string')
        blurbs.push([item.title, item.blurb]);
      Object.values(x).forEach(visit);
    };
    Object.values(CATALOGUE).forEach(visit);
    expect(blurbs.length).toBeGreaterThan(100);
    expect(blurbs.filter(([, b]) => JARGON.test(b) || CODE_NAME.test(b))).toEqual([]);
  });

  it('writes whole sentences', () => {
    const bad = sentences().filter(([, s]) => !/^[A-Z"]/.test(s) || !/[.!?"]$/.test(s));
    expect(bad).toEqual([]);
  });

  it('prefers an exact sentence, then a pattern, then one for the action', () => {
    expect(eventExplanation('Element', 'Changed', 'SessionButton')).toBe(
      EXACT['Element|Changed|SessionButton'],
    );
    expect(eventExplanation('Element', 'Added', 'Annotation')).toBe(
      'Someone added an annotation to the canvas.',
    );
    expect(eventExplanation('Element', 'Changed', 'SomeFutureControl')).toBe(
      BY_ACTION['Element|Changed'],
    );
  });

  it('names the Explorer sidebar row someone picked', () => {
    expect(eventExplanation('UI', 'Selected', 'Sidebar.Inbox')).toBe(
      "Someone picked the inbox row in the Explorer's sidebar.",
    );
    expect(eventExplanation('UI', 'Selected', 'Sidebar.Timeline')).toBe(
      "Someone picked the timeline row in the Explorer's sidebar.",
    );
    expect(eventExplanation('UI', 'Selected', 'Sidebar.Activity')).toBe(
      EXACT['UI|Selected|Sidebar.Activity'],
    );
    expect(EXACT['UI|Selected|Sidebar.Activity']).toMatch(/renamed Inbox. No longer recorded/);
    expect(eventExplanation('UI', 'Selected', 'Sidebar.SharedWithMe')).toBe(
      "Someone picked the shared with me row in the Explorer's sidebar.",
    );
    expect(eventExplanation('UI', 'Selected', 'ExplorerPanel.MyDocuments')).toBe(
      "Someone picked the my documents row in the editor's Explorer panel.",
    );
    expect(eventExplanation('UI', 'Selected', 'SignInBannerExplorer')).toBe(
      EXACT['UI|Selected|SignInBannerExplorer'],
    );
  });

  it('names help articles by their title', () => {
    expect(articleTitle('api-tokens')).toBe('API Tokens');
    expect(articleTitle('your-first-diagram')).toBe('Your First Diagram');
    expect(eventExplanation('Help', 'View', 'what-it-is')).toBe(
      'Someone read the "What It Is" help article.',
    );
  });

  it('reads an api error code as what was being tried and why it failed', () => {
    expect(eventExplanation('Error', 'Api', 'Http403.SaveTab')).toBe(
      "Saving a tab's contents was refused because the visitor didn't have permission.",
    );
    expect(eventExplanation('Error', 'Api', 'Http500.SomethingNew')).toBe(
      'Something new failed with an error on the server.',
    );
  });

  it('ignores the worker error token after the operation', () => {
    expect(eventExplanation('Error', 'Api', 'Http401.SaveTab.SignInRequired')).toBe(
      eventExplanation('Error', 'Api', 'Http401.SaveTab'),
    );
  });

  it('reads the save failures that never got a status', () => {
    expect(eventExplanation('Error', 'Api', 'Auth.NoSessionToken')).toBe(
      "A signed-in visitor's request was held back because no sign-in token was available to send with it.",
    );
    expect(eventExplanation('Error', 'Api', 'SaveFailed.TypeError')).toBe(
      'Saving changes failed with an unexpected missing or wrong kind of value before any request was answered.',
    );
  });

  it('reads a client error code as where it broke', () => {
    expect(eventExplanation('Error', 'Client', 'Uncaught.Document.TypeError')).toBe(
      'The document page hit an unexpected missing or wrong kind of value that nothing in the code caught.',
    );
  });

  it('never renders blank, even off every known path', () => {
    expect(eventExplanation('Token', 'Zoomed', 'SomethingNew').length).toBeGreaterThan(0);
  });
});
