"""Client IP helpers for proxied deployments (Railway, Vercel, Cloudflare)."""

from __future__ import annotations

import ipaddress
import logging
from typing import Optional

import httpx
from fastapi import Request

from app.config import settings

logger = logging.getLogger(__name__)

_PROXY_HEADER_CANDIDATES = (
    "CF-Connecting-IP",
    "True-Client-IP",
    "X-Real-IP",
    "X-Forwarded-For",
)

_CLOUDFLARE_IPV4_URL = "https://www.cloudflare.com/ips-v4"
_cloudflare_networks: list[ipaddress.IPv4Network] = []
_cloudflare_ranges_loaded = False


def _parse_cloudflare_ranges(text: str) -> list[ipaddress.IPv4Network]:
    networks: list[ipaddress.IPv4Network] = []
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            networks.append(ipaddress.IPv4Network(line, strict=False))
        except ValueError:
            logger.warning("Skipping invalid Cloudflare CIDR: %s", line)
    return networks


def load_cloudflare_ip_ranges(*, force: bool = False) -> list[ipaddress.IPv4Network]:
    """Fetch and cache Cloudflare IPv4 ranges (startup + periodic refresh)."""
    global _cloudflare_networks, _cloudflare_ranges_loaded
    if _cloudflare_ranges_loaded and not force:
        return _cloudflare_networks

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(_CLOUDFLARE_IPV4_URL)
            response.raise_for_status()
            _cloudflare_networks = _parse_cloudflare_ranges(response.text)
            logger.info("Loaded %d Cloudflare IPv4 ranges", len(_cloudflare_networks))
    except Exception as exc:
        logger.warning("Could not load Cloudflare IP ranges: %s", exc)
        if not _cloudflare_ranges_loaded:
            _cloudflare_networks = []

    _cloudflare_ranges_loaded = True
    return _cloudflare_networks


def set_cloudflare_ip_ranges_for_tests(networks: list[ipaddress.IPv4Network]) -> None:
    """Inject Cloudflare ranges in tests without a network call."""
    global _cloudflare_networks, _cloudflare_ranges_loaded
    _cloudflare_networks = networks
    _cloudflare_ranges_loaded = True


def reset_cloudflare_ip_ranges_cache() -> None:
    """Clear cached Cloudflare ranges (for tests)."""
    global _cloudflare_networks, _cloudflare_ranges_loaded
    _cloudflare_networks = []
    _cloudflare_ranges_loaded = False


def _is_cloudflare_ip(ip: str) -> bool:
    try:
        addr = ipaddress.IPv4Address(ip)
    except ValueError:
        return False
    return any(addr in network for network in _cloudflare_networks)


def _direct_connection_ip(request: Request) -> str:
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _trusted_cf_connecting_ip(request: Request, direct_ip: str) -> Optional[str]:
    raw = request.headers.get("CF-Connecting-IP")
    if not raw:
        return None

    client_ip = raw.split(",")[0].strip()
    if not client_ip:
        return None

    if not settings.CLOUDFLARE_ONLY:
        return client_ip

    if _is_cloudflare_ip(direct_ip):
        return client_ip

    logger.warning(
        "Ignoring spoofed CF-Connecting-IP=%s from non-Cloudflare origin %s",
        client_ip,
        direct_ip,
    )
    return None


def get_real_ip(request: Request) -> str:
    """Return the best-effort client IP behind reverse proxies."""
    direct_ip = _direct_connection_ip(request)

    cf_ip = _trusted_cf_connecting_ip(request, direct_ip)
    if cf_ip:
        return cf_ip

    for header in _PROXY_HEADER_CANDIDATES:
        if header == "CF-Connecting-IP":
            continue
        raw = request.headers.get(header)
        if not raw:
            continue
        ip = raw.split(",")[0].strip()
        if ip:
            return ip

    return direct_ip
