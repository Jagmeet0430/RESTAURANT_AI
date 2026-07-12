import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from faker import Faker


def generate_dataset(output_path=None, num_orders=5000):
    """Generate a synthetic restaurant sales dataset and save it as CSV."""
    fake = Faker("en_IN")
    base_dir = Path(__file__).resolve().parents[1]
    raw_dir = base_dir / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    if output_path is None:
        output_path = raw_dir / "restaurant_sales.csv"

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    menu = {
        "Margherita Pizza": ("Pizza", 299),
        "Farmhouse Pizza": ("Pizza", 399),
        "Veg Burger": ("Burger", 149),
        "Cheese Burger": ("Burger", 199),
        "French Fries": ("Snacks", 129),
        "Paneer Tikka": ("Starter", 299),
        "Veg Sandwich": ("Snacks", 179),
        "White Sauce Pasta": ("Pasta", 249),
        "Cold Coffee": ("Beverage", 149),
        "Chocolate Shake": ("Beverage", 179),
        "Soft Drink": ("Beverage", 79),
        "Masala Dosa": ("South Indian", 199),
        "Veg Biryani": ("Main Course", 249),
        "Chole Bhature": ("Main Course", 199),
        "Spring Rolls": ("Starter", 229),
    }

    payment_methods = ["Cash", "UPI", "Credit Card", "Debit Card"]
    weather_types = ["Sunny", "Rainy", "Cloudy", "Windy"]
    customer_types = ["New", "Returning"]
    table_types = ["Dine-In", "Takeaway", "Delivery"]
    start_date = datetime(2025, 1, 1)

    records = []
    for order_id in range(1, num_orders + 1):
        order_date = start_date + timedelta(days=random.randint(0, 364))
        order_time = fake.time(pattern="%H:%M")
        food_item = random.choice(list(menu.keys()))
        category = menu[food_item][0]
        price = menu[food_item][1]
        quantity = random.randint(1, 5)
        total_amount = quantity * price
        payment = random.choice(payment_methods)
        weather = random.choice(weather_types)
        day = order_date.strftime("%A")
        weekend = "Yes" if day in ["Saturday", "Sunday"] else "No"
        holiday = random.choices(["Yes", "No"], weights=[10, 90], k=1)[0]
        customer = random.choice(customer_types)
        table = random.choice(table_types)

        customers = random.randint(80, 180)
        online_orders = random.randint(10, 60)
        dine_in_orders = max(1, customers - online_orders)
        avg_order_value = round(total_amount / max(quantity, 1), 2)
        marketing_spend = random.randint(300, 900)
        special_event = random.choice(["Yes", "No"])
        temperature = random.randint(18, 35)
        sales = round(total_amount * 1.1 + random.randint(100, 500), 2)

        records.append(
            {
                "Order_ID": order_id,
                "date": order_date.strftime("%Y-%m-%d"),
                "Order_Date": order_date.strftime("%Y-%m-%d"),
                "Order_Time": order_time,
                "Food_Item": food_item,
                "Category": category,
                "Quantity": quantity,
                "Price": price,
                "Total_Amount": total_amount,
                "Payment_Method": payment,
                "Weather": weather,
                "temperature": temperature,
                "customers": customers,
                "online_orders": online_orders,
                "dine_in_orders": dine_in_orders,
                "avg_order_value": avg_order_value,
                "marketing_spend": marketing_spend,
                "special_event": special_event,
                "Day_of_Week": day,
                "Is_Weekend": weekend,
                "Is_Holiday": holiday,
                "Customer_Type": customer,
                "Table_Type": table,
                "sales": sales,
            }
        )

    df = pd.DataFrame(records)
    df.to_csv(output_path, index=False)

    legacy_path = output_path.with_name("sales.csv")
    df.to_csv(legacy_path, index=False)
    return df


if __name__ == "__main__":
    generate_dataset()
