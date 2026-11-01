import { PageNotFound } from '@livedocuments/ui';

// An address under /help with no article (docs/specs/016-platform/router-app.md "Not found"): the layout's header
// and footer around the shared card, its way back the help centre's front page.
export default function NotFound() {
  return (
    <PageNotFound
      inMain
      homeHref="/help/"
      homeLabel="Browse Help Centre"
      helpHref="/help/troubleshooting/"
      helpLabel="Troubleshooting"
    />
  );
}
