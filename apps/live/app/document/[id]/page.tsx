import EditorPage from './editor-page';

// Static export + dynamic route: `output: 'export'` requires every
// dynamic segment to be resolvable at build time. User-minted document
// ids can't be enumerated, so we ship a single placeholder route
// (`/document/placeholder/`) and have the live worker rewrite any
// `/document/<anything>` request to that file. The client then reads
// the real id from `window.location.pathname`. See docs/specs/007-editor/new-document-route.md.
export const generateStaticParams = async () => [{ id: 'placeholder' }];

export default function Page() {
  return <EditorPage />;
}
