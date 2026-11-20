import { PageNotFound } from '@/lib/bindings.generated';

// An address under /help with no page: the layout's header and footer around the scope's not-found card, its way
// back the help home.
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
