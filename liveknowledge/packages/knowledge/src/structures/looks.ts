// How a structure's pages look once made (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen",
// "Icons and covers"): an icon on each section and on each leaf whose title names a thing, and a cover on each
// top-level section and the first page. Calm by rule: one line-art icon per page from the page icon picker's Icons
// tab (never an emoji), one theme gradient per group (never a picture or an animation), so a structure reads as one.
import type { SetupStructure, StructureGroup, StructurePage } from './shape';

/** The theme gradient a group's structures take for their covers: light ones only, one to a group. */
export const GROUP_COVERS: Readonly<Record<StructureGroup, string>> = {
  team: 'theme-glow',
  engineering: 'theme-mist',
  product: 'theme-sorbet',
  support: 'theme-haze',
  operations: 'theme-dawn',
  community: 'theme-pastel',
  education: 'theme-glow',
  personal: 'theme-sorbet',
};

/** What a section with no rule of its own takes. */
export const SECTION_ICON = 'folder';

// First match wins, so the narrow rules stand before the broad ones. Each id is one the picker's Icons tab offers
// (structure-looks.test.ts holds that).
const ICON_RULES: readonly (readonly [RegExp, string])[] = [
  [/\b(code of conduct|acceptable use)\b/, 'shield-check'],
  [/\b(data protection|consent)\b/, 'lock'],
  [/\bhealth scores?\b/, 'activity'],
  [/\bhistory\b/, 'clock'],
  [/\bon the day\b/, 'clock'],
  [/\bmeal plans?\b/, 'utensils'],
  [/\bpricing\b/, 'dollar-sign'],
  [/\b(invoicing|invoices?)\b/, 'receipt'],
  [/\bcase stud\w*\b/, 'briefcase'],
  [/\busing the project\b/, 'package'],
  [/\b(about this library|library)\b/, 'book-open'],
  [/\bonboarding\b/, 'rocket'],
  [/\b(ideal customer|personas?)\b/, 'user'],
  [/\bour customers\b/, 'users'],
  [/\bdelivery\b/, 'package'],
  [/\bcontributing\b/, 'pull-request'],
  [/\bhow we work\b/, 'settings'],
  [/\b(playbooks?)\b/, 'clipboard'],
  [/\bfeatures\b/, 'sparkles'],
  [/\bpublishing\b/, 'newspaper'],
  [/\b(faq|frequently asked|questions|help center)\b/, 'help-circle'],
  [/\b(glossary|dictionary|vocabulary|data dictionary)\b/, 'book'],
  [/\b(release notes|news|announcements?|changelog)\b/, 'newspaper'],
  [/\b(troubleshooting|bugs?)\b/, 'bug-fixed'],
  [/\b(on-call|alerts?)\b/, 'bell'],
  [/\b(incidents?|emergenc\w+)\b/, 'alert-triangle'],
  [/\b(runbooks?|checklists?)\b/, 'clipboard'],
  [/\b(security|safety)\b/, 'shield'],
  [/\b(access|passwords?|permissions?)\b/, 'key'],
  [/\bprivacy\b/, 'lock'],
  [/\b(devices?|hardware)\b/, 'monitor'],
  [/\b(architecture|systems?|platforms?|foundations?)\b/, 'layers'],
  [/\b(infrastructure|servers?|hosting)\b/, 'server'],
  [/\b(data|database|analytics)\b/, 'database'],
  [/\b(api|development|code|libraries|engineering|reference)\b/, 'code'],
  [/\b(shipping|releases?|launch\w*|deploy\w*)\b/, 'rocket'],
  [/\b(components?)\b/, 'box'],
  [/\b(patterns?)\b/, 'layers'],
  [/\b(design|brand|palette)\b/, 'palette'],
  [/\b(roadmap|map)\b/, 'map'],
  [/\b(vision)\b/, 'eye'],
  [/\b(strategy|learning paths?)\b/, 'compass'],
  [/\b(goals?|objectives?|okrs?|mission|what i am looking for)\b/, 'goal'],
  [
    /\b(first week|first month|planning|plans?|timeline|schedule|programmes?|agenda|calendar)\b/,
    'calendar',
  ],
  [/\b(metrics|dashboards?|status|reports?|measuring|results|year end)\b/, 'bar-chart'],
  [/\b(analys[ei]s|insights?)\b/, 'lightbulb'],
  [/\b(retrospectives?)\b/, 'refresh-cw'],
  [/\b(meetings?|how we meet)\b/, 'presentation'],
  [/\b(decisions?)\b/, 'check-circle'],
  [/\b(actions?|tasks?|to-?dos?)\b/, 'check'],
  [/\b(research|studies|study|methods?)\b/, 'search'],
  [/\b(reading list|lessons?|journal)\b/, 'book-open'],
  [/\b(assignments?|notes?|my story)\b/, 'pencil'],
  [/\b(revision)\b/, 'refresh-cw'],
  [/\b(syllabus|policies|policy|rules|terms|paperwork|documents?)\b/, 'file-text'],
  [
    /\b(teaching|training|courses?|course catalogue|subjects?|education|academy|learning)\b/,
    'graduation-cap',
  ],
  [/\b(contracts?|legal|compliance|governance|ethics)\b/, 'scale'],
  [/\b(invoices?|payments?|billing|receipts?)\b/, 'receipt'],
  [/\b(fundrais\w*|donations?|savings)\b/, 'piggy-bank'],
  [
    /\b(pay|payroll|salary|budget\w*|spend\w*|expenses?|finances?|finance|pricing|costs?|money)\b/,
    'dollar-sign',
  ],
  [/\b(hiring|recruit\w*)\b/, 'user-plus'],
  [/\b(interviews?|feedback|messaging)\b/, 'message'],
  [/\b(benefits?|health|wellbeing|values)\b/, 'heart'],
  [/\b(time off|holiday|leave)\b/, 'calendar'],
  [/\b(growth|sales|selling)\b/, 'trending-up'],
  [/\b(marketing|channels?|campaigns?|promotion|communications?)\b/, 'megaphone'],
  [/\b(winning work|offers?)\b/, 'gift'],
  [/\b(clients?|projects?|case stud\w*|applications?|delivery|customers?)\b/, 'briefcase'],
  [/\b(account\w*|profile)\b/, 'user'],
  [
    /\b(people|teams?|staff|volunteers|members|participants|guests|leadership|who we are|contributors|community|networking|lab meetings|on the day)\b/,
    'users',
  ],
  [/\b(venue|logistics|offices?|location)\b/, 'map-pin'],
  [/\b(companies|company|departments?)\b/, 'building'],
  [/\b(recipes?|meal plans?)\b/, 'chef-hat'],
  [/\b(kitchen)\b/, 'utensils'],
  [/\b(shopping)\b/, 'cart'],
  [/\b(household|around the house|home)\b/, 'house'],
  [/\b(maintenance|tools?)\b/, 'tool'],
  [/\b(contacts?)\b/, 'phone'],
  [/\b(inbox)\b/, 'download'],
  [/\b(archive)\b/, 'archive'],
  [/\b(resources?|to try)\b/, 'bookmark'],
  [/\b(templates?)\b/, 'copy'],
  [/\b(getting started|quick start|start here)\b/, 'zap'],
  [/\b(welcome|overview|introduction|about us)\b/, 'home'],
];

/** The icon a page of this title takes, when a rule names one. */
export function iconForTitle(title: string): string | undefined {
  const text = title.toLowerCase();
  return ICON_RULES.find(([rule]) => rule.test(text))?.[1];
}

const looksOf = (
  pages: readonly StructurePage[],
  cover: string,
  top: boolean,
  isFirst: (page: StructurePage) => boolean,
): StructurePage[] =>
  pages.map((page) => {
    const section = page.pages.length > 0;
    const icon = iconForTitle(page.title) ?? (section ? SECTION_ICON : undefined);
    const covered = top && (section || isFirst(page));
    return {
      ...page,
      ...(icon ? { icon } : {}),
      ...(covered ? { cover } : {}),
      pages: looksOf(page.pages, cover, false, isFirst),
    };
  });

/** The structure with its pages' icons and covers set, group by group in one module's data. */
export function styleStructure(structure: SetupStructure): SetupStructure {
  const first = structure.pages[0];
  return {
    ...structure,
    pages: looksOf(structure.pages, GROUP_COVERS[structure.group], true, (page) => page === first),
  };
}
