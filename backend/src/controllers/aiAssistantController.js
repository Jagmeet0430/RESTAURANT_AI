import axios from "axios";
import { pool } from "../config/database.js";
import {
  ensureRagServiceRunning,
  RAG_CHATBOT_URL,
} from "../services/ragService.js";

const extractBudget = (question) => {
  const text = question.toLowerCase();

  if (!/(under|below|less than|within|budget|rs\.?|inr)/.test(text)) {
    return null;
  }

  const match = text.match(/(?:rs\.?|inr)?\s*(\d+(?:\.\d+)?)/);

  return match ? Number(match[1]) : null;
};

const itemText = (item) =>
  [item.name, item.category, item.description, item.veg_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const includesAny = (value, keywords) =>
  keywords.some((keyword) => value.includes(keyword));

const isCakeItem = (item) =>
  includesAny(String(item.name || "").toLowerCase(), [
    "cake",
    "pastry",
    "muffin",
    "cupcake",
    "black forest",
    "butterscotch",
    "biscoff",
  ]) ||
  includesAny(String(item.category || "").toLowerCase(), [
    "cake",
    "muffin",
    "cupcake",
  ]);

const isDrinkItem = (item) =>
  includesAny(itemText(item), [
    "drink",
    "coffee",
    "tea",
    "shake",
    "lassi",
    "mojito",
    "juice",
    "mocktail",
    "cold",
    "soda",
  ]);

const isSnackItem = (item) =>
  includesAny(itemText(item), [
    "snack",
    "pattie",
    "patties",
    "roll",
    "sandwich",
    "puff",
    "samosa",
    "kachori",
    "chaat",
    "dosa",
    "vada",
    "bhature",
    "burger",
    "pizza",
    "chinese",
    "momos",
    "noodle",
    "manchurian",
    "toast",
  ]);

const isSpicyItem = (item) =>
  Boolean(item.is_spicy) ||
  includesAny(itemText(item), [
    "spicy",
    "masala",
    "chilli",
    "chili",
    "schezwan",
    "peri",
    "chaat",
    "bhature",
    "kachori",
    "samosa",
    "pav bhaji",
    "manchurian",
  ]);

const formatPrice = (price) => {
  const value = Number(price);

  return Number.isFinite(value) ? `Rs. ${value.toFixed(0)}` : "price not listed";
};

const formatItemLine = (item) => {
  const category = item.category || "Uncategorized";

  return `- ${item.name} - ${formatPrice(item.price)} (${category})`;
};

const sortByPrice = (items) =>
  [...items].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));

const uniqueByName = (items) => {
  const seen = new Set();

  return items.filter((item) => {
    const name = String(item.name || "").trim().toLowerCase();

    if (!name || seen.has(name)) {
      return false;
    }

    seen.add(name);
    return true;
  });
};

const selectItems = (items, predicate, limit = 6) =>
  uniqueByName(sortByPrice(items.filter(predicate))).slice(0, limit);

const buildBirthdayComboAnswer = (items) => {
  const cake = selectItems(
    items,
    (item) => isCakeItem(item) && Number(item.price || 0) >= 40,
    1
  )[0];
  const snacks = selectItems(
    items,
    (item) => {
      const name = String(item.name || "").toLowerCase();

      return (
        isSnackItem(item) &&
        !isCakeItem(item) &&
        !isDrinkItem(item) &&
        !name.includes("extra") &&
        !name.includes("half")
      );
    },
    3
  );
  const drinks = selectItems(
    items,
    (item) => {
      const name = String(item.name || "").toLowerCase();

      return isDrinkItem(item) && !name.includes("tea") && !name.includes("plain milk");
    },
    2
  );
  const comboItems = [cake, ...snacks, ...drinks].filter(Boolean);

  if (!comboItems.length) {
    return null;
  }

  const total = comboItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

  return {
    answer: [
      "RAG service is offline, so I made a birthday combo from the live PostgreSQL menu:",
      ...comboItems.map(formatItemLine),
      `Estimated total: Rs. ${total.toFixed(0)}`,
    ].join("\n"),
    sources: ["postgresql_menu_fallback"],
  };
};

const loadAvailableMenuItems = async () => {
  const result = await pool.query(`
    SELECT
      m.id,
      m.name,
      m.description,
      m.price,
      m.veg_type,
      m.is_spicy,
      m.is_eggless,
      m.is_today_special,
      m.is_featured,
      c.name AS category
    FROM menu m
    LEFT JOIN categories c
      ON c.id = m.category_id
    WHERE COALESCE(m.is_available, true) = true
    ORDER BY c.name, m.name;
  `);

  return result.rows;
};

