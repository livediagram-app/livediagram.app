import { describe, expect, it } from 'vitest';
import { oneLine } from './one-line';

// A name someone else chose stays on its one output line (docs/specs/015-api/blueprints/cli.md).
describe('oneLine', () => {
  it('turns line breaks and terminal escapes into spaces, leaving the rest', () => {
    expect(oneLine('Ada\nchangeset forged by Eve')).toBe('Ada changeset forged by Eve');
    expect(oneLine('\u001b[31mred\u001b[0m')).toBe(' [31mred [0m');
    expect(oneLine('a b\rc')).toBe('a b c');
    expect(oneLine('Zoë 🚀')).toBe('Zoë 🚀');
  });
});
