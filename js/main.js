/**
 * Ambex Consults — shared site behavior.
 * Every page's content is static HTML. This script only wires up
 * interactive behavior: theme toggle, mobile nav, hero carousel (dots),
 * project filters, scroll-reveal, and the broken-image fallback. Each
 * setup function below no-ops on pages that don't have its target
 * elements, so this one file is safe to load on every page unconditionally.
 */
(function () {
  'use strict';

  function attachImageFallbacks(root) {
    root.querySelectorAll('img.js-img').forEach((img) => {
      img.addEventListener('error', function onError() {
        const label = img.dataset.path || 'image';
        const fallback = document.createElement('div');
        fallback.className = 'img-fallback';
        fallback.innerHTML = `<span>Add image<br>${label}</span>`;
        img.replaceWith(fallback);
      }, { once: true });
    });
  }

  function setupFooterYear() {
    const el = document.getElementById('footer-year');
    if (el) el.textContent = new Date().getFullYear();
  }

  function setupHeaderScroll(page) {
    const header = document.getElementById('site-header');
    if (page !== 'home') return; // other pages hardcode is-scrolled in markup
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function setupNavToggle(page) {
    const toggle = document.getElementById('nav-toggle');
    const drawer = document.getElementById('mobile-nav-drawer');
    const header = document.getElementById('site-header');
    const closeBtn = drawer && drawer.querySelector('.mobile-nav-close');
    if (!toggle || !drawer || !closeBtn) return;

    function syncHeaderSolid(open) {
      if (page !== 'home') return;
      if (open) header.classList.add('is-scrolled');
      else if (window.scrollY <= 24) header.classList.remove('is-scrolled');
    }
    // Lock background scroll while the drawer is open. A plain
    // `overflow:hidden` on body isn't enough on iOS Safari — it still
    // rubber-bands the page underneath, which is exactly what exposes gaps
    // around the pushed content. Pinning body at its current scroll offset
    // (and restoring it on close) blocks that completely.
    let lockedScrollY = 0;
    function setScrollLock(locked) {
      if (locked) {
        lockedScrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
      } else {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        window.scrollTo(0, lockedScrollY);
      }
    }
    function setOpen(open) {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      syncHeaderSolid(open);
      setScrollLock(open);
    }
    toggle.addEventListener('click', () => {
      setOpen(!document.body.classList.contains('nav-open'));
    });
    closeBtn.addEventListener('click', () => setOpen(false));
    drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    // Clicking outside the drawer (the pushed-aside page, or its dimmed
    // sliver) closes it too. #page-shell has pointer-events:none while open,
    // so those clicks already fall through to document — this just catches them.
    document.addEventListener('click', (e) => {
      if (!document.body.classList.contains('nav-open')) return;
      if (drawer.contains(e.target) || toggle.contains(e.target)) return;
      setOpen(false);
    });
  }

  function setupThemeToggle() {
    const toggle = document.getElementById('theme-toggle');
    if (!toggle) return;
    toggle.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      window.localStorage.setItem('theme', next);
    });
  }

  function setupReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    els.forEach((el) => io.observe(el));
  }

  function setupCarousel() {
    const root = document.getElementById('hero-carousel');
    const media = document.getElementById('hero-media');
    const headline = document.getElementById('hero-headline');
    const subheadline = document.getElementById('hero-subheadline');
    if (!root || !media) return;
    const slides = media.querySelectorAll('.hero-slide');
    const dots = root.querySelectorAll('.carousel-dot');
    if (slides.length < 2) return;

    const DURATION_MS = 5000;
    const TEXT_FADE_MS = 300;

    let index = 0;
    let timer = null;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setActive(nextIndex) {
      slides[index].classList.remove('is-active');
      index = (nextIndex + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
      if (headline && subheadline) {
        const data = slides[index].dataset;
        headline.classList.add('is-fading');
        subheadline.classList.add('is-fading');
        window.setTimeout(() => {
          headline.textContent = data.headline;
          subheadline.textContent = data.subheadline;
          subheadline.setAttribute('href', data.href);
          headline.classList.remove('is-fading');
          subheadline.classList.remove('is-fading');
        }, TEXT_FADE_MS);
      }
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function start() {
      if (reduceMotion) return;
      stop();
      timer = window.setInterval(() => setActive(index + 1), DURATION_MS);
    }

    dots.forEach((dot) => dot.addEventListener('click', () => {
      const target = Number(dot.dataset.index);
      if (target === index) return;
      setActive(target);
      start();
    }));
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);

    start();
  }

  function setupProjectFilters() {
    const buttons = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.project-card');
    if (!buttons.length) return;
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        buttons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const filter = btn.dataset.filter;
        cards.forEach((card) => {
          const match = filter === 'All' || card.dataset.category === filter;
          card.classList.toggle('is-hidden', !match);
        });
      });
    });
  }

  /* ---------------------------------------------------------------------
   * Boot
   * ------------------------------------------------------------------- */

  const page = document.body.dataset.page;

  attachImageFallbacks(document);
  setupFooterYear();
  setupHeaderScroll(page);
  setupNavToggle(page);
  setupThemeToggle();
  setupReveal();
  if (page === 'home') setupCarousel();
  if (page === 'work') setupProjectFilters();
})();
