// A .bpmn file read into its semantic elements and its first diagram's layout (docs/specs/020-import-export/
// bpmn-import.md "Reading the file"). Parsed with the trusted-types inert parse, never rendered; one pass over the
// elements, maps by id, so the work is linear in the file.

import { parseInert } from '@livediagram/ui/trusted-types';
import { BPMN_MAX_FILE_BYTES, BPMN_MAX_XML_ELEMENTS } from './limits';

export type Bounds = { x: number; y: number; width: number; height: number };
export type Pt = { x: number; y: number };

/** A semantic element: what it is, its name and the parts of it the mapping reads. */
export type BpmnNode = {
  id: string;
  /** Its element name without the prefix: `startEvent`, `userTask`, `sequenceFlow`, ... */
  type: string;
  name: string;
  /** The local names of its event definitions (`messageEventDefinition`, ...). */
  definitions: string[];
  /** A flow's ends: the attributes, else the child elements a data association carries. */
  sourceRef?: string;
  targetRef?: string;
  /** The activity a data association hangs under. */
  parentId?: string;
  /** An association's `associationDirection`. */
  direction?: string;
  /** A group's category value. */
  categoryValueRef?: string;
};

export type DiShape = {
  bpmnElement: string;
  bounds: Bounds;
  label?: Bounds;
  expanded: boolean;
  markerVisible: boolean;
  horizontal: boolean;
  fill?: string;
  stroke?: string;
};

export type DiEdge = { bpmnElement: string; waypoints: Pt[]; stroke?: string };

export type BpmnFile = {
  nodes: Map<string, BpmnNode>;
  /** Category values' names, for a group's title. */
  categoryValues: Map<string, string>;
  shapes: DiShape[];
  edges: DiEdge[];
  /** How many diagrams the file has; only the first is drawn. */
  diagrams: number;
};

export class BpmnRefused extends Error {}

export const BPMN_REFUSALS = {
  tooLarge: 'This file is too large to import (the limit is 5 MB).',
  tooComplex: 'This BPMN file is too complex to import (over 100,000 XML elements).',
  notXml: "Couldn't read this BPMN file.",
  notBpmn: "This isn't a BPMN file (expected BPMN 2.0 XML with a definitions element).",
  noDiagram:
    'This BPMN file has no diagram layout to draw. Open it in a modeler and save it with its diagram.',
} as const;

const HEX = /^#[0-9a-f]{3,8}$/i;
const hexOr = (v: string | null | undefined): string | undefined =>
  v && HEX.test(v.trim()) ? v.trim() : undefined;

const num = (el: Element, attr: string): number => {
  const n = Number(el.getAttribute(attr));
  return Number.isFinite(n) ? n : 0;
};

function boundsOf(el: Element | undefined): Bounds | undefined {
  if (!el) return undefined;
  return { x: num(el, 'x'), y: num(el, 'y'), width: num(el, 'width'), height: num(el, 'height') };
}

const childByName = (el: Element, localName: string): Element | undefined => {
  for (const c of Array.from(el.children)) if (c.localName === localName) return c;
  return undefined;
};

// The BPMN in Color colours, under any prefix: `color:background-color` / `color:border-color`, bpmn.io's older
// `bioc:fill` / `bioc:stroke`.
function coloursOf(el: Element): { fill?: string; stroke?: string } {
  let fill: string | undefined;
  let stroke: string | undefined;
  for (const attr of Array.from(el.attributes)) {
    if (attr.localName === 'background-color' || attr.localName === 'fill')
      fill = hexOr(attr.value) ?? fill;
    else if (attr.localName === 'border-color' || attr.localName === 'stroke')
      stroke = hexOr(attr.value) ?? stroke;
  }
  return { ...(fill ? { fill } : {}), ...(stroke ? { stroke } : {}) };
}

// Elements the semantic walk records: everything carrying an id under the definitions, except the DI's own.
const DI_TYPES = new Set(['BPMNDiagram', 'BPMNPlane', 'BPMNShape', 'BPMNEdge', 'BPMNLabel']);

