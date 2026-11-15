// livedocuments' page picture Blur worker (docs/specs/007-editor/pages-mode.md "Image backgrounds", Blur): its
// entry, started by the `blurWorker` binding in workbench-bindings.ts. The work is the shared worker side's
// (@liveworkspace/page-background/image-blur-worker): fetch, decode, draw small, blur and encode, off the main thread.
import { serveBlurCopies } from '@liveworkspace/page-background/image-blur-worker';

serveBlurCopies(self);
