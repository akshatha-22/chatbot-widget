"""Tests for proxy-aware client IP detection (legacy path — see tests/unit/test_network.py)."""

import ipaddress

from app.config import settings
from app.core import network
from app.core.network import get_real_ip


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


def test_get_real_ip_prefers_cf_connecting_ip(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", False)
    request = _FakeRequest({"CF-Connecting-IP": "203.0.113.10"})
    assert get_real_ip(request) == "203.0.113.10"


def test_get_real_ip_parses_x_forwarded_for_chain(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", False)
    request = _FakeRequest(
        {"X-Forwarded-For": "198.51.100.20, 10.0.0.5, 172.16.0.1"}
    )
    assert get_real_ip(request) == "198.51.100.20"


def test_get_real_ip_falls_back_to_socket_client(monkeypatch):
    monkeypatch.setattr(settings, "CLOUDFLARE_ONLY", False)
    request = _FakeRequest({}, client_host="192.168.1.5")
    assert get_real_ip(request) == "192.168.1.5"
