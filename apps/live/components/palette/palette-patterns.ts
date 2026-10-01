import type { ReactElement } from 'react';
import { type BackgroundPattern } from '@livediagram/document';
import {
  BackgroundAuroraIcon,
  BackgroundBlankIcon,
  BackgroundBricksIcon,
  BackgroundConfettiIcon,
  BackgroundCheckerboardIcon,
  BackgroundCrosshatchIcon,
  BackgroundDiagonalIcon,
  BackgroundDriftIcon,
  BackgroundEngineeringIcon,
  BackgroundFlowIcon,
  BackgroundGraphIcon,
  BackgroundGridIcon,
  BackgroundHexagonalIcon,
  BackgroundIsometricIcon,
  BackgroundLinesIcon,
  BackgroundRibbonsIcon,
  BackgroundRippleIcon,
  BackgroundStripesIcon,
  BackgroundWavesIcon,
} from '@/components/primitives/background-pattern-icons';

// The canvas background-pattern catalogue: one PatternEntry per pattern,
// consumed by the pattern picker (CanvasStyleControls / CustomThemeBuilder)
// and useTabCanvas. Pure data — the picker UI has no hard-coded ids, so a
// new pattern slots in by editing this list. Split out of palette-controls.
export type PatternEntry = {
  id: BackgroundPattern;
  label: string;
  shortLabel: string;
  description: string;
  icon: () => ReactElement;
  extra?: boolean;
};

export const PATTERNS: PatternEntry[] = [
  {
    id: 'grid',
    label: 'Grid',
    shortLabel: 'Grid',
    description: 'Subtle dot grid background.',
    icon: BackgroundGridIcon,
  },
  {
    id: 'blank',
    label: 'Blank',
    shortLabel: 'Blank',
    description: 'No background pattern.',
    icon: BackgroundBlankIcon,
  },
  {
    id: 'lines',
    label: 'Lines',
    shortLabel: 'Lines',
    description: 'Horizontal ruled lines.',
    icon: BackgroundLinesIcon,
  },
  {
    id: 'graph',
    label: 'Graph',
    shortLabel: 'Graph',
    description: 'Square graph paper.',
    icon: BackgroundGraphIcon,
  },
  {
    id: 'crosshatch',
    label: 'Crosshatch',
    shortLabel: 'Cross',
    description: 'Diagonal crosshatch pattern.',
    icon: BackgroundCrosshatchIcon,
  },
  {
    id: 'confetti',
    label: 'Confetti',
    shortLabel: 'Confetti',
    description: 'Multi-colour dots; pattern colour ignored.',
    icon: BackgroundConfettiIcon,
  },
  {
    id: 'stripes',
    label: 'Stripes',
    shortLabel: 'Stripes',
    description: 'Vertical ruled lines.',
    icon: BackgroundStripesIcon,
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    shortLabel: 'Diagonal',
    description: 'Single-direction 45° lines.',
    icon: BackgroundDiagonalIcon,
  },
  {
    id: 'waves',
    label: 'Waves',
    shortLabel: 'Waves',
    description: 'Gentle sinusoidal lines, softest of the textures.',
    extra: true,
    icon: BackgroundWavesIcon,
  },
  {
    id: 'bricks',
    label: 'Bricks',
    shortLabel: 'Bricks',
    description: 'Offset masonry brickwork.',
    extra: true,
    icon: BackgroundBricksIcon,
  },
  {
    id: 'isometric',
    label: 'Isometric',
    shortLabel: 'Iso',
    description: 'Isometric rhombic grid for 3D / technical diagrams.',
    extra: true,
    icon: BackgroundIsometricIcon,
  },
  {
    id: 'checkerboard',
    label: 'Checkerboard',
    shortLabel: 'Check',
    description: 'Alternating filled squares.',
    extra: true,
    icon: BackgroundCheckerboardIcon,
  },
  {
    id: 'hexagonal',
    label: 'Hexagonal',
    shortLabel: 'Hex',
    description: 'Honeycomb grid for hex maps and cell layouts.',
    extra: true,
    icon: BackgroundHexagonalIcon,
  },
  {
    id: 'engineering',
    label: 'Engineering',
    shortLabel: 'Eng',
    description: 'Graph paper with bold major gridlines every 5 cells.',
    extra: true,
    icon: BackgroundEngineeringIcon,
  },
  {
    id: 'flow',
    label: 'Flow',
    shortLabel: 'Flow',
    description: 'Animated: streaming diagonal lines.',
    extra: true,
    icon: BackgroundFlowIcon,
  },
  {
    id: 'drift',
    label: 'Drift',
    shortLabel: 'Drift',
    description: 'Animated: softly rising motes.',
    extra: true,
    icon: BackgroundDriftIcon,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    shortLabel: 'Aurora',
    description: 'Animated: slowly drifting colour glows.',
    extra: true,
    icon: BackgroundAuroraIcon,
  },
  {
    id: 'ripple',
    label: 'Ripple',
    shortLabel: 'Ripple',
    description: 'Animated: gentle expanding rings.',
    extra: true,
    icon: BackgroundRippleIcon,
  },
  {
    id: 'ribbons',
    label: 'Ribbons',
    shortLabel: 'Ribbons',
    description: 'Animated: thick curved lines that flow (theme-coloured).',
    extra: true,
    icon: BackgroundRibbonsIcon,
  },
];
