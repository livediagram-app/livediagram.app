import EditorPage from './editor-page';

// Static export + dynamic route: `output: 'export'` requires every
// dynamic segment to be resolvable at build time. User-minted diagram
// ids can't be enumerated, so we ship a single placeholder route
// (`/diagram/placeholder/`) and have the live worker rewrite any
// `/diagram/<anything>` request to that file. The client then reads
// the real id from `window.location.pathname`. See spec/14.
export const generateStaticParams = async () => [{ id: 'placeholder' }];

export default function Page() {
  return <EditorPage />;
}
