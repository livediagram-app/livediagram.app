// The user story map (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-workshops.ts (which re-exports it) once the backbone grew
// its task tier, persona and release lanes.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createArrow,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { BLUE, MUTED, ORANGE, YELLOW } from './template-workshop-stickies';

// User story map: Jeff Patton's three tiers for a grocer taking its shop
// online. A journey arrow reads left to right over the backbone: orange
// activities (the big things Sam does) span the blue tasks beneath them
// (the walking skeleton), and under each task the yellow stories stack by
// priority. Three release lanes cut across the stories (MVP, Release 2,
// Later), each titled in its own gutter, so a release is literally a slice
// through every step of the journey. A persona card in the gutter says who
// the journey belongs to. Backbone, lanes and arrow are the "Backbone"
// scaffold; stories and the persona ride "Stories".
type Activity = {
  label: string;
  tasks: { label: string; releases: [string[], string[], string[]] }[];
};

const STORY_ACTIVITIES: Activity[] = [
  {
    label: 'Find groceries',
    tasks: [
      {
        label: 'Browse aisles',
        releases: [
          ['Aisle list with photos', 'Product detail page'],
          ['Weekly offers aisle'],
          ['Recipes that fill the basket'],
        ],
      },
      {
        label: 'Search',
        releases: [['Search by product name'], ['Filter by dietary need'], ['Scan a barcode']],
      },
    ],
  },
  {
    label: 'Fill the basket',
    tasks: [
      {
        label: 'Add to basket',
        releases: [
          ['Add and change quantity'],
          ['Reorder last week’s shop'],
          ['Shared family basket'],
        ],
      },
      {
        label: 'Pick a slot',
        releases: [
          ['Choose a one-hour slot'],
          ['Hold a slot for 2 hours'],
          ['Cheaper green slots'],
        ],
      },
    ],
  },
  {
    label: 'Pay and receive',
    tasks: [
      {
        label: 'Check out',
        releases: [
          ['Pay by card', 'Apply a promo code'],
          ['Apple Pay and Google Pay'],
          ['Pay on delivery'],
        ],
      },
      {
        label: 'Track delivery',
        releases: [['Text when the van leaves'], ['Live driver map'], ['Rate the delivery']],
      },
    ],
  },
];
const RELEASES = ['MVP · Oct', 'Release 2 · Dec', 'Later'];

export function buildUserStoryMap(cx: number, cy: number): Element[] {
  const colW = 200;
  const colGap = 16;
  const gutterW = 190; // the lane title gutter, which the persona card shares
  const gridGap = 20;
  const journeyH = 36;
  const activityH = 60;
  const taskH = 60;
  const tierGap = 12;
  const storyH = 76;
  const storyGap = 12;
  const lanePad = 14;
  const laneGap = 12;
  const backboneGap = 24;
  const titleH = 52;
  const subtitleH = 30;
  const headGap = 20;

  const tasks = STORY_ACTIVITIES.flatMap((a) => a.tasks);
  const gridW = tasks.length * colW + (tasks.length - 1) * colGap;
  // The lanes run a gap past the last column so its stories don't touch the edge.
  const totalW = gutterW + gridGap + gridW + gridGap;
  const rowsIn = (r: number) => Math.max(...tasks.map((t) => t.releases[r]!.length));
  const laneH = (r: number) => lanePad * 2 + rowsIn(r) * (storyH + storyGap) - storyGap;
  const lanesH =
    RELEASES.reduce((sum, _, r) => sum + laneH(r), 0) + laneGap * (RELEASES.length - 1);
  const backboneH = journeyH + activityH + tierGap + taskH;
  const totalH = titleH + subtitleH + headGap + backboneH + backboneGap + lanesH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const gridX = x0 + gutterW + gridGap;
  const journeyY = y0 + titleH + subtitleH + headGap;
  const activityY = journeyY + journeyH;
  const taskY = activityY + activityH + tierGap;
  const lanesTop = taskY + taskH + backboneGap;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW,
      height: titleH,
      label: 'Story map · Riverside Grocer goes online',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: subtitleH,
      label:
        'Read the backbone left to right as Sam’s journey. Stack stories by priority, then cut releases across.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  // The narrative flow, drawn as an arrow over the backbone.
  elements.push({
    ...createArrow(gridX, journeyY + 10, gridX + gridW, journeyY + 10),
    label: 'Sam’s journey',
    strokeColor: '#94a3b8',
    strokeWidth: 2,
    ...scaffold,
  });

  // Who the journey belongs to, in the gutter beside the backbone.
  elements.push({
    ...createSticky(x0, activityY),
    width: gutterW,
    height: activityH + tierGap + taskH,
    label: 'Sam, 38\nShops for a family of four, on her phone after bedtime',
    textSize: 'sm',
    fillColor: '#e9d5ff',
    textColor: '#3b0764',
    ...content,
  });
  elements.push({
    ...createShape('sticker', x0 + gutterW - 36, activityY - 22),
    width: 48,
    height: 48,
    stickerId: 'emoji-person',
    rotation: 8,
    ...content,
  });

  // Release lanes behind the stories, titled in their gutters.
  const laneTops: number[] = [];
  let laneY = lanesTop;
  RELEASES.forEach((release, r) => {
    laneTops.push(laneY);
    elements.push({
      ...createShape('lane', x0, laneY),
      width: totalW,
      height: laneH(r),
      label: release,
      textSize: 'md',
      textBold: r === 0,
      headerSize: gutterW,
      ...(r === 0 ? { strokeWidth: 'thick' as const } : {}),
      ...scaffold,
    });
    laneY += laneH(r) + laneGap;
  });

  let col = 0;
  for (const activity of STORY_ACTIVITIES) {
    const ax = gridX + col * (colW + colGap);
    const span = activity.tasks.length * colW + (activity.tasks.length - 1) * colGap;
    elements.push({
      ...createSticky(ax, activityY),
      width: span,
      height: activityH,
      label: activity.label,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      textAlignY: 'middle',
      ...ORANGE,
      ...scaffold,
    });
    for (const task of activity.tasks) {
      const tx = gridX + col * (colW + colGap);
      elements.push({
        ...createSticky(tx, taskY),
        width: colW,
        height: taskH,
        label: task.label,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'center',
        textAlignY: 'middle',
        ...BLUE,
        ...scaffold,
      });
      task.releases.forEach((stories, r) => {
        stories.forEach((story, si) => {
          elements.push({
            ...createSticky(tx, laneTops[r]! + lanePad + si * (storyH + storyGap)),
            width: colW,
            height: storyH,
            label: story,
            textSize: 'sm',
            ...YELLOW,
            ...content,
          });
        });
      });
      col++;
    }
  }

  return elements;
}
