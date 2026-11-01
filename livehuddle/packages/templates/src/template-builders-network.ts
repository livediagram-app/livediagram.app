// The network diagram (docs/specs/008-canvas/canvas-and-palette.md "Templates", the use-case batch): a small office's
// network in the System Architecture's grammar (template-builders-technical.ts): four tier lanes top to bottom
// (Internet, Edge, Core, Access), every node a card with a line-art glyph, and every link labelled. Links carry no
// arrowheads, as a network is drawn, and their pattern says what they are: solid a cable, dashed Wi-Fi, dotted the
// VPN tunnel, keyed under the lanes beside an IP plan table. The Access lane holds three VLAN boundaries, each with
// its subnet, fed from the core switch.
//
// Lanes, their blurbs and glyphs, the key and the IP plan are the "Tiers" scaffold; the nodes, boundaries and links
// the "Network" content. Pure: takes a centre (cx, cy), returns a fresh Element[].

import {
  createPinnedArrow,
  createShape,
  createTable,
  createText,
  diagramKeyHeight,
  keyRowsOf,
  type Anchor,
  type Element,
  type TableCellStyle,
} from '@livehuddle/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import { rake } from './template-rake';
import { TECH_HEADER_H, techHeader } from './template-builders-technical-kit';

const MUTED = '#64748b';
const INK = '#334155';

type Tier = {
  name: string;
  blurb: string;
  icon: string;
  height: number;
  band: string;
  header: string;
  line: string;
  node: string;
  ink: string;
};
const TIERS: readonly Tier[] = [
  {
    name: 'Internet',
    blurb: 'Outside the building',
    icon: 'globe',
    height: 140,
    band: '#f8fafc',
    header: '#f1f5f9',
    line: '#cbd5e1',
    node: '#64748b',
    ink: '#334155',
  },
  {
    name: 'Edge',
    blurb: 'The way in and out',
    icon: 'shield',
    height: 140,
    band: '#fff1f2',
    header: '#ffe4e6',
    line: '#fecdd3',
    node: '#f43f5e',
    ink: '#9f1239',
  },
  {
    name: 'Core',
    blurb: 'The heart of the office',
    icon: 'server',
    height: 140,
    band: '#eff6ff',
    header: '#dbeafe',
    line: '#bfdbfe',
    node: '#3b82f6',
    ink: '#1e40af',
  },
  {
    name: 'Access',
    blurb: 'Where people and devices plug in',
    icon: 'wifi',
    height: 220,
    band: '#f0fdf4',
    header: '#dcfce7',
    line: '#bbf7d0',
    node: '#22c55e',
    ink: '#166534',
  },
];

// The VLANs, each a boundary over two columns of the Access lane, and the IP plan's rows.
const VLANS = [
  {
    name: 'Staff · VLAN 10',
    subnet: '10.0.10.0/24',
    icon: 'users',
    stroke: '#16a34a',
    col: 0,
    gateway: '10.0.10.1',
    dhcp: '.100 to .199, 8-day leases',
  },
  {
    name: 'Guest Wi-Fi · VLAN 20',
    subnet: '10.0.20.0/24',
    icon: 'wifi',
    stroke: '#0891b2',
    col: 2,
    gateway: '10.0.20.1',
    dhcp: '.10 to .250, 2-hour leases',
  },
  {
    name: 'Cameras · VLAN 30',
    subnet: '10.0.30.0/24',
    icon: 'camera',
    stroke: '#7c3aed',
    col: 4,
    gateway: '10.0.30.1',
    dhcp: 'None: fixed addresses only',
  },
] as const;

const HEAD: TableCellStyle = { bg: '#e2e8f0', textColor: '#0f172a', bold: true };

