// The articles two or more apps share (liveworkspace/docs/specs/017-help/help-centre.md "Articles and the apps they
// apply to"): one entry per path, its `apps` the apps it came from in registry order. Each merge batch keeps its
// entries in a file of its own here (`<batch>.ts`, exporting `articles: Article[]`) and adds it below, one import
// and one spread per batch, so the catalogue (../index.ts) and every app's slice read them all from this one list.
//
//   import { articles as b1Palette } from './b1-palette';
//   export const sharedArticles: readonly Article[] = [...b1Palette];

import type { Article } from '../../types';
import { articles as b1Palette } from './b1-palette';
import { articles as b2Canvas } from './b2-canvas';
import { articles as b3Collaboration } from './b3-collaboration';
import { articles as b4ExplorerTabsAccount } from './b4-explorer-tabs-account';
import { articles as b5DevUiTips } from './b5-dev-ui-tips';
import { articles as b6Support } from './b6-support';

export const sharedArticles: readonly Article[] = [
  ...b1Palette,
  ...b2Canvas,
  ...b3Collaboration,
  ...b4ExplorerTabsAccount,
  ...b5DevUiTips,
  ...b6Support,
];
