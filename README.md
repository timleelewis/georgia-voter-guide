# ⚖️ Georgia Voter Guide

### Nonpartisan · AI-Powered · Open Source

> **Party labels have been removed from Georgia ballots. Redistricting has redrawn your district. This tool makes sure you still know exactly who you're voting for.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Built with React](https://img.shields.io/badge/Built%20with-React-61DAFB.svg)](https://react.dev)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-orange.svg)](https://anthropic.com)
[![Data: OpenStates](https://img.shields.io/badge/Data-OpenStates-blue.svg)](https://openstates.org)
[![Data: Google Civic](https://img.shields.io/badge/Data-Google%20Civic-red.svg)](https://developers.google.com/civic-information)

---

## What This Is

The Georgia Voter Guide is a free, nonpartisan web application that helps Georgia voters:

- **Identify candidates and their party affiliation** — even when party labels are removed from ballots
- **Find their congressional, state senate, and state house districts** — especially important after redistricting
- **See if their district changed** — compare old vs. new district boundaries after redistricting
- **Look up polling places, early voting sites, and ballot drop boxes** by address
- **See exactly who is on their ballot** before they vote
- **Understand candidates' policy positions** through AI-assisted, nonpartisan summaries

Built in response to Georgia legislation removing party labels from ballots and an ongoing special session to redraw congressional maps.

---

## Live Data Sources

| Source | What It Provides | Cost |
|---|---|---|
| [OpenStates / Plural API](https://openstates.org) | GA legislators, party, district, voting records | Free |
| [Google Civic Information API](https://developers.google.com/civic-information) | Polling places, early voting, ballot candidates, representatives | Free (25k/day) |
| [Claude AI (Anthropic)](https://anthropic.com) | Candidate summaries, policy positions | ~$1-5/month |
| [Supabase](https://supabase.com) | User auth, usage tracking, access windows | Free tier |

---

## Key Features

### 🔍 Candidate Lookup
Search any Georgia candidate by name and get their verified party affiliation, current office, district, and factual policy positions — sourced from live legislative data first, AI training data as fallback.

### 📍 My Representatives
Enter your Georgia address and instantly see every elected official who represents you — from U.S. Congress down to state legislature — with party and contact info.

### 🗺️ Did My District Change?
Enter your address to see your exact congressional, state senate, and state house districts pulled live from Google Civic. Shows what changed after Georgia's redistricting and links directly to official verification sources.

### 🗓️ Election Dates & Logistics
Real-time election deadlines, early voting dates, polling hours, voter ID requirements, and absentee ballot information.

### 🛡️ Built-in Protections
- Voter suppression queries blocked
- Election fraud assistance blocked
- Rate limiting (20 requests/hour per IP)
- Input sanitization and prompt injection prevention
- AI response validation
- Row-level security on all user data

---

## Tech Stack

```
Frontend       React 18 + Vite
Backend        Vercel Serverless Functions (Node.js)
Database       Supabase (PostgreSQL + Auth)
AI             Anthropic Claude Sonnet 4.6
Live Data      OpenStates API + Google Civic Information API
Hosting        Vercel (free tier)
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A GitHub account
- Free accounts at: Supabase, Vercel, Anthropic, Google Cloud, OpenStates

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR-USERNAME/georgia-voter-guide.git
cd georgia-voter-guide
npm install
```

### 2. Set Up Environment Variables
```bash
cp .env.example .env.local
```
Fill in your keys — see `.env.example` for where to get each one.

### 3. Set Up Supabase
1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → run the contents of `supabase/schema.sql`
3. Copy your Project URL and anon key into `.env.local`

### 4. Run Locally
```bash
npm run dev
```
Visit `http://localhost:5173`

### 5. Deploy
Connect your GitHub repo to [Vercel](https://vercel.com), add your environment variables, and deploy. See `SETUP.md` for the full step-by-step guide.

---

## API Keys Required

| Variable | Where to Get It | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Pay per use |
| `GOOGLE_CIVIC_API_KEY` | [console.cloud.google.com](https://console.cloud.google.com) | Free |
| `OPENSTATES_API_KEY` | [open.pluralpolicy.com](https://open.pluralpolicy.com) | Free |
| `VITE_SUPABASE_URL` | Supabase → Settings → API Keys | Free |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API Keys | Free |

---

## Access Model

| User Type | Access |
|---|---|
| New signup | 30-day free trial, 50 searches/day |
| During election window | Unlimited free access for all users |
| Donor | Extended access (configurable) |

Election windows are managed in Supabase — see `SETUP.md` for admin SQL commands.

---

## Contributing

This is an open-source civic project. Contributions welcome.

- **Bug reports** → open a GitHub Issue
- **Feature requests** → open a GitHub Issue with the `enhancement` label
- **Pull requests** → fork the repo, make your changes, submit a PR
- **Other states** → want to adapt this for your state? Fork it — the MIT license allows it

### Ideas for Contributors
- [ ] Add support for other states beyond Georgia
- [ ] Add candidate comparison side-by-side view
- [ ] Add bill tracking (what has my rep voted for?)
- [ ] Add multilingual support (Spanish, etc.)
- [ ] Add SMS alerts for election deadline reminders
- [ ] Add accessibility improvements (screen reader support)

---

## Nonpartisan Policy

This tool is strictly nonpartisan. The AI is instructed to:
- Never endorse any candidate or party
- Present both major parties equally
- Provide factual information only
- Clearly label AI-generated vs. live-verified data

Any contributions that introduce partisan bias will not be accepted.

---

## License

MIT License — free to use, modify, and distribute. See `LICENSE` for details.

Built to protect your right to an informed vote. 🇺🇸
