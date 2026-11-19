import type { HelpArt } from '@liveworkspace/help-site/site';
import * as designArt from '../../livedesign/components/category-art';
import * as diagramArt from '../../livediagram/components/category-art';
import * as documentsArt from '../../livedocuments/components/category-art';
import * as huddleArt from '../../livehuddle/components/category-art';
import * as plannerArt from '../../liveplanner/components/category-art';
import * as designSupport from '../../livedesign/lib/articleIcons';
import * as diagramSupport from '../../livediagram/lib/articleIcons';
import * as documentsSupport from '../../livedocuments/lib/articleIcons';
import * as huddleSupport from '../../livehuddle/lib/articleIcons';
import * as plannerSupport from '../../liveplanner/lib/articleIcons';
import * as designColours from '../../livedesign/lib/featureColours';
import * as diagramColours from '../../livediagram/lib/featureColours';
import * as documentsColours from '../../livedocuments/lib/featureColours';
import * as huddleColours from '../../livehuddle/lib/featureColours';
import * as plannerColours from '../../liveplanner/lib/featureColours';
import * as designIcons from '../../livedesign/lib/featureIcons';
import * as diagramIcons from '../../livediagram/lib/featureIcons';
import * as documentsIcons from '../../livedocuments/lib/featureIcons';
import * as huddleIcons from '../../livehuddle/lib/featureIcons';
import * as plannerIcons from '../../liveplanner/lib/featureIcons';

// All Apps' card art (liveworkspace/docs/specs/016-help/help-centre.md "The home pages"): every app's scenes, icons
// and hues together, since All Apps lists every app's categories. Where two apps draw the same category, the first in
// registry order wins (livediagram's canvas, liveplanner's plan). The scenes paint with `brand-*` classes, which the
// all build's theme sets to liveworkspace's slate, so they read in the platform's colours.
// Imported by the all edition only, so no app's build carries another app's art.

const firstWins = <T>(...maps: Readonly<Record<string, T>>[]): Record<string, T> =>
  Object.assign({}, ...[...maps].reverse());

export const ALL_APPS_ART: HelpArt = {
  featureHex: firstWins(
    diagramColours.FEATURE_ENTITY_HEX,
    plannerColours.FEATURE_ENTITY_HEX,
    documentsColours.FEATURE_ENTITY_HEX,
    designColours.FEATURE_ENTITY_HEX,
    huddleColours.FEATURE_ENTITY_HEX,
  ),
  categoryHex: firstWins(
    diagramColours.FEATURE_CATEGORY_HEX,
    plannerColours.FEATURE_CATEGORY_HEX,
    documentsColours.FEATURE_CATEGORY_HEX,
    designColours.FEATURE_CATEGORY_HEX,
    huddleColours.FEATURE_CATEGORY_HEX,
  ),
  featureIcons: firstWins(
    diagramIcons.FEATURE_ICONS,
    plannerIcons.FEATURE_ICONS,
    documentsIcons.FEATURE_ICONS,
    designIcons.FEATURE_ICONS,
    huddleIcons.FEATURE_ICONS,
  ),
  categoryIcons: firstWins(
    diagramIcons.FEATURE_CATEGORY_ICONS,
    plannerIcons.FEATURE_CATEGORY_ICONS,
    documentsIcons.FEATURE_CATEGORY_ICONS,
    designIcons.FEATURE_CATEGORY_ICONS,
    huddleIcons.FEATURE_CATEGORY_ICONS,
  ),
  featureFallback: diagramIcons.FEATURE_ICONS['the-canvas'],
  supportIcons: firstWins(
    diagramSupport.SUPPORT_ARTICLE_ICONS,
    plannerSupport.SUPPORT_ARTICLE_ICONS,
    documentsSupport.SUPPORT_ARTICLE_ICONS,
    designSupport.SUPPORT_ARTICLE_ICONS,
    huddleSupport.SUPPORT_ARTICLE_ICONS,
  ),
  supportFallback: diagramSupport.SUPPORT_ARTICLE_FALLBACK,
  categoryArt: firstWins(
    diagramArt.CATEGORY_ART,
    plannerArt.CATEGORY_ART,
    documentsArt.CATEGORY_ART,
    designArt.CATEGORY_ART,
    huddleArt.CATEGORY_ART,
  ),
};
