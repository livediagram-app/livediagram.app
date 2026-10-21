import { detectStickies } from '../../sticky-vision/src';
import { score, truthFor } from '../../sticky-vision/scripts/truth';
import { loadRealWalls } from './data/real';
import { mergedFloorOf, realMergedOf, table, type Row } from './report';

// The classical detector through the same table as the model (`score.ts`),
// so the supplementary `real` / `floor` merged columns compare like for like:
//
//   npx tsx scripts/score-classical.ts

const rows: Row[] = loadRealWalls().map((wall) => {
  const started = performance.now();
  const found = detectStickies({ width: wall.width, height: wall.height, data: wall.rgba });
  const ms = performance.now() - started;
  const truth = truthFor(`${wall.name}.jpg`) ?? truthFor(`${wall.name}.png`);
  if (!truth) throw new Error(`no labels for ${wall.name}`);
  const result = score(truth, found, wall.width, wall.height);
  return {
    name: wall.name,
    score: result,
    ms,
    realMerged: realMergedOf(result, wall.boxes),
    floor: mergedFloorOf(wall.boxes),
  };
});
console.log('classical detector (sticky-vision detectStickies)');
console.log(table(rows));
