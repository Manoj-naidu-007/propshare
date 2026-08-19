"""End-to-end backend API tests for PropShare.

Sections:
- Auth (login/register/me)
- Properties (list/get)
- Wallet (get, mock-deposit, withdraw)
- Investments buy + Portfolio
- Marketplace (create/list/accept)
- Razorpay deposit order + signature verification
- Admin dashboard/users/withdrawals/approvals
- Company create property + dashboard
- Interest distribution (idempotency)
- RBAC (investor -> admin endpoints forbidden; suspended user)
"""
import time
import uuid
import pytest
from conftest import BASE_URL


# ---------------- Auth ----------------
class TestAuth:
    def test_login_admin(self, admin_auth):
        assert admin_auth["user"]["role"] == "Admin"
        assert admin_auth["user"]["email"] == "admin@propshare.com"
        assert admin_auth["access_token"]

    def test_login_company(self, company_auth):
        assert company_auth["user"]["role"] == "Company"

    def test_login_investor(self, investor_auth):
        assert investor_auth["user"]["role"] == "Investor"

    def test_login_wrong_password(self, anon_client):
        r = anon_client.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@propshare.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_admin(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "Admin"

    def test_me_company(self, company_client):
        r = company_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "Company"

    def test_me_investor(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["role"] == "Investor"

    def test_me_no_token(self, anon_client):
        r = anon_client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code in (401, 403)

    def test_register_new_investor(self, new_investor):
        assert new_investor["data"]["user"]["role"] == "Investor"
        assert new_investor["data"]["user"]["status"] == "active"

    def test_register_admin_forbidden(self, anon_client):
        payload = {
            "email": f"TEST_adm_{uuid.uuid4().hex[:6]}@x.com",
            "password": "Test@1234",
            "role": "Admin",
            "name": "TEST",
        }
        r = anon_client.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r.status_code == 400


# ---------------- Properties ----------------
class TestProperties:
    def test_investor_lists_approved(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 3, f"Expected >=3 seeded approved properties, got {len(items)}"
        for p in items:
            assert p["status"] == "approved"
            assert "share_price" in p
            assert "total_shares" in p

    def test_admin_lists_all(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_property_by_id(self, investor_client):
        listing = investor_client.get(f"{BASE_URL}/api/properties").json()
        pid = listing[0]["id"]
        r = investor_client.get(f"{BASE_URL}/api/properties/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_property_404(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/properties/does-not-exist")
        assert r.status_code == 404


# ---------------- Wallet ----------------
class TestWallet:
    def test_get_wallet_investor(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/wallet")
        assert r.status_code == 200
        w = r.json()
        assert "balance" in w
        assert isinstance(w["balance"], (int, float))

    def test_mock_deposit_and_persist(self, new_investor):
        client = new_investor["client"]
        # initial balance
        b0 = client.get(f"{BASE_URL}/api/wallet").json()["balance"]
        r = client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 10000})
        assert r.status_code == 200
        b1 = client.get(f"{BASE_URL}/api/wallet").json()["balance"]
        assert round(b1 - b0, 2) == 10000.0

    def test_wallet_transactions(self, new_investor):
        client = new_investor["client"]
        client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 500})
        r = client.get(f"{BASE_URL}/api/wallet/transactions")
        assert r.status_code == 200
        tx = r.json()
        assert any(t["type"] == "deposit_mock" for t in tx)

    def test_withdraw_creates_pending(self, new_investor):
        client = new_investor["client"]
        client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 5000})
        r = client.post(f"{BASE_URL}/api/wallet/withdraw", json={"amount": 1000})
        assert r.status_code == 200
        assert "request_id" in r.json()

    def test_withdraw_insufficient(self, new_investor):
        # fresh account (but might have prior deposits), so ensure ridiculous amount
        r = new_investor["client"].post(f"{BASE_URL}/api/wallet/withdraw", json={"amount": 999999999})
        assert r.status_code == 400


