// UML retired (owner, 2026-11-12, Work Item 696): livehuddle, liveplanner, livedocuments and livedesign stopped
// offering it, and livediagram keeps it, so its definition stays in ./themes-data. A product that retired it binds this
// module (each one's docs/specs/011-theme/retired-schemes.md "UML"): its catalogue is the shared one less UML, so no
// picker, Mashup or agent schema offers it, and a stored tab on UML moves onto Mono on read, the scheme nearest UML's
// colours, every colour UML painted taking Mono's for the same role.
import { bindRetiredThemes, UML_AS_RETIRED, type RetiredTheme } from './retired-themes';
import { THEMES as SHARED_THEMES } from './themes-data';

/** The shared themes a product that binds this module no longer offers. */
export const RETIRED_THEME_IDS: ReadonlySet<string> = new Set(['uml']);

/** The built-in themes such a product offers: every one in the shared catalogue but UML. */
export const THEMES = SHARED_THEMES.filter((t) => !RETIRED_THEME_IDS.has(t.id));

/** UML, frozen as it left, and the theme that replaced it. */
export const RETIRED_THEMES: Readonly<Record<string, RetiredTheme>> = {
  uml: { from: UML_AS_RETIRED, to: 'mono' },
};

/** Rewrite a stored tab off UML onto Mono. The same tab when it is on any other theme. */
export const migrateRetiredTheme = bindRetiredThemes(RETIRED_THEMES).migrate;
