export const SITE_URL = 'https://dookdookgoose.superfun.games/';
export const TITLE = 'Dook, Dook, Goose!';
export const DESCRIPTION = 'A tiny ferret. An urgent message. A very big misunderstanding. Bound, barrel-roll, and dook through a chunky PS1-style adventure to find Goose Michael.';

export function normalizeSiteUrl(raw = SITE_URL) {
  let url;
  try { url = new URL(raw?.trim() || SITE_URL); }
  catch { throw new Error('SITE_URL must be a complete HTTPS origin, such as ' + SITE_URL); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL must be a root HTTPS origin without credentials, paths, query strings, or fragments.');
  }
  return url.origin + '/';
}

export function createSiteTags({siteUrl = SITE_URL, lab = false} = {}) {
  const origin = normalizeSiteUrl(siteUrl);
  const url = origin + (lab ? 'character-lab.html' : '');
  const title = lab ? 'Character & Rig Studio — ' + TITLE : TITLE + ' — A very urgent adventure';
  const description = lab ? 'Meet the cast of Dook, Dook, Goose! Explore the ferret skeleton, expressions, and bouncy animation.' : DESCRIPTION;
  const image = origin + 'social/og-image.jpg';
  const imageAlt = 'Dook, Dook, Goose! A smiling ferret in an orange bandana bounds toward Goose Michael, who holds two gelatos beside a woodland zoo gate.';
  const tags = [];
  const add = (tag, attrs, children) => tags.push({tag, attrs, ...(children === undefined ? {} : {children}), injectTo: 'head'});
  const meta = (name, content) => add('meta', {name, content});
  const og = (property, content) => add('meta', {property, content});
  add('title', {}, title);
  meta('description', description);
  meta('application-name', TITLE);
  meta('apple-mobile-web-app-title', 'Dook!');
  meta('theme-color', '#173d32');
  meta('color-scheme', 'light');
  meta('robots', lab ? 'noindex, follow' : 'index, follow, max-image-preview:large');
  add('link', {rel: 'canonical', href: url});
  add('link', {rel: 'manifest', href: '/manifest.webmanifest'});
  add('link', {rel: 'icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48'});
  add('link', {rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32.png'});
  add('link', {rel: 'icon', type: 'image/png', sizes: '16x16', href: '/icons/favicon-16.png'});
  add('link', {rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png'});
  og('og:type', 'website');
  og('og:site_name', TITLE);
  og('og:locale', 'en_US');
  og('og:title', title);
  og('og:description', description);
  og('og:url', url);
  og('og:image', image);
  if (image.startsWith('https:')) og('og:image:secure_url', image);
  og('og:image:type', 'image/jpeg');
  og('og:image:width', '1200');
  og('og:image:height', '630');
  og('og:image:alt', imageAlt);
  meta('twitter:card', 'summary_large_image');
  meta('twitter:title', title);
  meta('twitter:description', description);
  meta('twitter:image', image);
  meta('twitter:image:alt', imageAlt);
  if (!lab) add('script', {type: 'application/ld+json'}, JSON.stringify({
    '@context': 'https://schema.org', '@type': ['VideoGame', 'SoftwareApplication'],
    name: TITLE, description: DESCRIPTION, url, image,
    applicationCategory: 'GameApplication', operatingSystem: 'Any',
    gamePlatform: 'Web browser', genre: ['Action', 'Endless runner'],
    playMode: 'SinglePlayer', inLanguage: 'en', isAccessibleForFree: true
  }).replace(/</g, '\\u003c'));
  return tags;
}

export default function siteMetadata({siteUrl = SITE_URL} = {}) {
  const origin = normalizeSiteUrl(siteUrl);
  return {
    name: 'dook-site-metadata',
    transformIndexHtml: {
      order: 'post',
      handler(_html, context) { return createSiteTags({siteUrl: origin, lab: context.path.endsWith('character-lab.html')}); }
    },
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'robots.txt', source: 'User-agent: *\nAllow: /\n\nSitemap: ' + origin + 'sitemap.xml\n'});
      this.emitFile({type: 'asset', fileName: 'sitemap.xml', source: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + origin + '</loc></url></urlset>\n'});
    }
  };
}
