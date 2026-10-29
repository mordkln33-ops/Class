/* ============================================================
   Polynomial Playground
   ------------------------------------------------------------
   An expression is a list of items. Each item is the operation
   on its left plus a node:

     term  : coefficient c (a fraction), a power e on that
             coefficient (2³), a sign s used only when e > 1,
             and the powers of x and y.
     group : an optional factor term and a list of items
             inside parentheses, e.g. 3(x + 2).

   Operations are "+", "-", "×", "÷". The first item of a list
   is "+" (not shown) or "-".

   The stage draws every node as a tile. A tile is dragged
   either with the operation on its left, or alone while the
   operations stay where they are. Distribute and Combine run
   as step-by-step animations, paced by the delay slider.
   ============================================================ */

(function () {
    "use strict";

    /* CORE START */

    var MINUS = "−";
    var nextId = 1;
    function uid() { return nextId++; }

    /* ============================================================
       Fraction math
       ============================================================ */

    function gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b) {
            var t = b;
            b = a % b;
            a = t;
        }
        return a || 1;
    }

    function frac(n, d) {
        if (d === undefined) { d = 1; }
        if (d < 0) {
            n = -n;
            d = -d;
        }
        var g = gcd(n, d);
        return { n: n / g + 0, d: d / g };
    }

    function fAdd(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
    function fMul(a, b) { return frac(a.n * b.n, a.d * b.d); }
    function fDiv(a, b) { return frac(a.n * b.d, a.d * b.n); }
    function fNeg(a) { return frac(-a.n, a.d); }
    function fAbs(a) { return frac(Math.abs(a.n), a.d); }
    function fIsOne(a) { return a.n === 1 && a.d === 1; }
    function fText(a) { return a.d === 1 ? String(a.n) : a.n + "/" + a.d; }

    function fPow(a, e) {
        var r = frac(1);
        for (var i = 0; i < e; i++) { r = fMul(r, a); }
        return r;
    }

    /* "2.5" -> 5/2 */
    function numFrac(s) {
        var parts = s.split(".");
        var decimals = parts[1] || "";
        return frac(parseInt(parts[0] + decimals || "0", 10), Math.pow(10, decimals.length));
    }

    /* ============================================================
       Terms, groups and items
       ============================================================ */

    function makeTerm(c, e, v, s) {
        var t = {
            id: uid(),
            kind: "term",
            c: c,
            e: e === undefined ? 1 : e,
            s: s || 1,
            v: { x: (v && v.x) || 0, y: (v && v.y) || 0 }
        };
        /* With no power on the number, the sign lives in c. */
        if (t.e === 1 && t.s < 0) {
            t.c = fNeg(t.c);
            t.s = 1;
        }
        return t;
    }

    function one() { return makeTerm(frac(1)); }

    /* The coefficient with its power and sign applied. */
    function value(t) {
        var r = fPow(t.c, t.e);
        return t.s < 0 ? fNeg(r) : r;
    }

    function hasVars(t) { return t.v.x > 0 || t.v.y > 0; }
    function sig(t) { return "x" + t.v.x + "y" + t.v.y; }
    function isNegTerm(t) { return value(t).n < 0; }
    function negTerm(t) { return makeTerm(t.c, t.e, t.v, -t.s); }
    function absTerm(t) { return isNegTerm(t) ? negTerm(t) : t; }
    function isPlainOne(t) { return !hasVars(t) && fIsOne(value(t)); }

    function mulTerms(a, b) {
        return makeTerm(fMul(value(a), value(b)), 1, { x: a.v.x + b.v.x, y: a.v.y + b.v.y });
    }

    /* A factor of exactly 1 is the same as no factor. */
    function makeGroup(factor, items) {
        if (factor && isPlainOne(factor)) { factor = null; }
        return { id: uid(), kind: "group", factor: factor, items: items };
    }

    function makeItem(op, node) { return { id: uid(), op: op, node: node }; }

    function isAdd(op) { return op === "+" || op === "-"; }

    /* A solo item is a whole piece being added or subtracted,
       not one factor of a product like 2 × 3. */
    function isSolo(items, i) {
        return isAdd(items[i].op) && (i + 1 >= items.length || isAdd(items[i + 1].op));
    }

    function negNode(n) {
        if (n.kind === "term") { return negTerm(n); }
        return makeGroup(negTerm(n.factor || one()), n.items);
    }

    /* The node with the sign of its operation folded in. */
    function signedNode(it) { return it.op === "-" ? negNode(it.node) : it.node; }

    /* ============================================================
       Parsing typed text
       ============================================================ */

    function tokenize(src) {
        var tokens = [];
        var i = 0;
        src = src.replace(/\s+/g, "");
        while (i < src.length) {
            var ch = src[i];
            var num = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
            if (num) {
                tokens.push({ t: "num", s: num[0] });
                i += num[0].length;
                continue;
            }
            if (/[xy]/i.test(ch))               { tokens.push({ t: "var", s: ch.toLowerCase() }); }
            else if (ch === "+")                { tokens.push({ t: "op", s: "+" }); }
            else if (/[-−–]/.test(ch)) { tokens.push({ t: "op", s: "-" }); }
            else if (/[*×·]/.test(ch))          { tokens.push({ t: "op", s: "×" }); }
            else if (/[÷:]/.test(ch))           { tokens.push({ t: "op", s: "÷" }); }
            else if (ch === "/")                { tokens.push({ t: "slash" }); }
            else if (ch === "^")                { tokens.push({ t: "pow" }); }
            else if (ch === "(" || ch === "[")  { tokens.push({ t: "lpar" }); }
            else if (ch === ")" || ch === "]")  { tokens.push({ t: "rpar" }); }
            else { throw new Error("I don't know the symbol “" + ch + "”."); }
            i++;
        }
        return tokens;
    }

    function parse(src) {
        var toks = tokenize(src);
        var pos = 0;

        function peek(type) { return toks[pos] && (!type || toks[pos].t === type) ? toks[pos] : null; }
        function next() { return toks[pos++]; }

        if (!toks.length) { throw new Error("Type an expression first."); }

        function readExp() {
            var t = next();
            if (!t || t.t !== "num" || t.s.indexOf(".") >= 0) {
                throw new Error("A power needs a whole number after ^, like x^2.");
            }
            var p = parseInt(t.s, 10);
            if (p > 9) { throw new Error("Keep powers at 9 or less."); }
            return p;
        }

        function parseTerm() {
            var c = frac(1);
            var e = 1;
            var v = { x: 0, y: 0 };
            if (peek("num")) {
                c = numFrac(next().s);
                if (peek("slash")) {
                    next();
                    if (!peek("num")) { throw new Error("A fraction needs a number under the bar, like 3/4."); }
                    var den = numFrac(next().s);
                    if (den.n === 0) { throw new Error("A fraction can't have 0 on the bottom."); }
                    c = fDiv(c, den);
                }
                if (peek("pow")) {
                    next();
                    e = readExp();
                }
            }
            while (peek("var")) {
                var name = next().s;
                var p = 1;
                if (peek("pow")) {
                    next();
                    p = readExp();
                }
                v[name] += p;
            }
            if (peek("slash")) { throw new Error("Write fractions as number/number, like 3/4x."); }
            return makeTerm(c, e, v);
        }

        function parseOperand(sign) {
            var term = null;
            if (peek("num") || peek("var")) { term = parseTerm(); }
            if (peek("lpar")) {
                next();
                var inner = parseList();
                if (!peek("rpar")) { throw new Error("A “(” is missing its “)”."); }
                next();
                if (peek("pow")) { throw new Error("Powers on parentheses aren't supported. Put the power on a term."); }
                if (peek("lpar")) { throw new Error("Only one set of parentheses per factor. Put × between them."); }
                if (peek("num") || peek("var")) { throw new Error("Put an operation after “)”."); }
                var factor = term;
                if (sign < 0) { factor = factor ? negTerm(factor) : makeTerm(frac(-1)); }
                return makeGroup(factor, inner);
            }
            if (!term) {
                if (!peek()) { throw new Error("The expression ends with an operation. Finish it with a number."); }
                if (peek("rpar")) { throw new Error("Something is missing before “)”."); }
                throw new Error("Two operations are next to each other.");
            }
            return sign < 0 ? negTerm(term) : term;
        }

        function parseList() {
            var items = [];
            while (true) {
                var op = "+";
                var tk = peek();
                if (items.length) {
                    if (!tk || tk.t === "rpar") { break; }
                    if (tk.t !== "op") { throw new Error("An operation is missing between two terms."); }
                    op = next().s;
                } else if (tk && tk.t === "op") {
                    if (!isAdd(tk.s)) { throw new Error("An expression can't start with " + tk.s + "."); }
                    op = next().s;
                }
                /* one sign after an operation: 3 × -2 */
                var sign = 1;
                if (peek("op") && isAdd(peek().s)) {
                    if (next().s === "-") { sign = -1; }
                }
                items.push(makeItem(op, parseOperand(sign)));
            }
            if (!items.length) { throw new Error("There's nothing inside the parentheses."); }
            return items;
        }

        var items = parseList();
        if (pos < toks.length) { throw new Error("There's an extra “)”."); }
        return items;
    }

    /* ============================================================
       Values and text
       ============================================================ */

    function nodeHasVars(n) {
        if (n.kind === "term") { return hasVars(n); }
        return (n.factor && hasVars(n.factor)) || listHasVars(n.items);
    }

    function listHasVars(items) {
        return items.some(function (it) { return nodeHasVars(it.node); });
    }

    function evalNode(n) {
        if (n.kind === "term") { return value(n); }
        var inner = evalList(n.items);
        if (inner === null) { return null; }
        return n.factor ? fMul(value(n.factor), inner) : inner;
    }

    /* Order of operations: × and ÷ first (left to right), then + and −.
       Returns null when something is divided by zero. */
    function evalList(items) {
        var total = frac(0);
        var chunk = null;
        var neg = false;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            var v = evalNode(it.node);
            if (v === null) { return null; }
            if (isAdd(it.op) || chunk === null) {
                if (chunk !== null) { total = fAdd(total, neg ? fNeg(chunk) : chunk); }
                chunk = v;
                neg = it.op === "-";
            } else if (it.op === "×") {
                chunk = fMul(chunk, v);
            } else {
                if (v.n === 0) { return null; }
                chunk = fDiv(chunk, v);
            }
        }
        return fAdd(total, neg ? fNeg(chunk) : chunk);
    }

    function termText(t) {
        var c = fAbs(t.c);
        var out = isNegTerm(t) ? "-" : "";
        if (!hasVars(t) || !fIsOne(c) || t.e !== 1) {
            out += fText(c);
            if (t.e !== 1) { out += "^" + t.e; }
        }
        ["x", "y"].forEach(function (name) {
            if (t.v[name]) { out += name + (t.v[name] > 1 ? "^" + t.v[name] : ""); }
        });
        return out;
    }

    function nodeText(n) {
        if (n.kind === "term") { return termText(n); }
        var f = "";
        if (n.factor) { f = !hasVars(n.factor) && fIsOne(fAbs(value(n.factor))) ? (isNegTerm(n.factor) ? "-" : "") : termText(n.factor); }
        return f + "(" + listText(n.items) + ")";
    }

    /* Text the parser can read back. */
    function listText(items) {
        return items.map(function (it, i) {
            var body = nodeText(it.node);
            if (i === 0) { return (it.op === "-" ? "-" : it.op === "+" ? "" : it.op + " ") + body; }
            return " " + it.op + " " + body;
        }).join("");
    }

    /* ============================================================
       Distributing and combining (pure: they only plan or rebuild lists)
       ============================================================ */

    /* What distributing list[idx] (a group) gives. Nothing is changed. */
    function planDistribute(list, idx) {
        var it = list[idx];
        var g = it.node;
        /* Part of a product (2 × 3(x + 1)): the parentheses have to stay. */
        var keep = !isSolo(list, idx);
        var F = g.factor || one();
        var signMerged = false;
        if (!keep && it.op === "-") {
            F = negTerm(F);
            signMerged = true;
        }
        var steps = [];
        var inner = g.items.map(function (child, j) {
            if (!isAdd(child.op)) { return child; }     /* later factor of a product: untouched */
            var b = signedNode(child);
            var product = b.kind === "term"
                ? mulTerms(F, b)
                : makeGroup(mulTerms(F, b.factor || one()), b.items);
            var neg = product.kind === "term" ? isNegTerm(product) : (product.factor && isNegTerm(product.factor));
            var result = makeItem(neg ? "-" : "+", neg ? negNode(product) : product);
            steps.push({ j: j, a: F, b: b, result: result });
            return result;
        });
        return { F: F, keep: keep, signMerged: signMerged, inner: inner, steps: steps };
    }

    function applyDistribute(list, idx, plan) {
        if (plan.keep) {
            list[idx] = makeItem(list[idx].op, makeGroup(null, plan.inner));
        } else {
            Array.prototype.splice.apply(list, [idx, 1].concat(plan.inner));
        }
    }

    /* Index sets of like terms (2 or more) that can be combined in one list. */
    function likeSets(items) {
        var bySig = {};
        var order = [];
        items.forEach(function (it, i) {
            if (it.node.kind !== "term" || !isSolo(items, i)) { return; }
            var k = sig(it.node);
            if (!bySig[k]) {
                bySig[k] = [];
                order.push(k);
            }
            bySig[k].push(i);
        });
        return order.map(function (k) { return bySig[k]; }).filter(function (s) { return s.length > 1; });
    }

    /* First list (outside in) that has like terms. */
    function findLikeSet(items) {
        var sets = likeSets(items);
        if (sets.length) { return { list: items, idxs: sets[0] }; }
        for (var i = 0; i < items.length; i++) {
            if (items[i].node.kind === "group") {
                var found = findLikeSet(items[i].node.items);
                if (found) { return found; }
            }
        }
        return null;
    }

    /* Replace list[idxs] with their sum, placed where the first one was. */
    function combineAt(list, idxs) {
        var sum = frac(0);
        idxs.forEach(function (i) { sum = fAdd(sum, value(signedNode(list[i]))); });
        var result = null;
        if (sum.n !== 0) {
            result = makeItem(sum.n < 0 ? "-" : "+", makeTerm(fAbs(sum), 1, list[idxs[0]].node.v));
            result.node.id = list[idxs[0]].node.id;     /* so the tile slides instead of popping */
        }
        var out = [];
        list.forEach(function (it, i) {
            if (i === idxs[0]) {
                if (result) { out.push(result); }
            } else if (idxs.indexOf(i) < 0) {
                out.push(it);
            }
        });
        if (!out.length) { out.push(makeItem("+", makeTerm(frac(0)))); }
        Array.prototype.splice.apply(list, [0, list.length].concat(out));
        return result;
    }

    /* ============================================================
       Random expressions
       ============================================================ */

    function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
    function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = rnd(0, i);
            var t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
        return arr;
    }

    /* opts: { terms: 3–8, vars: 0|1|2, maxPow: 1|4, parens: bool } */
    function generate(opts) {
        var n = opts.terms;
        var sigs = [{ x: 0, y: 0 }];

        if (opts.vars > 0) {
            var all = [{ x: 0, y: 0 }];
            for (var p = 1; p <= opts.maxPow; p++) {
                all.push({ x: p, y: 0 });
                if (opts.vars === 2) { all.push({ x: 0, y: p }); }
            }
            if (opts.vars === 2) {
                all.push({ x: 1, y: 1 });
                if (opts.maxPow > 1) { all.push({ x: 2, y: 1 }, { x: 1, y: 2 }); }
            }
            shuffle(all);
            /* A small pool of monomials, so like terms show up. */
            var size = Math.max(2, Math.min(all.length, Math.ceil(n / 2)));
            sigs = [{ x: 1, y: 0 }];
            if (opts.vars === 2) { sigs.push({ x: 0, y: 1 }); }
            all.forEach(function (s) {
                if (sigs.length < size && !sigs.some(function (q) { return q.x === s.x && q.y === s.y; })) { sigs.push(s); }
            });
        }

        function randTerm() {
            if (opts.vars === 0) {
                if (opts.maxPow > 1 && Math.random() < 0.3) { return makeTerm(frac(rnd(2, 5)), rnd(2, opts.maxPow)); }
                return makeTerm(frac(rnd(1, 12)));
            }
            return makeTerm(frac(rnd(1, 9)), 1, pick(sigs));
        }

        function randOp() {
            if (opts.vars === 0) { return pick(["+", "+", "-", "-", "×", "÷"]); }
            return pick(["+", "-"]);
        }

        var gStart = -1;
        var gLen = 0;
        if (opts.parens && n >= 3) {
            gLen = rnd(2, Math.min(3, n - 1));
            gStart = rnd(0, n - gLen);
        }

        var items = [];
        var i = 0;
        while (i < n) {
            var op = items.length ? randOp() : (Math.random() < 0.15 ? "-" : "+");
            if (i === gStart) {
                var inner = [];
                for (var k = 0; k < gLen; k++) {
                    inner.push(makeItem(k === 0 ? "+" : pick(["+", "-"]), randTerm()));
                }
                var factor = makeTerm(frac(rnd(2, 6)), 1, opts.vars > 0 && Math.random() < 0.3 ? { x: 1 } : null);
                if (!items.length && Math.random() < 0.3) { factor = negTerm(factor); }
                items.push(makeItem(isAdd(op) ? op : "+", makeGroup(factor, inner)));
                i += gLen;
            } else {
                /* nothing multiplies a group from behind, so it can be distributed */
                if (!isAdd(op) && items.length && items[items.length - 1].node.kind === "group") { op = "+"; }
                items.push(makeItem(op, randTerm()));
                i++;
            }
        }
        return items;
    }

    /* CORE END */

    /* ============================================================
       Elements and state
       ============================================================ */

    var el = {
        form:      document.getElementById("exprForm"),
        input:     document.getElementById("exprInput"),
        keypad:    document.getElementById("keypad"),
        backspace: document.getElementById("backspaceKey"),
        clearKey:  document.getElementById("clearKey"),
        parseMsg:  document.getElementById("parseMsg"),

        genTerms:  document.getElementById("genTerms"),
        genVars:   document.getElementById("genVars"),
        genPowers: document.getElementById("genPowers"),
        genParens: document.getElementById("genParens"),
        generate:  document.getElementById("generateBtn"),

        dragMode:  document.getElementById("dragMode"),
        delay:     document.getElementById("delay"),
        delayOut:  document.getElementById("delayOut"),
        colorLike: document.getElementById("colorLike"),

        distribute: document.getElementById("distributeBtn"),
        combineAll: document.getElementById("combineAllBtn"),
        pickTerms:  document.getElementById("pickTermsBtn"),
        combineSel: document.getElementById("combineSelBtn"),
        cancel:     document.getElementById("cancelBtn"),
        skip:       document.getElementById("skipBtn"),
        undo:       document.getElementById("undoBtn"),
        reset:      document.getElementById("resetBtn"),

        stage:     document.getElementById("stage"),
        arcs:      document.getElementById("arcs"),
        expr:      document.getElementById("expr"),
        narration: document.getElementById("narration")
    };

    var state = {
        items: [],
        original: "[]",
        history: [],
        mode: "idle",          /* idle | pick-group | pick-terms */
        busy: false,
        selected: [],          /* node ids picked for Combine selected */
        highlight: [],         /* node ids glowing during a step */
        fresh: [],             /* node ids that just appeared */
        dragMode: "attached",  /* attached | number */
        delay: 1500,
        colorLike: true
    };

    var DEFAULT_EXPR = "3(x + 2) - 2x + 5 - x^2 + 4x^2";

    /* ============================================================
       Drawing
       ============================================================ */

    function fracHTML(c) {
        if (c.d === 1) { return String(c.n); }
        return '<span class="fr"><span>' + c.n + "</span><span>" + c.d + "</span></span>";
    }

    function termHTML(t) {
        var c = fAbs(t.c);
        var out = isNegTerm(t) ? MINUS : "";
        if (!hasVars(t) || !fIsOne(c) || t.e !== 1) {
            out += fracHTML(c);
            if (t.e !== 1) { out += "<sup>" + t.e + "</sup>"; }
        }
        ["x", "y"].forEach(function (name) {
            if (t.v[name]) { out += "<i>" + name + "</i>" + (t.v[name] > 1 ? "<sup>" + t.v[name] + "</sup>" : ""); }
        });
        return out;
    }

    /* -1 in front of parentheses is shown as just "−". */
    function factorHTML(f) {
        if (!hasVars(f) && fIsOne(fAbs(value(f)))) { return isNegTerm(f) ? MINUS : ""; }
        return termHTML(f);
    }

    function wrapNeg(html, neg) { return neg ? "(" + html + ")" : html; }

    /* A node as plain HTML (no tiles), for "3 · (x + 2)" pills. */
    function nodeHTML(n) {
        if (n.kind === "term") { return termHTML(n); }
        return (n.factor ? factorHTML(n.factor) : "") + "(" + pretty(listText(n.items)) + ")";
    }

    function pretty(text) {
        return text.replace(/-/g, MINUS).replace(/\^(\d)/g, "<sup>$1</sup>");
    }

    function opLabel(op, i) {
        if (i === 0) { return op === "+" ? "" : op === "-" ? MINUS : op; }
        return op === "-" ? MINUS : op;
    }

    function span(cls, html) {
        var s = document.createElement("span");
        s.className = cls;
        s.innerHTML = html;
        return s;
    }

    /* Like terms that can actually be combined get the same color. */
    function likeColors() {
        var colors = {};
        var bySig = {};
        var count = 0;
        (function walk(items) {
            likeSets(items).forEach(function (set) {
                var k = sig(items[set[0]].node);
                if (bySig[k] === undefined) { bySig[k] = count++ % 6; }
                set.forEach(function (i) { colors[items[i].node.id] = bySig[k]; });
            });
            items.forEach(function (it) { if (it.node.kind === "group") { walk(it.node.items); } });
        })(state.items);
        return colors;
    }

    function renderList(items, group, colors) {
        var row = document.createElement("div");
        row.className = "row";
        row.dataset.list = group ? group.id : "root";
        var anim = group && group.anim;
        var list = anim ? anim.inner : items;
        var showFirst = anim && (anim.parensLeaving || anim.parensGone);

        list.forEach(function (it, i) {
            var opTxt = opLabel(it.op, showFirst ? 1 : i);
            var opUsed = it.node.anim && it.node.anim.opUsed;
            if (state.dragMode === "number") {
                if (opTxt) {
                    var chip = span("op-chip", opTxt);
                    if (opUsed) { chip.classList.add(opUsed); }
                    row.appendChild(chip);
                }
                row.appendChild(nodeTile(it, i, "", colors));
            } else {
                row.appendChild(nodeTile(it, i, opTxt, colors));
            }
        });
        return row;
    }

    function nodeTile(it, i, opTxt, colors) {
        var n = it.node;
        var tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.key = n.id;
        tile.tabIndex = n.kind === "pill" ? -1 : 0;

        if (opTxt) {
            var op = span("op", opTxt);
            if (n.anim && n.anim.opUsed) { op.classList.add(n.anim.opUsed); }
            tile.appendChild(op);
        }

        if (n.kind === "pill") {
            tile.classList.add("pill");
            tile.appendChild(span("body",
                wrapNeg(termHTML(n.a), isNegTerm(n.a)) +
                '<span class="dot">·</span>' +
                wrapNeg(nodeHTML(n.b), n.b.kind === "term" && isNegTerm(n.b))));
        } else if (n.kind === "term") {
            tile.appendChild(span("body", wrapNeg(termHTML(n), i > 0 && isNegTerm(n))));
            tile.setAttribute("aria-label", opTxt + " " + termText(n));
            if (colors[n.id] !== undefined) { tile.classList.add("like-" + colors[n.id]); }
        } else {
            groupTile(tile, n, colors);
        }

        if (state.selected.indexOf(n.id) >= 0) { tile.classList.add("selected"); }
        if (state.highlight.indexOf(n.id) >= 0) { tile.classList.add("hl"); }
        if (state.fresh.indexOf(n.id) >= 0) { tile.classList.add("flash"); }
        return tile;
    }

    function groupTile(tile, g, colors) {
        var a = g.anim || {};
        tile.classList.add("group");
        tile.setAttribute("aria-label", "Parentheses " + nodeText(g));

        if (g.factor && !a.factorGone) {
            var f = span("factor", factorHTML(g.factor));
            if (a.factorState) { f.classList.add(a.factorState); }
            f.dataset.arcFrom = "";
            tile.appendChild(f);
        }
        if (!a.parensGone) {
            var lp = span("paren", "(");
            if (a.parensLeaving) { lp.classList.add("leave"); }
            if (!g.factor) { lp.dataset.arcFrom = ""; }
            tile.appendChild(lp);
        }
        tile.appendChild(renderList(g.items, g, colors));
        if (!a.parensGone) {
            var rp = span("paren", ")");
            if (a.parensLeaving) { rp.classList.add("leave"); }
            tile.appendChild(rp);
        }
    }

    /* Redraw, sliding tiles that kept their id from where they were.
       `from` can override a start position (the drag ghost). */
    function render(from) {
        var before = {};
        el.expr.querySelectorAll("[data-key]").forEach(function (node) {
            before[node.dataset.key] = node.getBoundingClientRect();
        });
        if (from) { before[from.key] = from.rect; }

        el.expr.innerHTML = "";
        clearArcs();
        var row = renderList(state.items, null, state.colorLike ? likeColors() : {});
        if (state.items.length && !listHasVars(state.items)) {
            var v = evalList(state.items);
            row.appendChild(span("equals", "= " + (v === null ? "undefined" : (v.n < 0 ? MINUS : "") + fracHTML(fAbs(v)))));
        }
        el.expr.appendChild(row);

        var moved = [];
        el.expr.querySelectorAll("[data-key]").forEach(function (node) {
            var b = before[node.dataset.key];
            if (!b) { return; }
            var parentTile = node.parentElement.closest("[data-key]");
            if (parentTile && moved.indexOf(parentTile) >= 0) { return; }
            var r = node.getBoundingClientRect();
            var dx = b.left - r.left;
            var dy = b.top - r.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { return; }
            moved.push(node);
            node.animate(
                [{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }],
                { duration: 350, easing: "cubic-bezier(.2,.8,.2,1)" });
        });

        el.stage.classList.toggle("pick-group", state.mode === "pick-group");
        el.stage.classList.toggle("pick-terms", state.mode === "pick-terms");
        updateButtons();
    }

    function clearArcs() {
        el.arcs.querySelectorAll(".arc").forEach(function (p) { p.remove(); });
    }

    /* Curved arrow from the factor of a group to one of its pills. */
    function drawArc(groupId, pillId) {
        var g = el.expr.querySelector('[data-key="' + groupId + '"]');
        var to = el.expr.querySelector('[data-key="' + pillId + '"]');
        var fromEl = g && g.querySelector("[data-arc-from]");
        if (!fromEl || !to) { return; }
        var box = el.stage.getBoundingClientRect();
        var a = fromEl.getBoundingClientRect();
        var b = to.getBoundingClientRect();
        var x1 = a.left + a.width / 2 - box.left;
        var y1 = a.top - box.top;
        var x2 = b.left + b.width / 2 - box.left;
        var y2 = b.top - box.top - 4;
        var lift = Math.min(60, Math.max(30, Math.abs(x2 - x1) / 3));
        var top = Math.min(y1, y2) - lift;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", "arc");
        path.setAttribute("d", "M" + x1 + "," + y1 + " C" + x1 + "," + top + " " + x2 + "," + top + " " + x2 + "," + y2);
        path.setAttribute("marker-end", "url(#arrowHead)");
        el.arcs.appendChild(path);
    }

    function say(html, warn) {
        el.narration.innerHTML = html;
        el.narration.classList.toggle("warn", !!warn);
    }

    function updateButtons() {
        var idle = !state.busy && state.mode === "idle";
        el.distribute.disabled = !idle && state.mode !== "pick-group";
        el.combineAll.disabled = !idle;
        el.pickTerms.disabled = !idle && state.mode !== "pick-terms";
        el.distribute.classList.toggle("active", state.mode === "pick-group");
        el.pickTerms.classList.toggle("active", state.mode === "pick-terms");
        el.combineSel.hidden = state.mode !== "pick-terms";
        el.combineSel.disabled = state.selected.length < 2;
        el.combineSel.textContent = "Combine selected (" + state.selected.length + ")";
        el.cancel.hidden = state.mode === "idle";
        el.skip.hidden = !state.busy;
        el.undo.disabled = !idle || !state.history.length;
        el.reset.disabled = !idle;
        el.generate.disabled = state.busy;
        el.form.querySelector("[type=submit]").disabled = state.busy;
    }

    /* ============================================================
       History
       ============================================================ */

    function pushHistory() {
        state.history.push(JSON.stringify(state.items));
        if (state.history.length > 100) { state.history.shift(); }
    }

    function loadItems(items, message) {
        state.items = items;
        state.original = JSON.stringify(items);
        state.history = [];
        state.mode = "idle";
        state.selected = [];
        state.fresh = [];
        render();
        say(message || "Drag a tile to move it. Use the buttons above to distribute or combine like terms.");
    }

    /* ============================================================
       Finding things in the tree
       ============================================================ */

    /* { list, index } of the item whose node has this id. */
    function locate(id, items) {
        items = items || state.items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].node.id === id) { return { list: items, index: i }; }
            if (items[i].node.kind === "group") {
                var found = locate(id, items[i].node.items);
                if (found) { return found; }
            }
        }
        return null;
    }

    function listById(key) {
        if (key === "root") { return state.items; }
        var loc = locate(Number(key));
        return loc ? loc.list[loc.index].node.items : null;
    }

    function hasGroups(items) {
        return items.some(function (it) { return it.node.kind === "group"; });
    }

    function plainList(items) { return pretty(listText(items)); }

    function plainNode(n) { return pretty(nodeText(n)); }

    /* ============================================================
       Step timing
       ============================================================ */

    var skipping = false;
    var wakeUp = null;

    function pause(ms) {
        if (skipping || state.delay === 0) { return Promise.resolve(); }
        return new Promise(function (resolve) {
            var timer = setTimeout(done, ms || state.delay);
            function done() {
                clearTimeout(timer);
                wakeUp = null;
                resolve();
            }
            wakeUp = done;
        });
    }

    function startBusy() {
        state.busy = true;
        skipping = false;
        updateButtons();
    }

    function endBusy() {
        state.busy = false;
        state.highlight = [];
        updateButtons();
    }

    /* ============================================================
       Distribute
       ============================================================ */

    async function runDistribute(groupId) {
        var loc = locate(groupId);
        var list = loc.list;
        var idx = loc.index;
        var it = list[idx];
        var g = it.node;
        var plan = planDistribute(list, idx);
        var trivial = isPlainOne(plan.F);
        var animate = state.delay > 0;
        var Ftxt = plainNode(plan.F);

        pushHistory();
        startBusy();

        if (animate) {
            g.anim = { inner: g.items.slice(), factorState: "hot" };
            if (trivial) {
                say("Nothing multiplies these parentheses, so they can simply be removed.");
            } else if (plan.signMerged) {
                say("The " + MINUS + " in front belongs to the factor, so we distribute <b>" + Ftxt +
                    "</b> to every term inside.");
            } else {
                say("Distribute <b>" + Ftxt + "</b>: multiply it by every term inside the parentheses.");
            }
            render();
            await pause();

            if (!trivial) {
                for (var k = 0; k < plan.steps.length; k++) {
                    var step = plan.steps[k];
                    var shown = g.anim.inner.slice();
                    var pill = makeItem("+", { id: uid(), kind: "pill", a: step.a, b: step.b });
                    shown[step.j] = pill;
                    g.anim = { inner: shown, factorState: "hot" };
                    say("Step " + (k + 1) + " of " + plan.steps.length + ": " +
                        wrapNeg(Ftxt, isNegTerm(plan.F)) + " · " +
                        wrapNeg(plainNode(step.b), step.b.kind === "term" && isNegTerm(step.b)) + " = " +
                        plainNode(signedNode(step.result)));
                    render();
                    drawArc(g.id, pill.node.id);
                    await pause();

                    shown = shown.slice();
                    shown[step.j] = step.result;
                    state.fresh = [step.result.node.id];
                    g.anim = { inner: shown, factorState: "hot" };
                    render();
                    await pause();
                }
            }
            state.fresh = [];

            var used = !trivial ? "used" : null;
            var opUsed = plan.signMerged ? "used" : null;
            if (!plan.keep) {
                g.anim = { inner: plan.inner, factorState: used, opUsed: opUsed, parensLeaving: true };
                say("Every term has been multiplied, so the parentheses come off.");
                render();
                await pause();
            } else {
                say("The parentheses stay: this group is part of a product (× or ÷ next to it).");
            }

            if (g.factor || plan.signMerged) {
                g.anim = {
                    inner: plan.inner, factorState: "leave", opUsed: opUsed ? "leave" : null,
                    parensGone: !plan.keep
                };
                say("The factor " + Ftxt + " has been used up, so it goes away too.");
                render();
                await pause();
            }
        }

        g.anim = null;
        applyDistribute(list, idx, plan);
        endBusy();
        render();
        say("Distributed: " + plainList(state.items));
    }

    /* ============================================================
       Combine like terms
       ============================================================ */

    async function combineStep(list, idxs) {
        var ids = idxs.map(function (i) { return list[i].node.id; });
        var parts = idxs.map(function (i, k) {
            var s = plainNode(signedNode(list[i]));
            if (k === 0) { return s; }
            return s.charAt(0) === MINUS ? " " + MINUS + " " + s.slice(1) : " + " + s;
        }).join("");

        if (state.delay > 0) {
            state.highlight = ids;
            say("Like terms (same variables, same powers): " + parts);
            render();
            await pause();
        }

        var result = combineAt(list, idxs);
        state.highlight = [];
        state.fresh = result ? [result.node.id] : [];
        render();
        say(parts + " = " + (result ? plainNode(signedNode(result)) : "0"));
        state.fresh = [];
    }

    async function runCombineAll() {
        if (!findLikeSet(state.items)) {
            say("There are no like terms to combine." +
                (hasGroups(state.items) ? " Try distributing the parentheses first." : ""), true);
            return;
        }
        pushHistory();
        startBusy();
        var found;
        while ((found = findLikeSet(state.items))) {
            await combineStep(found.list, found.idxs);
            if (findLikeSet(state.items)) { await pause(); }
        }
        endBusy();
        render();
        say("All like terms combined: " + plainList(state.items));
    }

    /* Check the picked terms, then combine them. */
    async function runCombineSelected() {
        var locs = state.selected.map(function (id) { return locate(id); });
        var list = locs[0].list;
        var warn = null;

        if (locs.some(function (l) { return l.list !== list; })) {
            warn = "Those terms aren't in the same place: one is inside parentheses. Distribute first.";
        } else {
            locs.forEach(function (l) {
                if (!warn && !isSolo(l.list, l.index)) {
                    warn = plainNode(l.list[l.index].node) + " is part of a product (× or ÷), so it can't be combined on its own.";
                }
            });
            var first = list[locs[0].index].node;
            locs.forEach(function (l) {
                var n = l.list[l.index].node;
                if (!warn && sig(n) !== sig(first)) {
                    warn = plainNode(absTerm(first)) + " and " + plainNode(absTerm(n)) +
                        " aren't like terms: they need the same variables with the same powers.";
                }
            });
        }

        if (warn) {
            say(warn, true);
            return;
        }

        var idxs = locs.map(function (l) { return l.index; }).sort(function (a, b) { return a - b; });
        state.mode = "idle";
        state.selected = [];
        pushHistory();
        startBusy();
        await combineStep(list, idxs);
        endBusy();
        render();
    }

    /* ============================================================
       Moving tiles
       ============================================================ */

    function valueText(items) {
        if (listHasVars(items)) { return null; }
        var v = evalList(items);
        return v === null ? "undefined" : (v.n < 0 ? MINUS : "") + fText(fAbs(v));
    }

    /* Move the tile at `from` to slot `to` in the list. Returns false if not allowed. */
    function moveTile(listKey, from, to, ghost) {
        var list = listById(listKey);
        if (!list || from === to) { return false; }
        var before = valueText(state.items);

        if (state.dragMode === "attached") {
            var moved = list.slice();
            moved.splice(to, 0, moved.splice(from, 1)[0]);
            if (!isAdd(moved[0].op)) {
                say("An expression (or the inside of parentheses) can't start with " + moved[0].op +
                    ". Try “only the number” in Settings to move just the number.", true);
                var tile = el.expr.querySelector('[data-key="' + list[from].node.id + '"]');
                if (tile) {
                    tile.classList.remove("shake");
                    void tile.offsetWidth;
                    tile.classList.add("shake");
                }
                return false;
            }
            pushHistory();
            Array.prototype.splice.apply(list, [0, list.length].concat(moved));
        } else {
            var nodes = list.map(function (it) { return it.node; });
            nodes.splice(to, 0, nodes.splice(from, 1)[0]);
            pushHistory();
            list.forEach(function (it, i) { it.node = nodes[i]; });
        }

        render(ghost);
        var after = valueText(state.items);
        if (before === null) {
            say(state.dragMode === "attached"
                ? "The term moved with its sign, so the expression means the same thing."
                : "Only the term moved. The signs stayed put, so the expression may have changed.");
        } else if (before === after) {
            say("The value is still <b>" + after + "</b>.");
        } else {
            say("The value changed from <b>" + before + "</b> to <b>" + after + "</b>.", true);
        }
        return true;
    }

    var drag = null;

    function tilesIn(row) {
        return Array.prototype.filter.call(row.children, function (c) { return c.classList.contains("tile"); });
    }

    el.expr.addEventListener("pointerdown", function (e) {
        if (state.busy || e.button !== 0) { return; }
        var tile = e.target.closest(".tile");
        if (!tile) { return; }
        drag = { tile: tile, x: e.clientX, y: e.clientY, pid: e.pointerId, moving: false };
    });

    document.addEventListener("pointermove", function (e) {
        if (!drag || e.pointerId !== drag.pid) { return; }
        if (!drag.moving) {
            if (state.mode !== "idle" || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) { return; }
            startDrag();
        }
        e.preventDefault();
        moveDrag(e);
    });

    document.addEventListener("pointerup", function (e) {
        if (!drag || e.pointerId !== drag.pid) { return; }
        var d = drag;
        drag = null;
        if (d.moving) { endDrag(d); } else { tileClick(d.tile); }
    });

    document.addEventListener("pointercancel", function () {
        if (drag && drag.moving) { cleanUpDrag(drag); }
        drag = null;
    });

    function startDrag() {
        var tile = drag.tile;
        var r = tile.getBoundingClientRect();
        drag.moving = true;
        drag.row = tile.parentElement;
        drag.siblings = tilesIn(drag.row);
        drag.from = drag.siblings.indexOf(tile);
        drag.to = drag.from;
        drag.dx = drag.x - r.left;
        drag.dy = drag.y - r.top;

        drag.ghost = tile.cloneNode(true);
        drag.ghost.classList.add("ghost");
        drag.ghost.style.fontSize = getComputedStyle(tile).fontSize;
        drag.ghost.style.width = r.width + "px";
        document.body.appendChild(drag.ghost);

        drag.caret = document.createElement("div");
        drag.caret.className = "caret";
        el.stage.appendChild(drag.caret);
        tile.classList.add("lifted");
    }

    function moveDrag(e) {
        drag.ghost.style.left = (e.clientX - drag.dx) + "px";
        drag.ghost.style.top = (e.clientY - drag.dy) + "px";

        var others = drag.siblings.filter(function (s) { return s !== drag.tile; });
        var to = others.length;
        for (var k = 0; k < others.length; k++) {
            var r = others[k].getBoundingClientRect();
            if (e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2)) {
                to = k;
                break;
            }
        }
        drag.to = to;

        var box = el.stage.getBoundingClientRect();
        var ref = others[Math.min(to, others.length - 1)] || drag.tile;
        var rr = ref.getBoundingClientRect();
        var x = to < others.length ? rr.left - 6 : rr.right + 4;
        drag.caret.style.left = (x - box.left) + "px";
        drag.caret.style.top = (rr.top - box.top) + "px";
        drag.caret.style.height = rr.height + "px";
    }

    function cleanUpDrag(d) {
        d.ghost.remove();
        d.caret.remove();
        d.tile.classList.remove("lifted");
    }

    function endDrag(d) {
        var ghostRect = d.ghost.getBoundingClientRect();
        cleanUpDrag(d);
        moveTile(d.row.dataset.list, d.from, d.to, { key: d.tile.dataset.key, rect: ghostRect });
    }

    /* Keyboard: arrow keys move the focused tile, Enter/Space clicks it. */
    el.expr.addEventListener("keydown", function (e) {
        var tile = e.target.closest(".tile");
        if (!tile || state.busy) { return; }
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            tileClick(tile);
            return;
        }
        if ((e.key !== "ArrowLeft" && e.key !== "ArrowRight") || state.mode !== "idle") { return; }
        e.preventDefault();
        var sibs = tilesIn(tile.parentElement);
        var from = sibs.indexOf(tile);
        var to = from + (e.key === "ArrowLeft" ? -1 : 1);
        if (to < 0 || to >= sibs.length) { return; }
        var key = tile.dataset.key;
        if (moveTile(tile.parentElement.dataset.list, from, to)) {
            var again = el.expr.querySelector('[data-key="' + key + '"]');
            if (again) { again.focus(); }
        }
    });

    function tileClick(tile) {
        if (state.mode === "pick-group") {
            var group = tile.closest(".group");
            if (!group) {
                say("Click on a set of parentheses.", true);
                return;
            }
            state.mode = "idle";
            runDistribute(Number(group.dataset.key));
        } else if (state.mode === "pick-terms") {
            if (tile.classList.contains("group")) {
                say("Pick single terms, not a whole set of parentheses.", true);
                return;
            }
            var id = Number(tile.dataset.key);
            var at = state.selected.indexOf(id);
            if (at >= 0) { state.selected.splice(at, 1); } else { state.selected.push(id); }
            render();
            say(state.selected.length < 2
                ? "Pick the like terms you want to combine."
                : "Press “Combine selected” when you're ready.");
        }
    }

    /* ============================================================
       Toolbar
       ============================================================ */

    el.distribute.addEventListener("click", function () {
        if (state.mode === "pick-group") {
            state.mode = "idle";
            render();
            say("");
            return;
        }
        if (!hasGroups(state.items)) {
            say("There are no parentheses to distribute.", true);
            return;
        }
        state.mode = "pick-group";
        state.selected = [];
        render();
        say("Click the parentheses you want to distribute.");
    });

    el.combineAll.addEventListener("click", runCombineAll);

    el.pickTerms.addEventListener("click", function () {
        state.mode = state.mode === "pick-terms" ? "idle" : "pick-terms";
        state.selected = [];
        render();
        say(state.mode === "pick-terms" ? "Click the like terms you want to combine." : "");
    });

    el.combineSel.addEventListener("click", runCombineSelected);

    el.cancel.addEventListener("click", function () {
        state.mode = "idle";
        state.selected = [];
        render();
        say("");
    });

    el.skip.addEventListener("click", function () {
        skipping = true;
        if (wakeUp) { wakeUp(); }
    });

    el.undo.addEventListener("click", function () {
        if (!state.history.length) { return; }
        state.items = JSON.parse(state.history.pop());
        state.fresh = [];
        render();
        say("Undone.");
    });

    el.reset.addEventListener("click", function () {
        pushHistory();
        state.items = JSON.parse(state.original);
        render();
        say("Back to the starting expression.");
    });

    /* ============================================================
       Editor and generator
       ============================================================ */

    function insertText(text) {
        var input = el.input;
        var start = input.selectionStart === null ? input.value.length : input.selectionStart;
        var end = input.selectionEnd === null ? start : input.selectionEnd;
        input.value = input.value.slice(0, start) + text + input.value.slice(end);
        input.focus();
        input.setSelectionRange(start + text.length, start + text.length);
    }

    el.keypad.addEventListener("click", function (e) {
        var key = e.target.closest("[data-insert]");
        if (key) { insertText(key.dataset.insert); }
    });

    el.backspace.addEventListener("click", function () {
        var v = el.input.value.replace(/\s+$/, "");
        el.input.value = v.slice(0, -1).replace(/\s+$/, "");
        el.input.focus();
    });

    el.clearKey.addEventListener("click", function () {
        el.input.value = "";
        el.input.focus();
    });

    function build(text, message) {
        try {
            var items = parse(text);
            el.parseMsg.classList.remove("error");
            el.parseMsg.textContent = listHasVars(items)
                ? "With variables there is no single answer, so there is no = sign."
                : "Numbers only: the answer is shown after the = sign and updates as you move tiles.";
            loadItems(items, message);
        } catch (err) {
            el.parseMsg.classList.add("error");
            el.parseMsg.textContent = err.message;
        }
    }

    el.form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!state.busy) { build(el.input.value); }
    });

    el.generate.addEventListener("click", function () {
        var items = generate({
            terms: Number(el.genTerms.value),
            vars: Number(el.genVars.value),
            maxPow: Number(el.genPowers.value),
            parens: el.genParens.checked
        });
        el.input.value = listText(items).replace(/-/g, MINUS);
        build(el.input.value);
    });

    /* ============================================================
       Settings
       ============================================================ */

    el.dragMode.addEventListener("change", function (e) {
        state.dragMode = e.target.value;
        render();
        say(state.dragMode === "attached"
            ? "Dragging now moves each term together with the sign or operation on its left."
            : "Dragging now moves only the number. The operations stay where they are.");
    });

    function showDelay() {
        state.delay = Number(el.delay.value);
        el.delayOut.textContent = state.delay === 0 ? "No delay" : (state.delay / 1000).toFixed(1) + " s";
    }
    el.delay.addEventListener("input", showDelay);

    el.colorLike.addEventListener("change", function () {
        state.colorLike = el.colorLike.checked;
        render();
    });

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && state.mode !== "idle") { el.cancel.click(); }
    });

    window.addEventListener("resize", clearArcs);

    /* ---------- start ---------- */
    showDelay();
    el.input.value = DEFAULT_EXPR.replace(/-/g, MINUS);
    build(el.input.value);
})();
