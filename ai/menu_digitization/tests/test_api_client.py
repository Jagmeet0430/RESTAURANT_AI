import requests

BASE_URL = "http://127.0.0.1:8001"


def test_health():
    print("Testing /health ...")
    response = requests.get(f"{BASE_URL}/health", timeout=10)
    print("Status:", response.status_code)
    print("Response:", response.json())


def test_items():
    print("\nTesting /digitized-menu/items ...")
    response = requests.get(f"{BASE_URL}/digitized-menu/items", timeout=10)
    data = response.json()
    print("Status:", response.status_code)
    print("Success:", data.get("success"))
    print("Count:", data.get("count"))


def test_categories():
    print("\nTesting /digitized-menu/categories ...")
    response = requests.get(f"{BASE_URL}/digitized-menu/categories", timeout=10)
    data = response.json()
    print("Status:", response.status_code)
    print("Success:", data.get("success"))
    print("Count:", data.get("count"))


def test_summary():
    print("\nTesting /digitized-menu/summary ...")
    response = requests.get(f"{BASE_URL}/digitized-menu/summary", timeout=10)
    data = response.json()
    print("Status:", response.status_code)
    print("Success:", data.get("success"))
    print("Summary:", data.get("data"))


if __name__ == "__main__":
    print("Menu Digitization AI API Client Test Started\n")

    test_health()
    test_items()
    test_categories()
    test_summary()

    print("\nAPI Client Test Completed")
