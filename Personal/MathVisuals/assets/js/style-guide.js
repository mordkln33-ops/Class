/* =====================================================================
   style-guide.js — fills in the color swatches on /style-guide.html
   ---------------------------------------------------------------------
   For every <li class="swatch" data-token="--name">:
     • paints the chip with that token
     • prints the token's current value (hex)
     • for swatches marked data-contrast, prints the WCAG contrast ratio
       against --color-surface, with a AAA / AA / UI / decorative label
   Re-runs on "themechange" so the numbers always match the theme on
   screen. Reading values live means the guide can't drift from the CSS.
   ===================================================================== */
(function () {
  'use strict';

  var swatches = document.querySelectorAll('.swatch[data-token]');
  if (!swatches.length) { return; }

  /* Resolve any CSS color (hex, rgb, var(...)) to [r, g, b]
     by letting the browser compute it on a hidden probe element. */
  var probe = document.createElement('span');
  probe.hidden = true;
  document.body.appendChild(probe);

  function toRgb(cssColor) {
    probe.style.color = cssColor;
    var m = getComputedStyle(probe).color.match(/[\d.]+/g) || [0, 0, 0];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      return Math.round(v).toString(16).padStart(2, '0');
    }).join('');
  }

  /* WCAG 2.x relative luminance and contrast ratio */
  function luminance(rgb) {
    var c = rgb.map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }

  function contrast(a, b) {
    var l1 = luminance(a);
    var l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function grade(ratio) {
    if (ratio >= 7) { return 'AAA text'; }
    if (ratio >= 4.5) { return 'AA text'; }
    if (ratio >= 3) { return 'UI / large text'; }
    return 'decorative';
  }

  function render() {
    var surface = toRgb('var(--color-surface)');

    swatches.forEach(function (sw) {
      var token = sw.getAttribute('data-token');
      var rgb = toRgb('var(' + token + ')');

      sw.querySelector('.swatch__chip').style.background = 'var(' + token + ')';
      sw.querySelector('.swatch__value').textContent = toHex(rgb);

      if (sw.hasAttribute('data-contrast')) {
        var ratio = contrast(rgb, surface);
        var tag = sw.querySelector('.swatch__ratio');
        if (!tag) {
          tag = document.createElement('span');
          tag.className = 'tag swatch__ratio';
          sw.appendChild(tag);
        }
        tag.textContent = ratio.toFixed(1) + ':1 · ' + grade(ratio);
      }
    });
  }

  render();
  document.addEventListener('themechange', render);
})();
