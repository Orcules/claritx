import asyncio
import time

import pytest
from fastapi import HTTPException

import auth
from database import parse_json


# --- database.parse_json (pure helper) ---

def test_parse_json_none():
    assert parse_json(None) is None


def test_parse_json_string():
    assert parse_json('{"a": 1, "b": [2, 3]}') == {"a": 1, "b": [2, 3]}


def test_parse_json_passthrough():
    value = {"already": "parsed"}
    assert parse_json(value) is value


# --- auth.verify_token fail-closed behavior (no network calls) ---

def _run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


def test_verify_token_missing_header_raises_401():
    with pytest.raises(HTTPException) as exc:
        _run(auth.verify_token(None))
    assert exc.value.status_code == 401


def test_verify_token_bad_format_raises_401():
    with pytest.raises(HTTPException) as exc:
        _run(auth.verify_token("garbage-not-a-bearer-token"))
    assert exc.value.status_code == 401


def test_verify_token_unconfigured_pool_raises_503(monkeypatch):
    monkeypatch.setattr(auth, "user_pool_id", None)
    with pytest.raises(HTTPException) as exc:
        _run(auth.verify_token("Bearer some.fake.token"))
    assert exc.value.status_code == 503


def test_verify_token_garbage_token_raises_401(monkeypatch):
    # Configure a fake pool and pre-warm the JWKS cache so no network I/O happens.
    monkeypatch.setattr(auth, "user_pool_id", "us-east-1_PLACEHOLDER")
    monkeypatch.setattr(auth, "_jwks_cache", [{"kid": "fake-kid"}])
    monkeypatch.setattr(auth, "_jwks_cache_time", time.time())
    with pytest.raises(HTTPException) as exc:
        _run(auth.verify_token("Bearer this-is-not-a-jwt"))
    assert exc.value.status_code == 401
