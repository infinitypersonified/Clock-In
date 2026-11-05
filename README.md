# Clock in
1. Create a Supabase project, then run `supabase.sql` in the SQL Editor.
2. Create a `.env` file with your Supabase Project URL and anon key:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. `npm install` then `npm run dev`
4. In the app, choose **New here? Create an account** and enter the admin's name, email, and password first. The first account becomes the employer. Employees can use the same sign-up link to create their own accounts; later accounts are assigned the employee role.
5. If the admin account already exists but has the employee role, promote it in the SQL Editor, replacing the example email:
   ```sql
   update public.profiles
   set role = 'employer'
   where id = (select id from auth.users where email = 'admin@example.com');
   ```
6. Deploy: push to GitHub, import in Vercel, and add the same two environment variables.

Sign-up is open to anyone with access to the app, and anyone signing up after the first account becomes an employee. For password-reset links, set the app URL under Supabase > Authentication > URL Configuration. If email confirmation is enabled, users must confirm their email before signing in. If sign-up returns a rate-limit error, wait before retrying; repeated attempts will not bypass the limit.
