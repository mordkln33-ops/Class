/* ============================================================
   Fraction Visualizer
   ------------------------------------------------------------
   Left half  : fraction template + two-fraction calculator.
   Right half : the container, split into equal vertical strips.
                `numerator` strips are filled with aquamarine.
   ============================================================ */

(function () {
    "use strict";

    /* ---------- limits (keep the strips readable) ---------- */
    var MAX_DENOMINATOR = 100;

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

    /* Reduce and keep the sign on the numerator. */
    function simplify(num, den) {
        if (den < 0) {
            num = -num;
            den = -den;
        }
        var d = gcd(num, den);
        return { n: num / d, d: den / d };
    }

    function operate(a, b, op) {
        switch (op) {
            case "add": return simplify(a.n * b.d + b.n * a.d, a.d * b.d);
            case "sub": return simplify(a.n * b.d - b.n * a.d, a.d * b.d);
            case "mul": return simplify(a.n * b.n, a.d * b.d);
            case "div":
                if (b.n === 0) { return null; }        // cannot divide by zero
                return simplify(a.n * b.d, a.d * b.n);
        }
        return null;
    }

    /* A fraction terminates in decimal only if its reduced denominator
       is built from 2s and 5s — used to decide "=" versus "≈". */
    function terminates(den) {
        while (den % 2 === 0) { den /= 2; }
        while (den % 5 === 0) { den /= 5; }
        return den === 1;
    }

    function formatDecimal(num, den) {
        var value = num / den;
        if (Number.isInteger(value)) { return String(value); }

        var text = value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
        return (terminates(den) ? "" : "≈ ") + text;
    }

    function formatPercent(num, den) {
        var value = (num / den) * 100;
        var text = Math.round(value * 100) / 100;
        return (terminates(den) ? "" : "≈ ") + text + "%";
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
            say(label + ": please enter whole numbers.");
            return null;
        }
        if (d === 0) {
            say(label + ": the denominator cannot be 0 — you can't split something into zero parts.");
            return null;
        }
        if (Math.abs(d) > MAX_DENOMINATOR) {
            say(label + ": keep the denominator at " + MAX_DENOMINATOR + " or less so the strips stay visible.");
            return null;
        }
        return { n: n, d: d };
    }

    function say(text) {
        el.message.textContent = text || "";
    }

    /* ============================================================
       Drawing the strips
       ============================================================ */

    function draw(frac) {
        var den = frac.d;
        var size = Math.abs(frac.n);

        /* The container is always split into exactly `den` sections.
           Anything at or past one whole simply fills every section. */
        var filled = Math.min(size, den);

        var stage = document.createDocumentFragment();

        for (var i = 0; i < den; i++) {
            var strip = document.createElement("div");
            strip.className = "strip" + (i < filled ? " filled" : "");
            strip.style.setProperty("--i", i);
            stage.appendChild(strip);
        }

        el.strips.innerHTML = "";
        el.strips.appendChild(stage);

        /* overlay */
        el.ovNum.textContent = frac.n;
        el.ovDen.textContent = frac.d;
        el.ovDecimal.textContent = formatDecimal(frac.n, frac.d);

        var notes = [];
        if (frac.n < 0) { notes.push("negative — strips show the size"); }
        if (size > den) { notes.push("more than one whole — container full"); }
        else if (size === den) { notes.push("exactly one whole"); }
        el.ovNote.textContent = notes.join(" · ");
    }

    /* ============================================================
       Applying a fraction everywhere
       ============================================================ */

    function apply(frac) {
        /* a negative denominator is the same fraction with the sign on top */
        if (frac.d < 0) { frac = { n: -frac.n, d: -frac.d }; }

        var reduced = simplify(frac.n, frac.d);

        el.numerator.value = frac.n;
        el.denominator.value = frac.d;
        mark(el.numerator, true);
        mark(el.denominator, true);

        el.decimalOut.textContent = formatDecimal(frac.n, frac.d);
        el.percentOut.textContent = formatPercent(frac.n, frac.d);
        el.simpleOut.textContent = reduced.n + "/" + reduced.d;

        draw(frac);
    }

    /* ============================================================
       Events
       ============================================================ */

    el.fractionForm.addEventListener("submit", function (event) {
        event.preventDefault();
        say("");

        var frac = readFraction(el.numerator, el.denominator, "Fraction");
        if (!frac) { return; }

        apply(frac);

        /* keep the calculator's first fraction in step with what is on screen */
        el.aNum.value = frac.n;
        el.aDen.value = frac.d;
    });

    el.calcForm.addEventListener("submit", function (event) {
        event.preventDefault();
        say("");

        var a = readFraction(el.aNum, el.aDen, "First fraction");
        if (!a) { return; }

        var b = readFraction(el.bNum, el.bDen, "Second fraction");
        if (!b) { return; }

        var result = operate(a, b, el.operation.value);
        if (!result) {
            mark(el.bNum, false);
            say("You cannot divide by a fraction that equals zero.");
            return;
        }
        if (Math.abs(result.d) > MAX_DENOMINATOR) {
            say("That answer is " + result.n + "/" + result.d +
                " — too many parts to draw clearly. Try smaller denominators.");
            el.calcResult.textContent = result.n + "/" + result.d;
            return;
        }

        el.calcResult.textContent = result.n + "/" + result.d;

        /* the answer drives the fraction above, the decimal, and the visual */
        apply(result);

        /* and it becomes the first fraction, so operations can be chained */
        el.aNum.value = result.n;
        el.aDen.value = result.d;
    });

    /* clear a field's error styling as soon as it is edited */
    [el.numerator, el.denominator, el.aNum, el.aDen, el.bNum, el.bDen]
        .forEach(function (input) {
            input.addEventListener("input", function () {
                mark(input, true);
                say("");
            });
        });

    /* ---------- first paint ---------- */
    apply({ n: 3, d: 4 });
}());
