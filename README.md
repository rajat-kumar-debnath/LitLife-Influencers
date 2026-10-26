# Influencer Desk

A simple web app to manage an influencer-outreach roster — contacts, categories,
followers, rates and deal status. Add creators one by one, or bulk-import a
**CSV or Excel** file.

**Tech stack**

- **Front end:** plain HTML, CSS, JavaScript — no framework, no build step.
  Hosts for free on **GitHub Pages**.
- **Database:** **Supabase** (hosted **PostgreSQL**) — gives an instant API, so
  there's no server code to write or run.
- **Spreadsheet import:** [SheetJS](https://sheetjs.com) reads `.csv`, `.xlsx`, `.xls`.

```
nit life/
├─ index.html              # the app
├─ css/style.css           # styles (light + dark)
├─ js/
│  ├─ config.js            # <- put your Supabase URL + anon key here
│  └─ app.js               # all the logic
├─ schema.sql              # run once in Supabase to create + seed the table
├─ instagram_handles.csv   # your original 41 handles
└─ README.md
```

---

## Setup (about 5 minutes)

### 1. Create the database

1. Sign up at **[supabase.com](https://supabase.com)** and create a new project
   (the free tier is plenty).
2. In the project, open **SQL Editor** → **New query**.
3. Paste the entire contents of [`schema.sql`](schema.sql) and click **Run**.
   This creates the `influencers` table, security rules, and seeds your 41 handles.

### 2. Connect the app

1. In Supabase go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open [`js/config.js`](js/config.js) and paste them in:

   ```js
   window.SUPABASE_URL = "https://abcd1234.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
   ```

> The anon key is **meant to be public** — it ships in the browser on every
> Supabase site. Your data is protected by **Row Level Security** (see below),
> not by hiding the key. So it's fine to commit `config.js` to a public repo.

### 3. Run it locally

Because the app loads files over `fetch`/modules, open it through a tiny local
server rather than double-clicking the file:

```bash
# any one of these, from inside the project folder:
python -m http.server 8000
# or
npx serve
```

Then visit **http://localhost:8000**.

---

## Deploy free on GitHub Pages

1. Create a repo on GitHub and push this folder:

   ```bash
   git init
   git add .
   git commit -m "Influencer Desk"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. On GitHub: **Settings → Pages → Build and deployment**.
   Set **Source = Deploy from a branch**, branch **main**, folder **/ (root)**, Save.

3. Wait ~1 minute. Your app is live at
   `https://<you>.github.io/<repo>/`.

That's the whole deployment — GitHub Pages serves the static files, Supabase
handles the data.

---

## Using the app

- **Add influencer** — form for handle, name, category, followers, email, rate, status, notes.
- **Import CSV / Excel** — drag in a file (or click). Columns are matched by name
  (case-insensitive, any order): `handle` (required), `name`, `category`,
  `followers`, `email`, `rate`, `status`, `notes`. A single column of handles
  also works. Existing handles are **updated**, new ones are **added**.
- **Search** across handle, name, email, category.
- **Filter** by status (click a summary tile) or category.
- **Sort** any column by clicking its header.
- **Edit / delete** from the buttons on each row.

**Statuses:** New · Contacted · Negotiating · Confirmed · Posted · Rejected.

---

## Lock it down (optional)

By default anyone who can open the page can read **and** edit the data — fine for
a personal or internal tool. To restrict writes to signed-in users:

1. In Supabase enable an auth provider (**Authentication → Providers**, e.g. email).
2. Replace the policies in `schema.sql` so writes require a logged-in user:

   ```sql
   drop policy "public write" on public.influencers;

   create policy "auth write"
     on public.influencers for all
     to authenticated
     using (true) with check (true);
   ```

3. Add a Supabase login screen to the app (ask and this can be wired in).

---

## Troubleshooting

| Message | Fix |
|---|---|
| "table wasn’t found" | Run `schema.sql` in the Supabase SQL editor. |
| "Supabase rejected the key" | Re-copy the **anon** key into `js/config.js`. |
| "Blocked by Row Level Security" | Make sure the read/write policies from `schema.sql` ran. |
| Blank page / library error | You're offline or a CDN is blocked — reload with a connection. |
