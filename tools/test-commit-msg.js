import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEADER_MAX_LENGTH, TYPES, validateCommitMessage } from './check-commit-msg.js';

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failures++;
  } else {
    console.log('ok  :', msg);
  }
}

function expectValid(label, message) {
  const errors = validateCommitMessage(message);
  assert(errors.length === 0, `přijme ${label}${errors.length ? `: ${errors.join(' ')}` : ''}`);
}

function expectInvalid(label, message) {
  assert(validateCommitMessage(message).length > 0, `odmítne ${label}`);
}

for (const type of TYPES) {
  expectValid(`typ ${type}`, `${type}: popis změny`);
}
expectValid('předmět s rozsahem', 'fix(ekonomika): opravit záporné zásoby');
expectValid('rozsah s lomítkem', 'feat(client/ui): nový panel');
expectValid('breaking change označený !', 'feat(sim)!: změnit formát stavu');
expectValid('breaking change bez rozsahu', 'feat!: změnit formát stavu');
expectValid('předmět právě na limitu délky', `feat: ${'a'.repeat(HEADER_MAX_LENGTH - 6)}`);
expectValid('tělo oddělené prázdným řádkem', 'fix: opravit pád\n\nPodrobnosti změny.\n\nRefs: #12');
expectValid('koncový nový řádek', 'docs: aktualizovat README\n');
expectValid('konce řádků CRLF', 'feat: přidat sklad\r\n\r\nTělo zprávy\r\n');
expectValid('řádky # ze šablony editoru', 'feat: přidat sklad\n\n# Please enter the commit message\n# Lines starting with # are ignored\n');
expectValid('úvodní prázdné řádky', '\n\nfeat: přidat sklad');
for (const message of [
  "Merge branch 'main'",
  'Revert "feat: přidat sklad"',
  'fixup! feat: přidat sklad',
  'squash! fix: opravit pád',
  'amend! docs: aktualizovat README'
]) {
  expectValid(`zprávu generovanou Gitem: ${message}`, message);
}

expectInvalid('prázdnou zprávu', '');
expectInvalid('zprávu jen z komentářů', '# jen komentář\n');
expectInvalid('předmět bez typu', 'přidat sklad');
expectInvalid('neznámý typ', 'wip: rozpracováno');
expectInvalid('velké písmeno v typu', 'Feat: přidat sklad');
expectInvalid('chybějící mezeru za dvojtečkou', 'feat:přidat sklad');
expectInvalid('prázdný popis', 'feat: ');
expectInvalid('prázdný rozsah', 'feat(): přidat sklad');
expectInvalid('velké písmeno v rozsahu', 'feat(Sim): přidat sklad');
expectInvalid('vykřičník na špatném místě', 'feat(sim)!x: přidat sklad');
expectInvalid('předmět delší než limit', `feat: ${'a'.repeat(HEADER_MAX_LENGTH - 5)}`);
expectInvalid('tělo bez prázdného řádku', 'fix: opravit pád\nPodrobnosti změny.');

const CLI = fileURLToPath(new URL('./check-commit-msg.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'commit-msg-'));
try {
  const good = join(dir, 'good.txt');
  const bad = join(dir, 'bad.txt');
  writeFileSync(good, 'feat: přidat sklad\n');
  writeFileSync(bad, 'přidat sklad\n');
  const okRun = spawnSync(process.execPath, [CLI, good], { encoding: 'utf8' });
  assert(okRun.status === 0, 'CLI skončí kódem 0 pro platnou zprávu');
  const badRun = spawnSync(process.execPath, [CLI, bad], { encoding: 'utf8' });
  assert(badRun.status === 1 && badRun.stderr.includes('Conventional Commits'), 'CLI skončí kódem 1 a vypíše chybu pro neplatnou zprávu');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} CHYB` : '\nVšechny testy zpráv commitů prošly.');
process.exit(failures ? 1 : 0);
