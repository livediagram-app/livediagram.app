// How many pictures one inline preview draws (docs/specs/015-api/mcp-server.md §5 "Image-element embedding"), shared
// by a tab's preview and list_images' contact sheet, which is drawn by the same preview. resvg decodes every picture
// at full size and holds them all while it draws, about 4 bytes a pixel on top of about 28 MB for a 2048 px preview,
// and its wasm memory never shrinks. Measured: one 2880x1800 screenshot 49 MB, four 112 MB, a flat 8000x8000 PNG
// (0.19 MB on disk) 461 MB. A Worker has 128 MB in all, so a preview past the budget would fail the tool call after
// its write was saved. Time is the smaller cost: 0.02 to 0.15 s a megapixel.

// The longest side an inline preview is drawn at: 2048 px holds a large board legibly, while a raw
// render sized to the board's bounds (8000 px measured 586 MB) would exceed a Worker's 128 MB and fail
// the tool call after its write was saved. Safe range: 1024 to 4096.
export const PREVIEW_MAX_SIDE_PX = 2048;

// The pictures' pixels together: one full-screen retina screenshot (5.2 MP) or several ordinary ones, at most about
// 32 MB decoded. Safe range: 4 to 12 million.
export const PREVIEW_IMAGE_BUDGET_PIXELS = 8_000_000;

// The pictures' bytes together, which the drawing carries inline as base64 (a third larger) into resvg's memory as
// well. Safe range: 2 to 8 MB.
export const PREVIEW_IMAGE_BUDGET_BYTES = 6 * 1024 * 1024;

// Any one picture: above this it keeps its placeholder whatever the budget has left. Safe range: 1 to 4 MB.
export const PREVIEW_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

// The line a preview carries when it drew some pictures as placeholders to stay within the budget, so the model
// does not take a placeholder for a failed placement and place the picture again.
export function previewLeftOutNote(count: number): string {
  const pictures = count === 1 ? '1 picture is' : `${count} pictures are`;
  return `${pictures} drawn as a placeholder in this preview, which draws only so many pixels; the document holds them as placed, and the editor shows them.`;
}
