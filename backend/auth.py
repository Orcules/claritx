import os
import time
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header
from jose import jwt, jwk
from jose.utils import base64url_decode

logger = logging.getLogger(__name__)

# --- Dependencies ---
cognito_region = "us-east-1"
user_pool_id = os.environ.get("COGNITO_USER_POOL_ID")
app_client_id = os.environ.get("COGNITO_CLIENT_ID")

# Cache JWKS keys to avoid fetching on every request
_jwks_cache = None
_jwks_cache_time = 0
_JWKS_TTL = 3600  # 1 hour

async def verify_token(authorization: str = Header(None)):
    """
    Verifies AWS Cognito JWT Token using RS256 JWKS.
    """
    if not authorization:
        # For development/testing, allow requests without token if strictly needed
        # return None
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid token format")
    
    token = authorization.split(" ")[1]

    if not user_pool_id:
        # Fail closed: without a configured user pool we cannot verify tokens
        raise HTTPException(status_code=503, detail="Authentication is not configured")

    try:
        # 1. Get JWKS (Public Keys) from AWS — cached for 1 hour
        global _jwks_cache, _jwks_cache_time
        if _jwks_cache is None or (time.time() - _jwks_cache_time) > _JWKS_TTL:
            keys_url = f"https://cognito-idp.{cognito_region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json"
            async with httpx.AsyncClient() as client:
                response = await client.get(keys_url)
                _jwks_cache = response.json()['keys']
                _jwks_cache_time = time.time()
        keys = _jwks_cache
        
        # 2. Get Header from Token to match Key ID (kid)
        headers = jwt.get_unverified_header(token)
        kid = headers['kid']
        
        # 3. Find correct key
        key_index = -1
        for i in range(len(keys)):
            if kid == keys[i]['kid']:
                key_index = i
                break
        
        if key_index == -1:
            raise HTTPException(status_code=401, detail="Public key not found in JWKS")
            
        # 4. Construct Public Key
        public_key = jwk.construct(keys[key_index])
        
        # 5. Verify Signature and Claims
        message, encoded_signature = str(token).rsplit('.', 1)
        decoded_signature = base64url_decode(encoded_signature.encode('utf-8'))
        
        if not public_key.verify(message.encode("utf8"), decoded_signature):
                raise HTTPException(status_code=401, detail="Signature verification failed")
                
        claims = jwt.get_unverified_claims(token)
        
        # Check Expiration
        if time.time() > claims['exp']:
            raise HTTPException(status_code=401, detail="Token expired")
            
        # Check Client ID (Audience)
        # Note: Cognito Access Tokens don't always have 'aud', ID tokens do. 
        # For Access tokens, check 'client_id'.
        if claims.get('client_id') != app_client_id and claims.get('aud') != app_client_id:
                logger.warning(f"Token client_id {claims.get('client_id')} != {app_client_id}")

        return claims

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token Verification Failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def optional_token(authorization: str = Header(None)):
    """
    Attempts to verify token but returns None instead of throwing 401 if missing or invalid.
    """
    if not authorization:
        return None
    try:
        return await verify_token(authorization)
    except HTTPException:
        return None

async def verify_admin(claims: dict = Depends(verify_token)):
    """
    Verifies that the decoded JWT claims contain the 'Admins' group.
    Requires verify_token to have successfully run first.
    """
    if not claims:
        raise HTTPException(status_code=401, detail="Unauthorized")

    groups = claims.get('cognito:groups', [])
    if 'Admins' not in groups:
        logger.warning(f"User {claims.get('sub')} attempted admin action but lacks Admins group. Groups: {groups}")
        raise HTTPException(status_code=403, detail="Forbidden: You do not have administrator access.")

    return claims
