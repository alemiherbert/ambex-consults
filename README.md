# Ambex Consults — Website

Static site for **Ambex Consults (U) Ltd**, a Ugandan HSEQ consultancy (health,
safety, environment & air quality). Pure HTML/CSS/JS — no database, no backend,
no build step for the main pages. Host it on GitHub Pages or any static host.

Derived from the Dokimos Consulting static-site codebase, rebranded and
restyled: flat/square corners, borders used sparingly (depth from shadows),
the three logo colors (green `#15B67F`, blue `#4A82DE`, brown `#3A2D00`)
carried through the design, Inter + Roboto Condensed, white light mode, dot
carousel, testimonials, the 3 Cs (Care, Compliance, Confidence), and a
client logo wall. Copy and contact details sourced from the archived
ambexconsults.com site (Dec 2025 snapshot).

## Pages

| Path | Purpose |
|---|---|
| `/` | Home — hero carousel, stats, about, services, approach, recent projects, testimonials, sectors, CTA |
| `/work` | Completed projects, filterable by category |
| `/people` | Team roster |
| `/insights` | Articles (generated — see below) |
| `/contact` | Contact details (static — there is intentionally no working form) |
| `/404.html` | Not-found page (GitHub Pages serves this automatically) |

## Local preview

```
python serve.py [port]      # default 8080, with live reload
```

## Writing articles

Articles are markdown files in `articles/`, compiled to static HTML in
`insights/` by a zero-dependency Node script:

1. Create `articles/my-article-slug.md`:

   ```markdown
   ---
   title: My article title
   description: One-line summary shown on cards and in meta tags.
   date: 2026-07-01
   tag: Safety
   image: /assets/images/insights/my-article-slug.jpg
   author: Ambex Consults
   ---

   Body in markdown: headings (##), lists, links, images, blockquotes,
   bold/italic, code blocks.
   ```

   `title` and `date` are required. Quote the value if it contains a colon.
   `image` and `author` are optional.

2. Build:

   ```
   npm run build       # or: node scripts/build.js
   ```

   This writes `insights/<slug>/index.html` for every article and regenerates
   the `insights/index.html` listing (sorted newest first).

3. Add the new article's URL to `sitemap.xml`, then commit **both** the
   markdown source and the generated HTML — GitHub Pages only serves files,
   nothing builds at deploy time.

Page shells for articles live in `templates/article.html` and
`templates/insights.html`; edit those (not the generated files) to change
article page chrome.

## Before launch — replace the placeholders

Everything marked with an HTML comment in the pages needs real data:

- **Stats** on the home page (`index.html`, "VERIFY FIGURES") — use Ambex's real numbers.
- **Projects** on `index.html` + `work/index.html` — the six entries are illustrative; swap in real completed projects. The 4 home-page cards are a hand-copied subset of the 6 on the Projects page — keep them in sync.
- **Testimonials** on `index.html` — placeholder attributions; use real quotes with permission.
- **Client logos** on `index.html` — six placeholder slots; add real logos to `assets/images/clients/`.
- **Team** on `people/index.html` — names, roles, bios, photos.
- **Contact details** — phone, address, and hours were taken from the archived ambexconsults.com; confirm they're still current.
- **Social links** on `contact/index.html` — currently `href="#"`.
- **Domain** — `ambexconsults.com` is assumed in canonical URLs, `robots.txt`, and `sitemap.xml`. If hosting on GitHub Pages under a different URL, search-and-replace it.

## Images

No photos ship with the repo. Every `<img>` has a JS fallback that renders a
striped "Add image" placeholder with the expected path, so the site works (and
tells you what's missing) before photos exist. Drop files at these paths:

| Folder | Files referenced | Suggested size |
|---|---|---|
| `assets/images/hero/` | `partner.webp`, `safety.webp`, `environment.webp` | 1920×1080, WebP |
| `assets/images/clients/` | `client-1.svg` … `client-6.svg` (logos, transparent bg) | ~280×88 |
| `assets/images/projects/` | `fuel-depot-esia.jpg`, `cement-air-baseline.jpg`, `beverage-ohs.jpg`, `road-corridor-monitoring.jpg`, `logistics-iso14001.jpg`, `hotel-fire-safety.jpg` | 1200×750 |
| `assets/images/people/` | `placeholder-1.jpg` … `placeholder-5.jpg` (rename freely, update HTML) | 800×1000 |
| `assets/images/insights/` | one per article, path set in frontmatter | 1200×750 |

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → deploy from the `main` branch, root folder.
3. `.nojekyll` is already present so folders serve as-is.
4. For a custom domain, add a `CNAME` file and update the domain everywhere
   noted above.

## Structure

```
index.html            home
work/ people/ contact/  static pages
insights/             GENERATED — don't edit by hand
articles/             markdown sources for insights
scripts/build.js      article generator (Node, zero deps)
templates/            page shells used by the generator
css/style.css         all styling; design tokens at the top
js/main.js            theme toggle, nav, carousel, filters, reveal
serve.py              local dev server with live reload
```
