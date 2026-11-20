// The bottom bar's tabs in a Space (the Using Tabs article, liveworkspace/docs/specs/017-help/help-centre.md): one tab
// per floor or part of the Space, the open one raised as a card with its ⋯ menu, the + that adds a tab, and the
// quick controls at the bar's far end. Drawn with livehuddle's own bottom bar (./editor-chrome).

import { Scene } from '@liveworkspace/help-site/art/primitives';
import { BAR_H, BottomBar } from './editor-chrome';
import { Desk, Plant, Room, Rug, Sofa } from './space-furniture';

/** The open tab's floor above the bar: the bar's tabs (Ground Floor open, then First Floor, Roof Garden and
 *  Breakout), the + and the quick controls. */
export function TabBarOverview() {
  const y = 190 - BAR_H;
  return (
    <Scene w={480} h={190}>
      <Room x={40} y={20} w={190} h={130} name="Reception" />
      <Rug cx={110} cy={96} rx={40} ry={18} />
      <Sofa x={90} y={84} />
      <Plant cx={210} cy={130} />
      <Room x={242} y={20} w={200} h={130} name="Desks" door="left" />
      <Desk x={262} y={60} />
      <Desk x={320} y={60} />
      <Desk x={378} y={60} />
      <BottomBar y={y} w={480} tabs={['Ground Floor', 'First Floor', 'Roof Garden', 'Breakout']} />
    </Scene>
  );
}
