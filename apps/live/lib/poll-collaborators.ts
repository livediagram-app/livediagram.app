// The answer list for a `collaborators` poll (spec/88): the people currently
// in the diagram, frozen into the poll's own options when it starts.
//
// Pure and separate from the poll hook that calls it, because the interesting
// part is not "read the roster" but what has to happen to it first, and that
// is worth testing without a room.
//
// The tally matches answers to options BY STRING (`sanitisePollAnswer` keeps
// only values that appear in `pollOptionTokens`). So two people who happen to
// share a display name — two guests both called "Guest", which is the default
// for anyone who never set one — would collapse into a single token, and a
// vote for either would land on one bar with no way to tell them apart. That
// is a wrong result rather than an ugly one, so repeats are disambiguated
// before the list is frozen.

import { POLL_OPTION_MAX, POLL_OPTIONS_MAX } from '@livediagram/api-schema';

// Just enough of a Participant to build a ballot from. Structural rather than
// the full `Participant`, so the helper can be tested with two-field literals
// and never drifts as presence grows fields.
export type PollCandidate = { id: string; name: string };

// A fallback for anyone with no display name set, so the ballot never shows a
// blank row. Matches the roster's own treatment of an unnamed peer.
const UNNAMED = 'Guest';

/**
 * Build the frozen answer list for a roster poll.
 *
 * - de-duplicates by id first, because the same person appears once per tab
 *   they are present on in `participantsByTab`
 * - falls back to `Guest` for an empty name
 * - suffixes repeated names (`Guest`, `Guest (2)`, `Guest (3)`) so every
 *   option is a distinct token and every vote lands on the person it was cast
 *   for
 * - caps at POLL_OPTIONS_MAX, like any other option list
 *
 * Order is the order given, which is the roster's own (self first, then the
 * room), so the ballot reads the way the collaborators panel does.
 */
export function pollCollaboratorOptions(candidates: readonly PollCandidate[]): string[] {
  const seenIds = new Set<string>();
  // The names actually EMITTED, not the base names seen. Counting bases looks
  // equivalent and isn't: someone who calls themselves "Guest (2)" would be
  // handed the very token generated for the second "Guest", and their two
  // votes would merge — the exact failure the numbering exists to prevent. So
  // each label is checked against what has already gone out, and stepped until
  // it is free.
  const taken = new Set<string>();
  const options: string[] = [];
  for (const candidate of candidates) {
    if (seenIds.has(candidate.id)) continue;
    seenIds.add(candidate.id);
    // Cut to the option cap HERE, suffix included. sanitisePoll trims every
    // option to POLL_OPTION_MAX afterwards, and names run to 120 characters,
    // so two long equal names numbered past the cap were cut back to the same
    // label and their votes merged.
    const base = (candidate.name.trim() || UNNAMED).slice(0, POLL_OPTION_MAX);
    // First one keeps the bare name; the rest are numbered from 2, which reads
    // as "the second Guest" rather than implying the first was "(1)".
    let label = base;
    for (let n = 2; taken.has(label); n++) {
      const suffix = ` (${n})`;
      label = `${base.slice(0, POLL_OPTION_MAX - suffix.length)}${suffix}`;
    }
    taken.add(label);
    options.push(label);
    if (options.length >= POLL_OPTIONS_MAX) break;
  }
  return options;
}
