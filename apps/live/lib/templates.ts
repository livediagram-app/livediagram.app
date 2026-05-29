import {
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/diagram';

export type TemplateKind = 'blank' | 'mindmap' | 'orgchart' | 'retrospective';

export type TemplateDescriptor = {
  kind: TemplateKind;
  title: string;
  description: string;
};

export const TEMPLATES: TemplateDescriptor[] = [
  {
    kind: 'blank',
    title: 'Blank diagram',
    description: 'An empty canvas to start with whatever you like.',
  },
  {
    kind: 'mindmap',
    title: 'Mind map',
    description: 'A central idea with branching topics around it.',
  },
  {
    kind: 'orgchart',
    title: 'Org chart',
    description: 'A simple hierarchy: leader with direct reports.',
  },
  {
    kind: 'retrospective',
    title: 'Retrospective',
    description: '"What went well", "What didn\'t", "Action items".',
  },
];

// Build the elements for a given template, centred on the supplied canvas
// point. Each template is intentionally small and editable; users grow them.
export function buildTemplate(kind: TemplateKind, cx: number, cy: number): Element[] {
  switch (kind) {
    case 'blank':
      return [];
    case 'mindmap':
      return buildMindMap(cx, cy);
    case 'orgchart':
      return buildOrgChart(cx, cy);
    case 'retrospective':
      return buildRetrospective(cx, cy);
  }
}

function buildMindMap(cx: number, cy: number): Element[] {
  const centerSize = 140;
  const branchW = 120;
  const branchH = 70;
  const radius = 220;

  const center = {
    ...createShape('circle', cx - centerSize / 2, cy - centerSize / 2),
    width: centerSize,
    height: centerSize,
    label: 'Main idea',
    textSize: 'lg' as const,
  };

  const branches: { angle: number; label: string; from: Anchor; to: Anchor }[] = [
    { angle: 0, label: 'Topic 1', from: 'e', to: 'w' },
    { angle: 90, label: 'Topic 2', from: 's', to: 'n' },
    { angle: 180, label: 'Topic 3', from: 'w', to: 'e' },
    { angle: 270, label: 'Topic 4', from: 'n', to: 's' },
  ];

  const branchElements = branches.map(({ angle, label }) => {
    const rad = (angle * Math.PI) / 180;
    const bx = cx + Math.cos(rad) * radius - branchW / 2;
    const by = cy + Math.sin(rad) * radius - branchH / 2;
    return {
      ...createShape('circle', bx, by),
      width: branchW,
      height: branchH,
      label,
      textSize: 'md' as const,
    };
  });

  const arrows = branches.map((b, i) =>
    createPinnedArrow(center.id, b.from, branchElements[i]!.id, b.to),
  );

  return [center, ...branchElements, ...arrows];
}

function buildOrgChart(cx: number, cy: number): Element[] {
  const headW = 180;
  const headH = 70;
  const reportW = 150;
  const reportH = 54;

  const head = {
    ...createShape('square', cx - headW / 2, cy - 120),
    width: headW,
    height: headH,
    label: 'CEO',
    textSize: 'lg' as const,
  };

  const reportLabels = ['VP Engineering', 'VP Sales', 'VP Operations'];
  const reportXs = [cx - reportW * 1.7, cx - reportW / 2, cx + reportW * 0.7];
  const reports = reportLabels.map((label, i) => ({
    ...createShape('square', reportXs[i]!, cy + 40),
    width: reportW,
    height: reportH,
    label,
    textSize: 'md' as const,
  }));

  const arrows = reports.map((r) => createPinnedArrow(head.id, 's', r.id, 'n'));

  return [head, ...reports, ...arrows];
}

function buildRetrospective(cx: number, cy: number): Element[] {
  const colW = 220;
  const colSpacing = 240;
  const headerH = 48;
  const stickyH = 110;
  const stickyGap = 20;
  const columns = [
    'What went well',
    "What didn't go well",
    'Action items',
  ];
  const firstColX = cx - colSpacing - colW / 2;

  const elements: Element[] = [];
  for (let i = 0; i < columns.length; i++) {
    const x = firstColX + i * colSpacing;
    const headerY = cy - 240;
    elements.push({
      ...createText(x, headerY),
      width: colW,
      height: headerH,
      label: columns[i]!,
      textSize: 'lg',
      textAlignX: 'center',
    });
    for (let j = 0; j < 3; j++) {
      const stickyY = headerY + headerH + 24 + j * (stickyH + stickyGap);
      elements.push({
        ...createSticky(x, stickyY),
        width: colW,
        height: stickyH,
        textSize: 'sm',
      });
    }
  }
  return elements;
}
