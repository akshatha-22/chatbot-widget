"""Unit tests for proxy-aware client IP detection."""

import ipaddress

from app.config import settings
from app.core import network


class _FakeClient:
    def __init__(self, host: str):
        self.host = host


class _FakeRequest:
    def __init__(self, headers: dict[str, str], client_host: str = "10.0.0.1"):
        self.headers = headers
        self.client = _FakeClient(client_host)


def setup_function():
    network.reset_cloudflare_ip_ranges_cache()
    network.set_cloudflare_ip_ranges_for_tests(
        [ipaddress.IPv4Network("173.245.48.0/20")]
    )


def teardown_function():
    network.reset_cloudflare_ip_ranges_cache()


def test_get_real_ip_prefers_cf_connecting_ip_when_not_cloudflare_only(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", False)
    request = _FakeRequest({"CF-Connecting-IP": "203.0.113.10"})
    assert network.get_real_ip(request) == "203.0.113.10"


def test_get_real_ip_ignores_spoofed_cf_header_when_cloudflare_only(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", True)
    request = _FakeRequest(
        {"CF-Connecting-IP": "203.0.113.10"},
        client_host="198.51.100.1",
    )
    assert network.get_real_ip(request) == "198.51.100.1"


def test_get_real_ip_trusts_cf_header_from_cloudflare_origin(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", True)
    request = _FakeRequest(
        {"CF-Connecting-IP": "203.0.113.10"},
        client_host="173.245.48.1",
    )
    assert network.get_real_ip(request) == "203.0.113.10"


def test_get_real_ip_parses_x_forwarded_for_chain(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", False)
    request = _FakeRequest(
        {"X-Forwarded-For": "198.51.100.20, 10.0.0.5, 172.16.0.1"}
    )
    assert network.get_real_ip(request) == "198.51.100.20"
