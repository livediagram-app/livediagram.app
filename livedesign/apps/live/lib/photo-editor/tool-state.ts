// Each person's photo tools (docs/specs/031-photo/photo-pages.md "The photo tools", "The options flyout";
// photo-tools.md): the tool in hand, each group's last tool, every tool's options and the colours,
// kept in this browser. A small store the rail, the options flyout and the canvas read together.
import { useSyncExternalStore } from 'react';
import type { BlendMode, Gradient, GradientStyle } from '@livedesign/photo-engine';

export type PhotoToolId =
  | 'move'
  | 'rect-select'
  | 'ellipse-select'
  | 'lasso'
  | 'polygon-lasso'
  | 'magnetic-lasso'
  | 'quick-select'
  | 'magic-wand'
  | 'crop'
  | 'eyedropper'
  | 'spot-heal'
  | 'heal'
  | 'red-eye'
  | 'brush'
  | 'pencil'
  | 'clone'
  | 'eraser'
  | 'background-eraser'
  | 'gradient'
  | 'bucket'
  | 'blur'
  | 'sharpen'
  | 'smudge'
  | 'dodge'
  | 'burn'
  | 'sponge'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'line';

export type ToolGroup = { id: string; name: string; tools: PhotoToolId[] };

export const TOOL_GROUPS: readonly ToolGroup[] = [
  { id: 'move', name: 'Move', tools: ['move'] },
  { id: 'marquee', name: 'Marquee', tools: ['rect-select', 'ellipse-select'] },
  { id: 'lasso', name: 'Lasso', tools: ['lasso', 'polygon-lasso', 'magnetic-lasso'] },
  { id: 'smart', name: 'Smart Select', tools: ['quick-select', 'magic-wand'] },
  { id: 'crop', name: 'Crop', tools: ['crop'] },
  { id: 'eyedropper', name: 'Eyedropper', tools: ['eyedropper'] },
  { id: 'brush', name: 'Brush', tools: ['brush', 'pencil'] },
  { id: 'eraser', name: 'Eraser', tools: ['eraser', 'background-eraser'] },
  { id: 'fill', name: 'Fill', tools: ['gradient', 'bucket'] },
  { id: 'heal', name: 'Heal', tools: ['spot-heal', 'heal', 'red-eye'] },
  { id: 'clone', name: 'Clone', tools: ['clone'] },
  { id: 'focus', name: 'Focus', tools: ['blur', 'sharpen', 'smudge'] },
  { id: 'tone', name: 'Tone', tools: ['dodge', 'burn', 'sponge'] },
  { id: 'type', name: 'Type', tools: ['text'] },
  { id: 'shape', name: 'Shape', tools: ['rectangle', 'ellipse', 'line'] },
];

/** The photo tools' categories, in the strip's order, a divider between each (photo-pages.md "The photo tools"). */
export type ToolCategory = { id: string; name: string; groups: readonly string[] };
export const TOOL_CATEGORIES: readonly ToolCategory[] = [
  { id: 'select', name: 'Select', groups: ['move', 'marquee', 'lasso', 'smart'] },
  { id: 'crop-sample', name: 'Crop and Sample', groups: ['crop', 'eyedropper'] },
  { id: 'paint', name: 'Paint', groups: ['brush', 'eraser', 'fill'] },
  { id: 'retouch', name: 'Retouch', groups: ['heal', 'clone', 'focus', 'tone'] },
  { id: 'type-shapes', name: 'Type and Shapes', groups: ['type', 'shape'] },
];

