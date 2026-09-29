'use strict';
/* session-commander tests — node:test, zero deps.
 * Run: npm test  (or: node --test test/)
 */
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'session-commander');
const FIX = path.join(__dirname, 'fixtures');

let tmp, home, config;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-test-'));
  home = path.join(tmp, 'home');
  config = path.join(tmp, 'config');
  fs.mkdirSync(home, { recursive: true });
});
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function env(extra = {}) {
  return {
    ...process.env,
    SC_CLAUDE_DIR: path.join(FIX, 'claude'),
    SC_CODEX_DIR: path.join(tmp, 'no-codex-here'),
    SC_CONFIG_DIR: config,
    HOME: home,
    ...extra,
  };
}
function run(args, opts = {}) {
  return spawnSync(process.execPath, [BIN, ...args], { env: env(opts.env), encoding: 'utf8', ...opts.spawn });
}
function runOk(args, opts = {}) {
  const r = run(args, opts);
  assert.equal(r.status, 0, `exit ${r.status}\nSTDOUT:\n${r.stdout}\nSTDERR:\n${r.stderr}`);
  return r;
}

test('sessions lists fixtures with cost math', () => {
  const r = runOk(['sessions']);
  assert.match(r.stdout, /my-project/);
  assert.match(r.stdout, /aaa11111/);
  assert.match(r.stdout, /bbb22222/);
  // sonnet 4-5: (1200+5000)/1e6*3 + (80+900)/1e6*15 = 0.0186+0.0147 = 0.0333
  // opus 4-1: 8000/1e6*15 + 400/1e6*75 = 0.12+0.03 = 0.15
  assert.match(r.stdout, /\$0\.18/); // 0.0333+0.15 = 0.1833 total
});

test('sessions --json emits structured data', () => {
  const r = runOk(['sessions', '--json']);
  const arr = JSON.parse(r.stdout);
  assert.equal(arr.length, 2);
  const a = arr.find(s => s.id === 'aaa11111');
  assert.equal(a.messages, 3);
  assert.equal(a.inputTokens, 6200);
  assert.equal(a.outputTokens, 980);
  assert.deepEqual(a.models, ['claude-sonnet-4-5']);
});

