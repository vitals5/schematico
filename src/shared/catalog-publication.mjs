import { validateCatalogArticle, catalogKey } from './catalog-record.mjs';
export const CATALOG_SCHEMA = 'schematico-articles';
export const MAX_CATALOG_BYTES = 20 * 1024 * 1024;
export const MAX_SUBMISSION_BYTES = 256 * 1024;
/** Public submissions are new, unverified data; they never grant authority to
 * overwrite an existing record or alter deployment configuration. */
export function validatePublicArticle(raw) {
  const article = validateCatalogArticle({
    ...raw,
    origin: 'user',
    verification: 'unverified',
  });
  if (
    [article.articleNumber, article.manufacturer, article.variant].some(
      (value) => /[\u0000-\u001f\u007f]/.test(value),
    )
  )
    throw new Error('githubCatalogInvalid');
  if (
    !article.manufacturer ||
    article.manufacturer.length > 160 ||
    article.articleNumber.length > 160 ||
    article.variant.length > 160 ||
    article.description.length > 8000 ||
    (article.functions?.length ?? 0) > 64 ||
    article.functions?.some(
      (f) =>
        f.id.length > 160 ||
        f.type.length > 160 ||
        f.pins.length > 64 ||
        f.pins.some((p) => p.length > 160),
    ) ||
    new TextEncoder().encode(JSON.stringify(article)).length >
      MAX_SUBMISSION_BYTES
  )
    throw new Error('githubCatalogInvalid');
  return article;
}
export function parseSharedCatalog(value) {
  if (
    !value ||
    value.schema !== CATALOG_SCHEMA ||
    value.version !== 1 ||
    !Array.isArray(value.articles) ||
    value.articles.length > 50000
  )
    throw new Error('githubCatalogInvalid');
  const articles = value.articles.map((a) =>
    validateCatalogArticle({ ...a, verification: 'unverified' }),
  );
  if (new Set(articles.map(catalogKey)).size !== articles.length)
    throw new Error('articlesCatalogDuplicate');
  let submission;
  if (value.submission?.url) {
    const url = new URL(value.submission.url);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.hash ||
      typeof value.submission.siteKey !== 'string' ||
      !value.submission.siteKey.trim()
    )
      throw new Error('githubCatalogInvalid');
    submission = {
      url: url.toString(),
      siteKey: value.submission.siteKey.trim(),
    };
  }
  return {
    schema: CATALOG_SCHEMA,
    version: 1,
    articles,
    ...(submission ? { submission } : {}),
  };
}
export function appendPublicArticle(current, raw, options = {}) {
  const catalog = parseSharedCatalog(current),
    article = validatePublicArticle(raw),
    key = catalogKey(article),
    old = catalog.articles.find((a) => catalogKey(a) === key);
  if (old) {
    if (
      options.allowSymbolUpdate &&
      article.symbolId !== undefined &&
      article.symbolId !== (old.symbolId ?? '')
    ) {
      if (article.symbolId) old.symbolId = article.symbolId;
      else delete old.symbolId;
      return { catalog, article: old, changed: true };
    }
    const semantic = (a) =>
      JSON.stringify({
        articleNumber: a.articleNumber,
        manufacturer: a.manufacturer,
        variant: a.variant,
        description: a.description,
        functions: a.functions ?? [],
        symbolId: a.symbolId ?? '',
      });
    if (semantic(old) !== semantic(article))
      throw new Error('githubCatalogConflict');
    return { catalog, article, changed: false };
  }
  if (catalog.articles.length >= 50000)
    throw new Error('githubCatalogCapacity');
  catalog.articles.push(article);
  catalog.articles.sort((a, b) =>
    catalogKey(a).localeCompare(catalogKey(b), 'en'),
  );
  if (
    new TextEncoder().encode(JSON.stringify(catalog)).length > MAX_CATALOG_BYTES
  )
    throw new Error('githubCatalogCapacity');
  return { catalog, article, changed: true };
}

export function removeSharedArticle(current, filter) {
  const catalog = parseSharedCatalog(current);
  const targetKey =
    typeof filter === 'string'
      ? filter
      : catalogKey({
          manufacturer: filter.manufacturer ?? '',
          articleNumber: filter.articleNumber ?? '',
          variant: filter.variant ?? '',
        });
  const index = catalog.articles.findIndex(
    (a) => catalogKey(a) === targetKey || a.id === targetKey,
  );
  if (index === -1) throw new Error('articlesCatalogNotFound');
  const [removed] = catalog.articles.splice(index, 1);
  return { catalog, removed, changed: true };
}

