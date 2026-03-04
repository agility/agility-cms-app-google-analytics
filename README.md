# Google Analytics App for Agility CMS

An Agility CMS app that integrates Google Analytics 4 (GA4) data directly into your CMS dashboard — view traffic, user engagement, and page metrics without leaving Agility.

**Documentation:** https://agilitycms.com/docs/apps/google-analytics

---

## Features

- **Home Dashboard** — View active users, new users, page views, and average engagement time with interactive line charts
- **OAuth 2.0 Authentication** — Securely connect your Google account via Google's OAuth flow
- **GA4 Property Selection** — Choose which GA4 account and property to pull data from during install
- **Configurable Date Ranges** — Toggle between last 7 days, 30 days, and 365 days

## Tech Stack

- [Next.js](https://nextjs.org/) 13 (App Router disabled — Pages Router)
- [Agility App SDK](https://agilitycms.com/docs/apps) v2
- [Google Analytics Data API](https://developers.google.com/analytics/devguides/reporting/data/v1) (GA4)
- [Google APIs Node.js Client](https://github.com/googleapis/google-api-nodejs-client)
- [Recharts](https://recharts.org/) for data visualization
- [Tailwind CSS](https://tailwindcss.com/) + [Agility Plenum UI](https://github.com/agility/plenum-ui)

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Google Cloud project with the **Google Analytics Data API** and **Google Analytics Reporting API** enabled
- OAuth 2.0 credentials (Client ID + Client Secret) from Google Cloud Console

### Environment Variables

Create a `.env.local` file in the `v1/` directory:

```env
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Install & Run

```bash
cd v1
yarn install
yarn dev
```

The app runs at `http://localhost:3000`.

The app definition file is served at `/.well-known/agility-app.json` with CORS headers so Agility CMS can discover it.

---

## App Structure

```
v1/
├── pages/
│   ├── index.tsx                   # App landing page
│   ├── install.tsx                 # Install screen — GA4 account/property picker
│   ├── pages-dashboard.tsx         # Pages dashboard (in progress)
│   ├── content-dashboard.tsx       # Content dashboard (in progress)
│   ├── page-sidebar.tsx            # Page sidebar panel (in progress)
│   ├── content-list-sidebar.tsx    # Content list sidebar (in progress)
│   ├── content-item-sidebar.tsx    # Content item sidebar (in progress)
│   └── api/
│       ├── get-auth-url.ts         # Returns Google OAuth URL
│       ├── get-ga-access-token.ts  # Exchanges auth code for tokens
│       ├── get-auth-token.ts       # Retrieves stored auth token
│       ├── get-ga-accounts.ts      # Lists GA4 accounts
│       ├── get-ga-properties.ts    # Lists GA4 properties for an account
│       ├── get-ga-views.ts         # Lists GA4 views
│       ├── get-ga-home-dashboard.ts # Fetches dashboard metrics from GA4 Data API
│       └── app-uninstall.ts        # Handles app uninstall cleanup
├── components/
│   ├── GoogleAnalyticsPanel.tsx    # Metric summary card (users, page views, etc.)
│   ├── GoogleLineChart.tsx         # Recharts line chart wrapper
│   ├── DurationPicker.tsx          # Date range selector
│   ├── ComboBox.tsx                # Searchable dropdown
│   ├── GoogleAnalyticsLogo.tsx     # GA logo component
│   └── Loader.tsx                  # Loading spinner
├── lib/
│   ├── get-oauth2-client.ts        # Creates a configured Google OAuth2 client
│   └── get-authenticated-client.ts # Returns an authenticated client using stored tokens
├── public/
│   └── .well-known/agility-app.json  # Agility app manifest
└── constants.ts                    # Shared constants (chart duration values)
```

## How It Works

1. **Install** — The user connects their Google account via OAuth and selects a GA4 account and property. The selected `accountId` and `profileId` are saved as app configuration values in Agility.

2. **Authentication** — Subsequent requests use the stored OAuth tokens (access + refresh) to authenticate directly with Google APIs server-side.

3. **Dashboard** — The home dashboard calls `/api/get-ga-home-dashboard` which uses the GA4 Data API to fetch time-series metrics (active users, new users, page views, engagement time) for the configured property.

## Deployment

Deploy the `v1/` directory as a standard Next.js app (Vercel, Railway, etc.). Set the environment variables and register your OAuth redirect URI in Google Cloud Console to match your deployed URL.

Once deployed, register the app in Agility CMS using the URL to your `/.well-known/agility-app.json` manifest.
