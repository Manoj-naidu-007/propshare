"""Iteration 2 enhancement tests for PropShare:
- 0.5% platform commission on share purchase & marketplace accept
- /api/admin/platform-wallet
- /api/admin/dashboard new keys: platform_earnings, pending_kyc
- KYC upload / mine / admin pending / verify / reject
- RBAC on new endpoints
"""
import uuid
import pytest
import requests
from conftest import BASE_URL


COMMISSION_RATE = 0.005


def _register_investor(anon_client):
    email = f"TEST_kyc_{uuid.uuid4().hex[:8]}@example.com"
    r = anon_client.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": "Test@1234", "role": "Investor", "name": "TEST Kyc",
    })
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {tok}"})
    return s, r.json()["user"]["id"], email


# ---------------- Platform Commission ----------------
class TestCommissionPurchase:
    def test_purchase_splits_commission_correctly(self, investor_client, admin_client, company_client):
        # Fund investor
        investor_client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 200000})
        # Get an approved property owned by seed company
        props = investor_client.get(f"{BASE_URL}/api/properties").json()
        # Prefer a property owned by the seed company (Skyline Estates)
        prop = None
        for p in props:
            if p.get("company_name") and "Skyline" in p["company_name"]:
                prop = p
                break
        if prop is None:
            prop = props[0]

        # Platform wallet snapshot before
        pw0 = admin_client.get(f"{BASE_URL}/api/admin/platform-wallet").json()
        bal0 = pw0["balance"]

        # Company owner wallet snapshot (company_client)
        cw0 = company_client.get(f"{BASE_URL}/api/wallet").json()["balance"]

        # Investor wallet snapshot
        iw0 = investor_client.get(f"{BASE_URL}/api/wallet").json()["balance"]

        shares = 1
        total_cost = shares * prop["share_price"]
        expected_commission = round(total_cost * COMMISSION_RATE, 2)
        expected_company = round(total_cost - expected_commission, 2)

        r = investor_client.post(f"{BASE_URL}/api/investments/buy",
                                 json={"property_id": prop["id"], "shares": shares})
        assert r.status_code == 200, r.text

        # Investor debited full total
        iw1 = investor_client.get(f"{BASE_URL}/api/wallet").json()["balance"]
        assert round(iw0 - iw1, 2) == round(total_cost, 2)

        # Platform credited commission (only if it's Skyline / company-owned)
        pw1 = admin_client.get(f"{BASE_URL}/api/admin/platform-wallet").json()
        # If property has valid company owner:
        if prop.get("company_id") != "platform":
            assert round(pw1["balance"] - bal0, 2) == expected_commission, \
                f"platform delta {pw1['balance']-bal0} != {expected_commission}"
            # Company owner credited 99.5%
            # (only compare if selected property is owned by seed company_client)
            if "Skyline" in (prop.get("company_name") or ""):
                cw1 = company_client.get(f"{BASE_URL}/api/wallet").json()["balance"]
                assert round(cw1 - cw0, 2) == expected_company

        # commission_purchase tx exists in platform wallet transactions
        assert any(
            t["type"] == "commission_purchase" and round(t["amount"], 2) == expected_commission
            for t in pw1["transactions"]
        ), "commission_purchase txn missing in platform wallet"

        # Investor tx: share_purchase w/ amount -total_cost
        tx = investor_client.get(f"{BASE_URL}/api/wallet/transactions").json()
        assert any(t["type"] == "share_purchase" and round(t["amount"], 2) == -round(total_cost, 2) for t in tx)


class TestCommissionMarketplace:
    def test_marketplace_accept_splits_commission(self, investor_client, anon_client, admin_client):
        # Seller = seed investor. Make sure they own >=1 share
        investor_client.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": 200000})
        props = investor_client.get(f"{BASE_URL}/api/properties").json()
        prop = props[0]
        investor_client.post(f"{BASE_URL}/api/investments/buy",
                             json={"property_id": prop["id"], "shares": 1})

        price = prop["share_price"]
        # create sell order
        r = investor_client.post(f"{BASE_URL}/api/marketplace", json={
            "property_id": prop["id"], "shares": 1,
            "price_per_share": price, "order_type": "sell",
        })
        assert r.status_code == 200, r.text
        oid = r.json()["id"]

        # Fresh buyer
        buyer, _, _ = _register_investor(anon_client)
        buyer.post(f"{BASE_URL}/api/wallet/mock-deposit", json={"amount": price * 2})

        pw0 = admin_client.get(f"{BASE_URL}/api/admin/platform-wallet").json()
        bal0 = pw0["balance"]

        rr = buyer.post(f"{BASE_URL}/api/marketplace/{oid}/accept")
        assert rr.status_code == 200, rr.text

        pw1 = admin_client.get(f"{BASE_URL}/api/admin/platform-wallet").json()
        total = price
        expected_commission = round(total * COMMISSION_RATE, 2)
        assert round(pw1["balance"] - bal0, 2) == expected_commission

        # commission_marketplace tx exists
        assert any(
            t["type"] == "commission_marketplace" and round(t["amount"], 2) == expected_commission
            for t in pw1["transactions"]
        )