export function updateSharedArticleSymbol(current, filter, symbolId) {
  const catalog = parseSharedCatalog(current);
  const targetKey =
    typeof filter === 'string'
      ? filter
      : catalogKey({
          manufacturer: filter.manufacturer ?? '',
          articleNumber: filter.articleNumber ?? '',
          variant: filter.variant ?? '',
        });
  const article = catalog.articles.find(
    (a) => catalogKey(a) === targetKey || a.id === targetKey,
  );
  if (!article) throw new Error('articlesCatalogNotFound');
  const cleanSymbol = symbolId ? String(symbolId).trim() : undefined;
  if (
    cleanSymbol &&
    (cleanSymbol.length > 256 || /[\u0000-\u001f\u007f]/.test(cleanSymbol))
  ) {
    throw new Error('githubCatalogInvalid');
  }
  if ((article.symbolId ?? undefined) === cleanSymbol)
    return { catalog, article, changed: false };
  if (cleanSymbol) article.symbolId = cleanSymbol;
  else delete article.symbolId;
  return { catalog, article, changed: true };
}

export const SYMBOLS_SCHEMA = 'schematico-symbols';
export const MAX_SYMBOLS_BYTES = 20 * 1024 * 1024;
export const MAX_SYMBOL_SUBMISSION_BYTES = 512 * 1024;

export function validatePublicSymbol(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('githubSymbolsInvalid');
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const category =
    typeof raw.category === 'string' ? raw.category.trim() : 'structure';
  if (!id || id.length > 256 || /[\u0000-\u001f\u007f]/.test(id))
    throw new Error('githubSymbolsInvalid');
  if (!name || name.length > 256 || /[\u0000-\u001f\u007f]/.test(name))
    throw new Error('githubSymbolsInvalid');

  const width = Number(raw.width);
  const height = Number(raw.height);
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0
  )
    throw new Error('githubSymbolsInvalid');

  const pins = Array.isArray(raw.pins) ? raw.pins : [];
  if (pins.length > 512) throw new Error('githubSymbolsInvalid');
  const validatedPins = pins.map((p, idx) => {
    if (!p || typeof p !== 'object') throw new Error('githubSymbolsInvalid');
    const pid = typeof p.id === 'string' ? p.id.trim() : 'p' + (idx + 1);
    const pname = typeof p.name === 'string' ? p.name.trim() : '';
    const px = Number(p.x);
    const py = Number(p.y);
    if (
      !Number.isFinite(px) ||
      !Number.isFinite(py) ||
      pid.length > 64 ||
      pname.length > 128
    )
      throw new Error('githubSymbolsInvalid');
    const dir =
      typeof p.direction === 'string' &&
      ['top', 'bottom', 'left', 'right', 'up', 'down'].includes(p.direction)
        ? p.direction
        : 'top';
    const pin = {
      id: pid,
      name: pname,
      x: px,
      y: py,
      direction: dir,
      electricalRole: p.electricalRole ?? 'unknown',
    };
    if (p.labelPosition && typeof p.labelPosition === 'object') {
      const lx = Number(p.labelPosition.x);
      const ly = Number(p.labelPosition.y);
      if (Number.isFinite(lx) && Number.isFinite(ly)) {
        pin.labelPosition = {
          x: lx,
          y: ly,
          ...(Number.isFinite(p.labelPosition.fontSize)
            ? { fontSize: Number(p.labelPosition.fontSize) }
            : {}),
          ...(typeof p.labelPosition.alignment === 'string'
            ? { alignment: p.labelPosition.alignment }
            : {}),
          ...(Number.isFinite(p.labelPosition.rotation)
            ? { rotation: Number(p.labelPosition.rotation) }
            : {}),
        };
      }
    }
    return pin;
  });

  const importedGraphics = Array.isArray(raw.importedGraphics)
    ? raw.importedGraphics.slice(0, 4096).map((g) => {
        if (!g || typeof g !== 'object' || typeof g.kind !== 'string')
          throw new Error('githubSymbolsInvalid');
        if (
          !['line', 'rect', 'circle', 'arc', 'polygon', 'text'].includes(g.kind)
        )
          throw new Error('githubSymbolsInvalid');
        if (g.kind === 'line') {
          return {
            kind: 'line',
            x1: Number(g.x1),
            y1: Number(g.y1),
            x2: Number(g.x2),
            y2: Number(g.y2),
            color: g.color ?? 'currentColor',
            width: Number(g.width ?? 0.3),
          };
        }
        if (g.kind === 'rect') {
          return {
            kind: 'rect',
            x: Number(g.x),
            y: Number(g.y),
            width: Number(g.width),
            height: Number(g.height),
            color: g.color ?? 'currentColor',
            fill: g.fill,
          };
        }
        if (g.kind === 'circle') {
          return {
            kind: 'circle',
            x: Number(g.x),
            y: Number(g.y),
            radius: Number(g.radius),
            color: g.color ?? 'currentColor',
            fill: g.fill,
          };
        }
        if (g.kind === 'arc') {
          return {
            kind: 'arc',
            x: Number(g.x),
            y: Number(g.y),
            radius: Number(g.radius),
            startAngle: Number(g.startAngle ?? 0),
            endAngle: Number(g.endAngle ?? 360),
            color: g.color ?? 'currentColor',
          };
        }
        if (g.kind === 'polygon') {
          const points = Array.isArray(g.points)
            ? g.points.map((pt) => ({ x: Number(pt.x), y: Number(pt.y) }))
            : [];
          return {
            kind: 'polygon',
            points,
            color: g.color ?? 'currentColor',
            fill: g.fill,
          };
        }
        if (g.kind === 'text') {
          const text = typeof g.text === 'string' ? g.text.slice(0, 1000) : '';
          return {
            kind: 'text',
            x: Number(g.x),
            y: Number(g.y),
            text,
            size: Number(g.size ?? 3),
            color: g.color ?? 'currentColor',
            anchor: g.anchor,
            rotation: g.rotation,
          };
        }
        return g;
      })
    : undefined;

  const svgContent = typeof raw.svgContent === 'string' ? raw.svgContent : '';
  if (svgContent.length > 256 * 1024) throw new Error('githubSymbolsInvalid');

  const symbol = {
    id,
    name,
    category,
    standard:
      typeof raw.standard === 'string' ? raw.standard.slice(0, 64) : 'CAD',
    defaultBmkPrefix:
      typeof raw.defaultBmkPrefix === 'string'
        ? raw.defaultBmkPrefix.slice(0, 32)
        : '-K',
    defaultFunctionText:
      typeof raw.defaultFunctionText === 'string'
        ? raw.defaultFunctionText.slice(0, 256)
        : '',
    width,
    height,
    pins: validatedPins,
    ...(importedGraphics ? { importedGraphics } : {}),
    svgContent,
    description:
      typeof raw.description === 'string' ? raw.description.slice(0, 4000) : '',
    ...(typeof raw.manufacturer === 'string'
      ? { manufacturer: raw.manufacturer.slice(0, 160) }
      : {}),
    ...(typeof raw.articleNumber === 'string'
      ? { articleNumber: raw.articleNumber.slice(0, 160) }
      : {}),
    ...(Number.isFinite(raw.unitsPerMm)
      ? { unitsPerMm: Number(raw.unitsPerMm) }
      : {}),
    ...(raw.insertionPoint &&
    Number.isFinite(raw.insertionPoint.x) &&
    Number.isFinite(raw.insertionPoint.y)
      ? {
          insertionPoint: {
            x: Number(raw.insertionPoint.x),
            y: Number(raw.insertionPoint.y),
          },
        }
      : {}),
    ...(raw.cadImport && typeof raw.cadImport === 'object'
      ? { cadImport: JSON.parse(JSON.stringify(raw.cadImport)) }
      : {}),
  };

  const encodedLength = new TextEncoder().encode(JSON.stringify(symbol)).length;
  if (encodedLength > MAX_SYMBOL_SUBMISSION_BYTES)
    throw new Error('githubSymbolsCapacity');

  return symbol;
}

