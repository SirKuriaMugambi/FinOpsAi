"""
Currency Conversion Utility
Fetches live KES exchange rates for USD, EUR, GBP.
Falls back to cached rates if live fetch fails — so the app
never crashes mid-calculation just because of a network issue.
"""

import requests
from datetime import datetime
from typing import Optional

# Fallback rates (updated periodically — these are approximate mid-2026 rates)
FALLBACK_RATES_TO_KES = {
    "USD": 129.50,
    "EUR": 140.20,
    "GBP": 164.80,
    "KES": 1.00,
}


def fetch_live_rates() -> dict:
    """
    Fetch live KES exchange rates from a free public API.
    Returns dict of {currency: rate_to_KES} or None if fetch fails.
    """
    try:
        # Using exchangerate-api.com free tier (no key needed for basic rates)
        response = requests.get(
            "https://api.exchangerate-api.com/v4/latest/KES",
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            rates = data.get("rates", {})
            # Convert rates FROM KES perspective to TO KES
            result = {"KES": 1.00}
            for currency in ["USD", "EUR", "GBP"]:
                if currency in rates and rates[currency] > 0:
                    result[currency] = 1.0 / rates[currency]
            return result
    except Exception:
        pass
    return None


def get_rates() -> tuple:
    """
    Returns (rates_dict, is_live: bool).
    Tries live rates first, falls back to cached rates.
    """
    live = fetch_live_rates()
    if live:
        return live, True
    return FALLBACK_RATES_TO_KES.copy(), False


def convert_to_kes(amount: float, currency: str, rates: Optional[dict] = None) -> float:
    """Convert an amount in any supported currency to KES."""
    if currency == "KES":
        return amount
    if rates is None:
        rates, _ = get_rates()
    rate = rates.get(currency, FALLBACK_RATES_TO_KES.get(currency, 1.0))
    return amount * rate


def format_currency(amount: float, currency: str = "KES") -> str:
    """Format a currency amount for display."""
    symbols = {"KES": "KES ", "USD": "$ ", "EUR": "€ ", "GBP": "£ "}
    symbol = symbols.get(currency, f"{currency} ")
    return f"{symbol}{amount:,.2f}"
