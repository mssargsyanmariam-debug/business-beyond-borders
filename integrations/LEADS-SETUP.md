# Connect website forms to a Google Sheet (about 10 minutes, once)

Every form on the website (contact, feedback, free toolkit, newsletter) is saved as a row
in a Google Sheet, and you get an email for each one. You can reply straight from that email.

## 1. Create the sheet
1. Go to https://sheets.new while signed in to ms.sargsyanmariam@gmail.com.
2. Name it **Business Beyond Borders – Leads**.

## 2. Add the script
1. In the sheet, open **Extensions → Apps Script**.
2. Delete everything in the editor.
3. Paste the whole contents of `integrations/leads-apps-script.gs`.
4. Click the save icon.

## 3. Allow it and test
1. In the function dropdown at the top, choose **testSetup**, then click **Run**.
2. Google asks for permission: click **Review permissions**, choose your account,
   click **Advanced → Go to (unsafe)**, then **Allow**. ("Unsafe" only means Google hasn't
   reviewed a script you wrote yourself.)
3. Check your Gmail: you should get "New Setup test from Business Beyond Borders".
   A tab called **Leads** appears in your sheet.

## 4. Publish it
1. Click **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. **Execute as:** Me. **Who has access:** Anyone.
4. Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
5. Send that URL to Claude, who pastes it into `CONFIG.leads.endpoint` in `assets/js/main.js`.

## Later
- **If you edit the script**, use **Deploy → Manage deployments → Edit → New version**,
  so the same URL keeps working.
- **Newsletter:** the sheet is your subscriber list. When you start sending issues, export the
  sheet (File → Download → CSV) and import it into your email tool (for example Kit).
- **Privacy:** only you can open the sheet. The web app URL can add rows but can't read them.
