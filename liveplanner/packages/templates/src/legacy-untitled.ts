// A project's name before anyone names it. Its own leaf module, apart from the template catalogue in
// templates.ts: the editor reads it on every load, and importing it from there drew the whole catalogue and
// its builders into the editor's first load.
export const UNTITLED_PROJECT_NAME = 'Untitled plan';

// The default project name was "Untitled diagram" before the container became a project
// (docs/specs/006-project/project-structure.md), then "Untitled project" before people saw it
// called a plan. Projects stored under either still count as untitled, so the first label still
// names them.

const LEGACY_UNTITLED_NAMES: readonly string[] = ['Untitled project', 'Untitled diagram'];

export function isUntitledProjectName(name: string): boolean {
  return name === UNTITLED_PROJECT_NAME || LEGACY_UNTITLED_NAMES.includes(name);
}
