# MathVisuals

Free, projector-ready interactive math tools for teachers, by Mordechai Klein.
A plain static site (HTML, CSS, JavaScript) plus one small PHP file for the contact form. No build step and no frameworks.

## Folder structure

```
MathVisuals/
├── index.html                 Home: hero, tools by topic, about, FAQ, contact form
├── style-guide.html           Living style guide (colors, type, components) — noindex
├── privacy.html               Privacy policy (linked in every footer and from the contact form)
├── thank-you.html             Shown after the contact form is sent without JavaScript
├── 404.html                   "Page not found" (root-relative links; see .htaccess)
├── contact.php                Receives contact-form posts → data/submissions.csv (+ email)
├── data/                      Contact submissions (blocked from the web by data/.htaccess)
├── tools/
│   ├── integer-number-line/   index.html (vertical) + horizontal.html
│   ├── fraction-visualizer/
│   ├── equation-balance/
│   ├── polynomial-playground/
│   ├── graphing-explorer/
│   ├── real-life-graphs/
│   ├── probability-manipulator/
│   ├── bell-curve-simulator/
│   └── shape-transformations/
├── assets/
│   ├── css/
│   │   ├── site.css           THE style guide in code: tokens + shared components
│   │   ├── home.css           Home, thank-you, 404 and privacy page layout
│   │   ├── style-guide.css    Style guide page layout
│   │   └── tools/*.css        One stylesheet per tool (layout + tool-specific colors)
│   ├── js/
│   │   ├── theme-init.js      Applies light/dark mode before the page paints (in <head>)
│   │   ├── site.js            Dark-mode toggle, mobile menu, contact form, footer year
│   │   ├── style-guide.js     Live color values + contrast ratios on the style guide
│   │   └── tools/*.js         One script per tool
│   └── img/                   Logo, favicons, tool thumbnails (.webp), social images (og/*.jpg)
├── .htaccess                  404 page, caching, compression, security headers
├── robots.txt, sitemap.xml, site.webmanifest
```

Each page loads, in order: `theme-init.js` → Google Font → `site.css` → its own stylesheet → its own script (deferred) → `site.js` (deferred).
The only inline code is each page's JSON-LD structured data, which search engines require inline.

## Before going live

1. **Domain.** The site uses `https://mathvisuals.online` in every `.html` file, `sitemap.xml` and `robots.txt`
   (canonical links, Open Graph tags and structured data). If the domain changes, a project-wide find-and-replace is enough.
2. **Contact email.** `CONTACT_TO` at the top of `contact.php` receives the suggestions. On any server that can't send mail
   (a default XAMPP install can't), every submission is still saved to `data/submissions.csv`.
   If you add anything that collects or stores new information, update `privacy.html` and its "Last updated" date.
3. **Root folder.** The site is built to sit at the domain root. It also works from a sub-folder (for example on XAMPP),
   except the custom 404 page, whose links are root-relative.
4. **Search Console.** Submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
5. **Optional photo.** In `index.html`, the "MK" monogram in the About section can be swapped for a photo:
   replace `<div class="about__badge">…</div>` with `<img class="about__badge" src="…" alt="Mordechai Klein, math teacher">`.

## The style guide in brief

Full reference: open `style-guide.html`. Tokens live at the top of `assets/css/site.css`.

| Area | Rule |
| --- | --- |
| Font | Atkinson Hyperlegible (400/700) for everything; system monospace (`--font-mono`) for typed equations |
| Size | Fluid root size. Reading pages ≈ 16–20px; tool pages use the projector size, 16–28px |
| Type scale | `--fs-xs` 0.8rem → `--fs-4xl`. Nothing smaller than 0.8rem |
| Contrast | Body text ≥ 7:1 (AAA), UI boundaries ≥ 3:1, in light and dark mode |
| Borders | 2px for every boundary, 3px for selected or active, 6px for color bands |
| Corners | 8px inputs, 12px buttons, 18px panels/cards/modals, pill for tags/toggles |
| Buttons | `.btn` + `.btn-primary` / `.btn-ghost` / `.btn-danger` / `.btn-solid-danger`, sizes `.btn-sm` / `.btn-lg`; at least 44px tall. A custom color is one line: `.my-btn { --btn-bg: var(--data-5); }` |
| Data colors | `--data-1` … `--data-8`, ≥ 4.5:1 in both themes |
| Dark mode | `html[data-theme="dark"]` swaps the color tokens. Choice is saved in `localStorage` (`mv-theme`); otherwise the OS setting is followed |

## How the tools were brought into the site

The originals in `Personal/School/` were **not edited**. Each tool was copied here and:

- kept its layout and behavior; its markup sits inside `<div class="tool-frame">`, which is one screen tall minus the header
- had its stylesheet rewritten to use the shared tokens (colors, fonts, borders, radii, buttons) and to support dark mode
- had small markup changes only: its inner `<main>` became a `<div>` (one `<main>` per page), and buttons use the shared button classes

The only script change is in `graphing-explorer.js`, which draws its line colors in JavaScript. A `paint()` helper
swaps in lighter partners in dark mode, and the plane redraws on the `themechange` event fired by `site.js`.
The inline `style="margin-top:8px"` attributes in its pop-ups were moved into the stylesheet.

`polynomial-playground.js` (from `Personal/School/Polynomials/`) keeps the original's math core unchanged
(everything between `CORE START` and `CORE END`). Its drawing code uses `pp-` class names, writes to the
banner and the panel message line, reads the random-expression choices from radio buttons, adds the
"Hide panel" toggle, and shrinks long expressions to fit the board (`fit()`).

## Adding a new tool

1. Create `tools/<tool-name>/index.html` by copying an existing tool page. Update the `<title>`, meta description,
   canonical URL, Open Graph tags, JSON-LD and breadcrumb, then replace the `tool-frame` contents and the teacher notes.
2. Add `assets/css/tools/<tool-name>.css` using only `site.css` tokens, plus a `html[data-theme="dark"]` block if the tool has its own colors.
3. Add `assets/js/tools/<tool-name>.js`. If it draws colors in JavaScript, listen for `document`'s `themechange` event.
4. Add a card in the right category on `index.html`, a link in every page's footer, and a `<url>` in `sitemap.xml`.
