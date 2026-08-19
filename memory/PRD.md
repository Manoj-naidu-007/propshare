# PropShare — Property Share Investment Platform

A premium fractional real estate investment mobile app. Companies list properties, divide them into shares; investors buy fractional shares and earn monthly returns; admins approve and orchestrate.

## Stack
- **Mobile app**: Expo Router (React Native), TypeScript, gold-on-charcoal glass/luxe aesthetic
- **Backend**: FastAPI + MongoDB (Motor async)
- **Auth**: JWT (argon2 hashed) with role-based access (Admin, Company, Investor)
- **Payments**: Razorpay (test mode) — Order creation + hosted checkout via WebView + HMAC signature verification
- **Storage**: base64 in MongoDB (KYC docs, property images)

## Roles & flows
### Investor
- Browse approved properties, view detail (hero, valuation, share allocation, monthly return)
- Buy fractional shares (wallet-funded)
- Portfolio: holdings, P/L, monthly returns credited
- Wallet: Razorpay deposit, withdraw request, transactions, mock deposit for testing
- Marketplace: peer-to-peer sell/buy of owned shares

### Company
- Registers, awaits admin approval
- Lists properties (image, valuation, shares, price, monthly return) — pending admin approval
- Dashboard: KPIs, wallet, request withdrawal

### Admin
- Approvals queue for properties, companies, withdrawals
- User management (suspend/activate)
- Interest distribution per property per month (idempotent), history
- Platform-wide dashboard KPIs

## Demo credentials
See `/app/memory/test_credentials.md`.
- Admin — admin@propshare.com / Admin@123
- Company — company@propshare.com / Company@123 (Skyline Estates)
- Investor — investor@propshare.com / Invest@123 (₹500,000 wallet pre-funded)

## Key endpoints (prefix `/api`)
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/change-password`, `POST /auth/forgot-password`, `POST /auth/reset-password`
- `GET/POST/PATCH /properties`, `DELETE /properties/{id}` (admin)
- `POST /investments/buy`, `GET /portfolio`
- `GET /wallet`, `GET /wallet/transactions`, `POST /wallet/mock-deposit`, `POST /wallet/withdraw`
- `POST /wallet/deposit/order`, `POST /wallet/deposit/verify` (Razorpay)
- `GET /marketplace`, `POST /marketplace`, `POST /marketplace/{id}/accept`
- `GET /admin/dashboard`, `GET /admin/users`, `PATCH /admin/users/{id}`
- `PATCH /admin/companies/{id}?status=...`
- `GET /admin/withdrawals`, `POST /admin/withdrawals/{id}/(approve|reject)`
- `POST /admin/interest/distribute`, `GET /admin/interest/history`
- `POST /kyc/upload`, `GET /kyc/mine`
- `GET /admin/kyc/pending`, `POST /admin/kyc/{user_id}/verify`, `POST /admin/kyc/{user_id}/reject`
- `GET /admin/platform-wallet` (0.5% commission earnings)
- `GET /notifications`
- `GET /company/dashboard`, `GET /companies/mine`, `PATCH /companies/mine`

## Revenue
Every share purchase & marketplace trade routes **0.5% commission** to a virtual `platform_wallet` user. Admin dashboard hero shows real-time earnings.

## Seeding
`python /app/backend/seed.py` — creates company user, approved Skyline Estates company, an investor with ₹5L wallet, and 3 approved properties (Mumbai, Gurgaon, Dubai).
