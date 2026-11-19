import { searchIndexFor } from '@liveworkspace/help-registry/catalogue';
import { SCOPE } from '@/lib/scope.generated';

// The search box's own index (liveworkspace/docs/specs/016-help/help-centre.md "Search"): the build's scope's
// articles, in its wording, with only the fields a result reads. Fetched on the reader's first search, so a page
// ships none of it. lib/search-index.test.ts caps its size.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(searchIndexFor(SCOPE));
}
