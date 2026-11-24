// Each Worker keeps its own port: a plain TCP pipe from it to the gateway (./gateway.mjs), bytes unchanged, so the Host
// header still names the Worker's port and WebSocket upgrades pass straight through. On both loopbacks, as
// `wrangler dev` listened, since `localhost` may resolve to either.

import net from 'node:net';

export function forward(port, gatewayPort) {
  const servers = ['127.0.0.1', '::1'].map((host) => {
    const server = net.createServer((client) => {
      const upstream = net.connect(gatewayPort, '127.0.0.1');
      client.pipe(upstream).pipe(client);
      const close = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on('error', close);
      upstream.on('error', close);
    });
    return new Promise((resolve, reject) => {
      server.once('error', (error) => {
        // A machine without IPv6 has no ::1 to listen on; 127.0.0.1 is enough there.
        if (host === '::1' && error.code === 'EADDRNOTAVAIL') resolve(null);
        else reject(Object.assign(error, { port }));
      });
      server.listen(port, host, () => resolve(server));
    });
  });
  return Promise.all(servers).then((list) => list.filter(Boolean));
}
