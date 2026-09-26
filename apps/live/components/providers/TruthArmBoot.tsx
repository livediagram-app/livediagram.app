'use client';

import { useEffect } from 'react';
import { armTruthFromUrl } from '@/lib/photo-truth';

// Arms the ground-truth export from `?truth=1`, at app load, on whatever page
// carries the parameter (docs/vision/sticky-detection.md).
//
// It has to be here rather than on the review surface, because the review
// surface is three navigations too late: the editor is reached from /new, and
// by the time a photo is imported and its boxes are on screen the URL is
// /diagram/<id>/ with no parameter on it. Reading it there armed nothing.
//
// Renders nothing, and does nothing at all for an author who has never typed
// the parameter — which is every author, since this is a calibration tool.
export function TruthArmBoot() {
  useEffect(() => {
    armTruthFromUrl(window.location.href);
  }, []);
  return null;
}
