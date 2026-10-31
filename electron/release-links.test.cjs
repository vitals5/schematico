const assert=require('node:assert/strict');
const {githubReleaseUrl}=require('./release-links.cjs');
assert.equal(githubReleaseUrl('latest'),'https://github.com/vitals5/schematico/releases/latest');
for(const tag of ['v1.2.72','1.2.72','v1.2.72+build.1'])assert.equal(githubReleaseUrl(tag),'https://github.com/vitals5/schematico/releases/tag/'+encodeURIComponent(tag));
for(const bad of [null,{},'',1,'file:///tmp/test','https://evil.example','v1.2.72/../../x','v1.2.72?redirect=evil','v1.2.72#x','v1.2.72-beta','v01.2.72','v1.2.72\n'])assert.throws(()=>githubReleaseUrl(bad));
console.log('✓ Desktop update links allow only the fixed GitHub latest page and stable release tags');
