'use client';

import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import {
  EMPTY_CARD_VIEWER_LINE,
  EmptyCanvasCard,
} from '@liveworkspace/workbench/components/canvas/EmptyCanvasCard';
import { EmptyCanvasArt } from './EmptyCanvasArt';

// livehuddle's empty-canvas card (docs/specs/007-editor/new-document-route.md "The empty-canvas hint"): the card every
// editor shares (@liveworkspace/workbench EmptyCanvasCard) with a session board's picture. A viewer reads the passive
// line, and so does a Participant, who adds nothing (share-roles.md); an Editor is pointed at the Palette, with Help
// on a desktop. An Editor's empty tab otherwise shows its start (start-diagramming.md).
export function EmptyCanvasBanner({
  tabId,
  tabName,
  readOnly,
}: {
  tabId: string;
  tabName: string;
  readOnly: boolean;
}) {
  return (
    <EmptyCanvasCard
      tabId={tabId}
      tabName={tabName}
      art={<EmptyCanvasArt />}
      line={readOnly ? EMPTY_CARD_VIEWER_LINE : 'Add an element from the Palette to get it going.'}
      help={readOnly ? undefined : <HelpArticleLink article="yourFirstSpace" variant="button" />}
    />
  );
}
