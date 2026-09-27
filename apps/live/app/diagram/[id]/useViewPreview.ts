import { useState } from 'react';
import type { ShareRole } from '@livediagram/api-schema';

// The role pill's toggle (docs/specs/007-editor/live-app.md#role-pill): someone whose role allows
// editing can preview the diagram read-only. Local to this tab and visit; the
// session role itself, which presence reports, never changes.
export function useViewPreview(sessionRole: ShareRole, onEnterPreview: () => void) {
  const [viewPreview, setViewPreview] = useState(false);
  const canToggleRole = sessionRole === 'edit';
  const toggleViewPreview = () => {
    if (!canToggleRole) return;
    const next = !viewPreview;
    console.info('[role] view preview', next);
    // No edit toolbar or open editor may linger into viewing.
    if (next) onEnterPreview();
    setViewPreview(next);
  };
  return { viewPreview: canToggleRole && viewPreview, canToggleRole, toggleViewPreview };
}
