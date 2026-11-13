// docs/specs/026-plan/automations.md "The rule builder": a refusal reads in words, never the path the api names.
import { describe, expect, it } from 'vitest';
import { refusalWords } from './refusal-words';

describe('refusalWords', () => {
  it('says a code a person can act on in fixed words', () => {
    expect(refusalWords({ code: 'automation_name_taken', path: 'name', message: 'taken' })).toBe(
      'Another rule here has this name. Pick another.',
    );
  });

  it('says the api’s message without the path it leads with, as a sentence', () => {
    expect(
      refusalWords({
        code: 'automation_invalid',
        path: 'steps.3.text',
        message: 'steps.3.text must be text of 1 to 2000 characters',
      }),
    ).toBe('Must be text of 1 to 2000 characters.');
    expect(
      refusalWords({ code: 'automation_invalid', path: 'steps.0', message: 'steps.0 ends a run.' }),
    ).toBe('Ends a run.');
  });

  it('says a pick left empty as what to pick, never a bare "Must name one."', () => {
    const say = (path: string) =>
      refusalWords({ code: 'automation_invalid', path, message: `${path} must name one` });
    expect(say('steps.0.field')).toBe('Pick a field.');
    expect(say('trigger.status')).toBe('Pick a column.');
    expect(say('steps.1.then.0.type')).toBe('Pick a card type.');
    expect(say('trigger.formTab')).toBe('Pick a form.');
    expect(say('steps.2.to.person')).toBe('Pick a person.');
    expect(say('conditions.0.types.1')).toBe('Pick one.');
  });

  it('keeps a message that does not lead with its path, or has nothing after it', () => {
    const say = (path: string | null, message: string) =>
      refusalWords({ code: 'automation_invalid', path, message });
    expect(say('trigger.fields.0', 'Field Changed never hears Votes')).toBe(
      'Field Changed never hears Votes',
    );
    expect(say(null, 'steps.0 must be an object')).toBe('steps.0 must be an object');
    expect(say('steps.0', 'steps.0 ')).toBe('steps.0 ');
  });
});
