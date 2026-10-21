This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
# Cab Booking Platform

A full-stack ride-hailing app: riders book rides on a map, drivers accept and run them, with live updates, payments, a wallet, promo codes, receipts and reviews.

**Stack:** Next.js (JavaScript) + Tailwind + Leaflet, FastAPI, Supabase (Postgres, PostGIS, Auth), Upstash Redis, Stripe (test mode), WebSockets.

## Run it locally
1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`, and fill in your own values.
2. Backend: `cd backend`, create a virtual environment, `pip install -r requirements.txt`, `alembic upgrade head`, `uvicorn main:app --reload`.
3. Frontend: `cd frontend`, `npm install`, `npm run dev`.
4. Payments: `stripe listen --events "payment_intent.succeeded,payment_intent.payment_failed" --forward-to localhost:8000/api/webhooks/stripe`, and put the printed secret in `STRIPE_WEBHOOK_SECRET`.

## Tests
`cd backend` then `pytest`. See `MANUAL_TESTING.md` for the flows that need real services, and `python scripts/simulate.py` for a multi-user simulation.

## Notes
Stripe runs in test mode only (the backend refuses live keys). Verify drivers in the database before they can go online.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