export const TOOL_NAMES: Record<PhotoToolId, string> = {
  move: 'Move',
  'rect-select': 'Rectangle Select',
  'ellipse-select': 'Ellipse Select',
  lasso: 'Lasso',
  'polygon-lasso': 'Polygon Lasso',
  'magnetic-lasso': 'Magnetic Lasso',
  'quick-select': 'Quick Select',
  'magic-wand': 'Magic Wand',
  crop: 'Crop',
  eyedropper: 'Eyedropper',
  'spot-heal': 'Spot Heal',
  heal: 'Heal',
  'red-eye': 'Red Eye',
  brush: 'Brush',
  pencil: 'Pencil',
  clone: 'Clone Stamp',
  eraser: 'Eraser',
  'background-eraser': 'Background Eraser',
  gradient: 'Gradient',
  bucket: 'Paint Bucket',
  blur: 'Blur',
  sharpen: 'Sharpen',
  smudge: 'Smudge',
  dodge: 'Dodge',
  burn: 'Burn',
  sponge: 'Sponge',
  text: 'Text',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
};

/** A group's shortcut key (photo-pages.md "The photo tools"). */
export const GROUP_KEYS: Record<string, string> = {
  move: 'v',
  marquee: 'm',
  lasso: 'l',
  smart: 'w',
  crop: 'c',
  eyedropper: 'i',
  heal: 'j',
  brush: 'b',
  clone: 's',
  eraser: 'e',
  fill: 'g',
  focus: 'r',
  tone: 'o',
  type: 't',
  shape: 'u',
};

export const groupOf = (tool: PhotoToolId): ToolGroup =>
  TOOL_GROUPS.find((g) => g.tools.includes(tool))!;

export type SelectMode = 'new' | 'add' | 'subtract' | 'intersect';
export type PressureUse = 'size' | 'opacity' | 'both' | 'off';

export type BrushOptions = {
  size: number;
  hardness: number;
  opacity: number;
  flow: number;
  spacing: number;
  smoothing: number;
  mode: BlendMode | 'behind' | 'clear';
  pressure: PressureUse;
};

export type ToolOptions = {
  brush: BrushOptions;
  pencil: BrushOptions & { autoErase: boolean; square: boolean };
  eraser: BrushOptions & { eraserMode: 'brush' | 'pencil' | 'block' };
  clone: BrushOptions & { aligned: boolean; sampleAll: boolean };
  heal: BrushOptions & { aligned: boolean; sampleAll: boolean };
  spotHeal: { size: number; hardness: number; proximity: boolean };
  redEye: { pupil: number; darken: number };
  backgroundEraser: BrushOptions & {
    tolerance: number;
    continuous: boolean;
    contiguous: boolean;
    protect: boolean;
  };
  focus: BrushOptions & { strength: number; protectDetail: boolean; fingerPainting: boolean };
  tone: BrushOptions & {
    range: 'shadows' | 'midtones' | 'highlights';
    exposure: number;
    protectTones: boolean;
    saturate: boolean;
    vibrance: boolean;
  };
  select: {
    mode: SelectMode;
    feather: number;
    antiAlias: boolean;
    style: 'normal' | 'ratio' | 'size';
    ratioW: number;
    ratioH: number;
    sizeW: number;
    sizeH: number;
  };
  magnetic: { width: number; contrast: number; frequency: number };
  wand: { tolerance: number; contiguous: boolean; sampleAll: boolean };
  quick: { size: number; sampleAll: boolean; autoEnhance: boolean };
  crop: {
    ratio: 'free' | 'original' | '1:1' | '4:5' | '3:2' | '16:9' | '9:16';
    deletePixels: boolean;
  };
  eyedropper: { sample: 1 | 3 | 5 | 11 | 31; sampleAll: boolean };
  bucket: {
    tolerance: number;
    contiguous: boolean;
    antiAlias: boolean;
    sampleAll: boolean;
    mode: BlendMode;
    opacity: number;
  };
  gradient: {
    style: GradientStyle;
    gradient: Gradient;
    reverse: boolean;
    dither: boolean;
    mode: BlendMode;
    opacity: number;
  };
  text: {
    font: string;
    size: number;
    weight: 400 | 500 | 700;
    italic: boolean;
    align: 'left' | 'centre' | 'right';
    lineHeight: number;
    tracking: number;
  };
  shape: {
    fill: boolean;
    stroke: boolean;
    strokeWidth: number;
    radius: number;
    startArrow: boolean;
    endArrow: boolean;
    antiAlias: boolean;
    intoActive: boolean;
  };
  move: { autoSelect: boolean };
};

