import { fileURLToPath } from 'node:url';
import { describeHelpSite } from '@liveworkspace/help-site/testing';
import { CARD_SUBTITLE_MAX } from '@livediagram/ui';
import { site } from './help-site';
import { HOME } from './home-sections';

// The help centre's catalogue checks (docs/specs/018-help in this product), shared by every product's help app and
// run here over this one's articles, categories, art and home page.
describeHelpSite(site, {
  home: HOME,
  cardSubtitleMax: CARD_SUBTITLE_MAX,
  appDir: fileURLToPath(new URL('../app', import.meta.url)),
});
