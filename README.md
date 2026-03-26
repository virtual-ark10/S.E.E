# S.E.E — SEO Engine

S.E.E (SEO Engine Extraction) is a **self-hosted, vertical-agnostic content engine** designed for SEO operators who want to scale **topic clusters** without losing control of on-page structure, internal linking, and publishing workflows.

It combines:

- A **clean admin dashboard** for managing entities, articles, prompts, categories, and CTAs
- A **public blog** (`/blog`) that serves published content with modern on-page UX
- An **AI generation pipeline** (OpenRouter) that produces **HTML-first** drafts (headings, lists, paragraphs) suitable for immediate editing + publishing
- **Pillar / cluster classification** (pillar guides + supporting cluster articles) to support topical authority building
- **Conceptual interlinking**: related-article discovery + in-body internal link injection to strengthen cluster topology
- A built-in **scheduler** for automated article generation and age-based archival (traffic-aware)
- Optional integrations for **Google Indexing API** and **Google Keyword Planner** (Google Ads API)

## What it does (high level)

In practice, S.E.E helps you run a repeatable SEO pipeline:

- Build and maintain a structured dataset of **Entities** (e.g., restaurants, services, locations) in MongoDB.
- Generate **draft articles** with AI, optionally grounding output in your entity dataset for specificity.
- Classify content as **pillar** (broad, comprehensive guides) or **cluster** (supporting long-tail pages) and keep relationships explicit.
- Publish from the admin UI to a fast, clean blog, with **sitemap.xml** + **robots.txt** handled for you.
- Strengthen topical clusters via **related-article modules** and **internal-link injection** on article pages.
- Automate **generation** and **archival** via scheduling (so your content program keeps moving even when you’re not in the UI).

### Optional SEO operator workflows (integrations)

If you enable the optional integrations, S.E.E can also cover two common “ops” loops:

- **Keyword discovery (Google Keyword Planner / Google Ads API)**: use `/admin/keywords` to generate keyword ideas + volume/competition from seed terms, then use those ideas to decide pillar + cluster targets for your next content batch.
- **Faster indexing (Google Indexing API)**: automatically submit URLs to Google when an article transitions to `published` (and optionally submit deletion when archiving/deleting), reducing the manual overhead of “publish → wait → check indexing.”

## Prompts (how article generation is controlled)

S.E.E’s generation is prompt-driven and designed to be **repeatable across verticals**:

- **Two base templates**:
  - **Pillar** prompt (comprehensive guide): `src/prompts/templates/pillar/comprehensive-guide.template.js`
  - **Cluster** prompt (focused article): `src/prompts/templates/cluster/focused-article.template.js`
- **Prompt variables** come from `config/default.json → promptVariables` (e.g. `PLATFORM_NAME`, `ENTITY_TYPE`, `ENTITY_PLURAL`, `INDUSTRY_CONTEXT`, `DEFAULT_LOCATION`) and are merged into generation options by `src/prompts/promptLoader.js`.
- **Category-specific behavior** comes from `config/default.json → categoryOverrides[category]`:
  - `categorySpecificInstructions`
  - `suggestedSections`
  - optional structure/focus overrides

### Customization use cases (examples)

- **Switch verticals** (restaurants → car hire → SaaS directories): update `entityType/entityPlural`, `fieldMappings`, and category maps; generation and entity formatting adapt without rewriting core logic.
- **Different SERP intent per category**: make “reviews” follow a pros/cons/rating structure while “guides” emphasize comparisons and tips via `categoryOverrides`.
- **Brand voice + constraints**: change `promptVariables.INDUSTRY_CONTEXT` and add a custom system prompt (via settings) to enforce tone, formatting rules, and editorial standards.

In short: templates provide consistency, config provides per-vertical control, and overrides let you push category-level intent and structure.

## Quick start

1) Install dependencies:

```bash
npm install
```

2) Create `.env` (example keys are listed in the existing `.env` file in this repo; do not commit secrets).

Minimum required to run locally:

- `MONGODB_URI`
- `OPENROUTER_API_KEY` (required only if you use AI generation)

3) Run:

```bash
npm run dev
```

Open:

- Admin: `http://localhost:4000/admin`
- Blog: `http://localhost:4000/blog`
- Health: `http://localhost:4000/test`

## Configuration (domain/vertical)

S.E.E is “vertical-agnostic” via `config/default.json`, loaded by `config/loader.js`.

Key config fields:

- **Branding**: `platformName`, `baseUrl`
- **Vertical**: `domain`, `entityType`, `entityPlural`, `defaultLocation`
- **Entity mapping**: `fieldMappings`
- **Category mapping**: `categoryHierarchy`, `directCategoryMap`
- **Content controls**: `articleCategories`, `articleTypes`, `categoryOverrides`
- **CTA buttons**: `cta.enabled`, `cta.mainCTA`, `cta.entityCTA`
- **Integrations**: `integrations.googleIndexing`, `integrations.keywordPlanner`

The admin **Settings** page edits `config/default.json` through API endpoints and reloads config in-process.


## Routes

### Admin UI (server-rendered)

Mounted under `/admin`:

