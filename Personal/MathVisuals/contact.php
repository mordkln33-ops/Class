<?php
/* =====================================================================
   contact.php — receives "Suggest a tool" submissions from the home page
   ---------------------------------------------------------------------
   What it does, in order:
     1. Accepts POST only.
     2. Rejects spam: a hidden "website" field people never fill in, a
        minimum time between loading the page and sending, and a simple
        per-session rate limit.
     3. Validates and cleans every field.
     4. Saves the idea to data/submissions.csv (that folder is blocked
        from the web by data/.htaccess), so nothing is ever lost.
     5. Emails it to CONTACT_TO, if that is set and the server can send
        mail. (A default XAMPP install cannot send mail; the CSV file
        still collects every submission.)
     6. Replies with JSON when called by site.js (fetch), or redirects
        to thank-you.html for a plain no-JavaScript form post.

   SETUP: set CONTACT_TO below to the address that should receive ideas.
   ===================================================================== */

declare(strict_types=1);

/* ---------- Settings ---------- */
const CONTACT_TO      = 'mordkln33@gmail.com';   // leave empty to only save to CSV
const CONTACT_SUBJECT = 'New MathVisuals tool idea';
const MIN_SECONDS     = 4;                  // humans take longer than this to fill the form
const RATE_LIMIT_SECS = 30;                 // one submission per visitor every 30 seconds
const DATA_FILE       = __DIR__ . '/data/submissions.csv';

session_start();

/* Does the caller want JSON (site.js) or a page (plain form post)? */
$wantsJson = isset($_SERVER['HTTP_ACCEPT']) && str_contains($_SERVER['HTTP_ACCEPT'], 'application/json');

/**
 * Send the response and stop. JSON for fetch, otherwise a redirect:
 * success → thank-you.html, failure → back to the form with ?error=1.
 */
function respond(bool $ok, string $message, int $status = 200): never
{
    global $wantsJson;
    if ($wantsJson) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode(['ok' => $ok, 'message' => $message]);
        exit;
    }
    header('Location: ' . ($ok ? 'thank-you.html' : 'index.html?error=1#contact'), true, 303);
    exit;
}

/* Trim, strip control characters, and cap the length of a field. */
function field(string $name, int $max): string
{
    $value = isset($_POST[$name]) && is_string($_POST[$name]) ? $_POST[$name] : '';
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max);
}

/* Spreadsheet apps run cells that start with = + - @ as formulas;
   prefix those so a submission can never execute in Excel. */
function csvSafe(string $value): string
{
    return preg_match('/^[=+\-@\t\r]/', $value) ? "'" . $value : $value;
}

/* ---------- 1. POST only ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    header('Allow: POST');
    respond(false, 'Please use the form on the home page.', 405);
}

/* ---------- 2. Spam checks ---------- */
// Honeypot: real visitors never see this field.
if (field('website', 200) !== '') {
    respond(true, 'Thank you! Your idea has been sent.');   // look successful to the bot
}

// Too fast to be a person (the timestamp is set by site.js on page load).
$started = (int) ($_POST['started'] ?? 0);
if ($started > 0 && (time() - intdiv($started, 1000)) < MIN_SECONDS) {
    respond(false, 'That was very quick! Please wait a moment and send it again.', 429);
}

// One submission per visitor every RATE_LIMIT_SECS.
$last = $_SESSION['mv_last_submit'] ?? 0;
if (time() - $last < RATE_LIMIT_SECS) {
    respond(false, 'Thanks! Please wait half a minute before sending another idea.', 429);
}

/* ---------- 3. Validate ---------- */
$name    = field('name', 100);
$email   = field('email', 200);
$role    = field('role', 60);
$grade   = field('grade', 60);
$topic   = field('topic', 150);
$message = field('message', 4000);

$errors = [];
if ($name === '')                                    { $errors[] = 'your name'; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL))      { $errors[] = 'a valid email address'; }
if ($topic === '')                                   { $errors[] = 'your tool idea'; }
if (mb_strlen($message) < 20)                        { $errors[] = 'a description of at least 20 characters'; }

if ($errors) {
    respond(false, 'Please add ' . implode(', ', $errors) . '.', 422);
}

/* ---------- 4. Save to CSV ---------- */
$saved = false;
$dir = dirname(DATA_FILE);
if (is_dir($dir) || mkdir($dir, 0750, true)) {
    $isNew = !file_exists(DATA_FILE);
    $fh = fopen(DATA_FILE, 'ab');
    if ($fh && flock($fh, LOCK_EX)) {
        if ($isNew) {
            fputcsv($fh, ['date', 'name', 'email', 'role', 'grade', 'idea', 'description']);
        }
        fputcsv($fh, array_map('csvSafe', [
            date('c'), $name, $email, $role, $grade, $topic, $message,
        ]));
        flock($fh, LOCK_UN);
        $saved = true;
    }
    if ($fh) {
        fclose($fh);
    }
}

/* ---------- 5. Email (optional) ---------- */
$mailed = false;
if (CONTACT_TO !== '') {
    $body = "A teacher suggested a new tool on MathVisuals.\n\n"
          . "Name:  $name\n"
          . "Email: $email\n"
          . "Role:  " . ($role ?: '—') . "\n"
          . "Grade: " . ($grade ?: '—') . "\n\n"
          . "Idea:  $topic\n\n"
          . "$message\n";

    // Header values are validated above; strip line breaks anyway so
    // nobody can inject extra mail headers.
    $replyTo = str_replace(["\r", "\n"], '', $email);
    $headers = [
        'Content-Type: text/plain; charset=UTF-8',
        'From: MathVisuals <no-reply@mathvisuals.online>',
        'Reply-To: ' . $replyTo,
        'X-Mailer: MathVisuals contact form',
    ];
    $mailed = @mail(CONTACT_TO, CONTACT_SUBJECT, $body, implode("\r\n", $headers));
}

/* ---------- 6. Respond ---------- */
if (!$saved && !$mailed) {
    respond(false, 'Sorry, your idea could not be saved right now. Please try again later.', 500);
}

$_SESSION['mv_last_submit'] = time();
respond(true, 'Thank you! Your idea has been sent. I read every suggestion.');
