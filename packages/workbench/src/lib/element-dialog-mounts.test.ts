import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { declaredOpenForStates, elementDialogMountGaps } from './element-dialog-mounts';

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function editor(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dialog-mounts-'));
  roots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const STATE = `const [aOpenForId, setAOpenForId] = useState<string | null>(null);
const [bOpenFor, setBOpenFor] = useState<{ id: string } | null>(null);`;
const MOUNT = 'components/dialogs/EditorElementDialogs.tsx';

describe('element dialog mounts', () => {
  it('reads declared states from source, ignoring tests and node_modules', () => {
    const root = editor({
      'hooks/useA.ts': STATE,
      'hooks/useA.test.ts': 'const [zOpenForId, setZ] = useState(null);',
      'node_modules/x/y.ts': 'const [yOpenForId, setY] = useState(null);',
      [MOUNT]: '',
    });
    expect(declaredOpenForStates(root)).toEqual(['aOpenForId', 'bOpenFor']);
  });

  it('is clean when every state has a gate', () => {
    const root = editor({
      'hooks/useA.ts': STATE,
      [MOUNT]: '<>{aOpenForId !== null ? <A /> : null}{bOpenFor && <B />}</>',
    });
    expect(elementDialogMountGaps(root)).toEqual([]);
  });

  it('names a state whose dialog is never mounted', () => {
    const root = editor({
      'hooks/useA.ts': STATE,
      [MOUNT]: '<>{aOpenForId !== null ? <A /> : null}</>',
    });
    expect(elementDialogMountGaps(root)).toEqual([`bOpenFor: no render gate in ${MOUNT}`]);
  });

  it('names a state missing from the chrome open selector', () => {
    const root = editor({
      'hooks/useA.ts': STATE,
      [MOUNT]:
        'useEditorChrome((s) => !!s.aOpenForId); <>{aOpenForId !== null ? <A /> : null}{bOpenFor && <B />}</>',
    });
    expect(elementDialogMountGaps(root)).toEqual([
      'bOpenFor: missing from the useEditorChrome open selector',
    ]);
  });

  it('skips states mounted elsewhere and flags stale entries', () => {
    const root = editor({
      'hooks/useA.ts': STATE,
      [MOUNT]: '<>{aOpenForId !== null ? <A /> : null}</>',
    });
    expect(elementDialogMountGaps(root, { bOpenFor: 'Other.tsx' })).toEqual([]);
    expect(elementDialogMountGaps(root, { bOpenFor: 'Other.tsx', gone: 'X.tsx' })).toEqual([
      'gone: listed as mounted elsewhere but not declared',
    ]);
  });
});
