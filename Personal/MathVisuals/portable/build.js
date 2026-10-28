/* =====================================================================
   Portable build — each tool as ONE self-contained HTML file
   ---------------------------------------------------------------------
   Run:   node portable/build.js        (from the MathVisuals folder)
   Makes: portable/Equation Balance.html
          portable/Shape Transformations.html

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

/* [folder under tools/, name]: add a line here to make another tool portable */
var TOOLS = [
  ['equation-balance', 'Equation Balance'],
  ['shape-transformations', 'Shape Transformations']
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

function build(slug, name) {
  var page = read('tools/' + slug + '/index.html');
  var body = page.slice(page.indexOf('<body>'), page.indexOf('</body>'));

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

  if (/(href|src)="\.\.\//.test(body)) { throw new Error(name + ': a link to another file is still in the page.'); }

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

TOOLS.forEach(function (t) { build(t[0], t[1]); });
