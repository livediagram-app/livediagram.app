// Tree-scaffold templates beyond the org chart: the OKR goal tree and
// the website sitemap. Both are the org chart's three-tier geometry
// (one root, a middle rank, leaf pairs) retold for different domains,
// which is why they share a file; the org chart itself stays in
// template-builders-trees.ts with the mind map it shipped alongside.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so each template is
// self-describing. See spec/09 "Templates" for the catalogue.

import { createPinnedArrow, createShape, createText, type Element } from '@livediagram/diagram';

// OKR tree: one objective branching into three measurable key results,
// each backed by the two initiatives meant to move it. The KR labels
// carry real baseline → target numbers so the "measurable" part of the
// framework is visible in the scaffold, not just implied.
export function buildOkrTree(cx: number, cy: number): Element[] {
  const objectiveW = 400;
  const objectiveH = 88;
  const krW = 250;
  const krH = 76;
  const initW = 210;
  const initH = 60;
  // KR centres sit krSpacing apart; each KR's two initiatives sit
  // initSpread either side of it. No-overlap rule (see buildOrgChart):
  // krSpacing > 2 * initSpread + initW, and 470 > 2*115 + 210 = 440.
  const krSpacing = 470;
  const initSpread = 115;

  const objectiveY = cy - 260;
  const krY = cy - 40;
  const initY = cy + 150;

  const objective = {
    ...createShape('square', cx - objectiveW / 2, objectiveY),
    width: objectiveW,
    height: objectiveH,
    label: 'Objective · Make self-serve customers successful',
    textSize: 'md' as const,
    textBold: true,
    // The objective anchors the whole tree → hero preset.
    colorPreset: 'bold',
  };

  const krs = [
    'KR1 · NPS 40 → 55',
    'KR2 · Activation 25% → 40%',
    'KR3 · Monthly churn under 2%',
  ].map((label, i) => ({
    ...createShape('square', cx - krW / 2 + (i - 1) * krSpacing, krY),
    width: krW,
    height: krH,
    label,
    textSize: 'sm' as const,
    // The measurable middle tier: a tint above the plain initiatives.
    colorPreset: 'soft',
  }));

  const initiativeLabels: ReadonlyArray<readonly [string, string]> = [
    ['Revamp onboarding', 'In-app help centre'],
    ['Guided first project', 'Empty-state templates'],
    ['Win-back email series', 'Exit-survey insights'],
  ] as const;
  const initiatives = krs.flatMap((kr, i) => {
    const krCenterX = kr.x + krW / 2;
    const [left, right] = initiativeLabels[i]!;
    return [
      {
        ...createShape('square', krCenterX - initSpread - initW / 2, initY),
        width: initW,
        height: initH,
        label: left,
        textSize: 'sm' as const,
      },
      {
        ...createShape('square', krCenterX + initSpread - initW / 2, initY),
        width: initW,
        height: initH,
        label: right,
        textSize: 'sm' as const,
      },
    ];
  });

  const arrows = [
    ...krs.map((kr) => createPinnedArrow(objective.id, 's', kr.id, 'n')),
    ...initiatives.map((init, i) =>
      createPinnedArrow(krs[Math.floor(i / 2)]!.id, 's', init.id, 'n'),
    ),
  ];

  return [objective, ...krs, ...initiatives, ...arrows];
}

// Sitemap: a website's page hierarchy from Home down through four
// sections to their sub-pages. Same tree bones as the org chart, but
// wired with orthogonal rake connectors, the sitemap convention, and
// path captions under each leaf so the boxes read as routes rather
// than people.
//
// A bare `angled` arrow has a single auto elbow, so a parent-bottom to
// child-top edge would arrive at the child travelling SIDEWAYS along
// its top edge (the head floats mid-air pointing at nothing). Each
// connector instead carries two waypoints on the row midline, giving
// the classic down-across-down rake that arrives vertically at the
// child's top anchor. Waypoints are chord-midpoint-relative
// (`curvePoints`), and the row midline IS the chord's mid-Y for a
// vertical tier pair, so the deltas are purely horizontal and the
// route translates cleanly when a box is dragged.
const rakeWaypoints = (
  from: { x: number; y: number },
  to: { x: number; y: number },
): { dx: number; dy: number }[] => {
  const chordMidX = (from.x + to.x) / 2;
  return [
    { dx: from.x - chordMidX, dy: 0 },
    { dx: to.x - chordMidX, dy: 0 },
  ];
};

export function buildSitemap(cx: number, cy: number): Element[] {
  const homeW = 220;
  const homeH = 76;
  const sectionW = 190;
  const sectionH = 64;
  const leafW = 160;
  const leafH = 54;
  const pathH = 24;
  // Section centres sit sectionSpacing apart; leaves sit leafSpread
  // either side of their section. No-overlap rule (see buildOrgChart):
  // sectionSpacing > 2 * leafSpread + leafW, and 380 > 2*100 + 160 = 360.
  const sectionSpacing = 380;
  const leafSpread = 100;

  const homeY = cy - 250;
  const sectionY = cy - 50;
  const leafY = cy + 140;

  const home = {
    ...createShape('square', cx - homeW / 2, homeY),
    width: homeW,
    height: homeH,
    label: 'Home',
    textSize: 'lg' as const,
    colorPreset: 'bold',
  };

  type Section = { label: string; leaves: [string, string] };
  const sections: Section[] = [
    { label: 'Product', leaves: ['Features', 'Integrations'] },
    { label: 'Pricing', leaves: ['Plans', 'FAQ'] },
    { label: 'Resources', leaves: ['Guides', 'Changelog'] },
    { label: 'About', leaves: ['Team', 'Careers'] },
  ];

  const elements: Element[] = [home];
  const arrows: Element[] = [];

  sections.forEach((section, i) => {
    const sectionCenterX = cx + (i - (sections.length - 1) / 2) * sectionSpacing;
    const sectionEl = {
      ...createShape('square', sectionCenterX - sectionW / 2, sectionY),
      width: sectionW,
      height: sectionH,
      label: section.label,
      textSize: 'md' as const,
      colorPreset: 'soft',
    };
    elements.push(sectionEl);
    arrows.push({
      ...createPinnedArrow(home.id, 's', sectionEl.id, 'n'),
      arrowStyle: 'angled',
      curvePoints: rakeWaypoints({ x: cx, y: homeY + homeH }, { x: sectionCenterX, y: sectionY }),
    });

    section.leaves.forEach((leaf, j) => {
      const leafCenterX = sectionCenterX + (j === 0 ? -leafSpread : leafSpread);
      const leafEl = {
        ...createShape('square', leafCenterX - leafW / 2, leafY),
        width: leafW,
        height: leafH,
        label: leaf,
        textSize: 'sm' as const,
      };
      elements.push(leafEl);
      // Route caption under the page box, muted so it reads as metadata.
      elements.push({
        ...createText(leafCenterX - leafW / 2, leafY + leafH + 6),
        width: leafW,
        height: pathH,
        label: `/${section.label.toLowerCase()}/${leaf.toLowerCase()}`,
        textSize: 'sm',
        textAlignX: 'center',
        textColor: '#64748b',
      });
      arrows.push({
        ...createPinnedArrow(sectionEl.id, 's', leafEl.id, 'n'),
        arrowStyle: 'angled',
        curvePoints: rakeWaypoints(
          { x: sectionCenterX, y: sectionY + sectionH },
          { x: leafCenterX, y: leafY },
        ),
      });
    });
  });

  return [...elements, ...arrows];
}
