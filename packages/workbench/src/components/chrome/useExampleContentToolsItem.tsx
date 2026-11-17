'use client';

// Clear Example Content in the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md; blueprint FM8),
// beside the palette's example tray (TemplateExampleTray) in livediagram, livedocuments and livedesign: published
// through the Tools door while the tray shows (the same gate: an Editor, the tab still holding untouched examples), so
// it is there only while it would do something. A press asks first, inside Tools, then runs the tray's own clear.
// Returns the confirm to render while it is asked.
import { useMemo, useState, type ReactNode } from 'react';
import { lucideGlyph } from '@liveworkspace/ui';
import { lucideSparkles } from '@liveworkspace/icons/lucide';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import type { ChromeToolsItem } from './ChromeToolsMenu';
import { usePublishToolsItems } from './tools-door';

const SparklesIcon = lucideGlyph(lucideSparkles, 16);

export const CLEAR_EXAMPLES_TITLE = 'Clear the Examples?';
export const CLEAR_EXAMPLES_MESSAGE =
  'Every example on this tab is emptied. Each element stays where it is, ready for your own content. One undo brings them back.';

export function useExampleContentToolsItem({
  shown,
  onClear,
}: {
  // The tray's own gate (exampleTrayShown and its kin): while false, no row.
  shown: boolean;
  onClear: () => void;
}): ReactNode {
  const [asking, setAsking] = useState(false);
  const rows = useMemo<ChromeToolsItem[]>(
    () =>
      shown
        ? [
            {
              id: 'example-content',
              group: 'content',
              label: 'Clear Example Content',
              description: 'Empty the template’s examples on this tab.',
              icon: <SparklesIcon />,
              inPlace: true,
              onSelect: () => setAsking(true),
            },
          ]
        : [],
    [shown],
  );
  usePublishToolsItems('example-content', rows);
  // The examples went another way (the tray, an undo, another tab): the question goes with them.
  if (asking && !shown) setAsking(false);
  if (!asking || !shown) return null;
  return (
    <ConfirmDialog
      open
      title={CLEAR_EXAMPLES_TITLE}
      message={CLEAR_EXAMPLES_MESSAGE}
      confirmLabel="Clear Example Content"
      cancelLabel="Keep Them"
      onCancel={() => setAsking(false)}
      onConfirm={() => {
        setAsking(false);
        onClear();
      }}
    />
  );
}
