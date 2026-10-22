// A Form tab's preview (docs/specs/030-forms/forms.md "Agents"; docs/specs/015-api/mcp-server.md §4.9e): the form as
// respondents see it on its tab's look (@livediagram/plan-art formArt), for read_form's image and read_document's.
import { formLook, resolveFontStack, tabKindOf, type Tab } from '@livediagram/document';
import { readForm } from '@livediagram/forms';
import { formArt } from '@livediagram/plan-art';
import { previewFonts } from './preview-fonts';
import { svgToPngBase64 } from './render';

type FormImage = { type: 'image'; data: string; mimeType: 'image/png' };

// The form's picture, or null for a tab that holds no form.
export async function formPreview(
  tab: Pick<Tab, 'kind' | 'form' | 'theme' | 'finish' | 'font'>,
): Promise<FormImage | null> {
  const form = tabKindOf(tab) === 'form' ? readForm(tab.form) : null;
  if (!form) return null;
  const look = formLook(tab);
  const art = formArt(form, look, resolveFontStack(look.font));
  const fonts = await previewFonts(look.font ? [look.font] : []);
  return { type: 'image', data: await svgToPngBase64(art.svg, fonts), mimeType: 'image/png' };
}
