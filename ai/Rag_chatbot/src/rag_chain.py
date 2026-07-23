import json
import re
import urllib.error
import urllib.request

from config.settings import GEMINI_API_KEY, GEMINI_API_URL


class RAGChain:
    def generate_answer(self, question, retrieved_docs):
        if not retrieved_docs:
            return {
                "answer": "I do not want to guess without restaurant context. Please ask about menu items, prices, orders, timing, or location.",
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
            return self._format_retrieved_answer(question, context)

        prompt = f"""
You are RestaurantAI Assistant for MAHESH Sweets & Bakers.

Answer only from the provided context. If the context does not contain enough
information, politely say what is missing and guide the customer to ask about
menu items, prices, orders, timing, or location. Be warm, concise, and include
item names and prices when relevant.

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
- Do not mention RAG, vectors, Chroma, PostgreSQL, Gemini, or internal systems.
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
            return self._format_retrieved_answer(question, context)

        candidates = data.get("candidates", [])
        parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
        answer = "".join(part.get("text", "") for part in parts).strip()

        return answer or "Gemini did not return an answer for the retrieved context."

    def _format_retrieved_answer(self, question, context):
        if self._is_menu_question(question):
            return self._format_retrieved_menu_answer(question, context)

        return self._format_knowledge_answer(question, context)

    def _is_menu_question(self, question):
        text = question.lower()

        return any(
            word in text
            for word in [
                "menu",
                "food",
                "item",
                "price",
                "cost",
                "available",
                "eat",
                "hungry",
                "recommend",
                "suggest",
                "snack",
                "snacks",
                "drink",
                "drinks",
                "cake",
                "cakes",
                "eggless",
                "special",
                "specials",
                "pizza",
                "burger",
                "roll",
                "rolls",
                "momos",
                "chaat",
                "chinese",
                "noodle",
                "noodles",
                "dosa",
                "pastry",
                "pastries",
                "puff",
                "puffs",
            ]
        ) or self._extract_budget(text) is not None

    def _tokenize(self, value):
        stopwords = {
            "a",
            "an",
            "and",
            "are",
            "can",
            "do",
            "does",
            "for",
            "how",
            "i",
            "is",
            "it",
            "me",
            "of",
            "the",
            "to",
            "what",
            "with",
            "you",
        }

        return [
            word
            for word in re.findall(r"[a-z0-9]+", value.lower())
            if word not in stopwords and len(word) > 1
        ]

    def _score_text(self, question, value):
        query_words = self._tokenize(question)
        value_words = self._tokenize(value)

        if not query_words or not value_words:
            return 0

        return sum(
            3 if word in value_words else 1 if any(word in value_word or value_word in word for value_word in value_words) else 0
            for word in query_words
        )

    def _format_knowledge_answer(self, question, context):
        qa_pairs = re.findall(
            r"Q:\s*(?P<question>.+?)\nA:\s*(?P<answer>.+?)(?=\n\nQ:|\Z)",
            context,
            flags=re.DOTALL,
        )

        if qa_pairs:
            best_pair = max(
                qa_pairs,
                key=lambda pair: self._score_text(question, f"{pair[0]} {pair[1]}"),
            )
            best_score = self._score_text(question, f"{best_pair[0]} {best_pair[1]}")

            if best_score > 0:
                return best_pair[1].strip()

        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n\s*\n", context)
            if paragraph.strip() and not paragraph.strip().lower().startswith("menu item:")
        ]

        if paragraphs:
            best_paragraph = max(paragraphs, key=lambda paragraph: self._score_text(question, paragraph))
            if self._score_text(question, best_paragraph) > 0:
                return best_paragraph

        return "I do not want to guess without enough restaurant details. Please ask about menu items, prices, orders, timing, or location."

    def _format_retrieved_menu_answer(self, question, context):
        items = self._parse_menu_items(context)
        filtered_items = self._filter_items(question, items)

        if not filtered_items:
            return (
                "I could not find matching menu items for that question. Try an item name, category, or budget."
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

        return "Here are good matches from the menu:\n" + "\n".join(lines)

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
            "roll",
            "rolls",
            "puff",
            "puffs",
            "pastry",
            "pastries",
            "noodle",
            "noodles",
            "dosa",
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
