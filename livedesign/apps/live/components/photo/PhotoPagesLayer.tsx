'use client';

// The photo pages' pictures on their sheets (docs/specs/031-photo/photo-pages.md "Limits" Memory): the
// page in focus drawn live from its pixels (PhotoSurface), every other photo page its preview, and a
// photo with no preview yet the checkerboard with a picture glyph. Under the elements, as the sheets
// are.
import { lucideImage } from '@livedesign/icons/lucide';
import { lucideGlyph } from '@livedesign/ui';
import type { LaidOutPage } from '@livedesign/document';
import { PREVIEW_CHECKER } from '@/components/dialogs/ImageExportPanel';
import type { PhotoEditorView } from '@/hooks/editor/usePhotoEditor';
import { PhotoSurface } from './PhotoSurface';
import { usePhotoPreviewUrl } from './usePhotoPreviewUrl';

const PictureGlyph = lucideGlyph(lucideImage, 32);

function PhotoPreview({
  page,
  photo,
  tabId,
  previewId,
}: {
  page: LaidOutPage;
  photo: PhotoEditorView;
  tabId: string;
  previewId: string | undefined;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const url = usePhotoPreviewUrl(photo.scope, tabId, previewId, (id) => photo.store?.ownBlob(id));
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ background: PREVIEW_CHECKER }}
    >
      {url ? (
        <img src={url} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          {page.rect.width > 120 ? <PictureGlyph /> : null}
        </div>
      )}
    </div>
  );
}

export function PhotoPagesLayer({
  pages,
  photo,
  zoom,
  viewKey,
}: {
  pages: readonly LaidOutPage[];
  photo: PhotoEditorView;
  zoom: number;
  viewKey: unknown;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  return (
    <>
      {pages
        .filter((p) => p.kind === 'photo')
        .map((page) => {
          const live = photo.focusId === page.id && photo.session?.pageId === page.id;
          return (
            <div
              key={page.id}
              data-photo-page={page.id}
              className="pointer-events-none absolute"
              style={{
                left: page.rect.x,
                top: page.rect.y,
                width: page.rect.width,
                height: page.rect.height,
              }}
            >
              <PhotoPreview
                page={page}
                photo={photo}
                tabId={photo.tabId}
                previewId={photo.photos[page.id]?.preview}
              />
              {live ? (
                <PhotoSurface page={page} session={photo.session!} zoom={zoom} viewKey={viewKey} />
              ) : null}
            </div>
          );
        })}
    </>
  );
}
