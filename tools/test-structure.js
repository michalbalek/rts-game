import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const extensions = new Set(['.js', '.mjs', '.cjs', '.css', '.html']);
const maxLines = 500;

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules') return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return entry.isFile() && extensions.has(path.extname(entry.name)) ? [target] : [];
  });
}

const sources = ['client', 'server', 'tools']
  .flatMap(directory => sourceFiles(path.join(root, directory)));
const oversized = [];
for (const file of sources) {
  const source = readFileSync(file, 'utf8');
  const lines = source === '' ? 0
    : source.split(/\r\n|\n|\r/).length - Number(/[\r\n]$/.test(source));
  if (lines > maxLines) oversized.push(`${path.relative(root, file)}: ${lines}`);
}

assert.equal(oversized.length, 0,
  `Zdrojové soubory překračují maximum ${maxLines} řádků:\n${oversized.join('\n')}`);
console.log(`ok  : ${sources.length} zdrojových souborů má nejvýše ${maxLines} řádků včetně prázdných řádků a komentářů`);