const buildNoMatchAnswer = (text) => {
  if (text.includes("pizza")) {
    return "I checked the live PostgreSQL menu, but I could not find a pizza matching that price or filter.";
  }

  return "I checked the live PostgreSQL menu, but I could not find matching items for that question.";
};

const buildDatabaseFallbackAnswer = async (question) => {
  const text = question.toLowerCase();
  const budget = extractBudget(question);
  const items = await loadAvailableMenuItems();

  if (text.includes("birthday") || text.includes("combo")) {
    const combo = buildBirthdayComboAnswer(items);

    if (combo) {
      return combo;
    }
  }

  const foodTerms = [
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
  ];
  const requestedTerms = foodTerms.filter((term) => text.includes(term));

  let matchingItems = items.filter((item) => {
    const name = String(item.name || "").toLowerCase();
    const searchableText = itemText(item);

    // Some imported records have incorrect categories, so pizza must match name.
    if (text.includes("pizza") && !name.includes("pizza")) {
      return false;
    }

    if ((text.includes("cake") || text.includes("cakes")) && !isCakeItem(item)) {
      return false;
    }

    if ((text.includes("snack") || text.includes("snacks")) && !isSnackItem(item)) {
      return false;
    }

    if (
      requestedTerms.length &&
      !requestedTerms.some((term) => searchableText.includes(term.replace(/s$/, "")))
    ) {
      return false;
    }

    if (budget !== null && Number(item.price) > budget) {
      return false;
    }

    if (text.includes("spicy") && !isSpicyItem(item)) {
      return false;
    }

    if (text.includes("eggless") && !item.is_eggless) {
      return false;
    }

    if (text.includes("today") && text.includes("special") && !item.is_today_special) {
      return false;
    }

    return true;
  });

  if (!matchingItems.length && text.includes("eggless") && (text.includes("cake") || text.includes("cakes"))) {
    const cakeItems = selectItems(items, isCakeItem, 6);

    if (cakeItems.length) {
      return {
        answer: [
          "No cake is currently marked as eggless in the live PostgreSQL menu.",
          "Cake/pastry options found:",
          ...cakeItems.map(formatItemLine),
          "Please confirm eggless availability with the restaurant before ordering.",
        ].join("\n"),
        sources: ["postgresql_menu_fallback"],
      };
    }
  }

  if (!matchingItems.length && text.includes("today") && text.includes("special")) {
    matchingItems = selectItems(items, (item) => item.is_today_special || item.is_featured, 6);

    if (!matchingItems.length) {
      return {
        answer: "No item is currently marked as today's special in the live PostgreSQL menu.",
        sources: ["postgresql_menu_fallback"],
      };
    }
  }

  if (!matchingItems.length) {
    return {
      answer: buildNoMatchAnswer(text),
      sources: ["postgresql_menu_fallback"],
    };
  }

  const lines = uniqueByName(sortByPrice(matchingItems)).slice(0, 6).map(formatItemLine);

  return {
    answer: `RAG service is offline, so I checked the live PostgreSQL menu instead:\n${lines.join("\n")}`,
    sources: ["postgresql_menu_fallback"],
  };
};

export const askAIAssistant = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    console.log("AI Assistant Question:", question);
    console.log("Routing to RAG Chatbot API:", RAG_CHATBOT_URL);

    const ragReady = await ensureRagServiceRunning();

    if (!ragReady) {
      throw Object.assign(new Error("RAG service is offline"), {
        code: "RAG_OFFLINE",
      });
    }

    const response = await axios.post(
      RAG_CHATBOT_URL,
      { question },
      { timeout: 30000 }
    );

    console.log("RAG API Response:", response.data);

    return res.status(200).json({
      success: true,
      type: "rag_chatbot",
      answer: response.data.answer,
      sources: response.data.sources || [],
      vector_count: response.data.vector_count,
      collection_name: response.data.collection_name,
    });
  } catch (error) {
    console.error("========== AI ASSISTANT ERROR ==========");
    console.error("Message:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    }
    if (error.code) {
      console.error("Code:", error.code);
    }
    console.error("========================================");

    if (
      error.code === "ECONNREFUSED" ||
      error.code === "ECONNABORTED" ||
      error.code === "RAG_OFFLINE"
    ) {
      try {
        const fallback = await buildDatabaseFallbackAnswer(req.body.question);

        return res.status(200).json({
          success: true,
          type: "database_fallback",
          answer: fallback.answer,
          sources: fallback.sources,
          rag_status: "offline",
          rag_error: error.code,
        });
      } catch (fallbackError) {
        console.error("Database fallback failed:", fallbackError.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "AI Assistant service error",
      error: error.message,
      code: error.code || null,
      details: error.response?.data || null,
    });
  }
};
