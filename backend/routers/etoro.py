from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any, Optional
import httpx

router = APIRouter()

TIER_1 = {"AT","BH","FI","FR","DE","IE","IT","KW","LI","LU","MX","NL","NO","OM","QA","ES","SE","CH","AE","GB"}
TIER_2 = {"AU","AR","BG","CL","CO","CY","CZ","DK","EC","EE","GI","GR","HU","LV","LT","MT","PL","RO","SK","UY"}
TIER_3 = {"BD","BO","KY","CR","DO","GG","PE","RE","SC"}

EU_SET = {"AT","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IE","IT","LV","LI","LT","LU","MT","NL","NO","PL","RO","SK","ES","SE","CH"}

def get_tier(country_code: str) -> Optional[str]:
    if country_code in TIER_1: return "tier_1"
    if country_code in TIER_2: return "tier_2"
    if country_code in TIER_3: return "tier_3"
    return None

def get_risk_warning(country_code: str) -> Dict[str, Any]:
    if country_code in ["AU", "CL", "AE"]:
        return {
            "riskWarning": "eToro AUS Capital Limited ACN 612 791 803 AFSL 491139. OTC Derivatives are speculative and leveraged. Capital at risk. See PDS and TMD.",
            "extraDisclaimer": None,
        }
    
    if country_code in EU_SET:
        extra = None
        if country_code == "ES":
            extra = "Cryptoassets investment is not regulated in most EU countries and the UK. No consumer protection. Your capital is at risk. Read the risk statement before investing."
        elif country_code == "FR":
            extra = "eToro (Europe) Ltd is registered as a DASP with the AMF. Cryptoasset investing is unregulated in most EU countries. No consumer protection. Your capital is at risk."
        elif country_code == "CH":
            extra = "This content is not intended for Swiss persons. ETFs shown are not real ETFs — they are tracked as CFDs. Swiss Financial Services Act and Swiss Financial Institutions Act apply."
        
        return {
            "riskWarning": "eToro is a multi-asset investment platform. The value of your investments may go up or down. Your capital is at risk.",
            "extraDisclaimer": extra,
        }

    if country_code in ["GI", "GB", "SC"]:
         return {
            "riskWarning": "eToro is a multi-asset investment platform. The value of your investments may go up or down. Your capital is at risk.",
            "extraDisclaimer": None,
        }

    return {
        "riskWarning": "eToro is a multi-asset investment platform. The value of your investments may go up or down. Your capital is at risk.",
        "extraDisclaimer": None,
    }

@router.post("/get-user-geo")
@router.get("/get-user-geo")
async def get_user_geo(request: Request):
    """
    Rerouted from Supabase Function get-user-geo.
    Handles eToro compliance by detecting user country and returning risk warnings.
    """
    country_code = request.headers.get("x-country-code") or \
                   request.headers.get("cf-ipcountry") or \
                   request.headers.get("x-vercel-ip-country")
    
    if not country_code:
        ip = request.headers.get("x-forwarded-for")
        if ip:
            ip = ip.split(",")[0].strip()
        else:
            ip = request.client.host
        
        if ip and ip not in ["127.0.0.1", "::1"]:
            try:
                # Use a larger timeout for external geo lookup
                async with httpx.AsyncClient() as client:
                    res = await client.get(f"http://ip-api.com/json/{ip}?fields=countryCode", timeout=3.0)
                    if res.is_success:
                        country_code = res.json().get("countryCode")
            except Exception as e:
                print(f"[Geo] Lookup failed for {ip}: {e}")
                pass
        else:
            # For local development, mock a supported country so UI elements appear
            country_code = "GB"

    if not country_code:
        return {
            "countryCode": "GB", # Default for safety in dev
            "isRestricted": False,
            "tier": "tier_1",
            "riskWarning": "eToro is a multi-asset investment platform. Your capital is at risk.",
            "extraDisclaimer": None,
        }

    country_code = country_code.upper()
    tier = get_tier(country_code)

    if not tier:
        return {
            "countryCode": country_code,
            "isRestricted": True,
            "tier": "banned",
            "riskWarning": "",
            "extraDisclaimer": None,
        }

    warnings = get_risk_warning(country_code)
    return {
        "countryCode": country_code,
        "isRestricted": False,
        "tier": tier,
        **warnings
    }
