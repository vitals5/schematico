import { legacyMacroDatabase } from './LegacyCompatibility';
import { MacroItem, MacroManager } from './MacroManager';
import { SYMBOL_DEFINITIONS } from './symbols';

type DirectoryEntry = MacroDirectory | { kind: 'file'; name: string; getFile(): Promise<File> };
export interface MacroDirectory {
  kind: 'directory'; name: string;
  values(): AsyncIterable<DirectoryEntry>;
  queryPermission?(options: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(options: { mode: 'read' }): Promise<PermissionState>;
}
export interface NativeMacroLibrary {
  getFolder(): Promise<string>;
  setFolder(path: string): Promise<string>;
  chooseFolder(): Promise<string | null>;
  list(): Promise<{ path: string; files: { relativePath: string; size: number; lastModified: number }[]; issues: string[] }>;
  read(path: string): Promise<{ name: string; data: Uint8Array; lastModified: number }>;
}
type SavedFolder = { name: string; handle?: MacroDirectory };
export interface FolderStore { get(): Promise<SavedFolder | undefined>; put(value?: SavedFolder): Promise<void> }
export type MacroFolderState = { path: string; busy: boolean; needsAccess: boolean; fileCount: number; macroCount: number; issues: string[]; error: string };
const supported = (name: string) => /\.(ema|ems)$/i.test(name);
const maxSize = 32 * 1024 * 1024;

/** Structured cloning in IndexedDB retains a browser directory grant, not just its name. */
export class BrowserFolderStore implements FolderStore {
  private async transaction<T>(write: boolean, action: (store: IDBObjectStore) => IDBRequest<T>, name='schematico-macro-library'): Promise<T> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('settings');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Der Browserspeicher ist blockiert.'));
    });
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', write ? 'readwrite' : 'readonly'), request = action(tx.objectStore('settings'));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || request.error); };
    });
  }
  async get():Promise<SavedFolder|undefined> {
    const current=await this.transaction(false,store=>store.get('folder')) as SavedFolder|undefined;if(current)return current;
    const old=await this.transaction(false,store=>store.get('folder'),legacyMacroDatabase) as SavedFolder|undefined;
    if(old){await this.put(old);await this.transaction(true,store=>store.delete('folder'),legacyMacroDatabase);}return old;
  }
  async put(value?: SavedFolder) { if (value) await this.transaction(true, store => store.put(value, 'folder')); else await this.transaction(true, store => store.delete('folder')); }
}

type SourceFile = { relativePath: string; getFile(): Promise<File> };
export async function scanMacroDirectory(folder: MacroDirectory): Promise<{ files: SourceFile[]; issues: string[] }> {
  const files: SourceFile[] = [], issues: string[] = []; let folders = 0;
  const visit = async (directory: MacroDirectory, relative = '') => {
    if (++folders > 10000) throw new Error('Der Makroordner enthält zu viele Unterordner.');
    try {
      for await (const entry of directory.values()) {
        const path = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.kind === 'directory') await visit(entry, path);
        else if (supported(entry.name)) {
          if (files.length >= 5000) throw new Error('Der Makroordner enthält mehr als 5000 Makrodateien.');
          files.push({ relativePath: path, getFile: () => entry.getFile() });
        }
      }
    } catch (error) {
      if (!relative || error instanceof Error && /zu viele|mehr als/.test(error.message)) throw error;
      issues.push(`${relative}: Unterordner nicht lesbar.`);
    }
  };
  await visit(folder);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'de', { numeric: true }));
  return { files, issues };
}

