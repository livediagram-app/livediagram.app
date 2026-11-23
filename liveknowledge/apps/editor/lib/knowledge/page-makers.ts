// Who made a page and who changed it last, a person or an agent (docs/specs/030-knowledgebase/verification.md "Made
// by a person or an agent"): the words of the meta row's two pills and their hover cards. Pure.
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { agentForPerson } from '@liveworkspace/workbench/components/ai-writer/agent-for-person';
import { relativeSince } from '@/lib/relative-time';
import { shortDate } from './page-trust';

export type MakerWhich = 'created' | 'updated';

/** Who did something to the page, and when, as Page Health's foot draws it. `by` is a name the editor could resolve;
 *  `agent` the agent that wrote for them, `accepted` when they accepted its suggestion (verification.md "An agent
 *  acting for a person"). */
export type PageStamp = {
  at: number;
  by?: string | undefined;
  /** The person's colour, their avatar's and Version History's dot, where Page Health's read brought it. */
  color?: string | undefined;
  agent?: { name?: string | undefined; accepted?: boolean } | undefined;
};

/** A created or updated stamp for Page Health's foot: its person named where the editor can, an agent's with the
 *  agent that wrote. A rule's step writes as its author, a person. */
export const railStampOf = (
  stamp: PageAuthorStamp | undefined,
  nameOf: (id: string | undefined) => string | undefined,
  colors: Readonly<Record<string, string>> = {},
): PageStamp | undefined =>
  stamp
    ? {
        at: stamp.at,
        by: nameOf(stamp.by),
        ...(colors[stamp.by] ? { color: colors[stamp.by] } : {}),
        ...(stamp.kind === 'ai'
          ? {
              agent: {
                ...(stamp.agent ? { name: stamp.agent } : {}),
                accepted: stamp.via === 'suggestion',
              },
            }
          : {}),
      }
    : undefined;

export type MakerWords = {
  kind: 'human' | 'ai';
  /** The pill: "AI Generated", "Human Edited". */
  label: string;
  /** The hover card's line: "Created by Claude through MCP on 12 Nov". */
  description: string;
};

const DOOR: Record<string, string> = { mcp: 'MCP', cli: 'the CLI', api: 'the API' };

/** A rule's step's writer, as the page's banner and its pills both say it: "the rule Release Note in Launch". */
export const automationRuleWords = (stamp: Pick<PageAuthorStamp, 'agent'>): string =>
  stamp.agent ? `the rule ${stamp.agent}` : 'a rule in another app';

/** The pill and hover card of one stamp: `which` is the page's making or its last change. */
export function makerWords(
  stamp: PageAuthorStamp,
  which: MakerWhich,
  nameOf: (id: string | undefined) => string | undefined,
  now: number,
): MakerWords {
  // A rule's step from another app: the rule, named with the item it came from, as the banner names it
  // (AutomationWrittenBanner.tsx), writing as its author.
  if (stamp.via === 'automation') {
    const rule = automationRuleWords(stamp);
    const author = nameOf(stamp.by);
    const as = author ? ` as ${author}` : '';
    return {
      kind: 'human',
      label: which === 'created' ? 'Written by a Rule' : 'Edited by a Rule',
      description:
        which === 'created'
          ? `Written by ${rule}${as} on ${shortDate(stamp.at, now)}`
          : `Last edited by ${rule}${as}, ${relativeSince(stamp.at, now)}`,
    };
  }
  const ai = stamp.kind === 'ai';
  const label = `${ai ? 'AI' : 'Human'} ${which === 'created' ? 'Generated' : 'Edited'}`;
  const person = nameOf(stamp.by);
  // An agent names the person it wrote for (verification.md "An agent acting for a person"); an accepted suggestion's
  // person is the Editor who accepted, said after it.
  const writer = ai
    ? stamp.via === 'suggestion'
      ? (stamp.agent ?? 'an agent')
      : agentForPerson(stamp.agent, person, 'an agent')
    : (person ?? 'a person');
  const door = ai && stamp.via && stamp.via !== 'suggestion' ? ` through ${DOOR[stamp.via]}` : '';
  const accepted =
    ai && stamp.via === 'suggestion' ? `, from a suggestion ${person ?? 'an Editor'} accepted` : '';
  const description =
    which === 'created'
      ? `Created by ${writer}${door}${accepted} on ${shortDate(stamp.at, now)}`
      : `Last edited by ${writer}${door}${accepted}, ${relativeSince(stamp.at, now)}`;
  return { kind: ai ? 'ai' : 'human', label, description };
}

/** The meta row's pills: one per stamp, or one for both when the same kind of writer made and last changed the page
 *  ("Human Authored", "AI Authored"; owner 2026-11-21: "if both human created and human edited, just use one badge"),
 *  its hover card saying both. */
export function makerPills(
  makers: { created?: PageAuthorStamp; updated?: PageAuthorStamp },
  nameOf: (id: string | undefined) => string | undefined,
  now: number,
): (MakerWords & { key: string })[] {
  const created = makers.created ? makerWords(makers.created, 'created', nameOf, now) : null;
  const updated = makers.updated ? makerWords(makers.updated, 'updated', nameOf, now) : null;
  const automated = (stamp?: PageAuthorStamp) => stamp?.via === 'automation';
  if (
    created &&
    updated &&
    created.kind === updated.kind &&
    automated(makers.created) === automated(makers.updated) &&
    !automated(makers.created)
  )
    return [
      {
        key: 'both',
        kind: created.kind,
        label: `${created.kind === 'ai' ? 'AI' : 'Human'} Authored`,
        description: `${created.description}. ${updated.description}.`,
      },
    ];
  return [
    ...(created ? [{ key: 'created', ...created }] : []),
    ...(updated ? [{ key: 'updated', ...updated }] : []),
  ];
}
