// Building a `collaborators` poll's ballot from the room (docs/specs/012-collaboration/live-poll.md).
//
// The stakes are higher than they look: the tally matches answers to options
// by STRING, so anything that lets two people share a token silently merges
// their votes into one bar. These cases are mostly about that.

import { describe, expect, it } from 'vitest';
import { POLL_OPTION_MAX, POLL_OPTIONS_MAX, sanitisePoll } from '@livediagram/api-schema';
import { pollCollaboratorOptions } from './poll-collaborators';

const person = (id: string, name: string) => ({ id, name });

describe('pollCollaboratorOptions', () => {
  it('lists the room in the order given', () => {
    expect(
      pollCollaboratorOptions([person('1', 'Ariel'), person('2', 'Ehsan'), person('3', 'Jatin')]),
    ).toEqual(['Ariel', 'Ehsan', 'Jatin']);
  });

  it('de-duplicates the same person appearing on several tabs', () => {
    // participantsByTab lists someone once per tab they are present on, so the
    // raw concatenation repeats them.
    expect(
      pollCollaboratorOptions([person('1', 'Ariel'), person('1', 'Ariel'), person('2', 'Pete')]),
    ).toEqual(['Ariel', 'Pete']);
  });

  it('numbers people who share a display name, so their votes cannot merge', () => {
    // The default name for anyone who never set one, so a room of three fresh
    // guests is the ordinary case, not a contrived one.
    expect(
      pollCollaboratorOptions([person('1', 'Guest'), person('2', 'Guest'), person('3', 'Guest')]),
    ).toEqual(['Guest', 'Guest (2)', 'Guest (3)']);
  });

  it('numbers from 2, leaving the first name bare', () => {
    expect(pollCollaboratorOptions([person('1', 'Sam'), person('2', 'Sam')])).toEqual([
      'Sam',
      'Sam (2)',
    ]);
  });

  it('falls back to Guest for a blank or whitespace name', () => {
    expect(pollCollaboratorOptions([person('1', ''), person('2', '   ')])).toEqual([
      'Guest',
      'Guest (2)',
    ]);
  });

  it('trims names, so padding cannot create a second token for one name', () => {
    expect(pollCollaboratorOptions([person('1', 'Tessa'), person('2', ' Tessa ')])).toEqual([
      'Tessa',
      'Tessa (2)',
    ]);
  });

  it('caps at POLL_OPTIONS_MAX', () => {
    const many = Array.from({ length: POLL_OPTIONS_MAX + 5 }, (_, i) => person(`${i}`, `P${i}`));
    const options = pollCollaboratorOptions(many);
    expect(options).toHaveLength(POLL_OPTIONS_MAX);
    // The cap keeps the FIRST people, so the preview the facilitator sees is
    // the prefix of the roster they are looking at.
    expect(options[0]).toBe('P0');
  });

  it('returns every distinct token, so no two options collide', () => {
    const options = pollCollaboratorOptions([
      person('1', 'Guest'),
      person('2', 'Guest'),
      person('3', 'Guest (2)'),
    ]);
    expect(new Set(options).size).toBe(options.length);
  });

  it('is empty for an empty room', () => {
    expect(pollCollaboratorOptions([])).toEqual([]);
  });
});

describe('pollCollaboratorOptions with names past the option cap', () => {
  it('keeps two long equal names apart after the ballot is trimmed', () => {
    // Names run to 120 characters but an option to POLL_OPTION_MAX, so the
    // numbering has to fit inside the cap or the trim cuts it back off.
    const long = 'x'.repeat(100);
    const options = pollCollaboratorOptions([person('a', long), person('b', long)]);
    expect(options.every((o) => o.length <= POLL_OPTION_MAX)).toBe(true);
    const clean = sanitisePoll({
      id: 'p',
      question: 'Who?',
      style: 'collaborators',
      options,
      startedAt: 0,
    });
    expect(clean?.options).toHaveLength(2);
    expect(clean?.options[1]).toMatch(/ \(2\)$/);
  });
});
