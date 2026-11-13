import { cp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

await cp('dist', 'output/capture-dist', { recursive: true });
await promisify(execFile)('bun', [
  'build',
  'tests/fixtures/capture.ts',
  '--outdir',
  'output/capture-dist/fixtures',
  '--target',
  'browser',
]);
const html = await readFile('dist/index.html', 'utf8');
await writeFile(
  'output/capture-dist/index.html',
  html
    .replace(/<script src="https:\/\/accounts.google.com\/gsi\/client"[^>]*><\/script>/, '')
    .replace('<head>', '<head><script src="/fixtures/capture.js"></script>'),
);
