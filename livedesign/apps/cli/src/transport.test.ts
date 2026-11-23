import { describeTransport } from '@liveworkspace/cli-kit/testing/suites/transport';
import { PRODUCT } from './product';
import { fakeIo } from './testing/fake-io';
import { transport } from './transport';

// The api client's retry with a refreshed credential: the suite every product CLI runs, over this CLI's transport.
describeTransport({ product: PRODUCT, item: 'design', fakeIo, transport });
