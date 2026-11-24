// Test helper: the few element kinds Make Plan Cards and the plan's offers read.
import type {
  ArrowElement,
  Element,
  ShapeElement,
  StickyElement,
  TextElement,
} from '@livediagram/document';

type At = { x?: number; y?: number; width?: number; height?: number };

export const box = (
  id: string,
  label: string,
  at: At = {},
  shape: ShapeElement['shape'] = 'square',
): ShapeElement => ({
  id,
  type: 'shape',
  shape,
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  label,
  ...at,
});

export const lane = (id: string, label: string, at: At): ShapeElement => box(id, label, at, 'lane');

export const sticky = (id: string, label: string, at: At = {}): StickyElement => ({
  id,
  type: 'sticky',
  x: 0,
  y: 0,
  width: 160,
  height: 160,
  label,
  ...at,
});

export const text = (id: string, label: string, at: At = {}): TextElement => ({
  id,
  type: 'text',
  x: 0,
  y: 0,
  width: 60,
  height: 20,
  label,
  ...at,
});

export const arrow = (
  id: string,
  from: string,
  to: string,
  over: Partial<ArrowElement> = {},
): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: from, anchor: 'e' },
  to: { kind: 'pinned', elementId: to, anchor: 'w' },
  ...over,
});

export const els = (...xs: Element[]): Element[] => xs;
