import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Test-only. Every editor keeps its element dialogs in components/dialogs/EditorElementDialogs.tsx, each opened by an
// "open for id" state (`linkPickerOpenForId`, `rowsEditorOpenFor`, ...). A state declared without its dialog mounted
// there opens nothing (livedocuments' Resources dialog sat unmounted until a browser check found it), so each editor's
// test calls `elementDialogMountGaps` with its own folder: the states come from the editor's own `useState`
// declarations, never a hand-copied list, so a new one is checked the day it is added.

const DECLARED = /\[\s*(\w+Open(?:ForId|For))\s*,\s*set\w+\s*\]\s*=\s*useState\b/g;
const SKIPPED_DIRS = new Set(['node_modules', '.next', '.open-next', 'coverage', 'dist', 'e2e']);
const MOUNT_FILE = 'components/dialogs/EditorElementDialogs.tsx';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) out.push(...sourceFiles(join(dir, entry.name)));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** The open-for-id states the editor under `root` declares (`useState` in its source, tests aside). */
export function declaredOpenForStates(root: string): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(root)) {
    for (const match of readFileSync(file, 'utf8').matchAll(DECLARED)) {
      if (match[1]) names.add(match[1]);
    }
  }
  return [...names].sort();
}

/**
 * What stops each declared state opening its dialog, one line per gap (empty when all is mounted). A state must be
 * read by a render gate (`{x !== null ...` or `{x && ...`) in EditorElementDialogs.tsx and, where that file wakes its
 * dialogs from a chrome selector (`useEditorChrome`), by that selector too (`s.x`).
 * `elsewhere` names states whose dialog another file mounts, each with that file as the reason.
 */
export function elementDialogMountGaps(
  root: string,
  elsewhere: Readonly<Record<string, string>> = {},
): string[] {
  const mount = readFileSync(join(root, MOUNT_FILE), 'utf8');
  const hasSelector = mount.includes('useEditorChrome(');
  const declared = declaredOpenForStates(root);
  const gaps: string[] = [];
  for (const state of declared) {
    if (state in elsewhere) continue;
    const gate = new RegExp(`\\{\\s*${state}\\s*(?:!==\\s*null\\b|&&)`);
    if (!gate.test(mount)) gaps.push(`${state}: no render gate in ${MOUNT_FILE}`);
    if (hasSelector && !new RegExp(`\\bs\\.${state}\\b`).test(mount))
      gaps.push(`${state}: missing from the useEditorChrome open selector`);
  }
  for (const state of Object.keys(elsewhere)) {
    if (!declared.includes(state))
      gaps.push(`${state}: listed as mounted elsewhere but not declared`);
  }
  return gaps;
}
