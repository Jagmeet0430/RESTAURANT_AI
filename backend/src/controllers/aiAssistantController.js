import axios from "axios";
import { pool } from "../config/database.js";
import {
  ensureRagServiceRunning,
  RAG_CHATBOT_URL,
} from "../services/ragService.js";

const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const MAX_SAFE_GROUP_SIZE = 20;
const chatRateBuckets = new Map();

const scopedAssistantAnswer =
  "I can only help with restaurant menu, ordering, offers, order support and customer-service questions.";

const limitResponseText = (answer = "", maxCharacters = 1800) => {
  const text = String(answer || "").trim();

  if (text.length <= maxCharacters) return text;

  return `${text.slice(0, maxCharacters).trim()}...\n\nI kept this short so the assistant stays fast. Ask a more specific question for more details.`;
};

const rateLimitChatRequest = (req) => {
  const now = Date.now();
  const key = req.ip || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const bucket = chatRateBuckets.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  bucket.count += 1;
  chatRateBuckets.set(key, bucket);

  return bucket.count <= RATE_LIMIT_MAX_REQUESTS;
};

const hasPromptInjectionIntent = (question = "") => {
  const text = String(question).toLowerCase();

  return /ignore .*instructions|forget .*rules|system prompt|developer message|database credentials|api keys?|environment variables?|\.env|act as (the )?admin|all customer information|show me your prompt|reveal.*(secret|key|password|credential)/.test(text);
};

const hasAdminMutationIntent = (question = "") => {
  const text = String(question).toLowerCase();

  return /delete every menu|mark all dishes unavailable|cancel all current orders|change the price of every item|drop table|truncate table|delete all|update all|make every item/.test(text);
};

const hasPrivateDataIntent = (question = "") => {
  const text = String(question).toLowerCase();

  return /all orders ever|every customer|all customer|transaction|payment record|customer phone|customer email|private data|admin data/.test(text);
};

const hasMalformedOrInjectionPayload = (question = "") => {
  const text = String(question);

  return /<script\b|<\/script>|'\s*or\s*1\s*=\s*1|--\s*$|;\s*drop\s+table|union\s+select/i.test(text);
};

const hasHugeOutputIntent = (question = "") => {
  const text = String(question).toLowerCase();

  return /50,?000[- ]?word|repeat .*menu .*1,?000|10,?000 different|every available dish in detail|complete menu.*in detail|100 chapters|entire movie script|every mathematics problem/.test(text);
};

const hasUnrelatedIntent = (question = "") => {
  const text = String(question).toLowerCase();

  return /python operating system|quantum mechanics|movie script|mathematics problem|write code for|build an app unrelated/.test(text);
};

const hasContradictoryIntent = (question = "") => {
  const text = String(question).toLowerCase();

  return (
    /chicken.*vegetarian|non[- ]?veg.*vegetarian|vegetarian.*chicken/.test(text) ||
    /sugar[- ]?free.*extra sugar|extra sugar.*sugar[- ]?free/.test(text) ||
    /below\s*(rs\.?|inr|₹)?\s*100.*pizza.*burger.*coffee.*dessert/.test(text)
  );
};

