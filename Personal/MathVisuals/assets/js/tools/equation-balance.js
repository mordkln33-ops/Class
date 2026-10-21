/* =====================================================================
   Equation Balance — tool script
   ---------------------------------------------------------------------
   1. Exact fractions ....... every value is a fraction, so 7 ÷ 2 and
                              1 ÷ 3 stay exact
   2. Expression trees ...... numbers, x, + − × ÷, exponents, ( )
   3. Typesetting ........... trees → HTML (fractions, exponents,
                              highlights)
   4. Input fields .......... the expression builder and the number
                              fields: digits from the keyboard only
   5. Step engine ........... one order-of-operations step at a time
   6. Equation moves ........ apply + − × ÷ to a side and tidy it up
                              (3x + 4 − 4 → 3x), random equations
   7. The scale ............. SVG frame + HTML cards on the pans, tilted
                              by a small spring animation
   8. Standard math mode
   9. Solve for x mode
  10. Keyboard, number pad, tabs, start-up

   Wrapped in one function so nothing leaks into the global scope.
   ===================================================================== */
(function () {
  'use strict';

  var MINUS = '−';
  var TIMES = '×';
  var DIVIDE = '÷';

  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ===================================================================
     1. EXACT FRACTIONS  { n: numerator, d: denominator > 0 }
     =================================================================== */

  function MathError(code) { this.code = code; }

  var MATH_MESSAGES = {
    zero: 'You can’t divide by zero.',
    big: 'That number is too big to show on the scale.'
  };

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = a % b; a = b; b = t; }
    return a;
  }

  function rat(n, d) {
    if (d === undefined) { d = 1; }
    if (d === 0) { throw new MathError('zero'); }
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) ||
        Math.abs(n) > 1e15 || Math.abs(d) > 1e15) { throw new MathError('big'); }
    if (n === 0) { return { n: 0, d: 1 }; }
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  var ONE = rat(1);

  function add(a, b) { return rat(a.n * b.d + b.n * a.d, a.d * b.d); }
  function sub(a, b) { return rat(a.n * b.d - b.n * a.d, a.d * b.d); }
  function mul(a, b) { return rat(a.n * b.n, a.d * b.d); }
  function div(a, b) {
    if (b.n === 0) { throw new MathError('zero'); }
    return rat(a.n * b.d, a.d * b.n);
  }
  function neg(a) { return rat(-a.n, a.d); }
  function powR(a, e) {
    var r = ONE;
    for (var i = 0; i < e; i++) { r = mul(r, a); }
    return r;
  }
  function cmpR(a, b) {
    var x = a.n * b.d - b.n * a.d;
    return x > 0 ? 1 : x < 0 ? -1 : 0;
  }
  function eqR(a, b) { return a.n === b.n && a.d === b.d; }
  function isInt(a) { return a.d === 1; }
  function toFloat(a) { return a.n / a.d; }

  function opApply(op, a, b) {
    if (op === '+') { return add(a, b); }
    if (op === MINUS) { return sub(a, b); }
    if (op === TIMES) { return mul(a, b); }
    return div(a, b);
  }

  /* decimal places needed, or -1 if the decimal never ends */
  function decimalPlaces(d) {
    var twos = 0, fives = 0;
    while (d % 2 === 0) { d /= 2; twos++; }
    while (d % 5 === 0) { d /= 5; fives++; }
    return d === 1 ? Math.max(twos, fives) : -1;
  }

  function showsAsDecimal(a) {
    if (a.d === 1) { return true; }
    var p = decimalPlaces(a.d);
    return p >= 0 && p <= 4;
  }

  /* plain-text form, used in messages and the number fields */
  function fmt(a) {
    var sign = a.n < 0 ? MINUS : '';
    var n = Math.abs(a.n);
    if (a.d === 1) { return sign + n; }
    if (showsAsDecimal(a)) { return sign + (n / a.d).toFixed(decimalPlaces(a.d)); }
    return sign + n + '/' + a.d;
  }

  /* ===================================================================
     2. EXPRESSION TREES
     Nodes: num {v}, var (x), bin {op, l, r, implicit}, pow {base, e},
     paren {inner}. Trees are never changed in place; a step builds a
     new tree that shares the untouched branches (and their ids, so
     highlights can follow a node from one step to the next).
     =================================================================== */

  var uid = 0;
  function mkNum(v) { return { t: 'num', v: v, id: ++uid }; }
  function mkVar() { return { t: 'var', id: ++uid }; }
  function mkBin(op, l, r, implicit) { return { t: 'bin', op: op, l: l, r: r, implicit: !!implicit, id: ++uid }; }
  function mkParen(inner) { return { t: 'paren', inner: inner, id: ++uid }; }
  function mkPow(base, e) { return { t: 'pow', base: base, e: e, id: ++uid }; }

  function copyNode(n, changes) {
    var o = {}, k;
    for (k in n) { if (Object.prototype.hasOwnProperty.call(n, k)) { o[k] = n[k]; } }
    for (k in changes) { if (Object.prototype.hasOwnProperty.call(changes, k)) { o[k] = changes[k]; } }
    return o;
  }

  function unwrap(n) { while (n.t === 'paren') { n = n.inner; } return n; }
  function isNum(n) { return unwrap(n).t === 'num'; }
  function valOf(n) { return unwrap(n).v; }
  function isAddSub(n) { return n.t === 'bin' && (n.op === '+' || n.op === MINUS); }

  function hasVar(n) {
    switch (n.t) {
      case 'var': return true;
      case 'num': return false;
      case 'paren': return hasVar(n.inner);
      case 'pow': return hasVar(n.base);
      default: return hasVar(n.l) || hasVar(n.r);
    }
  }

  function countVar(n) {
    switch (n.t) {
      case 'var': return 1;
      case 'num': return 0;
      case 'paren': return countVar(n.inner);
      case 'pow': return countVar(n.base);
      default: return countVar(n.l) + countVar(n.r);
    }
  }

  function evaluate(n, x) {
    switch (n.t) {
      case 'num': return n.v;
      case 'var': return x;
      case 'paren': return evaluate(n.inner, x);
      case 'pow': return powR(evaluate(n.base, x), n.e);
      default: return opApply(n.op, evaluate(n.l, x), evaluate(n.r, x));
    }
  }

  /* put a value in for x, wrapped in parentheses: 3x → 3(5) */
  function substitute(n, x, ids) {
    switch (n.t) {
      case 'var':
        var p = mkParen(mkNum(x));
        ids.push(p.id);
        return p;
      case 'num': return n;
      case 'paren': return copyNode(n, { inner: substitute(n.inner, x, ids) });
      case 'pow': return copyNode(n, { base: substitute(n.base, x, ids) });
      default: return copyNode(n, { l: substitute(n.l, x, ids), r: substitute(n.r, x, ids) });
    }
  }

  /* ===================================================================
     3. TYPESETTING
     ctx = { frac: show ÷ as a stacked fraction, hl: { nodeId: class } }
     =================================================================== */

  /* dec: Standard math shows any non-whole number as a decimal rounded
     to the nearest hundredth (the value itself stays exact) */
  function numHtml(a, dec) {
    if (dec && !isInt(a)) {
      var r = Math.round(toFloat(a) * 100) / 100;
      var s = Math.abs(r).toFixed(2).replace(/\.?0+$/, '');
      return '<span class="m-num">' + (r < 0 && s !== '0' ? MINUS : '') + s + '</span>';
    }
    if (showsAsDecimal(a)) { return '<span class="m-num">' + fmt(a) + '</span>'; }
    return (a.n < 0 ? '<span class="m-num">' + MINUS + '</span>' : '') +
      '<span class="m-frac"><span class="m-top">' + Math.abs(a.n) + '</span><span class="m-bot">' + a.d + '</span></span>';
  }

  function paren(html) {
    return '<span class="m-paren">(</span>' + html + '<span class="m-paren">)</span>';
  }

  function isNegNum(n) { return n.t === 'num' && n.v.n < 0; }

  function render(n, ctx, dropParens) {
    var h;
    if (n.t === 'num') {
      h = numHtml(n.v, ctx.dec);
    } else if (n.t === 'var') {
      h = '<i class="m-var">x</i>';
    } else if (n.t === 'paren') {
      /* a value put in for x keeps its parentheses, even inside a fraction */
      h = (dropParens && ctx.hl[n.id] !== 'm-sub') ? render(n.inner, ctx) : paren(render(n.inner, ctx));
    } else if (n.t === 'pow') {
      var b = n.base, bh = render(b, ctx);
      if ((b.t === 'num' && (b.v.n < 0 || !showsAsDecimal(b.v) || b.v.d !== 1)) || b.t === 'bin' || b.t === 'pow') { bh = paren(bh); }
      h = bh + '<sup class="m-sup">' + n.e + '</sup>';
    } else if (n.op === DIVIDE && ctx.frac) {
      h = '<span class="m-frac"><span class="m-top">' + render(n.l, ctx, true) +
        '</span><span class="m-bot">' + render(n.r, ctx, true) + '</span></span>';
    } else if (n.implicit) {
      /* a coefficient written next to what it multiplies: 3x, 3(x + 4), −x */
      var L = n.l, lh;
      if (L.t === 'num' && eqR(L.v, rat(-1)) && !ctx.hl[L.id]) { lh = '<span class="m-num">' + MINUS + '</span>'; }
      else if (L.t === 'num' && eqR(L.v, ONE) && !ctx.hl[L.id]) { lh = ''; }
      else { lh = render(L, ctx); }
      var rh = render(n.r, ctx);
      if (n.r.t === 'num' || n.r.t === 'bin') { rh = paren(rh); }
      h = lh + rh;
    } else {
      var rh2 = render(n.r, ctx);
      if (isNegNum(n.r)) { rh2 = paren(rh2); }
      h = render(n.l, ctx) + '<span class="m-op' + (n.opHl ? ' m-pending-op' : '') + '">' + n.op + '</span>' + rh2;
    }
    var cls = ctx.hl && ctx.hl[n.id];
    return cls ? '<span class="' + cls + '">' + h + '</span>' : h;
  }

  function plainCtx(frac) { return { frac: !!frac, hl: {} }; }

  /* ===================================================================
     4. INPUT FIELDS
     Only digits come from the keyboard. Everything else is a button.
     =================================================================== */

  var CARET = '<span class="caret" aria-hidden="true"></span>';

  function shake(el) {
    el.classList.remove('is-shaking');
    void el.offsetWidth;            /* restart the animation */
    el.classList.add('is-shaking');
    setTimeout(function () { el.classList.remove('is-shaking'); }, 360);
  }

  function reject(field, msg) {
    if (msg) { say(msg, 'error'); }
    shake(field.el);
  }

  /* tokens as typed, before they are parsed */
  function tokensHtml(tokens, expOpen, withCaret) {
    var h = '';
    tokens.forEach(function (t, i) {
      if (t.t === 'num') { h += '<span class="m-num">' + t.s.replace('-', MINUS) + '</span>'; }
      else if (t.t === 'x') { h += '<i class="m-var">x</i>'; }
      else if (t.t === 'op') { h += '<span class="m-op">' + t.v + '</span>'; }
      else if (t.t === '(' || t.t === ')') { h += '<span class="m-paren">' + t.t + '</span>'; }
      else if (t.t === 'pow') {
        var open = expOpen && i === tokens.length - 1;
        h += '<sup class="m-sup' + (open ? ' is-open' : '') + '">' + (t.s || (open ? '&#8203;' : '')) +
          (open && withCaret ? CARET : '') + '</sup>';
      }
    });
    if (withCaret && !expOpen) { h += CARET; }
    return h;
  }

  /* ---------- 4a. The expression builder ---------- */

  function Builder(el, opts) {
    this.el = el;
    this.allowX = !!opts.allowX;
    this.allowMinus = false;          /* the keyboard "-" is not accepted here */
    this.onChange = opts.onChange;
    this.onEnter = opts.onEnter;
    this.expBtn = opts.expBtn;
    this.placeholder = opts.placeholder;
    this.tokens = [];
    this.expOpen = false;
    el.__ebField = this;
    this.render();
  }

  Builder.prototype.last = function () { return this.tokens[this.tokens.length - 1]; };

  Builder.prototype.endsWithValue = function () {
    var t = this.last();
    if (!t) { return false; }
    if (t.t === 'num') { return t.s !== '-'; }
    if (t.t === 'pow') { return t.s !== ''; }
    return t.t === 'x' || t.t === ')';
  };

  Builder.prototype.openCount = function () {
    var d = 0;
    this.tokens.forEach(function (t) { if (t.t === '(') { d++; } else if (t.t === ')') { d--; } });
    return d;
  };

  Builder.prototype.closeExp = function () {
    if (!this.expOpen) { return; }
    this.expOpen = false;
    var t = this.last();
    if (t && t.t === 'pow' && t.s === '') { this.tokens.pop(); }
  };

  /* returns true, or a message saying why the key can't go here */
  Builder.prototype.apply = function (k) {
    var T = this.tokens, t = this.last();

    if (/^[0-9]$/.test(k)) {
      if (this.expOpen) {
        if (t.s.length >= 2) { return 'Exponents can have up to 2 digits.'; }
        t.s += k;
        return true;
      }
      if (t && t.t === 'num') {
        var digits = t.s.replace('-', '');
        if (digits.length >= 6) { return 'Numbers can have up to 6 digits.'; }
        if (digits === '0') { t.s = t.s.replace('0', k); return true; }   /* no leading zeros */
        t.s += k;
        return true;
      }
      if (t && (t.t === ')' || t.t === 'x' || t.t === 'pow')) { return 'Choose an operation before the next number.'; }
      if (T.length >= 40) { return 'That expression is long enough to fit on the scale.'; }
      T.push({ t: 'num', s: k });
      return true;
    }

    if (k === 'back') {
      if (!t) { return true; }
      if (t.t === 'pow') {
        if (t.s === '') { T.pop(); this.expOpen = false; }
        else { t.s = t.s.slice(0, -1); this.expOpen = true; }
        return true;
      }
      this.expOpen = false;
      if (t.t === 'num' && t.s.length > 1) { t.s = t.s.slice(0, -1); return true; }
      T.pop();
      return true;
    }

    if (k === 'clear') { this.tokens = []; this.expOpen = false; return true; }

    if (k === '^') {
      if (this.expOpen) { this.closeExp(); return true; }
      if (t && t.t === 'pow') { return 'That already has an exponent.'; }
      if (!this.endsWithValue()) { return 'Type a number (or close a parenthesis) first, then add its exponent.'; }
      T.push({ t: 'pow', s: '' });
      this.expOpen = true;
      return true;
    }

    this.closeExp();
    t = this.last();

    if (k === '+' || k === MINUS || k === TIMES || k === DIVIDE) {
      /* − at the start, after ( or after an operation starts a negative number */
      if (k === MINUS && (!t || t.t === '(' || t.t === 'op')) { T.push({ t: 'num', s: '-' }); return true; }
      if (t && t.t === 'op') { t.v = k; return true; }        /* swap the operation */
      if (!this.endsWithValue()) { return t ? 'Type the number first.' : 'Start with a number.'; }
      T.push({ t: 'op', v: k });
      return true;
    }

    if (k === '(') {
      if (t && t.t === 'num' && t.s === '-') { return 'Type the number after the negative sign.'; }
      if (T.length >= 40) { return 'That expression is long enough to fit on the scale.'; }
      T.push({ t: '(', implicit: this.endsWithValue() });   /* 3( means 3 × ( */
      return true;
    }

    if (k === ')') {
      if (this.openCount() <= 0) { return 'There is no open parenthesis to close.'; }
      if (!this.endsWithValue()) { return 'Put something inside the parentheses first.'; }
      T.push({ t: ')' });
      return true;
    }

    if (k === 'x' && this.allowX) {
      if (t && t.t === 'num') { T.push({ t: 'x', implicit: true }); return true; }   /* 3x, −x */
      if (t && (t.t === ')' || t.t === 'x' || t.t === 'pow')) { return 'Choose an operation before x.'; }
      T.push({ t: 'x' });
      return true;
    }

    return 'Only numbers come from the keyboard.';
  };

  Builder.prototype.key = function (k) {
    var ok = this.apply(k);
    if (ok === true) {
      this.render();
      this.onChange(this);
    } else {
      reject(this, ok);
    }
  };

  Builder.prototype.enter = function () { this.onEnter(); };

  Builder.prototype.render = function () {
    this.el.innerHTML = this.tokens.length
      ? tokensHtml(this.tokens, this.expOpen, true)
      : '<span class="placeholder">' + this.placeholder + '</span>' + CARET;
    if (this.expBtn) { this.expBtn.setAttribute('aria-pressed', this.expOpen ? 'true' : 'false'); }
  };

  /* → { tree } or { msg } */
  Builder.prototype.parse = function () {
    this.closeExp();
    this.render();
    var T = this.tokens, t = this.last();
    if (!T.length) { return { msg: 'Type an expression first.' }; }
    if (t.t === 'op' || (t.t === 'num' && t.s === '-')) { return { msg: 'The expression can’t end with an operation.' }; }
    if (t.t === '(') { return { msg: 'Put something inside the parentheses.' }; }
    if (this.openCount() > 0) { return { msg: 'Close every parenthesis first.' }; }
    try {
      return { tree: parseTokens(T) };
    } catch (e) {
      return { msg: 'Part of the expression is unfinished.' };
    }
  };

  /* Precedence parser: + − below × ÷ (and implied ×) below exponents. */
  function parseTokens(tokens) {
    var i = 0;
    function peek() { return tokens[i]; }
    function fail() { throw new Error('parse'); }

    function expr() {
      var n = term();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === MINUS)) {
        var op = tokens[i++].v;
        n = mkBin(op, n, term());
      }
      return n;
    }
    function term() {
      var n = factor();
      for (;;) {
        var t = peek();
        if (!t) { break; }
        if (t.t === 'op' && (t.v === TIMES || t.v === DIVIDE)) { i++; n = mkBin(t.v, n, factor()); }
        else if ((t.t === '(' || t.t === 'x') && t.implicit) { n = mkBin(TIMES, n, factor(), true); }
        else { break; }
      }
      return n;
    }
    function powOf(n) {
      var t = peek();
      if (t && t.t === 'pow') {
        i++;
        if (t.s === '') { fail(); }
        return mkPow(n, parseInt(t.s, 10));
      }
      return n;
    }
    function factor() { return powOf(primary()); }
    function primary() {
      var t = tokens[i++];
      if (!t) { fail(); }
      if (t.t === 'num') {
        if (t.s === '-') {
          var nx = peek();
          if (nx && nx.t === 'x') {          /* −x, and −x² means −(x²) */
            i++;
            return mkBin(TIMES, mkNum(rat(-1)), powOf(mkVar()), true);
          }
          fail();
        }
        return mkNum(rat(parseInt(t.s, 10)));
      }
      if (t.t === 'x') { return mkVar(); }
      if (t.t === '(') {
        var n = expr();
        var c = tokens[i++];
        if (!c || c.t !== ')') { fail(); }
        return mkParen(n);
      }
      fail();
    }

    var root = expr();
    if (i < tokens.length) { fail(); }
    return root;
  }

  /* ---------- 4b. A number field (value of x, the Undo number) ---------- */

  function KeyField(el, opts) {
    this.el = el;
    this.allowMinus = true;
    this.maxLen = opts.maxLen || 4;
    this.masked = !!opts.masked;
    this.placeholder = opts.placeholder || '';
    this.onEnter = opts.onEnter || function () {};
    this.onChange = opts.onChange || function () {};
    this.value = '';
    el.__ebField = this;
    this.render();
  }

  KeyField.prototype.key = function (k) {
    var v = this.value;
    if (/^[0-9]$/.test(k)) {
      var digits = v.replace('-', '');
      if (digits.length >= this.maxLen) { reject(this, 'Up to ' + this.maxLen + ' digits here.'); return; }
      this.value = digits === '0' ? v.replace('0', k) : v + k;
    } else if (k === '-') {
      this.value = v.charAt(0) === '-' ? v.slice(1) : '-' + v;     /* toggle the sign */
    } else if (k === 'back') {
      this.value = v.slice(0, -1);
    } else if (k === 'clear') {
      this.value = '';
    } else {
      reject(this, 'Only numbers can be typed here.');
      return;
    }
    this.render();
    this.onChange(this);
  };

  KeyField.prototype.set = function (v) { this.value = v; this.render(); };
  KeyField.prototype.enter = function () { this.onEnter(); };

  KeyField.prototype.number = function () {
    if (this.value === '' || this.value === '-') { return null; }
    return parseInt(this.value, 10);
  };

  KeyField.prototype.render = function () {
    var v = this.value;
    var shown = this.masked ? v.replace(/./g, '•') : v.replace('-', MINUS);
    this.el.innerHTML = (v ? '<span class="kf-val">' + shown + '</span>' : '<span class="placeholder">' + this.placeholder + '</span>') + CARET;
    this.el.classList.toggle('is-masked', this.masked);
  };

  /* ===================================================================
     5. STEP ENGINE — the order of operations
     The next step is the operation whose two inputs are both plain
     numbers, chosen by: deepest inside parentheses first, then
     exponents, then × ÷, then + −, and leftmost on a tie.
     =================================================================== */

  var LEVEL = {};
  LEVEL['+'] = 1; LEVEL[MINUS] = 1; LEVEL[TIMES] = 2; LEVEL[DIVIDE] = 2;

  var VERB = {};
  VERB['+'] = 'Add'; VERB[MINUS] = 'Subtract'; VERB[TIMES] = 'Multiply'; VERB[DIVIDE] = 'Divide';

  function findNext(root) {
    var best = null, order = 0;
    function consider(n, depth, level, ord) {
      if (!best || depth > best.depth ||
          (depth === best.depth && (level > best.level || (level === best.level && ord < best.ord)))) {
        best = { node: n, depth: depth, level: level, ord: ord };
      }
    }
    (function walk(n, depth) {
      var ord = ++order;
      if (n.t === 'paren') { walk(n.inner, depth + 1); return; }
      if (n.t === 'pow') {
        if (isNum(n.base)) { consider(n, depth, 3, ord); } else { walk(n.base, depth); }
        return;
      }
      if (n.t === 'bin') {
        if (isNum(n.l) && isNum(n.r)) { consider(n, depth, LEVEL[n.op], ord); }
        else { walk(n.l, depth); walk(n.r, depth); }
      }
    })(root, 0);
    return best;
  }

  /* swap one node for another; a ( ) left around a lone number goes too */
  function replaceNode(n, target, repl) {
    if (n === target) { return repl; }
    var c;
    if (n.t === 'paren') {
      c = replaceNode(n.inner, target, repl);
      if (c === n.inner) { return n; }
      return c.t === 'num' ? c : copyNode(n, { inner: c });
    }
    if (n.t === 'pow') {
      c = replaceNode(n.base, target, repl);
      return c === n.base ? n : copyNode(n, { base: c });
    }
    if (n.t === 'bin') {
      var l = replaceNode(n.l, target, repl), r = replaceNode(n.r, target, repl);
      return (l === n.l && r === n.r) ? n : copyNode(n, { l: l, r: r });
    }
    return n;
  }

  function buildSteps(root) {
    var steps = [], cur = root;
    for (var guard = 0; guard < 80; guard++) {
      var nx = findNext(cur);
      if (!nx) { break; }
      var n = nx.node, value, verb, cat;
      if (n.t === 'pow') {
        value = powR(valOf(n.base), n.e);
        verb = 'Exponent';
        cat = 'E';
      } else {
        value = opApply(n.op, valOf(n.l), valOf(n.r));
        verb = VERB[n.op];
        cat = LEVEL[n.op] === 2 ? 'MD' : 'AS';
      }
      var repl = mkNum(value);
      var after = replaceNode(cur, n, repl);
      steps.push({ node: n, after: after, value: value, verb: verb, cat: cat, inParens: nx.depth > 0, newId: repl.id });
      cur = after;
    }
    return steps;
  }

  /* ===================================================================
     6. EQUATION MOVES
     =================================================================== */

  var INVERSE = {};
  INVERSE['+'] = MINUS; INVERSE[MINUS] = '+'; INVERSE[TIMES] = DIVIDE; INVERSE[DIVIDE] = TIMES;

  /* other + b, written as other − |b| when b is negative */
  function plusConst(other, b) {
    if (b.n === 0) { return unwrap(other); }
    return b.n > 0 ? mkBin('+', other, mkNum(b)) : mkBin(MINUS, other, mkNum(neg(b)));
  }

  /* c × other, written as a coefficient: 3x, 3(x + 4), −x */
  function coef(c, other) {
    var o = unwrap(other);
    if (eqR(c, ONE)) { return o; }
    var atom = o.t === 'var' || o.t === 'pow';
    return mkBin(TIMES, mkNum(c), atom ? o : mkParen(o), true);
  }

  function divBy(other, d) {
    var o = unwrap(other);
    if (eqR(d, ONE)) { return o; }
    return mkBin(DIVIDE, isAddSub(o) ? mkParen(o) : o, mkNum(d));
  }

  /* when nothing tidies up, just write the operation on */
  function fallbackOp(E, op, k) {
    var e = unwrap(E);
    if (op === '+' || op === MINUS) { return mkBin(op, E, mkNum(k)); }
    if (op === TIMES) { return mkBin(TIMES, mkNum(k), (e.t === 'var' || e.t === 'pow') ? e : mkParen(e), true); }
    return divBy(E, k);
  }

  /* The side after "op k" is applied and tidied:
     3x + 4 − 4 → 3x,  3x ÷ 3 → x,  x/2 × 2 → x,  3x + 4 − 1 → 3x + 3,
     3x × 2 → 6x,  19 − 4 → 15. Anything else is written out in full. */
  function simplifyOp(E, op, k) {
    var e = unwrap(E);
    var addsub = op === '+' || op === MINUS;
    if (e.t === 'num') { return mkNum(opApply(op, e.v, k)); }
    if (e.t === 'var') {
      if (op === TIMES) { return coef(k, e); }
      if (op === DIVIDE) { return divBy(e, k); }
      return plusConst(e, op === '+' ? k : neg(k));
    }
    if (e.t === 'bin') {
      var lN = isNum(e.l), rN = isNum(e.r);
      if (addsub) {
        var b = null, other = null;
        if (e.op === '+' && rN) { b = valOf(e.r); other = e.l; }
        else if (e.op === '+' && lN) { b = valOf(e.l); other = e.r; }
        else if (e.op === MINUS && rN) { b = neg(valOf(e.r)); other = e.l; }
        if (b !== null) { return plusConst(other, op === '+' ? add(b, k) : sub(b, k)); }
        if (e.op === MINUS && lN) {                     /* c − (x part) */
          var c0 = op === '+' ? add(valOf(e.l), k) : sub(valOf(e.l), k);
          return c0.n === 0 ? coef(rat(-1), e.r) : mkBin(MINUS, mkNum(c0), e.r);
        }
      } else {
        if (e.op === TIMES && (lN || rN)) {
          var c = lN ? valOf(e.l) : valOf(e.r), o2 = lN ? e.r : e.l;
          if (op === TIMES) { return coef(mul(c, k), o2); }
          var q = div(c, k);
          if (isInt(q)) { return coef(q, o2); }
        }
        if (e.op === DIVIDE && rN) {
          var dv = valOf(e.r);
          if (op === DIVIDE) { return divBy(e.l, mul(dv, k)); }
          var q2 = div(dv, k);                          /* (A ÷ d) × k = A ÷ (d / k) */
          if (isInt(q2)) { return divBy(e.l, q2); }
          var inv = div(k, dv);                         /*             = (k / d) A    */
          if (isInt(inv)) { return coef(inv, e.l); }
        }
      }
    }
    return fallbackOp(E, op, k);
  }

  /* The side with "op k" written on, before tidying — shown for a moment */
  function showOp(E, op, k) {
    var e = unwrap(E);
    var node = (op === '+' || op === MINUS)
      ? mkBin(op, E, mkNum(k))
      : mkBin(op, isAddSub(e) ? mkParen(e) : E, mkNum(k));
    node.opHl = true;
    return node;
  }

  /* the outermost thing done to x, e.g. 3x + 4 → { op: +, k: 4, inner: 3x } */
  function topStep(n) {
    var e = unwrap(n);
    if (e.t !== 'bin') { return null; }
    var lN = isNum(e.l), rN = isNum(e.r), s = null;
    if (e.op === '+' && rN) { s = { op: '+', k: valOf(e.r), inner: e.l }; }
    else if (e.op === '+' && lN) { s = { op: '+', k: valOf(e.l), inner: e.r }; }
    else if (e.op === MINUS && rN) { s = { op: MINUS, k: valOf(e.r), inner: e.l }; }
    else if (e.op === TIMES && lN) { s = { op: TIMES, k: valOf(e.l), inner: e.r }; }
    else if (e.op === TIMES && rN) { s = { op: TIMES, k: valOf(e.r), inner: e.l }; }
    else if (e.op === DIVIDE && rN) { s = { op: DIVIDE, k: valOf(e.r), inner: e.l }; }
    return s && hasVar(s.inner) ? s : null;
  }

  /* everything done to x, in the order it was done (x first) */
  function peel(n) {
    var chain = [];
    for (var guard = 0; guard < 20; guard++) {
      if (unwrap(n).t === 'var') { return chain.reverse(); }
      var s = topStep(n);
      if (!s) { return null; }
      chain.push(s);
      n = s.inner;
    }
    return null;
  }

  /* ---------- random equations ---------- */

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* how a generated equation writes each operation onto x */
  function buildOp(node, op, k) {
    if (op === '+' || op === MINUS) { return mkBin(op, node, mkNum(k)); }
    if (op === TIMES) { return mkBin(TIMES, mkNum(k), (node.t === 'var' || node.t === 'pow') ? node : mkParen(node), true); }
    return mkBin(DIVIDE, isAddSub(node) ? mkParen(node) : node, mkNum(k));
  }

  /* 1 step: any operation. 2 steps: one of + − and one of × ÷, in
     either order. 3 steps: the two kinds alternate. Every value along
     the way is a whole number, positive unless negatives are allowed. */
  function generate(steps, negOk) {
    for (var tries = 0; tries < 5000; tries++) {
      var kinds = steps === 1 ? [pick(['as', 'md'])]
        : steps === 2 ? (Math.random() < 0.5 ? ['as', 'md'] : ['md', 'as'])
        : (Math.random() < 0.5 ? ['md', 'as', 'md'] : ['as', 'md', 'as']);
      var x = negOk ? randInt(-15, 15) : randInt(1, 15);
      if (x === 0) { continue; }
      var node = mkVar(), val = rat(x), ok = true;
      for (var i = 0; i < kinds.length && ok; i++) {
        var op, k;
        if (kinds[i] === 'as') {
          op = pick(['+', MINUS]);
          k = randInt(1, 15);
        } else {
          op = pick([TIMES, DIVIDE]);
          k = randInt(2, 9);
          if (negOk && Math.random() < 0.25) { k = -k; }
        }
        val = opApply(op, val, rat(k));
        if (!isInt(val) || (!negOk && val.n <= 0) || Math.abs(val.n) > 150) { ok = false; }
        node = buildOp(node, op, rat(k));
      }
      if (ok) { return { x: rat(x), left: node, right: val }; }
    }
    return { x: rat(5), left: buildOp(buildOp(mkVar(), TIMES, rat(3)), '+', rat(4)), right: rat(19) };
  }

  /* ===================================================================
     7. THE SCALE
     The frame is SVG in a 1000 × 700 box. The cards on the pans are
     HTML (so fractions and exponents typeset properly), positioned
     from the same geometry on every animation frame.
     =================================================================== */

  var VB_W = 1000, VB_H = 700;
  var PX = 500, PY = 190;          /* pivot */
  var ARM = 340;                   /* pivot → hook */
  var HANG = 285;                  /* hook → pan rim */
  var CARD_W = 300, CARD_H = 225;  /* largest card, in box units */
  var FONT = 58;                   /* card font size, in box units */
  var MAX_TILT = 14;               /* degrees */

  function f1(v) { return v.toFixed(1); }

  function svgMarkup() {
    var ticks = '', i, a, r1, R2 = 126;
    for (i = -20; i <= 20; i += 5) {
      a = i * Math.PI / 180;
      r1 = i === 0 ? 102 : (i % 10 === 0 ? 110 : 116);
      ticks += '<line class="' + (i === 0 ? 'gauge-zero' : 'gauge-tick') + '" x1="' + f1(PX + r1 * Math.sin(a)) +
        '" y1="' + f1(PY - r1 * Math.cos(a)) + '" x2="' + f1(PX + R2 * Math.sin(a)) + '" y2="' + f1(PY - R2 * Math.cos(a)) + '"/>';
    }
    var a0 = 25 * Math.PI / 180;
    var arc = '<path class="gauge-arc" d="M ' + f1(PX - R2 * Math.sin(a0)) + ' ' + f1(PY - R2 * Math.cos(a0)) +
      ' A ' + R2 + ' ' + R2 + ' 0 0 1 ' + f1(PX + R2 * Math.sin(a0)) + ' ' + f1(PY - R2 * Math.cos(a0)) + '"/>';

    function pan(id, label) {
      var H = HANG;
      return '<g class="pan" id="' + id + '">' +
        '<line class="string" x1="0" y1="6" x2="-152" y2="' + H + '"/>' +
        '<line class="string" x1="0" y1="6" x2="152" y2="' + H + '"/>' +
        '<path class="bowl" d="M -170 ' + H + ' L 170 ' + H + ' Q 132 ' + (H + 46) + ' 0 ' + (H + 46) +
          ' Q -132 ' + (H + 46) + ' -170 ' + H + ' Z"/>' +
        '<text class="pan-label" x="0" y="' + (H + 24) + '">' + label + '</text>' +
        '<circle class="hook" cx="0" cy="0" r="10"/>' +
        '</g>';
    }

    return '<svg class="scale-svg is-empty" viewBox="0 0 ' + VB_W + ' ' + VB_H + '" aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<linearGradient id="ebMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="st-metal-1"/><stop offset="1" class="st-metal-2"/></linearGradient>' +
        '<linearGradient id="ebPost" x1="0" y1="0" x2="1" y2="0"><stop offset="0" class="st-post-1"/><stop offset="1" class="st-post-2"/></linearGradient>' +
        '<linearGradient id="ebPan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="st-pan-1"/><stop offset="1" class="st-pan-2"/></linearGradient>' +
      '</defs>' +
      '<g class="gauge">' + arc + ticks + '</g>' +
      '<rect class="post" x="' + (PX - 15) + '" y="' + PY + '" width="30" height="' + (645 - PY) + '" rx="6"/>' +
      '<path class="base" d="M 395 645 H 605 L 650 688 H 350 Z"/>' +
      '<g class="badge"><circle cx="' + PX + '" cy="390" r="46"/><text x="' + PX + '" y="392" id="ebRel">=</text></g>' +
      '<line class="needle" id="ebNeedle" x1="' + PX + '" y1="' + PY + '" x2="' + PX + '" y2="' + (PY - 118) + '"/>' +
      '<g id="ebBeam">' +
        '<rect class="beam" x="' + (PX - ARM - 28) + '" y="' + (PY - 13) + '" width="' + (2 * ARM + 56) + '" height="26" rx="13"/>' +
        '<circle class="beam-end" cx="' + (PX - ARM) + '" cy="' + PY + '" r="8"/>' +
        '<circle class="beam-end" cx="' + (PX + ARM) + '" cy="' + PY + '" r="8"/>' +
      '</g>' +
      '<circle class="pivot" cx="' + PX + '" cy="' + PY + '" r="20"/>' +
      pan('ebPanL', 'LEFT') + pan('ebPanR', 'RIGHT') +
      '</svg>';
  }

  function Scale(box, area) {
    var self = this;
    this.box = box;
    this.area = area;
    box.insertAdjacentHTML('afterbegin', svgMarkup());
    this.svg = box.querySelector('svg');
    this.beam = this.svg.querySelector('#ebBeam');
    this.needle = this.svg.querySelector('#ebNeedle');
    this.panL = this.svg.querySelector('#ebPanL');
    this.panR = this.svg.querySelector('#ebPanR');
    this.rel = this.svg.querySelector('#ebRel');
    this.cards = {
      L: { el: $('cardL'), body: $('cardL').querySelector('.pan-card__body'), cap: $('cardL').querySelector('.pan-card__cap') },
      R: { el: $('cardR'), body: $('cardR').querySelector('.pan-card__body'), cap: $('cardR').querySelector('.pan-card__cap') }
    };
    this.angle = 0;
    this.vel = 0;
    this.target = 0;
    this.unit = 1;
    this.raf = 0;
    this.lastTs = 0;

    if (window.ResizeObserver) {
      new ResizeObserver(function () { self.resize(); }).observe(area);
    }
    window.addEventListener('resize', function () { self.resize(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { self.fit('L'); self.fit('R'); self.place(); });
    }
    this.resize();
  }

  /* largest 1000 × 700 box that fits the free space */
  Scale.prototype.resize = function () {
    var cs = getComputedStyle(this.area);
    var w = this.area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var h = this.area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w <= 0 || h <= 0) { return; }
    var s = Math.min(w / VB_W, h / VB_H);
    this.unit = s;
    this.box.style.width = (VB_W * s) + 'px';
    this.box.style.height = (VB_H * s) + 'px';
    this.fit('L');
    this.fit('R');
    this.place();
  };

  Scale.prototype.setSide = function (side, html, cap, empty, flash) {
    var c = this.cards[side];
    c.body.innerHTML = html;
    c.cap.innerHTML = cap || '';
    c.el.classList.toggle('is-empty', !!empty);
    if (flash) {
      c.el.classList.remove('is-changed');
      void c.el.offsetWidth;
      c.el.classList.add('is-changed');
    }
    this.fit(side);
    this.place();
  };

  /* shrink the text until the card fits on its pan */
  Scale.prototype.fit = function (side) {
    var c = this.cards[side], u = this.unit, base = FONT * u;
    c.el.style.fontSize = base + 'px';
    var w = c.el.offsetWidth, h = c.el.offsetHeight;
    if (!w || !h) { return; }
    var s = Math.min(1, (CARD_W * u) / w, (CARD_H * u) / h);
    if (s < 1) { c.el.style.fontSize = Math.max(11, base * s * 0.97) + 'px'; }
  };

  /* l, r: a fraction, 'some' (unknown but present) or null (empty pan) */
  Scale.prototype.setBalance = function (l, r) {
    var rel = '=', level = false, empty = false, target;
    if (l === null && r === null) {
      target = 0; rel = '?'; empty = true;
    } else if (r === null || l === 'some') {
      target = -8; rel = '?'; empty = true;
    } else {
      var c = cmpR(l, r);
      if (c === 0) {
        target = 0; level = true;
      } else {
        var lf = Math.abs(toFloat(l)), rf = Math.abs(toFloat(r));
        var ratio = Math.min(1, Math.abs(toFloat(l) - toFloat(r)) / Math.max(lf + rf, 1e-9));
        var mag = 3 + (MAX_TILT - 3) * ratio;
        target = c > 0 ? -mag : mag;           /* the side worth more goes down */
        rel = c > 0 ? '>' : '<';
      }
    }
    this.rel.textContent = rel;
    this.svg.classList.toggle('is-level', level);
    this.svg.classList.toggle('is-empty', empty);
    this.target = target;
    this.animate();
  };

  Scale.prototype.animate = function () {
    var self = this;
    if (reduceMotion || document.hidden) {
      this.angle = this.target; this.vel = 0; this.place();
      return;
    }
    if (this.raf) { return; }
    this.lastTs = 0;
    function tick(ts) {
      var dt = self.lastTs ? Math.min(3, (ts - self.lastTs) / 16.67) : 1;
      self.lastTs = ts;
      var acc = (self.target - self.angle) * 0.035;   /* a soft spring: a little sway, then still */
      self.vel = (self.vel + acc * dt) * Math.pow(0.86, dt);
      self.angle += self.vel * dt;
      if (Math.abs(self.target - self.angle) < 0.01 && Math.abs(self.vel) < 0.01) {
        self.angle = self.target; self.vel = 0; self.raf = 0;
        self.place();
        return;
      }
      self.place();
      self.raf = requestAnimationFrame(tick);
    }
    this.raf = requestAnimationFrame(tick);
  };

  Scale.prototype.place = function () {
    var a = this.angle * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    var lx = PX - ARM * cos, ly = PY - ARM * sin;
    var rx = PX + ARM * cos, ry = PY + ARM * sin;
    var rot = 'rotate(' + this.angle.toFixed(3) + ' ' + PX + ' ' + PY + ')';
    this.beam.setAttribute('transform', rot);
    this.needle.setAttribute('transform', rot);
    this.panL.setAttribute('transform', 'translate(' + f1(lx) + ' ' + f1(ly) + ')');
    this.panR.setAttribute('transform', 'translate(' + f1(rx) + ' ' + f1(ry) + ')');
    var u = this.unit;
    this.cards.L.el.style.transform = 'translate(' + (lx * u) + 'px,' + ((ly + HANG + 6) * u) + 'px) translate(-50%, -100%)';
    this.cards.R.el.style.transform = 'translate(' + (rx * u) + 'px,' + ((ry + HANG + 6) * u) + 'px) translate(-50%, -100%)';
  };

  /* ===================================================================
     SHARED UI: the message line and the stage banner
     =================================================================== */

  var msgEl = $('ebMessage');
  var bannerEl = $('banner');
  var msgTimer = null;
  var mode = 'std';
  var banners = { std: { html: '', kind: '' }, alg: { html: '', kind: '' } };

  function say(text, kind) {
    clearTimeout(msgTimer);
    msgEl.textContent = text || '';
    msgEl.className = 'eb-message' + (text ? (kind === 'info' ? ' is-info' : ' is-error') : '');
    if (text) { msgTimer = setTimeout(function () { say(''); }, kind === 'info' ? 12000 : 6000); }
  }

  function setBanner(forMode, html, kind) {
    banners[forMode] = { html: html, kind: kind || '' };
    if (forMode === mode) {
      bannerEl.innerHTML = html;
      bannerEl.className = 'banner' + (kind ? ' is-' + kind : '');
    }
  }

  function placeholderCard(text) { return '<span class="placeholder">' + text + '</span>'; }

  var scale = new Scale($('scaleBox'), $('scaleArea'));

  /* ===================================================================
     8. STANDARD MATH MODE
     state: 'edit' → 'stepping' (idx = steps done) → 'done' (finale)
     =================================================================== */

  /* playing: false, 'fwd' (Play all) or 'back' (Rewind all).
     lastDir: which way the last step went, for the banner. */
  var std = { state: 'edit', orig: null, value: null, steps: [], idx: 0, playTimer: null, finaleTimer: null, playing: false, lastDir: 'fwd' };
  var stdPlayBtn = $('stdPlay');
  var stdRewindBtn = $('stdRewind');

  function stdCtx() { return { frac: false, hl: {}, dec: true }; }
  function stdNum(v) { return numHtml(v, true); }
  var stdLog = $('stdLog');
  var pemdas = $('pemdas');

  var stdBuilder = new Builder($('stdBuilder'), {
    placeholder: 'Type a number to start',
    expBtn: document.querySelector('.keys[data-target="stdBuilder"] .key-exp'),
    onChange: function () {
      if (std.state !== 'edit') { stdToEdit(); }
      stdRender();
    },
    onEnter: function () { stdNext(); }
  });

  function stdStopPlay() {
    clearTimeout(std.playTimer);
    std.playTimer = null;
    std.playing = false;
    stdPlayBtn.setAttribute('aria-pressed', 'false');
    stdPlayBtn.textContent = 'Play all';
    stdRewindBtn.setAttribute('aria-pressed', 'false');
    stdRewindBtn.textContent = 'Rewind all';
  }

  function stdStopAll() {
    stdStopPlay();
    clearTimeout(std.finaleTimer);
    std.finaleTimer = null;
  }

  function stdToEdit() {
    stdStopAll();
    std.state = 'edit';
    std.steps = [];
    std.idx = 0;
  }

  /* parse and work out every step up front */
  function stdPrepare() {
    if (std.state !== 'edit') { return true; }
    var p = stdBuilder.parse();
    if (p.msg) { reject(stdBuilder, p.msg); return false; }
    try {
      std.value = evaluate(p.tree);
      std.steps = buildSteps(p.tree);
    } catch (e) {
      if (e instanceof MathError) { say(MATH_MESSAGES[e.code]); shake(stdBuilder.el); return false; }
      throw e;
    }
    say('');
    std.orig = p.tree;
    std.idx = 0;
    std.state = 'stepping';
    return true;
  }

  function stdAdvance() {
    std.lastDir = 'fwd';
    std.idx++;
    stdRender();
    if (std.idx >= std.steps.length) {
      stdStopPlay();
      std.finaleTimer = setTimeout(stdFinale, 3000);
    }
  }

  function stdFinale() {
    stdStopAll();
    std.idx = std.steps.length;
    std.state = 'done';
    stdRender();
  }

  function stdNext() {
    if (!stdPrepare()) { return; }
    stdStopPlay();
    if (std.state === 'done') { std.state = 'stepping'; std.idx = 0; }
    if (std.idx >= std.steps.length) { stdFinale(); return; }
    stdAdvance();
  }

  function stdPlay() {
    if (std.playing === 'fwd') { stdStopPlay(); stdRender(); return; }
    stdStopPlay();
    if (!stdPrepare()) { return; }
    if (std.state === 'done') { std.state = 'stepping'; std.idx = 0; }
    if (std.idx >= std.steps.length) { stdFinale(); return; }
    std.playing = 'fwd';
    stdPlayBtn.setAttribute('aria-pressed', 'true');
    stdPlayBtn.textContent = 'Pause';
    (function tick() {
      stdAdvance();
      if (std.playing === 'fwd' && std.idx < std.steps.length) { std.playTimer = setTimeout(tick, 2000); }
    })();
  }

  /* ---------- going backward: the inverse of the steps above ---------- */

  function stdCanGoBack() {
    if (std.state === 'done') { return std.steps.length > 0; }
    return std.state === 'stepping' && std.idx > 0;
  }

  /* one step back; from the finale, back to "both sides match" */
  function stdRetreat() {
    clearTimeout(std.finaleTimer);
    std.finaleTimer = null;
    std.lastDir = 'back';
    if (std.state === 'done') { std.state = 'stepping'; std.idx = std.steps.length; }
    else { std.idx--; }
    stdRender();
  }

  function stdBack() {
    stdStopPlay();
    if (!stdCanGoBack()) {
      say(std.state === 'edit' ? 'Run the steps first, then you can step back through them.'
        : 'This is the start: there is no step left to undo.', 'info');
      return;
    }
    say('');
    stdRetreat();
  }

  /* Rewind all: undo every step, 2 seconds apart, back to the start */
  function stdRewind() {
    if (std.playing === 'back') { stdStopPlay(); stdRender(); return; }
    stdStopPlay();
    var fromEdit = std.state === 'edit';
    if (fromEdit) {
      if (!stdPrepare()) { return; }
      stdFinale();                       /* start from the finished answer */
    }
    if (!stdCanGoBack()) { say('This is the start: there is no step left to undo.', 'info'); return; }
    say('');
    std.playing = 'back';
    stdRewindBtn.setAttribute('aria-pressed', 'true');
    stdRewindBtn.textContent = 'Pause';
    function tick() {
      stdRetreat();
      if (std.playing === 'back' && stdCanGoBack()) { std.playTimer = setTimeout(tick, 2000); }
      else { stdStopPlay(); }
    }
    if (fromEdit) { std.playTimer = setTimeout(tick, 2000); } else { tick(); }
  }

  function stdInstant() {
    if (!stdPrepare()) { return; }
    stdFinale();
  }

  function setPemdas(step) {
    Array.prototype.forEach.call(pemdas.children, function (li) {
      var c = li.getAttribute('data-cat');
      li.classList.toggle('is-on', !!step && (c === step.cat || (c === 'P' && step.inParens)));
    });
  }

  function stdLogHtml(upto, current) {
    var h = '';
    for (var i = 0; i < upto; i++) {
      var s = std.steps[i];
      h += '<li' + (i === current ? ' class="is-current"' : '') + '><div><span class="log-verb">' + s.verb +
        (s.inParens ? ' · inside ( )' : '') + '</span><span class="log-math">' +
        render(s.node, stdCtx()) + '<span class="m-op">=</span>' + stdNum(s.value) + '</span></div></li>';
    }
    stdLog.innerHTML = h;
    $('stdLogEmpty').hidden = upto > 0;
  }

  function stdRender() {
    if (mode !== 'std') { return; }
    var n = std.steps.length, ctx = stdCtx();

    if (std.state === 'edit') {
      var empty = !stdBuilder.tokens.length;
      scale.setSide('L', empty ? '?' : tokensHtml(stdBuilder.tokens, stdBuilder.expOpen, false), '', empty);
      scale.setSide('R', '?', '', true);
      scale.setBalance(empty ? null : 'some', null);
      setBanner('std', empty
        ? 'Type an expression. <span class="b-small">Numbers from the keyboard, everything else from the buttons.</span>'
        : 'Ready? <span class="b-small">Press Next step, Play all or Instant.</span>');
      setPemdas(null);
      stdLogHtml(0, -1);
      return;
    }

    if (std.state === 'done') {
      scale.setSide('L', render(std.orig, ctx), '', false, true);
      scale.setSide('R', stdNum(std.value), '', false, true);
      scale.setBalance(std.value, std.value);
      setBanner('std', render(std.orig, ctx) + '<span class="m-op">=</span>' + stdNum(std.value) +
        (n ? ' <span class="b-small">The expression and its value balance.</span>' : ' <span class="b-small">Nothing to simplify: it is already one number.</span>'), 'success');
      setPemdas(null);
      stdLogHtml(n, -1);
      return;
    }

    var i = std.idx;
    var tree = i === 0 ? std.orig : std.steps[i - 1].after;
    if (i > 0) { ctx.hl[std.steps[i - 1].newId] = 'm-new'; }
    if (i < n) { ctx.hl[std.steps[i].node.id] = 'm-next'; }
    scale.setSide('L', render(tree, ctx), '', false);

    var back = std.lastDir === 'back';
    if (i === 0) {
      scale.setSide('R', '?', '', true, back);
      scale.setBalance('some', null);
      var s0 = std.steps[0];
      if (back) {
        setBanner('std', '<span class="b-tag">Back to the start</span> ' + stdNum(s0.value) + ' goes back to ' +
          render(s0.node, stdCtx()) + ' <span class="b-small">The expression is whole again.</span>', 'step');
      } else {
        setBanner('std', '<span class="b-tag">Up next</span> ' + s0.verb + ': ' + render(s0.node, stdCtx()) +
          ' <span class="b-small">Press Next step.</span>', 'step');
      }
    } else {
      var s = std.steps[i - 1];
      scale.setSide('R', stdNum(s.value), render(s.node, stdCtx()), false, true);
      scale.setBalance(std.value, s.value);
      if (back && i < n) {
        var u = std.steps[i];
        setBanner('std', '<span class="b-tag">Undo step ' + (i + 1) + '</span> ' + stdNum(u.value) + ' goes back to ' +
          render(u.node, stdCtx()), 'step');
      } else if (i < n) {
        setBanner('std', '<span class="b-tag">Step ' + i + ' of ' + n + '</span> ' + s.verb + ': ' +
          render(s.node, stdCtx()) + '<span class="m-op">=</span>' + stdNum(s.value), 'step');
      } else {
        setBanner('std', 'Both sides match: ' + stdNum(s.value) + '<span class="m-op">=</span>' + stdNum(s.value) +
          (back ? ' <span class="b-small">Step back to unfold it again.</span>'
                : ' <span class="b-small">The whole expression comes back in 3 seconds…</span>'), 'success');
      }
    }
    setPemdas(i < n ? std.steps[i] : null);
    stdLogHtml(i, i - 1);
  }

  $('stdStep').addEventListener('click', stdNext);
  stdPlayBtn.addEventListener('click', stdPlay);
  $('stdBack').addEventListener('click', stdBack);
  stdRewindBtn.addEventListener('click', stdRewind);
  $('stdInstant').addEventListener('click', stdInstant);
  $('stdReset').addEventListener('click', function () { stdToEdit(); say(''); stdRender(); });

  /* ===================================================================
     9. SOLVE FOR X MODE
     =================================================================== */

  var alg = {
    source: 'random', frac: true, ready: false, everShown: false,
    x: null, origLeft: null, origRight: null, left: null, right: null,
    history: [], log: [], solved: false, revealed: false,
    display: null, pendingMove: null, phaseTimer: null, checking: null, subView: null
  };

  var algLog = $('algLog');
  var xChip = $('xChip');
  var chainEl = $('chain');

  function radioVal(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }
  function setRadio(name, value) {
    var el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) { el.checked = true; }
  }

  var xField = new KeyField($('xField'), {
    masked: true, maxLen: 3, placeholder: 'e.g. 5',
    onEnter: function () { algBuilder.el.focus(); },
    onChange: function () { algDirty(); }
  });

  var amtField = new KeyField($('amtField'), {
    maxLen: 4, placeholder: 'number',
    onEnter: function () { algApply(); }
  });

  var algBuilder = new Builder($('algBuilder'), {
    allowX: true,
    placeholder: 'Build the left side',
    expBtn: document.querySelector('.keys[data-target="algBuilder"] .key-exp'),
    onChange: function () { algDirty(); },
    onEnter: function () { algPlace(); }
  });

  function balanced() {
    return cmpR(evaluate(alg.left, alg.x), evaluate(alg.right, alg.x)) === 0;
  }

  function relOf(l, r) {
    var c = cmpR(evaluate(l, alg.x), evaluate(r, alg.x));
    return c === 0 ? '=' : '≠';
  }

  function isSolved() {
    return unwrap(alg.left).t === 'var' && isNum(alg.right) && balanced();
  }

  function eqEntry() {
    return { type: 'eq', left: alg.left, right: alg.right, rel: relOf(alg.left, alg.right), solved: isSolved() };
  }

  /* end the "operation written on" moment: tidy both sides, then narrate */
  function finishPhase() {
    if (!alg.phaseTimer) { return; }
    clearTimeout(alg.phaseTimer);
    alg.phaseTimer = null;
    alg.display = null;
    var move = alg.pendingMove;
    alg.pendingMove = null;
    algRender(true);
    algAfterMove(move);
  }

  function stopCheck() {
    if (!alg.checking) { return; }
    clearTimeout(alg.checking.timer);
    alg.checking = null;
    $('algCheck').disabled = false;
  }

  function algStopAll() { finishPhase(); stopCheck(); alg.subView = null; }

  function algSetEquation(left, rightVal, x) {
    algStopAll();
    alg.x = x;
    alg.origLeft = left;
    alg.origRight = rightVal;
    alg.left = left;
    alg.right = mkNum(rightVal);
    alg.history = [];
    alg.solved = false;
    alg.revealed = false;
    alg.ready = true;
    alg.log = [eqEntry()];
    $('algReveal').setAttribute('aria-pressed', 'false');
    amtField.set('');
    algRender(true);
    algAfterMove(null);
    refreshTargets();
  }

  /* typing a new equation takes the old one off the scale */
  function algDirty() {
    if (alg.source !== 'build') { return; }
    if (alg.ready) {
      algStopAll();
      alg.ready = false;
      alg.log = [];
      alg.history = [];
      alg.solved = false;
    }
    algRender();
    refreshTargets();
  }

  function algNew() {
    say('');
    var g = generate(parseInt(radioVal('algSteps'), 10), $('algNeg').checked);
    algSetEquation(g.left, g.right, g.x);
  }

  function algPlace() {
    var p = algBuilder.parse();
    if (p.msg) { reject(algBuilder, p.msg); return; }
    if (!hasVar(p.tree)) { reject(algBuilder, 'Put an x in it: use the x button.'); return; }
    var xv = xField.number();
    if (xv === null) { reject(xField, 'Type a value for x first. It stays hidden.'); xField.el.focus(); return; }
    var X = rat(xv), val;
    try {
      val = evaluate(p.tree, X);
    } catch (e) {
      if (e instanceof MathError) { say(MATH_MESSAGES[e.code] + ' Try another value for x.'); shake(algBuilder.el); return; }
      throw e;
    }
    say('');
    xField.masked = true;
    xField.render();
    $('xFieldEye').setAttribute('aria-pressed', 'false');
    $('xFieldEye').textContent = 'Show';
    algSetEquation(p.tree, val, X);
    refreshTargets();
  }

  function moveText(op, k, side) {
    var n = '<b>' + fmt(k) + '</b>';
    if (side === 'both') {
      if (op === '+') { return 'Add ' + n + ' to both sides'; }
      if (op === MINUS) { return 'Subtract ' + n + ' from both sides'; }
      if (op === TIMES) { return 'Multiply both sides by ' + n; }
      return 'Divide both sides by ' + n;
    }
    var s = side === 'left' ? 'the left side only' : 'the right side only';
    if (op === '+') { return 'Add ' + n + ' to ' + s; }
    if (op === MINUS) { return 'Subtract ' + n + ' from ' + s; }
    if (op === TIMES) { return 'Multiply ' + s + ' by ' + n; }
    return 'Divide ' + s + ' by ' + n;
  }

  function algApply() {
    if (!alg.ready) { say('Set up an equation first: press New equation or Put it on the scale.'); return; }
    algStopAll();
    var op = radioVal('algOp'), side = radioVal('algSide'), kv = amtField.number();
    if (kv === null) { reject(amtField, 'Type the number to use first.'); amtField.el.focus(); return; }
    var k = rat(kv);
    if (op === DIVIDE && kv === 0) { reject(amtField, MATH_MESSAGES.zero); return; }
    if (op === TIMES && kv === 0) { reject(amtField, 'Multiplying by 0 turns both sides into 0, and x disappears. Try another number.'); return; }

    var L = alg.left, R = alg.right, nl = L, nr = R, sl = null, sr = null;
    try {
      if (side !== 'right') { nl = simplifyOp(L, op, k); sl = showOp(L, op, k); }
      if (side !== 'left') { nr = simplifyOp(R, op, k); sr = showOp(R, op, k); }
      evaluate(nl, alg.x);
      evaluate(nr, alg.x);
    } catch (e) {
      if (e instanceof MathError) { reject(amtField, MATH_MESSAGES[e.code]); return; }
      throw e;
    }
    say('');
    var wasBalanced = balanced();
    alg.solved = false;
    alg.history.push({ left: L, right: R, logLen: alg.log.length });
    alg.left = nl;
    alg.right = nr;
    alg.log.push({ type: 'move', html: '<b>' + op + ' ' + fmt(k) + '</b> · ' + moveText(op, k, side), warn: side !== 'both' });
    alg.log.push(eqEntry());

    var move = { op: op, k: k, side: side, wasBalanced: wasBalanced };
    if ($('algShowWork').checked && !reduceMotion) {
      alg.display = { left: sl, right: sr };
      alg.pendingMove = move;
      algRender();
      setBanner('alg', '<span class="b-tag">Now</span> ' + moveText(op, k, side), 'step');
      alg.phaseTimer = setTimeout(finishPhase, 1300);
    } else {
      algRender(true);
      algAfterMove(move);
    }
  }

  /* narrate the move on the banner */
  function algAfterMove(move) {
    var ctx = plainCtx(alg.frac);
    var eq = render(alg.left, ctx) + '<span class="m-op">' + relOf(alg.left, alg.right) + '</span>' + render(alg.right, ctx);
    alg.solved = isSolved();
    if (alg.solved) {
      setBanner('alg', '<i class="m-var">x</i><span class="m-op">=</span>' + render(alg.right, ctx) +
        ' <span class="b-small">x is alone and the scale is level. Press Check the answer to test it.</span>', 'success');
    } else if (!move) {
      setBanner('alg', 'Find x. <span class="b-small">Undo what was done to x, and keep the scale level.</span>');
    } else if (!balanced()) {
      if (move.side === 'left' || move.side === 'right') {
        var other = move.side === 'left' ? 'right' : 'left';
        setBanner('alg', 'The scale tipped! <span class="b-small">Only the ' + move.side + ' side changed. Do the same to the ' +
          other + ' side to level it, or take the move back.</span>', 'warn');
      } else {
        setBanner('alg', 'The scale is not level. <span class="b-small">One side has had something done to it that the other has not.</span>', 'warn');
      }
    } else if (!move.wasBalanced) {
      setBanner('alg', 'Level again: ' + eq + ' <span class="b-small">Both sides have now had the same thing done to them.</span>', 'success');
    } else {
      setBanner('alg', eq + ' <span class="b-small">Still balanced: the same thing was done to both sides.</span>');
    }
    algRender();
  }

  function algHint() {
    if (!alg.ready) { say('Set up an equation first.'); return; }
    algStopAll();
    if (!balanced()) {
      say('First level the scale: do the same operation to the other side, or press Take back last move.', 'info');
      return;
    }
    var e = unwrap(alg.left);
    if (e.t === 'var') { say('x is already alone. You’re done!', 'info'); return; }
    var s = topStep(alg.left), op, k, why;
    if (s) {
      op = INVERSE[s.op];
      k = s.k;
      why = 'The last thing done to x is “' + s.op + ' ' + fmt(k) + '.” Undo it with the opposite: ' +
        op + ' ' + fmt(k) + ' on both sides.';
    } else if (e.t === 'bin' && e.op === MINUS && isNum(e.l)) {
      op = MINUS;
      k = valOf(e.l);
      why = 'Here x is being taken away from ' + fmt(k) + '. Subtract ' + fmt(k) +
        ' from both sides first, then divide by −1.';
    } else if (countVar(alg.left) > 1) {
      say('x shows up more than once. Those like terms would need to be combined first, which these moves can’t do.', 'info');
      return;
    } else {
      say('This one needs more than + − × ÷ to undo (an exponent needs a root).', 'info');
      return;
    }
    if (isInt(k)) {
      setRadio('algOp', op);
      setRadio('algSide', 'both');
      amtField.set(String(k.n));
      why += ' It’s set up below. Press Submit.';
    }
    say(why, 'info');
  }

  function algUndo() {
    algStopAll();
    var h = alg.history.pop();
    if (!h) { say('There is no move to take back.', 'info'); return; }
    say('');
    alg.left = h.left;
    alg.right = h.right;
    alg.log.length = h.logLen;
    algRender(true);
    algAfterMove(alg.history.length ? { side: 'undo', wasBalanced: true } : null);
  }

  function algRestart() {
    if (!alg.ready) { return; }
    say('');
    algSetEquation(alg.origLeft, alg.origRight, alg.x);
  }

  /* toggle: the original equation with x replaced by its value, or back */
  function algPlug() {
    if (!alg.solved) { return; }
    if (alg.subView) {
      algStopAll();
      algRender(true);
      algAfterMove({ side: 'both', wasBalanced: true });
      return;
    }
    algStopAll();
    say('');
    var ids = [];
    alg.subView = { tree: substitute(alg.origLeft, alg.x, ids), ids: ids };
    algRender(true);
    setBanner('alg', 'The original equation, with ' + (ids.length > 1 ? 'each' : 'the') + ' <i class="m-var">x</i> replaced by ' +
      numHtml(alg.x) + ' <span class="b-small">The scale is still level: ' + numHtml(alg.x) + ' is the value that makes it true.</span>', 'success');
  }

  /* put x back in and simplify the original left side, step by step */
  function algCheck() {
    if (!alg.solved) { return; }
    algStopAll();
    say('');
    var ids = [];
    var tree = substitute(alg.origLeft, alg.x, ids);
    var steps;
    try { steps = buildSteps(tree); } catch (e) { if (e instanceof MathError) { say(MATH_MESSAGES[e.code]); return; } throw e; }
    alg.checking = { tree: tree, steps: steps, idx: 0, subIds: ids, timer: null, done: false };
    $('algCheck').disabled = true;
    checkRender();
    (function tick() {
      var c = alg.checking;
      if (!c) { return; }
      if (c.idx < c.steps.length) {
        c.timer = setTimeout(function () { c.idx++; checkRender(); tick(); }, c.idx === 0 ? 2200 : 1800);
      } else {
        c.timer = setTimeout(function () { c.done = true; checkRender(); $('algCheck').disabled = false; }, 3000);
      }
    })();
  }

  function checkRender() {
    if (mode !== 'alg') { return; }
    var c = alg.checking, ctx = plainCtx(alg.frac), n = c.steps.length, i = c.idx;
    var xs = '<i class="m-var">x</i><span class="m-op">=</span>' + numHtml(alg.x);
    if (c.done) {
      scale.setSide('L', render(alg.origLeft, ctx), '', false, true);
      scale.setSide('R', numHtml(alg.origRight), '', false, true);
      setBanner('alg', render(alg.origLeft, ctx) + '<span class="m-op">=</span>' + numHtml(alg.origRight) +
        ' <span class="b-small">is true when</span> ' + xs, 'success');
    } else {
      var tree = i === 0 ? c.tree : c.steps[i - 1].after;
      if (i === 0) { c.subIds.forEach(function (id) { ctx.hl[id] = 'm-sub'; }); }
      else { ctx.hl[c.steps[i - 1].newId] = 'm-new'; }
      if (i < n) { ctx.hl[c.steps[i].node.id] = 'm-next'; }
      scale.setSide('L', render(tree, ctx), '', false, i > 0);
      scale.setSide('R', numHtml(alg.origRight), '', false);
      if (i === 0) {
        setBanner('alg', '<span class="b-tag">Check</span> Put ' + xs + ' back into the original equation.', 'step');
      } else if (i < n) {
        var s = c.steps[i - 1];
        setBanner('alg', '<span class="b-tag">Check ' + i + ' of ' + n + '</span> ' + s.verb + ': ' +
          render(s.node, plainCtx(alg.frac)) + '<span class="m-op">=</span>' + numHtml(s.value), 'step');
      } else {
        setBanner('alg', '✓ ' + numHtml(alg.origRight) + '<span class="m-op">=</span>' + numHtml(alg.origRight) +
          ' <span class="b-small">It balances, so</span> ' + xs + ' <span class="b-small">is right.</span>', 'success');
      }
    }
    scale.setBalance(alg.origRight, alg.origRight);
  }

  /* the forward chain (how x was built) above the backward one (how it was undone) */
  function chainHtml() {
    var ch = peel(alg.origLeft);
    if (!ch || !ch.length) { return ''; }
    var vals = [alg.x];
    try {
      ch.forEach(function (s) { vals.push(opApply(s.op, vals[vals.length - 1], s.k)); });
    } catch (e) { return ''; }
    var cols = 1 + 2 * ch.length;
    var row1 = '<span class="chain-label">Built</span>', row2 = '<span class="chain-label">Undone</span>';
    vals.forEach(function (v, i) {
      var cell = i === 0
        ? '<span class="chain-val is-x"><i>x</i> = ' + numHtml(v) + '</span>'
        : '<span class="chain-val">' + numHtml(v) + '</span>';
      row1 += cell;
      row2 += cell;
      if (i < ch.length) {
        row1 += '<span class="chain-arrow">' + ch[i].op + ' ' + fmt(ch[i].k) + '</span>';
        row2 += '<span class="chain-arrow is-back">' + INVERSE[ch[i].op] + ' ' + fmt(ch[i].k) + '</span>';
      }
    });
    return '<div class="chain-grid" style="grid-template-columns: auto repeat(' + cols + ', auto)">' + row1 + row2 + '</div>' +
      '<p class="chain-note">Same numbers, opposite operations, opposite order: the last thing done to x is the first thing undone.</p>';
  }

  function algLogHtml() {
    var ctx = plainCtx(alg.frac), h = '';
    alg.log.forEach(function (e) {
      if (e.type === 'eq') {
        h += '<li class="w-eq' + (e.rel !== '=' ? ' is-off' : '') + (e.solved ? ' is-solved' : '') + '">' +
          render(e.left, ctx) + '<span class="m-op">' + e.rel + '</span>' + render(e.right, ctx) + '</li>';
      } else {
        h += '<li class="w-move' + (e.warn ? ' is-warn' : '') + '">' + e.html + '</li>';
      }
    });
    algLog.innerHTML = h;
    $('algLogEmpty').hidden = alg.log.length > 0;
  }

  function algRender(flash) {
    if (mode !== 'alg') { return; }
    if (alg.checking) { checkRender(); }

    if (!alg.ready) {
      var building = alg.source === 'build' && algBuilder.tokens.length;
      scale.setSide('L', building ? tokensHtml(algBuilder.tokens, algBuilder.expOpen, false) : '?', '', !building);
      scale.setSide('R', '?', '', true);
      scale.setBalance(building ? 'some' : null, null);
      setBanner('alg', alg.source === 'build'
        ? 'Choose a value for x, build the left side, then press <span class="b-small">Put it on the scale.</span>'
        : 'Press New equation. <span class="b-small">Choose 1, 2 or 3 steps first.</span>');
      xChip.hidden = mode !== 'alg';
      $('xChipVal').textContent = '?';
      xChip.classList.remove('is-known');
      chainEl.hidden = true;
      $('algSolvedCard').hidden = true;
      algLogHtml();
      return;
    }

    if (alg.subView && !alg.checking) {
      /* the original equation, with each x replaced by (its value) */
      var sctx = plainCtx(alg.frac);
      alg.subView.ids.forEach(function (id) { sctx.hl[id] = 'm-sub'; });
      scale.setSide('L', render(alg.subView.tree, sctx), '', false, flash);
      scale.setSide('R', numHtml(alg.origRight), '', false, flash);
      scale.setBalance(alg.origRight, alg.origRight);
    } else if (!alg.checking) {
      var ctx = plainCtx(alg.frac);
      var L = alg.left, R = alg.right;
      if (alg.display) {
        if (alg.display.left) { L = alg.display.left; ctx.hl[L.r.id] = 'm-pending'; }
        if (alg.display.right) { R = alg.display.right; ctx.hl[R.r.id] = 'm-pending'; }
      }
      scale.setSide('L', render(L, ctx), '', false, flash);
      scale.setSide('R', render(R, ctx), '', false, flash);
      scale.setBalance(evaluate(alg.left, alg.x), evaluate(alg.right, alg.x));
    }

    var known = alg.solved || alg.revealed;
    xChip.hidden = mode !== 'alg';
    $('xChipVal').innerHTML = known ? numHtml(alg.x) : '?';
    xChip.classList.toggle('is-known', alg.solved);
    var ch = alg.solved ? chainHtml() : '';
    chainEl.innerHTML = ch;
    chainEl.hidden = mode !== 'alg' || !ch;
    $('algSolvedCard').hidden = !alg.solved;
    if (alg.solved) {
      var plug = $('algPlug');
      plug.setAttribute('aria-pressed', alg.subView ? 'true' : 'false');
      plug.innerHTML = alg.subView ? 'Back to <i>x</i> = ' + fmt(alg.x)
        : 'Show the original with <i>x</i> = ' + fmt(alg.x);
    }
    algLogHtml();
    if (mode === 'alg') { requestAnimationFrame(function () { scale.resize(); }); }
  }

  $('algNew').addEventListener('click', algNew);
  $('algPlace').addEventListener('click', algPlace);
  $('algApply').addEventListener('click', algApply);
  $('algHint').addEventListener('click', algHint);
  $('algUndo').addEventListener('click', algUndo);
  $('algRestart').addEventListener('click', algRestart);
  $('algCheck').addEventListener('click', algCheck);
  $('algPlug').addEventListener('click', algPlug);

  $('algReveal').addEventListener('click', function () {
    alg.revealed = !alg.revealed;
    this.setAttribute('aria-pressed', alg.revealed ? 'true' : 'false');
    algRender();
  });

  $('xFieldEye').addEventListener('click', function () {
    xField.masked = !xField.masked;
    xField.render();
    this.setAttribute('aria-pressed', xField.masked ? 'false' : 'true');
    this.textContent = xField.masked ? 'Show' : 'Hide';
  });

  document.querySelectorAll('input[name="algSource"]').forEach(function (r) {
    r.addEventListener('change', function () {
      alg.source = radioVal('algSource');
      $('algRandom').hidden = alg.source !== 'random';
      $('algBuild').hidden = alg.source !== 'build';
      if (!alg.ready) { algRender(); }
      refreshTargets();
    });
  });

  document.querySelectorAll('input[name="algDiv"]').forEach(function (r) {
    r.addEventListener('change', function () {
      alg.frac = radioVal('algDiv') === 'frac';
      algRender();
    });
  });

  /* ===================================================================
     10. KEYBOARD, NUMBER PAD, TABS, START-UP
     =================================================================== */

  var allFields = [stdBuilder, algBuilder, xField, amtField];

  function isShown(el) { return !!(el.offsetParent || el.getClientRects().length); }

  /* where typed digits go: the focused field, or the obvious one */
  function currentTarget() {
    var a = document.activeElement;
    if (a && a.__ebField && isShown(a)) { return a.__ebField; }
    if (mode === 'std') { return stdBuilder; }
    if (alg.source === 'build' && !alg.ready) { return xField.value === '' ? xField : algBuilder; }
    return amtField;
  }

  function refreshTargets() {
    var t = currentTarget();
    allFields.forEach(function (f) { f.el.classList.toggle('is-target', f === t); });
  }

  document.addEventListener('focusin', refreshTargets);
  document.addEventListener('focusout', function () { setTimeout(refreshTargets, 0); });

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) { return; }
    var a = document.activeElement;
    if (a && (a.isContentEditable || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' ||
        (a.tagName === 'INPUT' && /^(text|number|email|search|tel|url|password)$/.test(a.type)))) { return; }
    var inField = !!(a && a.__ebField);
    var t = currentTarget();

    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); t.key(e.key); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); t.key('back'); return; }
    if (e.key === '-' && t.allowMinus) { e.preventDefault(); t.key('-'); return; }
    if (e.key === 'Enter' && (inField || a === document.body)) { e.preventDefault(); t.enter(); return; }
    if (inField && e.key.length === 1 && e.key !== ' ') {
      e.preventDefault();
      reject(t, t instanceof Builder
        ? 'Only numbers come from the keyboard. Use the buttons for + − × ÷, ( ) and exponents.'
        : 'Only numbers can be typed here.');
    }
  });

  /* on-screen keys keep the keyboard focus where it was */
  document.querySelectorAll('.keys .key, .numpad .key').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); });
  });

  document.querySelectorAll('.keys').forEach(function (group) {
    var builder = $(group.getAttribute('data-target')).__ebField;
    group.addEventListener('click', function (e) {
      var b = e.target.closest('[data-key]');
      if (!b) { return; }
      builder.key(b.getAttribute('data-key'));
      if (document.activeElement !== builder.el) { builder.el.focus({ preventScroll: true }); }
    });
  });

  $('numpad').addEventListener('click', function (e) {
    var b = e.target.closest('[data-num]');
    if (!b) { return; }
    var k = b.getAttribute('data-num'), t = currentTarget();
    if (k === '-' && !t.allowMinus) {
      reject(t, 'In an expression, press the − button before a number to make it negative.');
      return;
    }
    t.key(k);
  });

  /* ---------- tabs ---------- */

  var tabs = document.querySelectorAll('.eb-tab');

  function setMode(m) {
    if (m === mode) { return; }
    if (mode === 'std') {
      /* a finale that was about to play just happens off-screen */
      if (std.finaleTimer) { stdStopAll(); std.state = 'done'; std.idx = std.steps.length; }
      stdStopPlay();
    } else {
      var hadSub = !!alg.subView;
      algStopAll();
      if (hadSub) { algAfterMove({ side: 'both', wasBalanced: true }); }   /* restore the solved banner */
    }
    mode = m;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-mode') === m;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    $('panel-std').hidden = m !== 'std';
    $('panel-alg').hidden = m !== 'alg';
    say('');
    if (m === 'std') {
      xChip.hidden = true;
      chainEl.hidden = true;
      stdRender();
    } else {
      if (!alg.everShown) {
        alg.everShown = true;
        algNew();
      } else {
        algRender();
        setBanner('alg', banners.alg.html, banners.alg.kind);
      }
    }
    requestAnimationFrame(function () { scale.resize(); });
    refreshTargets();
  }

  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { setMode(t.getAttribute('data-mode')); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') { return; }
      e.preventDefault();
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      setMode(next.getAttribute('data-mode'));
    });
  });

  /* ---------- start ---------- */
  stdRender();
  scale.angle = scale.target;
  scale.place();
  refreshTargets();
})();
