import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isIdentifier, isJsxSelfClosingElement, type Node } from 'typescript/unstable/ast';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseSourceFiles } from './index';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'source-ast-'));
  writeFileSync(
    join(dir, 'a.ts'),
    'export const answer = 42;\n// two\nexport const other = answer;\n',
  );
  writeFileSync(join(dir, 'b.tsx'), 'export const B = () => <Glyph name="x" />;\n');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const all = (root: Node): Node[] => {
  const out: Node[] = [];
  const visit = (node: Node): void => {
    out.push(node);
    node.forEachChild(visit);
  };
  visit(root);
  return out;
};

describe('parseSourceFiles', () => {
  it('parses each file, in order, with parents and positions', () => {
    const [a, b] = parseSourceFiles([join(dir, 'a.ts'), join(dir, 'b.tsx')]);
    expect(a?.fileName).toBe(join(dir, 'a.ts'));
    const other = all(a!).find((n) => isIdentifier(n) && n.text === 'other');
    expect(other?.parent).toBeDefined();
    expect(a?.getLineAndCharacterOfPosition(other!.getStart(a)).line).toBe(2);
    expect(all(b!).some(isJsxSelfClosingElement)).toBe(true);
  });

  it('parses nothing for no files', () => {
    expect(parseSourceFiles([])).toEqual([]);
  });

  it('names a file the compiler could not read', () => {
    expect(() => parseSourceFiles([join(dir, 'missing.ts')])).toThrow(
      /did not parse .*missing\.ts/,
    );
  });
});
