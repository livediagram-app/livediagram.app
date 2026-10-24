// Every app's dashboard config, with its own categories and catalogue, for the shared views' tests:
// the views are one set, so a check on them runs against each app's data.
import { TELEMETRY_CATEGORIES as LIVEDESIGN_CATEGORIES } from '@livedesign/api-schema';
import { TELEMETRY_CATEGORIES as LIVEDIAGRAM_CATEGORIES } from '@livediagram/api-schema';
import { TELEMETRY_CATEGORIES as LIVEDOCUMENTS_CATEGORIES } from '@livedocuments/api-schema';
import { TELEMETRY_CATEGORIES as LIVEPLANNER_CATEGORIES } from '@liveplanner/api-schema';
import { LIVEDESIGN } from '../livedesign/config';
import * as LIVEDESIGN_CATALOGUE from '../livedesign/metric-catalogue';
import { LIVEDIAGRAM } from '../livediagram/config';
import * as LIVEDIAGRAM_CATALOGUE from '../livediagram/metric-catalogue';
import { LIVEDOCUMENTS } from '../livedocuments/config';
import * as LIVEDOCUMENTS_CATALOGUE from '../livedocuments/metric-catalogue';
import { LIVEPLANNER } from '../liveplanner/config';
import * as LIVEPLANNER_CATALOGUE from '../liveplanner/metric-catalogue';
import type { TelemetryAppConfig } from './app';

export type TestApp = {
  name: string;
  config: TelemetryAppConfig;
  categories: readonly string[];
  catalogue: Record<string, unknown>;
};

export const TEST_APPS: TestApp[] = [
  {
    name: 'livediagram',
    config: LIVEDIAGRAM,
    categories: LIVEDIAGRAM_CATEGORIES,
    catalogue: LIVEDIAGRAM_CATALOGUE,
  },
  {
    name: 'liveplanner',
    config: LIVEPLANNER,
    categories: LIVEPLANNER_CATEGORIES,
    catalogue: LIVEPLANNER_CATALOGUE,
  },
  {
    name: 'livedocuments',
    config: LIVEDOCUMENTS,
    categories: LIVEDOCUMENTS_CATEGORIES,
    catalogue: LIVEDOCUMENTS_CATALOGUE,
  },
  {
    name: 'livedesign',
    config: LIVEDESIGN,
    categories: LIVEDESIGN_CATEGORIES,
    catalogue: LIVEDESIGN_CATALOGUE,
  },
];

export { LIVEDIAGRAM };
