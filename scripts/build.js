#!/usr/bin/env node
/**
 * Ambex Consults — static article generator.
 *
 * Turns markdown files in articles/ into static HTML pages under insights/,
 * plus the insights/index.html listing page. No dependencies — run with:
 *
 *     node scripts/build.js        (or: npm run build)
 *
 * Each article is a .md file with YAML-ish frontmatter:
 *
 *     ---
 *     title: What the OSH Act means for your site inductions
 *     description: One-line summary shown on cards and in meta tags.
 *     date: 2026-06-15
 *     tag: Safety
 *     image: /assets/images/insights/osh-act.jpg   (optional)
 *     author: Ambex Consults                        (optional)
 *     ---
 *
 *     Markdown body...
 *
 * The output filename comes from the source filename: articles/osh-act.md
 * becomes insights/osh-act/index.html. Commit the generated files — GitHub
 * Pages just serves them, nothing runs at deploy time.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const OUT_DIR = path.join(ROOT, 'insights');
const TPL_DIR = path.join(ROOT, 'templates');

/* ----------------------------------------------------------------------
 * Frontmatter
 * -------------------------------------------------------------------- */

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    let value = line.slice(idx + 1).trim();
    // allow optionally quoted values (needed when the value itself has a colon)
    if (/^".*"$/.test(value) || /^'.*'$/.test(value)) value = value.slice(1, -1);
    meta[line.slice(0, idx).trim()] = value;
  }
  return { meta, body: raw.slice(match[0].length) };
}

/* ----------------------------------------------------------------------
 * Markdown → HTML (small, covers the constructs articles actually use:
 * headings, paragraphs, bold/italic, links, images, lists, blockquotes,
 * inline code, fenced code blocks, and horizontal rules).
 * -------------------------------------------------------------------- */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) { i += 1; continue; }

    // fenced code block
    if (/^```/.test(line)) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1; // closing fence
      out.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // heading
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = Math.min(h[1].length + 1, 4); // # → h2 (page h1 is the title)
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // horizontal rule
    if (/^(---|\*\*\*)\s*$/.test(line)) { out.push('<hr>'); i += 1; continue; }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      out.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`);
      continue;
    }

    // lists
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const itemRe = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      const items = [];
      while (i < lines.length && itemRe.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(itemRe, ''))}</li>`);
        i += 1;
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    // paragraph (gather consecutive non-blank lines)
    const buf = [line];
    i += 1;
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,4}\s|>|[-*]\s|\d+\.\s|```|---\s*$)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}

/* ----------------------------------------------------------------------
 * Rendering
 * -------------------------------------------------------------------- */

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? vars[key] : m));
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function build() {
  const articleTpl = fs.readFileSync(path.join(TPL_DIR, 'article.html'), 'utf8');
  const indexTpl = fs.readFileSync(path.join(TPL_DIR, 'insights.html'), 'utf8');

  const files = fs.existsSync(ARTICLES_DIR)
    ? fs.readdirSync(ARTICLES_DIR).filter((f) => f.endsWith('.md'))
    : [];

  const articles = files.map((file) => {
    const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');
    if (!meta.title || !meta.date) {
      throw new Error(`articles/${file}: frontmatter needs at least "title" and "date"`);
    }
    return {
      slug,
      title: meta.title,
      description: meta.description || '',
      date: meta.date,
      tag: meta.tag || 'Insights',
      image: meta.image || '',
      author: meta.author || 'Ambex Consults',
      html: mdToHtml(body),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));

  // one page per article
  for (const a of articles) {
    const heroBlock = a.image
      ? `<div class="article-hero"><div class="media-frame"><img class="js-img" data-path="${a.image}" src="${a.image}" alt="" loading="eager"></div></div>`
      : '';
    const page = render(articleTpl, {
      title: escapeHtml(a.title),
      description: escapeHtml(a.description),
      tag: escapeHtml(a.tag),
      dateIso: a.date,
      dateHuman: formatDate(a.date),
      author: escapeHtml(a.author),
      slug: a.slug,
      heroBlock,
      content: a.html,
    });
    const dir = path.join(OUT_DIR, a.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page);
    console.log(`  insights/${a.slug}/index.html`);
  }

  // listing page
  const cards = articles.map((a) => {
    const media = a.image
      ? `<div class="news-media"><div class="media-frame"><img class="js-img" data-path="${a.image}" src="${a.image}" alt="" loading="lazy"></div></div>`
      : '';
    return `<a class="news-card" href="/insights/${a.slug}/" data-reveal>
          ${media}
          <div class="news-body">
            <span class="news-tag">${escapeHtml(a.tag)}</span>
            <h3 class="news-title">${escapeHtml(a.title)}</h3>
            <time class="news-date" datetime="${a.date}">${formatDate(a.date)}</time>
            <p class="news-excerpt">${escapeHtml(a.description)}</p>
          </div>
        </a>`;
  }).join('\n        ');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), render(indexTpl, { cards }));
  console.log('  insights/index.html');
  console.log(`Built ${articles.length} article(s).`);
}

build();
