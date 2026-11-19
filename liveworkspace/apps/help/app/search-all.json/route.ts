import { searchIndexFor } from '@liveworkspace/help-registry/catalogue';

// Every app's articles for the search box (liveworkspace/docs/specs/016-help/help-centre.md "Search"): in an app's
// help it is fetched only once that app's own results show, for the "From Other Apps" group; All Apps' own index is
// already this one. lib/search-index.test.ts caps its size.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(searchIndexFor('all'));
}
