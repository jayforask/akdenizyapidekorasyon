/**
 * GET /api/instagram-feed        — Son 6 gönderi (24h cache)
 * GET /api/instagram-feed/thumb  — Instagram CDN görseli proxy (CORS bypass)
 * POST /api/instagram-feed/refresh — Cache'i zorla yenile
 * Instagram @akdeniz.yapidekorasyon hesabının son 6 gönderisini döner.
 * Sonuç 24 saat cache'lenir (disk + bellek).
 *
 * Strateji:
 *  1. Bellek cache'i geçerliyse anında döner.
 *  2. Disk cache'i (ig_cache.json) geçerliyse diskten okur.
 *  3. Her ikisi de bayatsa Instagram'ın public /?__a=1&__d=dis endpoint'ini dener,
 *     başarısız olursa HTML scrape yapar.
 *  4. Tüm yollar başarısız olursa son bilinen cache'i döner (stale-while-revalidate).
 */

const express = require('express');
const router  = express.Router();
const fs      = require('fs');
const path    = require('path');

const CACHE_FILE    = path.join(__dirname, '../ig_cache.json');
const CACHE_TTL_MS  = 24 * 60 * 60 * 1000; // 24 saat
const IG_USERNAME   = 'akdeniz.yapidekorasyon';
const MAX_POSTS     = 6;

/* ── Bellek cache ──────────────────────────────────────────────────────────── */
let memCache = null; // { posts: [], fetchedAt: timestamp }

/* ── Yardımcı: disk cache oku ─────────────────────────────────────────────── */
function readDiskCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw  = fs.readFileSync(CACHE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return data;
  } catch {
    return null;
  }
}

/* ── Yardımcı: diske yaz ─────────────────────────────────────────────────── */
function writeDiskCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[IG Cache] Disk yazma hatası:', e.message);
  }
}

/* ── Yardımcı: cache geçerli mi ─────────────────────────────────────────── */
function isFresh(data) {
  if (!data || !data.fetchedAt) return false;
  return Date.now() - data.fetchedAt < CACHE_TTL_MS;
}

