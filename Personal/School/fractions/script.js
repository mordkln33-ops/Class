/* ============================================================
   Fraction Visualizer
   ------------------------------------------------------------
   Left half  : fraction template + two-fraction calculator.
   Right half : the container, drawn one of three ways —

     bar   : one whole split into `den` equal parts (single
             fraction, and add / subtract over a common
             denominator, left unsimplified on purpose).
     grid  : `d1` columns x `d2` rows for multiply / divide.
             Columns are the first fraction, rows the second,
             and the boxed overlap is the answer.

   Calculate never touches the first fraction of the equation.
   Submit (next to the big fraction) is what simplifies and
   pushes the answer back down into the equation.
   ============================================================ */

(function () {
    "use strict";

    /* ---------- limits (keep the picture readable) ---------- */
    var MAX_DENOMINATOR = 100;
    var MAX_CELLS = 900;

    /* ---------- elements ---------- */
    var el = {
        numerator:   document.getElementById("numerator"),
        denominator: document.getElementById("denominator"),
        fractionForm: document.getElementById("fractionForm"),

        decimalOut: document.getElementById("decimalOut"),
        percentOut: document.getElementById("percentOut"),
        simpleOut:  document.getElementById("simpleOut"),

        aNum: document.getElementById("aNum"),
        aDen: document.getElementById("aDen"),
        bNum: document.getElementById("bNum"),
        bDen: document.getElementById("bDen"),
        operation: document.getElementById("operation"),
        calcForm:  document.getElementById("calcForm"),
        calcResult: document.getElementById("calcResult"),

        strips: document.getElementById("strips"),
        ovNum: document.getElementById("ovNum"),
        ovDen: document.getElementById("ovDen"),
        ovDecimal: document.getElementById("ovDecimal"),
        ovNote: document.getElementById("ovNote"),
        ovLegend: document.getElementById("ovLegend"),

        message: document.getElementById("message")
    };

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

    /* Move a negative denominator up onto the numerator. */
    function normalize(frac) {
        if (frac.d < 0) { return { n: -frac.n, d: -frac.d }; }
        return { n: frac.n, d: frac.d };
    }

    /* Reduce and keep the sign on the numerator. */
    function simplify(num, den) {
        if (den < 0) {
            num = -num;
            den = -den;
        }
        var d = gcd(num, den);
        return { n: num / d, d: den / d };
    }

    function text(frac) {
        return frac.n + "/" + frac.d;
    }

    /* A fraction terminates in decimal only if its reduced denominator
       is built from 2s and 5s — used to decide "=" versus "≈". */
    function terminates(den) {
        den = Math.abs(den);
        while (den % 2 === 0) { den /= 2; }
        while (den % 5 === 0) { den /= 5; }
        return den === 1;
    }

    function formatDecimal(num, den) {
        var value = num / den;
        if (Number.isInteger(value)) { return String(value); }

        var digits = value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
        return (terminates(den) ? "" : "≈ ") + digits;
    }

    function formatPercent(num, den) {
        var value = (num / den) * 100;
        var rounded = Math.round(value * 100) / 100;
        return (terminates(den) ? "" : "≈ ") + rounded + "%";
    }

    /* ============================================================
       Reading the inputs
       ============================================================ */

    function readInt(input) {
        var raw = input.value.trim();
        if (raw === "" || !/^-?\d+$/.test(raw)) { return null; }
        return parseInt(raw, 10);
    }

    function mark(input, ok) {
        input.classList.toggle("invalid", !ok);
    }

    /* Returns {n, d} or null; writes the reason into the message line. */
    function readFraction(numInput, denInput, label) {
        var n = readInt(numInput);
        var d = readInt(denInput);

        mark(numInput, n !== null);
        mark(denInput, d !== null && d !== 0);

        if (n === null || d === null) {
            say(label + ": please enter whole numbers.", true);
            return null;
        }
        if (d === 0) {
            say(label + ": the denominator cannot be 0 — you can't split something into zero parts.", true);
            return null;
        }
        if (Math.abs(d) > MAX_DENOMINATOR) {
            say(label + ": keep the denominator at " + MAX_DENOMINATOR +
                " or less so the parts stay visible.", true);
            return null;
        }
        return normalize({ n: n, d: d });
    }

    function say(message, isError) {
        el.message.textContent = message || "";
        el.message.classList.toggle("info", !isError);
    }

    /* ============================================================
       The overlay above the picture
       ============================================================ */

    function setOverlay(shown, note, legendItems) {
        el.ovNum.textContent = shown.n;
        el.ovDen.textContent = shown.d;
        el.ovDecimal.textContent = formatDecimal(shown.n, shown.d);
        el.ovNote.textContent = note || "";

        el.ovLegend.innerHTML = "";
        if (!legendItems || !legendItems.length) {
            el.ovLegend.hidden = true;
            return;
        }
        el.ovLegend.hidden = false;

        legendItems.forEach(function (item) {
            var row = document.createElement("span");
            row.className = "legend-item";

            var swatch = document.createElement("i");
            swatch.className = "swatch " + item.swatch;
            row.appendChild(swatch);
            row.appendChild(document.createTextNode(item.label));

            el.ovLegend.appendChild(row);
        });
    }

    /* ============================================================
       Drawing
       ============================================================ */

    function resetStage(mode) {
        el.strips.className = "strips mode-" + mode;
        el.strips.style.gridTemplateColumns = "";
        el.strips.style.gridTemplateRows = "";
        el.strips.innerHTML = "";
    }

    function cell(classes, index) {
        var box = document.createElement("div");
        box.className = classes ? "cell " + classes : "cell";
        box.style.setProperty("--i", index);
        return box;
    }

    /* How many cells a bar drawing would need — checked before drawing
       so a huge common denominator never wipes out the picture. */
    function barCellCount(den, total) {
        return Math.max(1, Math.ceil(total / den)) * den;
    }

    /* One whole cut into `den` parts, filled by a list of coloured runs.
       Runs that spill past one whole wrap onto a second row, so improper
       answers like 5/4 still read honestly. */
    function drawBar(den, runs) {
        var total = 0;
        runs.forEach(function (run) { total += run.count; });

        var rows = Math.max(1, Math.ceil(total / den));

        resetStage("bar");
        el.strips.style.gridTemplateColumns = "repeat(" + den + ", 1fr)";
        el.strips.style.gridTemplateRows = "repeat(" + rows + ", 1fr)";

        var stage = document.createDocumentFragment();
        var index = 0;

        runs.forEach(function (run) {
            for (var i = 0; i < run.count; i++) {
                stage.appendChild(cell(run.klass, index));
                index += 1;
            }
        });

        for (; index < rows * den; index++) {
            stage.appendChild(cell("", index));
        }

        el.strips.appendChild(stage);
    }

    /* `cols` columns (the first fraction) by `rows` rows (the second).
       Each little box is 1/(cols*rows) of the whole; the boxed corner
       where the two shadings overlap is the product.

       An improper fraction needs more columns (or rows) than the whole
       has, so the grid grows past one whole and the whole itself is
       outlined separately. */
    function gridSize(cols, rows, litCols, litRows) {
        return {
            cols: Math.max(cols, litCols),
            rows: Math.max(rows, litRows)
        };
    }

    function drawGrid(cols, rows, litCols, litRows, boxLabel) {
        var size = gridSize(cols, rows, litCols, litRows);

        resetStage("grid");
        el.strips.style.gridTemplateColumns = "repeat(" + size.cols + ", 1fr)";
        el.strips.style.gridTemplateRows = "repeat(" + size.rows + ", 1fr)";

        var stage = document.createDocumentFragment();

        for (var r = 0; r < size.rows; r++) {
            for (var c = 0; c < size.cols; c++) {
                var klass = "";
                if (c < litCols) { klass += " col"; }
                if (r < litRows) { klass += " row"; }
                stage.appendChild(cell(klass.trim(), r * size.cols + c));
            }
        }

        el.strips.appendChild(stage);

        /* where the grid ran past one whole, show where the whole ended */
        if (size.cols > cols || size.rows > rows) {
            var whole = document.createElement("div");
            whole.className = "whole-box";
            whole.style.width = (cols / size.cols) * 100 + "%";
            whole.style.height = (rows / size.rows) * 100 + "%";
            el.strips.appendChild(whole);
        }

        if (litCols > 0 && litRows > 0) {
            var box = document.createElement("div");
            box.className = "share-box";
            box.style.width = (litCols / size.cols) * 100 + "%";
            box.style.height = (litRows / size.rows) * 100 + "%";

            var tag = document.createElement("span");
            tag.className = "share-tag";
            tag.textContent = boxLabel;
            box.appendChild(tag);

            el.strips.appendChild(box);
        }
    }

    /* ============================================================
       Mode 1 — a single fraction, one colour, simplified or not
       ============================================================ */

    function setReadout(frac) {
        var reduced = simplify(frac.n, frac.d);
        el.decimalOut.textContent = formatDecimal(frac.n, frac.d);
        el.percentOut.textContent = formatPercent(frac.n, frac.d);
        el.simpleOut.textContent = text(reduced);
    }

    /* Writes a fraction into the big inputs + readout, without drawing. */
    function setMain(frac) {
        el.numerator.value = String(frac.n);
        el.denominator.value = String(frac.d);
        mark(el.numerator, true);
        mark(el.denominator, true);
        setReadout(frac);
    }

    function drawPlain(frac) {
        var size = Math.abs(frac.n);

        drawBar(frac.d, [{ count: size, klass: "fill-a" }]);

        var notes = [];
        if (frac.n < 0) { notes.push("negative — the picture shows the size"); }
        if (size > frac.d) { notes.push("more than one whole"); }
        else if (size === frac.d) { notes.push("exactly one whole"); }

        setOverlay(frac, notes.join(" · "), null);
    }

    function apply(frac) {
        frac = normalize(frac);
        setMain(frac);
        drawPlain(frac);
    }

    /* ============================================================
       Mode 2 — add / subtract over a common denominator
       ============================================================ */

    function showAddSub(a, b, op) {
        var den = a.d * b.d;
        var first = a.n * b.d;                                  // first fraction, common units
        var change = (op === "add" ? 1 : -1) * b.n * a.d;        // signed second fraction
        var result = { n: first + change, d: den };

        var kept = Math.abs(first);
        var runs;
        var legendItems;
        var note;

        if (change >= 0) {
            /* adding on: the original keeps its colour, the new part
               gets a related but clearly different one */
            runs = [
                { count: kept, klass: "fill-a" },
                { count: change, klass: "fill-b" }
            ];
            legendItems = [
                { swatch: "sw-a", label: text({ n: first, d: den }) + "  (started with)" },
                { swatch: "sw-b", label: text({ n: change, d: den }) + "  (added on)" }
            ];
            note = text({ n: first, d: den }) + " + " + text({ n: change, d: den }) +
                   " = " + text(result);
        } else {
            /* taking away: what leaves turns red */
            var removed = -change;
            var stays = Math.max(kept - removed, 0);
            var short = Math.max(removed - kept, 0);

            runs = [
                { count: stays, klass: "fill-a" },
                { count: Math.min(removed, kept), klass: "fill-remove" },
                { count: short, klass: "fill-short" }
            ];
            legendItems = [
                { swatch: "sw-a", label: text({ n: stays, d: den }) + "  (left over)" },
                { swatch: "sw-remove", label: text({ n: removed, d: den }) + "  (taken away)" }
            ];
            if (short > 0) {
                legendItems.push({
                    swatch: "sw-short", label: text({ n: short, d: den }) + "  (past zero)"
                });
            }
            note = text({ n: first, d: den }) + " − " + text({ n: removed, d: den }) +
                   " = " + text(result);
        }

        var total = 0;
        runs.forEach(function (run) { total += run.count; });

        if (barCellCount(den, total) > MAX_CELLS) {
            say("Over a common denominator that is " + den +
                " parts — too many to draw. Try smaller denominators.", true);
            el.calcResult.textContent = text(simplify(result.n, result.d));
            return;
        }

        drawBar(den, runs);
        setOverlay(result, note, legendItems);

        /* the big fraction takes the unsimplified answer; Submit is what
           simplifies it and feeds it back into the equation */
        setMain(result);
        el.calcResult.textContent = text(result);

        var reduced = simplify(result.n, result.d);
        var tail = (reduced.d === result.d && reduced.n === result.n)
            ? " Already in lowest terms."
            : " Press Submit next to the big fraction to simplify it to " +
              text(reduced) + ".";

        say(text(a) + (op === "add" ? " + " : " − ") + text(b) + " = " +
            text(result) + "." + tail, false);
    }

    /* ============================================================
       Mode 3 — multiply (and divide, once the second one is flipped)
       ============================================================ */

    function showMultiply(a, b, prefix) {
        var cols = a.d;
        var rows = b.d;
        var litCols = Math.abs(a.n);
        var litRows = Math.abs(b.n);

        var product = { n: a.n * b.n, d: cols * rows };
        var reduced = simplify(product.n, product.d);

        var size = gridSize(cols, rows, litCols, litRows);

        if (size.cols * size.rows > MAX_CELLS) {
            say("That grid would be " + size.cols + " × " + size.rows +
                " boxes — too many to draw. Try smaller numbers.", true);
            el.calcResult.textContent = text(reduced);
            return;
        }

        drawGrid(cols, rows, litCols, litRows, text(product));

        var notes = [];
        notes.push(text({ n: litCols, d: cols }) + " of the columns × " +
                   text({ n: litRows, d: rows }) + " of the rows = " +
                   text({ n: litCols * litRows, d: product.d }) + " of the boxes");
        if (size.cols > cols || size.rows > rows) {
            notes.push("the dashed outline is one whole");
        }
        if (product.n < 0) { notes.push("negative — the picture shows the size"); }

        var legendItems = [
            { swatch: "sw-a", label: text(a) + "  (columns)" },
            { swatch: "sw-b", label: text(b) + "  (rows)" },
            { swatch: "sw-both", label: text(product) + "  (overlap = answer)" }
        ];

        /* the grid stays unsimplified; the number above it is the tidy answer */
        setOverlay(reduced, notes.join(" · "), legendItems);
        setMain(reduced);
        el.calcResult.textContent = text(reduced);

        say((prefix || "") + text(a) + " × " + text(b) + " = " + text(product) +
            (reduced.d === product.d && reduced.n === product.n
                ? ", already in lowest terms."
                : ", which simplifies to " + text(reduced) + ".") +
            " Press Submit next to the big fraction to redraw it simplified.", false);
    }

    /* ============================================================
       Events
       ============================================================ */

    el.fractionForm.addEventListener("submit", function (event) {
        event.preventDefault();

        var frac = readFraction(el.numerator, el.denominator, "Fraction");
        if (!frac) { return; }

        var reduced = simplify(frac.n, frac.d);

        if (Math.abs(reduced.n) > MAX_CELLS) {
            say("That is too many parts to draw. Try a smaller fraction.", true);
            return;
        }

        /* simplify, redraw in the one original colour ... */
        apply(reduced);

        /* ... and only now does the equation's first fraction change */
        el.aNum.value = String(reduced.n);
        el.aDen.value = String(reduced.d);
        mark(el.aNum, true);
        mark(el.aDen, true);

        say(text(frac) + " simplifies to " + text(reduced) +
            " — the equation below now starts from it.", false);
    });

    el.calcForm.addEventListener("submit", function (event) {
        event.preventDefault();
        say("");

        var a = readFraction(el.aNum, el.aDen, "First fraction");
        if (!a) { return; }

        var b = readFraction(el.bNum, el.bDen, "Second fraction");
        if (!b) { return; }

        var op = el.operation.value;
        var prefix = "";

        if (op === "div") {
            if (b.n === 0) {
                mark(el.bNum, false);
                say("You cannot divide by a fraction that equals zero.", true);
                return;
            }

            /* flip the second fraction and turn the ÷ into a × for real,
               in the inputs, so the equation on screen matches the picture */
            b = normalize({ n: b.d, d: b.n });
            el.bNum.value = String(b.n);
            el.bDen.value = String(b.d);
            el.operation.value = "mul";
            op = "mul";
            prefix = "Dividing is multiplying by the flip, so: ";
        }

        if (op === "mul") {
            showMultiply(a, b, prefix);
        } else {
            showAddSub(a, b, op);
        }
    });

    /* clear a field's error styling as soon as it is edited */
    [el.numerator, el.denominator, el.aNum, el.aDen, el.bNum, el.bDen]
        .forEach(function (input) {
            input.addEventListener("input", function () {
                mark(input, true);
            });
        });

    /* ---------- first paint ---------- */
    apply({ n: 3, d: 4 });
}());
