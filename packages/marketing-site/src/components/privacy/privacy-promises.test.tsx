import { describe, expect, it } from 'vitest';
import { privacyPromises } from './privacy-promises';

describe('privacyPromises', () => {
  const base = privacyPromises({ noun: 'plan', exports: 'a board as CSV' });

  it('draws six promises with the product words in the right cards', () => {
    expect(base).toHaveLength(6);
    expect(base[1]!.description).toContain('Export a board as CSV whenever you like');
    expect(base[4]!.description).toContain('A new plan is visible only to you');
    expect(base[5]!.title).toBe('Open source, auditable');
  });

  it('makes no claim the code does not keep', () => {
    const words = base.map((p) => p.description).join(' ');
    expect(words).not.toMatch(/model trainers|AES-256|all in one go/);
    expect(words).toContain("we don't use it to train AI models");
  });

  it('takes a product extra, its own last card and Title Case', () => {
    const last = { title: 'No ads', description: 'None.', art: null };
    const cased = privacyPromises({
      noun: 'page',
      exports: 'a page to PDF',
      privateNoun: 'knowledgebase',
      neverSoldExtra: 'Ask goes to built-in AI.',
      privateExtra: 'Agents see only what you can.',
      stack: 'editor, MCP server',
      titleCase: true,
      last,
    });
    expect(cased[0]!.title).toBe('No Third-Party Analytics');
    expect(cased[1]!.title).toBe('Your Pages Are Yours');
    expect(cased[2]!.description).toMatch(/Ask goes to built-in AI\.$/);
    expect(cased[4]!.description).toContain('A new knowledgebase is visible');
    expect(cased[4]!.description).toMatch(/Agents see only what you can\.$/);
    expect(cased[5]).toBe(last);
    expect(
      privacyPromises({ noun: 'x', exports: 'y', stack: 'editor, MCP server' })[5]!.description,
    ).toContain('(editor, MCP server)');
  });
});
