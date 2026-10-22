import type { Metadata } from 'next';
import { FormRespondPage } from '@/components/forms/respond/FormRespondPage';

// A form link's page (docs/specs/030-forms/forms.md "Filling in a form"). Static export can't list the codes people
// mint, so one placeholder page is built and the live worker rewrites every /form/<code> onto it (as /document/<id>
// is); the page reads the code from the address. No editor code: the page loads its own small bundle. Kept out of
// search engines like the rest of the live app (docs/specs/007-editor/live-app.md).
export const generateStaticParams = async () => [{ code: 'placeholder' }];

export const metadata: Metadata = {
  title: 'Form | livepages',
  robots: { index: false },
};

export default function Page() {
  return <FormRespondPage />;
}
