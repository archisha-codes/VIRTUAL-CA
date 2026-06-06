def get_state_from_gstin(gstin: str) -> str:
    """Derive state name from GSTIN prefix."""
    state_map = {
        "27": "Maharashtra",
        "29": "Karnataka",
        "07": "Delhi",
        "33": "Tamil Nadu",
        "09": "Uttar Pradesh",
        "19": "West Bengal",
        "24": "Gujarat",
        "32": "Kerala",
        "06": "Haryana",
        "03": "Punjab",
        "08": "Rajasthan",
        "10": "Bihar",
        "18": "Assam",
        "36": "Telangana",
        "37": "Andhra Pradesh",
    }
    prefix = gstin[:2] if len(gstin) >= 2 else ""
    return state_map.get(prefix, f"State {prefix}" if prefix else "Unknown")
