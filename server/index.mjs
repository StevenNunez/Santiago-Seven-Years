import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { invitationEmailMiddleware } from './invitation-email.mjs';
import { walletMiddleware } from './wallet.mjs';
const wallet = walletMiddleware();
import { invitationDeleteMiddleware } from './invitation-delete.mjs';
const deleteInvitation = invitationDeleteMiddleware();
const root = resolve('dist');
const email = invitationEmailMiddleware();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
createServer((req, res) => {
  void email(req, res, () => { void wallet(req, res, () => { void deleteInvitation(req, res, () => { void serve(req, res); }); }); });
}).listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('Birthday server ready.'));
async function serve(req, res) {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) { res.writeHead(404); res.end(); return; }
    let filename = resolve(root, '.' + pathname);
    if (filename !== root && !filename.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    try { if (!(await stat(filename)).isFile()) filename = resolve(root, 'index.html'); }
    catch { if (extname(pathname)) { res.writeHead(404); res.end(); return; } filename = resolve(root, 'index.html'); }
    const body = await readFile(filename);
    res.writeHead(200, { 'Content-Type': types[extname(filename)] || 'application/octet-stream', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': pathname.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(400); res.end(); }
}