/* ── Instagram'dan veri çek ─────────────────────────────────────────────── */
async function fetchFromInstagram() {
  const headers = {
    'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    'Cache-Control'  : 'no-cache',
    'Sec-Fetch-Site' : 'none',
    'Sec-Fetch-Mode' : 'navigate',
  };

  /* ── Yöntem 1: ?__a=1 JSON endpoint ──────────────────────────────────── */
  try {
    const url = `https://www.instagram.com/${IG_USERNAME}/?__a=1&__d=dis`;
    const res  = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (res.ok) {
      const json  = await res.json();
      const edges = json?.graphql?.user?.edge_owner_to_timeline_media?.edges
                 || json?.data?.user?.edge_owner_to_timeline_media?.edges
                 || [];
      if (edges.length > 0) {
        return parseEdges(edges);
      }
    }
  } catch (e) {
    console.warn('[IG Fetch] ?__a=1 başarısız:', e.message);
  }

  /* ── Yöntem 2: HTML scrape ────────────────────────────────────────────── */
  try {
    const url = `https://www.instagram.com/${IG_USERNAME}/`;
    const res  = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const html = await res.text();

    /* window._sharedData içindeki JSON'ı bul */
    const sharedMatch = html.match(/window\._sharedData\s*=\s*(\{.+?\});<\/script>/s);
    if (sharedMatch) {
      const json  = JSON.parse(sharedMatch[1]);
      const edges = json?.entry_data?.ProfilePage?.[0]
                        ?.graphql?.user
                        ?.edge_owner_to_timeline_media?.edges || [];
      if (edges.length > 0) return parseEdges(edges);
    }

    /* Yeni Instagram — script tag içindeki JSON ────────────────────────── */
    /* Instagram bazı yapılarda __additionalDataLoaded içine gömer */
    const addlMatch = html.match(/"edge_owner_to_timeline_media":\{"edges":(\[.+?\]),"page_info"/s);
    if (addlMatch) {
      const edges = JSON.parse(addlMatch[1]);
      if (edges.length > 0) return parseEdges(edges);
    }
  } catch (e) {
    console.warn('[IG Fetch] HTML scrape başarısız:', e.message);
  }

  return null;
}

/* ── Edge dizisini standart post formatına dönüştür ─────────────────────── */
function parseEdges(edges) {
  return edges.slice(0, MAX_POSTS).map(({ node }) => {
    const isVideo    = node.__typename === 'GraphVideo' || node.is_video;
    const caption    = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
    const shortcode  = node.shortcode || '';
    const thumbSrc   = node.thumbnail_src
                    || node.display_url
                    || node.thumbnail_resources?.slice(-1)[0]?.src
                    || '';
    const likes      = node.edge_liked_by?.count
                    || node.edge_media_preview_like?.count
                    || 0;
    const comments   = node.edge_media_to_comment?.count || 0;

    return {
      id         : node.id,
      shortcode,
      url        : `https://www.instagram.com/p/${shortcode}/`,
      thumbnail  : thumbSrc,
      caption    : caption.slice(0, 160),
      likes,
      comments,
      isVideo,
      timestamp  : node.taken_at_timestamp || 0,
    };
  });
}

/* ── GET /api/instagram-feed ─────────────────────────────────────────────── */
router.get('/', async (req, res) => {
  /* 1 — Bellek cache */
  if (isFresh(memCache)) {
    return res.json({ source: 'memory', posts: memCache.posts });
  }

  /* 2 — Disk cache */
  const disk = readDiskCache();
  if (isFresh(disk)) {
    memCache = disk;
    return res.json({ source: 'disk', posts: disk.posts });
  }

  /* 3 — Canlı çekme */
  try {
    const posts = await fetchFromInstagram();

    if (posts && posts.length > 0) {
      const cacheData = { posts, fetchedAt: Date.now() };
      memCache = cacheData;
      writeDiskCache(cacheData);
      return res.json({ source: 'live', posts });
    }

    /* 4 — Stale fallback */
    if (disk && disk.posts?.length > 0) {
      console.warn('[IG Feed] Canlı çekme başarısız, eski cache döndürülüyor.');
      return res.json({ source: 'stale', posts: disk.posts });
    }

    /* 5 — Hiç veri yok */
    return res.status(503).json({ error: 'Instagram verisi alınamadı.', posts: [] });

  } catch (err) {
    console.error('[IG Feed] Kritik hata:', err.message);
    if (disk?.posts?.length > 0) {
      return res.json({ source: 'stale', posts: disk.posts });
    }
    return res.status(500).json({ error: 'Sunucu hatası.', posts: [] });
  }
});

/* ── GET /api/instagram-feed/thumb — CDN görsel proxy (CORS bypass) ─────── */
router.get('/thumb', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl) return res.status(400).send('url parametresi gerekli');

  /* Sadece Instagram CDN alanlarına izin ver */
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return res.status(400).send('Geçersiz URL'); }

  const allowed = ['instagram.com', 'cdninstagram.com', 'fbcdn.net', 'scontent.cdninstagram.com'];
  const isAllowed = allowed.some(d => parsed.hostname.endsWith(d));
  if (!isAllowed) return res.status(403).send('İzin verilmeyen kaynak');

  try {
    const igRes = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer'   : 'https://www.instagram.com/',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!igRes.ok) return res.status(igRes.status).send('Görsel alınamadı');

    const contentType = igRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h tarayıcı cache
    res.setHeader('Access-Control-Allow-Origin', '*');

    /* Stream olarak aktar */
    const buffer = await igRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.warn('[IG Thumb Proxy] Hata:', err.message);
    res.status(502).send('Görsel proxy hatası');
  }
});

/* ── POST /api/instagram-feed/refresh — Manuel yenileme (✅ sadece admin) ── */
router.post('/refresh', require('../middleware/auth'), async (req, res) => {
  memCache = null; // bellek cache'i sıfırla
  try {
    const posts = await fetchFromInstagram();
    if (posts && posts.length > 0) {
      const cacheData = { posts, fetchedAt: Date.now() };
      memCache = cacheData;
      writeDiskCache(cacheData);
      return res.json({ success: true, posts });
    }
    return res.status(503).json({ success: false, error: 'Veri çekilemedi.' });
  } catch (err) {
    console.error('[IG Refresh] Hata:', err.message);
    return res.status(500).json({ success: false, error: 'Sunucu hatası.' });
  }
});

module.exports = router;
