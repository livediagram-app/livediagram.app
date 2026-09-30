// The cloud architecture template (docs/specs/008-canvas/canvas-and-palette.md "Templates"), split out of
// template-builders-technical.ts once it grew real AWS grouping (edge,
// region, VPC, subnets) around its service tiles.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createPinnedArrow, createShape, type Anchor, type Element } from '@livediagram/document';
import { techHeader, TECH_HEADER_H } from './template-builders-technical-kit';

// Plateful's production stack on AWS, drawn the way AWS's own reference
// diagrams are: every managed service is its real Technology tile
// (docs/specs/010-palette/technology-icons.md) with a two-line caption (the
// role, then the product), and boxes nest by where a service actually
// lives. Global edge services (Route 53, CloudFront) sit in a dashed "Edge"
// group outside the region; the London region holds the regional managed
// services (API Gateway, S3, SQS, Lambda, DynamoDB, SNS, CloudWatch); and
// only what needs private networking (the Orders service on ECS and its
// Postgres on RDS) sits inside the VPC, each in its own private subnet with
// its CIDR. The three apps outside the cloud are plain cards with line-art
// glyphs, so "ours, running on AWS" and "people's devices" read apart.
//
// The request path runs left to right along the middle row (customer app,
// CDN, API, service, queue, dispatcher, push), so the story reads at a
// glance; stores hang below it, metrics sit above, and the path forks at
// the end into the kitchen and courier apps. Dashed edges are the control
// plane (the DNS alias, the queue-depth alarm and Lambda logs into
// CloudWatch) so they read apart from traffic.
type Node = Extract<Element, { type: 'shape' }>;

const GROUP = {
  edge: '#64748b',
  region: '#0e7490',
  vpc: '#7c3aed',
  subnet: '#0284c7',
};

// Column centres. The steps are uneven on purpose: every edge that crosses
// a group's border needs room for its label on one side of that border, so
// the gaps either side of the VPC (and between the customer and the edge)
// are wider than the ones inside the region.
const COLS = [0, 290, 540, 860, 1180, 1410, 1640, 1900];

