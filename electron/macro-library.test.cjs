const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createMacroLibrary } = require('./macro-library.cjs');
(async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'macro-library-'));
  try {
    const folder = path.join(temporary, 'Makros mit Leerzeichen'), sub = path.join(folder, 'Unterordner');
    await fs.mkdir(sub, { recursive: true });
    await fs.writeFile(path.join(folder, 'Fenster.EMA'), 'ema-content');
    await fs.writeFile(path.join(sub, 'Seite.ems'), 'ems-content');
    await fs.writeFile(path.join(folder, 'ignore.txt'), 'ignored');
    const huge = path.join(folder, 'gross.ema'); await fs.writeFile(huge, ''); await fs.truncate(huge, 33 * 1024 * 1024);
    const settings = path.join(temporary, 'user-data', 'macro-library.json');
    const library = createMacroLibrary(settings);
    assert.equal(await library.getFolder(), ''); await library.setFolder(folder);
    assert.equal(await createMacroLibrary(settings).getFolder(), await fs.realpath(folder), 'Path survives creating a new app service');
    let listing = await library.list(); assert.deepEqual(listing.files.map(f => f.relativePath), ['Fenster.EMA', 'Unterordner/Seite.ems']); assert.equal(listing.issues.length, 1);
    assert.equal(Buffer.from((await library.read('Unterordner/Seite.ems')).data).toString(), 'ems-content');
    await assert.rejects(() => library.read('../outside.ema')); await assert.rejects(() => library.read(path.join(folder, 'Fenster.EMA')));
    await assert.rejects(() => library.read('ignore.txt')); await assert.rejects(() => library.read('gross.ema'));
    await assert.rejects(() => library.setFolder(path.join(temporary, 'nicht-vorhanden'))); assert.equal(await library.getFolder(), await fs.realpath(folder));
    if (process.platform !== 'win32') {
      const outside = path.join(temporary, 'outside.ema'); await fs.writeFile(outside, 'outside');
      await fs.symlink(outside, path.join(folder, 'link.ema')); await fs.symlink(temporary, path.join(folder, 'cycle'));
      assert.equal((await library.list()).files.length, 2); await assert.rejects(() => library.read('link.ema'));
      assert.equal((await fs.stat(settings)).mode & 0o777, 0o600);
    }
    await fs.unlink(path.join(folder, 'Fenster.EMA')); await fs.writeFile(path.join(sub, 'Neu.ema'), 'new');
    listing = await library.list(); assert.deepEqual(listing.files.map(f => f.relativePath), ['Unterordner/Neu.ema', 'Unterordner/Seite.ems']);
    // Exercise the real main/preload wiring with Electron's dialogs mocked.
    const vm = require('node:vm'), handlers = new Map(), channels = [];
    let bridge;
    const fakeElectron = {
      app: { getPath: () => path.dirname(settings), whenReady: () => ({ then: () => {} }), on: () => {} },
      ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
      dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [folder] }) },
      contextBridge: { exposeInMainWorld: (_name, api) => bridge = api },
      ipcRenderer: { invoke: (channel, ...args) => { channels.push(channel); return handlers.get(channel)({}, ...args); }, on: () => {} }
    };
    const context = { require: id => id === 'electron' ? fakeElectron : id === './macro-library.cjs' ? require('./macro-library.cjs') : require(id), __dirname, process, Buffer };
    vm.runInNewContext(await fs.readFile(path.join(__dirname,'main.cjs'),'utf8'),context);
    vm.runInNewContext(await fs.readFile(path.join(__dirname,'preload.cjs'),'utf8'),{...context});
    await bridge.macroLibrary.setFolder(folder); assert.equal(await bridge.macroLibrary.getFolder(),await fs.realpath(folder));
    assert.equal(await bridge.macroLibrary.chooseFolder(),await fs.realpath(folder));
    assert.equal((await bridge.macroLibrary.list()).files.length,2);
    assert.equal(Buffer.from((await bridge.macroLibrary.read('Unterordner/Seite.ems')).data).toString(),'ems-content');
    assert.equal(channels.length,5);
    await library.setFolder(''); assert.equal(await library.getFolder(), ''); assert.equal((await library.list()).files.length, 0);
    assert.equal(await fs.readFile(path.join(sub, 'Seite.ems'), 'utf8'), 'ems-content', 'Disconnect never changes source macros');
    console.log('Native macro library: persisted path, nested scan, update/removal, file bounds, symlinks and read-only source passed');
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
