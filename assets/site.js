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
