// A photo page's tools in the palette strip (docs/specs/031-photo/photo-pages.md "The photo tools",
// docs/specs/007-editor/toolbar-layout.md): while one is in focus, for someone who may edit it, the tool groups
// and colours in place of the strip's categories; for a Participant, the Eyedropper and colours at its end. Not on
// a phone (its tools row, PhotoChrome), and not while the chrome is away: hidden, the strip stays mounted, and the
// tools on it would say they are on screen (rail-shown) behind a visitor's Join prompt. Picking a selection mode
// puts the photo tool down.
import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import type { CanvasTool } from '@/components/palette/palette.types';
import { loadPhotoTools } from '@/lib/editor-deferred-code';
import { photoTools } from '@/lib/photo-editor/tool-state';

const PhotoTools = dynamic(loadPhotoTools, { ssr: false });

export function usePhotoStripTools({
  photo,
  isMobile,
  chromeHidden,
  onSetCanvasTool,
}: {
  photo: PhotoEditorView | undefined;
  isMobile: boolean;
  chromeHidden: boolean;
  onSetCanvasTool: (tool: CanvasTool) => void;
}) {
  const live = !!photo?.session && photo.canEdit;
  const inspect = !!photo?.session && !photo.canEdit && photo.canInspect;
  const shown = (live || inspect) && !isMobile && !chromeHidden;
  const setCanvasTool = useCallback(
    (tool: CanvasTool) => {
      if (photoTools.get().tool !== null) photoTools.take(null);
      onSetCanvasTool(tool);
    },
    [onSetCanvasTool],
  );
  return {
    stripTools: shown
      ? {
          node: <PhotoTools placement="strip" inspect={!live} />,
          inPlaceOfCategories: live,
        }
      : null,
    onSetCanvasTool: setCanvasTool,
  };
}
