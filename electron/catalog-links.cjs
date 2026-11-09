const MAX_BYTES = 1024 * 1024;
const PUBLICATION_PAGE = 'https://vitals5.github.io/schematico/catalog-submit.html';
function publicationArticle(serialized) {
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_BYTES)
    throw new Error('Invalid article');
  const parsed = JSON.parse(serialized);
  const target =
    parsed?.article && typeof parsed.article === 'object'
      ? parsed.article
      : parsed;
  if (
    !target ||
    typeof target !== 'object' ||
    ['articleNumber', 'manufacturer', 'variant', 'description'].some(
      (key) => typeof target[key] !== 'string',
    ) ||
    !target.articleNumber.trim() ||
    !target.manufacturer.trim()
  )
    throw new Error('Invalid article');
  return JSON.stringify(parsed);
}
function catalogPublicationUrl(serialized) {
  const url =
    PUBLICATION_PAGE +
    '#article=' +
    Buffer.from(publicationArticle(serialized), 'utf8').toString('base64url');
  if (url.length > 2000) throw new Error('Article requires clipboard transfer');
  return url;
}
module.exports = { catalogPublicationUrl, publicationArticle, PUBLICATION_PAGE };
