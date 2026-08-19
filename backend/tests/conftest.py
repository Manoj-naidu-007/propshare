"""Shared fixtures for PropShare backend tests."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

ADMIN = {"email": "admin@propshare.com", "password": "Admin@123"}
COMPANY = {"email": "company@propshare.com", "password": "Company@123"}
INVESTOR = {"email": "investor@propshare.com", "password": "Invest@123"}


def _login(session: requests.Session, creds: dict) -> dict:
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    return data


def _client_with_token(token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def base_url() -> str:
    return BASE_URL


@pytest.fixture(scope="session")
def anon_client() -> requests.Session:
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_auth(anon_client):
    return _login(anon_client, ADMIN)


@pytest.fixture(scope="session")
def company_auth(anon_client):
    return _login(anon_client, COMPANY)


@pytest.fixture(scope="session")
def investor_auth(anon_client):
    return _login(anon_client, INVESTOR)


@pytest.fixture(scope="session")
def admin_client(admin_auth):
    return _client_with_token(admin_auth["access_token"])


@pytest.fixture(scope="session")
def company_client(company_auth):
    return _client_with_token(company_auth["access_token"])


@pytest.fixture(scope="session")
def investor_client(investor_auth):
    return _client_with_token(investor_auth["access_token"])


@pytest.fixture(scope="session")
def new_investor(anon_client):
    """Register a fresh investor for isolated tests."""
    email = f"TEST_investor_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "Test@1234",
        "role": "Investor",
        "name": "TEST Investor",
    }
    r = anon_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    session = _client_with_token(data["access_token"])
    return {"data": data, "client": session, "email": email}
