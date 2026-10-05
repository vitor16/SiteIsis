# Isis Avelar — Shared Nail Palette Backend

This package uses Supabase Auth + PostgreSQL RLS. GitHub Pages continues to host the static website; Supabase hosts the secure database/authentication backend.

## 1. Create the Supabase project

Create a project at https://supabase.com/.

In the Supabase dashboard, open **SQL Editor**, create a new query, paste the entire contents of `supabase_schema.sql`, and run it.

## 2. Create the owner account

In **Authentication → Users**, create a user with the email address you want to use for the private nail admin page.

Set its password to:

`323103Es`

After the user exists, copy its **User UID**.

In SQL Editor run:

```sql
insert into public.nail_admins (user_id)
values ('PASTE-THE-USER-UID-HERE');
```

Do not put the Supabase `service_role` key anywhere in the website. The browser only uses the project's publishable key.

## 3. Configure the website

Open `nail-backend.js` and replace these two placeholders:

```js
SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
SUPABASE_PUBLISHABLE_KEY: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
```

Use the **Project URL** and the browser-safe **Publishable key** from the Supabase project's API/Data API settings.

## 4. Upload to GitHub Pages

Upload these files to the same directory as the site's `index.html`:

- `index.html` (the updated simulator)
- `nail-backend.js`
- `nail-admin.html`

You can keep `nail-studio.js` and the site's other existing assets exactly as they are.

Because your custom domain already points to GitHub Pages, the private page will then be:

`https://studioisisavelar.com.br/nail-admin.html`

The page does not need to be linked from the public menu.

## 5. Supabase Auth URL

In **Authentication → URL Configuration**, set the site's URL to:

`https://studioisisavelar.com.br`

For a password login (`signInWithPassword`) no redirect is needed, but keeping the production site URL configured is recommended.

## 6. How the finished system works

The public simulator performs a read-only query for enabled colors. The database exposes only active colors to anonymous visitors.

The admin signs in with Supabase Auth. The database checks whether that authenticated UID exists in `nail_admins`. Only an authorized admin can read disabled colors or call the atomic palette-save function.

When you click **Salvar alterações**, the database replaces the shared palette in one transaction. The next visitor (or refresh) receives the same updated palette.

## Important security note

The password is not hard-coded in the HTML. Supabase stores the authentication credentials and issues the browser session. PostgreSQL Row Level Security prevents ordinary authenticated users from modifying the nail palette.
