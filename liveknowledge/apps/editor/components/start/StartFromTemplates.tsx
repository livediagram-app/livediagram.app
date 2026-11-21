'use client';

// The knowledgebase's start screen (docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"), a start
// panel (StartPanel) whose choices are shapes of a whole knowledgebase: Start (Blank Knowledgebase, and Describe to
// Set Up where it is offered), then the structures by who they are for, each card an outline of its page tree with
// its page count, and a search across them. At the rail's foot Describe to Set Up and Import, then Connect File. It
// cannot be closed by itself: Blank Knowledgebase is the way past it.
import { useEffect, useMemo } from 'react';
import { lucideGlyph } from '@liveknowledge/ui';
import {
  lucideCode,
  lucideFileDown,
  lucideHandshake,
  lucidePackage,
  lucideSquareDashed,
  lucideUsers,
} from '@liveworkspace/icons/lucide';
import type { HelpArticleKey } from '@/lib/help-articles';
import { setStartPanelOpen } from '@liveworkspace/workbench/components/start/start-panel-open';
import { SetupSparkleIcon } from '@/components/setup/setup-icons';
import { useStartPalette } from '@/components/start/useStartPalette';
import { StartPanel } from './StartPanel';
import { StartSaveSwitch } from './StartSaveSwitch';
import { START_GROUP_ID, knowledgebaseStart } from './start-structure-items';
import { structureCard } from './structure-card';

const glyph = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// Each rail group's glyph: Start, then one per structure group (packages/knowledge setup-structures.ts).
const RAIL_ICONS: Readonly<Record<string, ReturnType<typeof lucideGlyph>>> = {
  [START_GROUP_ID]: glyph(lucideSquareDashed),
  team: glyph(lucideUsers),
  engineering: glyph(lucideCode),
  product: glyph(lucidePackage),
  support: glyph(lucideHandshake),
};
const ImportGlyph = glyph(lucideFileDown);

const COPY: { title: string; line: string; noMatch: string; help: HelpArticleKey } = {
  title: 'Start Your Knowledgebase',
  line: 'Pick a shape for the whole knowledgebase: its pages, already in place. Or start blank, or describe it.',
  noMatch: 'knowledgebases',
  help: 'templates',
};

export function StartFromTemplates({
  onChoose,
  onDescribe,
  onImport,
}: {
  // Blank Knowledgebase (`blank`), Describe to Set Up (`describe`) or a structure's id, chosen.
  onChoose: (id: string) => void;
  // Describe to Set Up, where it is offered (a signed-in Editor, not Offline): a Start card and a foot entry.
  onDescribe?: (() => void) | undefined;
  // Import, for an Editor.
  onImport?: (() => void) | undefined;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  const start = useMemo(() => knowledgebaseStart({ describe: !!onDescribe }), [onDescribe]);
  const categories = useMemo(
    () =>
      start.groups.map((g) => ({
        id: g.id,
        name: g.name,
        line: g.line,
        icon: RAIL_ICONS[g.id] ?? RAIL_ICONS[START_GROUP_ID]!,
      })),
    [start],
  );
  // On screen: the tours hold their offer until it goes (start-panel-open.ts).
  useEffect(() => {
    setStartPanelOpen(true);
    return () => setStartPanelOpen(false);
  }, []);
  return (
    <StartPanel
      titleId="start-pages-title"
      title={COPY.title}
      line={COPY.line}
      searchLabel="Find a knowledgebase"
      noMatchNoun={COPY.noMatch}
      helpArticle={COPY.help}
      palette={palette}
      categories={categories}
      initialCategory={START_GROUP_ID}
      cardsIn={(id) => (start.groups.find((g) => g.id === id)?.ids ?? []).map(structureCard)}
      search={(query) =>
        start.search(query).map((g) => ({ category: g.group, cards: g.ids.map(structureCard) }))
      }
      onChoose={onChoose}
      // Where the new item lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(palette) => <StartSaveSwitch palette={palette} />}
      // Describe to Set Up then Import at the rail's foot (Connect File is the page tree's, links-and-embeds.md): each
      // closes the start and opens its dialog over the empty knowledgebase.
      footLead={[
        ...(onDescribe
          ? [
              {
                id: 'describe',
                name: 'Describe to Set Up',
                icon: <SetupSparkleIcon aria-hidden />,
                onPick: onDescribe,
              },
            ]
          : []),
        ...(onImport
          ? [{ id: 'import', name: 'Import', icon: <ImportGlyph aria-hidden />, onPick: onImport }]
          : []),
      ]}
    />
  );
}
