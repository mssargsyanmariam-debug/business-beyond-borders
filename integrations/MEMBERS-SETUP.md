# Members area: set-up (about 30 minutes, free)

Your website is just files, so it cannot check passwords by itself. Supabase does that part:
it stores the accounts, the passwords and who paid for what. Everything members see still lives
on your own website, under `yoursite/members/`.

Free plan: 50,000 members, 500 MB of data, 1 GB of files. You only pay ($25/month) when you
outgrow it — or when you want the project never to pause (see step 7).

---

## Step 1: Create the project

1. Go to **supabase.com** and sign up (use your Google account, it is fastest).
2. Click **New project**.
   - Name: `business-beyond-borders`
   - Database password: let it generate one and **save it in your password manager**. You will
     almost never need it, but it cannot be recovered.
   - Region: pick the one closest to most of your members — `East US (North Virginia)` if most are
     in the US, `Central EU (Frankfurt)` if most are in Europe and Armenia.
3. Wait about two minutes while it is created.

## Step 2: Build the tables

1. In the left menu click **SQL Editor** → **New query**.
2. Open the file `integrations/members-schema.sql` from this project, copy **everything** in it,
   paste it into the editor.
3. Click **Run**. It should say "Success. No rows returned".

That one file creates the member list, the access records, the materials and the security rules
that stop anyone from reading what they did not pay for.

## Step 3: Give the website its keys

1. Left menu: **Project Settings** (gear) → **API**.
2. Copy two things:
   - **Project URL** — looks like `https://abcdefghijkl.supabase.co`
   - **anon public** key — a very long string starting with `eyJ...`
3. Send both to me, or paste them yourself into `assets/js/members-config.js` between the quotes.

The anon key is safe to publish — it is designed to sit in every visitor's browser, and the rules
from step 2 decide what it may do. **Never** send me or publish the `service_role` key.

## Step 4: Tell Supabase where your website is

Left menu: **Authentication** → **URL Configuration**.

- **Site URL**: `https://mssargsyanmariam-debug.github.io/business-beyond-borders/members/`
- **Redirect URLs**: add `https://mssargsyanmariam-debug.github.io/business-beyond-borders/members/**`

(When you buy your BBB domain, come back and change these two lines.)

## Step 5: Email

Supabase's own mailer only sends **2 emails per hour**. That is fine for testing and far too little
for real members, because password resets and login links use it.

**For the first days (testing):**
Authentication → Providers → Email → turn **"Confirm email" off**. New members can then log in
straight away without waiting for a confirmation mail.

**Before you promote the member area (15 minutes, free):**
1. Sign up at **resend.com** (free: 3,000 emails a month) and verify your sending address.
2. In Supabase: Project Settings → **Authentication** → **SMTP Settings** → Enable custom SMTP.
   - Host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key
   - Sender: your own address, sender name `Business Beyond Borders`
3. Turn "Confirm email" back on if you want to.

## Step 6: Make yourself the admin

1. Open `https://mssargsyanmariam-debug.github.io/business-beyond-borders/members/login.html`
2. Create an account with **your own email**.
3. Back in Supabase → SQL Editor → New query, run:

   ```sql
   update public.profiles set is_admin = true
   where email = 'ms.sargsyanmariam@gmail.com';
   ```

4. Open `members/admin.html`. That is your members panel.

## Step 7: One thing to know about the free plan

A free project **pauses after a week with no activity** and members cannot log in until you
press "Restore" in the dashboard. While you are testing that is harmless. From your first paying
member, switch to the Pro plan ($25/month) — it never pauses, and keeps daily backups.

---

# Using it day to day

### Someone paid, give them access
1. They create their own account on the website (they must do this themselves — you never type
   anyone's password).
2. `members/admin.html` → **Members** → find them → choose the product, the plan and how long →
   **Switch on**.
3. They refresh, and the library is there.

### Add materials
`members/admin.html` → **Materials**:
- **Video** — paste an unlisted YouTube or a private Vimeo link. It plays inside your member area.
- **File** — upload a PDF or slides. Members get a private link that works for one hour only, so
  the file cannot be passed around by copying the address.
- **Link** — a Zoom room, a Notion page, anything else.

Choose **Beyond Mastermind only** if a material is for the higher tier. Everything else is visible
to every member, whichever plan they are on.

### Sell a course later with 1 year of access
1. **Courses & products** tab → add the course (name + a short code like `course-linkedin`).
2. **Materials** tab → add each lesson, choosing that course under "Belongs to".
3. When somebody buys: **Members** tab → pick the course, choose **1 year** → Switch on.
   Their access stops by itself on that date; the course stays on your website.

### Later: switch access on automatically after payment
Right now you switch access on by hand, which is fine for the first members and keeps you in
control. When payments run through Stripe, we add a small function that listens to Stripe and
creates the same access record automatically. Nothing on this page changes.