/** The file's elements and its first diagram's layout; throws BpmnRefused with the message to show. */
export function readBpmn(text: string): BpmnFile {
  if (text.length > BPMN_MAX_FILE_BYTES) throw new BpmnRefused(BPMN_REFUSALS.tooLarge);
  const trimmed = text.replace(/^﻿/, '').trim();
  if (!trimmed.startsWith('<')) throw new BpmnRefused(BPMN_REFUSALS.notXml);
  const doc = parseInert(trimmed, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0)
    throw new BpmnRefused(BPMN_REFUSALS.notXml);
  const root = doc.documentElement;
  if (!root || root.localName !== 'definitions') throw new BpmnRefused(BPMN_REFUSALS.notBpmn);
  const all = doc.getElementsByTagName('*');
  if (all.length > BPMN_MAX_XML_ELEMENTS) throw new BpmnRefused(BPMN_REFUSALS.tooComplex);

  const nodes = new Map<string, BpmnNode>();
  const categoryValues = new Map<string, string>();
  const shapes: DiShape[] = [];
  const edges: DiEdge[] = [];
  let diagrams = 0;
  let firstDiagram: Element | undefined;

  for (const el of Array.from(all)) {
    const type = el.localName;
    if (type === 'BPMNDiagram') {
      diagrams += 1;
      firstDiagram ??= el;
      continue;
    }
    if (type === 'categoryValue') {
      const id = el.getAttribute('id');
      if (id) categoryValues.set(id, el.getAttribute('value') ?? '');
      continue;
    }
    if (DI_TYPES.has(type)) continue;
    const id = el.getAttribute('id');
    if (!id) continue;
    const node: BpmnNode = {
      id,
      type,
      name:
        type === 'textAnnotation'
          ? (childByName(el, 'text')?.textContent ?? '')
          : (el.getAttribute('name') ?? ''),
      definitions: Array.from(el.children)
        .map((c) => c.localName)
        .filter((n) => n.endsWith('EventDefinition')),
    };
    const sourceRef =
      el.getAttribute('sourceRef') ?? childByName(el, 'sourceRef')?.textContent?.trim();
    const targetRef =
      el.getAttribute('targetRef') ?? childByName(el, 'targetRef')?.textContent?.trim();
    if (sourceRef) node.sourceRef = sourceRef;
    if (targetRef) node.targetRef = targetRef;
    const parentId = el.parentElement?.getAttribute('id');
    if (parentId) node.parentId = parentId;
    const direction = el.getAttribute('associationDirection');
    if (direction) node.direction = direction;
    const category = el.getAttribute('categoryValueRef');
    if (category) node.categoryValueRef = category;
    nodes.set(id, node);
  }

  if (firstDiagram) {
    for (const el of Array.from(firstDiagram.getElementsByTagName('*'))) {
      const ref = el.getAttribute('bpmnElement');
      if (!ref) continue;
      if (el.localName === 'BPMNShape') {
        const bounds = boundsOf(childByName(el, 'Bounds'));
        if (!bounds) continue;
        const labelEl = childByName(el, 'BPMNLabel');
        const label = labelEl ? boundsOf(childByName(labelEl, 'Bounds')) : undefined;
        shapes.push({
          bpmnElement: ref,
          bounds,
          ...(label && label.width > 0 && label.height > 0 ? { label } : {}),
          expanded: el.getAttribute('isExpanded') === 'true',
          markerVisible: el.getAttribute('isMarkerVisible') === 'true',
          horizontal: el.getAttribute('isHorizontal') !== 'false',
          ...coloursOf(el),
        });
      } else if (el.localName === 'BPMNEdge') {
        const waypoints = Array.from(el.children)
          .filter((c) => c.localName === 'waypoint')
          .map((w) => ({ x: num(w, 'x'), y: num(w, 'y') }));
        const { stroke } = coloursOf(el);
        edges.push({ bpmnElement: ref, waypoints, ...(stroke ? { stroke } : {}) });
      }
    }
  }
  if (shapes.length === 0) throw new BpmnRefused(BPMN_REFUSALS.noDiagram);
  return { nodes, categoryValues, shapes, edges, diagrams };
}
