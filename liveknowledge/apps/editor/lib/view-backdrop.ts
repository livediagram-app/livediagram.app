// The ground a knowledgebase page stands on (docs/specs/030-knowledgebase/page-surface.md "No paper, no canvas"):
// white in the light theme and the chrome's dark ground in the dark one, following the app's appearance and nothing
// else. A tab's own canvas colour, pattern or theme (an imported livedocuments file carries them) is not read here:
// every page of a knowledgebase stands on the same ground. Exports still read the stored tab (resolveTabBackdrop).
import type { Appearance, Tab } from '@liveknowledge/document';
import { getResolvedAppearance } from '@liveknowledge/ui';
import type { ResolvedBackdrop } from './themes';

/** The page's ground in each appearance: white, and slate-900 (the dark chrome's own surface). */
export const PAGE_GROUND: Readonly<Record<Appearance, string>> = {
  light: '#ffffff',
  dark: '#0f172a',
};

const GROUNDS: Readonly<Record<Appearance, ResolvedBackdrop>> = {
  light: ground('light'),
  dark: ground('dark'),
};

function ground(appearance: Appearance): ResolvedBackdrop {
  return {
    backgroundColor: PAGE_GROUND[appearance],
    patternColor: PAGE_GROUND[appearance],
    backgroundPattern: 'blank',
    backgroundOpacity: 1,
  };
}

export function resolveViewBackdrop(
  _tab?: Pick<
    Tab,
    'theme' | 'backgroundColor' | 'backgroundPattern' | 'patternColor' | 'backgroundOpacity'
  >,
  appearance: Appearance = getResolvedAppearance(),
): ResolvedBackdrop {
  // One object per appearance, so what is drawn from it keeps its memo.
  return GROUNDS[appearance];
}
