// What a knowledgebase structure's picture paints with (docs/specs/030-knowledgebase/describe-to-set-up.md "The start
// screen", "A card's picture"): its group's colour and its own emblem. The structures themselves are
// @liveknowledge/knowledge's (setup-structures.ts); this module keys them by id, and the editor's structure-card test
// holds every structure to one emblem of its own and every group to a tone.
import type { IconPrim } from '@liveworkspace/icons';
import {
  lucideBell,
  lucideBookOpen,
  lucideBookOpenText,
  lucideBraces,
  lucideBriefcase,
  lucideCalendarCheck,
  lucideBuilding2,
  lucideChartColumn,
  lucideChefHat,
  lucideFootprints,
  lucideGitFork,
  lucideGoal,
  lucideGraduationCap,
  lucideHandshake,
  lucideHeadphones,
  lucideHeart,
  lucideHighlighter,
  lucideHouse,
  lucideLibrary,
  lucideLightbulb,
  lucideMegaphone,
  lucidePalette,
  lucidePartyPopper,
  lucidePipette,
  lucidePlus,
  lucidePresentation,
  lucideScale,
  lucideSchool,
  lucideShieldCheck,
  lucideSparkles,
  lucideSquareKanban,
  lucideStar,
  lucideUsers,
  lucideWebhook,
} from '@liveworkspace/icons/lucide';

/** A colour ramp, Tailwind's steps: the wash under the window (50, 100), the cover (300 to 600), the ink (700). */
export type StructureTone = {
  50: string;
  100: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
};

const ramp = (
  a50: string,
  a100: string,
  a300: string,
  a400: string,
  a500: string,
  a600: string,
  a700: string,
): StructureTone => ({ 50: a50, 100: a100, 300: a300, 400: a400, 500: a500, 600: a600, 700: a700 });

/** Each structure group's colour, one hue a group so a group's four read as kin and the groups apart. */
export const GROUP_TONES: Readonly<Record<string, StructureTone>> = {
  team: ramp('#f5f3ff', '#ede9fe', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9'),
  engineering: ramp('#f0f9ff', '#e0f2fe', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'),
  product: ramp('#fdf4ff', '#fae8ff', '#f0abfc', '#e879f9', '#d946ef', '#c026d3', '#a21caf'),
  support: ramp('#ecfdf5', '#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857'),
  operations: ramp('#eef2ff', '#e0e7ff', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#4338ca'),
  community: ramp('#fff7ed', '#ffedd5', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c'),
  education: ramp('#fffbeb', '#fef3c7', '#fcd34d', '#fbbf24', '#f59e0b', '#d97706', '#b45309'),
  personal: ramp('#fff1f2', '#ffe4e6', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c'),
};

/** Blank Knowledgebase's tone: the quiet slate of an empty page. */
export const BLANK_TONE: StructureTone = ramp(
  '#f8fafc',
  '#f1f5f9',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#334155',
);

/** Describe to Set Up's tone: the app's own accent, as its sparkle is everywhere else. */
export const DESCRIBE_TONE: StructureTone = ramp(
  'var(--color-brand-50)',
  'var(--color-brand-100)',
  'var(--color-brand-300)',
  'var(--color-brand-400)',
  'var(--color-brand-500)',
  'var(--color-brand-600)',
  'var(--color-brand-700)',
);

/** Each structure's emblem, by its id: what the knowledgebase is about, as its first page's icon. None shared. */
export const STRUCTURE_EMBLEMS: Readonly<Record<string, readonly IconPrim[]>> = {
  // Company
  'company-knowledgebase': lucideBuilding2,
  'team-handbook': lucideBookOpen,
  onboarding: lucideFootprints,
  'people-operations': lucideUsers,
  // Engineering
  'engineering-handbook': lucideBraces,
  runbooks: lucideBell,
  'design-system': lucidePalette,
  'api-docs': lucideWebhook,
  // Product
  'product-docs': lucideBookOpenText,
  'research-library': lucideLibrary,
  'project-hub': lucideSquareKanban,
  'product-strategy': lucideGoal,
  // Customers
  'support-knowledgebase': lucideHeadphones,
  'sales-playbook': lucideHandshake,
  'customer-success': lucideStar,
  'marketing-playbook': lucideMegaphone,
  // Operations
  'it-security': lucideShieldCheck,
  'finance-legal': lucideScale,
  'data-analytics': lucideChartColumn,
  'meetings-decisions': lucideCalendarCheck,
  // Community
  'client-projects': lucidePresentation,
  'open-source': lucideGitFork,
  'community-nonprofit': lucideHeart,
  'event-planning': lucidePartyPopper,
  // Education
  'course-handbook': lucideSchool,
  'study-notes': lucideHighlighter,
  'training-academy': lucideGraduationCap,
  'research-lab': lucidePipette,
  // Personal
  'second-brain': lucideLightbulb,
  'job-search': lucideBriefcase,
  'recipe-book': lucideChefHat,
  'home-manual': lucideHouse,
};

/** Blank Knowledgebase's and Describe to Set Up's emblems. */
export const BLANK_EMBLEM: readonly IconPrim[] = lucidePlus;
export const DESCRIBE_EMBLEM: readonly IconPrim[] = lucideSparkles;
