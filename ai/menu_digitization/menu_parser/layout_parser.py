import re
from difflib import get_close_matches


SECTION_BOXES = [
    {"category": "Puffs Patties & Rolls", "column": 0, "x1": 30, "y1": 30, "x2": 535, "y2": 350},
    {"category": "Pastries", "column": 1, "x1": 30, "y1": 350, "x2": 535, "y2": 825},
    {"category": "Swiss Roll", "column": 2, "x1": 30, "y1": 825, "x2": 535, "y2": 1075},

    {"category": "Donuts", "column": 3, "x1": 545, "y1": 20, "x2": 985, "y2": 200},
    {"category": "Pies / Tarts", "column": 4, "x1": 545, "y1": 205, "x2": 985, "y2": 445},
    {"category": "Muffins / Cupcakes", "column": 5, "x1": 545, "y1": 445, "x2": 985, "y2": 665},
    {"category": "Puddings", "column": 6, "x1": 545, "y1": 665, "x2": 985, "y2": 810},
    {"category": "Perfect Pizzas", "column": 7, "x1": 545, "y1": 810, "x2": 985, "y2": 1075},

    {"category": "Burger & Sandwiches", "column": 8, "x1": 1000, "y1": 25, "x2": 1430, "y2": 455},
    {"category": "Chaat", "column": 9, "x1": 1000, "y1": 455, "x2": 1430, "y2": 810},
    {"category": "Chinese", "column": 10, "x1": 1000, "y1": 810, "x2": 1430, "y2": 1075},
]


CATEGORY_NAMES = [box["category"] for box in SECTION_BOXES]


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


def is_garbage(text):
    text = clean_text(text)

    if not text:
        return True

    if len(set(text)) <= 2 and len(text) > 5:
        return True

    if text.isdigit() and len(text) > 4:
        return True

    return False


def is_category_title(text):
    cleaned = normalize_for_match(text)

    category_map = {
        normalize_for_match(category): category
        for category in CATEGORY_NAMES
    }

    matches = get_close_matches(
        cleaned,
        list(category_map.keys()),
        n=1,
        cutoff=0.8
    )

    return bool(matches)


def get_section_for_item(item):
    x = item["x_center"]
    y = item["y_center"]

    for section in SECTION_BOXES:
        if section["x1"] <= x <= section["x2"] and section["y1"] <= y <= section["y2"]:
            return section

    return None


def find_matching_price(food_item, price_items, used_prices):
    best_match = None
    best_score = None

    for index, price_item in enumerate(price_items):
        if index in used_prices:
            continue

        y_diff = abs(price_item["y_center"] - food_item["y_center"])
        x_diff = price_item["x_center"] - food_item["x_center"]

        if x_diff <= 0:
            continue

        if y_diff <= 30 and 20 <= x_diff <= 500:
            score = y_diff * 10 + x_diff

            if best_score is None or score < best_score:
                best_score = score
                best_match = (index, price_item)

    return best_match


def parse_section(section, section_items):
    parsed_items = []
    cleaned = []

    for item in section_items:
        text = clean_text(item.get("text", ""))

        if is_garbage(text):
            continue

        if is_category_title(text):
            continue

        item["text"] = text
        cleaned.append(item)

    price_items = []
    food_items = []

    for item in cleaned:
        if is_price(item["text"]):
            item["price"] = normalize_price(item["text"])
            price_items.append(item)
        else:
            food_items.append(item)

    food_items = sorted(food_items, key=lambda i: (i["y_center"], i["x_center"]))
    price_items = sorted(price_items, key=lambda i: (i["y_center"], i["x_center"]))

    used_prices = set()

    for food_item in food_items:
        match = find_matching_price(food_item, price_items, used_prices)

        if not match:
            continue

        price_index, price_item = match
        used_prices.add(price_index)

        parsed_items.append({
            "name": food_item["text"],
            "category": section["category"],
            "price": price_item["price"],
            "column": section["column"],
            "x": round(food_item["x_center"], 2),
            "y": round(food_item["y_center"], 2),
        })

    return parsed_items


def parse_layout_items(layout_items):
    section_grouped_items = {
        section["category"]: []
        for section in SECTION_BOXES
    }

    for item in layout_items:
        section = get_section_for_item(item)

        if section:
            section_grouped_items[section["category"]].append(item)

    parsed_items = []

    for section in SECTION_BOXES:
        section_items = section_grouped_items[section["category"]]
        parsed_items.extend(parse_section(section, section_items))

    parsed_items = sorted(
        parsed_items,
        key=lambda item: (item["column"], item["y"])
    )

    return parsed_items
