'use client';

import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { useEditorModeState } from '@/components/chrome/editor-mode/editor-mode-context';
import {
  EMPTY_CARD_VIEWER_LINE,
  EmptyCanvasCard,
} from '@liveworkspace/workbench/components/canvas/EmptyCanvasCard';
import { EmptyCanvasArt } from './EmptyCanvasArt';

// livediagram's empty-canvas card (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): the card every
// editor shares (@liveworkspace/workbench EmptyCanvasCard) with this product's picture and words. A Viewer reads the
// passive line, a Participant is pointed at what they may add, and an Editor at the Palette, with Help on a desktop.
// An Editor's empty tab otherwise shows its mode's start (start-diagramming.md), where its templates are.
export function EmptyCanvasBanner({
  tabId,
  tabName,
  readOnly,
  participant = false,
}: {
  tabId: string;
  tabName: string;
  readOnly: boolean;
  // A Participant (docs/specs/013-workspace/share-roles.md): read-only, yet it adds stickies, text and images.
  participant?: boolean;
}) {
  // The picture is of what the tab's mode makes (Diagram when no mode is known).
  const mode = useEditorModeState()?.mode ?? 'diagram';
  return (
    <EmptyCanvasCard
      tabId={tabId}
      tabName={tabName}
      art={<EmptyCanvasArt mode={mode} />}
      line={
        participant
          ? 'Nothing here yet. Add a sticky, text or an image from the Palette to get it going.'
          : readOnly
            ? EMPTY_CARD_VIEWER_LINE
            : 'Add an element from the Palette to get it going.'
      }
      help={readOnly ? undefined : <HelpArticleLink article="yourFirstDiagram" variant="button" />}
    />
  );
}
