// The photo editor's working parts, loaded only once a tab has a photo page (docs/specs/016-platform/
// web-performance.md): the editing session, the pixel store, the previews, starting a photo, placing
// pictures, drawing an element into pixels and the command palette's photo commands. The editor's hook holds this module once it arrives,
// so a design without a photo page never downloads the pixel engine.
export { PhotoSession } from './session';
export { apiFetcher, PixelsStore } from './pixels-store';
export { encodePreview, previewRaster } from './preview';
export { readPicture, startFromPicture, startFromPsd } from './start-photo';
export { placePicture } from './layer-ops';
export { elementPixels } from './rasterize-element';
export { photoCommandItems, runPhotoCommand } from './photo-commands';
export { announceCommit, watchSelection } from './photo-announce';

export type PhotoRuntime = typeof import('./runtime');
