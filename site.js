// Richard Abiona — shared behavior for every page.

// Show clean addresses: /product.html becomes /product, /index.html becomes /.
if (/\.html$/.test(location.pathname) && window.history && history.replaceState) {
  history.replaceState(null, '', location.pathname.replace(/(index)?\.html$/, '') + location.search + location.hash);
}
var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var pageName = document.body.getAttribute('data-page') || 'home';

// Analytics events: button clicks and sections viewed. No-ops where the tag isn't loaded.
function track(name, params) { if (typeof window.gtag === 'function') window.gtag('event', name, params); }
(function () {
  function whereIs(el) {
    if (el.closest('.nav')) return pageName + ' · nav';
    if (el.closest('.hero')) return pageName + ' · hero';
    var s = el.closest('section');
    return pageName + ' · ' + (s ? s.id : 'page');
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('a, button') : null;
    if (!el) return;
    var label = el.getAttribute('data-track') || el.getAttribute('aria-label') || el.textContent.replace('→', '').replace(/\s+/g, ' ').trim();
    track('button_click', { button_name: label.slice(0, 90), button_location: whereIs(el) });
  });
  if (!('IntersectionObserver' in window)) return;
  // Counts a section once per visit when it reaches the middle of the screen.
  var seen = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      track('section_view', { section_name: pageName + ' · ' + en.target.id });
      seen.unobserve(en.target);
    });
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('section[id]').forEach(function (s) { seen.observe(s); });
})();

// Mobile menu
(function () {
  var btn = document.getElementById('menu-btn'), links = document.getElementById('nav-links');
  if (!btn || !links) return;
  btn.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  });
})();

// Copy email
(function () {
  var btn = document.getElementById('copy-email'), link = document.getElementById('email');
  if (!btn || !link) return;
  btn.addEventListener('click', function () {
    var done = function () { btn.textContent = 'COPIED'; setTimeout(function () { btn.textContent = 'COPY'; }, 1600); };
    var select = function () { var r = document.createRange(); r.selectNodeContents(link); var s = getSelection(); s.removeAllRanges(); s.addRange(r); };
    try { navigator.clipboard.writeText(link.textContent).then(done, select); } catch (e) { select(); }
  });
})();

// Scroll progress bar
(function () {
  var bar = document.getElementById('progress'); if (!bar) return;
  var ticking = false;
  function update() {
    var h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    ticking = false;
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
})();

// Count-up for figures
function countUp(el) {
  var target = +el.getAttribute('data-count'), pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
  var t0 = null, dur = 1400;
  function fmt(n) { return pre + Math.round(n).toLocaleString('en-US') + suf; }
  function step(t) {
    if (!t0) t0 = t;
    var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * e);
    if (p < 1) requestAnimationFrame(step);
  }
  el.textContent = fmt(0);
  requestAnimationFrame(step);
}

// Scroll reveal: content already on screen at load stays as-is.
(function () {
  if (reduceMotion || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      el.classList.add('in'); el.classList.remove('pre');
      el.querySelectorAll('[data-count]').forEach(countUp);
      if (el.hasAttribute('data-count')) countUp(el);
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    if (el.getBoundingClientRect().top > innerHeight) { el.classList.add('pre'); io.observe(el); }
  });
})();

// Subtle 3D tilt on build cards (mouse only)
(function () {
  if (reduceMotion || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll('.build').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.classList.add('tilting');
      card.style.setProperty('--ry', ((x - 0.5) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--rx', ((0.5 - y) * 6).toFixed(2) + 'deg');
      card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    });
    card.addEventListener('pointerleave', function () {
      card.classList.remove('tilting');
      card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg');
    });
  });
})();

