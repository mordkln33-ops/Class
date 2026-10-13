# Klein Site: Brand and Content Audit

**Site audited:** `Personal/Klein-Site-Launch` (the launch version of the Klein Site homepage and sample pages)
**Prepared for:** Mordechai Klein
**Date:** October 13, 2026

## Summary

The brand concept is strong and fits the founder: a teacher who builds tools for classrooms. The copy is plain, first person and specific, which is the site's biggest asset. Since the first audit, the visual style moved from a chalkboard-and-notebook look to a whiteboard and interactive-display look, the section order was fixed, and the pricing cards were trimmed. What still stands between the site and launch is mostly missing images, three placeholders (domain, email, form ID), and a few content gaps, starting with student privacy.

---

## 1. Brand and vibe

**In one line:** a modern classroom: clean, organized and trustworthy, run by a teacher who codes.

### Color palette

| Role | Color | Hex | Where it's used |
|---|---|---|---|
| Background | Whiteboard white | `#f8fafb` | Page background |
| Alternate background | Board grey | `#eef2f4` | Every other section |
| Brand | Deep green | `#1f4d3f` | Buttons, links, labels, the featured plan |
| Highlight | Pencil yellow | `#f5c451` | "Try it" sticker, highlights, buttons on dark sections |
| Display frame | Graphite | `#1c2228` | The Learning tools section and the footer |
| Check marks only | Red pen | `#b8402b` | Check marks, the logo dot, wrong answers, form errors |
| Text | Ink | `#1d2433` | Headings and body text |

**What works:** the palette tells a story. The hero is a gridded math whiteboard, the tools sit on an interactive display (each tool card is a lit "screen"), and the demo quiz has a thin dark frame like a small smartboard. Red is now reserved for check marks, so it means "correct" every time it appears.

**What changed from the first audit:** the site used six classroom details at once (graph paper, chalkboard, highlighter, red pen, notebook lines and index cards). Together they read as an elementary classroom, which undersold $850–$1,800 work for high school tutors, centers and schools. Chalkboards are also mostly gone from classrooms, replaced by whiteboards and interactive flat panels. The chalkboard became an interactive display, the notebook lines and index-card styling were removed, and red pen was limited to check marks.

### Fonts

- **Fraunces** (headings): a warm, bookish serif with a textbook feel.
- **Lexend** (body): designed for reading ease, a smart choice for an education brand.
- Together they say "approachable expert." Keep both.

### Layout

- One long, mobile-first page: **Hero → Learning tools → Who I work with → About → Websites → Sample projects → Process → Pricing → FAQ → Contact.**
- The hero shows a working fraction quiz instead of a photo, so the product is the first thing visitors see. This is the best decision on the site.
- Section backgrounds now alternate cleanly all the way down the page.

---

## 2. Content: is it necessary, clear and concise?

**Mostly yes.** The voice is plain and specific ("my students always get stuck on slope"). The remaining issues are a few vague phrases and some missing answers.

### Fixed in this round

- **Section order.** Websites had drifted up above Who and About. It now follows About and leads into the sample projects, which also fixed the background rhythm.
- **Dead code.** A commented-out duplicate of the Websites section (about 55 lines) was deleted.
- **Pricing repetition.** Four features repeated across the tool cards now appear once, in an "Every tool includes" line above them: works on phones, Chromebooks and smartboards; large, clear display for classroom screens; your colors and name; a link to share or add to your site. Each card now lists only what makes that tier different.
- **Consistent tool names.** "What I can build for you" now uses the pricing names in the pricing order: Quick Check, Visual Tool, Explorer.
- **Quick Check example.** The Quick Check card is now flagged "Like the demo at the top," matching the Visual Tool and Explorer flags.

### Still open

- **Student privacy is not addressed.** Schools and centers will ask whether students need accounts and what data the tools collect. This is the most important missing answer.
- **Subject scope is unclear.** All four tools are math, but the site doesn't say whether other subjects are available.
- **The client's part isn't stated.** The Process section doesn't say what the client needs to send (logo, colors, how they teach the topic).
- **Semester refresh mentions "calendar,"** which is no longer offered.
- **"Yours, every semester" is vague.** Something like "You own it, and it stays current" says what's meant.
- **The About fact list** includes "Custom interactive learning tools," which isn't a fact. Something checkable, like "4 live tools you can try," works better.
- **"Standard hosting is free for most sites"** invites the question "which ones aren't?"
- **Audience wording varies:** "schools" in the hero, "small schools" in the footer.

---

## 3. To-do list

### Before launch

- [ ] **Add images.** The `/images` folder is empty, so every slot shows "Image goes here." Most important first: the 4 tool screenshots (`tool-graphing.jpg`, `tool-fractions.jpg`, `tool-probability.jpg`, `tool-number-line.jpg`), then `portrait.jpg`, then `og-image.jpg` for link previews. The full list is in `images/IMAGES.md`.
- [ ] **Replace the domain** `https://www.yourdomain.com` in `index.html`, `work/*.html`, `robots.txt` and `sitemap.xml`.
- [ ] **Replace the email** `hello@yourdomain.com` in `index.html` (contact section and structured data).
- [ ] **Create the Formspree form** and replace `YOUR_FORM_ID` in the contact form. Send a test message.
- [ ] **Add a student privacy FAQ:** no student logins, the tools store nothing, and Quick Check results go only to you. Add it to both the visible FAQ and the FAQ structured data.

### Content fixes

- [ ] Say which subjects you cover (for example, "Math first, other subjects on request").
- [ ] Add one sentence to Process about what the client sends you.
- [ ] Remove "calendar" from the Semester refresh description.
- [ ] Reword "Yours, every semester."
- [ ] Replace "Custom interactive learning tools" in the About fact list with something checkable.
- [ ] Name the host in the hosting fine print, or drop "most."
- [ ] Use the same audience wording in the hero and footer.

### Decisions to confirm

- [ ] **Center plan price:** kept at $1,650, with the first semester refresh added to make up for removing easy editing. Adjust if you'd rather lower the price.
- [ ] **Response time:** the FAQ promises changes "within two business days."

### After launch

- [ ] Replace the sample project screenshots with real or concept builds, and add real results to "Measuring success."
- [ ] Add testimonials once you have real ones (the template is in a comment in `index.html`).
- [ ] Update `<lastmod>` dates in `sitemap.xml` when pages change.
- [ ] Note: Google no longer shows FAQ rich results for most sites. The FAQ structured data is harmless, but don't expect it to bring search traffic.

---

## Appendix: offerings at launch

| Offering | Price |
|---|---|
| Library tool | $250 |
| Quick Check | $350 |
| Visual Tool | $850 |
| Explorer | from $1,800 |
| Tutor website | $850 |
| Center website | $1,650 |
| As-needed changes | $50/hour |
| Semester refresh | $150/term |
| Add-ons | $100–$200 |

Cut for now and kept for later: School website, Easy editing, Ongoing care ($35/month), formal accessibility review, Google Business Profile setup.