const BRUSH: BrushOptions = {
  size: 30,
  hardness: 0.8,
  opacity: 1,
  flow: 1,
  spacing: 0.1,
  smoothing: 0.1,
  mode: 'normal',
  pressure: 'size',
};

export const DEFAULT_OPTIONS: ToolOptions = {
  brush: BRUSH,
  pencil: { ...BRUSH, size: 1, hardness: 1, autoErase: false, square: false, smoothing: 0 },
  eraser: { ...BRUSH, eraserMode: 'brush' },
  clone: { ...BRUSH, aligned: true, sampleAll: false },
  heal: { ...BRUSH, hardness: 1, aligned: true, sampleAll: false },
  spotHeal: { size: 40, hardness: 1, proximity: false },
  redEye: { pupil: 0.5, darken: 0.5 },
  backgroundEraser: {
    ...BRUSH,
    hardness: 1,
    tolerance: 50,
    continuous: true,
    contiguous: true,
    protect: false,
  },
  focus: {
    ...BRUSH,
    size: 40,
    hardness: 0.5,
    strength: 0.5,
    protectDetail: true,
    fingerPainting: false,
  },
  tone: {
    ...BRUSH,
    size: 60,
    hardness: 0.3,
    range: 'midtones',
    exposure: 0.5,
    protectTones: true,
    saturate: false,
    vibrance: true,
  },
  select: {
    mode: 'new',
    feather: 0,
    antiAlias: true,
    style: 'normal',
    ratioW: 1,
    ratioH: 1,
    sizeW: 64,
    sizeH: 64,
  },
  magnetic: { width: 10, contrast: 0.1, frequency: 57 },
  wand: { tolerance: 32, contiguous: true, sampleAll: false },
  quick: { size: 30, sampleAll: false, autoEnhance: true },
  crop: { ratio: 'free', deletePixels: true },
  eyedropper: { sample: 1, sampleAll: true },
  bucket: {
    tolerance: 32,
    contiguous: true,
    antiAlias: true,
    sampleAll: false,
    mode: 'normal',
    opacity: 1,
  },
  gradient: {
    style: 'linear',
    gradient: {
      colours: [
        { at: 0, colour: '#000000' },
        { at: 1, colour: '#ffffff' },
      ],
      opacities: [
        { at: 0, opacity: 1 },
        { at: 1, opacity: 1 },
      ],
    },
    reverse: false,
    dither: true,
    mode: 'normal',
    opacity: 1,
  },
  text: {
    font: 'inter',
    size: 72,
    weight: 700,
    italic: false,
    align: 'left',
    lineHeight: 1.2,
    tracking: 0,
  },
  shape: {
    fill: true,
    stroke: false,
    strokeWidth: 4,
    radius: 0,
    startArrow: false,
    endArrow: false,
    antiAlias: true,
    intoActive: true,
  },
  move: { autoSelect: true },
};

/** Which options a tool reads. */
export function optionsKey(tool: PhotoToolId): keyof ToolOptions {
  switch (tool) {
    case 'brush':
      return 'brush';
    case 'pencil':
      return 'pencil';
    case 'eraser':
      return 'eraser';
    case 'background-eraser':
      return 'backgroundEraser';
    case 'clone':
      return 'clone';
    case 'heal':
      return 'heal';
    case 'spot-heal':
      return 'spotHeal';
    case 'red-eye':
      return 'redEye';
    case 'blur':
    case 'sharpen':
    case 'smudge':
      return 'focus';
    case 'dodge':
    case 'burn':
    case 'sponge':
      return 'tone';
    case 'rect-select':
    case 'ellipse-select':
    case 'lasso':
    case 'polygon-lasso':
      return 'select';
    case 'magnetic-lasso':
      return 'magnetic';
    case 'magic-wand':
      return 'wand';
    case 'quick-select':
      return 'quick';
    case 'crop':
      return 'crop';
    case 'eyedropper':
      return 'eyedropper';
    case 'bucket':
      return 'bucket';
    case 'gradient':
      return 'gradient';
    case 'text':
      return 'text';
    case 'rectangle':
    case 'ellipse':
    case 'line':
      return 'shape';
    case 'move':
      return 'move';
  }
}

