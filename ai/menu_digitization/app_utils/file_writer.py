import json
import pandas as pd


def save_json(data, output_path):
    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4, ensure_ascii=False)


def save_csv(data, output_path):
    df = pd.DataFrame(data)

    if df.empty:
        df = pd.DataFrame(columns=["name", "category", "price"])

    df.to_csv(output_path, index=False, encoding="utf-8")
