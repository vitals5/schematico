import { updateCatalogFile } from './publish-catalog-article.mjs';
import { parseSharedCatalog } from '../src/shared/catalog-publication.mjs';
if (process.env.GITHUB_REPOSITORY !== 'vitals5/schematico')
  throw Error('Unsupported catalogue repository');
const url = new URL(process.env.CATALOG_SERVICE_URL ?? '');
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  !['', '/'].includes(url.pathname) ||
  url.port
)
  throw Error('Expected the HTTPS service origin');
const siteKey = process.env.CATALOG_SITE_KEY?.trim();
if (!siteKey || !/^[a-zA-Z0-9_-]{10,256}$/.test(siteKey))
  throw Error('Invalid public Turnstile site key');
const result = await updateCatalogFile(
  (current) => {
    const catalog = parseSharedCatalog(current),
      submission = { url: url.origin + '/submit', siteKey };
    return {
      catalog: { ...catalog, submission },
      changed:
        JSON.stringify(catalog.submission) !== JSON.stringify(submission),
    };
  },
  { token: process.env.GH_TOKEN },
);
console.log(
  result.changed
    ? 'Catalogue submission service configured.'
    : 'Catalogue configuration unchanged.',
);
