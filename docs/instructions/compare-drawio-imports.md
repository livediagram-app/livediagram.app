# Compare draw.io imports

How to see, page by page, what a draw.io file looks like in draw.io and after the import.

1. Keep real diagrams outside the repo; they are personal content and never become fixtures or PR images.
2. Fetch the latest draw.io desktop AppImage from `jgraph/drawio-desktop` releases into a temporary folder.
3. Extract it (`./drawio.AppImage --appimage-extract`) so the binary runs headless as `squashfs-root/drawio`.
4. Check `xvfb-run` exists; draw.io's CLI export needs a display, and `xvfb-run -a` gives it one.
5. Start a live app and api you own (a worktree with its own ports), never another agent's dev server.
6. Run the comparison through PM2 with an `--out` folder in `/tmp`:
   `pnpm --filter @livediagram/live exec tsx scripts/drawio-compare.mts <folder> --out /tmp/drawio-compare --base <live url> --drawio <path>/squashfs-root/drawio`.
7. Pass `--only <slug>` to redo one file after a change; drop `--drawio` when its draw.io renders already exist.
8. Read `drawio-p<n>.png` beside `ld-p<n>.png` for every page; draw.io's CLI numbers pages from 1.
9. Name each difference, find its cause in the importer, and write it into the draw.io import spec before fixing it.
10. Reproduce each difference in a synthetic fixture under `apps/live/lib/drawio/__fixtures__` for its test.