// Profile carousel: advances every 4 seconds, pauses on hover, focus, or the pause button.
(function () {
  var root = document.querySelector('.carousel'); if (!root) return;
  var track = root.querySelector('.carousel-track');
  var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.dot'));
  var pauseBtn = root.querySelector('[data-pause]');
  var MS = 4000, index = 0, timer = null, userPaused = reduceMotion, hovering = false;
  root.style.setProperty('--slide-ms', MS + 'ms');

  function show(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = 'translateX(' + (-100 * index) + '%)';
    slides.forEach(function (s, k) {
      var on = k === index;
      s.setAttribute('aria-hidden', on ? 'false' : 'true');
      s.querySelectorAll('a, button').forEach(function (a) { if (on) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
    });
    dots.forEach(function (d, k) { d.setAttribute('aria-selected', k === index ? 'true' : 'false'); d.tabIndex = k === index ? 0 : -1; });
    restartFill();
  }
  function restartFill() {
    // Restart the progress fill on the active tab so it matches the timer.
    root.classList.remove('playing'); void root.offsetWidth;
    if (timer) root.classList.add('playing');
  }
  function play() { stop(); if (userPaused || hovering || document.hidden) return; timer = setInterval(function () { show(index + 1); }, MS); restartFill(); }
  function stop() { if (timer) clearInterval(timer); timer = null; root.classList.remove('playing'); }
  function setPaused(p) {
    userPaused = p;
    if (pauseBtn) { pauseBtn.setAttribute('aria-pressed', p ? 'true' : 'false'); pauseBtn.setAttribute('aria-label', p ? 'Play slideshow' : 'Pause slideshow'); pauseBtn.textContent = p ? '▶' : '❚❚'; }
    if (p) stop(); else play();
  }

  dots.forEach(function (d, k) {
    d.addEventListener('click', function () { show(k); play(); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1)); dots[index].focus(); play(); }
    });
  });
  var prev = root.querySelector('[data-prev]'), next = root.querySelector('[data-next]');
  if (prev) prev.addEventListener('click', function () { show(index - 1); play(); });
  if (next) next.addEventListener('click', function () { show(index + 1); play(); });
  if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!userPaused); });

  var vp = root.querySelector('.carousel-viewport');
  vp.addEventListener('mouseenter', function () { hovering = true; stop(); });
  vp.addEventListener('mouseleave', function () { hovering = false; play(); });
  root.addEventListener('focusin', function () { hovering = true; stop(); });
  root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { hovering = false; play(); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else play(); });

  // Swipe on touch screens
  var x0 = null;
  vp.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') x0 = e.clientX; });
  vp.addEventListener('pointerup', function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { show(index + (dx < 0 ? 1 : -1)); play(); }
  });

  show(0);
  setPaused(userPaused);
})();

// Lightbox for gallery photos
(function () {
  var shots = Array.prototype.slice.call(document.querySelectorAll('.shot[data-full]'));
  if (!shots.length) return;
  var box = document.createElement('div');
  box.className = 'lightbox'; box.hidden = true;
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = '<div class="lightbox-bar"><button class="icon-btn" type="button" data-close aria-label="Close photo">✕</button></div>' +
    '<div class="lightbox-stage"><img alt=""></div>' +
    '<div class="lightbox-foot"><button class="icon-btn" type="button" data-step="-1" aria-label="Previous photo">←</button><p></p><button class="icon-btn" type="button" data-step="1" aria-label="Next photo">→</button></div>';
  document.body.appendChild(box);
  var img = box.querySelector('img'), cap = box.querySelector('p'), current = 0, opener = null;
  function open(i) {
    current = (i + shots.length) % shots.length;
    var s = shots[current], thumb = s.querySelector('img');
    img.src = s.getAttribute('data-full'); img.alt = thumb ? thumb.alt : '';
    var fig = s.closest('figure'), fc = fig ? fig.querySelector('figcaption') : null;
    cap.textContent = fc ? fc.textContent : '';
    box.hidden = false; document.body.style.overflow = 'hidden';
    box.querySelector('[data-close]').focus();
  }
  function close() { box.hidden = true; document.body.style.overflow = ''; img.src = ''; if (opener) opener.focus(); }
  shots.forEach(function (s, i) { s.addEventListener('click', function () { opener = s; open(i); }); });
  box.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]') || e.target === box || e.target.classList.contains('lightbox-stage')) close();
    var st = e.target.closest('[data-step]'); if (st) open(current + +st.getAttribute('data-step'));
  });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') open(current + 1);
    if (e.key === 'ArrowLeft') open(current - 1);
  });
})();

// ---------- Hero charts: one live chart per profile ----------
function heroCanvas(id, draw, cycle) {
  var c = document.getElementById(id); if (!c) return;
  var ctx = c.getContext('2d'), W, H, start = null;
  var css = getComputedStyle(document.documentElement);
  var col = {
    line: css.getPropertyValue('--hero-line').trim() || '#26324a',
    accent: css.getPropertyValue('--hero-accent').trim() || '#6f8cff',
    warn: css.getPropertyValue('--hero-warn').trim() || '#e0a83c',
    muted: css.getPropertyValue('--hero-muted').trim() || '#9aa6ba'
  };
  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = c.clientWidth; H = c.clientHeight;
    c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function frame(t) {
    if (!start) start = t;
    draw(ctx, W, H, col, ((t - start) % cycle) / cycle);
    requestAnimationFrame(frame);
  }
  size();
  addEventListener('resize', function () { size(); if (reduceMotion) draw(ctx, W, H, col, 0.75); });
  if (reduceMotion) draw(ctx, W, H, col, 0.75); else requestAnimationFrame(frame);
}
function box(W, H) {
  var narrow = W < 760;
  // Desktop: the chart sits in the upper right, clear of the headline column.
  return { narrow: narrow, top: narrow ? 22 : H * 0.14, bot: narrow ? 100 : H * 0.52, left: narrow ? 16 : W * 0.6, right: W - (narrow ? 16 : 40) };
}
// Phase helper: 0–0.68 draws, 0.68–0.93 holds, 0.93–1 fades.
function phase(p) { return p < 0.68 ? { prog: p / 0.68, alpha: 1 } : p < 0.93 ? { prog: 1, alpha: 1 } : { prog: 1, alpha: 1 - (p - 0.93) / 0.07 }; }

