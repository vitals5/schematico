#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseSharedCatalog,
  removeSharedArticle,
  updateSharedArticleSymbol,
  appendPublicArticle,
  validatePublicArticle,
} from '../src/shared/catalog-publication.mjs';
import { catalogKey } from '../src/shared/catalog-record.mjs';

const CATALOG_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../catalog/articles.json',
);

export function readCatalog(catalogPath = CATALOG_PATH) {
  const text = fs.readFileSync(catalogPath, 'utf8');
  return parseSharedCatalog(JSON.parse(text));
}

export function writeCatalog(catalog, catalogPath = CATALOG_PATH) {
  const validated = parseSharedCatalog(catalog);
  validated.articles.sort((a, b) =>
    catalogKey(a).localeCompare(catalogKey(b), 'en'),
  );
  const json = JSON.stringify(validated, null, 2) + '\n';
  fs.writeFileSync(catalogPath, json, 'utf8');
  return validated;
}

export function deleteArticle(
  { manufacturer, articleNumber, variant = '' },
  catalogPath = CATALOG_PATH,
) {
  const current = readCatalog(catalogPath);
  const result = removeSharedArticle(current, {
    manufacturer,
    articleNumber,
    variant,
  });
  writeCatalog(result.catalog, catalogPath);
  return result.removed;
}

export function setArticleSymbol(
  { manufacturer, articleNumber, variant = '' },
  symbolId,
  catalogPath = CATALOG_PATH,
) {
  const current = readCatalog(catalogPath);
  const result = updateSharedArticleSymbol(
    current,
    { manufacturer, articleNumber, variant },
    symbolId,
  );
  writeCatalog(result.catalog, catalogPath);
  return result.article;
}

export function applyArticle(rawArticle, catalogPath = CATALOG_PATH) {
  const current = readCatalog(catalogPath);
  const result = appendPublicArticle(current, rawArticle, {
    allowSymbolUpdate: true,
  });
  if (result.changed) {
    writeCatalog(result.catalog, catalogPath);
  }
  return result.article;
}

export function listArticles(filter = '', catalogPath = CATALOG_PATH) {
  const current = readCatalog(catalogPath);
  const needle = filter.toLowerCase().trim();
  const filtered = needle
    ? current.articles.filter(
        (a) =>
          a.manufacturer.toLowerCase().includes(needle) ||
          a.articleNumber.toLowerCase().includes(needle) ||
          a.description.toLowerCase().includes(needle) ||
          (a.symbolId ?? '').toLowerCase().includes(needle),
      )
    : current.articles;
  return filtered;
}

function printUsage() {
  console.log(`
Verwaltung des gemeinsamen Artikelkatalogs (catalog/articles.json)

Befehle:
  node scripts/manage-catalog.mjs list [Suchbegriff]
      Listet alle oder gefilterte Artikel mit ihren Symbolen auf.

  node scripts/manage-catalog.mjs delete <Hersteller> <Artikelnummer> [Variante]
      Löscht einen Artikel dauerhaft aus catalog/articles.json.

  node scripts/manage-catalog.mjs set-symbol <Hersteller> <Artikelnummer> <Symbol-ID> [Variante]
      Weist einem vorhandenen Artikel in catalog/articles.json ein Symbol zu.

  node scripts/manage-catalog.mjs clear-symbol <Hersteller> <Artikelnummer> [Variante]
      Entfernt das zugeordnete Symbol eines Artikels in catalog/articles.json.

  node scripts/manage-catalog.mjs apply <Dateipfad.json | JSON-String>
      Fügt einen neuen Artikel hinzu oder aktualisiert das Symbol eines bestehenden Artikels.
`);
}

// CLI entry point
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case 'list': {
        const query = args[0] ?? '';
        const items = listArticles(query);
        console.log(`\nGemeinsamer Katalog: ${items.length} Artikel gefunden\n`);
        console.log(
          `${'Hersteller'.padEnd(16)} | ${'Artikelnummer'.padEnd(20)} | ${'Symbol-ID'.padEnd(35)} | Beschreibung`,
        );
        console.log('-'.repeat(110));
        for (const a of items) {
          const mfr = a.manufacturer.padEnd(16);
          const num = (a.articleNumber + (a.variant ? ` [${a.variant}]` : '')).padEnd(20);
          const sym = (a.symbolId ?? '-').padEnd(35);
          const desc = a.description.length > 35 ? a.description.slice(0, 32) + '...' : a.description;
          console.log(`${mfr} | ${num} | ${sym} | ${desc}`);
        }
        break;
      }

      case 'delete':
      case 'remove': {
        const [manufacturer, articleNumber, variant = ''] = args;
        if (!manufacturer || !articleNumber) {
          console.error('Fehler: Hersteller und Artikelnummer erforderlich.');
          printUsage();
          process.exit(1);
        }
        const removed = deleteArticle({ manufacturer, articleNumber, variant });
        console.log(
          `✓ Artikel erfolgreich gelöscht: ${removed.manufacturer} ${removed.articleNumber}${removed.variant ? ' [' + removed.variant + ']' : ''}`,
        );
        break;
      }

      case 'set-symbol': {
        const [manufacturer, articleNumber, symbolId, variant = ''] = args;
        if (!manufacturer || !articleNumber || !symbolId) {
          console.error(
            'Fehler: Hersteller, Artikelnummer und Symbol-ID erforderlich.',
          );
          printUsage();
          process.exit(1);
        }
        const updated = setArticleSymbol(
          { manufacturer, articleNumber, variant },
          symbolId,
        );
        console.log(
          `✓ Symbol "${updated.symbolId}" erfolgreich zugewiesen an: ${updated.manufacturer} ${updated.articleNumber}`,
        );
        break;
      }

      case 'clear-symbol': {
        const [manufacturer, articleNumber, variant = ''] = args;
        if (!manufacturer || !articleNumber) {
          console.error('Fehler: Hersteller und Artikelnummer erforderlich.');
          printUsage();
          process.exit(1);
        }
        const updated = setArticleSymbol(
          { manufacturer, articleNumber, variant },
          undefined,
        );
        console.log(
          `✓ Symbol entfernt für: ${updated.manufacturer} ${updated.articleNumber}`,
        );
        break;
      }

      case 'apply': {
        const target = args[0];
        if (!target) {
          console.error('Fehler: JSON-Datei oder JSON-String erforderlich.');
          printUsage();
          process.exit(1);
        }
        let raw;
        if (fs.existsSync(target)) {
          raw = JSON.parse(fs.readFileSync(target, 'utf8'));
        } else {
          raw = JSON.parse(target);
        }
        const items = Array.isArray(raw) ? raw : [raw];
        for (const item of items) {
          const applied = applyArticle(item);
          console.log(
            `✓ Artikel übernommen: ${applied.manufacturer} ${applied.articleNumber} (Symbol: ${applied.symbolId ?? 'keines'})`,
          );
        }
        break;
      }

      default:
        printUsage();
        if (command) {
          console.error(`Unbekannter Befehl: ${command}`);
          process.exit(1);
        }
    }
  } catch (error) {
    console.error(`Fehler: ${error?.message ?? error}`);
    process.exit(1);
  }
}
