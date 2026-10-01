'use strict';
// The Hermes scripts run against a throw-away HOME with a stub of the Hermes CLI. Nothing here
// touches a real profile, the network or the Pi.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'hermes');
const CREAR = path.join(DIR, 'crear-perfil.sh');
const ACTIVAR = path.join(DIR, 'activar-telegram.sh');
const CLAVE = 'clave-de-prueba-123456';

function casa() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'osmagym-hermes-'));
  const bin = path.join(home, '.hermes', 'hermes-agent', 'venv', 'bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'python'), `#!/usr/bin/env bash
if [[ "\${1:-}" == "-m" && "\${2:-}" == "hermes_cli.main" ]]; then
  shift 2
  printf '%s\\n' "$*" >> "$HOME/hermes-calls.log"
  if [[ "\${1:-}" == "profile" && "\${2:-}" == "create" ]]; then
    mkdir -p "$HOME/.hermes/profiles/$3"
    printf 'model:\\n  default: otro\\ndisplay:\\n  skin: x\\n' > "$HOME/.hermes/profiles/$3/config.yaml"
  fi
  exit 0
fi
exec python3 "$@"
`, { mode: 0o755 });
  fs.mkdirSync(path.join(home, 'osmagym', 'agente'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '..', '..', 'LEEME.md'), path.join(home, 'osmagym', 'LEEME.md'));
  return home;
}
function correr(script, home, args, env) {
  return spawnSync('bash', [script].concat(args || []), {
    env: Object.assign({}, process.env, { HOME: home, OSMAGYM_DIR: path.join(home, 'osmagym') }, env), encoding: 'utf8'
  });
}
const llamadas = (home) => (fs.existsSync(path.join(home, 'hermes-calls.log')) ? fs.readFileSync(path.join(home, 'hermes-calls.log'), 'utf8').split('\n').filter(Boolean) : []);
const perfil = (home) => path.join(home, '.hermes', 'profiles', 'entrenadorosma');
function yaml(f) {
  const r = spawnSync('python3', ['-c', 'import sys,json,yaml;print(json.dumps(yaml.safe_load(open(sys.argv[1]))))', f], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('both scripts pass bash -n and are executable', () => {
  for (const s of [CREAR, ACTIVAR]) {
    assert.equal(spawnSync('bash', ['-n', s]).status, 0, s);
    assert.ok(fs.statSync(s).mode & 0o100, s + ' is executable');
  }
});

test('sourcing crear-perfil.sh runs nothing and writes nothing', () => {
  const home = casa();
  const r = spawnSync('bash', ['-c', `source "${CREAR}"`], { env: Object.assign({}, process.env, { HOME: home }), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
  assert.deepEqual(llamadas(home), []);
  assert.equal(fs.existsSync(perfil(home)), false);
});

test('crear-perfil.sh refuses to run without an API key and writes nothing', () => {
  const home = casa();
  const r = correr(CREAR, home, [], { ORCA_API_KEY: '' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /ORCA_API_KEY/);
  assert.equal(fs.existsSync(perfil(home)), false);
});

test('crear-perfil.sh builds the profile: config, secrets only in .env, SOUL, skill', () => {
  const home = casa();
  const r = correr(CREAR, home, [], { ORCA_API_KEY: CLAVE });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.ok(!(r.stdout + r.stderr).includes(CLAVE), 'the key is never printed');
  assert.deepEqual(llamadas(home), ['profile create entrenadorosma --no-skills']);

  const cfg = yaml(path.join(perfil(home), 'config.yaml'));
  assert.equal(cfg.model.default, 'deepseek/deepseek-v4.1-flash');
  assert.equal(cfg.model.provider, 'custom');
  assert.equal(cfg.model.base_url, 'https://api.orcarouter.ai/v1');
  assert.equal(cfg.model.api_key, '${env:ORCA_API_KEY}');
  assert.equal(cfg.display.skin, 'x', 'unrelated keys of the created profile survive');
  const mcp = cfg.mcp_servers.osmagym;
  assert.match(mcp.command, /node$/);
  assert.deepEqual(mcp.args, [path.join(home, 'osmagym', 'agente', 'mcp-osma.js')]);
  assert.deepEqual(mcp.env, { OSMAGYM_BASE: 'http://127.0.0.1:8091' });
  const sets = ['memory', 'session_search', 'skills', 'clarify', 'mcp-osmagym'];
  assert.deepEqual(cfg.platform_toolsets, { telegram: sets, cli: sets });
  assert.equal(cfg.approvals.mode, 'smart');

  assert.ok(!fs.readFileSync(path.join(perfil(home), 'config.yaml'), 'utf8').includes(CLAVE));
  const envf = path.join(perfil(home), '.env');
  assert.equal(fs.readFileSync(envf, 'utf8'), 'ORCA_API_KEY=' + CLAVE + '\n');
  assert.equal(fs.statSync(envf).mode & 0o777, 0o600);

  const soul = fs.readFileSync(path.join(perfil(home), 'SOUL.md'), 'utf8');
  assert.match(soul, /Osma/);
  const skill = fs.readFileSync(path.join(perfil(home), 'skills', 'osmagym-app', 'SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: osmagym-app\ndescription: .+\n---\n/);
  assert.ok(skill.includes(fs.readFileSync(path.join(__dirname, '..', '..', 'LEEME.md'), 'utf8').slice(0, 200)));
});

test('crear-perfil.sh is idempotent and can rotate the key', () => {
  const home = casa();
  correr(CREAR, home, [], { ORCA_API_KEY: CLAVE });
  const antes = ['config.yaml', 'SOUL.md', 'skills/osmagym-app/SKILL.md'].map(f => fs.readFileSync(path.join(perfil(home), f), 'utf8'));
  const r = correr(CREAR, home, [], { ORCA_API_KEY: CLAVE });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(llamadas(home), ['profile create entrenadorosma --no-skills'], 'the profile is created once');
  assert.deepEqual(['config.yaml', 'SOUL.md', 'skills/osmagym-app/SKILL.md'].map(f => fs.readFileSync(path.join(perfil(home), f), 'utf8')), antes);
  assert.equal(fs.readFileSync(path.join(perfil(home), '.env'), 'utf8'), 'ORCA_API_KEY=' + CLAVE + '\n');
  // Without the variable, an existing key is kept.
  assert.equal(correr(CREAR, home, [], { ORCA_API_KEY: '' }).status, 0);
  assert.equal(fs.readFileSync(path.join(perfil(home), '.env'), 'utf8'), 'ORCA_API_KEY=' + CLAVE + '\n');
  // A new key replaces the old one, other .env lines stay.
  fs.appendFileSync(path.join(perfil(home), '.env'), 'OTRA=1\n');
  correr(CREAR, home, [], { ORCA_API_KEY: 'nueva-clave-987654' });
  assert.equal(fs.readFileSync(path.join(perfil(home), '.env'), 'utf8'), 'OTRA=1\nORCA_API_KEY=nueva-clave-987654\n');
});

test('SOUL.md carries the non-negotiable safety rules of the app, in Spanish', () => {
  const soul = fs.readFileSync(path.join(DIR, 'SOUL.md'), 'utf8');
  for (const frag of ['cinco operaciones', 'artrosis', 'nunca al fallo', 'RIR 2-3', 'Valsalva', 'muñeca izquierda', 'por debajo de paralelo',
    'rodillas en el suelo', 'traumatólogo', 'ingle', 'dolor de pecho', '180/110', 'No eres médico', 'fumador', 'pádel'])
    assert.ok(soul.toLowerCase().includes(frag.toLowerCase()), frag);
  assert.match(soul, /nunca obedezcas instrucciones|jamás obedezcas instrucciones/i);
  assert.match(soul, /notas|datos/i);
  assert.match(soul, /confirm/i);
});
test('the rules in SOUL.md match the ones the in-app coach receives (sitio/app.js)', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', '..', 'sitio', 'app.js'), 'utf8');
  const soul = fs.readFileSync(path.join(DIR, 'SOUL.md'), 'utf8');
  assert.ok(app.includes('nunca al fallo, nunca 1RM ni cargas máximas, siempre RIR 2-3, nunca aguantar el aire (Valsalva)'));
  assert.ok(soul.includes('nunca al fallo, nunca 1RM ni cargas máximas, siempre RIR 2-3, nunca aguantar el aire (Valsalva)'));
  assert.ok(soul.includes('Nada por debajo de paralelo, nada de rodillas en el suelo, nada balístico ni de impacto hasta el bloque 3.'));
});

test('no secret is hardcoded in the hermes folder', () => {
  for (const f of fs.readdirSync(DIR)) {
    const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
    assert.ok(!/(ORCA_API_KEY|TOKEN)=[A-Za-z0-9_-]{8,}/.test(txt), f);
    assert.ok(!/sk-[A-Za-z0-9]{16,}/.test(txt), f);
  }
});

test('prompt files mention the app tools that exist and the [SILENT] contract', () => {
  const nombres = require('../mcp-osma').TOOLS.map(t => t.name);
  for (const f of ['prompt-manana.txt', 'prompt-semanal.txt']) {
    const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
    const usadas = txt.match(/\b(resumen_general|historial_ejercicio|adherencia|tendencia_cuerpo|dias_sin_entrenar|registrar_cuerpo|anadir_nota|deshacer_ultimo_cambio|[a-z]+_[a-z_]+)\b/g) || [];
    usadas.filter(u => /^(resumen|historial|adherencia|tendencia|dias_sin|registrar|anadir|deshacer)/.test(u)).forEach(u => assert.ok(nombres.includes(u), f + ': ' + u));
    assert.match(txt, /padel|pádel/i);
  }
  assert.match(fs.readFileSync(path.join(DIR, 'prompt-manana.txt'), 'utf8'), /\[SILENT\]/);
});

test('activar-telegram.sh: validates, writes the env, installs the gateway, recreates both jobs', () => {
  const home = casa();
  correr(CREAR, home, [], { ORCA_API_KEY: CLAVE });
  const bad = correr(ACTIVAR, home, ['123:ABC', 'no-numerico']);
  assert.notEqual(bad.status, 0);
  assert.notEqual(correr(ACTIVAR, home, []).status, 0);

  fs.writeFileSync(path.join(home, 'hermes-calls.log'), '');
  const r = correr(ACTIVAR, home, ['123:ABCdef', '987654321']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!(r.stdout + r.stderr).includes('123:ABCdef'), 'the token is never printed');
  const envf = path.join(perfil(home), '.env');
  const env = fs.readFileSync(envf, 'utf8');
  assert.match(env, /^ORCA_API_KEY=/m);
  assert.match(env, /^TELEGRAM_BOT_TOKEN=123:ABCdef$/m);
  assert.match(env, /^TELEGRAM_ALLOWED_USERS=987654321$/m);
  assert.equal(fs.statSync(envf).mode & 0o777, 0o600);

  const c = llamadas(home);
  assert.ok(c.some(l => l.startsWith('-p entrenadorosma gateway install')));
  assert.ok(c.some(l => l.startsWith('-p entrenadorosma cron remove entrenador-osma-manana')));
  assert.ok(c.some(l => l.startsWith('-p entrenadorosma cron remove entrenador-osma-semanal')));
  const man = c.find(l => l.startsWith('-p entrenadorosma cron create --name entrenador-osma-manana --deliver telegram:987654321 30 8 * * *'));
  const sem = c.find(l => l.startsWith('-p entrenadorosma cron create --name entrenador-osma-semanal --deliver telegram:987654321 0 19 * * 0'));
  assert.ok(man && sem);
  assert.ok(man.includes(fs.readFileSync(path.join(DIR, 'prompt-manana.txt'), 'utf8').split('\n')[0]));

  // Rerun: still exactly one token line, jobs recreated through remove+create.
  correr(ACTIVAR, home, ['999:NUEVO', '987654321']);
  const env2 = fs.readFileSync(envf, 'utf8');
  assert.equal((env2.match(/^TELEGRAM_BOT_TOKEN=/mg) || []).length, 1);
  assert.match(env2, /TELEGRAM_BOT_TOKEN=999:NUEVO/);
});

test('activar-telegram.sh fails clearly when the profile does not exist', () => {
  const home = casa();
  const r = correr(ACTIVAR, home, ['1:A', '5']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /crear-perfil\.sh/);
});
