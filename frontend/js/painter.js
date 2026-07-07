/* =================================================================
   İnteraktif Duvar Boyama Widget — painter.js
   - Canvas üzerinde örülü tuğla duvar çizilir
   - Renk paletinden seçim yapılınca usta seçilen renkle boyar
   - Usta, Canvas 2D API ile çizilmiş vektörel karakter
   - Boyama soldan sağa şerit şerit ilerler
   - Her yeni renk seçiminde usta yeniden başlar
================================================================= */
(function () {
  'use strict';

  const canvas = document.getElementById('wallCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ── roundRect polyfill (Safari < 15.4, eski Android Chrome) ── */
  if (!ctx.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = Math.min(Math.abs(r || 0), Math.abs(w) / 2, Math.abs(h) / 2);
      this.beginPath();
      this.moveTo(x + radius, y);
      this.lineTo(x + w - radius, y);
      this.arcTo(x + w, y,         x + w, y + h,         radius);
      this.lineTo(x + w, y + h - radius);
      this.arcTo(x + w, y + h,     x,     y + h,         radius);
      this.lineTo(x + radius, y + h);
      this.arcTo(x,     y + h,     x,     y,             radius);
      this.lineTo(x, y + radius);
      this.arcTo(x,     y,         x + w, y,             radius);
      this.closePath();
      return this;
    };
  }

  /* ── Renk paleti event ──────────────────────────────────────── */
  let paintColor = '#C9A227';
  const palette  = document.getElementById('colorPalette');
  if (palette) {
    palette.addEventListener('click', function (e) {
      const sw = e.target.closest('.color-swatch');
      if (!sw) return;
      palette.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      paintColor = sw.dataset.color;
      startPainting(paintColor);
    });
  }

  /* ── Canvas boyutu ─────────────────────────────────────────── */
  let W = 0, H = 0;

  /* ── Boyalı şeritler (hangi X'e kadar boyandı) ──────────────── */
  // painted: Array of { x (canvas x), color }  — sadece X bazlı şerit
  const painted = [];   // { upTo: number, color: string }
  let paintedUpTo = -1; // boyanan en sağ X
  let paintedColor = '#C9A227';

  /* ── Çatlak desen seed'leri (sabit, resize'da yeniden üret) ─── */
  let crackSeeds = [];
  function buildCracks() {
    crackSeeds = [];
    const rng = mulberry32(42);
    for (let i = 0; i < 38; i++) {
      const segs = 3 + Math.floor(rng() * 5);
      /* jitter: her segment için sabit açı sapması */
      const jitter = [];
      for (let s = 0; s < segs; s++) {
        jitter.push((rng() - 0.5) * 0.55);
      }
      crackSeeds.push({
        x:    rng() * W,
        y:    rng() * H,
        ang:  rng() * Math.PI * 2,
        len:  20 + rng() * 80,
        w:    0.5 + rng() * 1.0,
        segs,
        jitter,
      });
    }
  }
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ── DUVAR ÇİZ (boyasız hali = eski harap sıvalı duvar) ──────── */
  function drawWall() {
    ctx.clearRect(0, 0, W, H);

    /* ── Offscreen canvas ile katmanlı duvar ── */
    const oc  = document.createElement('canvas');
    oc.width  = W; oc.height = H;
    const ox  = oc.getContext('2d');

    /* 1. Tuğla zemin */
    const rngB = mulberry32(13);
    const bW = 52, bH = 22, bGap = 5;
    const bRows = Math.ceil(H / (bH + bGap)) + 2;
    const bCols = Math.ceil(W / (bW + bGap)) + 2;
    for (let r = 0; r < bRows; r++) {
      for (let c = 0; c < bCols; c++) {
        const offX = (r % 2 === 0) ? 0 : (bW + bGap) / 2;
        const bx = offX + c * (bW + bGap) - bGap;
        const by = r * (bH + bGap) - bGap;
        const rv = 85 + Math.floor(rngB() * 45);
        const gv = 48 + Math.floor(rngB() * 22);
        const bv = 32 + Math.floor(rngB() * 18);
        ox.fillStyle = `rgb(${rv},${gv},${bv})`;
        ox.fillRect(bx, by, bW, bH);
        ox.fillStyle = 'rgba(160,140,120,0.55)';
        ox.fillRect(bx - 1, by - bGap, bW + 2, bGap);
        ox.fillRect(bx + bW, by, bGap, bH);
      }
    }

    /* 2. Sıva katmanı — offscreen üstüne */
    const oc2  = document.createElement('canvas');
    oc2.width  = W; oc2.height = H;
    const ox2  = oc2.getContext('2d');

    /* Ana sıva: kirli beyaz */
    ox2.fillStyle = '#d5cec6';
    ox2.fillRect(0, 0, W, H);

    /* Sıva tonlama lekeleri */
    const rngS = mulberry32(55);
    for (let i = 0; i < 140; i++) {
      const lx = rngS() * W, ly = rngS() * H;
      const lr = 4 + rngS() * 45;
      const la = 0.03 + rngS() * 0.11;
      ox2.fillStyle = rngS() > 0.4
        ? `rgba(50,35,20,${la})`
        : `rgba(255,248,235,${la})`;
      ox2.beginPath();
      ox2.ellipse(lx, ly, lr, lr * (0.25 + rngS() * 0.75), rngS() * Math.PI, 0, Math.PI * 2);
      ox2.fill();
    }

    /* Dökülen sıva delikleri — destination-out sadece sıva canvas'ında */
    const rngP = mulberry32(99);
    ox2.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 22; i++) {
      const px = rngP() * W, py = rngP() * H;
      const pw = 15 + rngP() * 90, ph = 10 + rngP() * 65;
      ox2.beginPath();
      ox2.ellipse(px, py, pw, ph, rngP() * Math.PI, 0, Math.PI * 2);
      ox2.fill();
    }
    /* Köşelerde de dökülme */
    ox2.beginPath(); ox2.ellipse(0, H, 60, 80, -0.3, 0, Math.PI * 2); ox2.fill();
    ox2.beginPath(); ox2.ellipse(W * 0.3, H, 40, 50, 0.2, 0, Math.PI * 2); ox2.fill();
    ox2.beginPath(); ox2.ellipse(W * 0.7, 0, 50, 40, -0.5, 0, Math.PI * 2); ox2.fill();
    ox2.globalCompositeOperation = 'source-over';

    /* Sıvayı tuğla üstüne birleştir */
    ox.drawImage(oc2, 0, 0);

    /* 3. Yosun/nem — yeşil-koyu lekeler alt kısımlara */
    const rngM = mulberry32(33);
    for (let i = 0; i < 14; i++) {
      const mx = rngM() * W;
      const my = H * 0.35 + rngM() * H * 0.65;
      const mr = 6 + rngM() * 38;
      ox.save();
      ox.globalAlpha = 0.10 + rngM() * 0.20;
      const gr = 55 + Math.floor(rngM() * 35);
      const gg = 85 + Math.floor(rngM() * 45);
      const gb = 35 + Math.floor(rngM() * 20);
      ox.fillStyle = `rgb(${gr},${gg},${gb})`;
      ox.beginPath();
      ox.ellipse(mx, my, mr, mr * (0.35 + rngM() * 0.55), rngM() * Math.PI, 0, Math.PI * 2);
      ox.fill();
      ox.restore();
    }

    /* 4. Duvarı ana canvas'a çiz */
    ctx.drawImage(oc, 0, 0);

    /* 5. Boyalı şerit */
    if (paintedUpTo > 0) {
      _drawPaintedStrip(0, paintedUpTo, paintedColor);
    }

    /* 6. Çatlaklar */
    _drawCracks();
  }

  function _drawPaintedStrip(x0, x1, color) {
    ctx.save();
    /* Düzgün, temiz, mat boyalı alçıpan */
    const pg = ctx.createLinearGradient(x0, 0, x1, H);
    pg.addColorStop(0,   adjustBrightness(color, -15));
    pg.addColorStop(0.4, color);
    pg.addColorStop(1,   adjustBrightness(color, -8));
    ctx.fillStyle = pg;
    ctx.fillRect(x0, 0, x1 - x0, H);

    /* hafif boya parlaması (üst köşe) */
    const shine = ctx.createLinearGradient(x0, 0, x0, H * 0.4);
    shine.addColorStop(0,   'rgba(255,255,255,0.14)');
    shine.addColorStop(1,   'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.fillRect(x0, 0, x1 - x0, H * 0.4);

    /* rulo izi — hafif dikey çizgiler */
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = adjustBrightness(color, 20);
    ctx.lineWidth = 1.5;
    for (let rx = x0 + 8; rx < x1; rx += 14) {
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, H); ctx.stroke();
    }
    ctx.restore();

    /* keskin kenar — boya sınırı */
    if (x1 < W) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur  = 6;
      ctx.strokeStyle = adjustBrightness(color, -30);
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke();
      ctx.restore();
    }
  }

  function _drawCracks() {
    for (const cr of crackSeeds) {
      /* Boyalı bölgede gizle */
      if (cr.x < paintedUpTo - 10) continue;

      ctx.save();
      if (cr.x < paintedUpTo + 20) {
        ctx.globalAlpha = Math.max(0, (cr.x - paintedUpTo + 20) / 30);
      }

      /* Çatlak noktaları sabit — seed'den üretilmiş, Math.random yok */
      const segLen = cr.len / cr.segs;
      const pts = [{ x: cr.x, y: cr.y }];
      let cx2 = cr.x, cy2 = cr.y, ang = cr.ang;
      for (let s = 0; s < cr.segs; s++) {
        ang += cr.jitter[s];
        cx2 += Math.cos(ang) * segLen;
        cy2 += Math.sin(ang) * segLen;
        pts.push({ x: cx2, y: cy2 });
      }

      /* Gölge (kirli kenar) */
      ctx.strokeStyle = 'rgba(100,75,50,0.10)';
      ctx.lineWidth   = cr.w * 3.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      /* Çatlak çizgisi */
      ctx.strokeStyle = 'rgba(65,45,28,0.60)';
      ctx.lineWidth   = cr.w;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      ctx.restore();
    }
  }

  /* ── Boyalı şeridi güncelle ──────────────────────────────────── */
  function redrawPainted() {
    /* drawWall() içinde zaten _drawPaintedStrip çağrılıyor */
  }

  function drawBrickPainted(bx, by, color, alpha) {
    /* artık kullanılmıyor — şerit boyama var */
  }

  /* ══════════════════════════════════════════════════════════════
     USTA ÇİZİMİ
  ══════════════════════════════════════════════════════════════ */
  const SC = 1.6;  // ölçek (küçük alan)
  const TAU = Math.PI * 2;

  function R(deg) { return deg * Math.PI / 180; }
  function pt(ox, oy, len, ang) {
    return { x: ox + Math.cos(ang) * len, y: oy + Math.sin(ang) * len };
  }

  /* Usta state */
  const man = {
    x: 0, y: 0,
    phase: 'idle',   // idle | enter | paint | exit
    alpha: 0,
    walk: 0,
    targetX: 0,
    color: '#C9A227',
    rollerY: 0,      // rulonun hedef Y (duvar ortası)
  };

  function manBaseY() { return H - SC * 2; }

  function drawPainter() {
    if (man.alpha <= 0) return;
    const painting = man.phase === 'paint';
    const x = man.x, y = man.y;

    const LEG_H  = SC * 22;
    const HIP_Y  = -LEG_H;
    const TRS_H  = SC * 28;
    const SHLD_Y = HIP_Y - TRS_H;
    const HEAD_R = SC * 10;
    const HEAD_CY = SHLD_Y - SC * 6 - HEAD_R;

    const legSwing = painting ? 0 : Math.sin(man.walk) * 18;
    const frontAng = painting ? R(-50) : R(-15 + Math.sin(man.walk + Math.PI) * 25);
    const backAng  = painting ? R(-8)  : R(-15 + Math.sin(man.walk) * 25);

    ctx.save();
    ctx.globalAlpha = man.alpha;
    ctx.translate(x, y);
    /* usta her zaman sağa bakıyor (soldan sağa boyuyor) */

    /* bacaklar */
    _leg(-SC*4, HIP_Y,  legSwing, LEG_H);
    _leg( SC*4, HIP_Y, -legSwing, LEG_H);

    /* gövde */
    const bg = ctx.createLinearGradient(-SC*10, SHLD_Y, SC*10, HIP_Y);
    bg.addColorStop(0, '#eceff1'); bg.addColorStop(1, '#b0bec5');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(-SC*10, SHLD_Y, SC*20, TRS_H, SC*2); ctx.fill();
    ctx.fillStyle = 'rgba(201,162,39,0.25)';
    ctx.beginPath(); ctx.ellipse(-SC*3, SHLD_Y + SC*9, SC*4, SC*2.5, -0.4, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse( SC*3, SHLD_Y + SC*19, SC*2.5, SC*1.8, 0.5, 0, TAU); ctx.fill();

    /* arka kol */
    const bEl = pt(0, SHLD_Y, SC*14, backAng);
    const bHd = pt(bEl.x, bEl.y, SC*11, backAng*0.6 - 0.1);
    _seg(0, SHLD_Y, bEl.x, bEl.y, SC*5.5, '#cfd8dc');
    _seg(bEl.x, bEl.y, bHd.x, bHd.y, SC*4.5, '#cfd8dc');
    _hand(bHd.x, bHd.y, SC*3.2);

    /* ön kol + rulo */
    const fEl = pt(SC*2, SHLD_Y, SC*15, frontAng);
    const fHd = pt(fEl.x, fEl.y, SC*12, frontAng * 0.7 - 0.1);
    _seg(SC*2, SHLD_Y, fEl.x, fEl.y, SC*5.5, '#eceff1');
    _seg(fEl.x, fEl.y, fHd.x, fHd.y, SC*4.5, '#eceff1');

    /* RULO (elden çıkar) */
    _rollerAsm(fHd.x, fHd.y, painting, man.color);
    /* el sapı kavrar */
    _hand(fHd.x, fHd.y, SC*3.5);

    /* gövde ön (kemer) */
    ctx.fillStyle = '#37474f'; ctx.fillRect(-SC*10, HIP_Y - SC*2, SC*20, SC*4);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(-SC*3, HIP_Y - SC*2, SC*6, SC*4);

    /* boyun */
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.roundRect(-SC*3, HEAD_CY + HEAD_R, SC*6, SC*6, SC*1.5); ctx.fill();

    /* kafa + kask */
    _head(HEAD_CY, HEAD_R);

    ctx.restore();
  }

  function _leg(ox, hipY, swing, legH) {
    ctx.save(); ctx.translate(ox, hipY); ctx.rotate(R(swing));
    ctx.fillStyle = '#283593';
    ctx.beginPath(); ctx.roundRect(-SC*3, 0, SC*6, legH*0.55, SC*2); ctx.fill();
    ctx.fillStyle = '#1a237e';
    ctx.beginPath(); ctx.arc(0, legH*0.53, SC*4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#283593';
    ctx.beginPath(); ctx.roundRect(-SC*2.8, legH*0.53, SC*5.6, legH*0.47, SC*2); ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath(); ctx.ellipse(SC*1.2, legH + SC*1.5, SC*5.5, SC*2.8, 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function _seg(x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function _hand(hx, hy, r) {
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#e65100'; ctx.lineWidth = SC*0.6; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + i*r*0.5, hy - r*0.2);
      ctx.lineTo(hx + i*r*0.5, hy + r*0.6);
      ctx.stroke();
    }
  }

  function _rollerAsm(hx, hy, painting, color) {
    const sapAng = painting ? -0.18 : -0.1;
    const sapLen = SC * 42;  // kısaltıldı — ip görünümünü önler
    const sapEnd = pt(hx, hy, sapLen, sapAng);
    const grip   = pt(hx, hy, SC*12, sapAng);

    /* metal sap — kalın çizgi, ip görünmez */
    ctx.strokeStyle = '#607d8b'; ctx.lineWidth = SC*3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(sapEnd.x, sapEnd.y); ctx.stroke();

    /* grip kısmı — koyu, kalın */
    ctx.strokeStyle = '#263238'; ctx.lineWidth = SC*5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(grip.x, grip.y);
    ctx.stroke();

    /* rulo kafesi — dolgu kutu */
    ctx.fillStyle = '#78909c';
    ctx.fillRect(sapEnd.x - SC*4, sapEnd.y - SC*4, SC*8, SC*8);

    /* rulo silindiri */
    ctx.save();
    ctx.translate(sapEnd.x, sapEnd.y);
    ctx.rotate(Math.PI / 2);
    const rLen = SC*14, rRad = SC*5;
    const rg = ctx.createLinearGradient(-rLen, 0, rLen, 0);
    rg.addColorStop(0,    adjustBrightness(color, -40));
    rg.addColorStop(0.3,  adjustBrightness(color,  30));
    rg.addColorStop(0.7,  color);
    rg.addColorStop(1,    adjustBrightness(color, -30));
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.ellipse(0, 0, rLen, rRad, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#546e7a';
    ctx.beginPath(); ctx.ellipse(-rLen, 0, SC*2.5, rRad*0.8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse( rLen, 0, SC*2.5, rRad*0.8, 0, 0, TAU); ctx.fill();

    if (painting) {
      /* boya izi — rulo altına geniş yayılı, damla yok */
      ctx.fillStyle = colorWithAlpha(color, 0.5);
      ctx.beginPath(); ctx.ellipse(0, rRad + SC*0.5, rLen*0.85, SC*1.5, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function _head(cy, r) {
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = SC*6;
    ctx.fillStyle = '#ffcc80';
    ctx.beginPath(); ctx.arc(0, cy, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    /* kask */
    const kg = ctx.createLinearGradient(-r, cy - r, r, cy);
    kg.addColorStop(0, '#fff176'); kg.addColorStop(0.5, '#f9a825'); kg.addColorStop(1, '#e65100');
    ctx.fillStyle = kg;
    ctx.beginPath(); ctx.ellipse(0, cy - r*0.12, r*1.2, r*0.82, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f9a825';
    ctx.beginPath(); ctx.ellipse(0, cy - r*0.12, r*1.22, r*0.28, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#1565c0';
    ctx.beginPath(); ctx.arc(0, cy - r*0.65, r*0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${SC*4}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A', 0, cy - r*0.65);
    ctx.fillStyle = '#4e342e';
    ctx.beginPath(); ctx.arc( r*0.35, cy + r*0.12, r*0.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-r*0.35, cy + r*0.12, r*0.15, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.arc( r*0.41, cy + r*0.05, r*0.06, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#bf360c'; ctx.lineWidth = SC;
    ctx.beginPath(); ctx.arc(0, cy + r*0.28, r*0.34, 0.28, Math.PI - 0.28); ctx.stroke();
  }

  /* ── Renk yardımcıları ─────────────────────────────────────── */
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return {r,g,b};
  }
  function adjustBrightness(hex, amt) {
    const c = hexToRgb(hex);
    return `rgb(${Math.min(255,Math.max(0,c.r+amt))},${Math.min(255,Math.max(0,c.g+amt))},${Math.min(255,Math.max(0,c.b+amt))})`;
  }
  function colorWithAlpha(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  /* ══════════════════════════════════════════════════════════════
     ANİMASYON STATE MAKİNESİ
  ══════════════════════════════════════════════════════════════ */

  /* Hangi "şerit" (sütun aralığı) şu an boyandı */
  let paintX  = 0;   // rulonun canvas X pozisyonu (boyama cephesi)
  let painting = false;

  function startPainting(color) {
    man.color    = color;
    man.phase    = 'enter';
    man.alpha    = 0;
    man.x        = -SC * 60;
    man.y        = manBaseY();
    man.walk     = 0;
    painting     = true;
    paintX       = 0;
    paintedUpTo  = -1;   // yeni renk seçilince sıfırla
    paintedColor = color;
  }

  /* Rulonun dünya X koordinatı (elden → sap → rulo ucu) */
  function getRollerWorldX() {
    const frontAng = R(-50); // boyama açısı
    const fEl = pt(SC*2, 0, SC*15, frontAng);  // omuzdan dirsek (y sıfır = omuz lokal)
    const fHd = pt(fEl.x, fEl.y, SC*12, frontAng * 0.7 - 0.1);
    const sapAng = -0.18;
    const sapLen = SC * 70;
    const sapEnd = pt(fHd.x, fHd.y, sapLen, sapAng);
    return man.x + sapEnd.x; // lokal X → dünya X
  }

  /* ── UPDATE ─────────────────────────────────────────────────── */
  function update() {
    man.y = manBaseY();

    switch (man.phase) {

      case 'enter':
        man.alpha = Math.min(1, man.alpha + 0.04);
        man.x    += 1.2;
        man.walk += 0.12;
        /* ekrana girip boyama başlangıcına gelince */
        if (man.x >= SC * 20) {
          man.phase = 'paint';
          man.walk  = 0;
          paintX    = getRollerWorldX();
        }
        break;

      case 'paint':
        man.walk += 0.02;
        man.x    += 0.4; /* yavaş ilerleme */
        paintX    = getRollerWorldX();

        /* Rulonun geçtiği tuğraları boya */
        paintBricksAt(paintX, man.color);

        if (man.x > W + SC * 60) {
          man.phase = 'exit';
        }
        break;

      case 'exit':
        man.alpha = Math.max(0, man.alpha - 0.03);
        man.x    += 1.4;
        if (man.alpha <= 0) {
          man.phase = 'idle';
          painting  = false;
        }
        break;

      case 'idle':
      default:
        break;
    }
  }

  /* Rulo X pozisyonunu şerit bazlı boyamaya aktar */
  function paintBricksAt(rx, color) {
    if (rx > paintedUpTo) {
      paintedUpTo  = rx;
      paintedColor = color;
    }
  }

  /* ── NEON TABELA ────────────────────────────────────────────── */
  let signTick = 0;

  function drawSign() {
    signTick++;

    /* yanıp sönme ritmi: 90 frame açık, 8 frame kapalı, 4 frame açık, 8 kapalı */
    const cycle = signTick % 110;
    let glow = 1;
    if (cycle >= 90 && cycle < 98)  glow = 0;   // kısa söner
    else if (cycle >= 98 && cycle < 102) glow = 1;  // kısa yanar
    else if (cycle >= 102 && cycle < 110) glow = 0; // tekrar söner
    /* 0..1 arası — neon titreme */
    const flicker = glow * (0.85 + Math.sin(signTick * 0.4) * 0.15);

    const padX  = 14;
    const padY  = 10;
    const boxH  = 38;
    const boxW  = W - padX * 2;
    const boxY  = padY;
    const cx    = W / 2;
    const cy    = boxY + boxH / 2;

    ctx.save();

    /* tabela arka planı — koyu metal plaka */
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.roundRect(padX, boxY, boxW, boxH, 8);
    ctx.fill();

    /* metal çerçeve */
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(padX, boxY, boxW, boxH, 8);
    ctx.stroke();

    /* köşe vidaları */
    const screws = [
      [padX + 10, boxY + 9],
      [padX + boxW - 10, boxY + 9],
      [padX + 10, boxY + boxH - 9],
      [padX + boxW - 10, boxY + boxH - 9],
    ];
    screws.forEach(([sx, sy]) => {
      ctx.fillStyle = '#546e7a';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#263238'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(sx - 2, sy); ctx.lineTo(sx + 2, sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy - 2); ctx.lineTo(sx, sy + 2); ctx.stroke();
    });

    if (flicker > 0) {
      /* dış halo (glow) */
      ctx.save();
      ctx.globalAlpha = flicker * 0.35;
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, boxW * 0.65);
      halo.addColorStop(0,   'rgba(201,162,39,0.6)');
      halo.addColorStop(0.5, 'rgba(201,162,39,0.15)');
      halo.addColorStop(1,   'rgba(201,162,39,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.roundRect(padX, boxY, boxW, boxH, 8); ctx.fill();
      ctx.restore();

      /* ana metin — iki satır */
      ctx.save();
      ctx.globalAlpha = flicker;

      /* "AKDENİZ YAPI" */
      const fs1 = Math.max(11, Math.min(15, boxW / 18));
      ctx.font = `900 ${fs1}px 'Montserrat', sans-serif`;
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';

      /* neon sarı-altın metin glow */
      ctx.shadowColor  = '#ffd54f';
      ctx.shadowBlur   = 10 * flicker;
      ctx.fillStyle    = '#ffe082';
      ctx.fillText('AKDENİZ YAPI', cx, cy - 7);

      /* "DEKORASYON" */
      const fs2 = Math.max(8, Math.min(11, boxW / 24));
      ctx.font      = `700 ${fs2}px 'Montserrat', sans-serif`;
      ctx.shadowBlur = 8 * flicker;
      ctx.fillStyle  = '#c9a227';
      ctx.fillText('DEKORASYON', cx, cy + 8);

      ctx.restore();

      /* led nokta süslemeleri */
      ctx.save();
      ctx.globalAlpha = flicker * 0.8;
      const dotSpacing = Math.floor(boxW / 12);
      for (let i = 0; i < 12; i++) {
        const dx = padX + 20 + i * dotSpacing;
        const isOn = ((signTick + i * 3) % 20) < 14;
        ctx.fillStyle  = isOn ? '#ffd54f' : '#37474f';
        ctx.shadowColor = isOn ? '#ffd54f' : 'transparent';
        ctx.shadowBlur  = isOn ? 6 : 0;
        ctx.beginPath(); ctx.arc(dx, boxY + boxH - 5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(dx, boxY + 5, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /* ── RENDER ─────────────────────────────────────────────────── */
  function render() {
    drawWall();
    redrawPainted();
    drawSign();
    drawPainter();
  }

  /* ── LOOP ───────────────────────────────────────────────────── */
  function loop() {
    if (man.phase !== 'idle') {
      update();
      render();
    } else {
      /* idle'da sadece tabela yanıp sönsün */
      drawWall();
      redrawPainted();
      drawSign();
    }
    requestAnimationFrame(loop);
  }

  /* ── BAŞLAT ─────────────────────────────────────────────────── */
  function resize() {
    const wrap = canvas.parentElement;
    const cw = wrap ? wrap.clientWidth  : 400;
    const ch = wrap ? (wrap.clientHeight > 10 ? wrap.clientHeight : Math.round(cw * 3 / 4)) : 300;
    W = canvas.width  = cw;
    H = canvas.height = ch;
    buildCracks(); // yeni boyuta göre çatlakları yeniden üret
  }
  resize();
  window.addEventListener('resize', () => { resize(); });
  /* İlk yüklenmede otomatik başlat (altın renkle) */
  setTimeout(() => startPainting('#C9A227'), 600);
  loop();
})();
