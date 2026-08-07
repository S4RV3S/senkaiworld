# Senkai World CMS — Setup Guide

Writers log in at `/admin/login`, fill a form (title, thumbnail, SEO fields,
rich-text content — no Markdown), hit Publish, and the post is live
immediately at its own URL and in the RSS feed. No rebuild, no Git push.

## How it works

- **Database:** Cloudflare D1 stores `users`, `sessions`, `posts`.
- **Images:** Cloudflare R2 stores thumbnails, served via the bucket's public URL.
- **Editor:** Quill.js (loaded via CDN, no extra build step) — a normal
  formatting toolbar, saves as HTML.
- **Categories:** the CMS currently manages **News, Reviews, and Rankings**
  only. Anime and Manhwa keep being edited as Markdown files under
  `src/content/`, because those pages render structured fields (studio,
  episodes, score, chapters...) that a generic post form doesn't collect.
  Extending the CMS to them later just means adding those fields to
  `posts` and the form — see `src/lib/cms/posts.ts`.
- **URLs:** existing Markdown articles keep their current URLs
  (`/news/<slug>`, `/reviews/<slug>`, `/rankings/<slug>`) and stay fully
  static, exactly as before — nothing about them changed. CMS-published
  posts live at a separate path — `/news/post/<slug>`,
  `/reviews/post/<slug>`, `/rankings/post/<slug>` — which is
  server-rendered from D1 on every request. This split is intentional:
  Astro's `@astrojs/sitemap` integration only knows about pages that were
  actually generated as static files at build time, so converting the
  existing Markdown routes to on-demand rendering would have silently
  dropped **all** of them (not just new posts) out of `sitemap-index.xml`.
  Keeping them on separate paths avoids that regression entirely.
- The `/news`, `/reviews`, `/rankings` listing pages — and the homepage's
  "Latest News" widget — stay static builds of the Markdown content (same
  as before, still in the sitemap), and each has a small client-side
  script that fetches newly published CMS posts from
  `/api/public/posts?category=...`, merges them with the already-rendered
  Markdown cards by date (via a `data-date` attribute on each card), and
  re-sorts the grid — so a new CMS post lands in the right chronological
  spot instead of always jumping to the top. The homepage widget also caps
  itself back down to 6 cards after merging, matching its original size.
- **`sitemap-posts.xml`** is a second, independently dynamic sitemap
  (queried live from D1, `prerender = false`) listing every published CMS
  post, referenced via its own `Sitemap:` line in `public/robots.txt`
  alongside the existing static `sitemap-index.xml`. Search engines are
  fine with multiple declared sitemaps — this way new CMS posts get
  crawled without touching (or risking) the build-time sitemap that the
  Markdown pages rely on.

## One-time Cloudflare account setup

1. **Install Wrangler** (already added as a dev dependency) and log in:
   ```bash
   npx wrangler login
   ```

2. **Create the D1 database:**
   ```bash
   npx wrangler d1 create senkai-cms
   ```
   Copy the printed `database_id` into `wrangler.toml` (replace
   `PASTE_YOUR_DATABASE_ID_HERE`).

3. **Run the schema** against the remote database:
   ```bash
   npx wrangler d1 execute senkai-cms --remote --file=./migrations/schema.sql
   ```

4. **Create the R2 bucket:**
   ```bash
   npx wrangler r2 bucket create senkai-images
   ```
   Then connect a **custom domain** (e.g. `images.senkaiworld.in`) —
   **don't** use the `r2.dev` public development URL for production.
   Cloudflare's own docs are explicit that `r2.dev` "does not support
   cache management features" at all: no Cache Rules, no edge caching
   control, full stop. A custom domain puts the bucket behind Cloudflare's
   normal cache/CDN layer instead, which is required for the cost
   protection in step 7 below to do anything.

   In the dashboard: **R2 → `senkai-images` → Settings → Custom Domains →
   Add** → enter `images.senkaiworld.in` → **Connect Domain**. Since
   `senkaiworld.in` is already on Cloudflare, the DNS record is created
   automatically and the domain goes "Active" within a minute or two.

   Set `R2_PUBLIC_URL` in `wrangler.toml` to `https://images.senkaiworld.in`
   (no trailing slash).

5. **Regenerate local types** after editing `wrangler.toml`:
   ```bash
   npx wrangler types
   ```

6. **Create your first admin user:**
   ```bash
   node scripts/create-user.mjs "you@email.com" "Your Name" "yourpassword"
   ```
   This prints two `wrangler d1 execute` commands — run the `--remote`
   one to create the account in production, and the `--local` one if you
   want to log in during local dev too.

7. **Add a Cache Rule for the image domain** — this is the main lever for
   keeping R2 costs flat as traffic grows: once an image is cached at an
   edge node, repeat views for anyone near that node are served straight
   from Cloudflare's cache and never touch R2 (no Class B operation, no
   egress). Every upload already gets a 60-day `Cache-Control` header
   (see `src/pages/api/upload.ts`), but that header only matters if
   something is actually configured to honor it at the edge — hence this
   step.

   Dashboard → your zone (`senkaiworld.in`) → **Caching → Cache Rules →
   Create rule**:
   - **Rule name:** `Cache R2 images`
   - **When incoming requests match:** custom filter → `Hostname` `equals`
     `images.senkaiworld.in`
   - **Then:**
     - **Cache eligibility:** Eligible for cache
     - **Edge TTL:** "Use cache-control header if present, use default
       Cloudflare caching behavior if not" — this makes the Cache Rule
       agree with the 60-day header already set at upload time, while
       still guaranteeing the response is cache-eligible even if a future
       code change ever forgets to set the header. (If you'd rather not
       depend on the header at all, pick "Ignore cache-control header and
       use this TTL" and set it directly to 30–90 days instead — simpler,
       but then the TTL lives in two places instead of one.)
     - **Browser TTL:** Respect origin (the 60-day header already covers
       this)

   This rule is what actually makes new edge nodes cache the image on
   their *first* request for it — "eligible for cache" + a TTL is what
   populates a PoP's cache, not just the response header alone.