export class ExternalMacroLibrary {
  state: MacroFolderState = { path: '', busy: false, needsAccess: false, fileCount: 0, macroCount: 0, issues: [], error: '' };
  private handle?: MacroDirectory;
  private files?: File[];
  private revision = 0;
  private listeners = new Set<() => void>();
  constructor(readonly native?: NativeMacroLibrary, private store: FolderStore = new BrowserFolderStore()) {}
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit() { for (const listener of this.listeners) listener(); }
  private fail(error: unknown) { this.state.busy = false; this.state.error = error instanceof Error ? error.message : 'Der Makroordner kann nicht gelesen werden.'; this.emit(); }
  async restore(): Promise<void> {
    const revision = ++this.revision;
    try {
      if (this.native) {
        const path = await this.native.getFolder(); if (revision !== this.revision) return;
        this.state.path = path;
      } else {
        const saved = await this.store.get(); if (revision !== this.revision) return;
        this.state.path = saved?.name || ''; this.handle = saved?.handle;
      }
      if (this.state.path) await this.refresh(false); else this.emit();
    } catch (error) { if (revision === this.revision) this.fail(error); }
  }
  async setNativeFolder(path: string): Promise<void> {
    if (!this.native) return;
    const revision = ++this.revision;
    this.state.busy = true; this.emit();
    try {
      const folder = await this.native.setFolder(path); if (revision !== this.revision) return;
      this.state.path = folder; await this.refresh(false);
    } catch (error) { if (revision === this.revision) this.fail(error); }
  }
  async choose(): Promise<void> {
    let persistenceError = '';
    try {
      if (this.native) {
        const path = await this.native.chooseFolder(); if (path === null) return;
        this.state.path = path;
      } else {
        // Invoke the picker directly from the button gesture.
        const picker = (window as unknown as { showDirectoryPicker(options: { mode: 'read' }): Promise<MacroDirectory> }).showDirectoryPicker;
        const handle = await picker.call(window, { mode: 'read' });
        this.handle = handle; this.files = undefined; this.state.path = handle.name;
        try { await this.store.put({ name: handle.name, handle }); }
        catch { persistenceError = 'Der Ordnerzugriff kann in diesem Browser nicht dauerhaft gespeichert werden.'; }
      }
      await this.refresh(false);
      if (persistenceError && !this.state.error) { this.state.error = persistenceError; this.emit(); }
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) this.fail(error); }
  }
  async selectFiles(files: File[]): Promise<void> {
    if (!files.length) return;
    this.files = files; this.handle = undefined;
    this.state.path = files[0].webkitRelativePath.split('/')[0] || 'Ausgewählter Ordner';
    try { await this.store.put({ name: this.state.path }); } catch { /* The selected files still work for this session. */ }
    await this.refresh(false);
  }
  async disconnect(): Promise<void> {
    ++this.revision;
    try { if (this.native) await this.native.setFolder(''); else await this.store.put(); }
    catch (error) { this.fail(error); return; }
    this.handle = undefined; this.files = undefined; MacroManager.setExternalMacros([]);
    this.state = { path: '', busy: false, needsAccess: false, fileCount: 0, macroCount: 0, issues: [], error: '' }; this.emit();
  }
  async refresh(requestAccess = true): Promise<void> {
    const revision = ++this.revision;
    this.state = { ...this.state, busy: true, needsAccess: false, issues: [], error: '', fileCount: 0, macroCount: 0 };
    MacroManager.setExternalMacros([]); this.emit();
    try {
      let source: { files: SourceFile[]; issues: string[] };
      if (!this.state.path) { this.state.busy = false; this.emit(); return; }
      if (this.native) {
        const listing = await this.native.list();
        source = { issues: listing.issues, files: listing.files.map(entry => ({ relativePath: entry.relativePath, getFile: async () => {
          const data = await this.native!.read(entry.relativePath);
          return new File([new Uint8Array(data.data)], data.name, { lastModified: data.lastModified });
        } })) };
      } else if (this.handle) {
        let permission = await this.handle.queryPermission?.({ mode: 'read' }) ?? 'granted';
        if (permission !== 'granted' && requestAccess) permission = await this.handle.requestPermission?.({ mode: 'read' }) ?? permission;
        if (revision !== this.revision) return;
        if (permission !== 'granted') { this.state.needsAccess = true; this.state.busy = false; this.emit(); return; }
        source = await scanMacroDirectory(this.handle);
      } else if (this.files) {
        source = { files: this.files.filter(f => supported(f.name)).map(file => ({ relativePath: file.webkitRelativePath.split('/').slice(1).join('/') || file.name, getFile: async () => file })), issues: [] };
      } else { this.state.needsAccess = true; this.state.busy = false; this.emit(); return; }
      const macros: MacroItem[] = [], issues = [...source.issues];
      for (const entry of source.files) {
        if (revision !== this.revision) return;
        try {
          const file = await entry.getFile(); if (file.size > maxSize) throw new Error('Datei ist größer als 32 MB.');
          const macro = await MacroManager.parseMacroFile(file, { allowHeuristic: false });
          this.validate(macro);
          macros.push({ ...macro, id: `external:${encodeURIComponent(entry.relativePath)}`, externalPath: entry.relativePath, isBuiltIn: false });
        } catch (error) { issues.push(`${entry.relativePath}: ${error instanceof Error ? error.message : 'Datei nicht lesbar.'}`); }
      }
      if (revision !== this.revision) return;
      MacroManager.setExternalMacros(macros);
      this.state = { ...this.state, busy: false, fileCount: source.files.length, macroCount: macros.length, issues }; this.emit();
    } catch (error) { if (revision === this.revision) this.fail(error); }
  }
  private validate(macro: MacroItem): void {
    if (macro.unitsPerMm !== undefined && (!Number.isFinite(macro.unitsPerMm) || macro.unitsPerMm <= 0)) throw new Error('Ungültiger Makromaßstab.');
    if (macro.type === 'ema' && (!Number.isFinite(macro.width) || macro.width <= 0 || !Number.isFinite(macro.height) || macro.height <= 0)) throw new Error('Ungültige Makrogröße.');
    const components = macro.type === 'ems' ? macro.page?.components : macro.components;
    if (typeof macro.name !== 'string' || typeof macro.category !== 'string' || typeof macro.description !== 'string') throw new Error('Ungültige Makrobeschreibung.');
    if (macro.type === 'ems' && (!macro.page || !Array.isArray(macro.page.wires) || !Number.isFinite(macro.page.plotFrame?.width)
      || !Number.isFinite(macro.page.plotFrame?.height))) throw new Error('Ungültige Seitendaten im Makro.');
    const hasPageGraphics = macro.type === 'ems' ? (macro.page.images?.length || macro.page.texts?.length || macro.page.boxes?.length || macro.page.cables?.length) : macro.images?.length || macro.cables?.length || macro.boxes?.length;
    if (!Array.isArray(components) || !components.length && !hasPageGraphics) throw new Error('Das Makro enthält keine unterstützten Elemente.');
    const ids = new Set<string>();
    for (const c of components) {
      if (!c || typeof c.bmk !== 'string' || typeof c.functionText !== 'string' || typeof c.id !== 'string' || typeof c.symbolId !== 'string' || !Number.isFinite(c.x) || !Number.isFinite(c.y)
        || ![0, 90, 180, 270].includes(c.rotation) || !c.pins || typeof c.pins !== 'object') throw new Error('Ungültige Elementdaten im Makro.');
      if (ids.has(c.id)) throw new Error('Doppelte Elementkennung im Makro.');
      ids.add(c.id);
      if (!c.importedSymbol && !macro.symbolLibrary?.some(s => s.id === c.symbolId) && !SYMBOL_DEFINITIONS.some(s => s.id === c.symbolId))
        throw new Error(`Bibliothekssymbol „${c.symbolId}“ fehlt im Makro.`);
    }
    const wires = macro.type === 'ems' ? macro.page.wires : macro.wires || [];
    if (!Array.isArray(wires) || wires.some(w => !ids.has(w.from?.componentId) || !ids.has(w.to?.componentId)))
      throw new Error('Eine Verbindung verweist auf ein fehlendes Element im Makro.');
  }
}
export const externalMacroLibrary = new ExternalMacroLibrary(typeof window === 'undefined' ? undefined : (window as unknown as { electronAPI?: { macroLibrary?: NativeMacroLibrary } }).electronAPI?.macroLibrary);
