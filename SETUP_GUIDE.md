# Safety Tracker v1 — setup guide

This is a separate app. Do not run its SQL against Inventory Tracker.

## 1. Create a separate Supabase project
Create a new Supabase project for Safety Tracker.

## 2. Run the schema
Open Supabase -> SQL Editor -> New query.
Paste all of `supabase/schema.sql` and run it.

## 3. Create the first administrator
In Supabase -> Authentication -> Users, create your first user.
Then run this in SQL Editor, replacing the email:

```sql
update public.profiles
set role='admin', active=true
where email='YOUR-ADMIN-EMAIL';
```

## 4. Configure the website
In Supabase -> Project Settings/API, copy the Project URL and Publishable/Anon key.
Open `config.js` and replace the two placeholder values.
Never put the service-role/secret key in `config.js`.

## 5. Deploy the invite-user Edge Function
Supabase -> Edge Functions -> Deploy new function -> Via Editor.
Name it exactly `invite-user`.
Replace the generated `index.ts` with `supabase/functions/invite-user/index.ts` and deploy.

If calls are rejected before the function runs, open the function settings and disable the legacy platform JWT verification for this function. The function verifies the caller and Admin role itself.

## 6. Authentication URLs
After GitHub Pages is set up, set Supabase Authentication -> URL Configuration:
- Site URL: your Safety Tracker GitHub Pages URL
- Redirect URL: the same URL

## 7. GitHub Pages
Create a NEW repository, suggested name: `safety-tracker`.
Upload these files to the repository root:
- index.html
- app.js
- styles.css
- config.js
- sw.js
- manifest.webmanifest

Enable GitHub Pages from the main branch / root.

## 8. First test
1. Sign in as Admin.
2. Invite one test user.
3. Upload one Risk Assessment with version + review date.
4. Assign it to the test user and choose a sign-off frequency.
5. Create one Ad-hoc Training session, upload supporting material, assign it to the same user.
6. Sign in as that user and complete both sign-offs.
7. Check Reports.

## Important
The app records acknowledgements and training sign-offs as evidence. It does not create or approve your underlying H&S documents and is not a substitute for appropriate training, supervision or competent H&S advice.