// Product: a 13-sprint burndown that ends on the go/no-go call.
heroCanvas('burndown', function (ctx, W, H, col, p) {
  var b = box(W, H), S = 13, actual = [100, 96, 90, 86, 84, 74, 66, 61, 49, 38, 27, 15, 6, 0], ph = phase(p);
  var x = function (i) { return b.left + (b.right - b.left) * i / S; };
  var y = function (v) { return b.bot - (b.bot - b.top) * v / 100; };
  ctx.clearRect(0, 0, W, H); ctx.globalAlpha = ph.alpha; ctx.font = '11px "IBM Plex Mono", Consolas, monospace'; ctx.lineWidth = 1;
  ctx.strokeStyle = col.line;
  for (var g = 0; g <= 4; g++) { ctx.globalAlpha = ph.alpha * 0.5; ctx.beginPath(); ctx.moveTo(b.left, y(g * 25)); ctx.lineTo(b.right, y(g * 25)); ctx.stroke(); }
  ctx.fillStyle = col.muted; ctx.globalAlpha = ph.alpha * 0.85;
  if (!b.narrow) {
    ctx.textAlign = 'right'; ctx.fillText('SCOPE', b.left - 12, y(100) + 4); ctx.fillText('0', b.left - 12, y(0) + 4);
    ctx.textAlign = 'center'; for (var s = 1; s <= S; s++) if (s === 1 || s % 3 === 0 || s === S) ctx.fillText('S' + s, x(s), b.bot + 20);
  }
  ctx.setLineDash([5, 6]); ctx.strokeStyle = col.muted; ctx.globalAlpha = ph.alpha * 0.45;
  ctx.beginPath(); ctx.moveTo(x(0), y(100)); ctx.lineTo(x(S), y(0)); ctx.stroke(); ctx.setLineDash([]);
  var q = ph.prog * S, n = Math.floor(q), f = q - n, tipX, tipY;
  ctx.globalAlpha = ph.alpha; ctx.strokeStyle = col.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(0), y(actual[0]));
  for (var i = 1; i <= n; i++) ctx.lineTo(x(i), y(actual[i]));
  if (n < S) { tipX = x(n) + (x(n + 1) - x(n)) * f; tipY = y(actual[n] + (actual[n + 1] - actual[n]) * f); ctx.lineTo(tipX, tipY); } else { tipX = x(S); tipY = y(0); }
  ctx.stroke();
  ctx.fillStyle = col.accent;
  for (var j = 0; j <= Math.min(n, S); j++) { ctx.beginPath(); ctx.arc(x(j), y(actual[j]), 2.6, 0, Math.PI * 2); ctx.fill(); }
  if (ph.prog < 1) { ctx.beginPath(); ctx.arc(tipX, tipY, 4, 0, Math.PI * 2); ctx.fill(); }
  else {
    ctx.strokeStyle = col.warn; ctx.fillStyle = col.warn; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x(S), y(0), 6, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText('GO / NO-GO: GO', x(S) - 8, b.top + 4);
  }
  ctx.globalAlpha = 1;
}, 10300);

