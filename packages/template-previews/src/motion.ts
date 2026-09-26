import type { CSSProperties } from 'react';

// The CSS variables a preview's hover story reads (preview-motion.css), typed
// so the drawings can set them inline without casting at every call site.
type MotionVars = {
  '--pv-at'?: string;
  '--pv-dx'?: string;
  '--pv-dy'?: string;
  '--pv-from-x'?: string;
  '--pv-from-y'?: string;
};

export const pv = (vars: MotionVars): CSSProperties => vars as CSSProperties;

// The story classes preview-motion.css defines. Keep in step with the
// stylesheet: a drawing that uses a class missing here fails
// preview-motion.test.ts, the reminder to add its rule.
export const STORY_CLASSES = [
  'pv-new',
  'pv-arrive',
  'pv-shift',
  'pv-grow-x',
  'pv-pulse',
  'pv-token',
];