const validateCustomerQuestion = (req, question) => {
  const text = String(question || "");

  if (!rateLimitChatRequest(req)) {
    return {
      status: 429,
      payload: {
        success: false,
        message: "Too many questions. Please wait a moment and try again.",
      },
    };
  }

  if (!text.trim()) {
    return {
      status: 400,
      payload: {
        success: false,
        message: "Please enter a question.",
      },
    };
  }

  if (text.length > MAX_MESSAGE_LENGTH) {
    return {
      status: 400,
      payload: {
        success: false,
        message: `Your question is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
      },
    };
  }

  if (hasPromptInjectionIntent(text) || hasPrivateDataIntent(text) || hasAdminMutationIntent(text)) {
    return {
      status: 200,
      payload: {
        success: true,
        type: "safety",
        answer: scopedAssistantAnswer,
        sources: ["safety"],
        rag_status: "blocked_unsafe_request",
      },
    };
  }

  if (hasMalformedOrInjectionPayload(text)) {
    return {
      status: 400,
      payload: {
        success: false,
        message: "Please send a normal restaurant question without code or special characters.",
      },
    };
  }

  if (hasHugeOutputIntent(text)) {
    return {
      status: 200,
      payload: {
        success: true,
        type: "safety",
        answer: "That request is too large for chat. Please ask for one menu category, one budget, or one combo at a time.",
        sources: ["safety"],
        rag_status: "limited_large_request",
      },
    };
  }

  if (hasUnrelatedIntent(text)) {
    return {
      status: 200,
      payload: {
        success: true,
        type: "safety",
        answer: scopedAssistantAnswer,
        sources: ["safety"],
        rag_status: "out_of_scope",
      },
    };
  }

  if (hasContradictoryIntent(text)) {
    return {
      status: 200,
      payload: {
        success: true,
        type: "safety",
        answer: "That request has conflicting requirements. Please change one condition, such as budget, item type, or dietary preference.",
        sources: ["safety"],
        rag_status: "contradictory_request",
      },
    };
  }

  const groupSizeMatch = text.toLowerCase().match(/\b(\d+)\s*(people|persons|guests|customers|kids|children)\b/);
  if (groupSizeMatch && Number(groupSizeMatch[1]) > MAX_SAFE_GROUP_SIZE) {
    return {
      status: 200,
      payload: {
        success: true,
        type: "safety",
        answer: `For groups above ${MAX_SAFE_GROUP_SIZE} people, please contact the restaurant directly for a bulk order. I can still suggest a simple group combo if you split the request into smaller groups.`,
        sources: ["safety"],
        rag_status: "large_group_limited",
      },
    };
  }

  return null;
};

const extractBudget = (question) => {
  const text = question.toLowerCase();

  if (!/(under|below|less than|within|budget|rs\.?|inr|₹)/.test(text)) {
    return null;
  }

  const match = text.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);

  return match ? Number(match[1].replace(/,/g, "")) : null;
};

const extractBudgetRange = (question) => {
  const text = question.toLowerCase();
  const match = text.match(/between\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d{3})*)\s*(?:and|to|-)\s*(?:rs\.?|inr|₹)?\s*(\d+(?:,\d{3})*)/);

  if (!match) return null;

  return {
    min: Number(match[1].replace(/,/g, "")),
    max: Number(match[2].replace(/,/g, "")),
  };
};

const extractPeopleCount = (question) => {
  const text = question.toLowerCase();
  const words = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const digitMatch = text.match(/\b(\d+)\s*(people|persons|person|guests|kids|children)\b/);

  if (digitMatch) return Number(digitMatch[1]);

  const word = Object.keys(words).find((key) => new RegExp(`\\b${key}\\s+(people|persons|person|guests|kids|children)\\b`).test(text));

  if (word) return words[word];

  const forWord = Object.keys(words).find((key) => new RegExp(`\\bfor\\s+${key}\\b`).test(text));

  return forWord ? words[forWord] : null;
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

const isPizzaItem = (item) =>
  String(item.name || "").toLowerCase().includes("pizza");

const isBurgerItem = (item) =>
  String(item.name || "").toLowerCase().includes("burger");

const isRollItem = (item) =>
  String(item.name || "").toLowerCase().includes("roll");

const isVegetarianItem = (item) => {
  const vegType = String(item.veg_type || "").toLowerCase();

  return vegType.includes("veg") && !vegType.includes("non");
};

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
    "spring roll",
    "paneer tikka",
    "mexican",
    "schezwan",
    "peri",
    "chaat",
    "bhature",
    "kachori",
    "samosa",
    "pav bhaji",
    "manchurian",
  ]);

const isSweetItem = (item) =>
  isCakeItem(item) ||
  includesAny(itemText(item), [
    "sweet",
    "dessert",
    "rasmalai",
    "gulab",
    "jalebi",
    "imarti",
    "halwa",
    "kulfi",
    "falooda",
    "softy",
  ]);

const isCrispyItem = (item) =>
  includesAny(itemText(item), [
    "samosa",
    "kachori",
    "puff",
    "pattie",
    "roll",
    "fries",
    "toast",
    "sev",
    "fried",
    "papdi",
  ]);

const isTangyItem = (item) =>
  includesAny(itemText(item), [
    "chaat",
    "golgappe",
    "puri",
    "mexican",
    "mojito",
    "punch",
    "guava",
    "lemon",
    "fruit",
  ]);

const isPaneerItem = (item) =>
  includesAny(itemText(item), ["paneer", "cheese chilli", "cheese chili"]);

const isSouthIndianItem = (item) =>
  includesAny(itemText(item), ["dosa", "uttapam", "vada", "sambhar", "south indian"]);

const isChineseItem = (item) =>
  includesAny(itemText(item), ["chinese", "noodle", "momos", "manchurian", "spring roll", "chilli"]);

const formatPrice = (price) => {
  const value = Number(price);

  return Number.isFinite(value) ? `Rs. ${value.toFixed(0)}` : "price not listed";
};

const formatItemLine = (item) => {
  const category = item.category || "Uncategorized";

  return `- ${item.name} - ${formatPrice(item.price)} (${category})`;
};

const formatDetailedItemLine = (item) => {
  const details = [item.category || "Uncategorized"];

  if (item.veg_type) details.push(item.veg_type);
  if (item.preparation_time) details.push(`${item.preparation_time} min`);
  if (item.calories) details.push(`${item.calories} cal`);

  return `- ${item.name} - ${formatPrice(item.price)} (${details.join(", ")})`;
};

const friendlyItemList = (items) =>
  uniqueByName(items)
    .slice(0, 6)
    .map(formatItemLine)
    .join("\n");

const normalizeCompactText = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const stripMenuQuestionWords = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/\b(do you have|would like|can i get)\b/g, " ")
    .replace(/\b(i|we|me|my|please|kindly)\b/g, " ")
    .replace(
      /\b(do|does|want|wanna|like|eat|have|try|taste|craving|hungry|suggest|recommend|available|is|are|can|you|tell|about|price|cost|rate|of|for)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();

const findMenuItemFromText = (question, items) => {
  const cleanQuestion = normalizeCompactText(stripMenuQuestionWords(question));
  const cleanFullQuestion = normalizeCompactText(question);
  const searchableQuestion = cleanQuestion || cleanFullQuestion;

  if (!searchableQuestion) return null;

  const matches = items
    .map((item) => {
      const itemName = normalizeCompactText(item.name);
      const singularItemName = itemName.replace(/s$/, "");
      let score = 0;

      if (!itemName) return { item, score };
      if (searchableQuestion === itemName || searchableQuestion === singularItemName) score += 140;
      if (cleanFullQuestion.includes(itemName) || cleanFullQuestion.includes(singularItemName)) score += 120;
      if (itemName.includes(searchableQuestion) || singularItemName.includes(searchableQuestion)) score += 80;

      if (score > 0) {
        score += Math.max(0, 40 - String(item.name || "").length);
      }

      return { item, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.item || null;
};

const findMenuItemsMentioned = (question, items, limit = 4) => {
  const cleanQuestion = normalizeCompactText(question);

  return items
    .map((item) => {
      const itemName = normalizeCompactText(item.name);
      let score = 0;

      if (!itemName) return { item, score };
      if (cleanQuestion.includes(itemName)) score += 120;
      if (itemName.includes(cleanQuestion)) score += 60;

      const words = String(item.name || "")
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3);
      score += words.filter((word) => cleanQuestion.includes(normalizeCompactText(word))).length * 12;

      return { item, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((match) => match.item)
    .filter((item, index, arr) => arr.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, limit);
};

const isMenuQuestion = (question) => {
  const text = question.toLowerCase();

  return (
    /\b(menu|food|item|items|dish|dishes|meal|meals|price|cost|available|eat|order|hungry|recommend|suggest|snack|snacks|drink|drinks|cake|cakes|eggless|vegetarian|vegan|jain|gluten|calorie|calories|protein|children|kids|special|specials|pizza|burger|roll|rolls|momos|chaat|chinese|noodle|noodles|dosa|south indian|dessert|desserts|pastry|pastries|puff|puffs|paneer|mushroom|spicy|mild|sweet|tangy|crispy|creamy|combo|family|people|office|meeting|party|compare|cheaper|better)\b/.test(text) ||
    extractBudget(question) !== null
  );
};

const buildItemAvailabilityAnswer = (item) => ({
  answer: `${item.name} is available for ${formatPrice(item.price)}. Would you like me to add it to your cart?`,
  sources: ["postgresql_menu_live"],
});

const buildDirectDatabaseItemAnswer = async (question) => {
  const items = await loadAvailableMenuItems();
  const detailAnswer = buildItemDetailAnswer(question, items);

  if (detailAnswer) {
    return detailAnswer;
  }

  const comparisonAnswer = buildComparisonAnswer(question, items);

  if (comparisonAnswer) {
    return comparisonAnswer;
  }

  const searchAnswer = buildMenuSearchAnswer(question, items);

  if (searchAnswer) {
    return searchAnswer;
  }

  const directItem = findMenuItemFromText(question, items);

  return directItem ? buildItemAvailabilityAnswer(directItem) : null;
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

const isWeakDisplayItem = (item) => {
  const name = String(item.name || "").toLowerCase();

  return name.includes("extra") || name.includes("(half)") || name === "half";
};

const recommendationScore = (item) => {
  const text = itemText(item);
  let score = 0;

  if (item.is_featured) score += 30;
  if (item.is_today_special) score += 35;
  if (isSpicyItem(item)) score += 14;
  if (isSnackItem(item)) score += 10;
  if (isDrinkItem(item)) score += 6;
  if (isCakeItem(item)) score += 6;
  if (includesAny(text, ["spring roll", "paneer", "pizza", "chilli", "burger", "momos", "chaat", "mojito", "rasmalai"])) score += 20;
  if (isWeakDisplayItem(item)) score -= 35;

  return score;
};

const sortByRecommendation = (items) =>
  [...items].sort((a, b) => {
    const scoreDiff = recommendationScore(b) - recommendationScore(a);

    if (scoreDiff !== 0) return scoreDiff;
    return Number(a.price || 0) - Number(b.price || 0);
  });

const pickAppealingItems = (items, limit = 6) =>
  uniqueByName(sortByRecommendation(items.filter((item) => !isWeakDisplayItem(item)))).slice(0, limit);

const itemNamedLike = (items, names) => {
  const normalizedNames = names.map(normalizeCompactText);

  for (const name of normalizedNames) {
    const match = items.find((item) => normalizeCompactText(item.name).includes(name));

    if (match) return match;
  }

  return null;
};

const pickItemsByName = (items, names, limit = 6) =>
  uniqueByName(
    names
      .map((name) => itemNamedLike(items, [name]))
      .filter(Boolean)
      .filter((item) => !isWeakDisplayItem(item))
  ).slice(0, limit);

const pickCustomerFavorites = (items, limit = 6) => {
  const namedPicks = pickItemsByName(
    items,
    [
      "spring roll",
      "spicy veg burger",
      "paneer tikka pizza",
      "mexican pizza",
      "samosa chaat",
      "biscoff pastry",
      "cheese cake pastry",
      "mint mojito",
      "rasmalai",
    ],
    limit
  );

  return namedPicks.length >= limit
    ? namedPicks
    : uniqueByName([...namedPicks, ...pickAppealingItems(items, limit)]).slice(0, limit);
};

const pickSpicyFavorites = (items, limit = 6) => {
  const namedPicks = pickItemsByName(
    items,
    [
      "spring roll",
      "spicy veg burger",
      "paneer tikka pizza",
      "mexican pizza",
      "samosa chaat",
      "pav bhaji",
      "samosa with channa",
    ],
    limit
  );

  return namedPicks.length >= limit
    ? namedPicks
    : uniqueByName([...namedPicks, ...pickAppealingItems(items.filter(isSpicyItem), limit)]).slice(0, limit);
};

const cheapestItemLine = (items) => {
  const item = sortByPrice(items)[0];

  return item ? `${item.name} at ${formatPrice(item.price)}` : "";
};

const buildClosestBudgetAnswer = (items, requestedLabel, budget) => {
  const cheapest = sortByPrice(items)[0];
  const alternatives = pickAppealingItems(
    items.filter((item) => Number(item.price || 0) <= Number(cheapest?.price || 0) + 80),
    4
  );

  if (!cheapest) {
    return null;
  }

  return {
    answer: [
      `I could not find ${requestedLabel} under Rs. ${budget}.`,
      `The closest option starts with ${cheapestItemLine(items)}.`,
      alternatives.length ? `Closest choices:\n${alternatives.map(formatItemLine).join("\n")}` : "",
      "If you want to stay below your budget, I can suggest snacks, rolls, burgers, or drinks instead.",
    ]
      .filter(Boolean)
      .join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const buildPizzaTasteAnswer = (items) => {
  const pizzas = pickAppealingItems(items.filter(isPizzaItem), 6);

  if (!pizzas.length) return null;

  const notes = pizzas.map((item) => {
    const name = String(item.name || "").toLowerCase();
    let taste = "cheesy and baked with a classic veg pizza taste";

    if (name.includes("mexican")) taste = "tangy, slightly spicy, and loaded with Mexican-style flavor";
    else if (name.includes("paneer tikka")) taste = "smoky, creamy, and mildly spicy with paneer tikka flavor";
    else if (name.includes("onion") || name.includes("capsicum")) taste = "simple, crunchy, and classic veg";
    else if (name.includes("supreme")) taste = "loaded, veggie-rich, and filling";
    else if (name.includes("cheese")) taste = "soft, cheesy, and mild";

    return `- ${item.name} - ${formatPrice(item.price)}: ${taste}`;
  });

  return {
    answer: [
      "Pizza taste depends on what you prefer:",
      ...notes,
      "For spicy taste, I would pick Paneer Tikka Pizza or Mexican Pizza. For mild cheesy taste, Veg Cheese Pizza is better.",
    ].join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const buildBestTasteAnswer = (items, question) => {
  const text = question.toLowerCase();
  let candidates = items;

  if (!text.includes("spicy") && !text.includes("sweet") && !text.includes("dessert") && !text.includes("pizza") && !text.includes("burger") && !text.includes("drink")) {
    const favorites = pickCustomerFavorites(items, 6);

    if (!favorites.length) return null;

    return {
      answer: [
        "For best taste, I would recommend these customer-friendly picks:",
        ...favorites.map(formatItemLine),
        "Spring Roll and Spicy Veg Burger are good savory choices; Biscoff Pastry or Rasmalai are better if you want something sweet.",
      ].join("\n"),
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("spicy")) candidates = pickSpicyFavorites(items, 6);
  else if (text.includes("sweet") || text.includes("dessert")) candidates = items.filter(isCakeItem);
  else if (text.includes("pizza")) candidates = items.filter(isPizzaItem);
  else if (text.includes("burger")) candidates = items.filter(isBurgerItem);
  else if (text.includes("drink")) candidates = items.filter(isDrinkItem);

  const picks = candidates.length <= 6 ? candidates : pickAppealingItems(candidates, 6);

  if (!picks.length) return null;

  return {
    answer: [
      "For best taste, I would recommend these customer-friendly picks:",
      ...picks.map(formatItemLine),
      "Tell me if you want spicy, sweet, cheesy, light, or budget-friendly, and I will narrow it down.",
    ].join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const buildMenuOverviewAnswer = (items) => {
  const categories = uniqueByName(
    items
      .map((item) => ({ name: item.category || "Uncategorized" }))
      .filter((item) => item.name)
  )
    .map((item) => item.name)
    .slice(0, 10);
  const featuredItems = uniqueByName(
    items.filter((item) => item.is_featured || item.is_today_special)
  ).slice(0, 6);
  const sampleItems = featuredItems.length
    ? featuredItems
    : pickCustomerFavorites(items, 6);

  return {
    answer: [
      "Yes, we have a fresh menu ready for you.",
      categories.length ? `Popular sections: ${categories.join(", ")}.` : "",
      sampleItems.length ? `A few picks:\n${sampleItems.map(formatItemLine).join("\n")}` : "",
      "Tell me your budget or what you feel like eating, and I can suggest the best options.",
    ]
      .filter(Boolean)
      .join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const buildBirthdayComboAnswer = (items) => {
  const cake =
    itemNamedLike(items, ["cheese cake pastry", "biscoff pastry", "red velvet", "pineapple pastry"]) ||
    pickAppealingItems(items.filter(isCakeItem), 1)[0];
  const snackOne =
    itemNamedLike(items, ["spring roll", "spicy veg burger", "samosa chaat", "paneer tikka pizza"]) ||
    pickAppealingItems(items.filter((item) => isSnackItem(item) && !isDrinkItem(item) && !isCakeItem(item)), 1)[0];
  const snackTwo =
    itemNamedLike(items, ["paneer tikka pizza", "mexican pizza", "spicy veg burger", "samosa chaat"]) ||
    pickAppealingItems(
      items.filter((item) => isSnackItem(item) && !isDrinkItem(item) && !isCakeItem(item) && item.id !== snackOne?.id),
      1
    )[0];
  const drink =
    itemNamedLike(items, ["mint mojito", "mixed fruit juice", "cold coffee frappe", "sweet lassi"]) ||
    pickAppealingItems(items.filter((item) => isDrinkItem(item) && !String(item.name || "").toLowerCase().includes("tea")), 1)[0];
  const sweet =
    itemNamedLike(items, ["rasmalai", "gulab jamun", "falooda kulfi"]) ||
    null;
  const comboItems = uniqueByName([cake, snackOne, snackTwo, drink, sweet].filter(Boolean));

  if (!comboItems.length) {
    return null;
  }

  const total = comboItems.reduce((sum, item) => sum + Number(item.price || 0), 0);

  return {
    answer: [
      "Here is a better birthday combo idea from the menu:",
      ...comboItems.map(formatItemLine),
      `Estimated total: Rs. ${total.toFixed(0)}`,
      "It gives you one bakery item, one or two snacks, a drink, and a sweet finish.",
    ].join("\n"),
    sources: ["postgresql_menu_fallback"],
  };
};

const inferCustomerCategory = (item) => {
  const name = String(item.name || "").toLowerCase();

  if (name.includes("pizza")) return "Perfect Pizzas";
  if (includesAny(name, ["dosa", "uttapam", "sambhar", "vada"])) return "South Indian";
  if (includesAny(name, ["mojito", "curacao", "ice tea", "guava punch", "mango punch"])) return "Mocktails";
  if (includesAny(name, ["milk shake", "frappe", "milk badam"])) return "Milk Shakes";
  if (includesAny(name, ["tea", "coffee"])) return "Hot Beverages";
  if (includesAny(name, ["juice", "cold drink", "lassi", "sweet lime"])) return "Chilled Beverages";
  if (includesAny(name, ["rasmalai", "gulab", "jalebi", "imarti", "halwa", "kulfi", "falooda", "softy"])) return "Delectable Desserts";
  if (includesAny(name, ["pastry", "red velvet", "biscoff", "pineapple", "butterscotch", "pure chocolate"])) return "Pastries";
  if (includesAny(name, ["muffin", "cupcake"])) return "Muffins / Cupcakes";
  if (includesAny(name, ["donut", "vanilla / choco", "straco"])) return "Donuts";
  if (/\bpie\b|\btart\b/.test(name)) return "Pies / Tarts";
  if (includesAny(name, ["pudding"])) return "Puddings";
  if (includesAny(name, ["spring roll", "noodle", "momos", "manchurian", "cheese chilli"])) return "Chinese";
  if (includesAny(name, ["samosa", "dhokla", "kulcha", "bhature", "pav bhaji", "pakoda", "bedmi", "tikki", "khandvi"])) return "Indian Snacks";

  return item.category || "Uncategorized";
};

const isBadCustomerMenuItem = (item) => {
  const cleanName = normalizeCompactText(item.name);

  return (
    !cleanName ||
    ["350kg", "half", "ifull", "mocktails"].includes(cleanName) ||
    String(item.name || "").includes("[") ||
    String(item.name || "").includes("!")
  );
};

const cleanCustomerMenuRows = (rows) => {
  const byName = new Map();

  rows
    .filter((item) => !isBadCustomerMenuItem(item))
    .map((item) => ({
      ...item,
      category: inferCustomerCategory(item),
    }))
    .forEach((item) => {
      const key = normalizeCompactText(item.name);
      const existing = byName.get(key);

      if (!existing || Number(item.id || 0) < Number(existing.id || 0)) {
        byName.set(key, item);
      }
    });

  return Array.from(byName.values()).sort((a, b) => {
    const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
    return categoryCompare || String(a.name || "").localeCompare(String(b.name || ""));
  });
};

const loadAvailableMenuItems = async () => {
  const columnsResult = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'menu'"
  );
  const columns = new Set(columnsResult.rows.map((row) => row.column_name));
  const egglessSelect = columns.has("is_eggless") ? "m.is_eggless" : "false AS is_eggless";
  const todaySpecialSelect = columns.has("is_today_special") ? "m.is_today_special" : "false AS is_today_special";
  const caloriesSelect = columns.has("calories") ? "m.calories" : "NULL AS calories";
  const preparationTimeSelect = columns.has("preparation_time") ? "m.preparation_time" : "NULL AS preparation_time";

  const result = await pool.query(`
    SELECT
      m.id,
      m.name,
      m.description,
      m.price,
      m.veg_type,
      m.is_spicy,
      ${egglessSelect},
      ${todaySpecialSelect},
      ${caloriesSelect},
      ${preparationTimeSelect},
      m.is_featured,
      c.name AS category
    FROM menu m
    LEFT JOIN categories c
      ON c.id = m.category_id
    WHERE COALESCE(m.is_available, true) = true
    ORDER BY c.name, m.name;
  `);

  return cleanCustomerMenuRows(result.rows);
};

const buildNoMatchAnswer = (text) => {
  if (text.includes("pizza")) {
    return "I could not find a pizza matching that price or filter right now. You can try another budget or ask for snacks, rolls, burgers, or drinks.";
  }

  return "I could not find an exact menu match for that question. Try an item name, budget, or category like Spring Roll, pizza, snacks, cakes, or drinks.";
};

const isMenuOverviewQuestion = (text) =>
  /\b(menu|what do you have|show food|all items|categories|category|available items|food options)\b/.test(text);

const isWeakAiAnswer = (answer = "") => {
  const text = String(answer).toLowerCase();

  return (
    !text.trim() ||
    text.includes("do not want to guess") ||
    text.includes("do not have enough") ||
    text.includes("not enough context") ||
    text.includes("could not find matching") ||
    text.includes("no relevant information") ||
    text.includes("no vectors") ||
    text.includes("gemini did not return") ||
    text.includes("configured chroma collection") ||
    text.includes("admin can") ||
    text.includes("menu items must") ||
    text.includes("postgresql") ||
    text.includes("rag service")
  );
};

const isCustomerServiceQuestion = (question) => {
  const text = String(question || "").toLowerCase();

  return /\b(open|close|closing|timing|time|hours|address|location|located|map|reach|delivery|deliver|pickup|dine in|dine-in|takeaway|take away|payment|pay|cash|online|upi|card|cancel|cancellation|refund|return|exchange|replace|replacement|allergy|allergic|allergen|nuts|peanut|gluten|dairy|vegan|jain|custom|customize|customise|preorder|pre order|advance order|bulk|party|order status|place order|how do i order|how to order|how can i order|how to buy|checkout|cart|track|delayed|late)\b/.test(text);
};

const normalizeConversationText = (question = "") =>
  String(question)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeIntentText = (question = "") =>
  normalizeConversationText(question)
    .replace(/\bwaht\b/g, "what")
    .replace(/\bwht\b/g, "what")
    .replace(/\bwat\b/g, "what")
    .replace(/\bshoud\b/g, "should")
    .replace(/\bshuld\b/g, "should")
    .replace(/\btodays\b/g, "today")
    .replace(/\s+/g, " ")
    .trim();

const isMealRecommendationQuestion = (question) => {
  const text = normalizeIntentText(question);

  return (
    /\b(what|which|suggest|recommend|confused|hungry)\b/.test(text) &&
    /\b(should|can|to|want|eat|order|try|have)\b/.test(text) &&
    /\b(eat|order|try|have|food|item|snack|meal|today)\b/.test(text)
  );
};

const buildMealRecommendationAnswer = (items, question) => {
  const text = normalizeIntentText(question);
  let picks = [];

  if (text.includes("spicy")) {
    picks = pickSpicyFavorites(items, 5);
  } else if (text.includes("sweet") || text.includes("dessert")) {
    picks = pickItemsByName(items, ["biscoff pastry", "cheese cake pastry", "rasmalai", "gulab jamun", "falooda kulfi"], 5);
  } else if (text.includes("light")) {
    picks = pickItemsByName(items, ["spring roll", "samosa chaat", "mint mojito", "mixed fruit juice"], 5);
  } else {
    picks = pickCustomerFavorites(items, 5);
  }

  if (!picks.length) return null;

  return {
    answer: [
      "If you are not sure what to eat today, I would suggest:",
      ...picks.map(formatItemLine),
      "For a quick snack, pick Spring Roll or Spicy Veg Burger. For something filling, pick Paneer Tikka Pizza. For sweet cravings, pick Biscoff Pastry or Rasmalai.",
    ].join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const buildDietarySafetyAnswer = (question, items) => {
  const text = normalizeIntentText(question);

  if (/\b(vegan|jain|gluten|gluten free|gluten-free|nuts|nut|peanut|allergen|allergy|onion|garlic|dairy)\b/.test(text)) {
    const vegSuggestions = pickAppealingItems(items.filter(isVegetarianItem), 5);

    return {
      answer: [
        "I should not guess dietary or allergen information because those fields are not fully stored for every menu item yet.",
        vegSuggestions.length ? `I can show vegetarian menu items, but please confirm ingredients with the restaurant:\n${vegSuggestions.map(formatItemLine).join("\n")}` : "",
        "For safety, mention allergies or Jain/vegan/gluten-free/onion-garlic needs before ordering.",
      ]
        .filter(Boolean)
        .join("\n"),
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("vegetarian") || /\bveg\b/.test(text)) {
    if (text.includes("high protein")) {
      const proteinItems = pickAppealingItems(items.filter((item) => isVegetarianItem(item) && isPaneerItem(item)), 6);

      return {
        answer: proteinItems.length
          ? `High-protein vegetarian-style picks from the menu are mostly paneer/cheese items:\n${proteinItems.map(formatItemLine).join("\n")}`
          : "Protein data is not stored, but paneer/cheese items are usually the best vegetarian protein picks. Please confirm ingredients with the restaurant.",
        sources: ["postgresql_menu_live"],
      };
    }

    const vegItems = pickAppealingItems(items.filter(isVegetarianItem), 8);

    return {
      answer: vegItems.length
        ? `Vegetarian options available:\n${vegItems.map(formatItemLine).join("\n")}`
        : "I could not find vegetarian items marked in the menu right now.",
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("eggless")) {
    const egglessItems = pickAppealingItems(items.filter((item) => item.is_eggless), 8);
    const cakeItems = pickAppealingItems(items.filter(isCakeItem), 6);

    return {
      answer: egglessItems.length
        ? `Eggless items marked in the menu:\n${egglessItems.map(formatItemLine).join("\n")}`
        : [
            "No items are currently marked eggless in the menu.",
            cakeItems.length ? `Cake/bakery options found:\n${cakeItems.map(formatItemLine).join("\n")}` : "",
            "Please confirm eggless availability with the restaurant before ordering.",
          ].filter(Boolean).join("\n"),
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("low calorie") || text.includes("low-calorie") || text.includes("calorie")) {
    const calorieItems = items.filter((item) => Number(item.calories) > 0);

    if (calorieItems.length) {
      return {
        answer: `Lower-calorie marked items:\n${sortByPrice(calorieItems).slice(0, 6).map(formatDetailedItemLine).join("\n")}`,
        sources: ["postgresql_menu_live"],
      };
    }

    return {
      answer: "Calories are not stored for enough menu items yet, so I should not guess. For a lighter choice, ask for light snacks or drinks, and confirm nutrition with the restaurant.",
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("children") || text.includes("kids")) {
    const kidItems = pickAppealingItems(items.filter((item) => !isSpicyItem(item) && (isSnackItem(item) || isDrinkItem(item) || isCakeItem(item))), 6);

    return {
      answer: kidItems.length
        ? `Milder options that may suit children:\n${kidItems.map(formatItemLine).join("\n")}\nPlease confirm spice level before ordering for kids.`
        : "I could not find enough mild items from the menu right now. Please ask the restaurant before ordering for children.",
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("high protein")) {
    const proteinItems = pickAppealingItems(items.filter((item) => isVegetarianItem(item) && isPaneerItem(item)), 6);

    return {
      answer: proteinItems.length
        ? `High-protein vegetarian-style picks from the menu are mostly paneer/cheese items:\n${proteinItems.map(formatItemLine).join("\n")}`
        : "Protein data is not stored, but paneer/cheese items are usually the best vegetarian protein picks. Please confirm ingredients with the restaurant.",
      sources: ["postgresql_menu_live"],
    };
  }

  return null;
};

const buildTasteAnswer = (question, items) => {
  const text = normalizeIntentText(question);
  let picks = [];
  let intro = "";

  if (text.includes("not spicy") || text.includes("mild")) {
    picks = pickAppealingItems(items.filter((item) => !isSpicyItem(item)), 6);
    intro = "Milder, non-spicy style options:";
  } else if (text.includes("sweet")) {
    picks = pickAppealingItems(items.filter(isSweetItem), 6);
    intro = "Sweet options from the menu:";
  } else if (text.includes("tangy")) {
    picks = pickAppealingItems(items.filter(isTangyItem), 6);
    intro = "Tangy choices I would suggest:";
  } else if (text.includes("crispy")) {
    picks = pickAppealingItems(items.filter(isCrispyItem), 6);
    intro = "Crispy choices from the menu:";
  } else if (text.includes("creamy") && text.includes("paneer")) {
    picks = pickAppealingItems(items.filter((item) => isPaneerItem(item) || itemText(item).includes("cheese")), 6);
    intro = "Creamy paneer/cheese-style choices:";
  } else if (text.includes("spiciest") && text.includes("pizza")) {
    picks = pickItemsByName(items, ["paneer tikka pizza", "mexican pizza"], 4);
    intro = "For the spiciest pizza-style taste, I would pick:";
  }

  if (!picks.length) return null;

  return {
    answer: `${intro}\n${picks.map(formatItemLine).join("\n")}`,
    sources: ["postgresql_menu_live"],
  };
};

const buildMenuSearchAnswer = (question, items) => {
  const text = normalizeIntentText(question);
  let predicate = null;
  let intro = "Matching items:";

  if (text.includes("paneer")) {
    predicate = isPaneerItem;
    intro = "Paneer/cheese items available:";
  } else if (text.includes("cold drink") || text.includes("cold drinks")) {
    predicate = (item) => isDrinkItem(item) && itemText(item).includes("cold");
    intro = "Cold drinks available:";
  } else if (text.includes("chinese")) {
    predicate = isChineseItem;
    intro = "Chinese food available:";
  } else if (text.includes("dessert") || text.includes("desserts")) {
    predicate = (item) => {
      const itemName = String(item.name || "").toLowerCase();
      const category = String(item.category || "").toLowerCase();

      return (
        (
          includesAny(category, ["dessert", "pastries", "donuts", "puddings", "pies", "tarts"]) &&
          !includesAny(itemName, ["mushroom", "paneer puff", "puff pastry", "pattie"])
        ) ||
        includesAny(itemName, ["rasmalai", "gulab", "jalebi", "imarti", "halwa", "kulfi", "falooda", "softy", "pastry", "cake", "muffin", "pudding"]) &&
          !includesAny(itemName, ["mushroom", "paneer puff", "puff pastry"])
      );
    };
    intro = "Desserts and sweets available:";
  } else if (text.includes("south indian")) {
    predicate = isSouthIndianItem;
    intro = "South Indian options available:";
  } else if (text.includes("available pizza") || text.includes("available pizzas") || text.includes("show pizza") || text.includes("show pizzas")) {
    predicate = isPizzaItem;
    intro = "Available pizzas:";
  } else if (text.includes("mushroom")) {
    predicate = (item) => itemText(item).includes("mushroom");
    intro = "Mushroom items available:";
  } else if (text.includes("drinks") && text.includes("without milk")) {
    predicate = (item) => isDrinkItem(item) && !includesAny(itemText(item), ["milk", "shake", "lassi", "coffee"]);
    intro = "Drinks that do not mention milk in the menu name/category:";
  } else if (text.includes("masala dosa")) {
    predicate = (item) => normalizeCompactText(item.name).includes("masaladosa");
    intro = "Masala dosa availability:";
  }

  if (!predicate) return null;

  const matches = pickAppealingItems(items.filter(predicate), 8);

  return {
    answer: matches.length
      ? `${intro}\n${matches.map(formatItemLine).join("\n")}`
      : "I could not find matching available items in the menu right now.",
    sources: ["postgresql_menu_live"],
  };
};

const buildBudgetAnswer = (question, items) => {
  const text = normalizeIntentText(question);
  const range = extractBudgetRange(question);
  const budget = extractBudget(question);
  const people = extractPeopleCount(question);

  if (range) {
    const matches = pickAppealingItems(items.filter((item) => Number(item.price) >= range.min && Number(item.price) <= range.max), 8);

    return {
      answer: matches.length
        ? `Items between Rs. ${range.min} and Rs. ${range.max}:\n${matches.map(formatItemLine).join("\n")}`
        : `I could not find available items between Rs. ${range.min} and Rs. ${range.max}.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("cheapest") && text.includes("pizza")) {
    const pizza = sortByPrice(items.filter(isPizzaItem))[0];

    return {
      answer: pizza
        ? `The cheapest pizza available is ${pizza.name} at ${formatPrice(pizza.price)}.`
        : "I could not find any available pizza right now.",
      sources: ["postgresql_menu_live"],
    };
  }

  if (budget !== null) {
    const matches = pickAppealingItems(items.filter((item) => Number(item.price) <= budget), 10);

    if (people || text.includes("combo") || text.includes("complete meal")) {
      const combo = buildGroupComboAnswer(items, budget, people || (text.includes("two") ? 2 : null));
      if (combo) return combo;
    }

    return {
      answer: matches.length
        ? `Good options under Rs. ${budget}:\n${matches.map(formatItemLine).join("\n")}`
        : `I could not find items under Rs. ${budget}. Tell me a higher budget and I will suggest the closest choices.`,
      sources: ["postgresql_menu_live"],
    };
  }

  return null;
};

const buildGroupComboAnswer = (items, budget, people = null) => {
  const picks = [];
  const addPick = (candidate) => {
    if (candidate && !picks.some((item) => item.id === candidate.id)) {
      picks.push(candidate);
    }
  };

  addPick(itemNamedLike(items, ["spring roll", "spicy veg burger", "samosa chaat"]));
  addPick(itemNamedLike(items, ["paneer tikka pizza", "mexican pizza", "veg cheese pizza"]));
  addPick(itemNamedLike(items, ["mint mojito", "mixed fruit juice", "cold drink"]));
  addPick(itemNamedLike(items, ["biscoff pastry", "rasmalai", "gulab jamun"]));

  const withinBudget = [];
  let total = 0;

  for (const item of picks) {
    if (budget === null || total + Number(item.price || 0) <= budget) {
      withinBudget.push(item);
      total += Number(item.price || 0);
    }
  }

  if (!withinBudget.length) return null;

  return {
    answer: [
      `Here is a ${people ? `combo idea for ${people} people` : "budget combo idea"}${budget ? ` under Rs. ${budget}` : ""}:`,
      ...withinBudget.map(formatItemLine),
      `Estimated total: Rs. ${total.toFixed(0)}`,
      people ? "For a group, increase quantities from the cart if needed." : "You can add these items to the cart and adjust quantities.",
    ].join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const buildItemDetailAnswer = (question, items) => {
  const text = normalizeIntentText(question);
  const item = findMenuItemFromText(question, items);

  if (!item) return null;

  if (text.includes("price") || text.includes("cost") || text.includes("rate")) {
    return {
      answer: `${item.name} is priced at ${formatPrice(item.price)}.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("ingredient") || text.includes("comes with")) {
    return {
      answer: item.description
        ? `${item.name}: ${item.description}`
        : `Ingredients/details for ${item.name} are not fully stored yet. Please confirm ingredients with the restaurant before ordering.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("calorie")) {
    return {
      answer: item.calories
        ? `${item.name} has ${item.calories} calories listed.`
        : `Calories for ${item.name} are not stored yet, so I should not guess.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("prepare") || text.includes("time") || text.includes("long")) {
    return {
      answer: item.preparation_time
        ? `${item.name} has an estimated preparation time of about ${item.preparation_time} minutes.`
        : `Preparation time for ${item.name} is not stored yet. The restaurant can confirm the current wait time after you order.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("vegetarian") || /\bveg\b/.test(text)) {
    return {
      answer: `${item.name} is marked as ${item.veg_type || "not specified"} in the menu.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (/\b(nuts|nut|peanut|allergen|allergy|dairy|gluten)\b/.test(text)) {
    return {
      answer: `Allergen details for ${item.name} are not fully stored yet, so I should not guess. Please confirm with the restaurant before ordering.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("size")) {
    return {
      answer: `Size information for ${item.name} is not stored yet. Please confirm size/portion with the restaurant.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("custom")) {
    return {
      answer: `${item.name} may be customizable only if the restaurant accepts the request. Add special instructions while ordering or confirm with the restaurant.`,
      sources: ["postgresql_menu_live"],
    };
  }

  return null;
};

const buildComparisonAnswer = (question, items) => {
  const text = normalizeIntentText(question);
  const mentionedItems = findMenuItemsMentioned(question, items, 4);

  if (!/\b(compare|better|cheaper|difference|less spicy|fewer calories)\b/.test(text) || mentionedItems.length < 2) {
    return null;
  }

  const [first, second] = mentionedItems;
  const cheaper = Number(first.price || 0) <= Number(second.price || 0) ? first : second;
  const spicier = isSpicyItem(first) && !isSpicyItem(second) ? first : isSpicyItem(second) && !isSpicyItem(first) ? second : null;
  const fewerCalories =
    first.calories && second.calories
      ? Number(first.calories) <= Number(second.calories)
        ? first
        : second
      : null;

  if (text.includes("cheaper")) {
    if (Number(first.price || 0) === Number(second.price || 0)) {
      return {
        answer: `${first.name} and ${second.name} have the same listed price: ${formatPrice(first.price)}.`,
        sources: ["postgresql_menu_live"],
      };
    }

    return {
      answer: `${cheaper.name} is cheaper at ${formatPrice(cheaper.price)}. ${first.name} is ${formatPrice(first.price)} and ${second.name} is ${formatPrice(second.price)}.`,
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("fewer calories")) {
    return {
      answer: fewerCalories
        ? `${fewerCalories.name} has fewer listed calories. ${first.name}: ${first.calories} cal, ${second.name}: ${second.calories} cal.`
        : "Calories are not stored for both items yet, so I should not guess.",
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("less spicy")) {
    const lessSpicy = spicier?.id === first.id ? second : spicier?.id === second.id ? first : null;

    return {
      answer: lessSpicy
        ? `${lessSpicy.name} should be the less spicy choice between the two.`
        : `Both ${first.name} and ${second.name} look similar for spice from the stored menu data. Please confirm spice level if needed.`,
      sources: ["postgresql_menu_live"],
    };
  }

  return {
    answer: [
      `${first.name}: ${formatPrice(first.price)}${isSpicyItem(first) ? ", spicy-style" : ""}${first.calories ? `, ${first.calories} cal` : ""}.`,
      `${second.name}: ${formatPrice(second.price)}${isSpicyItem(second) ? ", spicy-style" : ""}${second.calories ? `, ${second.calories} cal` : ""}.`,
      `${Number(first.price || 0) === Number(second.price || 0) ? "Both have the same listed price." : `${cheaper.name} is cheaper.`} ${spicier ? `${spicier.name} is likely spicier. ` : ""}Choose based on whether you want price, spice, or taste.`,
    ].join("\n"),
    sources: ["postgresql_menu_live"],
  };
};

const loadActiveCoupons = async () => {
  try {
    const result = await pool.query(`
      SELECT code, description, discount_type, discount_value, minimum_order_value,
             maximum_discount_value, expiry_date
      FROM coupons
      WHERE is_active = true
        AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      ORDER BY discount_value DESC
      LIMIT 6
    `);

    return result.rows;
  } catch {
    return [];
  }
};

const buildOfferAnswer = async (question) => {
  const text = normalizeIntentText(question);
  const coupons = await loadActiveCoupons();

  if (text.includes("two coupons") || text.includes("together")) {
    return {
      answer: "Usually only one coupon should be applied per order unless the restaurant has explicitly enabled stacking. Please confirm at checkout.",
      sources: ["coupons"],
    };
  }

  if (text.includes("free delivery")) {
    return {
      answer: "Free delivery minimum order is not configured in the current customer assistant data. Delivery or packing charges are shown at checkout.",
      sources: ["coupons"],
    };
  }

  if (!coupons.length) {
    return {
      answer: "No active coupons are listed right now. You can still ask for best-value combos or budget meals.",
      sources: ["coupons"],
    };
  }

  const lines = coupons.map((coupon) => {
    const discount = coupon.discount_type === "Percentage"
      ? `${Number(coupon.discount_value).toFixed(0)}%`
      : formatPrice(coupon.discount_value);
    const min = coupon.minimum_order_value ? `, minimum order ${formatPrice(coupon.minimum_order_value)}` : "";

    return `- ${coupon.code}: ${discount} off${min}${coupon.description ? ` - ${coupon.description}` : ""}`;
  });

  return {
    answer: `Active coupons/offers:\n${lines.join("\n")}`,
    sources: ["coupons"],
  };
};

const findOrderFromQuestion = async (question) => {
  const text = String(question || "");
  const orderMatch = text.match(/ORD-[A-Z0-9-]+/i);

  if (!orderMatch) return null;

  const result = await pool.query(
    `SELECT o.order_number, o.status, o.payment_status, o.total_amount, o.created_at,
            o.estimated_delivery_time, o.delivery_address, c.phone AS customer_phone
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE UPPER(o.order_number) = UPPER($1)
     LIMIT 1`,
    [orderMatch[0]]
  );

  return result.rows[0] || null;
};

const buildOrderSupportAnswer = async (question) => {
  const text = normalizeIntentText(question);
  const order = await findOrderFromQuestion(question);

  if (order) {
    return {
      answer: `Order ${order.order_number} is currently ${order.status}. Payment status: ${order.payment_status}. Total: ${formatPrice(order.total_amount)}.`,
      sources: ["orders"],
    };
  }

  if (text.includes("late")) {
    return {
      answer: "If your order is late, please share your order number or phone number with the restaurant so they can check the live status.",
      sources: ["orders"],
    };
  }

  if (text.includes("cancel")) {
    return {
      answer: "To cancel an order, contact the restaurant quickly with your order number or phone number. If the order has already started preparing, cancellation may depend on the restaurant.",
      sources: ["orders"],
    };
  }

  if (text.includes("address")) {
    return {
      answer: "To change a delivery address, contact the restaurant as soon as possible with your order number. Address changes depend on whether preparation or delivery has already started.",
      sources: ["orders"],
    };
  }

  return {
    answer: "Please share your order number, or use the same phone number you ordered with, so the restaurant can check live order status.",
    sources: ["orders"],
  };
};

const isOfferQuestion = (question) =>
  /\b(offer|offers|discount|coupon|coupons|student discount|large order|best value|free delivery)\b/.test(normalizeIntentText(question));

const isOrderSupportQuestion = (question) =>
  /\b(where is my order|order status|accepted|cancel my order|change my delivery address|deliver to my location|delivery charge|delivery charges|order is late|schedule an order|order later|has my order|how long will my order)\b/.test(normalizeIntentText(question));

const buildSmallTalkAnswer = (question) => {
  const text = normalizeConversationText(question);
  const compact = normalizeCompactText(text);

  if (/^(hy|hyy|hi|hii|hiii|hlo|helo|hello|hey|heyy|namaste|sat sri akal|ssakal)$/.test(text) || /^(hy|hyy|hii|hiii|hlo|helo|hello|hey|heyy)$/.test(compact)) {
    return {
      answer: "Hello! How can I help you today?",
      sources: ["customer_conversation"],
    };
  }

  if (/\b(how are you|how r you|how are u|hows your day|how's your day|how is your day|how was your day|kaise ho)\b/.test(text)) {
    return {
      answer: "I am doing well, thanks for asking. How can I help you with the menu today?",
      sources: ["customer_conversation"],
    };
  }

  if (/\b(good morning|good afternoon|good evening|good night)\b/.test(text)) {
    return {
      answer: "Hello! Hope you are having a good day. How can I help you with food or ordering?",
      sources: ["customer_conversation"],
    };
  }

  if (/\b(thank|thanks|thank you|thx)\b/.test(text)) {
    return {
      answer: "You are welcome. I am here if you want menu suggestions, prices, or help placing an order.",
      sources: ["customer_conversation"],
    };
  }

  if (/\b(who are you|what can you do|help me|what should i ask)\b/.test(text)) {
    return {
      answer: "I can help you choose food, compare prices, find spicy or sweet items, suggest combos, answer timing/location questions, and add items to your cart when you say add or order.",
      sources: ["customer_conversation"],
    };
  }

  return null;
};

const buildCustomerConciergeAnswer = async (question) => {
  const text = String(question || "").toLowerCase();
  const items = await loadAvailableMenuItems().catch(() => []);
  const smallTalkAnswer = buildSmallTalkAnswer(question);

  if (smallTalkAnswer) {
    return smallTalkAnswer;
  }

  if (/\b(open|close|closing|timing|time|hours|shop time)\b/.test(text)) {
    return {
      answer: "Our customer site shows MAHESH as open daily from 10:00 AM to 10:00 PM. For urgent visits, please confirm with the restaurant before travelling.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(address|location|where|located|map|reach)\b/.test(text)) {
    return {
      answer: "MAHESH Sweets & Bakers is listed at Tanda, Punjab-144024, India. You can also use the contact section on this website for social links and directions.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(custom|customize|customise|birthday cake|cake order|preorder|pre order|advance order|bulk|party)\b/.test(text)) {
    return {
      answer: "For custom cakes, party orders, or bulk orders, please contact the restaurant in advance. I can still help you browse cakes, snacks, drinks, and combo ideas from the current menu.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(order|place order|how to buy|checkout|cart)\b/.test(text)) {
    return {
      answer: "To order, add your items to the cart, enter your name and phone number, choose pickup, dine-in, or delivery, then send the order request. I can also add items when you say something like: add one Spring Roll.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(delivery|deliver|pickup|dine in|dine-in|takeaway|take away)\b/.test(text)) {
    return {
      answer: "You can choose pickup, dine-in, or delivery on the order form. Delivery availability may depend on your location, so the restaurant can confirm after you send the request.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(payment|pay|cash|online|upi|card)\b/.test(text)) {
    return {
      answer: "Checkout supports UPI, debit or credit card, net banking, wallet, Cash on Delivery, and Pay at Restaurant Counter. Online payments are confirmed only after secure server verification.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(cancel|cancellation|refund|return|exchange|replace|replacement|change order|modify)\b/.test(text)) {
    return {
      answer: "For cancellation, return, exchange, or refund requests, please contact the restaurant as soon as possible with your order details. Food quality issues are best handled immediately so the team can check the order while it is fresh.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(allergy|allergic|allergen|nuts|peanut|gluten|dairy|egg|eggs|vegan|jain)\b/.test(text)) {
    return {
      answer: "Please mention any allergy or dietary requirement before ordering. I can suggest menu options, but ingredients and cross-contact should be confirmed directly with the restaurant for safety.",
      sources: ["customer_concierge"],
    };
  }

  if (/\b(order status|track|accepted|preparing|ready|delayed|late)\b/.test(text)) {
    return {
      answer: "After you place an order, the restaurant can update its status as accepted, preparing, ready, completed, or cancelled. Keep the same phone number on your order so notifications can reach you.",
      sources: ["customer_concierge"],
    };
  }

  if (isMenuOverviewQuestion(text) && items.length) {
    return buildMenuOverviewAnswer(items);
  }

  if (items.length) {
    return {
      answer: "I can help with menu prices, recommendations, combos, ordering, shop timing, and location. You can ask me things like: recommend spicy snacks, show drinks under Rs. 100, what is today's special, or add one Spring Roll.",
      sources: ["customer_concierge"],
    };
  }

  return {
    answer: "I can help with menu recommendations, prices, cart ordering, shop timing, and location. Please ask your question again with an item name or a little more detail.",
    sources: ["customer_concierge"],
  };
};

const buildDatabaseFallbackAnswer = async (question) => {
  const text = question.toLowerCase();
  const budget = extractBudget(question);
  const items = await loadAvailableMenuItems();
  const directItem = findMenuItemFromText(question, items);

  if (directItem) {
    return buildItemAvailabilityAnswer(directItem);
  }

  if (isMenuOverviewQuestion(text)) {
    return buildMenuOverviewAnswer(items);
  }

  if (isMealRecommendationQuestion(question)) {
    const recommendation = buildMealRecommendationAnswer(items, question);

    if (recommendation) {
      return recommendation;
    }
  }

  const budgetAnswer = buildBudgetAnswer(question, items);

  if (budgetAnswer) {
    return budgetAnswer;
  }

  const dietaryAnswer = buildDietarySafetyAnswer(question, items);

  if (dietaryAnswer) {
    return dietaryAnswer;
  }

  const comparisonAnswer = buildComparisonAnswer(question, items);

  if (comparisonAnswer) {
    return comparisonAnswer;
  }

  const detailAnswer = buildItemDetailAnswer(question, items);

  if (detailAnswer) {
    return detailAnswer;
  }

  if (text.includes("today") && text.includes("special")) {
    const officialSpecials = pickAppealingItems(
      items.filter((item) => item.is_today_special || item.is_featured),
      6
    );
    const suggestedSpecials = officialSpecials.length
      ? officialSpecials
      : pickCustomerFavorites(items, 6);

    return {
      answer: [
        officialSpecials.length
          ? "Today's marked specials are:"
          : "No official special is marked today, but I would suggest these popular picks:",
        ...suggestedSpecials.map(formatItemLine),
        "You can tell me your budget or taste preference and I will narrow it down.",
      ].join("\n"),
      sources: ["postgresql_menu_live"],
    };
  }

  if (text.includes("taste") && text.includes("pizza")) {
    const pizzaTasteAnswer = buildPizzaTasteAnswer(items);

    if (pizzaTasteAnswer) {
      return pizzaTasteAnswer;
    }
  }

  const tasteAnswer = buildTasteAnswer(question, items);

  if (tasteAnswer) {
    return tasteAnswer;
  }

  const searchAnswer = buildMenuSearchAnswer(question, items);

  if (searchAnswer) {
    return searchAnswer;
  }

  if (
    text.includes("best") ||
    text.includes("taste") ||
    text.includes("popular") ||
    text.includes("famous")
  ) {
    const bestTasteAnswer = buildBestTasteAnswer(items, question);

    if (bestTasteAnswer) {
      return bestTasteAnswer;
    }
  }

  if (text.includes("spicy") && (text.includes("recommend") || text.includes("suggest") || text.includes("snack") || text.includes("eat") || text.includes("food"))) {
    const spicyPicks = pickSpicyFavorites(items, 6);

    if (spicyPicks.length) {
      return {
        answer: [
          "For spicy taste, I would recommend:",
          ...spicyPicks.map(formatItemLine),
          "Spring Roll and Spicy Veg Burger are quick choices; Paneer Tikka Pizza or Mexican Pizza are better if you want something more filling.",
        ].join("\n"),
        sources: ["postgresql_menu_live"],
      };
    }
  }

  if (/\b(budget combo|combo for|family|people|person|office|meeting|group|party|starter|main course|dessert|complete meal)\b/.test(text)) {
    const combo = buildGroupComboAnswer(items, budget, extractPeopleCount(question));

    if (combo) {
      return combo;
    }
  }

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
    "roll",
    "rolls",
    "puff",
    "puffs",
    "pastry",
    "pastries",
    "noodle",
    "noodles",
    "dosa",
    "drink",
    "beverage",
  ];
  const requestedTerms = foodTerms.filter((term) => text.includes(term));

  let matchingItems = items.filter((item) => {
    const name = String(item.name || "").toLowerCase();
    const searchableText = itemText(item);

    // Some imported records have incorrect categories, so pizza must match name.
    if (text.includes("pizza") && !name.includes("pizza")) {
      return false;
    }

    if (text.includes("burger") && !isBurgerItem(item)) {
      return false;
    }

    if ((text.includes("roll") || text.includes("rolls")) && !isRollItem(item)) {
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

  if (!requestedTerms.length && budget === null && !text.includes("spicy") && !text.includes("eggless") && !(text.includes("today") && text.includes("special"))) {
    return {
      answer: "I could not find that exact item. Please try the exact item name, like Spring Roll, Pizza, Burger, or Noodles.",
      sources: ["postgresql_menu_live"],
    };
  }

  if (!matchingItems.length && text.includes("eggless") && (text.includes("cake") || text.includes("cakes"))) {
    const cakeItems = selectItems(items, isCakeItem, 6);

    if (cakeItems.length) {
      return {
        answer: [
          "No cake is currently marked as eggless in the menu.",
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
        answer: "No item is currently marked as today's special right now. You can still ask me for spicy snacks, bakery items, drinks, or budget-friendly picks.",
        sources: ["postgresql_menu_fallback"],
      };
    }
  }

  if (!matchingItems.length) {
    if (budget !== null && text.includes("pizza")) {
      const closestPizzaAnswer = buildClosestBudgetAnswer(items.filter(isPizzaItem), "pizza", budget);

      if (closestPizzaAnswer) {
        return closestPizzaAnswer;
      }
    }

    if (budget !== null && text.includes("burger")) {
      const closestBurgerAnswer = buildClosestBudgetAnswer(items.filter(isBurgerItem), "burger", budget);

      if (closestBurgerAnswer) {
        return closestBurgerAnswer;
      }
    }

    return {
      answer: buildNoMatchAnswer(text),
      sources: ["postgresql_menu_live"],
    };
  }

  const shouldUseRecommendationRank =
    text.includes("recommend") ||
    text.includes("suggest") ||
    text.includes("spicy") ||
    text.includes("special") ||
    text.includes("best") ||
    text.includes("popular");
  const rankedItems = shouldUseRecommendationRank
    ? pickAppealingItems(matchingItems, 6)
    : uniqueByName(sortByPrice(matchingItems)).slice(0, 6);
  const lines = rankedItems.map(formatItemLine);
  const availabilityPrefix =
    /\b(available|avilable|have|has|do you have|is there|any)\b/.test(text) && requestedTerms.length
      ? `Yes, ${requestedTerms[0].replace(/s$/, "")} options are available. Good choices:\n`
      : "Here are good matches from the menu:\n";

  return {
    answer: `${availabilityPrefix}${lines.join("\n")}`,
    sources: ["postgresql_menu_live"],
  };
};

export const askAIAssistant = async (req, res) => {
  try {
    const { question } = req.body;

    const validation = validateCustomerQuestion(req, question);

    if (validation) {
      return res.status(validation.status).json(validation.payload);
    }

    console.log("AI Assistant Question:", question);
    console.log("Routing to RAG Chatbot API:", RAG_CHATBOT_URL);

    const directDatabaseAnswer = await buildDirectDatabaseItemAnswer(question);

    if (directDatabaseAnswer) {
      return res.status(200).json({
        success: true,
        type: "database_menu",
        answer: directDatabaseAnswer.answer,
        sources: directDatabaseAnswer.sources,
        rag_status: "matched_live_menu_item",
      });
    }

    const smallTalkAnswer = buildSmallTalkAnswer(question);

    if (smallTalkAnswer) {
      return res.status(200).json({
        success: true,
        type: "customer_conversation",
        answer: smallTalkAnswer.answer,
        sources: smallTalkAnswer.sources,
        rag_status: "conversation",
      });
    }

    if (extractBudget(question) !== null || extractBudgetRange(question) || extractPeopleCount(question)) {
      const items = await loadAvailableMenuItems();
      const budgetAnswer = buildBudgetAnswer(question, items) || buildGroupComboAnswer(items, extractBudget(question), extractPeopleCount(question));

      if (budgetAnswer) {
        return res.status(200).json({
          success: true,
          type: "database_menu",
          answer: budgetAnswer.answer,
          sources: budgetAnswer.sources,
          rag_status: "budget_or_group",
        });
      }
    }

    if (isMealRecommendationQuestion(question)) {
      const items = await loadAvailableMenuItems();
      const recommendation = buildMealRecommendationAnswer(items, question);

      if (recommendation) {
        return res.status(200).json({
          success: true,
          type: "database_menu",
          answer: recommendation.answer,
          sources: recommendation.sources,
          rag_status: "meal_recommendation",
        });
      }
    }

    if (isOfferQuestion(question)) {
      const offerAnswer = await buildOfferAnswer(question);

      return res.status(200).json({
        success: true,
        type: "offers",
        answer: offerAnswer.answer,
        sources: offerAnswer.sources,
        rag_status: "offers",
      });
    }

    if (isOrderSupportQuestion(question)) {
      const orderAnswer = await buildOrderSupportAnswer(question);

      return res.status(200).json({
        success: true,
        type: "order_support",
        answer: orderAnswer.answer,
        sources: orderAnswer.sources,
        rag_status: "order_support",
      });
    }

    if (/\b(vegetarian|vegan|jain|gluten|eggless|calorie|calories|protein|children|kids|nuts|nut|peanut|allergen|allergy|onion|garlic|dairy)\b/.test(normalizeIntentText(question))) {
      const items = await loadAvailableMenuItems();
      const dietaryAnswer = buildDietarySafetyAnswer(question, items);

      if (dietaryAnswer) {
        return res.status(200).json({
          success: true,
          type: "database_menu",
          answer: dietaryAnswer.answer,
          sources: dietaryAnswer.sources,
          rag_status: "dietary_safety",
        });
      }
    }

    if (isCustomerServiceQuestion(question)) {
      const customerAnswer = await buildCustomerConciergeAnswer(question);

      return res.status(200).json({
        success: true,
        type: "customer_concierge",
        answer: customerAnswer.answer,
        sources: customerAnswer.sources,
        rag_status: "customer_service",
      });
    }

    if (isMenuQuestion(question)) {
      const databaseAnswer = await buildDatabaseFallbackAnswer(question);

      return res.status(200).json({
        success: true,
        type: "database_menu",
        answer: databaseAnswer.answer,
        sources: databaseAnswer.sources,
        rag_status: "bypassed_for_live_menu",
      });
    }

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

    if (isWeakAiAnswer(response.data.answer)) {
      const fallback = await buildCustomerConciergeAnswer(question);

      return res.status(200).json({
        success: true,
        type: "customer_concierge",
        answer: fallback.answer,
        sources: fallback.sources,
        rag_status: "replaced_weak_answer",
      });
    }

    return res.status(200).json({
      success: true,
      type: "rag_chatbot",
      answer: limitResponseText(response.data.answer),
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

    const customerFallback = await buildCustomerConciergeAnswer(req.body.question);

    return res.status(200).json({
      success: true,
      type: "customer_concierge",
      answer: customerFallback.answer,
      sources: customerFallback.sources,
      rag_status: "error_recovered",
    });
  }
};
