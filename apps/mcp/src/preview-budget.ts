// How large one inline preview is drawn (docs/specs/015-api/mcp-server.md §5). resvg holds the whole drawing while it
// draws, about 28 MB for a 2048 px preview, and its wasm memory never shrinks; a Worker has 128 MB in all.

// The longest side an inline preview is drawn at: 2048 px holds a large board legibly, while a raw
// render sized to the board's bounds (8000 px measured 586 MB) would exceed a Worker's 128 MB and fail
// the tool call after its write was saved. Safe range: 1024 to 4096.
export const PREVIEW_MAX_SIDE_PX = 2048;
