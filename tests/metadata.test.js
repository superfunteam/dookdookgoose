import test from 'node:test';
import assert from 'node:assert/strict';
import siteMetadata,{SITE_URL,normalizeSiteUrl,createSiteTags} from '../build/site-meta.mjs';

const PRODUCTION_URL='https://dookdookgoose.superfun.games/';
const meta=(tags,key)=>tags.find(item=>item.tag==='meta'&&(item.attrs?.name===key||item.attrs?.property===key))?.attrs.content;
const link=(tags,rel)=>tags.find(item=>item.tag==='link'&&item.attrs?.rel===rel)?.attrs.href;

test('site URLs use the real public domain and normalize root URLs',()=>{
 assert.equal(SITE_URL,PRODUCTION_URL);
 assert.equal(normalizeSiteUrl(''),PRODUCTION_URL);
 assert.equal(normalizeSiteUrl('   '),PRODUCTION_URL);
 assert.equal(normalizeSiteUrl('  https://dookdookgoose.superfun.games  '),PRODUCTION_URL);
 assert.equal(normalizeSiteUrl('https://preview.example'), 'https://preview.example/');
 assert.equal(normalizeSiteUrl('http://localhost:4173'), 'http://localhost:4173/');
 assert.equal(normalizeSiteUrl('http://127.0.0.1:4173/'), 'http://127.0.0.1:4173/');
 assert.equal(normalizeSiteUrl('http://[::1]:4173/'), 'http://[::1]:4173/');
});

test('site URL validation rejects unsafe or ambiguous deployment locations',()=>{
 for(const value of [
  'not a URL',
  'javascript:alert(1)',
  'ftp://example.com/',
  'http://public.example/',
  'https://user:password@example.com/',
  'https://example.com/nested/',
  'https://example.com/?tracking=yes',
  'https://example.com/#route',
 ]){
  assert.throws(()=>normalizeSiteUrl(value),undefined,value);
  assert.throws(()=>createSiteTags({siteUrl:value}),undefined,value);
 }
});

test('game sharing metadata is complete and uses absolute production URLs',()=>{
 const tags=createSiteTags();
 assert.equal(tags.filter(item=>item.tag==='title').length,1);
 assert.match(tags.find(item=>item.tag==='title').children,/Dook, Dook, Goose!/);
 assert(meta(tags,'description').length>60);
 assert.equal(link(tags,'canonical'),PRODUCTION_URL);
 assert.equal(meta(tags,'og:url'),PRODUCTION_URL);
 assert.equal(meta(tags,'og:type'),'website');
 assert.equal(meta(tags,'og:site_name'),'Dook, Dook, Goose!');
 assert.equal(meta(tags,'og:image'),PRODUCTION_URL+'social/og-image.jpg');
 assert.equal(meta(tags,'og:image:secure_url'),meta(tags,'og:image'));
 assert.equal(String(meta(tags,'og:image:width')),'1200');
 assert.equal(String(meta(tags,'og:image:height')),'630');
 assert.equal(meta(tags,'og:image:type'),'image/jpeg');
 assert.match(meta(tags,'og:image:alt'),/ferret/i);
 assert.equal(meta(tags,'twitter:card'),'summary_large_image');
 assert.equal(meta(tags,'twitter:image'),meta(tags,'og:image'));
 assert(meta(tags,'twitter:title'));
 assert(meta(tags,'twitter:description'));
 assert(meta(tags,'twitter:image:alt'));
 assert.equal(meta(tags,'theme-color'),'#173d32');
 assert.equal(link(tags,'manifest'),'/manifest.webmanifest');
 assert(link(tags,'apple-touch-icon'));
 assert(link(tags,'icon'));
 assert(!String(meta(tags,'robots')).includes('noindex'));
 for(const item of tags)assert.equal(item.injectTo,'head');
 const keys=tags.filter(item=>item.tag==='meta').map(item=>item.attrs.name||item.attrs.property||item.attrs.charset);
 assert.equal(new Set(keys).size,keys.length,'metadata should not have duplicate keys');
});

test('preview domain override consistently updates canonical and image addresses',()=>{
 const tags=createSiteTags({siteUrl:'https://preview.example/'});
 assert.equal(link(tags,'canonical'),'https://preview.example/');
 assert.equal(meta(tags,'og:url'),'https://preview.example/');
 assert.equal(meta(tags,'og:image'),'https://preview.example/social/og-image.jpg');
 assert.equal(meta(tags,'twitter:image'),'https://preview.example/social/og-image.jpg');
});

test('character lab is excluded from search and has its own sharing URL',()=>{
 const tags=createSiteTags({lab:true});
 assert.match(meta(tags,'robots'),/noindex/);
 assert.match(meta(tags,'robots'),/follow/);
 assert.equal(meta(tags,'og:url'),PRODUCTION_URL+'character-lab.html');
 const canonical=link(tags,'canonical');
 assert.equal(canonical,PRODUCTION_URL+'character-lab.html');
 assert.match(tags.find(item=>item.tag==='title').children,/character|studio|lab/i);
 assert.equal(tags.filter(item=>item.tag==='script'&&item.attrs?.type==='application/ld+json').length,0,'the inspector should not be presented as a second playable game');
});

test('game structured data is valid and identifies the playable game',()=>{
 const scripts=createSiteTags().filter(item=>item.tag==='script'&&item.attrs?.type==='application/ld+json');
 assert(scripts.length>0,'game should include structured data');
 const records=scripts.flatMap(item=>{
  const data=JSON.parse(item.children);
  return data['@graph']||[data];
 });
 const game=records.find(item=>[item['@type']].flat().some(type=>['VideoGame','SoftwareApplication','WebApplication'].includes(type)));
 assert(game,'structured data must describe a game or application');
 assert.equal(game.name,'Dook, Dook, Goose!');
 assert.equal(game.url,PRODUCTION_URL);
});

test('Vite HTML transform selects the game and lab metadata independently',()=>{
 const plugin=siteMetadata({siteUrl:'https://preview.example/'});
 const transform=plugin.transformIndexHtml.handler;
 const game=transform('<head></head>',{path:'/index.html'});
 const lab=transform('<head></head>',{path:'/character-lab.html'});
 assert.equal(link(game,'canonical'),'https://preview.example/');
 assert.equal(link(lab,'canonical'),'https://preview.example/character-lab.html');
 assert.match(meta(lab,'robots'),/noindex/);
 assert(!meta(game,'robots').includes('noindex'));
});

test('crawler files advertise only the playable root URL',()=>{
 for(const origin of [PRODUCTION_URL,'https://preview.example/']){
  const assets=[];
  siteMetadata({siteUrl:origin}).generateBundle.call({emitFile(asset){assets.push(asset);}});
  assert.equal(assets.length,2);
  assert(assets.every(asset=>asset.type==='asset'));
  const robots=assets.find(asset=>asset.fileName==='robots.txt').source;
  const sitemap=assets.find(asset=>asset.fileName==='sitemap.xml').source;
  assert.match(robots,/User-agent: \*/);
  assert(robots.includes('Sitemap: '+origin+'sitemap.xml'));
  assert(sitemap.includes('<loc>'+origin+'</loc>'));
  assert.equal((sitemap.match(/<loc>/g)||[]).length,1);
  assert(!sitemap.includes('character-lab'));
  // Crawlers must be allowed to read the inspector's noindex directive.
  assert(!robots.includes('Disallow: /character-lab'));
 }
});
