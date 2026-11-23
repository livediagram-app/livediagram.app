// What Connect says of access (docs/specs/030-knowledgebase/mcp-connect.md "The view" 3 and 4): the three things a
// connection may do here and whether this person's connection gets each, by their role, and the first prompt.
// Pure. The rule is the api's (docs/specs/024-agents/knowledgebase-for-agents.md "Share roles"): a Viewer's
// connection never suggests, and only an Editor's can be allowed to write.
import type { AskRights } from '@/lib/knowledge-ask/ask-rights';

export type ConnectRole = 'editor' | 'participant' | 'viewer';

export function connectRole(rights: Pick<AskRights, 'grantAgents' | 'makePages'>): ConnectRole {
  if (rights.grantAgents) return 'editor';
  return rights.makePages ? 'participant' : 'viewer';
}

export type AccessKey = 'read' | 'suggest' | 'write';

export type AccessRow = {
  key: AccessKey;
  title: string;
  about: string;
  /** Whether this person's connection gets it, in a few words, and whether that is a yes. */
  yours: string;
  granted: boolean;
};

export function accessRows(role: ConnectRole): readonly AccessRow[] {
  return [
    {
      key: 'read',
      title: 'Reads',
      about: 'Searches and reads every page, with how far each can be trusted.',
      yours: 'Yes',
      granted: true,
    },
    {
      key: 'suggest',
      title: 'Suggests Edits',
      about:
        'Proposes changes for a person to accept, starts pages, asks for approval and comments.',
      yours: role === 'viewer' ? 'Not for a Viewer' : 'Yes, unless Read-Only',
      granted: role !== 'viewer',
    },
    {
      key: 'write',
      title: 'Writes',
      about:
        'Replaces a page’s writing and moves pages directly. Never on a page that is Verified or Review Due.',
      yours: role === 'editor' ? 'Once You Allow It' : 'Only an Editor’s',
      granted: false,
    },
  ];
}

/** The line under the rows on writing: how an Editor allows it, or who can. */
export function writingLine(role: ConnectRole): string {
  return role === 'editor'
    ? 'To let it write, choose Allow Writing on its card in Insights once it connects. That applies to this knowledgebase only, and you can stop it there at any time.'
    : 'Only an Editor’s connection can be allowed to write, by that Editor, from its card in Insights.';
}

/** The connection acts for the person, across everything they can open: so the knowledgebase is named. */
export const reachLine = (name: string): string =>
  `The connection acts for you and reaches every knowledgebase you can open, so name this one, “${name}”, when you ask.`;

/** The first prompt to try, naming this knowledgebase so the app reads here. */
export const firstPrompt = (name: string): string =>
  `Search my liveknowledge knowledgebase "${name}" and tell me in five lines what it covers. Name the pages you read.`;
