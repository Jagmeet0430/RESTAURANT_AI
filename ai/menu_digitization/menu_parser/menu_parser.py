import re
from difflib import get_close_matches


KNOWN_CATEGORIES = [
    "Puffs Patties & Rolls",
    "Donuts",
    "Burger & Sandwiches",
    "Pies / Tarts",
    "Pastries",
    "Muffins / Cupcakes",
    "Chaat",
    "Puddings",
    "Swiss Roll",
    "Perfect Pizzas",
    "Chinese",
]


def clean_text(text):
    text = str(text).strip()
    text = text.replace("₹", "")
    text = text.replace("Rs.", "")
    text = text.replace("Rs", "")
    text = text.replace("/-", "")
    text = text.replace("|", "")
    text = text.replace(":", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_for_match(text):
    text = clean_text(text).lower()
    text = re.sub(r"[^a-z0-9 ]", "", text)
    return text


def is_price(text):
    text = clean_text(text)
    text = text.replace("(", "").replace(")", "").replace(".", "")

    if not text.isdigit():
        return False

    price = int(text)
    return 5 <= price <= 2000


def normalize_price(text):
    text = clean_text(text)
    text = text.replace("(", "").replace(")", "").replace(".", "")

    try:
        return int(text)
    except ValueError:
        return None


def is_garbage_line(text):
    text = clean_text(text)

    if not text:
        return True

    if len(set(text)) <= 2 and len(text) > 5:
        return True

    if text.isdigit() and len(text) > 4:
        return True

    return False


def detect_category(text):
    cleaned = normalize_for_match(text)

    category_map = {
        normalize_for_match(category): category
        for category in KNOWN_CATEGORIES
    }

    category_keys = list(category_map.keys())

    matches = get_close_matches(
        cleaned,
        category_keys,
        n=1,
        cutoff=0.55
    )

    if matches:
        return category_map[matches[0]]

    return None


def looks_like_item(text):
    text = clean_text(text)

    if is_price(text):
        return False

    if is_garbage_line(text):
        return False

    if len(text) < 3:
        return False

    return True


def parse_menu_lines(lines):
    parsed_items = []
    current_category = "Uncategorized"
    pending_item = None

    for raw_line in lines:
        line = clean_text(raw_line)

        if is_garbage_line(line):
            continue

        detected_category = detect_category(line)

        if detected_category:
            current_category = detected_category
            pending_item = None
            continue

        if is_price(line):
            price = normalize_price(line)

            if pending_item and price:
                parsed_items.append({
                    "name": pending_item,
                    "category": current_category,
                    "price": price
                })

                pending_item = None

            continue

        if looks_like_item(line):
            pending_item = line

    return parsed_items
