// One copy for every product: @liveworkspace/element-model/themes-data, less UML, which this product retired while
// livediagram keeps it (docs/specs/011-theme/retired-schemes.md "UML"), plus the board themes, which only this product
// offers (docs/specs/011-theme/multicolour-themes.md "Board themes"). THEMES, the catalogue every picker, the Mashup and
// the agent schema read, is @liveworkspace/element-model/retired-uml's with the board themes after Tropical, the last
// of the other multi-colour themes, so every multi-colour theme sits together before the seasonal ones.
import { BOARD_THEMES } from '@liveworkspace/element-model/themes-data';
import { THEMES as UML_LESS } from '@liveworkspace/element-model/retired-uml';

export * from '@liveworkspace/element-model/themes-data';
export { RETIRED_THEME_IDS } from '@liveworkspace/element-model/retired-uml';

const AFTER = UML_LESS.findIndex((t) => t.id === 'tropical') + 1;
export const THEMES = [...UML_LESS.slice(0, AFTER), ...BOARD_THEMES, ...UML_LESS.slice(AFTER)];
