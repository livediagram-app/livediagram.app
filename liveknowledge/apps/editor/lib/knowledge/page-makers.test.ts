import { describe, expect, it } from 'vitest';
import { makerPills, makerWords, railStampOf } from './page-makers';

// docs/specs/030-knowledgebase/verification.md "Made by a person or an agent".
const NOW = Date.UTC(2026, 10, 21, 12);
const HOUR = 3_600_000;
const names: Record<string, string> = { u1: 'Priya Shah' };
const nameOf = (id: string | undefined) => (id ? names[id] : undefined);

describe('who made and edited a page, in words', () => {
  it('names a person, by name where it is known', () => {
    const made = makerWords(
      { by: 'u1', at: Date.UTC(2026, 10, 12), kind: 'human' },
      'created',
      nameOf,
      NOW,
    );
    expect(made).toEqual({
      kind: 'human',
      label: 'Human Generated',
      description: 'Created by Priya Shah on 12 Nov',
    });
    expect(
      makerWords({ by: 'gone', at: NOW - 3 * HOUR, kind: 'human' }, 'updated', nameOf, NOW),
    ).toEqual({
      kind: 'human',
      label: 'Human Edited',
      description: 'Last edited by a person, 3 hours ago',
    });
  });

  it('names an agent and the door it came through, or says an agent', () => {
    expect(
      makerWords(
        { by: 'u1', at: Date.UTC(2026, 10, 12), kind: 'ai', agent: 'Claude', via: 'mcp' },
        'created',
        nameOf,
        NOW,
      ).description,
    ).toBe('Created by Claude for Priya Shah through MCP on 12 Nov');
    expect(
      makerWords({ by: 'u1', at: NOW, kind: 'ai', via: 'cli' }, 'created', nameOf, NOW).description,
    ).toMatch(/^Created by an agent for Priya Shah through the CLI on /);
    const edited = makerWords(
      { by: 'u1', at: NOW - HOUR, kind: 'ai', via: 'api' },
      'updated',
      nameOf,
      NOW,
    );
    expect(edited.label).toBe('AI Edited');
    expect(edited.description).toBe(
      'Last edited by an agent for Priya Shah through the API, 1 hour ago',
    );
    // A person nobody here can name: the agent alone.
    expect(
      makerWords(
        { by: 'gone', at: NOW, kind: 'ai', agent: 'Claude', via: 'mcp' },
        'updated',
        nameOf,
        NOW,
      ).description,
    ).toBe('Last edited by Claude through MCP, just now');
  });

  it('says an accepted suggestion is the agent’s, and who accepted it', () => {
    expect(
      makerWords(
        { by: 'u1', at: NOW - 2 * HOUR, kind: 'ai', agent: 'Claude', via: 'suggestion' },
        'updated',
        nameOf,
        NOW,
      ).description,
    ).toBe('Last edited by Claude, from a suggestion Priya Shah accepted, 2 hours ago');
    expect(
      makerWords(
        { by: 'x', at: Date.UTC(2025, 0, 3), kind: 'ai', via: 'suggestion' },
        'created',
        nameOf,
        NOW,
      ).description,
    ).toBe('Created by an agent, from a suggestion an Editor accepted on 3 Jan 2025');
  });
});

// Page Health's foot (verification.md "An agent acting for a person").
describe('railStampOf', () => {
  it("carries the person's colour where Page Health's read brought it", () => {
    const stamp = { by: 'u1', at: 5, kind: 'human' as const };
    expect(railStampOf(stamp, nameOf, { u1: '#ec4899' })).toEqual({
      at: 5,
      by: 'Priya Shah',
      color: '#ec4899',
    });
    expect(railStampOf(stamp, nameOf, { u2: '#ec4899' })).toEqual({ at: 5, by: 'Priya Shah' });
  });

  it('names the person, and an agent with the agent that wrote for them', () => {
    expect(railStampOf(undefined, nameOf)).toBeUndefined();
    expect(railStampOf({ by: 'u1', at: 5, kind: 'human' }, nameOf)).toEqual({
      at: 5,
      by: 'Priya Shah',
    });
    expect(
      railStampOf({ by: 'u1', at: 5, kind: 'ai', agent: 'Claude', via: 'mcp' }, nameOf),
    ).toEqual({
      at: 5,
      by: 'Priya Shah',
      agent: { name: 'Claude', accepted: false },
    });
    expect(railStampOf({ by: 'u1', at: 5, kind: 'ai', via: 'suggestion' }, nameOf)).toEqual({
      at: 5,
      by: 'Priya Shah',
      agent: { accepted: true },
    });
    // A rule's step writes as its author, a person.
    expect(
      railStampOf(
        { by: 'u1', at: 5, kind: 'human', agent: 'Nightly in Ops', via: 'automation' },
        nameOf,
      ),
    ).toEqual({ at: 5, by: 'Priya Shah' });
  });
});

describe('makerPills', () => {
  const nameOf = (id: string | undefined) => (id === 'u1' ? 'Priya Shah' : undefined);
  const NOW_ = Date.UTC(2026, 10, 21);
  it('says one pill when the same kind made and last changed the page, else one each', () => {
    const human = { by: 'u1', at: NOW_ - 60_000, kind: 'human' as const };
    const both = makerPills({ created: human, updated: human }, nameOf, NOW_);
    expect(both.map((p) => [p.key, p.label])).toEqual([['both', 'Human Authored']]);
    expect(both[0]!.description).toMatch(/^Created by Priya Shah .*\. Last edited by Priya Shah/);
    const ai = { by: 'u1', at: NOW_, kind: 'ai' as const, agent: 'Claude' };
    expect(makerPills({ created: human, updated: ai }, nameOf, NOW_).map((p) => p.label)).toEqual([
      'Human Generated',
      'AI Edited',
    ]);
    expect(makerPills({}, nameOf, NOW_)).toEqual([]);
  });
});

describe('a page a rule in another app wrote', () => {
  const stamp = {
    by: 'u1',
    at: Date.UTC(2026, 10, 12),
    kind: 'human' as const,
    agent: 'Release Note in Launch',
    via: 'automation' as const,
  };

  it('names the rule and the item it came from, as the banner does, writing as its author', () => {
    expect(makerWords(stamp, 'created', nameOf, NOW)).toEqual({
      kind: 'human',
      label: 'Written by a Rule',
      description: 'Written by the rule Release Note in Launch as Priya Shah on 12 Nov',
    });
    expect(
      makerWords(
        { ...stamp, by: 'gone', agent: undefined, at: NOW - HOUR },
        'updated',
        nameOf,
        NOW,
      ),
    ).toMatchObject({
      label: 'Edited by a Rule',
      description: expect.stringMatching(/^Last edited by a rule in another app, /),
    });
  });

  it('keeps its own pill beside a person’s edit, and two of its own apart too', () => {
    const person = { by: 'u1', at: NOW, kind: 'human' as const };
    expect(
      makerPills({ created: stamp, updated: person }, nameOf, NOW).map((p) => p.label),
    ).toEqual(['Written by a Rule', 'Human Edited']);
    expect(makerPills({ created: stamp, updated: stamp }, nameOf, NOW)).toHaveLength(2);
  });
});
