// Test-only static server; the game itself needs no build or server dependency.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
};

http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4173, '127.0.0.1');
