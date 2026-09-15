/**
 * Business Beyond Borders: website leads.
 *
 * Saves every website form (contact, feedback, free toolkit, newsletter) as a row
 * in this Google Sheet and emails you an alert. Setup steps: integrations/LEADS-SETUP.md
 */

// Where new-lead alerts are sent.
const NOTIFY_EMAIL = "ms.sargsyanmariam@gmail.com";
const SHEET_NAME = "Leads";
const HEADERS = [
  "Received", "Form", "Name", "Email", "Phone", "Company / role", "Topic",
  "Message", "Rating", "May publish", "Newsletter opt-in", "Language", "Country", "Page",
];
const MAX_LENGTH = 5000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // The website's hidden anti-spam box is only ever ticked by bots.
    if (data.botcheck) return reply({ ok: true });

    const form = clean(data.form) || "Website";
    const email = clean(data.email).toLowerCase();
    if (email && !EMAIL_PATTERN.test(email)) return reply({ ok: false, error: "invalid_email" });
    if (!email && form !== "Feedback") return reply({ ok: false, error: "email_required" });

    // Ignore the same person sending the same form twice within a minute.
    const cache = CacheService.getScriptCache();
    const dedupeKey = "seen:" + form + ":" + (email || clean(data.name));
    if (cache.get(dedupeKey)) return reply({ ok: true, duplicate: true });
    cache.put(dedupeKey, "1", 60);

    const row = {
      "Received": new Date(),
      "Form": form,
      "Name": clean(data.name),
      "Email": email,
      "Phone": clean(data.phone),
      "Company / role": clean(data.company),
      "Topic": clean(data.topic),
      "Message": clean(data.message),
      "Rating": clean(data.rating),
      "May publish": clean(data.consent),
      "Newsletter opt-in": clean(data.optin),
      "Language": clean(data.language),
      "Country": clean(data.country),
      "Page": clean(data.page),
    };

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      getSheet().appendRow(HEADERS.map((h) => (row[h] !== undefined ? row[h] : "")));
    } finally {
      lock.releaseLock();
    }

    notify(row);
    return reply({ ok: true });
  } catch (err) {
    console.error(err);
    return reply({ ok: false, error: "server_error" });
  }
}

// Opening the web app URL in a browser just confirms it is running.
function doGet() {
  return reply({ ok: true, service: "Business Beyond Borders leads" });
}

// Run this once from the editor: it asks for permission, creates the sheet and sends a test email.
function testSetup() {
  getSheet();
  notify({
    "Form": "Setup test",
    "Name": "Business Beyond Borders",
    "Email": NOTIFY_EMAIL,
    "Message": "If you received this email, your website leads are connected.",
  });
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
  }
  return sheet;
}

function notify(row) {
  if (!NOTIFY_EMAIL) return;
  const who = row["Name"] || row["Email"] || "someone";
  const lines = HEADERS
    .filter((h) => h !== "Received" && row[h])
    .map((h) => h + ": " + String(row[h]).replace(/^'/, ""));
  const options = {
    to: NOTIFY_EMAIL,
    subject: "New " + row["Form"] + " from " + who + " (Business Beyond Borders)",
    body: lines.join("\n") + "\n\nAll leads: " + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
  };
  if (row["Email"]) options.replyTo = String(row["Email"]);
  MailApp.sendEmail(options);
}

// Stores values as plain text. A leading = + - @ would otherwise run as a spreadsheet formula.
function clean(value) {
  let text = String(value === null || value === undefined ? "" : value).trim().slice(0, MAX_LENGTH);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
