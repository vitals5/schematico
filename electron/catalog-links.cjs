const MAX_BYTES=32*1024;
const PUBLICATION_PAGE='https://vitals5.github.io/schematico/catalog-submit.html';
function publicationArticle(serialized){
 if(typeof serialized!=='string'||Buffer.byteLength(serialized,'utf8')>MAX_BYTES)throw new Error('Invalid article');
 const article=JSON.parse(serialized);
 if(!article||typeof article!=='object'||['articleNumber','manufacturer','variant','description'].some(key=>typeof article[key]!=='string')||!article.articleNumber.trim()||!article.manufacturer.trim())throw new Error('Invalid article');
 return JSON.stringify(article);
}
function catalogPublicationUrl(serialized){
 const url=PUBLICATION_PAGE+'#article='+Buffer.from(publicationArticle(serialized),'utf8').toString('base64url');
 if(url.length>2000)throw new Error('Article requires clipboard transfer');
 return url;
}
module.exports={catalogPublicationUrl,publicationArticle,PUBLICATION_PAGE};