export function parseSharedSymbols(value) {
  if (
    !value ||
    value.schema !== SYMBOLS_SCHEMA ||
    value.version !== 1 ||
    !Array.isArray(value.symbols) ||
    value.symbols.length > 10000
  )
    throw new Error('githubSymbolsInvalid');
  const symbols = value.symbols.map(validatePublicSymbol);
  if (new Set(symbols.map((s) => s.id)).size !== symbols.length)
    throw new Error('symbolsCatalogDuplicate');
  return {
    schema: SYMBOLS_SCHEMA,
    version: 1,
    symbols,
  };
}

export function appendPublicSymbol(current, raw) {
  const symbolsData = parseSharedSymbols(current);
  const symbol = validatePublicSymbol(raw);
  const existingIdx = symbolsData.symbols.findIndex((s) => s.id === symbol.id);
  if (existingIdx !== -1) {
    const old = symbolsData.symbols[existingIdx];
    if (JSON.stringify(old) === JSON.stringify(symbol)) {
      return { symbolsData, symbol: old, changed: false };
    }
    symbolsData.symbols[existingIdx] = symbol;
    return { symbolsData, symbol, changed: true };
  }
  symbolsData.symbols.push(symbol);
  symbolsData.symbols.sort((a, b) => a.id.localeCompare(b.id, 'en'));
  if (
    new TextEncoder().encode(JSON.stringify(symbolsData)).length >
    MAX_SYMBOLS_BYTES
  )
    throw new Error('githubSymbolsCapacity');
  return { symbolsData, symbol, changed: true };
}

export function removeSharedSymbol(current, symbolId) {
  const symbolsData = parseSharedSymbols(current);
  const targetId = String(symbolId).trim();
  const index = symbolsData.symbols.findIndex((s) => s.id === targetId);
  if (index === -1) throw new Error('symbolsCatalogNotFound');
  const [removed] = symbolsData.symbols.splice(index, 1);
  return { symbolsData, removed, changed: true };
}
