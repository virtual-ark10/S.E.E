# Keyword Planner (Google Ads API) setup

S.E.E can fetch keyword ideas and search volume from Google Keyword Planner via the Google Ads API. This is optional.

## 1. Prerequisites

- A **Google Ads account** (you don’t need to run ads).
- A **Google Cloud project** with the Google Ads API enabled.

## 2. Get credentials

### Developer token

1. In [Google Ads](https://ads.google.com), go to **Tools & settings → API Center**.
2. Apply for a developer token (basic access is enough for Keyword Planner).
3. Copy the **Developer token** into `.env` as `GOOGLE_ADS_DEVELOPER_TOKEN`.

### OAuth client (Client ID + Secret)

1. In [Google Cloud Console](https://console.cloud.google.com), create or select a project.
2. Enable the **Google Ads API**.
3. Go to **APIs & Services → Credentials** and create **OAuth 2.0 Client ID** (Desktop or Web).
4. Copy **Client ID** and **Client secret** into `.env` as `GOOGLE_ADS_CLIENT_ID` and `GOOGLE_ADS_CLIENT_SECRET`.

### Refresh token

1. Use Google’s OAuth 2.0 Playground or a small script to sign in with the same Google account that has access to your Google Ads account.
2. Request scope: `https://www.googleapis.com/auth/adwords`.
3. Exchange the authorization code for tokens and copy the **Refresh token** into `.env` as `GOOGLE_ADS_REFRESH_TOKEN`.

### Customer ID

1. In Google Ads, the **Customer ID** is in the top-right (format `123-456-7890`).
2. Put it in `.env` as `GOOGLE_ADS_CUSTOMER_ID` (with or without dashes).

## 3. .env variables

```env
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_developer_token
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
GOOGLE_ADS_CUSTOMER_ID=1234567890
```

## 4. Use in S.E.E

- Open **Admin → Keyword Research** (`/admin/keywords`).
- Enter one or more **seed keywords** (comma-separated), choose max results, and click **Get ideas**.
- Results show keyword text, average monthly searches, and competition.

## 5. Config

In `config/default.json`, under `integrations.keywordPlanner`:

- `enabled: true` – allow Keyword Planner (default).
- `enabled: false` – disable the feature and API.

If any of the env vars above are missing, the admin page shows “Not configured” and the Get ideas button is disabled.
