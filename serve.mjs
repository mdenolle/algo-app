#!/usr/bin/env node
// Static server for the Algo prototype and Algo World. No dependencies.
// Serves this folder on all interfaces with Cache-Control: no-store, so the
// browser (and the phone's WebView) always get the current files.
//   npm run web            → http://localhost:8000/  and  http://<laptop-ip>:8000/
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const root = resolve(new URL('.', import.meta.url).pathname);
const port = Number(process.env.PORT || 8000);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    if (statSync(file).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }); res.end(); return; }
      file = join(file, 'index.html');
    }
    const size = statSync(file).size;
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Length': size, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: ' + path);
  }
}).listen(port, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Algo served from ${root}\n  laptop:  http://localhost:${port}/\n  phone:   http://${lan ?? '<laptop-ip>'}:${port}/\n  world:   http://localhost:${port}/world/`);
});
