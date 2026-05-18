# Georgia Voter Guide — Setup Guide
## From Zero to Live Public Website

---

## WHAT YOU'LL HAVE WHEN DONE
- A live public URL anyone can visit
- Users sign up, get a 30-day trial with 50 searches/day
- Free access auto-opens during election windows
- Your Anthropic API key is safe and hidden
- All connected through GitHub (one push = auto-deploy)

---

## STEP 1 — Create Your GitHub Repository

1. Go to **github.com** and log in
2. Click the **+** button (top right) → **New repository**
3. Name it: `georgia-voter-guide`
4. Set it to **Public** (so others can contribute)
5. Check **Add a README file**
6. Click **Create repository**
7. Click the green **Code** button → **Download ZIP** or use GitHub Desktop
8. Extract the ZIP and copy all these project files into that folder:
   ```
   georgia-voter-guide/
   ├── api/
   │   └── search.js
   ├── src/
   │   ├── App.jsx
   │   ├── main.jsx
   │   └── supabaseClient.js
   ├── supabase/
   │   └── schema.sql
   ├── index.html
   ├── package.json
   ├── vite.config.js
   ├── .env.example
   └── .gitignore
   ```
9. Commit and push all files to GitHub

---

## STEP 2 — Set Up Supabase

1. Go to **supabase.com** → Sign up free (use your GitHub account)
2. Click **New Project**
   - Name: `georgia-voter-guide`
   - Set a strong database password (save it somewhere safe)
   - Region: **US East** (closest to Georgia)
3. Wait ~2 minutes for project to spin up
4. Click **SQL Editor** in the left sidebar
5. Click **New Query**
6. Open `supabase/schema.sql` from your project files
7. Copy the entire contents and paste into the SQL editor
8. Click **Run** — you should see "Success"
9. Go to **Authentication → Providers** → make sure **Email** is enabled
10. Go to **Settings → API** and copy:
    - **Project URL** (looks like `https://abcdef.supabase.co`)
    - **anon / public key** (long string starting with `eyJ...`)

> **Lovable connection:** If you're using Lovable, go to your Lovable project
> → Integrations → Supabase → paste your Project URL and anon key.
> Lovable will auto-sync your database schema visually.

---

## STEP 3 — Get Your Anthropic API Key

1. Go to **console.anthropic.com** → Sign up / Log in
2. Click **API Keys** in the left menu
3. Click **Create Key** → name it `georgia-voter-guide`
4. **Copy the key immediately** — you won't see it again
5. Add a payment method (you only pay for usage, ~$1-3/month for a civic app)

---

## STEP 4 — Deploy to Vercel

1. Go to **vercel.com** → Sign up with your **GitHub account**
2. Click **Add New → Project**
3. Find and select your `georgia-voter-guide` repository
4. Vercel will auto-detect it as a Vite project
5. Before clicking Deploy, click **Environment Variables** and add:

   | Variable Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your Anthropic key from Step 3 |
   | `VITE_SUPABASE_URL` | your Supabase Project URL from Step 2 |
   | `VITE_SUPABASE_ANON_KEY` | your Supabase anon key from Step 2 |
   | `ALLOWED_ORIGIN` | your Vercel URL (add after first deploy) |

6. Click **Deploy** — Vercel builds and deploys automatically
7. Your live URL is `gaelectionguide.org`
8. Go back to Environment Variables, set `ALLOWED_ORIGIN` to that URL, redeploy

---

## STEP 5 — Connect GitHub → Vercel (Auto-Deploy)

This is already done! When you connected GitHub in Step 4, Vercel set up
automatic deployment. Every time you push changes to GitHub:
- Vercel automatically rebuilds and redeploys
- Zero manual work needed
- Changes go live in ~60 seconds

---

## STEP 6 — Connect Supabase Auth Redirect

1. In Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to `https://gaelectionguide.org`
3. Add to **Redirect URLs**: `https://gaelectionguide.org/**`
4. Save

---

## STEP 7 — Test Everything

1. Visit your Vercel URL
2. Click **Sign Up** → create a test account
3. Check your email for confirmation link → click it
4. Log back in → you should see the dashboard with 50 searches/day
5. Try a search — it should return candidate info
6. Check Supabase → **Table Editor → profiles** — your user should appear

---

## MANAGING ELECTION WINDOWS (as admin)

To open free access during an election:
1. Go to Supabase → **SQL Editor**
2. Run:
```sql
INSERT INTO public.election_windows (name, window_start, window_end)
VALUES (
  '2026 Georgia General Election',
  '2026-09-01 00:00:00+00',
  '2026-11-04 23:59:59+00'
);
```
During this window, all users get unlimited access regardless of trial status.

To extend a specific user's trial:
```sql
UPDATE public.profiles
SET access_end = now() + interval '90 days',
    access_type = 'donor'
WHERE email = 'user@example.com';
```

To ban an abusive user:
```sql
UPDATE public.profiles
SET is_banned = true,
    ban_reason = 'Repeated policy violations'
WHERE email = 'abuser@example.com';
```

---

## SHARING AS OPEN SOURCE

Your repo is already public on GitHub. To make it contributor-friendly:
1. Edit the README.md on GitHub with a description of the project
2. Add a LICENSE (MIT is standard for civic tech — allows free use)
   - GitHub → your repo → Add file → Create new file → name it `LICENSE`
   - Choose MIT License template
3. Share your GitHub URL — others can fork it, contribute, or deploy their own copy

---

## COST SUMMARY (monthly estimate)

| Service | Cost |
|---|---|
| Supabase | Free (up to 50,000 users) |
| Vercel | Free (up to 100GB bandwidth) |
| GitHub | Free |
| Anthropic API | ~$1–5/month for typical civic app traffic |
| **Total** | **~$1–5/month** |

---

## NEED HELP?
- Supabase docs: docs.supabase.com
- Vercel docs: vercel.com/docs
- Anthropic API: docs.anthropic.com