test('sessions handles missing dirs gracefully', () => {
  const r = spawnSync(process.execPath, [BIN, 'sessions'], {
    env: { ...process.env, SC_CLAUDE_DIR: path.join(tmp, 'nope'), SC_CODEX_DIR: path.join(tmp, 'nope2'), SC_CONFIG_DIR: config },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /no session transcripts found/);
});

test('search finds query with context', () => {
  const r = runOk(['search', 'billing']);
  assert.match(r.stdout, /bbb22222/);
  assert.match(r.stdout, /billing webhook/);
  const none = runOk(['search', 'zzz-no-such-term']);
  assert.match(none.stdout, /no matches/);
});

test('cost breaks down by project and model', () => {
  const r = runOk(['cost', '--days', '365']);
  assert.match(r.stdout, /my-project/);
  assert.match(r.stdout, /claude-sonnet-4-5/);
  assert.match(r.stdout, /claude-opus-4-1/);
  assert.match(r.stdout, /by day/);
  const f = runOk(['cost', '--days', '365', '--project', 'my-project']);
  assert.match(f.stdout, /2 sessions/);
});

test('snapshot writes, dedupes, restores', () => {
  const dir = path.join(tmp, 'proj');
  fs.mkdirSync(dir, { recursive: true });
  runOk(['snapshot', '--plan', 'ship it', '--todos', '1. build 2. push', '--dir', dir]);
  const snapDir = path.join(dir, '.claude', 'snapshots');
  assert.equal(fs.readdirSync(snapDir).length, 1);
  // identical snapshot dedupes
  const r2 = run(['snapshot', '--plan', 'ship it', '--todos', '1. build 2. push', '--dir', dir]);
  assert.match(r2.stderr, /identical to newest/);
  assert.equal(fs.readdirSync(snapDir).length, 1);
  const latest = runOk(['snapshot', '--latest', '--dir', dir]);
  assert.match(latest.stdout, /ship it/);
  // empty snapshot skipped
  const r3 = run(['snapshot', '--dir', dir]);
  assert.match(r3.stderr, /nothing captured/);
});

test('lint-rules flags contradiction, vague rule, stale path', () => {
  const repo = path.join(FIX, 'lintrepo');
  const r = spawnSync(process.execPath, [BIN, 'lint-rules', repo], { env: env(), encoding: 'utf8' });
  assert.equal(r.status, 1); // errors -> exit 1
  assert.match(r.stdout, /says "use npm" but repo uses pnpm/);
  assert.match(r.stdout, /vague rule/);
  assert.match(r.stdout, /docs\/legacy\//);
});

test('lint-rules clean dir exits 0', () => {
  const clean = path.join(tmp, 'clean');
  fs.mkdirSync(clean, { recursive: true });
  fs.writeFileSync(path.join(clean, 'MUSE.md'), 'Run tests with `npm test`.\n');
  fs.writeFileSync(path.join(clean, 'package.json'), '{}');
  const r = spawnSync(process.execPath, [BIN, 'lint-rules', clean], { env: env(), encoding: 'utf8' });
  assert.equal(r.status, 0);
});

function activatePro() {
  fs.mkdirSync(config, { recursive: true });
  fs.writeFileSync(path.join(config, 'license.json'), JSON.stringify({
    key: 'test…key', keyFingerprint: 'test…key', instanceId: 'inst-test',
    activatedAt: new Date().toISOString(), lastCheck: Date.now(), apiBase: 'x',
  }));
}

test('pro commands locked without license', () => {
  const r = run(['export', '--format', 'json']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Pro command/);
});

test('export csv/json/md work when licensed', () => {
  activatePro();
  const j = runOk(['export', '--format', 'json']);
  assert.equal(JSON.parse(j.stdout).length, 2);
  const c = runOk(['export', '--format', 'csv']);
  assert.match(c.stdout, /^"date","project"/);
  assert.match(c.stdout, /aaa11111/);
  const m = runOk(['export', '--format', 'md']);
  assert.match(m.stdout, /Session Commander export/);
});

test('report summarizes spend', () => {
  activatePro();
  const r = runOk(['report', '--days', '365']);
  assert.match(r.stdout, /total: \*\*\$\d/);
  assert.match(r.stdout, /Most expensive sessions/);
  assert.match(r.stdout, /Per-model split/);
  assert.match(r.stdout, /Top projects/);
});

test('sync-rules export/import round-trips with backup', () => {
  activatePro();
  const bundle = path.join(tmp, 'rules-bundle.json');
  runOk(['sync-rules', 'export', '--dir', path.join(FIX, 'syncsrc'), '--out', bundle]);
  const b = JSON.parse(fs.readFileSync(bundle, 'utf8'));
  assert.ok(b.files['MUSE.md'].includes('machine A'));
  const target = path.join(tmp, 'machineB');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'MUSE.md'), '# machine B local rules\n');
  const r = runOk(['sync-rules', 'import', bundle, '--dir', target]);
  assert.match(r.stdout, /imported: MUSE.md/);
  assert.ok(fs.existsSync(path.join(target, 'MUSE.md.bak')));
  assert.match(fs.readFileSync(path.join(target, 'MUSE.md'), 'utf8'), /machine A/);
});

test('status shows Free without license', () => {
  const r = runOk(['status']);
  assert.match(r.stdout, /plan: Free/);
});

test('every command answers --help', () => {
  for (const c of ['sessions', 'search', 'cost', 'snapshot', 'lint-rules', 'export', 'report', 'sync-rules', 'activate']) {
    const r = runOk([c, '--help']);
    assert.ok(r.stdout.length > 20, c);
  }
});

test('license API response shapes parse correctly (live shape, 2026-09-29)', () => {
  const L = require('../lib/license.js');
  // real /activate success shape
  let r = L.parseActivateResponse({ activated: true, instance: { id: 'i-1' }, license_key: {} });
  assert.equal(r.valid, true); assert.equal(r.instanceId, 'i-1');
  // real /activate error shape
  r = L.parseActivateResponse({ activated: false, error: 'No valid license key' });
  assert.equal(r.valid, false);
  // old (wrong) REST shape must NOT validate
  r = L.parseActivateResponse({ data: { attributes: { valid: true } } });
  assert.equal(r.valid, false);
  // real /validate success shape
  assert.equal(L.parseValidateResponse({ valid: true, instance: { id: 'i-2' } }).valid, true);
  // real /validate failure shape
  assert.equal(L.parseValidateResponse({ valid: false }).valid, false);
  // real /deactivate shape
  assert.equal(L.parseDeactivateResponse({ deactivated: true }).deactivated, true);
  assert.equal(L.parseDeactivateResponse({ deactivated: false, error: 'No valid instance' }).deactivated, false);
});