export function buildCloudArchitecture(cx: number, cy: number): Element[] {
  const tileW = 148;
  const tileH = 112;
  // A captioned Technology tile draws its 48px mark centred in the top 6%
  // to 64% of its box (iconBandBounds), so the mark's centre sits at 35%.
  const markY = tileH * 0.35;
  const cardW = 176;
  const cardH = 60;
  const rowPitch = 204;
  const labelBand = 44; // a group's label strip, above its first tile
  const pad = 18;

  const spanW = COLS[COLS.length - 1]! + cardW;
  // Row centre lines are the marks' centres; the frames extend above row 0
  // by two label bands (region, then the VPC's own) and below row 2's
  // captions by a pad.
  const rowsH = 2 * rowPitch + markY + (tileH - markY);
  const headGap = 24;
  const totalH = TECH_HEADER_H + headGap + 2 * labelBand + rowsH + pad + 14;
  const left = cx - spanW / 2;
  const top = cy - totalH / 2;
  const row0 = top + TECH_HEADER_H + headGap + 2 * labelBand + markY;
  const colX = (c: number) => left + cardW / 2 + COLS[c]!;
  const rowY = (r: number) => row0 + r * rowPitch;

  const elements: Element[] = techHeader(
    left,
    top,
    spanW,
    'Plateful on AWS · eu-west-2',
    'Traffic runs left to right; dashed lines are the control plane. Groups nest the way AWS scopes them: edge, region, VPC, subnet.',
  );

  // Tile + card geometry, so the frames can be fitted around them.
  const tileTop = (r: number) => rowY(r) - markY;
  const tileBottom = (r: number) => tileTop(r) + tileH;
  const tileL = (c: number) => colX(c) - tileW / 2;
  const tileR = (c: number) => colX(c) + tileW / 2;

  // Groups first so they paint under the tiles. Labels sit top-left, the
  // AWS convention. Frames stay unfilled so the tiles' theme-owned captions
  // read on any canvas; the border colour and weight tell the levels apart.
  const frame = (
    label: string,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    style: Partial<Node>,
  ): Node => ({
    ...createShape('frame', x0, y0),
    width: x1 - x0,
    height: y1 - y0,
    label,
    textSize: 'sm',
    textAlignX: 'left',
    ...style,
  });
  const regionTop = tileTop(0) - 2 * labelBand;
  // Two-line subnet labels (kind, then CIDR) stay narrow enough that the
  // vertical SQL edge down the VPC's middle never crosses them.
  const subnetHalfW = 146;
  const vpcHalfW = 162;
  const subnet = (cidr: string, r: number) =>
    frame(
      `Private subnet\n${cidr}`,
      colX(3) - subnetHalfW,
      tileTop(r) - labelBand,
      colX(3) + subnetHalfW,
      tileBottom(r) + 8,
      {
        strokeColor: GROUP.subnet,
        textColor: GROUP.subnet,
      },
    );
  elements.push(
    frame('Edge · global', tileL(1) - pad, regionTop, tileR(1) + pad, tileBottom(1) + pad, {
      strokeColor: GROUP.edge,
      textColor: GROUP.edge,
      strokeStyle: 'dashed',
    }),
    frame(
      'AWS Cloud · eu-west-2 (London)',
      tileL(2) - pad,
      regionTop,
      tileR(6) + pad,
      tileBottom(2) + pad + 14,
      {
        strokeColor: GROUP.region,
        textColor: GROUP.region,
        strokeStyle: 'dashed',
        strokeWidth: 'thick',
      },
    ),
    frame(
      'VPC · 10.0.0.0/16',
      colX(3) - vpcHalfW,
      tileTop(1) - 2 * labelBand,
      colX(3) + vpcHalfW,
      tileBottom(2) + pad - 4,
      { strokeColor: GROUP.vpc, textColor: GROUP.vpc, strokeWidth: 'thick' },
    ),
    subnet('10.0.1.0/24', 1),
    subnet('10.0.2.0/24', 2),
  );

  const tile = (label: string, iconId: string, col: number, row: number): Node => ({
    ...createShape('icon', colX(col) - tileW / 2, tileTop(row)),
    width: tileW,
    height: tileH,
    label,
    iconId,
    textSize: 'sm',
    // Technology marks keep a fixed size, so the box may be wider than tall.
    aspectLocked: false,
  });
  const card = (label: string, iconId: string, col: number, row: number): Node => ({
    ...createShape('square', colX(col) - cardW / 2, rowY(row) - cardH / 2),
    width: cardW,
    height: cardH,
    label,
    iconId,
    iconPosition: 'left',
    textSize: 'sm',
  });

  const customer = card('Customer app', 'smartphone', 0, 1);
  const dns = tile('DNS\nRoute 53', 'aws-route53', 1, 0);
  const cdn = tile('CDN\nCloudFront', 'aws-cloudfront', 1, 1);
  const api = tile('Public API\nAPI Gateway', 'aws-apigateway', 2, 1);
  const photos = tile('Menu photos\nS3', 'aws-s3', 2, 2);
  const orders = tile('Orders service\nECS Fargate', 'aws-ecs', 3, 1);
  const db = tile('Orders DB\nRDS Postgres', 'aws-rds', 3, 2);
  const metrics = tile('Metrics + alarms\nCloudWatch', 'aws-cloudwatch', 4, 0);
  const queue = tile('order-events\nSQS', 'aws-sqs', 4, 1);
  const dispatch = tile('Dispatch\nLambda', 'aws-lambda', 5, 1);
  const locations = tile('Courier locations\nDynamoDB', 'aws-dynamodb', 5, 2);
  const push = tile('Push\nSNS', 'aws-sns', 6, 1);
  const kitchen = card('Kitchen tablet', 'monitor', 7, 0);
  const courier = card('Courier app', 'map-pin', 7, 2);
  elements.push(
    customer,
    dns,
    cdn,
    api,
    photos,
    orders,
    db,
    metrics,
    queue,
    dispatch,
    locations,
    push,
    kitchen,
    courier,
  );

  // `at` pins a label along its line (0..1) where the midpoint would land on
  // a group border: on the free side of the border it crosses.
  const edge = (
    from: Node,
    fromA: Anchor,
    to: Node,
    toA: Anchor,
    label: string,
    opts: { angled?: boolean; control?: boolean; at?: number } = {},
  ): Element => ({
    ...createPinnedArrow(from.id, fromA, to.id, toA),
    label,
    ...(opts.angled ? { arrowStyle: 'angled' as const } : {}),
    ...(opts.control ? { strokeStyle: 'dashed' as const } : {}),
    ...(opts.at !== undefined ? { labelOffset: { t: opts.at, offset: 0 } } : {}),
  });
  elements.push(
    edge(customer, 'e', cdn, 'w', 'HTTPS', { at: 0.3 }),
    edge(dns, 's', cdn, 'n', 'alias', { control: true }),
    edge(cdn, 'e', api, 'w', '/api/*'),
    edge(cdn, 's', photos, 'w', 'images', { angled: true }),
    edge(api, 'e', orders, 'w', 'VPC link', { at: 0.3 }),
    edge(orders, 's', db, 'n', 'SQL', { at: 0.28 }),
    edge(orders, 'e', queue, 'w', 'OrderPlaced', { at: 0.7 }),
    edge(queue, 'n', metrics, 's', 'queue depth', { control: true }),
    edge(queue, 'e', dispatch, 'w', 'trigger'),
    edge(dispatch, 'n', metrics, 'e', 'logs', { angled: true, control: true }),
    edge(dispatch, 's', locations, 'n', 'nearest courier'),
    edge(dispatch, 'e', push, 'w', 'notify'),
    edge(push, 'n', kitchen, 'w', 'new order', { angled: true, at: 0.25 }),
    edge(push, 's', courier, 'w', 'job offer', { angled: true, at: 0.25 }),
  );

  return elements;
}
