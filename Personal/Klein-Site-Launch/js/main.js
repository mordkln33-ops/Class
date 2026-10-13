/* ==========================================================================
   KLEIN SITE — MAIN SCRIPT
   --------------------------------------------------------------------------
   Loaded with "defer" on every page, so it runs after the HTML is parsed.
   Every feature checks that its elements exist first, so this one file works
   on the home page and on the case-study pages.

   PROGRESSIVE ENHANCEMENT: all text content lives in the HTML. JavaScript only
   adds behavior on top, so search engines and visitors without JS still get
   everything that matters.

   CONTENTS
       1. Mobile navigation
       2. Highlight the current section in the nav
       3. Image placeholders
       4. Scroll reveal
       5. Fraction demo (interactive learning tool sample)
       6. Pricing buttons pre-select a plan in the form
       7. Contact form (validation + sending)
       8. Footer year
   ========================================================================== */

(function () {
    "use strict";

    // Marks that JS is running. (Also set by a one-line script in each page's
    // <head> so the CSS can apply before the first paint — this is a backup.)
    document.documentElement.classList.add("js");


    /* ======================================================================
       1. MOBILE NAVIGATION
       Opens/closes the menu, keeps aria-expanded in sync for screen readers,
       and closes on link click, Escape key, or when resizing to desktop.
       ====================================================================== */

    const navToggle = document.querySelector(".nav-toggle");
    const navMenu = document.getElementById("nav-menu");

    function setMenu(open) {
        navToggle.setAttribute("aria-expanded", String(open));
        navMenu.classList.toggle("is-open", open);
    }

    if (navToggle && navMenu) {
        navToggle.addEventListener("click", function () {
            const isOpen = navToggle.getAttribute("aria-expanded") === "true";
            setMenu(!isOpen);
        });

        // Close after choosing a link (so the page isn't hidden behind the menu)
        navMenu.addEventListener("click", function (event) {
            if (event.target.closest("a")) {
                setMenu(false);
            }
        });

        // Escape closes the menu and returns focus to the button
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && navMenu.classList.contains("is-open")) {
                setMenu(false);
                navToggle.focus();
            }
        });

        // If the window grows to desktop width, reset the phone menu
        const desktop = window.matchMedia("(min-width: 64em)");
        desktop.addEventListener("change", function (event) {
            if (event.matches) {
                setMenu(false);
            }
        });
    }


    /* ======================================================================
       2. HIGHLIGHT THE CURRENT SECTION IN THE NAV
       Watches each section linked from the nav; whichever is in the middle of
       the screen gets its link marked with "is-active" and aria-current.
       ====================================================================== */

    const navLinks = document.querySelectorAll('.nav-menu a[href^="#"]');

    if (navLinks.length && "IntersectionObserver" in window) {
        // Map each section id → its nav link
        const linkById = {};
        navLinks.forEach(function (link) {
            linkById[link.getAttribute("href").slice(1)] = link;
        });

        const sectionObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;

                navLinks.forEach(function (link) {
                    link.classList.remove("is-active");
                    link.removeAttribute("aria-current");
                });

                const activeLink = linkById[entry.target.id];
                if (activeLink && !activeLink.classList.contains("btn")) {
                    activeLink.classList.add("is-active");
                    activeLink.setAttribute("aria-current", "true");
                }
            });
        }, {
            // A thin band across the middle of the viewport
            rootMargin: "-45% 0px -50% 0px"
        });

        Object.keys(linkById).forEach(function (id) {
            const section = document.getElementById(id);
            if (section) sectionObserver.observe(section);
        });
    }


    /* ======================================================================
       3. IMAGE PLACEHOLDERS
       Each <img> lives inside a ".img-slot" whose background shows repeating
       "Image goes here" text (see CSS section 9).
         • Image loads   → add "is-loaded" (placeholder pattern removed)
         • Image missing → add "is-empty" (broken icon hidden) and a small label
                           showing which file the slot is waiting for
       To fill a slot: save an image to the path in its src. Nothing else to change.
       ====================================================================== */

    function markLoaded(slot) {
        slot.classList.remove("is-empty");
        slot.classList.add("is-loaded");
        const label = slot.querySelector(".img-slot-label");
        if (label) label.remove();
    }

    function markEmpty(slot, img) {
        slot.classList.add("is-empty");

        // Label with the expected file name, e.g. "images/hero-desk.jpg"
        if (!slot.querySelector(".img-slot-label")) {
            const label = document.createElement("span");
            label.className = "img-slot-label";
            label.setAttribute("aria-hidden", "true"); // the img alt already describes it
            label.textContent = img.getAttribute("src");
            slot.appendChild(label);
        }
    }

    document.querySelectorAll(".img-slot").forEach(function (slot) {
        const img = slot.querySelector("img");
        if (!img) return;

        // The image may have finished (or failed) before this script ran
        if (img.complete) {
            if (img.naturalWidth > 0) {
                markLoaded(slot);
            } else {
                markEmpty(slot, img);
            }
        }

        // Lazy-loaded images finish later
        img.addEventListener("load", function () { markLoaded(slot); });
        img.addEventListener("error", function () { markEmpty(slot, img); });
    });


    /* ======================================================================
       4. SCROLL REVEAL
       Elements with class "reveal" fade up once as they enter the screen.
       Skipped (everything shown at once) if the browser lacks support or the
       visitor prefers reduced motion.
       ====================================================================== */

    const revealItems = document.querySelectorAll(".reveal");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (revealItems.length) {
        if (!("IntersectionObserver" in window) || reduceMotion) {
            revealItems.forEach(function (item) { item.classList.add("is-visible"); });
        } else {
            const revealObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("is-visible");
                        observer.unobserve(entry.target); // only animate once
                    }
                });
            }, { rootMargin: "0px 0px -8% 0px" });

            revealItems.forEach(function (item) { revealObserver.observe(item); });
        }
    }


    /* ======================================================================
       5. FRACTION DEMO
       A tiny sample of an "interactive learning tool":
       pick the larger fraction → bars fill to show both sizes → explanation.
       To change the questions, edit the QUESTIONS list below.
       ====================================================================== */

    const demo = document.getElementById("fraction-demo");

    // Each question compares two fractions: [numerator, denominator]
    const QUESTIONS = [
        { a: [3, 5], b: [5, 8] },
        { a: [3, 4], b: [2, 3] },
        { a: [7, 10], b: [2, 3] }
    ];

    // Words for screen readers, so "3/5" is read as "3 fifths"
    const DENOMINATOR_WORDS = {
        2: "halves", 3: "thirds", 4: "fourths", 5: "fifths", 6: "sixths",
        7: "sevenths", 8: "eighths", 9: "ninths", 10: "tenths", 12: "twelfths"
    };

    if (demo) {
        const choicesEl = demo.querySelector("[data-demo-choices]");
        const barsEl = demo.querySelector("[data-demo-bars]");
        const feedbackEl = demo.querySelector("[data-demo-feedback]");
        const progressEl = demo.querySelector("[data-demo-progress]");
        const nextBtn = demo.querySelector("[data-demo-next]");

        let current = 0;   // index of the current question
        let score = 0;     // number answered correctly

        // Helpers ------------------------------------------------------------
        const value = function (f) { return f[0] / f[1]; };
        const text = function (f) { return f[0] + "/" + f[1]; };
        const spoken = function (f) { return f[0] + " " + (DENOMINATOR_WORDS[f[1]] || "over " + f[1]); };
        const decimal = function (f) { return value(f).toFixed(3).replace(/0+$/, "").replace(/\.$/, ""); };

        // Builds the stacked-fraction markup used inside each button
        function fractionHTML(f) {
            return '<span class="frac" aria-hidden="true">' +
                '<span class="frac-num">' + f[0] + "</span>" +
                '<span class="frac-den">' + f[1] + "</span>" +
                "</span>";
        }

        // Shows one question --------------------------------------------------
        function showQuestion() {
            const q = QUESTIONS[current];

            progressEl.textContent = "Question " + (current + 1) + " of " + QUESTIONS.length;
            feedbackEl.textContent = "";
            barsEl.hidden = true;
            barsEl.innerHTML = "";
            nextBtn.hidden = true;
            choicesEl.innerHTML = "";

            [q.a, q.b].forEach(function (fraction) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "demo-choice";
                btn.innerHTML = fractionHTML(fraction);
                btn.setAttribute("aria-label", spoken(fraction));
                btn.addEventListener("click", function () { answer(fraction, btn); });
                choicesEl.appendChild(btn);
            });
        }

        // Handles a click on one of the fractions ------------------------------
        function answer(picked, pickedBtn) {
            const q = QUESTIONS[current];
            const larger = value(q.a) > value(q.b) ? q.a : q.b;
            const smaller = larger === q.a ? q.b : q.a;
            const correct = picked === larger;

            if (correct) score++;

            // Lock the buttons and color the chosen one
            choicesEl.querySelectorAll("button").forEach(function (btn) { btn.disabled = true; });
            pickedBtn.classList.add(correct ? "is-correct" : "is-wrong");

            // Show the two fractions as bars so the difference is visible
            barsEl.innerHTML = [q.a, q.b].map(function (f) {
                return '<div class="demo-bar">' +
                    "<span>" + text(f) + "</span>" +
                    '<div class="demo-bar-track"><div class="demo-bar-fill" data-width="' +
                    (value(f) * 100).toFixed(1) + '"></div></div>' +
                    "</div>";
            }).join("");
            barsEl.hidden = false;

            // Reading offsetWidth makes the browser lay out the bars at 0% first,
            // so setting the width next animates from 0 to the fraction's size
            void barsEl.offsetWidth;
            barsEl.querySelectorAll(".demo-bar-fill").forEach(function (fill) {
                fill.style.width = fill.dataset.width + "%";
            });

            feedbackEl.textContent =
                (correct ? "Yes! " : "Close. ") +
                text(larger) + " is " + decimal(larger) + ", a little more than " +
                text(smaller) + " at " + decimal(smaller) + ".";

            // Last question → show the score and offer a restart
            if (current === QUESTIONS.length - 1) {
                feedbackEl.textContent += " You got " + score + " of " + QUESTIONS.length +
                    ". A tool like this can live on your site.";
                nextBtn.textContent = "Try again";
            } else {
                nextBtn.textContent = "Next question";
            }
            nextBtn.hidden = false;
            nextBtn.focus();
        }

        nextBtn.addEventListener("click", function () {
            if (current === QUESTIONS.length - 1) {
                current = 0;
                score = 0;
            } else {
                current++;
            }
            showQuestion();
            // Move focus to the first new choice for keyboard users
            const first = choicesEl.querySelector("button");
            if (first) first.focus();
        });

        showQuestion();
    }


    /* ======================================================================
       6. PRICING BUTTONS PRE-SELECT A PLAN
       "Start with Center" scrolls to the form and selects "Center".
       ====================================================================== */

    const planSelect = document.getElementById("plan");

    document.querySelectorAll("[data-plan]").forEach(function (button) {
        button.addEventListener("click", function () {
            if (planSelect) planSelect.value = button.dataset.plan;
        });
    });


    /* ======================================================================
       7. CONTACT FORM
       • Checks required fields and shows clear, specific error messages.
       • Sends with fetch() to Formspree, so the visitor stays on the page.
       • If the form isn't connected yet (YOUR_FORM_ID still in the action),
         it says so honestly and points to the email address instead.
       ====================================================================== */

    const form = document.getElementById("contact-form");

    if (form) {
        const status = form.querySelector(".form-status");
        const submitBtn = form.querySelector('button[type="submit"]');

        // Messages shown under each field when it's invalid
        const MESSAGES = {
            name: "Please enter your name.",
            email: "Please enter an email address like name@example.com.",
            message: "Please add a sentence or two about what you need."
        };

        function showError(field, message) {
            field.setAttribute("aria-invalid", "true");

            let error = document.getElementById(field.id + "-error");
            if (!error) {
                error = document.createElement("p");
                error.className = "field-error";
                error.id = field.id + "-error";
                field.insertAdjacentElement("afterend", error);
                // Links the message to the field so screen readers read it
                field.setAttribute("aria-describedby", error.id);
            }
            error.textContent = message;
        }

        function clearError(field) {
            field.removeAttribute("aria-invalid");
            const error = document.getElementById(field.id + "-error");
            if (error) error.remove();
            field.removeAttribute("aria-describedby");
        }

        // Returns true if every required field is valid
        function validate() {
            let firstInvalid = null;

            form.querySelectorAll("[required]").forEach(function (field) {
                const empty = field.value.trim() === "";
                const badEmail = field.type === "email" && !empty && !field.validity.valid;

                if (empty || badEmail) {
                    showError(field, MESSAGES[field.name] || "Please fill in this field.");
                    if (!firstInvalid) firstInvalid = field;
                } else {
                    clearError(field);
                }
            });

            if (firstInvalid) firstInvalid.focus();
            return !firstInvalid;
        }

        // Clear a field's error as soon as the visitor fixes it
        form.addEventListener("input", function (event) {
            if (event.target.getAttribute("aria-invalid") === "true" && event.target.validity.valid &&
                event.target.value.trim() !== "") {
                clearError(event.target);
            }
        });

        function setStatus(message, type) {
            status.textContent = message;
            status.className = "form-status" + (type ? " is-" + type : "");
        }

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            setStatus("", "");

            if (!validate()) {
                setStatus("Please check the highlighted fields.", "error");
                return;
            }

            // Not connected yet → be honest, don't pretend it was sent
            if (form.action.indexOf("YOUR_FORM_ID") !== -1) {
                const emailLink = document.querySelector(".contact-direct a");
                const email = emailLink ? emailLink.textContent : "email";
                setStatus("The form isn't connected yet. Please email " + email + " instead.", "error");
                return;
            }

            submitBtn.disabled = true;
            setStatus("Sending…", "");

            try {
                const response = await fetch(form.action, {
                    method: "POST",
                    body: new FormData(form),
                    headers: { Accept: "application/json" }
                });

                if (!response.ok) throw new Error("Request failed: " + response.status);

                form.reset();
                setStatus("Thank you! Your message was sent. I'll be in touch soon.", "success");
            } catch (error) {
                setStatus("Something went wrong sending your message. Please try again or email me directly.", "error");
            } finally {
                submitBtn.disabled = false;
            }
        });
    }


    /* ======================================================================
       8. FOOTER YEAR
       Keeps the copyright year current without editing the HTML each January.
       ====================================================================== */

    document.querySelectorAll("[data-year]").forEach(function (el) {
        el.textContent = new Date().getFullYear();
    });

})();
