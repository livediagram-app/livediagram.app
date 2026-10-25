import { describe, expect, it } from 'vitest';
import { afterWord, parseSequenceDiagram } from './mermaid-sequence';

// Lines are read by prefixes and indexOf, so a long run of spaces costs its length (CodeQL "polynomial regular
// expression"): each worst case CodeQL named finishes well inside a budget.
const SPACES = ' '.repeat(100_000);
const BUDGET_MS = 250;

const timed = (run: () => void): number => {
  const started = performance.now();
  run();
  return performance.now() - started;
};

describe('reading Mermaid in linear time', () => {
  it('reads a title, a participant and a note as before', () => {
    expect(afterWord('title: Login', 'title', ':')).toBe('Login');
    expect(afterWord('title Login', 'title')).toBe('Login');
    expect(afterWord('titles', 'title')).toBeNull();
    expect(afterWord('title', 'title')).toBeNull();
    const d = parseSequenceDiagram(
      'sequenceDiagram\ntitle Sign in\nactor U as User\nparticipant API\nnote over U,API: hello\nU->>API: go',
    );
    expect(d.ok && d.diagram.title).toBe('Sign in');
    expect(JSON.stringify(d)).toContain('User');
    expect(JSON.stringify(d)).toContain('hello');
  });

  it('survives each worst case within budget', () => {
    const cases = [
      `sequenceDiagram\ntitle:${SPACES}x`,
      `sequenceDiagram\ntitle\t${SPACES}`,
      `sequenceDiagram\nactor ! as ${SPACES}`,
      `sequenceDiagram\nnote over ${SPACES}`,
      `sequenceDiagram\nnote over 9:${SPACES}`,
      `---\ntitle:${SPACES}x\n---\nsequenceDiagram\nA->>B: go`,
    ];
    for (const text of cases) {
      expect(
        timed(() => parseSequenceDiagram(text)),
        text.slice(0, 30),
      ).toBeLessThan(BUDGET_MS);
    }
  });
});
