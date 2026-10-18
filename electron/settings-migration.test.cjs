const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrateMacroSettings, formerProfiles } = require('./settings-migration.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'schematico-settings-'));
try {
  const old = path.join(root, formerProfiles[0]), current = path.join(root, 'Schematico');
  fs.mkdirSync(old); const original = path.join(old, 'macro-library.json');
  fs.writeFileSync(original, JSON.stringify({ path: 'C:\\Eigene Makros' }));
  assert(migrateMacroSettings(root, current));
  assert.equal(JSON.parse(fs.readFileSync(path.join(current, 'macro-library.json'))).path, 'C:\\Eigene Makros');
  assert(fs.existsSync(original));
  fs.writeFileSync(path.join(current, 'macro-library.json'), JSON.stringify({ path: '' }));
  assert(!migrateMacroSettings(root, current), 'An intentionally disconnected folder must stay disconnected');
  assert.equal(JSON.parse(fs.readFileSync(path.join(current, 'macro-library.json'))).path, '');
  fs.rmSync(current, { recursive: true }); fs.writeFileSync(original, 'invalid');
  assert(!migrateMacroSettings(root, current));
  console.log('✓ Desktop macro-folder settings migrate once, preserve source data and respect new preferences');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
