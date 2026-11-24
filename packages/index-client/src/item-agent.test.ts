import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { ITEM_AGENT_NAME_MAX } from './constants';
import { cleanItemAgentName, isItemAgentVia, parseItemAgent } from './item-agent';

// one-explorer-contracts.md "The event log" (Work Tracker 1381): an agent writing for its person.
describe('cleanItemAgentName', () => {
  it('drops control characters, makes runs of space one, trims and cuts', () => {
    expect(cleanItemAgentName('  Claude\u0000\u001f Code\u009f ')).toBe('Claude Code');
    expect(cleanItemAgentName('a\n\tb')).toBe('a b');
    expect(cleanItemAgentName('x'.repeat(200))).toHaveLength(ITEM_AGENT_NAME_MAX);
    // A cut never leaves a trailing space.
    expect(cleanItemAgentName(`${'x'.repeat(ITEM_AGENT_NAME_MAX - 1)} y`)).toBe(
      'x'.repeat(ITEM_AGENT_NAME_MAX - 1),
    );
  });

  it('is null for nothing left, and for anything but text', () => {
    expect(cleanItemAgentName('  \u0007 ')).toBeNull();
    expect(cleanItemAgentName(null)).toBeNull();
    expect(cleanItemAgentName(undefined)).toBeNull();
    expect(cleanItemAgentName(7 as unknown as string)).toBeNull();
  });

  it('stays linear on a long worst case', () => {
    const worst = ' \u0001'.repeat(50_000);
    expect(cpuMsOf(() => cleanItemAgentName(worst))).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('parseItemAgent', () => {
  it('reads an agent, and nothing as a person', () => {
    expect(parseItemAgent({ name: ' Claude ', via: 'mcp' })).toEqual({
      name: 'Claude',
      via: 'mcp',
    });
    expect(parseItemAgent(undefined)).toBeNull();
    expect(parseItemAgent(null)).toBeNull();
  });

  it('refuses anything else', () => {
    for (const value of [
      'Claude',
      [],
      { name: 'Claude' },
      { name: 'Claude', via: 'email' },
      { name: ' ', via: 'cli' },
      { name: 3, via: 'api' },
    ])
      expect(parseItemAgent(value)).toBeUndefined();
  });

  it('knows the doors', () => {
    expect(['mcp', 'cli', 'api', 'editor'].map(isItemAgentVia)).toEqual([true, true, true, false]);
  });
});
