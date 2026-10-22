import { Brand, PageNotFound, RAIL_CLEAR_PADDING } from '@livepages/ui';

// An address the marketing site has no page for (docs/specs/016-platform/router-app.md "Not found"). Next carries
// the root not-found tree in every page's payload, so it holds only the brand and the card: the full header and
// footer here added about 20 KB to every page.
export default function NotFound() {
  return (
    <>
      <header className={`mx-auto flex max-w-7xl items-center ${RAIL_CLEAR_PADDING} py-4`}>
        <Brand href="/" />
      </header>
      <PageNotFound />
    </>
  );
}