## Local development

`astro dev` (per this project's `CLAUDE.md`: `astro dev --background`)
runs on Cloudflare's `workerd` runtime and automatically emulates the D1
and R2 bindings declared in `wrangler.toml` — no extra setup or separate
`wrangler pages dev` command needed. Local D1/R2 data persists in
`.wrangler/` between runs (gitignored).

## Deploying to production

This doesn't change your existing deploy flow (Git push → Cloudflare
Pages builds and deploys `dist/`). The only thing to double check once,
after your first deploy with this change:

- Go to your Cloudflare Pages project → **Settings → Functions** and
  confirm the `DB` (D1) and `MEDIA` (R2) bindings are present for the
  **Production** environment, plus the `R2_PUBLIC_URL` variable. Recent
  Cloudflare Pages versions pick these up automatically from a committed
  `wrangler.toml`, but if the admin pages 500 in production after
  deploying, add the same bindings manually here — the binding names must
  match `wrangler.toml` exactly (`DB`, `MEDIA`, `R2_PUBLIC_URL`).

## Using the CMS day-to-day

- Go to `senkaiworld.in/admin/login` and log in.
- Click **+ New Post**.
- Fill in: Title, Category (News / Reviews / Rankings), Thumbnail
  (upload), Excerpt (optional — auto-generated from the content if left
  blank), Score (Reviews only), SEO title/description (optional, default
  to the title/excerpt), and the rich-text Content.
- **Save draft** keeps it private; **Publish** makes it live immediately
  at `/<category>/post/<slug>`, in the category listing page, and in
  `rss.xml`.
- From the dashboard you can **Edit** or **Delete** any post, and
  **View** any published one.

## Cost protection & usage monitoring

The Cache Rule above is the actual cost lever — cached image requests never
reach R2 at all, so operations stay flat regardless of how much *repeat*
traffic you get. The rest of this section is about staying informed, since
**Cloudflare has no automatic spend cutoff for R2 or Workers** — nothing
will pause your site if you somehow blow through free tier, so alerts +
manual checks are the only safety net available today.

**Free tier limits you're protecting:**
| Product | Free allowance |
|---|---|
| R2 storage | 10 GB-month / month |
| R2 Class A operations (writes, uploads, list) | 1,000,000 / month |
| R2 Class B operations (reads/downloads not served from cache) | 10,000,000 / month |
| Workers requests | 100,000 / **day** (resets midnight UTC — not monthly) |

### Setting up alerts

Cloudflare doesn't currently offer a per-product, percentage-of-free-tier
alert (e.g. "notify me at 70% of R2 Class B ops") — that granularity just
isn't a feature yet, on any plan. The closest native tool is **Budget
Alerts**, which is dollar-based and account-wide rather than per-product:

1. Dashboard → **Manage Account → Billing → Billable Usage → Create budget
   alert**.
2. **Note:** Budget Alerts require a Pay-as-you-go account — i.e. a
   payment method on file — even if you never actually exceed the free
   tier and get charged $0. If you haven't added one yet, you'll need to
   before this option appears.
3. You can create **multiple alerts at different dollar thresholds** (the
   button shows a count of how many you've configured) — e.g. stage them
   at **$1** (your effective early-warning: any spend at all means you've
   already exceeded at least one free-tier limit that month), **$10**,
   and **$50**, instead of only finding out at whatever your card's limit
   is.
4. These are informational-only emails — they don't pause or cap
   anything, and they reflect **combined** usage-based spend across all
   pay-as-you-go products, not R2 or Workers individually.

### Checking usage manually (do this during any traffic test)

Since there's no true staged per-product alert, check these during load
testing or whenever traffic spikes:

- **R2 → `senkai-images` → Metrics tab** — live storage size and
  Class A/B operation counts for this specific bucket. The most direct
  way to watch R2 usage in real time.
- **Workers & Pages → your Pages project → Metrics** — request counts,
  broken into successful/errored/subrequests. Compare the "Total" number
  against the 100,000/day cap.
- **Manage Account → Billing → Billable Usage** — the account-wide daily
  view used to generate your invoice. Shows each product's usage against
  its included free-tier allowance (e.g. "620K of 1M Class A ops
  included") side by side with any billable overage and its dollar cost.
  Updated daily, not real-time.

If you want something closer to true staged alerts (e.g. an email at 70%
and 90% of R2 Class B ops specifically), that would mean building a small
scheduled Worker that queries Cloudflare's GraphQL Analytics API for your
current usage and emails/webhooks you when it crosses thresholds you
define — happy to build that as a follow-up if you want it; it's outside
what Cloudflare's dashboard can do out of the box.

## Known limitations / good follow-ups

- **No login rate-limiting.** Fine for a single-admin, low-traffic setup;
  worth adding (e.g. a basic attempt counter in D1) before handing out
  more writer accounts.
- **Adding more writers:** insert another row into `users` with
  `scripts/create-user.mjs` (role `writer`). An in-dashboard "invite
  writer" flow is a natural next step once this is live and tested.
