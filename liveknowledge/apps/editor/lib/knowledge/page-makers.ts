// Who made a page and who changed it last, a person or an agent (docs/specs/030-knowledgebase/verification.md "Made
// by a person or an agent"): the words of the meta row's two pills and their hover cards. Pure.
import type { PageAuthorStamp } from '@liveknowledge/api-schema';
import { relativeSince } from '@/lib/relative-time';
import { shortDate } from './page-trust';

export type MakerWhich = 'created' | 'updated';

export type MakerWords = {
  kind: 'human' | 'ai';
  /** The pill: "AI Generated", "Human Edited". */
  label: string;
  /** The hover card's line: "Created by Claude through MCP on 12 Nov". */
  description: string;
};

const DOOR: Record<string, string> = { mcp: 'MCP', cli: 'the CLI', api: 'the API' };

/** The pill and hover card of one stamp: `which` is the page's making or its last change. */
export function makerWords(
  stamp: PageAuthorStamp,
  which: MakerWhich,
  nameOf: (id: string | undefined) => string | undefined,
  now: number,
): MakerWords {
  const ai = stamp.kind === 'ai';
  const label = `${ai ? 'AI' : 'Human'} ${which === 'created' ? 'Generated' : 'Edited'}`;
  const person = nameOf(stamp.by);
  const writer = ai ? (stamp.agent ?? 'an agent') : (person ?? 'a person');
  const door = ai && stamp.via && stamp.via !== 'suggestion' ? ` through ${DOOR[stamp.via]}` : '';
  const accepted =
    ai && stamp.via === 'suggestion' ? `, from a suggestion ${person ?? 'an Editor'} accepted` : '';
  const description =
    which === 'created'
      ? `Created by ${writer}${door}${accepted} on ${shortDate(stamp.at, now)}`
      : `Last edited by ${writer}${door}${accepted}, ${relativeSince(stamp.at, now)}`;
  return { kind: ai ? 'ai' : 'human', label, description };
}
