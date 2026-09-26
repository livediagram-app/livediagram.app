// Static server for the sticky-vision demo (two files, nothing else).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT ?? 4199);

const FILES = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/sticky-vision.bundle.js': 'sticky-vision.bundle.js',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const name = FILES[req.url] ?? FILES[req.url.split('?')[0]];
  if (!name) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  try {
    const data = await readFile(join(ROOT, name));
    res.writeHead(200, { 'Content-Type': MIME[extname(name)] });
    res.end(data);
  } catch {
    res.writeHead(500);
    res.end('read failed');
  }
});

server.listen(PORT, () => console.log(`sticky-vision demo at http://localhost:${PORT}`));
