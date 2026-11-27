// The themes a tab takes, as an agent names them (docs/specs/024-agents/agent-changesets.md "Style"): an id the catalogue
// holds, board themes included. An unknown id is refused naming the valid ones, never stored: a theme nobody can
// resolve would hard-reset the tab on its next pick.
import { THEMES, isTabThemeId } from '@liveplanner/project';

export const THEME_IDS: readonly string[] = THEMES.map((t) => t.id);

/** Why `id` is no theme, naming the ones there are; null when it is one. */
export function unknownThemeText(id: string): string | null {
  return isTabThemeId(id) ? null : `Unknown theme "${id}". Themes: ${THEME_IDS.join(', ')}.`;
}
