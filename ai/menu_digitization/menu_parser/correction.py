from difflib import get_close_matches


KNOWN_MENU_ITEMS = [
    # Puffs Patties & Rolls
    "Potato Puff",
    "Paneer Puff Pastry",
    "Mushroom Puff Pastry",
    "Assorted Corn Pattie",
    "Paneer Roll",
    "Cheese Bun Patties Sandwich",
    "Cheese Patties Roll",
    "Cheese Corn Roll",

    # Donuts
    "Vanilla / Choco",
    "Chocolate",
    "Straco Chips",

    # Burger & Sandwiches
    "Club Sandwich (3 Piece)",
    "Buttered Toast",
    "Channa Sandwich",
    "Channa Masney Sandwich",
    "Potato Chutwich",
    "Chilli Paneer Sandwich",
    "Resh Paneer Sandwich",
    "Masala Regular Burger",
    "Vegalo Hotger",
    "Spicy Veg Burger",
    "Cheesy French Fries (Plate)",
    "Cheesy French Fiates",

    # Pies / Tarts
    "Apple Pie",
    "Black Forest Pie",
    "Chocolate Pie",
    "Belgian Fruit Tart",
    "Belgian Chocolate Pie",

    # Pastries
    "Regular Pastry",
    "Chocolate Pineapple Strawberry",
    "Pineapple Pastry",
    "Butterscotch Pastry",
    "Fresh Fruit Pastry",
    "Pure Chocolate",
    "Red Velvet Pastry",
    "Black Velvet Pastry",
    "Cassiss Pastry",
    "Biscoff Pastry",
    "Cheese Cake Pastry",

    # Muffins / Cupcakes
    "Vanilla Muffins",
    "Chocolate Muffins",
    "Oreo Muffins",

    # Chaat
    "Samosa Chaat",
    "Tikki Aloo Chaat",
    "Raj Kachori Chaat",
    "Sev Puri",
    "Papdi Puri",
    "Dahi Golgappe (Per 6 Pcs)",
    "Jhal / Suji Golgappe (Per 6 Pcs)",

    # Puddings
    "Red Velvet Pudding",
    "Chocolate Pudding",

    # Swiss Roll
    "Vanilla Swiss Roll",
    "Chocolate Swiss Roll",
    "Jam Roll",

    # Perfect Pizzas
    "Veg Cheese Pizza",
    "Mexican Pizza",
    "Paneer Tikka Pizza",
    "Onion and Capsicum Pizza",
    "Veggie Supreme Pizza",

    # Chinese
    "Veggie Noodles",
    "Hakka Noodles",
    "Cheese Chilli",
    "Manchurian (Plate)",
    "Fried Momos (Plate)",
    "Spring Roll",
]


MANUAL_CORRECTIONS = {
    "Paneom Puff Pastry": "Paneer Puff Pastry",
    "Mashrom Puff Pastry": "Mushroom Puff Pastry",
    "Aasrtn Cort Pattie": "Assorted Corn Pattie",
    "PanconnRoll": "Paneer Roll",
    "ChiceedBain Patss Sandwich": "Cheese Bun Patties Sandwich",
    "Chieese Patrier Rdl": "Cheese Patties Roll",
    "Cheess Coneer Roll": "Cheese Corn Roll",

    "Vanilla/Choco,": "Vanilla / Choco",
    "StracoChips": "Straco Chips",

    "ApploPie": "Apple Pie",
    "BladkForestpie": "Black Forest Pie",
    "ChocolatatPiet": "Chocolate Pie",
    "BelganFnuntard": "Belgian Fruit Tart",
    "Belgian Chocolate Ple": "Belgian Chocolate Pie",

    "RegularPastry": "Regular Pastry",
    "(ChocoalarPineappleSrawberry)": "Chocolate Pineapple Strawberry",
    "Piuttearide Pastry": "Pineapple Pastry",
    "Butberr Scorch Pastry)": "Butterscotch Pastry",
    "FrentFeiailf Pastry": "Fresh Fruit Pastry",
    "Rela Velt Pastry": "Red Velvet Pastry",
    "Black Velver Pastry": "Black Velvet Pastry",
    "Casiss Pastry": "Cassiss Pastry",
    "BucolfPastry": "Biscoff Pastry",

    "Orro Muffins": "Oreo Muffins",

    "Tgll Acoket Chaat": "Tikki Aloo Chaat",
    "RalKaa Chaat": "Raj Kachori Chaat",
    "Ral Kaa Chaat": "Raj Kachori Chaat",
    "Senu Purt": "Sev Puri",
    "PaptPurt": "Papdi Puri",
    "Jhahl/ Duji Galgappe (Per 6 Pes)": "Jhal / Suji Golgappe (Per 6 Pcs)",

    "Red. Velyet Pudding": "Red Velvet Pudding",

    "Ahocolate Swiss Roll": "Chocolate Swiss Roll",

    "Veg Cheess Pizza": "Veg Cheese Pizza",
    "Mexicaer Pizza": "Mexican Pizza",
    "Pencer Tiikka Pizza": "Paneer Tikka Pizza",
    "Onion and Capsdian Pizza": "Onion and Capsicum Pizza",

    "Cheess Chill": "Cheese Chilli",
    "Manchurrian (Pate)": "Manchurian (Plate)",
    "Fried Momss (Plate)": "Fried Momos (Plate)",
    "SgseyVeg.Burger": "Spicy Veg Burger",
    "CheesyFredch Fries(Plate))": "Cheesy French Fries (Plate)",
}


def correct_item_name(name):
    name = str(name).strip()

    if not name:
        return name

    if name in MANUAL_CORRECTIONS:
        return MANUAL_CORRECTIONS[name]

    matches = get_close_matches(
        name,
        KNOWN_MENU_ITEMS,
        n=1,
        cutoff=0.72
    )

    if matches:
        return matches[0]

    return name


def correct_menu_items(menu_items):
    corrected_items = []

    for item in menu_items:
        corrected_item = item.copy()

        original_name = corrected_item.get("name", "")
        corrected_name = correct_item_name(original_name)

        corrected_item["original_name"] = original_name
        corrected_item["name"] = corrected_name

        corrected_items.append(corrected_item)

    return corrected_items
