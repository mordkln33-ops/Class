/* =====================================================================
   Equation Balance — tool script
   ---------------------------------------------------------------------
   1. Exact fractions ....... every value is a fraction, so 7 ÷ 2 and
                              1 ÷ 3 stay exact
   2. Expression trees ...... numbers, x, + − × ÷, exponents, ( )
   3. Typesetting ........... trees → HTML (fractions, exponents,
                              highlights)
   4. Input fields .......... the expression builder (with a caret that
                              can go anywhere) and the number fields:
                              digits from the keyboard only
   5. Step engine ........... one order-of-operations step at a time,
                              or straight left to right
   6. Equation moves ........ write + − × ÷ onto a side, like terms,
                              Simplify's tidy-up rules (3x + 4 − 4 → 3x),
                              random equations
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

  /* a sum as a list of terms, each with the sign in front of it:
     3x + 4 − 2x → [+ 3x, + 4, − 2x]. stop: ids of inner sums to keep whole */
  function sumTerms(n, stop) {
    var list = (isAddSub(n.l) && !(stop && stop[n.l.id])) ? sumTerms(n.l, stop)
      : [{ op: '+', node: n.l, opHl: false }];
    list.push({ op: n.op, node: n.r, opHl: !!n.opHl });
    return list;
  }

  function termsOf(n) { return isAddSub(n) ? sumTerms(n) : [{ op: '+', node: n, opHl: false }]; }

  function findById(n, id) {
    if (n.id === id) { return n; }
    switch (n.t) {
      case 'paren': return findById(n.inner, id);
      case 'pow': return findById(n.base, id);
      case 'bin': return findById(n.l, id) || findById(n.r, id);
      default: return null;
    }
  }

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
     ctx = { frac: show ÷ as a stacked fraction, hl: { nodeId: class },
             terms: { termNodeId: class } (a term together with its sign),
             marks: { binId: { side, cls } } (an operation with its number),
             pending: show operations waiting for Simplify }
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

  /* a negative number or −3x after an operation gets ( ): 5 − (−2) */
  function isNegTerm(n) {
    return (n.t === 'num' && n.v.n < 0) ||
      (n.t === 'bin' && n.implicit && n.l.t === 'num' && n.l.v.n < 0);
  }

  function wrapCls(cls, html) { return '<span class="' + cls + '">' + html + '</span>'; }

  /* the highlight on an operation and its number (× 1, ÷ 3 …) */
  function markOf(n, ctx) {
    if (ctx.marks && ctx.marks[n.id]) { return ctx.marks[n.id]; }
    return n.opHl && ctx.pending ? { side: 'r', cls: 'm-pending' } : null;
  }

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
    } else if (isAddSub(n)) {
      /* a sum is written term by term, each term wrapped with the sign in
         front of it, so a term can be marked or picked along with its sign */
      var terms = ctx.terms || {};
      h = '';
      sumTerms(n, ctx.hl).forEach(function (e, i) {
        var th = render(e.node, ctx);
        if (i > 0) {
          th = '<span class="m-op">' + e.op + '</span>' + (isNegTerm(e.node) ? paren(th) : th);
        }
        var tc = terms[e.node.id] || (e.opHl && ctx.pending ? 'm-pending' : '');
        h += '<span class="m-term' + (tc ? ' ' + tc : '') + '" data-term="' + e.node.id + '" data-chain="' + n.id + '">' + th + '</span>';
      });
    } else if (n.op === DIVIDE && ctx.frac) {
      var bot = render(n.r, ctx, true), fm = markOf(n, ctx);
      if (fm) { bot = wrapCls(fm.cls, bot); }
      h = '<span class="m-frac"><span class="m-top">' + render(n.l, ctx, true) +
        '</span><span class="m-bot">' + bot + '</span></span>';
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
      var lh2 = render(n.l, ctx), rh2 = render(n.r, ctx), oh = '<span class="m-op">' + n.op + '</span>';
      if (isNegTerm(n.r)) { rh2 = paren(rh2); }
      var mk = markOf(n, ctx);
      if (mk && mk.side === 'l') { h = wrapCls(mk.cls, lh2 + oh) + rh2; }
      else if (mk) { h = lh2 + wrapCls(mk.cls, oh + rh2); }
      else { h = lh2 + oh + rh2; }
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

  /* ---------- 4a. The expression builder ----------
     The expression is a list of single items, and the caret can sit
     anywhere in it, so it can be changed in the middle, not just at the
     end. Items: a digit (d), a negative sign (neg), + − × ÷ (op), ( ),
     x, =, and an exponent digit (sup). They are grouped into tokens
     (whole numbers, exponents) only to be parsed. */

  var VALUE_END = { d: true, x: true, ')': true, sup: true };

  /* why item b can't come right after item a (null: it can) */
  function pairMsg(a, b) {
    if (!b) { return null; }
    var A = a ? a.t : '', B = b.t;
    if (B === 'sup') { return VALUE_END[A] ? null : 'Type a number (or close a parenthesis) first, then add its exponent.'; }
    if (A === '' || A === '(' || A === 'op' || A === '=') {
      if (B === 'op' || B === '=') {
        return A === '' ? 'Start with a number.' : A === 'op' ? 'Two operations can’t sit side by side.' : 'Type a number first.';
      }
      if (B === ')') { return 'Put something inside the parentheses first.'; }
      return null;
    }
    if (A === 'neg') { return B === 'd' || B === 'x' ? null : 'Type the number after the negative sign.'; }
    /* a is the end of a value: a digit, x, ) or an exponent */
    if (B === 'neg') { return 'Choose an operation before the next number.'; }
    if (B === 'd') { return A === 'd' ? null : 'Choose an operation before the next number.'; }
    if (B === 'x') { return A === 'd' ? null : 'Choose an operation before x.'; }
    return null;
  }

  function endsValue(t) {
    return (t.t === 'num' && t.s !== '-') || t.t === 'x' || t.t === ')' || t.t === 'pow';
  }

  /* items → tokens: { num s }, { op v }, { x }, { ( }, { ) }, { pow s }, { = } */
  function toTokens(items) {
    var T = [];
    items.forEach(function (it, i) {
      var last = T[T.length - 1], before = items[i - 1];
      if (it.t === 'd') {
        if (before && (before.t === 'd' || before.t === 'neg')) { last.s += it.c; }
        else { T.push({ t: 'num', s: it.c }); }
      } else if (it.t === 'neg') {
        T.push({ t: 'num', s: '-' });
      } else if (it.t === 'sup') {
        if (before && before.t === 'sup') { last.s += it.c; }
        else { T.push({ t: 'pow', s: it.c }); }
      } else if (it.t === 'op') {
        T.push({ t: 'op', v: it.v });
      } else if (it.t === 'x') {
        T.push({ t: 'x', implicit: !!last && last.t === 'num' });          /* 3x, −x */
      } else if (it.t === '(') {
        T.push({ t: '(', implicit: !!last && endsValue(last) });           /* 3( means 3 × ( */
      } else {
        T.push({ t: it.t });
      }
    });
    return T;
  }

  function itemHtml(it, i) {
    var a = ' data-i="' + i + '"';
    if (it.t === 'd' || it.t === 'sup') { return '<span' + a + '>' + it.c + '</span>'; }
    if (it.t === 'neg') { return '<span' + a + '>' + MINUS + '</span>'; }
    if (it.t === 'op') { return '<span class="m-op"' + a + '>' + it.v + '</span>'; }
    if (it.t === '=') { return '<span class="m-op"' + a + '>=</span>'; }
    if (it.t === 'x') { return '<i class="m-var"' + a + '>x</i>'; }
    return '<span class="m-paren"' + a + '>' + it.t + '</span>';
  }

  /* the items as typeset math; caret: index to show the caret at, or -1 */
  function itemsHtml(items, caret, expOpen) {
    var h = '', group = '';
    function shut() {
      if (group) { h += group === 'num' ? '</span>' : '</sup>'; group = ''; }
    }
    function open(g) {
      if (group === g) { return; }
      shut();
      if (g) { h += g === 'num' ? '<span class="m-num">' : '<sup class="m-sup">'; group = g; }
    }
    for (var i = 0; i <= items.length; i++) {
      var it = items[i];
      var g = !it ? '' : (it.t === 'd' || it.t === 'neg') ? 'num' : it.t === 'sup' ? 'sup' : '';
      if (i === caret) {
        if (expOpen && (group === 'sup' || g === 'sup')) { open('sup'); h += CARET; }
        else if (expOpen) { shut(); h += '<sup class="m-sup is-open">&#8203;' + CARET + '</sup>'; }
        else { if (group === 'sup' || (group === 'num' && g !== 'num')) { shut(); } h += CARET; }
      }
      if (!it) { break; }
      open(g);
      h += itemHtml(it, i);
    }
    shut();
    return h;
  }

  function Builder(el, opts) {
    var self = this;
    this.el = el;
    this.allowX = !!opts.allowX;
    this.allowEq = !!opts.allowEq;
    this.allowMinus = false;          /* the keyboard "-" is not accepted here */
    this.onChange = opts.onChange;
    this.onEnter = opts.onEnter;
    this.expBtn = opts.expBtn;
    this.placeholder = opts.placeholder;
    this.items = [];
    this.pos = 0;                     /* the caret sits just before items[pos] */
    this.expOpen = false;             /* digits typed now go into the exponent */
    el.__ebField = this;
    el.addEventListener('click', function (e) { self.clickAt(e); });
    this.render();
  }

  Builder.prototype.prev = function () { return this.items[this.pos - 1] || null; };
  Builder.prototype.next = function () { return this.items[this.pos] || null; };

  /* open parentheses before the caret (counted from the = sign) */
  Builder.prototype.depthAt = function (p) {
    var d = 0;
    for (var i = 0; i < p; i++) {
      var t = this.items[i].t;
      if (t === '(') { d++; } else if (t === ')') { d--; } else if (t === '=') { d = 0; }
    }
    return d;
  };

  /* leave the exponent: the caret drops down after it */
  Builder.prototype.leaveExp = function () {
    if (!this.expOpen) { return; }
    this.expOpen = false;
    while (this.next() && this.next().t === 'sup') { this.pos++; }
  };

  Builder.prototype.insert = function (it) {
    var I = this.items;
    if (I.length >= 60) { return 'That expression is long enough to fit on the scale.'; }
    var m = pairMsg(this.prev(), it) || pairMsg(it, this.next());
    if (m) { return m; }
    I.splice(this.pos, 0, it);
    this.pos++;
    return true;
  };

  /* returns true, or a message saying why the key can't go here */
  Builder.prototype.apply = function (k) {
    var I = this.items, a = this.prev(), b = this.next();

    if (/^[0-9]$/.test(k)) {
      if (this.expOpen) {
        var n = 0, j;
        for (j = this.pos - 1; j >= 0 && I[j].t === 'sup'; j--) { n++; }
        for (j = this.pos; j < I.length && I[j].t === 'sup'; j++) { n++; }
        if (n >= 2) { return 'Exponents can have up to 2 digits.'; }
        return this.insert({ t: 'sup', c: k });
      }
      var s = this.pos, e = this.pos;
      while (s > 0 && I[s - 1].t === 'd') { s--; }
      while (e < I.length && I[e].t === 'd') { e++; }
      if (e - s >= 6) { return 'Numbers can have up to 6 digits.'; }
      if (e - s === 1 && I[s].c === '0' && this.pos === e) { I[s] = { t: 'd', c: k }; return true; }   /* no leading zeros */
      if (k === '0' && this.pos === s && e > s) { return 'A number can’t start with 0.'; }
      return this.insert({ t: 'd', c: k });
    }

    if (k === 'back') {
      if (this.expOpen && !(a && a.t === 'sup')) { this.expOpen = false; return true; }
      if (!a) { return true; }
      I.splice(this.pos - 1, 1);
      this.pos--;
      this.expOpen = a.t === 'sup';
      return true;
    }

    if (k === 'del') {
      if (b) { I.splice(this.pos, 1); }
      return true;
    }

    if (k === 'clear') { this.items = []; this.pos = 0; this.expOpen = false; return true; }

    if (k === '^') {
      if (this.expOpen) { this.leaveExp(); return true; }
      if ((a && a.t === 'sup') || (b && b.t === 'sup')) { this.expOpen = true; return true; }
      if (!a || !VALUE_END[a.t]) { return 'Type a number (or close a parenthesis) first, then add its exponent.'; }
      if (b && b.t === 'd') { return 'Put the exponent after the whole number.'; }
      this.expOpen = true;
      return true;
    }

    this.leaveExp();
    a = this.prev();
    b = this.next();

    if (k === '+' || k === MINUS || k === TIMES || k === DIVIDE) {
      /* − at the start, after ( or = or after an operation starts a negative number */
      if (k === MINUS && (!a || a.t === '(' || a.t === 'op' || a.t === '=')) { return this.insert({ t: 'neg' }); }
      if (a && a.t === 'op') { a.v = k; return true; }                              /* swap the operation */
      if (b && b.t === 'op' && a && VALUE_END[a.t]) { b.v = k; this.pos++; return true; }
      return this.insert({ t: 'op', v: k });
    }

    if (k === '(') { return this.insert({ t: '(' }); }

    if (k === ')') {
      if (this.depthAt(this.pos) <= 0) { return 'There is no open parenthesis to close.'; }
      return this.insert({ t: ')' });
    }

    if (k === 'x' && this.allowX) { return this.insert({ t: 'x' }); }

    if (k === '=' && this.allowEq) {
      if (I.some(function (t) { return t.t === '='; })) { return 'An equation has only one = sign.'; }
      if (this.depthAt(this.pos) > 0) { return 'Close the parentheses before the = sign.'; }
      return this.insert({ t: '=' });
    }

    return 'Only numbers come from the keyboard.';
  };

  Builder.prototype.key = function (k) {
    if (k === 'left' || k === 'right') { this.move(k === 'left' ? 'ArrowLeft' : 'ArrowRight'); return; }
    var ok = this.apply(k);
    if (ok === true) {
      this.render();
      this.onChange(this);
    } else {
      reject(this, ok);
    }
  };

  /* arrow keys step through the exponent too: in, across, then out */
  Builder.prototype.move = function (key) {
    var p = this.pos, n = this.items.length;
    var prevSup = !!this.prev() && this.prev().t === 'sup', nextSup = !!this.next() && this.next().t === 'sup';
    if (key === 'Home') { this.pos = 0; this.expOpen = false; }
    else if (key === 'End') { this.pos = n; this.expOpen = false; }
    else if (key === 'ArrowRight') {
      if (!this.expOpen && nextSup) { this.expOpen = true; }
      else if (this.expOpen && !nextSup) { this.expOpen = false; }
      else if (p < n) { this.pos++; }
    } else {
      if (this.expOpen && !prevSup) { this.expOpen = false; }
      else if (!this.expOpen && prevSup) { this.expOpen = true; }
      else if (p > 0) { this.pos--; }
    }
    this.render();
  };

  /* a click puts the caret before or after the item clicked */
  Builder.prototype.clickAt = function (e) {
    var t = e.target.closest('[data-i]');
    if (!t || !this.el.contains(t)) {
      this.pos = this.items.length;
      this.expOpen = false;
    } else {
      var i = parseInt(t.getAttribute('data-i'), 10), r = t.getBoundingClientRect();
      this.pos = i + (e.clientX > r.left + r.width / 2 ? 1 : 0);
      this.expOpen = this.items[i].t === 'sup';
    }
    this.render();
  };

  Builder.prototype.enter = function () { this.onEnter(); };

  Builder.prototype.render = function () {
    this.el.innerHTML = (this.items.length || this.expOpen)
      ? itemsHtml(this.items, this.pos, this.expOpen)
      : '<span class="placeholder">' + this.placeholder + '</span>' + CARET;
    if (this.expBtn) { this.expBtn.setAttribute('aria-pressed', this.expOpen ? 'true' : 'false'); }
  };

  /* what goes on the pan while typing (no caret) */
  Builder.prototype.html = function () { return itemsHtml(this.items, -1, false); };

  /* → { tree, right } or { msg }. right: the side after the = sign, if any.
     ltr: + − × ÷ all go left to right, with no order of operations */
  Builder.prototype.parse = function (ltr) {
    var I = this.items, i;
    if (!I.length) { return { msg: 'Type an expression first.' }; }
    for (i = 0; i < I.length; i++) {
      var m = pairMsg(I[i - 1] || null, I[i]);
      if (m) { return { msg: m }; }
    }
    var t = I[I.length - 1].t;
    if (t === 'op' || t === 'neg') { return { msg: 'The expression can’t end with an operation.' }; }
    if (t === '(') { return { msg: 'Put something inside the parentheses.' }; }
    if (t === '=') { return { msg: 'Type the right side after the = sign.' }; }
    var T = toTokens(I), eq = -1;
    T.forEach(function (tk, j) { if (tk.t === '=') { eq = j; } });
    var sides = eq < 0 ? [T] : [T.slice(0, eq), T.slice(eq + 1)];
    for (i = 0; i < sides.length; i++) {
      var d = 0;
      sides[i].forEach(function (tk) { if (tk.t === '(') { d++; } else if (tk.t === ')') { d--; } });
      if (d > 0) { return { msg: 'Close every parenthesis first.' }; }
    }
    try {
      return { tree: parseTokens(sides[0], ltr), right: sides[1] ? parseTokens(sides[1], ltr) : null };
    } catch (e) {
      return { msg: 'Part of the expression is unfinished.' };
    }
  };

  /* Precedence parser: + − below × ÷ (and implied ×) below exponents.
     ltr: one level for + − × ÷, so they simply go left to right */
  function parseTokens(tokens, ltr) {
    var i = 0;
    function peek() { return tokens[i]; }
    function fail() { throw new Error('parse'); }

    function expr() {
      var n = term();
      while (peek() && peek().t === 'op' && (ltr || peek().v === '+' || peek().v === MINUS)) {
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
        if (!ltr && t.t === 'op' && (t.v === TIMES || t.v === DIVIDE)) { i++; n = mkBin(t.v, n, factor()); }
        else if ((t.t === '(' || t.t === 'x') && t.implicit) { n = mkBin(TIMES, n, factor(), true); }
        else { break; }
      }
      return n;
    }
    function powOf(n) {
      var t = peek();
      if (t && t.t === 'pow') {
        i++;
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

  /* suffix: the Undo number is an x term (2x), so x is shown after it */
  KeyField.prototype.render = function () {
    var v = this.value;
    var shown = this.masked ? v.replace(/./g, '•') : v.replace('-', MINUS);
    this.el.innerHTML = (v ? '<span class="kf-val">' + shown + '</span>'
      : this.suffix ? '' : '<span class="placeholder">' + this.placeholder + '</span>') +
      CARET + (this.suffix ? '<i class="m-var">x</i>' : '');
    this.el.classList.toggle('is-masked', this.masked);
  };

  /* ===================================================================
     5. STEP ENGINE — the order of operations
     The next step is the operation whose two inputs are both plain
     numbers, chosen by: deepest inside parentheses first, then
     exponents, then × ÷, then + −, and leftmost on a tie.
     Left to right (ltr): simply the first one in reading order.
     =================================================================== */

  var LEVEL = {};
  LEVEL['+'] = 1; LEVEL[MINUS] = 1; LEVEL[TIMES] = 2; LEVEL[DIVIDE] = 2;

  var VERB = {};
  VERB['+'] = 'Add'; VERB[MINUS] = 'Subtract'; VERB[TIMES] = 'Multiply'; VERB[DIVIDE] = 'Divide';

  function findNext(root, ltr) {
    var best = null, order = 0;
    function consider(n, depth, level, ord) {
      if (ltr) {
        if (!best) { best = { node: n, depth: depth }; }
        return;
      }
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

  function buildSteps(root, ltr) {
    var steps = [], cur = root;
    for (var guard = 0; guard < 80; guard++) {
      var nx = findNext(cur, ltr);
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

  /* the amount of a move: a number, or an x term like 2x */
  function amtNode(k, isX) { return isX ? coef(k, mkVar()) : mkNum(k); }

  function fmtAmt(k, isX) {
    if (!isX) { return fmt(k); }
    if (eqR(k, ONE)) { return '<i>x</i>'; }
    if (eqR(k, rat(-1))) { return MINUS + '<i>x</i>'; }
    return fmt(k) + '<i>x</i>';
  }

  /* The side with "op k" written on. It stays written on, marked as
     waiting, until Simplify tidies it away. */
  function showOp(E, op, k, isX) {
    var e = unwrap(E), amt = amtNode(k, isX);
    var node = (op === '+' || op === MINUS)
      ? mkBin(op, E, amt)
      : mkBin(op, isAddSub(e) ? mkParen(e) : E, amt);
    node.opHl = true;
    return node;
  }

  /* ---------- terms of a sum ---------- */

  /* the x coefficient of a term like x, 3x, −x or x ÷ 2; null if it isn't one */
  function xCoef(n) {
    n = unwrap(n);
    if (n.t === 'var') { return ONE; }
    if (n.t !== 'bin') { return null; }
    var c;
    if (n.op === TIMES && isNum(n.l) && (c = xCoef(n.r))) { return mul(valOf(n.l), c); }
    if (n.op === TIMES && isNum(n.r) && (c = xCoef(n.l))) { return mul(valOf(n.r), c); }
    if (n.op === DIVIDE && isNum(n.r) && (c = xCoef(n.l))) { return div(c, valOf(n.r)); }
    return null;
  }

  /* 'num', 'x', or null for a term that can't be combined (x², 3(x + 1) …) */
  function termKind(n) {
    if (isNum(n)) { return 'num'; }
    return xCoef(n) ? 'x' : null;
  }

  /* what a term is worth, sign included: − 4 → −4, − 2x → −2 */
  function termVal(e) {
    var v = isNum(e.node) ? valOf(e.node) : xCoef(e.node);
    return e.op === MINUS ? neg(v) : v;
  }

  /* a term worth v; first in a sum it carries its own sign, later on the
     sign is the + or − in front of it */
  function makeTerm(kind, v, first) {
    var pos = first || v.n >= 0;
    return { op: pos ? '+' : MINUS, node: amtNode(pos ? v : neg(v), kind === 'x'), opHl: false };
  }

  function negTerm(n) {
    if (isNum(n)) { return mkNum(neg(valOf(n))); }
    var c = xCoef(n);
    return c ? coef(neg(c), mkVar()) : coef(rat(-1), n);
  }

  /* a sum from a list of terms; a − in front of the first one moves onto it */
  function joinTerms(list) {
    if (!list.length) { return mkNum(rat(0)); }
    var n = list[0].op === MINUS ? negTerm(list[0].node) : list[0].node;
    for (var i = 1; i < list.length; i++) {
      n = mkBin(list[i].op, n, list[i].node);
      if (list[i].opHl) { n.opHl = true; }
    }
    return n;
  }

  function without(list, idx) {
    return list.filter(function (e, i) { return idx.indexOf(i) < 0; });
  }

  /* a term as written, sign included (for the banner and the Work list) */
  function termText(e, i) {
    var h = render(e.node, plainCtx(alg.frac));
    if (i === 0) { return (e.op === MINUS ? '<span class="m-num">' + MINUS + '</span>' : '') + h; }
    return '<span class="m-op">' + e.op + '</span>' + (isNegTerm(e.node) ? paren(h) : h);
  }

  /* add up the chosen terms of a sum (idx, in order), into the place of the first */
  function combineTerms(sumNode, list, idx, kind) {
    var total = rat(0), out = [], made = null;
    idx.forEach(function (i) { total = add(total, termVal(list[i])); });
    list.forEach(function (e, i) {
      if (i === idx[0]) {
        if (total.n !== 0) { made = makeTerm(kind, total, !out.length); out.push(made); }
      } else if (idx.indexOf(i) < 0) {
        out.push(e);
      }
    });
    var label = idx.map(function (i, k) { return termText(list[i], k); }).join('') +
      '<span class="m-op">=</span>' + (total.n === 0 ? numHtml(total) : render(amtNode(total, kind === 'x'), plainCtx(alg.frac)));
    return {
      target: sumNode, repl: joinTerms(out), cls: 'm-next', label: label,
      terms: idx.map(function (i) { return list[i].node.id; }),
      newId: made ? made.node.id : null
    };
  }

  /* ---------- Simplify: one tidy-up at a time ----------
     Each rule looks at one node and returns null, or
     { target, repl, cls, label, nodes / terms / ops: what to mark, newId }.
     The first rule that finds something anywhere on a side wins:
       1. terms that cancel out ........ 3x + 4 − 4 → 3x
       2. operations that do nothing ... + 0, × 1, ÷ 1, an exponent of 1
       3. × and ÷ that undo each other . 3x ÷ 3 → x,  x ÷ 2 × 2 → x
       4. arithmetic on two numbers .... 19 − 4 → 15
       5. adding a negative ............ x + (−2) → x − 2
       6. numbers in a sum, combined ... 3x + 4 − 1 → 3x + 3
       7. a number put next to x ....... x × 3 → 3x,  3x × 2 → 6x
     x terms are not combined here: that's Combine like terms. */

  function ruleCancel(n) {
    if (!isAddSub(n)) { return null; }
    var list = sumTerms(n);
    for (var i = 0; i < list.length; i++) {
      var ki = termKind(list[i].node);
      if (!ki) { continue; }
      var vi = termVal(list[i]);
      if (vi.n === 0) { continue; }
      for (var j = i + 1; j < list.length; j++) {
        if (termKind(list[j].node) === ki && eqR(termVal(list[j]), neg(vi))) {
          return {
            target: n, repl: joinTerms(without(list, [i, j])), cls: 'm-redundant',
            terms: [list[i].node.id, list[j].node.id],
            label: termText(list[i], i) + ' and ' + termText(list[j], j) + ' cancel out'
          };
        }
      }
    }
    return null;
  }

  function ruleNothing(n) {
    var i;
    if (isAddSub(n)) {
      var list = sumTerms(n);
      for (i = 0; i < list.length; i++) {
        if (termKind(list[i].node) && termVal(list[i]).n === 0) {
          return {
            target: n, repl: joinTerms(without(list, [i])), cls: 'm-redundant',
            terms: [list[i].node.id], label: termText(list[i], i) + ' changes nothing'
          };
        }
      }
      return null;
    }
    if (n.t === 'pow' && n.e === 1) {
      return { target: n, repl: n.base, cls: 'm-redundant', nodes: [n.id], label: 'An exponent of 1 changes nothing' };
    }
    if (n.t !== 'bin' || (n.op !== TIMES && n.op !== DIVIDE)) { return null; }
    if (isNum(n.r) && eqR(valOf(n.r), ONE) && !isNum(n.l)) {
      return {
        target: n, repl: n.l, cls: 'm-redundant', ops: [{ id: n.id, side: 'r' }],
        label: '<span class="m-op">' + n.op + '</span>1 changes nothing'
      };
    }
    if (n.op === TIMES && isNum(n.l) && eqR(valOf(n.l), ONE) && !isNum(n.r)) {
      var m = n.implicit ? { nodes: [n.l.id] } : { ops: [{ id: n.id, side: 'l' }] };
      m.target = n; m.repl = n.r; m.cls = 'm-redundant'; m.label = '1<span class="m-op">' + TIMES + '</span> changes nothing';
      return m;
    }
    return null;
  }

  /* A × k, k × A or A ÷ k, written with the sign (not 3x itself) */
  function mulDivParts(n) {
    if (n.t !== 'bin' || n.implicit) { return null; }
    if ((n.op === DIVIDE || n.op === TIMES) && isNum(n.r) && !isNum(n.l)) { return { op: n.op, k: valOf(n.r), a: unwrap(n.l), side: 'r' }; }
    if (n.op === TIMES && isNum(n.l) && !isNum(n.r)) { return { op: TIMES, k: valOf(n.l), a: unwrap(n.r), side: 'l' }; }
    return null;
  }

  /* the c and the rest of c × B (3x, 3(x + 4), x × 3) */
  function coefParts(a) {
    if (a.t !== 'bin' || a.op !== TIMES) { return null; }
    if (isNum(a.l)) { return { c: valOf(a.l), cNode: unwrap(a.l), b: a.r }; }
    if (isNum(a.r)) { return { c: valOf(a.r), cNode: unwrap(a.r), b: a.l }; }
    return null;
  }

  function mulDivResult(n, repl, cls, extra) {
    var ctx = plainCtx(alg.frac);
    return {
      target: n, repl: repl, cls: cls, nodes: extra || [], ops: [{ id: n.id, side: mulDivParts(n).side }],
      label: render(n, ctx) + '<span class="m-op">=</span>' + render(repl, ctx), newId: repl.id
    };
  }

  function ruleUndo(n) {
    var p = mulDivParts(n);
    if (!p) { return null; }
    var cp = coefParts(p.a);
    if (cp && p.op === DIVIDE) {                          /* 3x ÷ 3 → x,  6x ÷ 3 → 2x */
      var q = div(cp.c, p.k);
      if (isInt(q)) { return mulDivResult(n, coef(q, cp.b), 'm-redundant', [cp.cNode.id]); }
    }
    if (p.op === TIMES && p.a.t === 'bin' && p.a.op === DIVIDE && isNum(p.a.r)) {
      var d = valOf(p.a.r), q2 = div(d, p.k), inv = div(p.k, d);
      if (isInt(q2)) { return mulDivResult(n, divBy(p.a.l, q2), 'm-redundant', [unwrap(p.a.r).id]); }   /* x ÷ 2 × 2 → x */
      if (isInt(inv)) { return mulDivResult(n, coef(inv, p.a.l), 'm-redundant', [unwrap(p.a.r).id]); }   /* x ÷ 2 × 6 → 3x */
    }
    return null;
  }

  function ruleArith(n) {
    var v;
    if (n.t === 'bin' && isNum(n.l) && isNum(n.r)) { v = opApply(n.op, valOf(n.l), valOf(n.r)); }
    else if (n.t === 'pow' && isNum(n.base)) { v = powR(valOf(n.base), n.e); }
    else { return null; }
    var repl = mkNum(v);
    return {
      target: n, repl: repl, cls: 'm-next', nodes: [n.id], newId: repl.id,
      label: render(n, plainCtx(alg.frac)) + '<span class="m-op">=</span>' + numHtml(v)
    };
  }

  function ruleSigns(n) {
    if (!isAddSub(n)) { return null; }
    var list = sumTerms(n);
    for (var i = 1; i < list.length; i++) {
      if (termKind(list[i].node) && isNegTerm(unwrap(list[i].node))) {
        var e = list[i], flip = { op: e.op === '+' ? MINUS : '+', node: negTerm(e.node), opHl: false };
        var out = list.slice();
        out[i] = flip;
        return {
          target: n, repl: joinTerms(out), cls: 'm-next', terms: [e.node.id], newId: flip.node.id,
          label: termText(e, i) + ' is the same as ' + termText(flip, i)
        };
      }
    }
    return null;
  }

  function ruleNumbers(n) {
    if (!isAddSub(n)) { return null; }
    var list = sumTerms(n), idx = [];
    list.forEach(function (e, i) { if (isNum(e.node)) { idx.push(i); } });
    return idx.length < 2 ? null : combineTerms(n, list, idx, 'num');
  }

  function ruleCoef(n) {
    var p = mulDivParts(n);
    if (!p) { return null; }
    var cp = coefParts(p.a), repl = null;
    if (p.op === TIMES && cp) { repl = coef(mul(cp.c, p.k), cp.b); }                     /* 3x × 2 → 6x */
    else if (p.op === TIMES && (p.a.t === 'var' || p.a.t === 'pow' || isAddSub(p.a))) {
      repl = coef(p.k, p.a);                                                             /* x × 3 → 3x */
    } else if (p.op === DIVIDE && p.a.t === 'bin' && p.a.op === DIVIDE && isNum(p.a.r)) {
      repl = divBy(p.a.l, mul(valOf(p.a.r), p.k));                                       /* x ÷ 2 ÷ 3 → x ÷ 6 */
    }
    return repl ? mulDivResult(n, repl, 'm-next') : null;
  }

  var TIDY_RULES = [ruleCancel, ruleNothing, ruleUndo, ruleArith, ruleSigns, ruleNumbers, ruleCoef];

  /* the first node (reading order) a rule applies to; a sum is visited
     once, as a whole, then its terms */
  function walkFind(n, fn) {
    var r = fn(n);
    if (r) { return r; }
    if (n.t === 'paren') { return walkFind(n.inner, fn); }
    if (n.t === 'pow') { return walkFind(n.base, fn); }
    if (n.t !== 'bin') { return null; }
    var kids = isAddSub(n) ? sumTerms(n).map(function (e) { return e.node; }) : [n.l, n.r];
    for (var i = 0; i < kids.length; i++) {
      r = walkFind(kids[i], fn);
      if (r) { return r; }
    }
    return null;
  }

  function findTidy(tree) {
    for (var i = 0; i < TIDY_RULES.length; i++) {
      var r = walkFind(tree, TIDY_RULES[i]);
      if (r) { return r; }
    }
    return null;
  }

  /* after a change: ( ) where a sum needs them, none around a lone
     number, x or power, and none around a whole side */
  function tidyTree(n, top) {
    var c, l, r;
    if (n.t === 'paren') {
      c = tidyTree(n.inner, false);
      if (top) { return tidyTree(c, true); }
      if (c.t === 'num' || c.t === 'var' || c.t === 'pow' || c.t === 'paren') { return c; }
      return c === n.inner ? n : copyNode(n, { inner: c });
    }
    if (n.t === 'pow') {
      c = tidyTree(n.base, false);
      if (isAddSub(c)) { c = mkParen(c); }
      return c === n.base ? n : copyNode(n, { base: c });
    }
    if (n.t !== 'bin') { return n; }
    l = tidyTree(n.l, false);
    r = tidyTree(n.r, false);
    if (isAddSub(r) || (n.op === DIVIDE && r.t === 'bin')) { r = mkParen(r); }
    if (!isAddSub(n) && isAddSub(l)) { l = mkParen(l); }
    return (l === n.l && r === n.r) ? n : copyNode(n, { l: l, r: r });
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
     The right pan always holds the value of what is typed, worked out
     again on every change, in the chosen order: PEMDAS, or straight
     left to right.
     =================================================================== */

  var std = { ltr: false, value: null };

  function stdCtx() { return { frac: false, hl: {}, dec: true }; }
  function stdNum(v) { return numHtml(v, true); }
  var stdLog = $('stdLog');
  var pemdas = $('pemdas');

  var stdBuilder = new Builder($('stdBuilder'), {
    placeholder: 'Type a number to start',
    expBtn: document.querySelector('.keys[data-target="stdBuilder"] .key-exp'),
    onChange: function () { stdRender(); },
    onEnter: function () {}
  });

  /* light up the PEMDAS letters this expression uses */
  function setPemdas(steps) {
    Array.prototype.forEach.call(pemdas.children, function (li) {
      var c = li.getAttribute('data-cat');
      li.classList.toggle('is-on', steps.some(function (s) { return s.cat === c || (c === 'P' && s.inParens); }));
    });
  }

  function stdLogHtml(steps) {
    var h = '';
    steps.forEach(function (s) {
      h += '<li><div><span class="log-verb">' + s.verb + (s.inParens ? ' · inside ( )' : '') +
        '</span><span class="log-math">' + render(s.node, stdCtx()) + '<span class="m-op">=</span>' +
        stdNum(s.value) + '</span></div></li>';
    });
    stdLog.innerHTML = h;
    $('stdLogEmpty').hidden = steps.length > 0;
  }

  function stdRender() {
    if (mode !== 'std') { return; }
    var B = stdBuilder;

    if (!B.items.length) {
      std.value = null;
      scale.setSide('L', '?', '', true);
      scale.setSide('R', '?', '', true);
      scale.setBalance(null, null);
      setBanner('std', 'Type an expression. <span class="b-small">Numbers from the keyboard, everything else from the buttons.</span>');
      setPemdas([]);
      stdLogHtml([]);
      return;
    }

    var p = B.parse(std.ltr), msg = p.msg, kind = '', steps = [], value = null;
    if (!msg) {
      try {
        steps = buildSteps(p.tree, std.ltr);
        value = evaluate(p.tree);
      } catch (e) {
        if (!(e instanceof MathError)) { throw e; }
        msg = MATH_MESSAGES[e.code];
        kind = 'warn';
      }
    }

    if (msg) {
      std.value = null;
      scale.setSide('L', B.html(), '', false);
      scale.setSide('R', '?', '', true);
      scale.setBalance('some', null);
      setBanner('std', (kind ? '' : 'Keep going… ') + '<span class="b-small">' + msg + '</span>', kind);
      setPemdas([]);
      stdLogHtml([]);
      return;
    }

    var changed = !std.value || !eqR(std.value, value), ctx = stdCtx();
    std.value = value;
    scale.setSide('L', render(p.tree, ctx), '', false);
    scale.setSide('R', stdNum(value), '', false, changed);
    scale.setBalance(value, value);

    var note = steps.length ? '' : ' <span class="b-small">Nothing to work out: it is already one number.</span>';
    if (std.ltr && steps.length) {
      var pv = null;
      try { pv = evaluate(B.parse(false).tree); } catch (e) { if (!(e instanceof MathError)) { throw e; } }
      note = pv && !eqR(pv, value)
        ? ' <span class="b-small">That’s left to right. With PEMDAS it would be ' + stdNum(pv) + '.</span>'
        : ' <span class="b-small">Left to right gives the same answer as PEMDAS here.</span>';
    }
    setBanner('std', render(p.tree, ctx) + '<span class="m-op">=</span>' + stdNum(value) + note, 'success');
    setPemdas(std.ltr ? [] : steps);
    stdLogHtml(steps);
  }

  document.querySelectorAll('input[name="stdOrder"]').forEach(function (r) {
    r.addEventListener('change', function () {
      std.ltr = radioVal('stdOrder') === 'ltr';
      pemdas.hidden = std.ltr;
      $('ltrNote').hidden = !std.ltr;
      stdRender();
    });
  });

  /* ===================================================================
     9. SOLVE FOR X MODE
     A move writes its operation onto the side(s), and it stays there
     (marked) until Simplify tidies it away, one stage at a time.
     Combine like terms adds up terms picked on the scale.
     =================================================================== */

  var alg = {
    source: 'random', frac: true, ready: false, everShown: false,
    x: null, origLeft: null, origRight: null, left: null, right: null,
    history: [], log: [], solved: false, revealed: false,
    simp: null, picking: null, newMark: null, checking: null, subView: null
  };

  var algLog = $('algLog');
  var xChip = $('xChip');
  var chainEl = $('chain');
  var combineBtn = $('algCombine');

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

  function setAmtX(on) {
    amtField.suffix = on;
    amtField.render();
    $('amtX').setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  var algBuilder = new Builder($('algBuilder'), {
    allowX: true,
    allowEq: true,
    placeholder: 'Build the equation',
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

  /* x alone on one side, a number on the other */
  function isSolved() {
    var l = unwrap(alg.left), r = unwrap(alg.right);
    return ((l.t === 'var' && isNum(r)) || (r.t === 'var' && isNum(l))) && balanced();
  }

  function eqEntry() {
    return { type: 'eq', left: alg.left, right: alg.right, rel: relOf(alg.left, alg.right), solved: isSolved() };
  }

  function snapshot() { return { left: alg.left, right: alg.right, logLen: alg.log.length }; }

  function stopCheck() {
    if (!alg.checking) { return; }
    clearTimeout(alg.checking.timer);
    alg.checking = null;
    $('algCheck').disabled = false;
  }

  function algStopAll() { finishSimplify(); stopCheck(); endPicking(); alg.subView = null; alg.newMark = null; }

  function algCanAct() {
    if (alg.ready) { return true; }
    say('Set up an equation first: press New equation or Put it on the scale.');
    return false;
  }

  /* right: a tree (a number for random equations) */
  function algSetEquation(left, right, x) {
    algStopAll();
    alg.x = x;
    alg.origLeft = left;
    alg.origRight = right;
    alg.left = left;
    alg.right = right;
    alg.history = [];
    alg.solved = false;
    alg.revealed = false;
    alg.ready = true;
    alg.log = [eqEntry()];
    $('algReveal').setAttribute('aria-pressed', 'false');
    amtField.set('');
    setAmtX(false);
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
    algSetEquation(g.left, mkNum(g.right), g.x);
  }

  /* the x that makes L = R, when both sides are straight lines in x */
  function solveFor(L, R) {
    function f(t) { return sub(evaluate(L, t), evaluate(R, t)); }
    try {
      var f0 = f(rat(0)), a = sub(f(ONE), f0);
      if (a.n === 0) { return null; }
      var x = div(neg(f0), a);
      if (!eqR(f(rat(2)), add(f0, mul(a, rat(2)))) || f(x).n !== 0) { return null; }
      return x;
    } catch (e) {
      if (e instanceof MathError) { return null; }
      throw e;
    }
  }

  function algPlace() {
    var p = algBuilder.parse(false);
    if (p.msg) { reject(algBuilder, p.msg); return; }
    if (!hasVar(p.tree) && !(p.right && hasVar(p.right))) { reject(algBuilder, 'Put an x in it: use the x button.'); return; }
    var xv = xField.number(), X = xv === null ? null : rat(xv), right = p.right, worked = false;
    try {
      if (!right) {
        if (!X) { reject(xField, 'Type a value for x first (it stays hidden), or press = and type the right side too.'); xField.el.focus(); return; }
        right = mkNum(evaluate(p.tree, X));
      } else if (X) {
        if (cmpR(evaluate(p.tree, X), evaluate(right, X)) !== 0) {
          reject(algBuilder, 'With that value of x the two sides aren’t equal. Change x or the equation, or clear x to have it worked out.');
          return;
        }
      } else {
        X = solveFor(p.tree, right);
        if (!X) { reject(xField, 'x can’t be worked out from this equation. Type the value x should have.'); xField.el.focus(); return; }
        worked = true;
      }
    } catch (e) {
      if (e instanceof MathError) { say(MATH_MESSAGES[e.code] + ' Try another value for x.'); shake(algBuilder.el); return; }
      throw e;
    }
    say(worked ? 'x was worked out from your equation. It stays hidden until it’s found.' : '', 'info');
    xField.masked = true;
    xField.render();
    $('xFieldEye').setAttribute('aria-pressed', 'false');
    $('xFieldEye').textContent = 'Show';
    algSetEquation(p.tree, right, X);
    refreshTargets();
  }

  function moveText(op, k, side, isX) {
    var n = '<b>' + fmtAmt(k, isX) + '</b>';
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

  /* Submit: write the operation onto the chosen side(s) */
  function algApply() {
    if (!algCanAct()) { return; }
    algStopAll();
    var op = radioVal('algOp'), side = radioVal('algSide'), kv = amtField.number(), isX = !!amtField.suffix;
    if (kv === null && isX) { kv = amtField.value === '-' ? -1 : 1; }
    if (kv === null) { reject(amtField, 'Type the number to use first.'); amtField.el.focus(); return; }
    if (isX && (op === TIMES || op === DIVIDE)) {
      reject(amtField, 'x terms can only be added or subtracted. Choose + or −, or turn x off.');
      return;
    }
    if (isX && kv === 0) { reject(amtField, 'Adding 0x changes nothing. Try another number.'); return; }
    var k = rat(kv);
    if (op === DIVIDE && kv === 0) { reject(amtField, MATH_MESSAGES.zero); return; }
    if (op === TIMES && kv === 0) { reject(amtField, 'Multiplying by 0 turns both sides into 0, and x disappears. Try another number.'); return; }

    var L = alg.left, R = alg.right, nl = L, nr = R;
    try {
      if (side !== 'right') { nl = showOp(L, op, k, isX); }
      if (side !== 'left') { nr = showOp(R, op, k, isX); }
      evaluate(nl, alg.x);
      evaluate(nr, alg.x);
    } catch (e) {
      if (e instanceof MathError) { reject(amtField, MATH_MESSAGES[e.code]); return; }
      throw e;
    }
    say('');
    var wasBalanced = balanced();
    alg.history.push(snapshot());
    alg.left = nl;
    alg.right = nr;
    alg.log.push({ type: 'move', html: '<b>' + op + ' ' + fmtAmt(k, isX) + '</b> · ' + moveText(op, k, side, isX), warn: side !== 'both' });
    alg.log.push(eqEntry());
    algRender(true);
    algAfterMove({ side: side, wasBalanced: wasBalanced });
  }

  /* ---------- Simplify: mark, pause, tidy, pause, … ---------- */

  function tidyStage() {
    var L = findTidy(alg.left), R = findTidy(alg.right);
    return (L || R) ? { L: L, R: R } : null;
  }

  function applyStage(st) {
    if (st.L) { alg.left = tidyTree(replaceNode(alg.left, st.L.target, st.L.repl), true); }
    if (st.R) { alg.right = tidyTree(replaceNode(alg.right, st.R.target, st.R.repl), true); }
  }

  function algSimplify() {
    if (!algCanAct()) { return; }
    algStopAll();
    var st = tidyStage();
    if (!st) { say('Nothing to simplify: no operations are left to clear away or work out.', 'info'); return; }
    say('');
    alg.history.push(snapshot());
    alg.simp = { stage: st, phase: 'mark', timer: null, count: 0 };
    $('algSimplify').disabled = true;
    simpShow();
  }

  function simpShow() {
    var s = alg.simp, st = s.stage, marking = s.phase === 'mark';
    algRender(!marking);
    var parts = [];
    if (st.L) { parts.push('<span class="b-small">Left:</span> ' + st.L.label); }
    if (st.R) { parts.push('<span class="b-small">Right:</span> ' + st.R.label); }
    setBanner('alg', '<span class="b-tag">Simplify</span> ' + parts.join(' <span class="b-small">·</span> '), 'step');
    s.timer = setTimeout(simpStep, marking ? 1500 : 1000);
  }

  function simpStep() {
    var s = alg.simp;
    if (s.phase === 'mark') {
      applyStage(s.stage);
      s.count++;
      s.phase = 'new';
      simpShow();
      return;
    }
    var st = s.count < 60 ? tidyStage() : null;
    if (!st) { simpDone(); return; }
    s.stage = st;
    s.phase = 'mark';
    simpShow();
  }

  function simpDone() {
    clearTimeout(alg.simp.timer);
    alg.simp = null;
    $('algSimplify').disabled = false;
    alg.log.push({ type: 'move', html: '<b>Simplify</b> · clear away what cancels, work out what can be worked out' });
    alg.log.push(eqEntry());
    algRender(true);
    algAfterMove({ side: 'simplify', wasBalanced: true });
  }

  /* skip to the end (anything else pressed part way through) */
  function finishSimplify() {
    var s = alg.simp;
    if (!s) { return; }
    clearTimeout(s.timer);
    if (s.phase === 'mark') { applyStage(s.stage); }
    for (var guard = 0, st; guard < 60 && (st = tidyStage()); guard++) { applyStage(st); }
    simpDone();
  }

  /* ---------- Combine like terms: press, pick terms on the scale, press again ---------- */

  function endPicking() {
    alg.picking = null;
    combineBtn.setAttribute('aria-pressed', 'false');
    combineBtn.textContent = 'Combine like terms';
    $('algCombineCancel').hidden = true;
    $('scaleBox').classList.remove('is-picking');
  }

  function pickLabel() {
    var n = alg.picking.ids.length;
    combineBtn.textContent = n ? 'Combine ' + n + ' term' + (n > 1 ? 's' : '') : 'Pick the terms…';
  }

  function cancelPicking() {
    endPicking();
    say('');
    algRender();
    algAfterMove({ side: 'none', wasBalanced: true });
  }

  function algCombine() {
    if (!algCanAct()) { return; }
    var p = alg.picking;
    if (!p) {
      algStopAll();
      say('');
      alg.picking = { side: null, chain: null, kind: null, ids: [] };
      combineBtn.setAttribute('aria-pressed', 'true');
      pickLabel();
      $('algCombineCancel').hidden = false;
      $('scaleBox').classList.add('is-picking');
      setBanner('alg', '<span class="b-tag">Combine like terms</span> Click the terms to put together. ' +
        '<span class="b-small">x terms with x terms, numbers with numbers, on the same side.</span>', 'step');
      algRender();
      return;
    }
    if (p.ids.length < 2) { say('Click at least two like terms on the scale, then press this again.', 'info'); return; }

    var tree = p.side === 'L' ? alg.left : alg.right;
    var sumNode = findById(tree, p.chain), list = sumTerms(sumNode), idx = [];
    list.forEach(function (e, i) { if (p.ids.indexOf(e.node.id) >= 0) { idx.push(i); } });
    var res = combineTerms(sumNode, list, idx, p.kind);
    var side = p.side;
    endPicking();
    say('');
    alg.history.push(snapshot());
    var nt = tidyTree(replaceNode(tree, sumNode, res.repl), true);
    if (side === 'L') { alg.left = nt; } else { alg.right = nt; }
    alg.newMark = res.newId ? { side: side, id: res.newId } : null;
    alg.log.push({ type: 'move', html: '<b>Combine like terms</b> · ' + res.label });
    alg.log.push(eqEntry());
    algRender(true);
    algAfterMove({ side: 'combine', wasBalanced: true, label: res.label });
  }

  /* a click on a term on the scale while picking */
  function algPick(side, id, chainId) {
    var p = alg.picking, tree = side === 'L' ? alg.left : alg.right;
    var sumNode = findById(tree, chainId);
    if (!sumNode || !isAddSub(sumNode)) { return; }
    var e = sumTerms(sumNode).filter(function (t) { return t.node.id === id; })[0];
    var kind = e ? termKind(e.node) : null;
    if (!kind) { say('Only numbers and x terms (like 3x) can be combined.'); return; }
    var at = p.ids.indexOf(id);
    if (at >= 0) {
      p.ids.splice(at, 1);
      say('');
    } else {
      if (p.ids.length && (p.side !== side || p.chain !== chainId)) {
        say('Like terms are combined on the same side of the scale, inside the same sum. That one starts a new pick.', 'info');
        p.ids = [];
      } else if (p.ids.length && p.kind !== kind) {
        say(kind === 'x' ? 'That’s an x term, and the terms picked so far are numbers. Numbers go with numbers, x terms with x terms.'
          : 'That’s a number, and the terms picked so far are x terms. Numbers go with numbers, x terms with x terms.');
        return;
      } else {
        say('');
      }
      p.side = side;
      p.chain = chainId;
      p.kind = kind;
      p.ids.push(id);
    }
    pickLabel();
    algRender();
  }

  ['L', 'R'].forEach(function (side) {
    $('card' + side).addEventListener('click', function (e) {
      if (mode !== 'alg' || !alg.picking) { return; }
      var t = e.target.closest('[data-term]');
      if (t) { algPick(side, parseInt(t.getAttribute('data-term'), 10), parseInt(t.getAttribute('data-chain'), 10)); }
    });
  });

  /* narrate the move on the banner */
  function algAfterMove(move) {
    var ctx = plainCtx(alg.frac);
    var eq = render(alg.left, ctx) + '<span class="m-op">' + relOf(alg.left, alg.right) + '</span>' + render(alg.right, ctx);
    alg.solved = isSolved();
    if (alg.solved) {
      var val = unwrap(alg.left).t === 'var' ? alg.right : alg.left;
      setBanner('alg', '<i class="m-var">x</i><span class="m-op">=</span>' + render(val, ctx) +
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
      setBanner('alg', 'Level again: ' + eq + ' <span class="b-small">Both sides have now had the same thing done to them.' +
        (tidyStage() ? ' Press Simplify to tidy up.' : '') + '</span>', 'success');
    } else if (move.side === 'simplify') {
      setBanner('alg', eq + ' <span class="b-small">Simplified. Nothing is left to clear away.</span>');
    } else if (move.side === 'combine') {
      setBanner('alg', eq + ' <span class="b-small">Like terms combined: ' + move.label + '</span>');
    } else {
      setBanner('alg', eq + ' <span class="b-small">' + (move.side === 'both' ? 'Still balanced: the same thing was done to both sides.' : 'Balanced.') +
        (tidyStage() ? ' Press Simplify to tidy up.' : '') + '</span>');
    }
    algRender();
  }

  /* the x term of a side (2x in 2x + 3), sign included */
  function xTermOf(tree) {
    var list = termsOf(unwrap(tree));
    for (var i = 0; i < list.length; i++) {
      if (termKind(list[i].node) === 'x') { return termVal(list[i]); }
    }
    return null;
  }

  /* x shows up in two terms of the same sum */
  function hasLikeX(tree) {
    return !!walkFind(tree, function (n) {
      return isAddSub(n) && sumTerms(n).filter(function (e) { return termKind(e.node) === 'x'; }).length > 1;
    });
  }

  function algHint() {
    if (!algCanAct()) { return; }
    algStopAll();
    if (!balanced()) {
      say('First level the scale: do the same operation to the other side, or press Take back last move.', 'info');
      return;
    }
    if (isSolved()) { say('x is already alone. You’re done!', 'info'); return; }
    if (tidyStage()) { say('First press Simplify: part of the equation can be cleared away or worked out.', 'info'); return; }
    if (hasLikeX(alg.left) || hasLikeX(alg.right)) {
      say('x shows up more than once on one side. Press Combine like terms, click those x terms, then press it again.', 'info');
      return;
    }
    var op, k, why, isX = false;
    var lx = hasVar(alg.left), rx = hasVar(alg.right);
    if (lx && rx) {
      var c = xTermOf(alg.right);
      if (!c) { say('x is on both sides here in a way these moves can’t untangle.', 'info'); return; }
      op = c.n > 0 ? MINUS : '+';
      k = c.n > 0 ? c : neg(c);
      isX = true;
      why = 'x is on both sides. Move it off the right: ' + op + ' ' + fmtAmt(k, true).replace(/<\/?i>/g, '') + ' on both sides.';
    } else {
      var xs = lx ? alg.left : alg.right, e = unwrap(xs), s = topStep(xs);
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
      } else if (countVar(xs) > 1) {
        say('x shows up more than once, in a way Combine like terms can’t reach.', 'info');
        return;
      } else {
        say('This one needs more than + − × ÷ to undo (an exponent needs a root).', 'info');
        return;
      }
    }
    if (isInt(k)) {
      setRadio('algOp', op);
      setRadio('algSide', 'both');
      amtField.set(String(k.n));
      setAmtX(isX);
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
    alg.subView = { left: substitute(alg.origLeft, alg.x, ids), right: substitute(alg.origRight, alg.x, ids), ids: ids };
    algRender(true);
    setBanner('alg', 'The original equation, with ' + (ids.length > 1 ? 'each' : 'the') + ' <i class="m-var">x</i> replaced by ' +
      numHtml(alg.x) + ' <span class="b-small">The scale is still level: ' + numHtml(alg.x) + ' is the value that makes it true.</span>', 'success');
  }

  /* put x back in and simplify the original sides, left then right, step by step */
  function algCheck() {
    if (!alg.solved) { return; }
    algStopAll();
    say('');
    var ids = [], c;
    var lt = substitute(alg.origLeft, alg.x, ids), rt = substitute(alg.origRight, alg.x, ids);
    try {
      c = { L: lt, R: rt, sl: buildSteps(lt), sr: buildSteps(rt), value: evaluate(lt), idx: 0, subIds: ids, timer: null, done: false };
    } catch (e) {
      if (e instanceof MathError) { say(MATH_MESSAGES[e.code]); return; }
      throw e;
    }
    alg.checking = c;
    $('algCheck').disabled = true;
    checkRender();
    var n = c.sl.length + c.sr.length;
    (function tick() {
      if (alg.checking !== c) { return; }
      if (c.idx < n) {
        c.timer = setTimeout(function () { c.idx++; checkRender(); tick(); }, c.idx === 0 ? 2200 : 1800);
      } else {
        c.timer = setTimeout(function () { c.done = true; checkRender(); $('algCheck').disabled = false; }, 3000);
      }
    })();
  }

  function checkRender() {
    if (mode !== 'alg') { return; }
    var c = alg.checking, nL = c.sl.length, n = nL + c.sr.length, i = c.idx;
    var lctx = plainCtx(alg.frac), rctx = plainCtx(alg.frac);
    var xs = '<i class="m-var">x</i><span class="m-op">=</span>' + numHtml(alg.x);
    if (c.done) {
      scale.setSide('L', render(alg.origLeft, lctx), '', false, true);
      scale.setSide('R', render(alg.origRight, rctx), '', false, true);
      setBanner('alg', render(alg.origLeft, lctx) + '<span class="m-op">=</span>' + render(alg.origRight, rctx) +
        ' <span class="b-small">is true when</span> ' + xs, 'success');
    } else {
      var li = Math.min(i, nL), ri = Math.max(0, i - nL);
      var lt = li === 0 ? c.L : c.sl[li - 1].after, rt = ri === 0 ? c.R : c.sr[ri - 1].after;
      if (i === 0) {
        c.subIds.forEach(function (id) { lctx.hl[id] = 'm-sub'; rctx.hl[id] = 'm-sub'; });
      } else if (i <= nL) {
        lctx.hl[c.sl[i - 1].newId] = 'm-new';
      } else {
        rctx.hl[c.sr[i - nL - 1].newId] = 'm-new';
      }
      if (i < nL) { lctx.hl[c.sl[i].node.id] = 'm-next'; }
      else if (i < n) { rctx.hl[c.sr[i - nL].node.id] = 'm-next'; }
      scale.setSide('L', render(lt, lctx), '', false, i > 0 && i <= nL);
      scale.setSide('R', render(rt, rctx), '', false, i > nL);
      if (i === 0) {
        setBanner('alg', '<span class="b-tag">Check</span> Put ' + xs + ' back into the original equation.', 'step');
      } else if (i < n) {
        var s = i <= nL ? c.sl[i - 1] : c.sr[i - nL - 1];
        setBanner('alg', '<span class="b-tag">Check ' + i + ' of ' + n + '</span> ' + s.verb + ': ' +
          render(s.node, plainCtx(alg.frac)) + '<span class="m-op">=</span>' + numHtml(s.value), 'step');
      } else {
        setBanner('alg', '✓ ' + numHtml(c.value) + '<span class="m-op">=</span>' + numHtml(c.value) +
          ' <span class="b-small">It balances, so</span> ' + xs + ' <span class="b-small">is right.</span>', 'success');
      }
    }
    scale.setBalance(c.value, c.value);
  }

  /* the forward chain (how x was built) above the backward one (how it was undone) */
  function chainHtml() {
    if (!isNum(alg.origRight)) { return ''; }
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

  /* highlights for one side of the scale: operations waiting for
     Simplify, what Simplify is about to tidy, terms being picked */
  function sideCtx(side) {
    var ctx = plainCtx(alg.frac), s = alg.simp, st = s && s.stage[side];
    ctx.pending = true;
    ctx.terms = {};
    ctx.marks = {};
    if (st && s.phase === 'mark') {
      (st.nodes || []).forEach(function (id) { ctx.hl[id] = st.cls; });
      (st.terms || []).forEach(function (id) { ctx.terms[id] = st.cls; });
      (st.ops || []).forEach(function (o) { ctx.marks[o.id] = { side: o.side, cls: st.cls }; });
    } else if (st && st.newId) {
      ctx.hl[st.newId] = 'm-new';
    }
    if (alg.picking && alg.picking.side === side) {
      alg.picking.ids.forEach(function (id) { ctx.terms[id] = 'm-picked'; });
    }
    if (alg.newMark && alg.newMark.side === side) { ctx.hl[alg.newMark.id] = 'm-new'; }
    return ctx;
  }

  function algRender(flash) {
    if (mode !== 'alg') { return; }
    if (alg.checking) { checkRender(); }

    if (!alg.ready) {
      var building = alg.source === 'build' && algBuilder.items.length;
      scale.setSide('L', building ? algBuilder.html() : '?', '', !building);
      scale.setSide('R', '?', '', true);
      scale.setBalance(building ? 'some' : null, null);
      setBanner('alg', alg.source === 'build'
        ? 'Build the equation, then press <span class="b-small">Put it on the scale.</span>'
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
      var v = evaluate(alg.origLeft, alg.x);
      scale.setSide('L', render(alg.subView.left, sctx), '', false, flash);
      scale.setSide('R', render(alg.subView.right, sctx), '', false, flash);
      scale.setBalance(v, v);
    } else if (!alg.checking) {
      scale.setSide('L', render(alg.left, sideCtx('L')), '', false, flash);
      scale.setSide('R', render(alg.right, sideCtx('R')), '', false, flash);
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
  $('algSimplify').addEventListener('click', algSimplify);
  $('algCombine').addEventListener('click', algCombine);
  $('algCombineCancel').addEventListener('click', cancelPicking);
  $('algHint').addEventListener('click', algHint);
  $('algUndo').addEventListener('click', algUndo);
  $('algRestart').addEventListener('click', algRestart);
  $('algCheck').addEventListener('click', algCheck);
  $('algPlug').addEventListener('click', algPlug);

  $('amtX').addEventListener('click', function () {
    setAmtX(!amtField.suffix);
    if (amtField.suffix && (radioVal('algOp') === TIMES || radioVal('algOp') === DIVIDE)) { setRadio('algOp', MINUS); }
  });

  /* × and ÷ don't go with x terms */
  document.querySelectorAll('input[name="algOp"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (amtField.suffix && (r.value === TIMES || r.value === DIVIDE)) { setAmtX(false); }
    });
  });

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

    if (e.key === 'Escape' && mode === 'alg' && alg.picking) { cancelPicking(); return; }
    if (inField && t instanceof Builder && /^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) { e.preventDefault(); t.move(e.key); return; }
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); t.key(e.key); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      t.key(e.key === 'Delete' && t instanceof Builder ? 'del' : 'back');
      return;
    }
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
    if (mode === 'alg') {
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
