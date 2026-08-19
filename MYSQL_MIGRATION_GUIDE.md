# PropShare — MongoDB → MySQL Migration + Setup Guide

## 1. What changed

The backend (`backend/server.py`) was rewritten from Motor/MongoDB to
**SQLAlchemy 2.0 (async) + MySQL**. Business logic, routes, request/response
shapes, and auth are unchanged — this is a data-layer swap only. The
**frontend needs no changes at all** — it only talks to the backend over HTTP.

### New files
| File | Purpose |
|---|---|
| `backend/database.py` | Async SQLAlchemy engine/session setup (replaces the Motor client) |
| `backend/models.py` | ORM models — one per former MongoDB collection |
| `backend/db_helpers.py` | Atomic wallet credit/debit + holdings-upsert helpers (replace Mongo's `$inc`/upsert) |

### Replaced files
| File | What changed |
|---|---|
| `backend/server.py` | All Motor queries (`db.users.find_one`, `$inc`, `$set`, upserts, aggregations) rewritten as SQLAlchemy `select`/`update`/`insert` |
| `backend/seed.py` | Same demo data, written via the ORM instead of raw Mongo documents |
| `backend/requirements.txt` | Removed `motor`, `pymongo`; added `SQLAlchemy`, `aiomysql`, `PyMySQL` |
| `backend/.env.example` | `MONGO_URL`/`DB_NAME` replaced with `MYSQL_URL` |

### Schema design notes
- Every former Mongo collection became a table with the same name (`users`, `wallets`, `companies`, `properties`, `holdings`, `wallet_transactions`, `razorpay_orders`, `marketplace_orders`, `withdrawals`, `interest_payouts`, `kyc_docs`, `activity_logs`).
- `id`/foreign-key fields stay as UUID strings (`VARCHAR(36)`), same as before — no ID-format migration needed.
- Timestamps (`created_at`, etc.) are kept as **ISO-8601 strings**, not native `DATETIME`. The original code compares/sorts these as strings (e.g. password-reset expiry, `sort("created_at", -1)`), and ISO-8601 strings sort identically to chronological order, so this preserves that logic exactly. Switching to native `DATETIME` later is a safe, independent follow-up.
- Money fields use `DECIMAL(16,2)` / `DECIMAL(14,2)` (exact, not float) — safer than Mongo's implicit doubles for financial data.
- `images`/`documents`/`meta` fields use MySQL's native `JSON` column type.
- Unique constraints replace Mongo's implicit "one holding per (user, property)" and "one payout per (property, month)" patterns.
- Mongo's atomic `$inc` (used for wallet balances and share counts) is replaced with real atomic SQL: `UPDATE wallets SET balance = balance + :amt` and `INSERT ... ON DUPLICATE KEY UPDATE` for upserts. Withdrawals/purchases use a conditional atomic update (`WHERE balance >= amount`) instead of "read balance, check in Python, then write" — the old MongoDB doc used the same non-atomic pattern, so this is actually a small **correctness improvement**, closing a race condition that existed even in the original code.

### Bug found & fixed during testing
Migrating `Decimal` columns surfaced one real bug: SQLAlchemy's ORM tries to
update already-loaded Python objects in memory after an `UPDATE`, and mixing
MySQL's `Decimal` with plain Python `float` deltas in that step raises a
`TypeError`. Fixed by adding `execution_options(synchronize_session=False)`
to the affected statements (safe here since the app never reads those stale
objects back out afterward). This was caught by literally exercising the buy
→ sell → marketplace-accept flow against a running MySQL server before
delivering this to you.

### What I verified end-to-end against a live MySQL/MariaDB server
Register (all 3 roles) → login → JWT auth/RBAC → company approval → property
create/approve → wallet mock-deposit → buy shares (atomic debit, commission
split, holdings upsert) → portfolio aggregation → interest distribution →
marketplace sell + accept (atomic transfer between two wallets + holdings) →
withdrawal request + admin reject/refund → admin dashboard aggregates →
`seed.py` (idempotent, ran twice safely).

---

## 2. Install MySQL

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y mysql-server
sudo service mysql start
```

**macOS (Homebrew):**
```bash
brew install mysql
brew services start mysql
```

**Docker (fastest, works anywhere):**
```bash
docker run -d --name propshare-mysql \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=propshare \
  -e MYSQL_USER=propshare_user \
  -e MYSQL_PASSWORD=CHANGE_ME \
  -p 3306:3306 \
  mysql:8.0
```

## 3. Create the database and user (skip if you used the Docker command above)

```bash
mysql -u root -p
```
```sql
CREATE DATABASE propshare CHARACTER SET utf8mb4;
CREATE USER 'propshare_user'@'localhost' IDENTIFIED BY 'CHANGE_ME';
GRANT ALL PRIVILEGES ON propshare.* TO 'propshare_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## 4. Configure the backend

```bash
cd backend
cp .env.example .env
```
Edit `.env`:
```env
MYSQL_URL=mysql+aiomysql://propshare_user:CHANGE_ME@localhost:3306/propshare
JWT_SECRET=<generate with: python3 -c "import secrets;print(secrets.token_urlsafe(48))">
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=<a strong password>
RAZORPAY_KEY_ID=<from your Razorpay dashboard>
RAZORPAY_KEY_SECRET=<from your Razorpay dashboard>
PUBLIC_BASE_URL=http://localhost:8000    # or your deployed backend URL
```

## 5. Install dependencies and run the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```
On first startup the app automatically:
- creates all MySQL tables (`CREATE TABLE IF NOT EXISTS` equivalent via SQLAlchemy metadata)
- seeds the admin account from `ADMIN_EMAIL`/`ADMIN_PASSWORD`
- creates the internal platform commission wallet

Check it's alive: `curl http://localhost:8000/` → `{"service":"PropShare API","status":"ok"}`

### (Optional) Load demo data
```bash
python3 seed.py
```
Creates a demo company (`company@propshare.com` / `Company@123`), a demo
investor (`investor@propshare.com` / `Invest@123`), and 3 approved demo
properties. Safe to re-run.

## 6. Run the backend tests

```bash
cd backend
# tests hit the running server over HTTP — start it first (step 5), then:
export EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
python3 seed.py           # tests expect the seeded company/investor to exist
pytest
```

## 7. Run the frontend (unchanged)

```bash
cd frontend
npm install
```
Create `frontend/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
```
```bash
npx expo start
```

## 8. Production notes

- Put MySQL behind a private network / restrict `bind-address`; don't expose port 3306 publicly.
- Use a connection pool size appropriate to your MySQL server's `max_connections` (SQLAlchemy's default pool is fine to start).
- Take regular `mysqldump` backups (or use your cloud provider's managed MySQL backups — AWS RDS, PlanetScale, Google Cloud SQL, etc. all work with the `mysql+aiomysql://` URL scheme unchanged).
- Rotate `JWT_SECRET` and Razorpay live keys separately from your test `.env`.
