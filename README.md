# S.E.E — SEO Engine Extraction

S.E.E is a **self-hosted SEO article generation engine** with:

- An **admin dashboard** to manage articles, entities, and settings
- A **public blog** (`/blog`) that renders published articles
- An **AI generation pipeline** (OpenRouter) for drafting articles in HTML
- Optional integrations for **Google Indexing API** and **Google Keyword Planner** (Google Ads API)

## What it does (high level)

- You manage a database of **Entities** (restaurants, car hires, etc.) in MongoDB.
- S.E.E generates or drafts **Articles** using AI, optionally grounding output with entities from the database.
- You edit/publish in the admin UI; published articles appear on the public blog.
- It generates `sitemap.xml` and `robots.txt` for SEO.

## Tech stack

- **Node.js** (ES Modules)
- **Express** web server
- **MongoDB** via **Mongoose**
- **EJS** templates (admin + blog)
- **OpenRouter** (AI chat completions)
- Optional: **Google Ads API** (Keyword Planner ideas) via `google-ads-api`
- Optional: **Google Indexing API** via `googleapis`

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

Add your license here.

