import { describe, expect, it } from 'vitest';
import { accessRows, connectRole, firstPrompt, reachLine, writingLine } from './connect-words';

// docs/specs/030-knowledgebase/mcp-connect.md "The view" 3, knowledgebase-for-agents.md "Share roles".
describe('what a connection may do here', () => {
  it('follows the role', () => {
    expect(connectRole({ grantAgents: true, makePages: true })).toBe('editor');
    expect(connectRole({ grantAgents: false, makePages: true })).toBe('participant');
    expect(connectRole({ grantAgents: false, makePages: false })).toBe('viewer');
  });

  it('reads for everyone, suggests for a writer, writes only for an Editor who allows it', () => {
    const yours = (role: Parameters<typeof accessRows>[0]) =>
      accessRows(role).map((row) => [row.title, row.yours, row.granted]);
    expect(yours('editor')).toEqual([
      ['Reads', 'Yes', true],
      ['Suggests Edits', 'Yes, unless Read-Only', true],
      ['Writes', 'Once You Allow It', false],
    ]);
    expect(yours('participant')[2]).toEqual(['Writes', 'Only an Editor’s', false]);
    expect(yours('viewer')[1]).toEqual(['Suggests Edits', 'Not for a Viewer', false]);
    expect(accessRows('viewer')[2]!.about).toContain(
      'Never on a page that is Verified or Review Due',
    );
  });

  it('says how writing is allowed, to an Editor, and who can, to anyone else', () => {
    expect(writingLine('editor')).toContain('choose Allow Writing on its card in Insights');
    expect(writingLine('viewer')).toContain('Only an Editor’s connection');
  });

  it('names the knowledgebase in the prompt and the reach line', () => {
    expect(firstPrompt('Handbook')).toBe(
      'Search my liveknowledge knowledgebase "Handbook" and tell me in five lines what it covers. Name the pages you read.',
    );
    expect(reachLine('Handbook')).toContain('“Handbook”');
  });
});
