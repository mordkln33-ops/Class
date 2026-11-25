/* =====================================================================
   Portable build — each tool as ONE self-contained HTML file
   ---------------------------------------------------------------------
   Run:   node portable/build.js        (from the MathVisuals folder)
   Makes: one portable/<Tool Name>.html for every tool in TOOLS below.
          The Integer Number Line has two pages (vertical and
          horizontal), so it makes two files that link to each other:
          keep them in the same folder.

   Everything a tool needs is put inside its one file: the styles,
   the scripts, the logo and the Atkinson Hyperlegible font (from
   portable/fonts). Copy it to a USB drive and double-click it on any
   computer: it opens in the browser, with no installing and no
   internet. Run this again after changing the tool to rebuild it.
   ===================================================================== */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

/* [folder under tools/, name, page (default index.html), links to sibling pages]:
   add a line here to make another tool portable. The links map an href in the
   page to the name of another portable file, so the two files link to each other. */
var TOOLS = [
  ['integer-number-line', 'Integer Number Line', 'index.html', { 'horizontal.html': 'Horizontal Number Line' }],
  ['integer-number-line', 'Horizontal Number Line', 'horizontal.html', { './': 'Integer Number Line' }],
  ['fraction-visualizer', 'Fraction Visualizer'],
  ['equation-balance', 'Equation Balance'],
  ['polynomial-playground', 'Polynomial Playground'],
  ['graphing-explorer', 'Graphing Explorer'],
  ['real-life-graphs', 'Real-Life Graphs'],
  ['probability-manipulator', 'Probability Manipulator'],
  ['bell-curve-simulator', 'Bell Curve Simulator'],
  ['shape-transformations', 'Shape Transformations'],
  ['line-constructions', 'Line Constructions']
];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function base64(rel) { return fs.readFileSync(path.join(ROOT, rel)).toString('base64'); }

/* swap one piece of the page, and stop if it isn't there (the page changed) */
function swap(html, pattern, replacement) {
  if (!pattern.test(html)) { throw new Error('Not found in the page: ' + pattern); }
  return html.replace(pattern, function () { return replacement; });
}

/* inline <script>: a "</script>" inside the code would end it early */
function scriptTag(code) { return '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>'; }

var FONTS = [
  ['normal', 400, 'regular'],
  ['normal', 700, 'bold'],
  ['italic', 400, 'italic'],
  ['italic', 700, 'bold-italic']
];

var fontCss = FONTS.map(function (f) {
  return '@font-face { font-family: "Atkinson Hyperlegible"; font-style: ' + f[0] + '; font-weight: ' + f[1] +
    '; font-display: swap; src: url(data:font/woff2;base64,' + base64('portable/fonts/' + f[2] + '.woff2') + ') format("woff2"); }';
}).join('\n');

var logo = 'data:image/svg+xml;base64,' + base64('assets/img/logo.svg');
var favicon = 'data:image/svg+xml;base64,' + base64('assets/img/favicon.svg');

function build(slug, name, file, links) {
  var page = read('tools/' + slug + '/' + (file || 'index.html'));
  var body = page.slice(page.indexOf('<body>'), page.indexOf('</body>'));

  /* links between the pages of one tool point at the sibling portable file */
  Object.keys(links || {}).forEach(function (href) {
    var target = 'href="' + encodeURI(links[href] + '.html') + '"';
    var pattern = new RegExp('href="' + href.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '"', 'g');
    body = swap(body, pattern, target);
  });

  /* the brand is plain text here: there is no website to go back to */
  body = body.replace(/<a class="brand" href="[^"]*"[^>]*>([\s\S]*?)<\/a>/g, function (m, inner) {
    return '<span class="brand">' + inner + '</span>';
  });
  body = body.replace(/src="[^"]*logo\.svg"/g, function () { return 'src="' + logo + '"'; });

  /* header: no breadcrumb, and only the link that stays on this page */
  body = swap(body, /\s*<nav class="breadcrumb"[\s\S]*?<\/nav>/, '');
  body = swap(body, /<ul class="site-nav__list" id="site-nav-list">[\s\S]*?<\/ul>/,
    '<ul class="site-nav__list" id="site-nav-list">\n' +
    '            <li><a class="site-nav__link" href="#about-tool">Teacher notes</a></li>\n' +
    '          </ul>');

  /* links to the other tools would lead nowhere offline */
  body = swap(body, /\s*<section class="aside-card">\s*<h2>Related tools<\/h2>[\s\S]*?<\/section>/, '');

  body = swap(body, /<footer class="site-footer">[\s\S]*?<\/footer>/,
    '<footer class="site-footer">\n' +
    '    <div class="container">\n' +
    '      <div class="site-footer__bottom">\n' +
    '        <p>© <span data-year>2026</span> Mordechai Klein. All rights reserved. Offline copy of ' + name + ' from MathVisuals.</p>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '  </footer>');

  /* anything that isn't inside this file, on the web, or a sibling portable file would lead nowhere */
  var siblings = Object.keys(links || {}).map(function (h) { return encodeURI(links[h] + '.html'); });
  var stray = body.match(/(href|src)="(?!#|data:|https?:|mailto:)[^"]*"/g) || [];
  stray = stray.filter(function (m) { return siblings.indexOf(m.replace(/^(href|src)="|"$/g, '')) < 0; });
  if (stray.length) { throw new Error(name + ': links to other files are still in the page: ' + stray.join(', ')); }

  var html = '<!DOCTYPE html>\n' +
    '<html lang="en" class="is-tool">\n' +
    '<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '  <title>' + name + ' | MathVisuals</title>\n' +
    '  <meta name="author" content="Mordechai Klein">\n' +
    '  <meta name="color-scheme" content="light dark">\n' +
    '  <link rel="icon" href="' + favicon + '" type="image/svg+xml">\n' +
    '  ' + scriptTag(read('assets/js/theme-init.js')) + '\n' +
    '  <style>\n' + fontCss + '\n' + read('assets/css/site.css') + '\n' + read('assets/css/tools/' + slug + '.css') + '\n  </style>\n' +
    '</head>\n' +
    body +
    scriptTag(read('assets/js/tools/' + slug + '.js')) + '\n' +
    scriptTag(read('assets/js/site.js')) + '\n' +
    '</body>\n' +
    '</html>\n';

  var out = path.join(__dirname, name + '.html');
  fs.writeFileSync(out, html);
  console.log('Built ' + path.relative(ROOT, out) + ' (' + Math.round(html.length / 1024) + ' KB)');
}

TOOLS.forEach(function (t) { build(t[0], t[1], t[2], t[3]); });
