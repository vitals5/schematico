import JSZip from 'jszip';
import { EodRecord, readIndexedEodRecords, nativeText } from './EodReader';
import type { ImportedArticleMaster, ImportedArticleReference, PlacedComponent, Project } from '../model/types';
const layouts = { Article: { size: 1940, typedIndex: false }, ArticleRef: { size: 667, typedIndex: false } } as const;
/** Walk the observed top-level field grammar. Unknown tags fail closed instead
 * of searching for article-looking bytes inside text, coordinates or properties. */
function header(r: EodRecord): {
    fields: Map<number, Uint8Array>;
    propertyStart: number;
} | undefined {
    const fields = new Map<number, Uint8Array>(), strings = new Set([0xee2c, 0xee2d, 0xee2e, 0xee30, 0xee31, 0xf259, 0xf25a, 0xef59, 0xef5a]);
    const sizes = new Map<number, number>([[0xea63, 2], [0xf266, 8], [0xf268, 4], [0xef58, 2], [0xef5b, 4], [0xef5e, 1], [0xef5f, 4], [0xef61, 16], [0xefc5, 2], [0xefc6, 2], [0xefc7, 2], ...[0xee36, 0xee38, 0xee39, 0xee3d, 0xee3f, 0xee40, 0xef57, 0xef60].map(tag => [tag, 6] as [
            number,
            number
        ])]);
    let at = 8;
    for (let count = 0; count < 64 && at + 2 <= r.data.length; count++) {
        const tag = r.data[at] | r.data[at + 1] << 8;
        at += 2;
        if (tag === 0xea6b)
            return { fields, propertyStart: at };
        if (fields.has(tag))
            return;
        if (strings.has(tag)) {
            const end = r.data.indexOf(0, at);
            if (end < at || end - at > 8192)
                return;
            const value = r.data.subarray(at, end);
            try {
                new TextDecoder('utf-8', { fatal: true }).decode(value);
            }
            catch {
                return;
            }
            fields.set(tag, value);
            at = end + 1;
        }
        else {
            const length = sizes.get(tag);
            if (length === undefined || at + length > r.data.length)
                return;
            fields.set(tag, r.data.subarray(at, at + length));
            at += length;
        }
    }
}
function field(r: EodRecord, tag: number, _skip = 2, properties = false): string | undefined {
    const h = header(r);
    if (!h)
        return;
    if (!properties) {
        const value = h.fields.get(tag);
        return value === undefined ? undefined : new TextDecoder('utf-8', { fatal: true }).decode(value);
    }
    let at = h.propertyStart;
    for (let count = 0; count < 4096 && at + 4 <= r.data.length; count++) {
        const id = r.data[at] | r.data[at + 1] << 8;
        if (id === 0xffff)
            return;
        if (r.data[at + 2] !== 0 || r.data[at + 3] !== 0)
            return;
        const end = r.data.indexOf(0, at + 4);
        if (end < at + 4)
            return;
        if (id === tag) {
            try {
                return new TextDecoder('utf-8', { fatal: true }).decode(r.data.subarray(at + 4, end));
            }
            catch {
                return;
            }
        }
        at = end + 1;
    }
}
function integer(r: EodRecord, tag: number, width: 2 | 4, skip = 2): number | undefined {
    const value = header(r)?.fields.get(tag), offset = skip - 2;
    if (!value || offset + width > value.length)
        return;
    const d = new DataView(value.buffer, value.byteOffset + offset, width);
    return width === 2 ? d.getUint16(0, true) : d.getUint32(0, true);
}
const key = (number: string, variant: string) => JSON.stringify([number, variant]);
export class NativeArticles {
    readonly library: ImportedArticleMaster[] = [];
    readonly references: ImportedArticleReference[] = [];
    readonly messages: string[] = [];
    private byOwner = new Map<string, {
        ids: number[];
        refs: ImportedArticleReference[];
    }>();
    private constructor() { }
    static async read(zip: JSZip, root: string): Promise<NativeArticles> {
        const reader = new NativeArticles();
        const load = async (name: keyof typeof layouts) => {
            const data = zip.file(root + name + '.eod'), index = zip.file(root + name + '.eox');
            if (!data || !index) {
                reader.messages.push(`${name}: Artikeldatenquelle fehlt; Herkunft bleibt unbekannt.`);
                return undefined;
            }
            const bytes = await data.async('uint8array');
            if (bytes.length % layouts[name].size !== 0) {
                reader.messages.push(`${name}: unbekanntes Datensatzlayout; keine Artikelzuordnung abgeleitet.`);
                return undefined;
            }
            try {
                return readIndexedEodRecords(bytes, await index.async('uint8array'), layouts[name], name);
            }
            catch {
                reader.messages.push(`${name}: Index nicht lesbar; keine Artikelzuordnung abgeleitet.`);
                return undefined;
            }
        };
        const articleRows = await load('Article'), referenceRows = await load('ArticleRef');
        let incompleteMasters = 0;
        const manufacturers = new Map<string, string>();
        for (const r of articleRows ?? [])
            if (r.type === 135) {
                const code = field(r, 0xf259), name = field(r, 0x597c, 4, true);
                if (code && name)
                    manufacturers.set(code, name);
            }
        for (const r of articleRows ?? [])
            if (r.type === 117) {
                const number = field(r, 0xf259), variant = field(r, 0xf25a);
                if (!number || variant === undefined) {
                    incompleteMasters++;
                    continue;
                }
                const code = field(r, 0x55f7, 4, true), description = field(r, 0x55f4, 4, true);
                reader.library.push({ id: `native-article-${r.type}-${r.id}`, sourceId: r.id, articleNumber: number, variant, manufacturerCode: code,
                    manufacturer: code ? (manufacturers.get(code) ?? code) : undefined, description: description ? nativeText(description) : undefined, partial: r.partial });
            }
        const masters = new Map<string, ImportedArticleMaster[]>();
        for (const master of reader.library) {
            const k = key(master.articleNumber, master.variant);
            masters.set(k, [...(masters.get(k) ?? []), master]);
        }
        let partial = 0, invalid = 0;
        for (const r of referenceRows ?? []) {
            if (r.type !== 68)
                continue;
            if (r.partial) {
                partial++;
                continue;
            }
            if (!header(r)) {
                invalid++;
                continue;
            }
            const ownerType = integer(r, 0xef57, 2), ownerId = integer(r, 0xef57, 4, 4);
            if (ownerType === undefined || ownerId === undefined) {
                invalid++;
                continue;
            }
            const owner = key(String(ownerType), String(ownerId)), number = field(r, 0xef59), variant = field(r, 0xef5a);
            // Absence of an optional part-number field in a complete source record is
            // retained as a checked empty record, never as an empty source database.
            let group = reader.byOwner.get(owner);
            if (!group) {
                group = { ids: [], refs: [] };
                reader.byOwner.set(owner, group);
            }
            group.ids.push(r.id);
            if (!number)
                continue;
            const master = variant === undefined ? undefined : masters.get(key(number, variant));
            const exact = master?.length === 1 ? master[0] : undefined;
            const quantity = integer(r, 0xef5b, 4), position = integer(r, 0xef58, 2);
            const ref: ImportedArticleReference = { sourceId: r.id, ownerType, ownerId, articleNumber: number, variant: variant ?? '', position,
                quantity, manufacturer: exact?.manufacturer, masterDataId: exact?.id };
            group.refs.push(ref);
            reader.references.push(ref);
        }
        reader.messages.push(`${reader.library.filter(m => m.partial).length} Artikelstammsätze enthalten nur einen nachweisbaren Datenpräfix; fehlende Eigenschaften bleiben unbekannt.`);
        reader.messages.push(`${incompleteMasters} Artikelstammsätze mit nicht vollständig lesbarem Kopf bleiben ungeklärt.`);
        reader.messages.push(`${reader.library.length} Artikelstammsätze und ${reader.references.length} benannte Quellreferenzen eingelesen. ${partial} unvollständige und ${invalid} nicht auflösbare Referenzdatensätze bleiben ungeklärt.`);
        return reader;
    }
    bind(component: PlacedComponent): void {
        if (!component.source)
            return;
        const group = this.byOwner.get(key(String(component.source.objectType), String(component.source.objectId)));
        if (!group)
            return;
        component.articleReferences = structuredClone(group.refs.sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.sourceId - b.sourceId));
        const first = group.refs.filter(r => r.position === 1), primary = first.length === 1 ? first[0] : group.refs.length === 1 ? group.refs[0] : undefined;
        component.articleImport = { source: 'native_project', status: 'record_read', referenceIds: [...group.ids], observedArticleNumber: primary?.articleNumber };
        if (!group.refs.length)
            component.articleImport.observedArticleNumber = '';
        if (primary) {
            if (!component.articleNumber?.trim())
                component.articleNumber = primary.articleNumber;
            if (component.articleNumber === primary.articleNumber && primary.manufacturer && !component.manufacturer?.trim())
                component.manufacturer = primary.manufacturer;
        }
    }
    finalize(project: Project): void {
        project.importedArticleLibrary = structuredClone(this.library);
        project.sourceArticleReferences = structuredClone(this.references);
        const linked = new Set(project.pages.flatMap(p => p.components).flatMap(c => c.articleReferences?.map(r => r.sourceId) ?? []));
        this.messages.push(`${linked.size} Artikelreferenzen an Platzierungen verknüpft; ${this.references.length - linked.size} weitere Quellreferenzen ohne platzierte Ziel-Funktion erhalten.`);
        project.articleImportDiagnostics = [...this.messages];
    }
}
