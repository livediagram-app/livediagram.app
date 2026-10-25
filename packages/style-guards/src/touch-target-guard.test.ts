import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkTouchTargets } from './touch-target-guard';

function scan(source: string, name = 'Control.tsx') {
  const root = mkdtempSync(join(tmpdir(), 'touch-target-guard-'));
  mkdirSync(join(root, 'components'), { recursive: true });
  writeFileSync(join(root, 'components', name), source);
  return checkTouchTargets({ root });
}

describe('touch-target guard', () => {
  it('flags a padded control that is not positioned', () => {
    const v = scan(
      `export const A = () => <a className="rounded-full px-3 touch-target-y">Plan</a>;`,
    );
    expect(v).toEqual([
      { file: 'components/Control.tsx', line: 1, snippet: 'rounded-full px-3 touch-target-y' },
    ]);
  });

  it('flags touch-target in a template className and in a className property', () => {
    const v = scan(`export const A = ({ on }: { on: boolean }) => (
  <button className={\`touch-target flex \${on ? 'bg-sky-50' : ''}\`} />
);
export const props = { className: 'touch-target-y h-6' };`);
    expect(v.map((x) => x.line)).toEqual([2, 4]);
  });

  it('accepts a host positioned in the same class list, however it is built', () => {
    expect(
      scan(`export const A = ({ on }: { on: boolean }) => (
  <>
    <a className="relative touch-target-y">A</a>
    <b className={\`absolute right-0 touch-target \${on ? 'x' : 'y'}\`} />
    <i className={on ? 'sticky touch-target' : 'sticky'} />
    <u className="fixed inset-x-0 touch-target-y" />
  </>
);`),
    ).toEqual([]);
  });

  it('ignores a comment or a test that names the utility', () => {
    expect(
      scan(
        `// touch-target-y: see touch-targets.md\nexport const A = () => <a className="px-2">A</a>;`,
      ),
    ).toEqual([]);
    expect(scan(`export const t = '<a className="touch-target">';`, 'Control.test.tsx')).toEqual(
      [],
    );
  });

  it('does not mistake a longer class for the utility', () => {
    expect(scan(`export const A = () => <a className="touch-target-yes px-2">A</a>;`)).toEqual([]);
  });
});
