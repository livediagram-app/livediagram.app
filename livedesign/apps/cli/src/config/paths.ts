// Where the CLI keeps its files (blueprint "Data and persistence"): @liveworkspace/cli-kit's XDG directories,
// named livedesign.

import type { CliIo } from '../io';
import { cacheDir as cacheDirOf, configDir as configDirOf } from '@liveworkspace/cli-kit/paths';
import { PRODUCT } from '../product';

export const configDir = (io: CliIo): string => configDirOf(io, PRODUCT);
export const cacheDir = (io: CliIo): string => cacheDirOf(io, PRODUCT);
