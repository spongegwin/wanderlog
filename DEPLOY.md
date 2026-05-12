# Deploy checklist

Run through this before / after every production deploy.

## 1. Source of truth

- [ ] `git remote -v` in local checkout matches the repo Vercel deploys from
  - Vercel project: `waypoint` → reads from `github.com/spongegwin/wanderlog`
  - Local push must reach that repo, not `spongegwin/waypoint` (old monorepo)
- [ ] `git push` succeeded (no GitHub push protection blocks for secrets)
- [ ] Vercel triggered a build for the latest commit (`vercel ls waypoint`)

## 2. Vercel project settings

- [ ] Root Directory matches where `package.json` lives in the deployed repo
- [ ] Framework Preset = Next.js
- [ ] Node Version is current LTS (24.x)
- [ ] Production branch = `main` (or whichever branch is the source)

## 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Required for Production **and** Preview:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `ANTHROPIC_API_KEY`

Server-only (do NOT prefix with `NEXT_PUBLIC_`):

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — only if you run seed scripts in CI/cron; never expose to the client

Verify with `vercel env ls` after linking the local repo.

## 4. Supabase Auth URLs (Supabase Dashboard → Authentication → URL Configuration)

This is the one that bit me. OAuth providers ignore `redirectTo` if the URL isn't in the allowlist and silently fall back to **Site URL**.

- [ ] **Site URL**: canonical production URL, e.g. `https://waypoint-zeta-steel.vercel.app`
- [ ] **Redirect URLs** include:
  - `https://waypoint-zeta-steel.vercel.app/**` (production)
  - `https://waypoint-*-gwins-projects-96dd5a02.vercel.app/**` (preview deploys)
  - `http://localhost:3000/**` (local dev)
- [ ] If you add a custom domain later, add it here too — otherwise OAuth bounces back to the old `*.vercel.app` URL

## 5. Google OAuth (Google Cloud Console → APIs & Services → Credentials)

Only matters if you ever bypass Supabase's hosted Google provider. With Supabase-hosted, only Supabase's callback (`https://<project-ref>.supabase.co/auth/v1/callback`) needs to be authorized — set once.

## 6. Secret hygiene (before pushing)

- [ ] `git grep -E 'sk_|sb_secret|sb_publishable|api[_-]?key|Bearer ' -- 'src' 'scripts'` returns no real secrets
- [ ] No `.env` files staged (`git status` should not show `.env*`)
- [ ] All admin scripts read keys from `process.env`, never literals
- [ ] If a secret was ever committed (even to a private repo), rotate it

## 7. Smoke test the live site

```bash
PROD=https://waypoint-zeta-steel.vercel.app

# 1. Root should redirect unauth'd users to /login (307), not 404
curl -sI $PROD/ | head -3

# 2. Login page should be 200
curl -sI $PROD/login | head -3

# 3. An API route should respond (will be 400/401, just NOT 404)
curl -sI $PROD/api/plan-assist | head -3

# 4. Watch for x-vercel-error header — it should NOT appear
curl -sI $PROD/ | grep -i x-vercel-error
```

Then in a browser:

- [ ] `/` redirects to `/login` when logged out
- [ ] Google OAuth round-trip lands on `/api/auth/callback?code=...` (NOT `/` with code) and then on `/`
- [ ] `/` lists trips (Supabase connection works)
- [ ] Creating a trip, adding a block, AI parse routes all succeed

## 8. After-deploy

- [ ] `vercel logs <deployment-url>` shows no errors during the smoke test
- [ ] If something is broken, check the response's `x-vercel-error` header BEFORE reading code:
  - `NOT_FOUND` → deployment plumbing (wrong source repo, wrong root dir, no functions emitted)
  - `FUNCTION_INVOCATION_FAILED` → runtime error in a route (missing env var, throw on cold start)
  - `DEPLOYMENT_NOT_FOUND` → alias points at a deleted deployment

---

**The mental model:** the bug is usually not in your code. It's in *which repo deploys, which env vars are set, and where OAuth providers are allowed to redirect.* Check those three before reading source.