// Quality: an X-bar control chart that samples, and flags points beyond the limits.
heroCanvas('spc', function (ctx, W, H, col, p) {
  var b = box(W, H), N = 30, mid = (b.top + b.bot) / 2, sig = (b.bot - b.top) / 8, ph = phase(p);
  var y = function (v) { return mid - v * sig; };
  var x = function (i) { return b.left + (b.right - b.left) * i / (N - 1); };
  var pts = [0.4, -0.6, 1.1, 0.2, -1.4, 0.8, -0.3, 1.6, -0.9, 0.1, 2.2, -1.8, 0.5, 3.4, -0.4, 0.9, -1.1, 1.3, -0.2, 0.6, -2.4, 0.3, 1.0, -0.7, -3.3, 0.4, 1.7, -0.5, 0.2, -1.0];
  ctx.clearRect(0, 0, W, H); ctx.globalAlpha = ph.alpha; ctx.font = '11px "IBM Plex Mono", Consolas, monospace'; ctx.lineWidth = 1;
  for (var s = -3; s <= 3; s++) {
    ctx.strokeStyle = col.line; ctx.globalAlpha = ph.alpha * (s === 0 ? 0.9 : 0.5);
    ctx.setLineDash(Math.abs(s) === 3 ? [6, 5] : s === 0 ? [] : [2, 6]);
    ctx.beginPath(); ctx.moveTo(b.left, y(s)); ctx.lineTo(b.right, y(s)); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.fillStyle = col.muted; ctx.globalAlpha = ph.alpha * 0.85; ctx.textAlign = 'right';
  if (!b.narrow) { ctx.fillText('UCL +3σ', b.left - 10, y(3) + 4); ctx.fillText('CL  x̄', b.left - 10, y(0) + 4); ctx.fillText('LCL −3σ', b.left - 10, y(-3) + 4); }
  var n = Math.max(1, Math.floor(ph.prog * N));
  ctx.globalAlpha = ph.alpha; ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5; ctx.beginPath();
  for (var i = 0; i < n; i++) { if (i) ctx.lineTo(x(i), y(pts[i])); else ctx.moveTo(x(i), y(pts[i])); }
  ctx.stroke();
  for (var j = 0; j < n; j++) {
    var out = Math.abs(pts[j]) > 3;
    ctx.fillStyle = out ? col.warn : col.accent; ctx.beginPath(); ctx.arc(x(j), y(pts[j]), out ? 4 : 2.4, 0, Math.PI * 2); ctx.fill();
    if (out) { ctx.strokeStyle = col.warn; ctx.globalAlpha = ph.alpha * 0.6; ctx.beginPath(); ctx.arc(x(j), y(pts[j]), 9, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = ph.alpha;
      if (!b.narrow) { ctx.textAlign = 'center'; ctx.fillText('OUT OF CONTROL', x(j), y(pts[j]) + (pts[j] > 0 ? -16 : 24)); } }
  }
  ctx.globalAlpha = 1;
}, 10300);

// Impact: UNSUB adoption, 17 to 2,000 users over two months.
heroCanvas('adoption', function (ctx, W, H, col, p) {
  var b = box(W, H), WEEKS = 8, ph = phase(p);
  var users = function (t) { return 17 + (2000 - 17) / (1 + Math.exp(-1.25 * (t - 4.6))) - (2000 - 17) / (1 + Math.exp(1.25 * 4.6)); };
  var max = users(WEEKS);
  var x = function (t) { return b.left + (b.right - b.left) * t / WEEKS; };
  var y = function (v) { return b.bot - (b.bot - b.top) * v / max; };
  ctx.clearRect(0, 0, W, H); ctx.globalAlpha = ph.alpha; ctx.font = '11px "IBM Plex Mono", Consolas, monospace'; ctx.lineWidth = 1;
  ctx.strokeStyle = col.line;
  for (var g = 0; g <= 4; g++) { ctx.globalAlpha = ph.alpha * 0.5; ctx.beginPath(); ctx.moveTo(b.left, y(max * g / 4)); ctx.lineTo(b.right, y(max * g / 4)); ctx.stroke(); }
  ctx.fillStyle = col.muted; ctx.globalAlpha = ph.alpha * 0.85;
  if (!b.narrow) {
    ctx.textAlign = 'right'; ctx.fillText('USERS', b.left - 12, y(max) + 4); ctx.fillText('17', b.left - 12, y(0) + 4);
    ctx.textAlign = 'center'; for (var w = 1; w <= WEEKS; w++) ctx.fillText('WK ' + w, x(w), b.bot + 20);
  }
  var tEnd = ph.prog * WEEKS;
  ctx.globalAlpha = ph.alpha; ctx.strokeStyle = col.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x(0), y(users(0)));
  for (var t = 0.1; t <= tEnd; t += 0.1) ctx.lineTo(x(t), y(users(t)));
  ctx.stroke();
  ctx.lineTo(x(tEnd), b.bot); ctx.lineTo(x(0), b.bot); ctx.closePath();
  var grad = ctx.createLinearGradient(0, b.top, 0, b.bot); grad.addColorStop(0, 'rgba(111,140,255,0.16)'); grad.addColorStop(1, 'rgba(111,140,255,0)');
  ctx.fillStyle = grad; ctx.fill();
  ctx.fillStyle = col.accent;
  for (var k = 0; k <= Math.floor(tEnd); k++) { ctx.beginPath(); ctx.arc(x(k), y(users(k)), 2.6, 0, Math.PI * 2); ctx.fill(); }
  if (ph.prog >= 1) {
    ctx.strokeStyle = col.warn; ctx.fillStyle = col.warn; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x(WEEKS), y(max), 6, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText('2,000 USERS', x(WEEKS) - 12, y(max) + 4);
  }
  ctx.globalAlpha = 1;
}, 10300);
