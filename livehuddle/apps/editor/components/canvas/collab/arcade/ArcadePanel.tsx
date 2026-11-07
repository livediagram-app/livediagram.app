'use client';

// The Arcade Machine's panel (docs/specs/009-elements/social-pieces.md "The panel", "High Scores"; blueprint "The
// panel"), loaded with lazy() from ArcadeFace the first time a machine opens: Moon Mail for an Editor or a
// Participant, the machine's High Scores for everyone, and a Viewer's scores-only view.
//
// A run's score is posted when it ends, if it makes the table: one `arcade-score` delta (docs/specs/012-collaboration/
// collab-race-hardening.md), signed with your key, which the room checks for a Participant. Only this open panel
// reads the editor's context, so the machines on the canvas never re-render with it.

import { useState } from 'react';
import { arcadeName, type ShapeElement } from '@livehuddle/document';
import { useModalGuard } from '@liveworkspace/workbench/hooks/ui/useModalGuard';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { arcadeScoreFor } from '@/lib/arcade/arcade-post';
import type { MoonMailRun } from '@/lib/arcade/moon-mail';
import { track } from '@/lib/telemetry';
import { ReaderShell } from '../ReaderShell';
import { signingKeyOf } from '../useNoteSigner';
import { HighScores } from './HighScores';
import { MoonMailScreen, type RunResult } from './MoonMailScreen';
import { useMoonMail } from './useMoonMail';

export default function ArcadePanel({
  element,
  onClose,
}: {
  element: ShapeElement;
  onClose: () => void;
}) {
  const editor = useOptionalEditorContext();
  const level = editor?.can.level ?? 'view';
  const playable = level === 'edit' || level === 'participate';
  const myKey = signingKeyOf(editor);
  // The machine's tab as the panel opened: a run ended by leaving the tab still posts to its own machine.
  const [tabId] = useState(() => editor?.activeTab?.id);
  const [result, setResult] = useState<RunResult & { id: string | null }>();
  // While open the panel holds the keyboard: no walking, no shortcuts, no tour steps behind it.
  useModalGuard(true);

  const live = useLatest({ element, editor, myKey, tabId });
  const onEnd = (run: MoonMailRun) => {
    const { element: machine, editor: ed, myKey: key, tabId: tab } = live.current;
    track('Canvas', 'Used', 'Arcade');
    const post = arcadeScoreFor(run, machine.arcadeScores, {
      key,
      name: arcadeName(ed?.selfParticipant.name),
      now: Date.now(),
      id: crypto.randomUUID(),
    });
    if (post && ed)
      ed.applyElementDelta(machine.id, { kind: 'arcade-score', score: post.score }, tab);
    setResult({ score: run.score, place: post?.place ?? null, id: post?.score.id ?? null });
  };
  const game = useMoonMail({ playable, onEnd });
  // A press on the dim moves focus out of the panel, and the focus trap hands it to Close, where the next Space
  // (resume) would close the panel and end the run: the game's screen takes it back.
  const pauseFromDim = () => {
    game.pause();
    game.screenRef.current?.focus({ preventScroll: true });
  };

  return (
    <ReaderShell
      title="Moon Mail"
      onClose={onClose}
      widthClassName="max-w-[360px]"
      initialFocus="container"
      // A stray press beside the panel pauses a run rather than ending it.
      onBackdrop={game.phase === 'playing' ? pauseFromDim : onClose}
      data-arcade-panel={element.id}
    >
      {playable ? <MoonMailScreen game={game} result={result ?? null} /> : null}
      <HighScores
        scores={element.arcadeScores}
        myKey={myKey}
        litId={result?.id ?? null}
        note={playable ? undefined : 'Viewers See the Scores'}
      />
    </ReaderShell>
  );
}