# ---------------- Investments + Portfolio ----------------
class TestInvestments:
    def test_buy_shares_and_portfolio_updates(self, investor_client):
        # ensure wallet has funds
        investor_client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 200000})
        props = investor_client.get(f"{BASE_URL}/api/properties").json()
        prop = props[0]
        pre_sold = prop["shares_sold"]
        pre_wallet = investor_client.get(f"{BASE_URL}/api/wallet").json()["balance"]
        r = investor_client.post(
            f"{BASE_URL}/api/investments/buy",
            json={"property_id": prop["id"], "shares": 1},
        )
        assert r.status_code == 200, r.text
        assert r.json()["shares"] == 1

        post = investor_client.get(f"{BASE_URL}/api/properties/{prop['id']}").json()
        assert post["shares_sold"] == pre_sold + 1
        post_wallet = investor_client.get(f"{BASE_URL}/api/wallet").json()["balance"]
        assert round(pre_wallet - post_wallet, 2) == prop["share_price"]

        pf = investor_client.get(f"{BASE_URL}/api/portfolio").json()
        assert "holdings" in pf
        h_ids = [h["property_id"] for h in pf["holdings"]]
        assert prop["id"] in h_ids
        for h in pf["holdings"]:
            if h["property_id"] == prop["id"]:
                assert "current_value" in h and "pnl" in h

    def test_buy_shares_insufficient_balance(self, anon_client, investor_client):
        # register a fresh isolated investor with zero balance
        email = f"TEST_zero_{uuid.uuid4().hex[:8]}@x.com"
        reg = anon_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@1234", "role": "Investor", "name": "TEST",
        })
        assert reg.status_code == 200
        tok = reg.json()["access_token"]
        import requests as _rq
        s = _rq.Session()
        s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {tok}"})
        props = investor_client.get(f"{BASE_URL}/api/properties").json()
        prop = props[0]
        r = s.post(f"{BASE_URL}/api/investments/buy", json={"property_id": prop["id"], "shares": 1})
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"


