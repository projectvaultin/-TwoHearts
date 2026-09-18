# TwoHearts Supabase setup

The browser app requires two public Supabase build variables:

- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — your Supabase publishable/anon key

Do **not** commit `.env` or a service-role key.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in the two `VITE_` values.
3. Run `npm install`.
4. Run `npm run dev`.

## Vercel / other Vite hosting

Add the same two variables in the hosting provider's Environment Variables, then redeploy/rebuild.

## GitHub Pages

A normal GitHub Pages static deployment cannot receive private build-time environment variables automatically. Use a GitHub Actions build that supplies the two `VITE_` variables as repository/environment secrets, or use Vercel/Netlify.

The Supabase URL and anon/publishable key are intended for frontend use. Never put `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