export type PhotoToolState = {
  // The tool in hand; null when the canvas's own pointer is.
  tool: PhotoToolId | null;
  // Each group's last tool.
  lastInGroup: Record<string, PhotoToolId>;
  options: ToolOptions;
  foreground: string;
  background: string;
};

const STORAGE_KEY = 'livedesign:photo-tools';
// The saved shape's version: 2 forgets Move's Auto-Select saved off before it defaulted on; 3 forgets a shape's
// Draw Into Active Layer saved off before it defaulted on.
const STORAGE_VERSION = 3;

const INITIAL: PhotoToolState = {
  tool: null,
  lastInGroup: Object.fromEntries(TOOL_GROUPS.map((g) => [g.id, g.tools[0]!])),
  options: DEFAULT_OPTIONS,
  foreground: '#000000',
  background: '#ffffff',
};

function load(): PhotoToolState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const v = JSON.parse(raw) as Partial<PhotoToolState> & { version?: number };
    // Before version 2 every save carried Move's Auto-Select off, its old default: forgotten, so the new default holds.
    const kept = v.options as
      { move?: { autoSelect?: boolean }; shape?: { intoActive?: boolean } } | undefined;
    if ((v.version ?? 1) < 2) delete kept?.move?.autoSelect;
    if ((v.version ?? 1) < 3) delete kept?.shape?.intoActive;
    // Each tool's options merged over the defaults, so a new option has its default.
    const options = Object.fromEntries(
      Object.entries(DEFAULT_OPTIONS).map(([k, d]) => [
        k,
        { ...d, ...((v.options as Record<string, object> | undefined)?.[k] ?? {}) },
      ]),
    ) as ToolOptions;
    const hex = (c: unknown, d: string) =>
      typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : d;
    return {
      tool: null,
      lastInGroup: { ...INITIAL.lastInGroup, ...(v.lastInGroup ?? {}) },
      options,
      foreground: hex(v.foreground, INITIAL.foreground),
      background: hex(v.background, INITIAL.background),
    };
  } catch {
    return INITIAL;
  }
}

let state: PhotoToolState | null = null;
const listeners = new Set<() => void>();

function current(): PhotoToolState {
  state ??= load();
  return state;
}

function save(): void {
  try {
    const { tool: _t, ...rest } = current();
    void _t;
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...rest, version: STORAGE_VERSION }),
    );
  } catch {
    // A full or blocked store: the tools still work for the session.
  }
}

export const photoTools = {
  get: current,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(patch: Partial<PhotoToolState>): void {
    state = { ...current(), ...patch };
    save();
    for (const fn of listeners) fn();
  },
  /** A tool taken in hand (or put down with null); its group remembers it. */
  take(tool: PhotoToolId | null): void {
    const s = current();
    this.set({
      tool,
      ...(tool ? { lastInGroup: { ...s.lastInGroup, [groupOf(tool).id]: tool } } : {}),
    });
  },
  setOptions<K extends keyof ToolOptions>(key: K, patch: Partial<ToolOptions[K]>): void {
    const s = current();
    this.set({ options: { ...s.options, [key]: { ...s.options[key], ...patch } } });
  },
  resetOptions(key: keyof ToolOptions): void {
    const s = current();
    this.set({ options: { ...s.options, [key]: DEFAULT_OPTIONS[key] } });
  },
  swapColours(): void {
    const s = current();
    this.set({ foreground: s.background, background: s.foreground });
  },
  resetColours(): void {
    this.set({ foreground: '#000000', background: '#ffffff' });
  },
};

export function usePhotoTools(): PhotoToolState {
  return useSyncExternalStore(
    (fn) => photoTools.subscribe(fn),
    current,
    () => INITIAL,
  );
}
