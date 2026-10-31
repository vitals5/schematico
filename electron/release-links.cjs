const base = 'https://github.com/vitals5/schematico/releases/';
/** Accept version tags only, never a URL supplied by renderer content. */
function githubReleaseUrl(tag) {
  if (tag === 'latest') return base + 'latest';
  if (typeof tag !== 'string' || tag.trim() !== tag || !/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(tag)) throw new Error('Invalid release tag');
  return base + 'tag/' + encodeURIComponent(tag);
}
module.exports = { githubReleaseUrl };
