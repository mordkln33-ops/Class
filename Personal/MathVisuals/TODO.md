# MathVisuals: launch checklist

Everything to do before (and right after) putting the site online.
Items marked **[blocker]** will break something or cause a real problem if skipped.

## 1. Domain and hosting

- [x] Choose the domain: **mathvisuals.online**. Buy it if you haven't yet.
- [ ] **[blocker]** Choose a host that runs **Apache** (so `.htaccess` works) and **PHP 8.1 or newer**.
      `contact.php` uses `str_contains()` and the `never` return type, which crash on PHP 8.0 and older.
      If the host uses Nginx instead, `data/.htaccess` is ignored and `data/submissions.csv` (teachers' names and emails) becomes publicly downloadable. Block `/data/` in the Nginx config or move the file outside the web root.
- [ ] **[blocker]** Put the site at the **domain root** (e.g. `public_html/`), not in a sub-folder. Otherwise the 404 page and the `/404.html` rule in `.htaccess` break.
- [ ] Turn on HTTPS (free Let's Encrypt certificate on most hosts).
- [ ] After HTTPS works, add an HTTP→HTTPS redirect to `.htaccess`. The site uses `mathvisuals.online` without `www`, so this also sends `www.` visitors there:
      ```apache
      RewriteEngine On
      RewriteCond %{HTTPS} off [OR]
      RewriteCond %{HTTP_HOST} ^www\. [NC]
      RewriteRule ^ https://mathvisuals.online%{REQUEST_URI} [L,R=301]
      ```

## 2. Replace placeholders

- [x] Replace the placeholder domain with `https://mathvisuals.online` in every file.
- [x] Set `CONTACT_TO` in [contact.php](contact.php) (line 25).
- [ ] Update the `<lastmod>` dates in [sitemap.xml](sitemap.xml) to the launch date.
- [ ] Optional: replace the "MK" monogram in the About section of [index.html](index.html) (line 361) with a photo.

## 3. Contact form

- [x] Set the `From:` header in `contact.php` to `no-reply@mathvisuals.online`.
- [ ] If your host offers it, set up SPF/DKIM for `mathvisuals.online` (usually a few DNS records in the host's control panel). Gmail is much more likely to deliver mail "from" your domain when they exist.
- [ ] Make sure the `data/` folder is **writable** by PHP on the server, so `submissions.csv` can be created.
- [ ] Check that `https://mathvisuals.online/data/submissions.csv` returns **403 Forbidden** in a browser.
- [ ] Send a test submission on the live site, both with JavaScript on and with it off (the no-JS path redirects to `thank-you.html`). Confirm the email arrives and the CSV row is saved.
- [ ] Optional hardening: the spam timer is skipped when the hidden `started` field is missing, and the rate limit relies on a session cookie that bots don't keep. Consider rejecting a missing `started` value, or adding a captcha (e.g. Cloudflare Turnstile) if spam shows up.

## 4. Privacy and legal

- [x] Add a privacy policy page ([privacy.html](privacy.html)), linked in every footer, next to the form's email field, and in `sitemap.xml`.
- [ ] Read the privacy policy and confirm every statement is true for you (for example, the promise to answer requests within 30 days).
- [ ] Optional: self-host the Atkinson Hyperlegible font files instead of loading them from Google. This makes the site faster and removes the third-party request (relevant for EU visitors under GDPR). If you do, remove the Google Fonts section from the privacy policy.
- [x] State the copyright: every footer, the home-page FAQ, the Fraction Visualizer FAQ and each tool's structured data say the tools are your copyright and free to use for now.

## 5. Decide what not to upload

- [ ] Don't upload `README.md` or `TODO.md`. They'd be publicly readable.
- [ ] Decide whether `style-guide.html` should be public. It's `noindex`, but anyone can open it if they find the link.
- [ ] Don't upload any local `data/submissions.csv` test file.

## 6. Test everything

- [ ] Click through every tool and every link on the home page, in the footer, and in the breadcrumbs.
- [ ] Test in Chrome, Edge, Firefox and Safari (including iPhone/iPad Safari).
- [ ] Test on a phone, a tablet, and on a **real projector or big screen**.
- [ ] Test light and dark mode on every page, including the Graphing Explorer line colors.
- [ ] Test keyboard-only use (Tab through each tool) and with a screen reader (NVDA or VoiceOver).
- [ ] Run Lighthouse in Chrome DevTools on the home page and one tool page. Aim for 90+ in every category.
- [ ] Run the HTML through https://validator.w3.org/.
- [ ] Check the structured data with Google's Rich Results Test.
- [ ] Preview the share images (`assets/img/og/*.jpg`) with https://www.opengraph.xyz/ or the LinkedIn Post Inspector.
- [ ] Open a nonexistent URL on the live site and confirm the custom 404 page appears with working links.
- [ ] Proofread all text: home page, About, FAQ, teacher notes on each tool page, thank-you page, 404 page, privacy policy.

## 7. After launch

- [ ] Submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- [ ] Optional: add privacy-friendly analytics (e.g. Plausible or GoatCounter). If you do, mention it in the privacy policy.
- [ ] Commit the site to git. `Personal/MathVisuals/` is currently untracked.
- [ ] Set up host backups, and download `data/submissions.csv` regularly.
- [ ] Optional: free uptime monitoring (e.g. UptimeRobot).
- [ ] Share the link with teachers and collect feedback.
