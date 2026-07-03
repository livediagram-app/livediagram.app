// Sticky-note workshop boards: the affinity map (brainstorm stickies
// clustered into themes) and the user story map (an activity backbone
// with story cards sliced into release bands). Both are freeform
// facilitation surfaces built from stickies + light scaffolding, which
// is why they share a file; the fill-the-boxes strategy canvases live
// in template-builders-canvases.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so each template is
// self-describing. See spec/09 "Templates" for the catalogue.

import {
  createArrow,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livediagram/diagram';

// Affinity map: a research question up top, three dashed cluster frames
// the team has already themed, and an unsorted pile still to file. The
// clusters use the frame shape (transparent, labelled) with a dashed
// stroke so they read as boundaries drawn around the notes rather than
// solid containers; stickies inside carry a slight alternating tilt so
// the board keeps its hand-placed workshop feel.
export function buildAffinityMap(cx: number, cy: number): Element[] {
  const frameW = 420;
  const frameH = 520;
  const frameGap = 48;
  const stickyW = 340;
  const stickyH = 118;
  const stickyGap = 24;
  const titleH = 50;
  const titleGap = 40;

  type Cluster = { label: string; notes: string[] };
  const clusters: Cluster[] = [
    {
      label: 'Onboarding',
      notes: [
        'Empty canvas is intimidating',
        'No sample diagrams to poke at',
        'Too many steps before any value',
      ],
    },
    {
      label: 'Pricing clarity',
      notes: ['Free-tier limits are unclear', 'No pricing link inside the app'],
    },
    {
      label: 'Trust',
      notes: ['Unfamiliar brand', 'No testimonials on the landing page'],
    },
  ];

  // Unsorted pile to the right of the clusters: the work still to do.
  const unsorted = ['Slow load on mobile', 'Invite flow is confusing'];
  const pileW = 300;

  const totalW = clusters.length * frameW + (clusters.length - 1) * frameGap + frameGap + pileW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + titleGap + frameH) / 2;
  const framesTop = y0 + titleH + titleGap;

  const elements: Element[] = [];

  elements.push({
    ...createText(x0, y0),
    width: totalW,
    height: titleH,
    label: 'Brainstorm · Why do sign-ups drop off?',
    textSize: 'lg',
    textBold: true,
  });

  clusters.forEach((cluster, i) => {
    const fx = x0 + i * (frameW + frameGap);
    elements.push({
      ...createShape('frame', fx, framesTop),
      width: frameW,
      height: frameH,
      label: cluster.label,
      strokeStyle: 'dashed',
      textSize: 'md',
    });
    cluster.notes.forEach((note, j) => {
      elements.push({
        ...createSticky(fx + (frameW - stickyW) / 2, framesTop + 64 + j * (stickyH + stickyGap)),
        width: stickyW,
        height: stickyH,
        label: note,
        textSize: 'sm',
        // Alternate a gentle tilt so the notes read as hand-placed.
        rotation: j % 2 === 0 ? -2 : 2,
      });
    });
  });

  // The unsorted pile leans harder than the clustered notes: it hasn't
  // been tidied into a theme yet.
  const pileX = x0 + totalW - pileW;
  elements.push({
    ...createText(pileX, framesTop),
    width: pileW,
    height: 40,
    label: 'Unsorted',
    textSize: 'md',
    textAlignX: 'center',
    textColor: '#64748b',
  });
  unsorted.forEach((note, i) => {
    elements.push({
      ...createSticky(pileX + (pileW - stickyW + 40) / 2, framesTop + 64 + i * (stickyH + 36)),
      width: stickyW - 40,
      height: stickyH,
      label: note,
      textSize: 'sm',
      rotation: i % 2 === 0 ? 4 : -5,
    });
  });

  return elements;
}

// User story map: the walking-skeleton backbone of user activities
// across the top, with story stickies beneath each activity, sliced
// into two release bands (MVP and Release 2) by a dashed cut line.
// Worked example: an online shop, so every card's altitude is obvious
// (activities are journeys, stories are shippable slices).
export function buildUserStoryMap(cx: number, cy: number): Element[] {
  const colW = 250;
  const colGap = 40;
  const railW = 128; // left rail carrying the release-band labels
  const railGap = 32;
  const activityH = 84;
  const backboneGap = 40;
  const stickyH = 100;
  const stickyGap = 18;
  const bandGap = 56; // vertical clearance around the release cut line

  type Activity = { label: string; mvp: string[]; later: string[] };
  const activities: Activity[] = [
    {
      label: 'Browse products',
      mvp: ['Search the catalogue', 'Filter by category'],
      later: ['Save favourites'],
    },
    {
      label: 'Build a cart',
      mvp: ['Add item to cart', 'Edit quantities'],
      later: ['Share cart with a friend'],
    },
    {
      label: 'Check out',
      mvp: ['Pay by card', 'Guest checkout'],
      later: ['Apple Pay + wallets'],
    },
    {
      label: 'Track my order',
      mvp: ['Order status page', 'Email confirmation'],
      later: ['Live courier map'],
    },
  ];

  const mvpRows = Math.max(...activities.map((a) => a.mvp.length));
  const mvpBandH = mvpRows * stickyH + (mvpRows - 1) * stickyGap;
  const gridW = activities.length * colW + (activities.length - 1) * colGap;
  const totalW = railW + railGap + gridW;
  const laterRows = Math.max(...activities.map((a) => a.later.length));
  const laterBandH = laterRows * stickyH + (laterRows - 1) * stickyGap;
  const totalH = activityH + backboneGap + mvpBandH + bandGap + laterBandH;

  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const gridX = x0 + railW + railGap;
  const mvpTop = y0 + activityH + backboneGap;
  const cutY = mvpTop + mvpBandH + bandGap / 2;
  const laterTop = cutY + bandGap / 2;

  const elements: Element[] = [];

  // Backbone: one activity card per column. Soft preset so the spine
  // reads a level above the story cards without fighting the theme.
  activities.forEach((activity, i) => {
    elements.push({
      ...createShape('square', gridX + i * (colW + colGap), y0),
      width: colW,
      height: activityH,
      label: activity.label,
      textSize: 'md',
      textBold: true,
      colorPreset: 'soft',
    });
  });

  // Release cut line: a dashed rule across the story grid separating
  // the MVP slice from the next release.
  elements.push({
    ...createArrow(x0, cutY, gridX + gridW, cutY),
    arrowEnds: 'none',
    strokeStyle: 'dashed',
    strokeColor: '#94a3b8',
  });

  // Left-rail band labels, one per slice.
  const bandLabel = (y: number, h: number, label: string): Element => ({
    ...createText(x0, y + h / 2 - 24),
    width: railW,
    height: 48,
    label,
    textSize: 'md',
    textBold: true,
    textAlignX: 'left',
    textColor: '#64748b',
  });
  elements.push(bandLabel(mvpTop, mvpBandH, 'MVP'));
  elements.push(bandLabel(laterTop, laterBandH, 'Release 2'));

  // Story stickies under each activity, banded by release.
  activities.forEach((activity, i) => {
    const x = gridX + i * (colW + colGap);
    activity.mvp.forEach((story, j) => {
      elements.push({
        ...createSticky(x, mvpTop + j * (stickyH + stickyGap)),
        width: colW,
        height: stickyH,
        label: story,
        textSize: 'sm',
      });
    });
    activity.later.forEach((story, j) => {
      elements.push({
        ...createSticky(x, laterTop + j * (stickyH + stickyGap)),
        width: colW,
        height: stickyH,
        label: story,
        textSize: 'sm',
      });
    });
  });

  return elements;
}
