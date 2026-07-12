import json
import re
import urllib.error
import urllib.request

from config.settings import GEMINI_API_KEY, GEMINI_API_URL


class RAGChain:
    def generate_answer(self, question, retrieved_docs):
        if not retrieved_docs:
            return {
                "answer": "I do not have enough menu or restaurant context to answer that yet.",
                "sources": []
            }

        sources = []
        context_parts = []

        for doc in retrieved_docs:
            text = doc["text"]
            source = doc["metadata"].get("source", "unknown")
            context_parts.append(text)

            if source not in sources:
                sources.append(source)

        context = "\n\n".join(context_parts)
        answer = self._generate_with_gemini(question, context)

        return {
            "answer": answer,
            "sources": sources
        }

    def _generate_with_gemini(self, question, context):
        if not GEMINI_API_KEY:
            return self._format_retrieved_menu_answer(question, context)

        prompt = f"""
You are RestaurantAI Assistant for MAHESH Sweets & Bakers.

Answer only from the provided context. If the context does not contain enough
information, say what is missing. Be concise, helpful, and include item names
and prices when relevant.

Context:
{context}

Customer question:
{question}

Rules:
- For budget questions such as "under Rs. 200", only include items with a price
  less than or equal to that amount.
- If the customer asks for pizza, cake, spicy, eggless, veg, today's special, or
  another menu property, filter using the provided context fields.
- Do not invent menu items, prices, offers, ingredients, or policies.
""".strip()

        payload = json.dumps({
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.35,
                "maxOutputTokens": 450
            }
        }).encode("utf-8")

        request = urllib.request.Request(
            f"{GEMINI_API_URL}?key={GEMINI_API_KEY}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.URLError:
            return self._format_retrieved_menu_answer(question, context)

        candidates = data.get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
        answer = "".join(part.get("text", "") for part in parts).strip()

        return answer or "Gemini did not return an answer for the retrieved context."

    def _format_retrieved_menu_answer(self, question, context):
        items = self._parse_menu_items(context)
        filtered_items = self._filter_items(question, items)

        if not filtered_items:
            return (
                "I checked the knowledge base, but I could not find matching menu "
                "items for that question."
            )

        lines = []

        for item in filtered_items[:6]:
            name = item.get("name", "Menu item")
            price = item.get("price")
            category = item.get("category", "Uncategorized")
            spicy = item.get("spicy")
            eggless = item.get("eggless")

            details = [category]
            if spicy:
                details.append(f"Spicy: {spicy}")
            if eggless:
                details.append(f"Eggless: {eggless}")

            price_text = f"Rs. {price:g}" if price is not None else "price not listed"
            lines.append(f"- {name} - {price_text} ({', '.join(details)})")

        return "I found these from the knowledge base:\n" + "\n".join(lines)

    def _parse_menu_items(self, context):
        items = []

        for block in context.split("\n\n"):
            item = {}

            for line in block.splitlines():
                if ":" not in line:
                    continue

                key, value = line.split(":", 1)
                key = key.strip().lower()
                value = value.strip()

                if key == "menu item":
                    item["name"] = value
                elif key == "category":
                    item["category"] = value
                elif key == "description":
                    item["description"] = value
                elif key == "price":
                    match = re.search(r"\d+(?:\.\d+)?", value)
                    item["price"] = float(match.group()) if match else None
                elif key == "vegetarian type":
                    item["veg_type"] = value
                elif key == "spicy":
                    item["spicy"] = value
                elif key == "eggless":
                    item["eggless"] = value
                elif key == "today's special":
                    item["today_special"] = value

            if item.get("name"):
                items.append(item)

        return items

    def _filter_items(self, question, items):
        text = question.lower()
        budget = self._extract_budget(text)

        food_terms = [
            "pizza",
            "burger",
            "cake",
            "cakes",
            "drink",
            "drinks",
            "snack",
            "snacks",
            "momos",
            "chaat",
            "chinese",
        ]
        requested_terms = [term for term in food_terms if term in text]

        filtered = []

        for item in items:
            name_text = str(item.get("name", "")).lower()
            haystack = " ".join(
                str(item.get(field, ""))
                for field in ["name", "category", "description", "veg_type"]
            ).lower()

            if "pizza" in text and "pizza" not in name_text:
                continue

            if requested_terms and not any(term.rstrip("s") in haystack for term in requested_terms):
                continue

            if budget is not None:
                price = item.get("price")
                if price is None or price > budget:
                    continue

            if "spicy" in text and item.get("spicy", "").lower() != "yes":
                continue

            if "eggless" in text and item.get("eggless", "").lower() != "yes":
                continue

            if "today" in text and "special" in text and item.get("today_special", "").lower() != "yes":
                continue

            filtered.append(item)

        return filtered

    def _extract_budget(self, text):
        if not any(word in text for word in ["under", "below", "less than", "within", "budget"]):
            return None

        match = re.search(r"(?:rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)", text)

        return float(match.group(1)) if match else None
