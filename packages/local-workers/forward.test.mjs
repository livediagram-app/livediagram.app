import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { forward } from './forward.mjs';

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

test('a forwarded port reaches the gateway with its own Host header, and a taken port says which', async () => {
  const gateway = http.createServer((req, res) => res.end(req.headers.host));
  const gatewayPort = await listen(gateway);
  const probe = http.createServer();
  const port = await listen(probe);
  probe.close();

  const servers = await forward(port, gatewayPort);
  const body = await (await fetch(`http://127.0.0.1:${port}/x`)).text();
  assert.equal(body, `127.0.0.1:${port}`);

  await assert.rejects(forward(port, gatewayPort), (error) => error.port === port);
  for (const server of servers) server.close();
  gateway.close();
});
