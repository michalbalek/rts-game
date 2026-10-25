import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

export const TYPES = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];
export const HEADER_MAX_LENGTH = 72;

const HEADER_PATTERN = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9][a-z0-9._/-]*\\))?!?: \\S.*$`);
const GIT_GENERATED_PREFIXES = ['Merge ', 'Revert "', 'fixup! ', 'squash! ', 'amend! '];

export function validateCommitMessage(message) {
  // Git do šablony v editoru přidává řádky začínající #; nejsou součástí zprávy.
  const lines = message
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => !line.startsWith('#'));

  while (lines.length > 0 && lines[0].trim() === '') lines.shift();
  if (lines.length === 0) return ['Zpráva commitu je prázdná.'];

  const header = lines[0].trimEnd();
  if (GIT_GENERATED_PREFIXES.some((prefix) => header.startsWith(prefix))) return [];

  const errors = [];
  if (!HEADER_PATTERN.test(header)) {
    errors.push('Předmět neodpovídá formátu typ(rozsah)!: popis.');
  }
  if (header.length > HEADER_MAX_LENGTH) {
    errors.push(`Předmět má ${header.length} znaků, nejvýše ${HEADER_MAX_LENGTH}.`);
  }
  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push('Mezi předmětem a tělem zprávy musí být prázdný řádek.');
  }
  return errors;
}

function report(file) {
  const errors = validateCommitMessage(readFileSync(file, 'utf8'));
  if (errors.length === 0) return 0;
  console.error('Zpráva commitu nedodržuje Conventional Commits (viz CONTRIBUTING.md):');
  for (const error of errors) console.error(`  - ${error}`);
  console.error('Formát: typ(rozsah)!: popis');
  console.error(`Povolené typy: ${TYPES.join(', ')}`);
  return 1;
}

if (process.argv[1] && basename(process.argv[1]) === 'check-commit-msg.js') {
  if (process.argv[2]) {
    process.exitCode = report(process.argv[2]);
  } else {
    console.error('Použití: node tools/check-commit-msg.js <soubor-se-zprávou>');
    process.exitCode = 2;
  }
}
