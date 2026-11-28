// Addresses a hotel's old site already had, kept working after it moved to Visit2 (search engines and
// shared links know them). Villa JIJI: its Bakuriani guides, photos and videos, and its files for robots.
const LEGACY = {
  villajiji: {
    exact: {
      '/bakuriani-winter': '/files/jiji/pages/bakuriani-winter', '/bakuriani-winter.html': '/files/jiji/pages/bakuriani-winter',
      '/bakuriani-summer': '/files/jiji/pages/bakuriani-summer', '/bakuriani-summer.html': '/files/jiji/pages/bakuriani-summer',
      '/bakuriani-how-to-get': '/files/jiji/pages/bakuriani-how-to-get', '/bakuriani-how-to-get.html': '/files/jiji/pages/bakuriani-how-to-get',
      '/llms.txt': '/files/jiji/pages/llms.txt', '/sitemap.xml': '/files/jiji/pages/sitemap.xml', '/robots.txt': '/files/jiji/pages/robots.txt',
      '/privacy': '/privacy.html', '/admin.html': '/admin',
    },
    prefix: [['/img/', '/files/jiji/img/'], ['/video/', '/files/jiji/video/']],
  },
};

// the path to serve instead, or null when the address is an ordinary one
export function legacyPath(slug, path) {
  const L = LEGACY[slug]; if (!L) return null;
  if (L.exact[path]) return L.exact[path];
  const hit = L.prefix.find(([from]) => path.startsWith(from));
  return hit && !path.includes('..') ? hit[1] + path.slice(hit[0].length) : null;
}