- `GET /admin` and `GET /admin/dashboard`: dashboard + stats
- `GET /admin/articles`: list
- `GET /admin/articles/new`: editor
- `GET /admin/articles/edit/:id`: editor
- `GET /admin/entities`: list
- `GET /admin/entities/import`: CSV import page
- `GET /admin/settings`: settings UI
- `GET /admin/keywords`: Keyword Research (Google Keyword Planner)

### API (JSON)

Mounted under `/api`:

**Articles**

- `POST /api/articles`: create
- `PUT /api/articles/:id`: update
- `DELETE /api/articles/:id`: delete
- `POST /api/articles/:id/publish`: publish
- `POST /api/articles/:id/archive`: archive
- `POST /api/articles/generate`: AI draft generation
- `POST /api/articles/upload-image`: upload featured image to `uploads/images`
- `GET /api/articles/scheduler-status`: scheduler status
- `POST /api/articles/archive-old`: archive old low-traffic articles

**Entities**

- `POST /api/entities`: create
- `PUT /api/entities/:id`: update
- `DELETE /api/entities/:id`: delete
- `GET /api/entities/:id`: fetch entity JSON
- `POST /api/entities/import-csv`: CSV import

**Settings**

- `POST /api/settings/general`
- `POST /api/settings/cta`
- `POST /api/settings/prompts`
- `POST /api/settings/categories`
- `GET /api/settings/config`

**Keyword Planner**

- `GET /api/keywords/status`
- `POST /api/keywords/ideas`

### Public blog

- `GET /blog`: blog listing (published only)
- `GET /blog/:slug`: article page (published only)
- `GET /sitemap.xml`: sitemap of published articles
- `GET /robots.txt`: robots file (disallows `/api` and `/admin`)

## Core concepts

### Articles

Stored in MongoDB (`src/models/Article.js`).

Key fields:

- `title`, `slug`, `content`, `excerpt`, `featuredImage`
- `category`, `articleType`, `location`
- `tags`, `seoMetaDescription`, `seoKeywords`, `primaryKeyword`
- `status`: `draft` | `published` | `archived`
- Pillar/cluster linking: `isPillarContent`, `pillarContentId`, `topicCluster`

### Entities

Stored in MongoDB (`src/models/Entity.js`) as a generic schema with `metadata` for vertical-specific fields.

Entities can be imported from CSV (`src/controllers/entityController.js`).

### AI generation

Main flow:

- `src/controllers/articleController.js` → `/api/articles/generate`
- `src/core/articleScheduler.js` / `src/core/articleGenerator.js`
- `src/prompts/promptLoader.js` selects templates:
  - `src/prompts/templates/pillar/*`
  - `src/prompts/templates/cluster/*`
- `src/ai/openrouter.js` calls OpenRouter
- Post-processing:
  - CTA placeholders replaced via `injectCTAButtons()`
  - Slug derived from title
  - Excerpt extracted from first `<p>`
  - Tags/keywords derived from the generated HTML content

Environment variables that affect AI:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_MAX_TOKENS` (optional)
- `OPENROUTER_TEMPERATURE` (optional)

## Keyword Planner (KP) integration

Keyword research UI: **`/admin/keywords`**

- Backend: `src/services/keywordPlanner.js` + `src/controllers/keywordController.js`
- Setup guide: `docs/KEYWORD-PLANNER-SETUP.md`

This integration uses the **Google Ads API** (Keyword Plan Idea Service) and requires OAuth + a developer token.

## Scheduler

If `ENABLE_ARTICLE_SCHEDULER=true`, the app will:

- Generate daily at 9AM
- Archive weekly on Sundays at midnight

Scheduler logic lives in `src/core/articleScheduler.js`.

## Repository layout (what each folder is for)

- `app.js`: Express bootstrap, Mongo connection, route mounts
- `config/`: domain config (`default.json`) + loader
  - `config/examples/`: sample vertical configs
- `docs/`: internal docs/specs
  - `KEYWORD-PLANNER-SETUP.md`: Google Ads API setup
  - `SERP-TOPIC-SCORER-SPEC.md`: future SERP scoring tool spec
- `public/`: static assets
  - `public/css/admin.css`: admin styling
- `src/`
  - `adapters/`: database/service adapters (entity queries, Mongo connection helper)
  - `ai/`: AI provider integration (`openrouter.js`)
  - `controllers/`: Express handlers (admin views + API endpoints)
  - `core/`: generation engine, scheduler, internal linking
  - `formatters/`: formatting entities for AI prompts
  - `models/`: Mongoose models
  - `prompts/`: prompt loader and templates
  - `routes/`: Express route definitions
  - `services/`: external integrations (Google indexing, keyword planner)
  - `utils/`: SEO helpers, sanitization, logging, TOC generation
- `uploads/`: uploaded images (served under `/uploads`)
- `views/`: EJS templates for admin/blog

## Security notes

- Do **not** commit `.env` (this repo’s `.gitignore` ignores it).
- Consider enabling `ARTICLE_API_KEY` if you expose generation endpoints publicly. The admin UI does not send `x-api-key` by default.

## License

MIT. See `LICENSE`.

