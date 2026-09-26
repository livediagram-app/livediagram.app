import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPUTED, scanEmitters } from './emitter-scan';
import { eventExplanation } from './event-explanation';
import { articleTitle } from './event-vocab';
import { BY_ACTION, EXACT } from './event-explanations';
import * as CATALOGUE from './metric-catalogue';

// Every metric on the dashboard carries a sentence saying what someone did
// (docs/specs/017-telemetry/telemetry.md). These guard that no event the code can send falls through to the
// last resort, and that the copy stays readable to someone who has never seen
// the code.

const REPO = resolve(__dirname, '../../..');
const EMITS = scanEmitters(REPO, ['apps', 'packages'], join(REPO, 'apps', 'telemetry'));
const LAST_RESORT = /^Someone did /;

// Words a reader shouldn't meet: spec numbers, infra and vendor names, code
// vocabulary, and the old "One occurrence of" filler.
const JARGON =
  /spec\/\d|\bClerk\b|api worker|Durable Object|\bD1\b|\bemit|\bmint|One occurrence|localStorage|IndexedDB|—/;
// A camelCase or PascalCase token ("FillColor", "SessionButton") is a code
// name leaking into the copy. Product and brand names are allowed.
const CODE_NAME = /\b(?!JavaScript\b|GitHub\b|PowerPoint\b)[A-Za-z]*[a-z][A-Z][A-Za-z]*\b/;

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
    expect(eventExplanation('Error', 'Client', 'Uncaught.Diagram.TypeError')).toBe(
      'The diagram page hit an unexpected missing or wrong kind of value that nothing in the code caught.',
    );
  });

  it('never renders blank, even off every known path', () => {
    expect(eventExplanation('Token', 'Zoomed', 'SomethingNew').length).toBeGreaterThan(0);
  });
});