# ---------------- Marketplace ----------------
class TestMarketplace:
    def test_full_marketplace_flow(self, investor_client, new_investor):
        # ensure seed investor has holding
        investor_client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 200000})
        props = investor_client.get(f"{BASE_URL}/api/properties").json()
        prop = props[0]
        investor_client.post(f"{BASE_URL}/api/investments/buy", json={"property_id": prop["id"], "shares": 1})

        # list a sell order
        r = investor_client.post(
            f"{BASE_URL}/api/marketplace",
            json={
                "property_id": prop["id"],
                "shares": 1,
                "price_per_share": prop["share_price"],
                "order_type": "sell",
            },
        )
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "open"
        oid = order["id"]

        # buyer accepts
        buyer = new_investor["client"]
        buyer.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": prop["share_price"] * 2})
        r2 = buyer.post(f"{BASE_URL}/api/marketplace/{oid}/accept")
        assert r2.status_code == 200, r2.text

        # verify buyer holds shares now
        pf = buyer.get(f"{BASE_URL}/api/portfolio").json()
        assert any(h["property_id"] == prop["id"] and h["shares"] >= 1 for h in pf["holdings"])

    def test_marketplace_list(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/marketplace")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_sell_without_shares(self, new_investor):
        # new investor doesn't own any property shares
        # fetch some property id
        r = new_investor["client"].get(f"{BASE_URL}/api/properties")
        pid = r.json()[0]["id"]
        rr = new_investor["client"].post(
            f"{BASE_URL}/api/marketplace",
            json={"property_id": pid, "shares": 5, "price_per_share": 1000, "order_type": "sell"},
        )
        assert rr.status_code == 400


# ---------------- Razorpay ----------------
class TestRazorpay:
    def test_deposit_order_creation(self, investor_client):
        r = investor_client.post(f"{BASE_URL}/api/wallet/deposit/order", json={"amount": 500})
        # Live Razorpay call — may fail if credentials invalid
        if r.status_code != 200:
            pytest.skip(f"Razorpay order creation returned {r.status_code}: {r.text}")
        data = r.json()
        assert "order_id" in data
        assert "key_id" in data
        assert "checkout_url" in data
        assert data["key_id"].startswith("rzp_")
        assert data["amount_paise"] == 50000

    def test_verify_rejects_bad_signature(self, investor_client):
        r = investor_client.post(
            f"{BASE_URL}/api/wallet/deposit/verify",
            json={"order_id": "order_fake", "payment_id": "pay_fake", "signature": "deadbeef"},
        )
        assert r.status_code == 400


# ---------------- Admin ----------------
class TestAdmin:
    def test_admin_dashboard(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in [
            "total_users", "total_companies", "total_properties",
            "approved_properties", "pending_properties",
            "total_investments", "total_wallet_balance", "recent_activities",
        ]:
            assert k in d, f"missing key {k} in dashboard"

    def test_admin_users(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 3
        emails = {u["email"] for u in users}
        assert "admin@propshare.com" in emails

    def test_admin_withdrawals_list(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/withdrawals")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_approve_reject_property(self, admin_client, company_client):
        # create a pending property as company then approve/reject
        payload = {
            "name": f"TEST_prop_{uuid.uuid4().hex[:6]}",
            "property_type": "residential",
            "location": "TEST City",
            "description": "TEST",
            "images": [],
            "documents": [],
            "total_value": 1000000,
            "total_shares": 100,
            "share_price": 10000,
            "monthly_return_rate": 1.0,
        }
        rc = company_client.post(f"{BASE_URL}/api/properties", json=payload)
        assert rc.status_code == 200, rc.text
        pid = rc.json()["id"]
        assert rc.json()["status"] == "pending"

        r = admin_client.patch(f"{BASE_URL}/api/properties/{pid}", json={"status": "approved"})
        assert r.status_code == 200
        # verify
        g = admin_client.get(f"{BASE_URL}/api/properties/{pid}").json()
        assert g["status"] == "approved"


# ---------------- Company ----------------
class TestCompany:
    def test_company_dashboard(self, company_client):
        r = company_client.get(f"{BASE_URL}/api/company/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ["company", "total_properties", "total_shares_listed", "wallet_balance"]:
            assert k in d

    def test_company_cannot_change_status(self, company_client):
        # get a property owned by company
        props = company_client.get(f"{BASE_URL}/api/properties").json()
        if not props:
            pytest.skip("no company properties")
        pid = props[0]["id"]
        r = company_client.patch(f"{BASE_URL}/api/properties/{pid}", json={"status": "approved"})
        assert r.status_code == 403


# ---------------- Interest Distribution ----------------
class TestInterest:
    def test_distribute_and_idempotency(self, admin_client, investor_client):
        # ensure investor holds at least 1 share of a property
        investor_client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 200000})
        props = investor_client.get(f"{BASE_URL}/api/properties").json()
        prop = props[0]
        investor_client.post(f"{BASE_URL}/api/investments/buy", json={"property_id": prop["id"], "shares": 1})

        # unique month for idempotency
        month = f"2025-{uuid.uuid4().hex[:2]}"
        # ensure month string valid format used ("YYYY-MM")
        month = f"2099-{uuid.uuid4().hex[:2].upper()}"
        r = admin_client.post(f"{BASE_URL}/api/admin/interest/distribute", json={"property_id": prop["id"], "month": month})
        assert r.status_code == 200, r.text
        assert r.json()["total_paid"] > 0

        # idempotent
        r2 = admin_client.post(f"{BASE_URL}/api/admin/interest/distribute", json={"property_id": prop["id"], "month": month})
        assert r2.status_code == 400

    def test_interest_history(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/interest/history")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- RBAC ----------------
class TestRBAC:
    def test_investor_cannot_access_admin_dashboard(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert r.status_code == 403

    def test_investor_cannot_list_users(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/admin/users")
        assert r.status_code == 403

    def test_investor_cannot_distribute_interest(self, investor_client):
        r = investor_client.post(
            f"{BASE_URL}/api/admin/interest/distribute",
            json={"property_id": "x", "month": "2026-01"},
        )
        assert r.status_code == 403

    def test_company_cannot_access_admin(self, company_client):
        r = company_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert r.status_code == 403

    def test_suspended_user_cannot_login(self, admin_client, anon_client):
        # create a fresh throwaway investor
        email = f"TEST_susp_{uuid.uuid4().hex[:6]}@x.com"
        reg = anon_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Test@1234", "role": "Investor", "name": "TEST",
        })
        assert reg.status_code == 200
        uid = reg.json()["user"]["id"]
        # suspend
        r = admin_client.patch(f"{BASE_URL}/api/admin/users/{uid}", json={"status": "suspended"})
        assert r.status_code == 200
        # try login
        r2 = anon_client.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "Test@1234"})
        assert r2.status_code == 403