export function buildNetworkDiagram(cx: number, cy: number): Element[] {
  const gutter = 176;
  const colPitch = 260;
  const nodeW = 200;
  const nodeH = 72;
  const laneGap = 48;
  const headGap = 28;
  const footGap = 36;
  const boundaryPad = 16;
  const labelBand = 40;
  const laneW = gutter + 24 + 6 * colPitch;
  const lanesH = TIERS.reduce((sum, t) => sum + t.height, 0) + (TIERS.length - 1) * laneGap;
  const tableRowH = 44;
  const tableH = tableRowH * (VLANS.length + 1);
  const keyH = diagramKeyHeight(3);
  const footH = Math.max(tableH, keyH);
  const totalH = TECH_HEADER_H + headGap + lanesH + footGap + footH;
  const left = cx - laneW / 2;
  const top = cy - totalH / 2;
  const lanesTop = top + TECH_HEADER_H + headGap;
  const laneTop = (tier: number) =>
    lanesTop + TIERS.slice(0, tier).reduce((sum, t) => sum + t.height + laneGap, 0);
  const laneMid = (tier: number) => laneTop(tier) + TIERS[tier]!.height / 2;
  const colX = (col: number) => left + gutter + 12 + colPitch / 2 + col * colPitch;

  const scaffold: Element[] = [
    ...techHeader(
      left,
      top,
      laneW,
      'Northwind Coffee · head office network',
      'Traffic comes in at the top. Solid lines are cables, dashed lines are Wi-Fi, the dotted line is the VPN tunnel.',
    ),
  ];
  TIERS.forEach((tier, i) => {
    const y = laneTop(i);
    scaffold.push(
      {
        ...createShape('lane', left, y),
        width: laneW,
        height: tier.height,
        label: tier.name,
        textSize: 'md',
        textBold: true,
        textColor: tier.ink,
        textAlignX: 'left',
        textAlignY: 'top',
        fillColor: tier.band,
        strokeColor: tier.line,
        headerFill: tier.header,
        headerSize: gutter,
      },
      {
        ...createText(left + 26, y + 52),
        width: gutter - 36,
        height: 40,
        label: tier.blurb,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: 'left',
        textAlignY: 'top',
      },
      {
        ...createShape('icon', left + 26, y + tier.height - 46),
        width: 26,
        height: 26,
        iconId: tier.icon,
        strokeColor: tier.ink,
      },
    );
  });

  type Node = Extract<Element, { type: 'shape' }>;
  const node = (
    label: string,
    iconId: string,
    col: number,
    tier: number,
    extra: Partial<Node> = {},
    dy = 0,
  ): Node => {
    const {
      pageSubtitle: _meta,
      tags: _tags,
      ...base
    } = createShape('card', colX(col) - nodeW / 2, laneMid(tier) - nodeH / 2 + dy);
    return {
      ...base,
      width: nodeW,
      height: nodeH,
      cardMedia: 'tile',
      iconId,
      pageTitle: label,
      label: '',
      fillColor: '#ffffff',
      strokeColor: TIERS[tier]!.node,
      textColor: INK,
      accentEdge: 'left',
      ...extra,
    };
  };

  // The Access lane's VLANs: a boundary over two columns, its subnet as the meta line, its two devices inside it
  // under the title band.
  const accessTop = laneTop(3);
  const accessH = TIERS[3]!.height;
  const boundaries = VLANS.map((v): Node => ({
    ...createShape('boundary', colX(v.col) - nodeW / 2 - boundaryPad, accessTop + boundaryPad),
    width: colPitch + nodeW + boundaryPad * 2,
    height: accessH - boundaryPad * 2,
    label: v.name,
    pageSubtitle: v.subnet,
    iconId: v.icon,
    boundaryStyle: 'inset',
    strokeColor: v.stroke,
    // The Access lane keeps its pale band under a dark theme, so the title keeps its VLAN's deep ink.
    textColor: v.stroke,
  }));
  // Devices sit centred in what the title band leaves.
  const deviceDy = labelBand / 2;

  const cloudApps = node('Cloud apps', 'cloud', 0, 0);
  const internet = node('Internet', 'globe', 1, 0);
  const remote = node('Remote staff', 'monitor', 5, 0);
  const router = node('Fibre router', 'router', 1, 1);
  // Everything crosses the firewall, so it is the one filled node.
  const firewall = node('Firewall', 'shield', 2.5, 1, {
    cardMedia: 'badge',
    fillColor: '#e11d48',
    strokeColor: '#9f1239',
    textColor: '#ffffff',
    strokeWidth: 'thick',
    textBold: true,
  });
  const nas = node('Backup NAS', 'hard-drive', 0.5, 2);
  const core = node('Core switch', 'layers', 2.5, 2);
  const files = node('File server', 'server', 4.5, 2);
  const officeSwitch = node('Office switch', 'layers', 0, 3, {}, deviceDy);
  const desks = node('Desks and printer', 'monitor', 1, 3, {}, deviceDy);
  const accessPoint = node('Wi-Fi access point', 'wifi', 2, 3, {}, deviceDy);
  const phones = node('Customers’ phones', 'smartphone', 3, 3, {}, deviceDy);
  const poe = node('PoE switch', 'zap', 4, 3, {}, deviceDy);
  const cctv = node('CCTV cameras', 'camera', 5, 3, {}, deviceDy);

  const link = (
    from: Node,
    fromA: Anchor,
    to: Node,
    toA: Anchor,
    label: string,
    style: { pattern?: 'dashed' | 'dotted'; angled?: boolean; inLane?: number } = {},
  ): Element => ({
    ...createPinnedArrow(from.id, fromA, to.id, toA),
    label,
    arrowEnds: 'none',
    ...(style.pattern ? { strokeStyle: style.pattern } : {}),
    ...(style.angled ? { arrowStyle: 'angled' as const } : {}),
    ...(style.inLane !== undefined
      ? { textColor: TIERS[style.inLane]!.ink, labelFill: TIERS[style.inLane]!.band }
      : {}),
  });
  // The core switch trunks each VLAN down through the gap above the Access lane: down, across, down.
  const trunk = (to: Node, exit: [Anchor, number], label: string): Element => {
    const from = { x: core.x + nodeW * exit[1], y: core.y + nodeH };
    return {
      ...link(core, exit[0], to, 'n', label, { angled: true }),
      curvePoints: rake(from, { x: to.x + to.width / 2, y: to.y }),
    } as Element;
  };
  const links: Element[] = [
    link(internet, 'w', cloudApps, 'e', 'SaaS', { inLane: 0 }),
    link(internet, 's', router, 'n', '1 Gbps fibre'),
    link(router, 'e', firewall, 'w', 'WAN', { inLane: 1 }),
    link(remote, 's', firewall, 'e', 'WireGuard VPN', { pattern: 'dotted', angled: true }),
    link(firewall, 's', core, 'n', 'trunk'),
    link(core, 'w', nas, 'e', 'nightly backup', { inLane: 2 }),
    link(core, 'e', files, 'w', '10 Gbps', { inLane: 2 }),
    trunk(boundaries[0]!, ['ssw', 0.25], 'VLAN 10'),
    trunk(boundaries[1]!, ['s', 0.5], 'VLAN 20'),
    trunk(boundaries[2]!, ['sse', 0.75], 'VLAN 30'),
    link(officeSwitch, 'e', desks, 'w', 'cable', { inLane: 3 }),
    link(accessPoint, 'e', phones, 'w', 'Wi-Fi', { pattern: 'dashed', inLane: 3 }),
    link(poe, 'e', cctv, 'w', 'PoE', { inLane: 3 }),
  ];

  // Under the lanes: the key, then the IP plan.
  const footY = lanesTop + lanesH + footGap;
  const keyRows = keyRowsOf(links);
  const keyW = 360;
  const tableX = left + keyW + 48;
  scaffold.push(
    {
      ...createShape('diagram-key', left, footY),
      width: keyW,
      height: diagramKeyHeight(keyRows.length),
      keyRows,
      keyMeanings: {
        'line:solid': 'Cable',
        'line:dotted': 'VPN tunnel',
        'line:dashed': 'Wi-Fi',
      },
    },
    {
      ...createTable(tableX, footY),
      width: left + laneW - tableX,
      height: tableH,
      cells: [
        ['IP plan', 'Subnet', 'Gateway', 'DHCP hands out'],
        ...VLANS.map((v) => [v.name, v.subnet, v.gateway, v.dhcp]),
      ],
      cellStyles: [
        [HEAD, HEAD, HEAD, HEAD],
        ...VLANS.map(() => [{ ...HEAD, bg: '#f1f5f9' }, null, null, null]),
      ],
      headerRow: true,
      headerColumn: true,
    },
  );

  const content: Element[] = [
    ...boundaries,
    cloudApps,
    internet,
    remote,
    router,
    firewall,
    nas,
    core,
    files,
    officeSwitch,
    desks,
    accessPoint,
    phones,
    poe,
    cctv,
    ...links,
  ];
  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