# ---------------- Platform Wallet Endpoint ----------------
class TestPlatformWallet:
    def test_admin_can_access(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/platform-wallet")
        assert r.status_code == 200
        d = r.json()
        assert "balance" in d and "transactions" in d
        assert isinstance(d["transactions"], list)

    def test_investor_forbidden(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/admin/platform-wallet")
        assert r.status_code == 403

    def test_company_forbidden(self, company_client):
        r = company_client.get(f"{BASE_URL}/api/admin/platform-wallet")
        assert r.status_code == 403


# ---------------- Admin Dashboard New Keys ----------------
class TestAdminDashboardNewKeys:
    def test_platform_earnings_and_pending_kyc(self, admin_client):
        r = admin_client.get(f"{BASE_URL}/api/admin/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "platform_earnings" in d, f"missing platform_earnings; keys={list(d.keys())}"
        assert "pending_kyc" in d, f"missing pending_kyc; keys={list(d.keys())}"
        assert isinstance(d["platform_earnings"], (int, float))
        assert isinstance(d["pending_kyc"], int)


# ---------------- KYC ----------------
SAMPLE_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


class TestKyc:
    def test_kyc_upload_investor_and_mine(self, anon_client):
        client, uid, email = _register_investor(anon_client)
        # Initial mine
        r0 = client.get(f"{BASE_URL}/api/kyc/mine")
        assert r0.status_code == 200
        assert r0.json()["kyc_status"] == "pending"
        assert r0.json()["documents"] == []

        r = client.post(f"{BASE_URL}/api/kyc/upload",
                        json={"document": SAMPLE_B64, "doc_type": "id_proof"})
        assert r.status_code == 200, r.text
        assert r.json()["kyc_status"] == "submitted"

        r2 = client.get(f"{BASE_URL}/api/kyc/mine")
        assert r2.status_code == 200
        data = r2.json()
        assert data["kyc_status"] == "submitted"
        assert len(data["documents"]) == 1
        assert data["documents"][0]["doc_type"] == "id_proof"

    def test_kyc_upload_company_allowed(self, company_client):
        r = company_client.post(f"{BASE_URL}/api/kyc/upload",
                                json={"document": SAMPLE_B64, "doc_type": "company_kyc"})
        assert r.status_code == 200, r.text
        m = company_client.get(f"{BASE_URL}/api/kyc/mine").json()
        assert m["kyc_status"] == "submitted"

    def test_kyc_admin_blocked(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/kyc/upload",
                              json={"document": SAMPLE_B64, "doc_type": "id_proof"})
        assert r.status_code == 400, r.text

    def test_admin_pending_and_verify_flow(self, anon_client, admin_client):
        client, uid, email = _register_investor(anon_client)
        client.post(f"{BASE_URL}/api/kyc/upload",
                    json={"document": SAMPLE_B64, "doc_type": "id_proof"})
        pending = admin_client.get(f"{BASE_URL}/api/admin/kyc/pending").json()
        assert any(u["id"] == uid for u in pending), "new submission not in pending list"
        # each has latest_doc
        for u in pending:
            assert "latest_doc" in u

        # Verify
        rv = admin_client.post(f"{BASE_URL}/api/admin/kyc/{uid}/verify")
        assert rv.status_code == 200
        # confirm status via /kyc/mine
        after = client.get(f"{BASE_URL}/api/kyc/mine").json()
        assert after["kyc_status"] == "verified"

    def test_admin_reject_flow(self, anon_client, admin_client):
        client, uid, _ = _register_investor(anon_client)
        client.post(f"{BASE_URL}/api/kyc/upload",
                    json={"document": SAMPLE_B64, "doc_type": "id_proof"})
        rr = admin_client.post(f"{BASE_URL}/api/admin/kyc/{uid}/reject")
        assert rr.status_code == 200
        after = client.get(f"{BASE_URL}/api/kyc/mine").json()
        assert after["kyc_status"] == "rejected"

    def test_admin_verify_missing_user(self, admin_client):
        r = admin_client.post(f"{BASE_URL}/api/admin/kyc/does-not-exist/verify")
        assert r.status_code == 404


# ---------------- RBAC on new endpoints ----------------
class TestKycRBAC:
    def test_investor_forbidden_admin_kyc(self, investor_client):
        for path in ["/api/admin/kyc/pending"]:
            r = investor_client.get(f"{BASE_URL}{path}")
            assert r.status_code == 403, f"{path} => {r.status_code}"
        r = investor_client.post(f"{BASE_URL}/api/admin/kyc/any/verify")
        assert r.status_code == 403
        r = investor_client.post(f"{BASE_URL}/api/admin/kyc/any/reject")
        assert r.status_code == 403

    def test_company_forbidden_admin_kyc(self, company_client):
        r = company_client.get(f"{BASE_URL}/api/admin/kyc/pending")
        assert r.status_code == 403
        r = company_client.post(f"{BASE_URL}/api/admin/kyc/any/verify")
        assert r.status_code == 403


# ---------------- Notifications regression ----------------
class TestNotifications:
    def test_notifications_returns_list(self, investor_client):
        r = investor_client.get(f"{BASE_URL}/api/notifications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        # each item should have message + type + created_at
        for n in r.json()[:5]:
            assert "message" in n and "type" in n and "created_at" in n
