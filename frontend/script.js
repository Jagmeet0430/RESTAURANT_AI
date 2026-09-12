const fallbackMenuItems = [
  { id: 1, name: "Potato Puff", category: "Puffs Patties & Rolls", price: 25 },
  { id: 2, name: "Paneer Puff Pastry", category: "Puffs Patties & Rolls", price: 60 },
  { id: 3, name: "Mushroom Puff Pastry", category: "Puffs Patties & Rolls", price: 50 },
  { id: 4, name: "Assorted Corn Pattie", category: "Puffs Patties & Rolls", price: 60 },
  { id: 5, name: "Paneer Roll", category: "Puffs Patties & Rolls", price: 80 },
  { id: 6, name: "Cheese Bun Patties Sandwich", category: "Puffs Patties & Rolls", price: 80 },
  { id: 7, name: "Cheese Patties Roll", category: "Puffs Patties & Rolls", price: 80 },
  { id: 8, name: "Cheese Corn Roll", category: "Puffs Patties & Rolls", price: 90 },
  { id: 9, name: "Regular Pastry", category: "Pastries", price: 20 },
  { id: 10, name: "Chocolate Pineapple Strawberry", category: "Pastries", price: 60 },
  { id: 11, name: "Pineapple Pastry", category: "Pastries", price: 60 },
  { id: 12, name: "Butterscotch Pastry", category: "Pastries", price: 60 },
  { id: 13, name: "Fresh Fruit Pastry", category: "Pastries", price: 60 },
  { id: 14, name: "Pure Chocolate", category: "Pastries", price: 60 },
  { id: 15, name: "Red Velvet", category: "Pastries", price: 70 },
  { id: 16, name: "Black Velvet Pastry", category: "Pastries", price: 70 },
  { id: 17, name: "Cassiss Pastry", category: "Pastries", price: 75 },
  { id: 18, name: "Biscoff Pastry", category: "Pastries", price: 80 },
  { id: 19, name: "Cheese Cake Pastry", category: "Pastries", price: 100 },
  { id: 20, name: "Red Velvet Pastry", category: "Pastries", price: 110 },
  { id: 21, name: "Vanilla Swiss Roll", category: "Swiss Roll", price: 40 },
  { id: 22, name: "Chocolate Swiss Roll", category: "Swiss Roll", price: 60 },
  { id: 23, name: "Jam Roll", category: "Swiss Roll", price: 45 },
  { id: 24, name: "Vanilla / Choco", category: "Donuts", price: 70 },
  { id: 25, name: "Chocolate", category: "Donuts", price: 50 },
  { id: 26, name: "Straco Chips", category: "Donuts", price: 50 },
  { id: 27, name: "Apple Pie", category: "Pies / Tarts", price: 120 },
  { id: 28, name: "Black Forest Pie", category: "Pies / Tarts", price: 120 },
  { id: 29, name: "Chocolate Pie", category: "Pies / Tarts", price: 120 },
  { id: 30, name: "Belgian Fruit Tart", category: "Pies / Tarts", price: 60 },
  { id: 31, name: "Belgian Chocolate Pie", category: "Pies / Tarts", price: 90 },
  { id: 32, name: "Vanilla Muffins", category: "Muffins / Cupcakes", price: 40 },
  { id: 33, name: "Chocolate Muffins", category: "Muffins / Cupcakes", price: 50 },
  { id: 34, name: "Oreo Muffins", category: "Muffins / Cupcakes", price: 60 },
  { id: 35, name: "Red Velvet Pudding", category: "Puddings", price: 50 },
  { id: 36, name: "Chocolate Pudding", category: "Puddings", price: 50 },
  { id: 37, name: "Veg Cheese Pizza", category: "Perfect Pizzas", price: 250 },
  { id: 38, name: "Mexican Pizza", category: "Perfect Pizzas", price: 220 },
  { id: 39, name: "Paneer Tikka Pizza", category: "Perfect Pizzas", price: 220 },
  { id: 40, name: "Onion and Capsicum Pizza", category: "Perfect Pizzas", price: 220 },
  { id: 41, name: "Veggie Supreme Pizza", category: "Perfect Pizzas", price: 250 },
  { id: 42, name: "Club Sandwich (3 Piece)", category: "Burger & Sandwiches", price: 40 },
  { id: 43, name: "Buttered Toast", category: "Burger & Sandwiches", price: 30 },
  { id: 44, name: "Channa Sandwich", category: "Burger & Sandwiches", price: 80 },
  { id: 45, name: "Channa Masney Sandwich", category: "Burger & Sandwiches", price: 80 },
  { id: 46, name: "Potato Chutwich", category: "Burger & Sandwiches", price: 60 },
  { id: 47, name: "Chilli Paneer Sandwich", category: "Burger & Sandwiches", price: 120 },
  { id: 48, name: "Resh Paneer Sandwich", category: "Burger & Sandwiches", price: 120 },
  { id: 49, name: "Masala Regular Burger", category: "Burger & Sandwiches", price: 120 },
  { id: 50, name: "Vegalo Hotger", category: "Burger & Sandwiches", price: 80 },
  { id: 51, name: "Spicy Veg Burger", category: "Burger & Sandwiches", price: 80 },
  { id: 52, name: "Cheesy French Fries (Plate)", category: "Burger & Sandwiches", price: 60 },
  { id: 53, name: "Cheesy French Fiates", category: "Burger & Sandwiches", price: 130 },
  { id: 54, name: "Samosa Chaat", category: "Chaat", price: 50 },
  { id: 55, name: "Tikki Aloo Chaat", category: "Chaat", price: 120 },
  { id: 56, name: "Raj Kachori Chaat", category: "Chaat", price: 80 },
  { id: 57, name: "Sev Puri", category: "Chaat", price: 60 },
  { id: 58, name: "Papdi Puri", category: "Chaat", price: 60 },
  { id: 59, name: "Dahi Golgappe (Per 6 Pcs)", category: "Chaat", price: 60 },
  { id: 60, name: "Jhal / Suji Golgappe (Per 6 Pcs)", category: "Chaat", price: 30 },
  { id: 61, name: "Veggie Noodles", category: "Chinese", price: 120 },
  { id: 62, name: "Hakka Noodles", category: "Chinese", price: 150 },
  { id: 63, name: "Cheese Chilli", category: "Chinese", price: 150 },
  { id: 64, name: "Manchurian (Plate)", category: "Chinese", price: 180 },
  { id: 65, name: "Fried Momos (Plate)", category: "Chinese", price: 100 },
  { id: 66, name: "Spring Roll", category: "Chinese", price: 80 },
  { id: 67, name: "Plain Dosa", category: "South Indian", price: 80 },
  { id: 68, name: "Masala Dosa", category: "South Indian", price: 100 },
  { id: 69, name: "Paneer Dosa", category: "South Indian", price: 120 },
  { id: 70, name: "Onion Dosa", category: "South Indian", price: 120 },
  { id: 71, name: "Uttapam", category: "South Indian", price: 150 },
  { id: 72, name: "Sambhar Vada", category: "South Indian", price: 70 },
  { id: 73, name: "Tea", category: "Hot Beverages", price: 10 },
  { id: 74, name: "Hot Milk", category: "Hot Beverages", price: 20 },
  { id: 75, name: "Hot Coffee", category: "Hot Beverages", price: 50 },
  { id: 76, name: "Green Tea", category: "Hot Beverages", price: 40 },
  { id: 77, name: "Carrot (Gajar) Juice", category: "Chilled Beverages", price: 50 },
  { id: 78, name: "Pineapple Juice", category: "Chilled Beverages", price: 50 },
  { id: 79, name: "Orange Juice", category: "Chilled Beverages", price: 50 },
  { id: 80, name: "Mixed Fruit Juice", category: "Chilled Beverages", price: 50 },
  { id: 81, name: "Mosambi Juice", category: "Chilled Beverages", price: 50 },
  { id: 82, name: "Sweet Lassi", category: "Chilled Beverages", price: 80 },
  { id: 83, name: "Masala Lassi", category: "Chilled Beverages", price: 40 },
  { id: 84, name: "Cold Drink", category: "Chilled Beverages", price: 30 },
  { id: 85, name: "Milk Badam", category: "Milk Shakes", price: 60 },
  { id: 86, name: "Strawberry Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 87, name: "Burberry Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 88, name: "Bubblegum Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 89, name: "Butterscotch Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 90, name: "Chocolate Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 91, name: "Chocolate Oreo Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 92, name: "Banana Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 93, name: "Mango Milk Shake", category: "Milk Shakes", price: 70 },
  { id: 94, name: "Cold Coffee Frappe", category: "Milk Shakes", price: 70 },
  { id: 95, name: "Frappe Mocha", category: "Milk Shakes", price: 70 },
  { id: 96, name: "Frappe Caramel", category: "Milk Shakes", price: 70 },
  { id: 105, name: "Mint Mojito", category: "Mocktails", price: 70 },
  { id: 106, name: "Blue Curacao", category: "Mocktails", price: 70 },
  { id: 107, name: "Fruit Ice Tea", category: "Mocktails", price: 70 },
  { id: 108, name: "Spicy Mango Punch", category: "Mocktails", price: 70 },
  { id: 109, name: "Spicy Guava Punch", category: "Mocktails", price: 70 },
  { id: 110, name: "Split Guava Punch", category: "Mocktails", price: 70 },
  { id: 111, name: "Dhokla Plain Plate", category: "Indian Snacks", price: 20 },
  { id: 112, name: "Paneer Dhokla Plate", category: "Indian Snacks", price: 30 },
  { id: 113, name: "Sandwich Dhokla", category: "Indian Snacks", price: 30 },
  { id: 114, name: "Khandvi Plate", category: "Indian Snacks", price: 50 },
  { id: 115, name: "Chhole Kulcha Plate", category: "Indian Snacks", price: 50 },
  { id: 116, name: "Stuffed Paneer Kulcha Plate (250 gm)", category: "Indian Snacks", price: 120 },
  { id: 117, name: "Stuffed Bread Pakoda (Per Piece)", category: "Indian Snacks", price: 20 },
  { id: 118, name: "Chhole Bhature Plate (Half)", category: "Indian Snacks", price: 40 },
  { id: 119, name: "Chhole Bhature Plate (Full)", category: "Indian Snacks", price: 60 },
  { id: 120, name: "Samosa with Chutney (Half)", category: "Indian Snacks", price: 15 },
  { id: 121, name: "Samosa with Chutney (Full)", category: "Indian Snacks", price: 30 },
  { id: 122, name: "Samosa with Channa (Half)", category: "Indian Snacks", price: 30 },
  { id: 123, name: "Samosa with Channa (Full)", category: "Indian Snacks", price: 50 },
  { id: 124, name: "Tikki with Chutney (Half)", category: "Indian Snacks", price: 30 },
  { id: 125, name: "Tikki with Chutney (Full)", category: "Indian Snacks", price: 50 },
  { id: 126, name: "Tikki with Channa (Half)", category: "Indian Snacks", price: 60 },
  { id: 127, name: "Tikki with Channa (Full)", category: "Indian Snacks", price: 90 },
  { id: 128, name: "Bedmi Puri", category: "Indian Snacks", price: 60 },
  { id: 129, name: "Extra Puri", category: "Indian Snacks", price: 20 },
  { id: 130, name: "Pav Bhaji", category: "Indian Snacks", price: 60 },
  { id: 131, name: "Extra Pav", category: "Indian Snacks", price: 15 },
  { id: 132, name: "Channa Plate (Extra)", category: "Indian Snacks", price: 30 },
  { id: 133, name: "Pav Plate (Extra)", category: "Indian Snacks", price: 30 },
  { id: 134, name: "Sambhar Plate (Extra)", category: "Indian Snacks", price: 30 },
  { id: 151, name: "Masala Dhokla", category: "Indian Snacks", price: 30 },
  { id: 135, name: "Moong-dal Halwa (Per Plate)", category: "Delectable Desserts", price: 60 },
  { id: 136, name: "Chenna Sandwich Roll", category: "Delectable Desserts", price: 30 },
  { id: 137, name: "Chenna Malai Roll", category: "Delectable Desserts", price: 35 },
  { id: 138, name: "Jalebi", category: "Delectable Desserts", price: 350 },
  { id: 139, name: "Imarti", category: "Delectable Desserts", price: 40 },
  { id: 140, name: "Hot Gulab Jamun Plate", category: "Delectable Desserts", price: 40 },
  { id: 141, name: "Sponge Rasgulla (2 Piece)", category: "Delectable Desserts", price: 45 },
  { id: 142, name: "Hot Gajrela (100 gm)", category: "Delectable Desserts", price: 50 },
  { id: 143, name: "Rasmalai Glass (Angoori)", category: "Delectable Desserts", price: 40 },
  { id: 144, name: "Vanilla Softy Ice Cream Cone", category: "Delectable Desserts", price: 40 },
  { id: 145, name: "Strawberry Softy Ice Cream Cone", category: "Delectable Desserts", price: 50 },
  { id: 146, name: "Vanilla Softy Cup", category: "Delectable Desserts", price: 40 },
  { id: 147, name: "Strawberry Softy Cup", category: "Delectable Desserts", price: 50 },
  { id: 148, name: "Mix Softy Cup", category: "Delectable Desserts", price: 50 },
  { id: 149, name: "Falooda Kulfi", category: "Delectable Desserts", price: 70 },
  { id: 150, name: "Rabri Falooda", category: "Delectable Desserts", price: 70 },
];

let menuItems = [];

const kioskSearchParams = new URLSearchParams(window.location.search);
const KIOSK_MODE_ENABLED =
  kioskSearchParams.get("kiosk") === "1" ||
  window.location.pathname.replace(/\/+$/, "").endsWith("/customer/kiosk");
const TABLE_QR_TOKEN = kioskSearchParams.get("table") || "";
const TABLE_QR_MODE_ENABLED = !KIOSK_MODE_ENABLED && Boolean(TABLE_QR_TOKEN.trim());
const kioskConfig = window.RESTAURANTAI_CONFIG?.kiosk || {};

function kioskSecondsParam(queryKey, configKey, fallback, minimum) {
  const rawValue = kioskSearchParams.get(queryKey) || kioskConfig[configKey] || fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? Math.max(minimum, value) : fallback;
}

const KIOSK_IDLE_TIMEOUT_MS = kioskSecondsParam("kioskIdleSeconds", "idleTimeoutSeconds", 120, 30) * 1000;
const KIOSK_IDLE_GRACE_MS = kioskSecondsParam("kioskIdleGraceSeconds", "idleGraceSeconds", 15, 5) * 1000;
const KIOSK_CONFIRMATION_RESET_SECONDS = kioskSecondsParam("kioskResetSeconds", "confirmationResetSeconds", 25, 5);
const KIOSK_NAME_MAX_LENGTH = 40;
const KIOSK_PHONE_MAX_LENGTH = 15;

const state = {
  selectedCategory: "All",
  cart: [],
  cartFeedback: null,
  confirmation: null,
  orderSuccess: null,
  checkoutStep: "cart",
  paymentMethod: "pay_at_counter",
  onlinePaymentsEnabled: true,
  paymentMethodsLoaded: false,
  menuStatus: "loading",
  menuError: "",
  voiceReply: true,
  recognition: null,
  isListening: false,
  lastRecommendedItems: [],
  chatSending: false,
  isSubmittingOrder: false,
  orderIdempotencyKey: "",
  restaurantSettings: null,
  tableQr: {
    enabled: TABLE_QR_MODE_ENABLED,
    token: TABLE_QR_TOKEN.trim(),
    status: TABLE_QR_MODE_ENABLED ? "loading" : "idle",
    table: null,
    error: "",
  },
  kiosk: {
    enabled: KIOSK_MODE_ENABLED,
    screen: "welcome",
    orderType: "",
    paymentMethod: "pay_at_counter",
    searchQuery: "",
    customerName: "",
    customerPhone: "",
    submissionError: "",
    idleWarning: false,
    idleTimer: null,
    idleGraceTimer: null,
    resetTimer: null,
    resetInterval: null,
    resetRemaining: 0,
    clearConfirm: false,
    initialized: false,
    eventsBound: false,
    menuRefreshTimer: null,
    settingsRefreshTimer: null,
    keyboard: {
      activeField: "",
      nameCaps: true,
    },
    printedReceiptOrderIds: new Set(),
    printingReceiptOrderIds: new Set(),
  },
};

const elements = {
  menuGrid: document.querySelector("#menuGrid"),
  filters: document.querySelector("#categoryFilters"),
  searchInput: document.querySelector("#searchInput"),
  cartItems: document.querySelector("#cartItems"),
  cartTotal: document.querySelector("#cartTotal"),
  cartCount: document.querySelector("#cartCount"),
  cartHint: document.querySelector("#cartHint"),
  clearCart: document.querySelector("#clearCart"),
  placeOrder: document.querySelector("#placeOrder"),
  customerName: document.querySelector("#customerName"),
  customerPhone: document.querySelector("#customerPhone"),
  orderType: document.querySelector("#orderType"),
  menuCount: document.querySelector("#menuCount"),
  activeCategoryLabel: document.querySelector("#activeCategoryLabel"),
  cartSubtotal: document.querySelector("#cartSubtotal"),
  cartTax: document.querySelector("#cartTax"),
  cartPacking: document.querySelector("#cartPacking"),
  paymentMethods: document.querySelector("#paymentMethods"),
  chatWidget: document.querySelector(".chat-widget"),
  chatToggle: document.querySelector("#chatToggle"),
  chatPanel: document.querySelector("#chatPanel"),
  chatMessages: document.querySelector("#chatMessages"),
  chatPrompts: document.querySelector("#chatPrompts"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  voiceButton: document.querySelector("#voiceButton"),
  voiceToggle: document.querySelector("#voiceToggle"),
  chatStatus: document.querySelector("#chatStatus"),
  toast: document.querySelector("#toast"),
};

const LOCAL_API_BASE_URL = "http://localhost:5001/api";
const PRODUCTION_API_BASE_URL = "https://restaurantai-api.vercel.app/api";
const storedApiBaseUrl = localStorage.getItem("restaurantApiBaseUrl");
const configuredApiBaseUrl =
  window.RESTAURANTAI_API_BASE_URL ||
  window.RESTAURANT_API_BASE_URL ||
  window.RESTAURANTAI_CONFIG?.apiBaseUrl ||
  "";
const isLocalApiHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "" ||
  window.location.hostname.startsWith("192.168.") ||
  window.location.hostname.startsWith("10.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(window.location.hostname);
const sameHostApiBaseUrl =
  window.location.hostname && isLocalApiHost
    ? `${window.location.protocol}//${window.location.hostname}:5001/api`
    : "";
const environmentApiBaseUrl = isLocalApiHost
  ? sameHostApiBaseUrl || LOCAL_API_BASE_URL
  : PRODUCTION_API_BASE_URL;
const API_BASE_URLS = [
  configuredApiBaseUrl,
  environmentApiBaseUrl,
  storedApiBaseUrl,
  LOCAL_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
]
  .filter(Boolean)
  .map((url) => url.replace(/\/$/, ""))
  .filter((url, index, urls) => urls.indexOf(url) === index);
let API_BASE_URL = API_BASE_URLS[0];
const CART_STORAGE_KEY = "restaurantai_cart";
const CUSTOMER_PHONE_STORAGE_KEY = "restaurantai_customer_phone";
const CUSTOMER_NOTIFICATION_SEEN_KEY = "restaurantai_seen_notifications";
const PUBLIC_SETTINGS_STORAGE_KEY = "restaurantai_public_settings";
const KIOSK_PRINTED_RECEIPTS_STORAGE_KEY = "restaurantai_kiosk_printed_receipts";
const DEFAULT_LOGO_PATH = "assets/mahesh-logo.svg";
const MENU_IMAGE_FALLBACK_SRC = "assets/hero-food.png";
const GST_RATE = 0.05;
const PACKING_CHARGE = 10;
const MAX_MESSAGE_LENGTH = 500;
const MAX_ITEM_QUANTITY = 20;
const MAX_CART_ITEMS = 50;
const RAZORPAY_CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
const ONLINE_PAYMENT_METHODS = new Set(["upi", "card", "netbanking", "wallet"]);

function apiUrl(path, baseUrl = API_BASE_URL) {
  return `${baseUrl}${path}`;
}

async function fetchApi(path, options = {}) {
  let lastError = null;

  for (const baseUrl of API_BASE_URLS) {
    try {
      const response = await fetch(apiUrl(path, baseUrl), options);
      API_BASE_URL = baseUrl;
      localStorage.setItem("restaurantApiBaseUrl", baseUrl);
      return response;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Backend API unavailable");
}

function friendlyNetworkError(error) {
  if (/failed to fetch|networkerror|load failed/i.test(error?.message || "")) {
    return "Backend server is not reachable. Start the backend or check the LAN API address, then try again.";
  }
  return error?.message || "Please try again.";
}

const defaultRestaurantSettings = {
  restaurantName: "MAHESH Sweets & Bakers",
  gst: "",
  address: "Jaja Chowk, Opp. State Bank of India, Tanda, Punjab-144024, India",
  phone: "",
  email: "",
  openingTime: "10:00",
  closingTime: "22:00",
  logo: "",
  kioskDisplayMode: "auto",
};

function cleanPublicSetting(field, value) {
  const text = String(value || "").trim();
  if (field === "kioskDisplayMode") {
    const normalized = text.toLowerCase();
    return ["auto", "landscape", "portrait"].includes(normalized) ? normalized : defaultRestaurantSettings.kioskDisplayMode;
  }

  const placeholders = {
    restaurantName: ["Restaurant AI", "RestaurantAI", "RESTAURANT NAME"],
    address: ["123 Main Street, Bengaluru", "123 Main St", "123 Main St, Apt 4B"],
    phone: ["+91 98765 43210", "+91-9876543210", "9876543210"],
    email: ["hello@restaurantai.com", "admin@restaurantai.com", "customer@email.com"],
  };

  if (placeholders[field]?.some((placeholder) => text.toLowerCase() === placeholder.toLowerCase())) {
    return field === "restaurantName" || field === "address" ? defaultRestaurantSettings[field] : "";
  }

  return text;
}

function sanitizedPublicSettings(settings = {}) {
  const merged = { ...defaultRestaurantSettings, ...settings };
  const hasSetting = (field) => Object.prototype.hasOwnProperty.call(settings, field);
  const addressSource = hasSetting("address") ? settings.address : defaultRestaurantSettings.address;

  return {
    ...merged,
    restaurantName:
      cleanPublicSetting("restaurantName", merged.restaurantName) ||
      defaultRestaurantSettings.restaurantName,
    address: cleanPublicSetting("address", addressSource),
    phone: cleanPublicSetting("phone", merged.phone),
    email: cleanPublicSetting("email", merged.email),
    logo: String(merged.logo || "").trim(),
    kioskDisplayMode: cleanPublicSetting("kioskDisplayMode", merged.kioskDisplayMode),
  };
}

function formatTimeLabel(value) {
  if (!value) return "";

  const [hours, minutes] = String(value).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function restaurantHoursText(settings = state.restaurantSettings || defaultRestaurantSettings) {
  const opening = formatTimeLabel(settings.openingTime);
  const closing = formatTimeLabel(settings.closingTime);
  return opening && closing ? `${opening} to ${closing}` : "current restaurant hours";
}

function cachePublicSettings(settings) {
  localStorage.setItem(PUBLIC_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function loadCachedPublicSettings() {
  try {
    const cached = JSON.parse(localStorage.getItem(PUBLIC_SETTINGS_STORAGE_KEY) || "{}");
    return sanitizedPublicSettings(cached);
  } catch {
    return { ...defaultRestaurantSettings };
  }
}

function publicSettingsEqual(left, right) {
  return JSON.stringify(sanitizedPublicSettings(left || {})) === JSON.stringify(sanitizedPublicSettings(right || {}));
}

function applyPublicSettings(settings) {
  const nextSettings = sanitizedPublicSettings(settings);
  const settingsChanged = !state.restaurantSettings || !publicSettingsEqual(state.restaurantSettings, nextSettings);
  if (!settingsChanged) return false;

  state.restaurantSettings = nextSettings;
  cachePublicSettings(nextSettings);

  const name = nextSettings.restaurantName;
  const address = nextSettings.address;
  const phone = nextSettings.phone;
  const email = nextSettings.email;
  const hours = restaurantHoursText(nextSettings);
  const contactSection = document.querySelector("#contact");

  window.restaurantPublicSettingsDebug = {
    apiBaseUrl: API_BASE_URL,
    updatedAt: new Date().toISOString(),
    settings: nextSettings,
  };

  if (contactSection) {
    contactSection.dataset.settingsSource = API_BASE_URL || "fallback";
    contactSection.dataset.settingsUpdatedAt = window.restaurantPublicSettingsDebug.updatedAt;
    contactSection.dataset.settingsPhone = phone || "";
    contactSection.dataset.settingsHours = hours;
  }

  document.title = `${name} | Fresh Menu and Ordering`;

  const metaDescription = document.querySelector("meta[name='description']");
  if (metaDescription) {
    metaDescription.setAttribute(
      "content",
      `${name} customer website for menu browsing, quick ordering, contact details, and live restaurant information.`
    );
  }

  document.querySelectorAll(".brand-text strong, .site-footer span:first-child").forEach((element) => {
    element.textContent = name;
  });

  const brandHelper = document.querySelector(".brand-text small");
  if (brandHelper) brandHelper.textContent = "Sweets, Bakers and Quick Bites";

  const brandLink = document.querySelector(".brand");
  if (brandLink) brandLink.setAttribute("aria-label", `${name} home`);

  document.querySelectorAll(".brand-logo, .contact-logo").forEach((image) => {
    image.src = nextSettings.logo || DEFAULT_LOGO_PATH;
    image.alt = `${name} logo`;
  });

  const heroTitle = document.querySelector(".hero-copy h1");
  if (heroTitle) heroTitle.textContent = `Order fresh sweets, bakery and snacks from ${name}.`;

  const heroCopy = document.querySelector(".hero-copy p");
  if (heroCopy) {
    heroCopy.textContent = `Browse live menu items, build your cart, and plan pickup or dine-in with the latest restaurant details.`;
  }

  const contactTitle = document.querySelector("#contact h2");
  if (contactTitle) contactTitle.textContent = name;

  const contactCopy = document.querySelector("#contact p");
  if (contactCopy) {
    const locationLabel = address ? ` from ${address.split(",")[0]}` : "";
    contactCopy.textContent = `Fresh sweets, bakery items, shakes, snacks and quick bites${locationLabel}, ready for pickup, dine-in and order requests.`;
  }

  const directionsLink = document.querySelector(".contact-secondary");
  if (directionsLink) {
    directionsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      [name, address].filter(Boolean).join(" ")
    )}`;
  }

  const contactName = document.querySelector(".contact-card-header strong");
  if (contactName) contactName.textContent = name;

  const addressElement = document.querySelector(".restaurant-address");
  const addressRow = document.querySelector(".contact-address-row");
  if (addressRow) {
    addressRow.hidden = !address;
  }

  if (addressElement) {
    addressElement.textContent = address;
  }

  const phoneRow = document.querySelector(".contact-phone-row");
  const phoneLink = document.querySelector(".contact-phone");
  if (phoneRow && phoneLink) {
    phoneRow.hidden = !phone;
    phoneLink.textContent = phone;
    phoneLink.href = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  }

  const emailRow = document.querySelector(".contact-email-row");
  const emailLink = document.querySelector(".contact-email");
  if (emailRow && emailLink) {
    emailRow.hidden = !email;
    emailLink.textContent = email;
    emailLink.href = email ? `mailto:${email}` : "";
  }

  const hoursElement = document.querySelector(".contact-hours");
  if (hoursElement) hoursElement.textContent = hours;

  if (state.kiosk.enabled) {
    renderKioskPreservingMenuView();
  }

  return true;
}

async function loadPublicSettings() {
  if (!state.restaurantSettings) {
    applyPublicSettings(loadCachedPublicSettings());
  }

  try {
    const response = await fetchApi(`/settings/public?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Settings API unavailable");
    }

    const payload = await response.json();
    applyPublicSettings(payload.data || {});
  } catch (error) {
    console.warn("Public restaurant settings unavailable:", error);
  }
}

function formatPrice(value) {
  return `Rs. ${Number(value || 0).toFixed(0)}`;
}

function saveCart() {
  if (state.kiosk.enabled || state.tableQr.enabled) return;
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

function saveCustomerPhone(phone) {
  if (state.kiosk.enabled || state.tableQr.enabled) return;
  const normalizedPhone = phone.trim();
  if (normalizedPhone) {
    localStorage.setItem(CUSTOMER_PHONE_STORAGE_KEY, normalizedPhone);
  }
}

function tableQrOrderingBlocked() {
  return state.tableQr.enabled && state.tableQr.status !== "valid";
}

function tableQrDisplayLabel() {
  const table = state.tableQr.table;
  return table?.display_name || (table?.table_number ? `Table ${table.table_number}` : "Table QR");
}

function tableQrOrderSource() {
  if (state.kiosk.enabled) return "kiosk";
  if (state.tableQr.status === "valid") return "table_qr";
  return "customer_web";
}

function normalizePhone(phone = "") {
  return String(phone)
    .trim()
    .replace(/[^\d+]/g, "");
}

function selectedPaymentMethod() {
  if (state.kiosk.enabled || state.tableQr.enabled) {
    return "pay_at_counter";
  }
  const checked = elements.paymentMethods?.querySelector("input[name='paymentMethod']:checked");
  return checked?.value || state.paymentMethod || "cash_on_delivery";
}

function isOnlinePayment(method = selectedPaymentMethod()) {
  return ONLINE_PAYMENT_METHODS.has(method);
}

function paymentMethodLabel(method = selectedPaymentMethod()) {
  const labels = {
    upi: "UPI",
    card: "Debit/Credit Card",
    netbanking: "Net Banking",
    wallet: "Wallet",
    cash_on_delivery: "Cash on Delivery",
    pay_at_counter: "Pay at Restaurant Counter",
  };

  return labels[method] || "Payment";
}

function updatePlaceOrderButtonText() {
  if (!elements.placeOrder) return;
  if (!state.cart.length || state.checkoutStep !== "payment") {
    elements.placeOrder.textContent = "Proceed to payment";
    return;
  }

  const method = selectedPaymentMethod();
  elements.placeOrder.textContent = isOnlinePayment(method) ? `Pay by ${paymentMethodLabel(method)}` : "Place order";
}

function setPaymentSelectorVisible(isVisible) {
  if (!elements.paymentMethods) return;
  elements.paymentMethods.hidden = !isVisible;
}

function selectPaymentMethod(method) {
  const input = elements.paymentMethods?.querySelector(`input[name='paymentMethod'][value='${method}']`);
  if (input && !input.disabled) {
    input.checked = true;
    state.paymentMethod = method;
  }
}

function applyPaymentAvailability() {
  elements.paymentMethods?.querySelectorAll("label").forEach((label) => {
    const input = label.querySelector("input[name='paymentMethod']");
    if (!input) return;

    const disabled =
      (state.tableQr.enabled && input.value !== "pay_at_counter") ||
      (isOnlinePayment(input.value) && !state.onlinePaymentsEnabled);
    input.disabled = disabled;
    label.classList.toggle("is-disabled", disabled);
    label.classList.toggle("is-table-locked", state.tableQr.enabled && disabled);
  });

  if (state.tableQr.enabled) {
    selectPaymentMethod("pay_at_counter");
    return;
  }

  if (isOnlinePayment(selectedPaymentMethod()) && !state.onlinePaymentsEnabled) {
    selectPaymentMethod("cash_on_delivery");
  }
}

function renderTableQrContext() {
  const menuHeading = document.querySelector("#menu .section-heading");
  if (!menuHeading || state.kiosk.enabled) return;

  let banner = document.querySelector("#tableQrBanner");
  if (!state.tableQr.enabled) {
    banner?.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "tableQrBanner";
    banner.className = "table-qr-banner";
    menuHeading.appendChild(banner);
  }

  banner.className = `table-qr-banner is-${state.tableQr.status}`;
  if (state.tableQr.status === "valid") {
    banner.innerHTML = `
      <strong>Ordering for: ${escapeHtml(tableQrDisplayLabel())}</strong>
      <span>Dine-in and Pay at Counter are selected for this table.</span>
    `;
    return;
  }

  if (state.tableQr.status === "loading") {
    banner.innerHTML = `
      <strong>Checking table QR...</strong>
      <span>Please wait while we confirm this table.</span>
    `;
    return;
  }

  banner.innerHTML = `
    <strong>This table QR is not available.</strong>
    <span>${escapeHtml(state.tableQr.error || "This table QR is no longer active. Please ask restaurant staff.")}</span>
  `;
}

function applyTableQrControls() {
  if (!state.tableQr.enabled || state.kiosk.enabled) return;

  document.body.classList.add("table-qr-mode");
  if (elements.orderType) {
    elements.orderType.value = "Dine-in";
    elements.orderType.disabled = true;
  }

  state.paymentMethod = "pay_at_counter";
  selectPaymentMethod("pay_at_counter");
  applyPaymentAvailability();

  if (tableQrOrderingBlocked() && elements.placeOrder) {
    elements.placeOrder.disabled = true;
    elements.placeOrder.textContent = state.tableQr.status === "loading" ? "Checking table..." : "Ordering unavailable";
    if (elements.cartHint) {
      elements.cartHint.textContent =
        state.tableQr.status === "loading"
          ? "Checking this table QR before ordering."
          : state.tableQr.error || "This table QR is no longer active. Please ask restaurant staff.";
    }
  } else {
    updatePlaceOrderButtonText();
  }
}

async function resolveTableQrContext() {
  if (!state.tableQr.enabled || state.kiosk.enabled) return;

  state.tableQr.status = "loading";
  state.tableQr.error = "";
  state.tableQr.table = null;
  renderTableQrContext();
  applyTableQrControls();
  renderMenu();
  renderCart();

  try {
    const table = await requestJson(`/tables/public/${encodeURIComponent(state.tableQr.token)}`);
    state.tableQr.status = "valid";
    state.tableQr.table = table.table || table;
    state.tableQr.error = "";
  } catch (error) {
    state.tableQr.status = "invalid";
    state.tableQr.table = null;
    state.tableQr.error = error.message || "This table QR is no longer active. Please ask restaurant staff.";
  }

  renderTableQrContext();
  applyTableQrControls();
  renderMenu();
  renderCart();
}

async function loadPaymentMethods() {
  try {
    const data = await requestJson("/payments/methods");
    state.onlinePaymentsEnabled = data.online_enabled !== false;
  } catch {
    state.onlinePaymentsEnabled = true;
  } finally {
    state.paymentMethodsLoaded = true;
    applyPaymentAvailability();
    updatePlaceOrderButtonText();
  }
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(`script[src="${RAZORPAY_CHECKOUT_SCRIPT}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function seenNotificationIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(CUSTOMER_NOTIFICATION_SEEN_KEY) || "[]");
    return new Set(Array.isArray(ids) ? ids.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveSeenNotificationIds(ids) {
  localStorage.setItem(CUSTOMER_NOTIFICATION_SEEN_KEY, JSON.stringify(Array.from(ids).slice(-100)));
}

function restoreCart() {
  if (state.kiosk.enabled || state.tableQr.enabled) {
    state.cart = [];
    return;
  }

  try {
    const savedCart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (Array.isArray(savedCart)) {
      state.cart = savedCart
        .map((item) => ({
          ...item,
          id: Number(item.id),
          price: Number(item.price || 0),
          qty: Number(item.qty || 0),
        }))
        .filter((item) => item.id && item.name && item.qty > 0);
    }
  } catch {
    state.cart = [];
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categories() {
  return ["All", ...new Set(menuItems.map((item) => item.category))];
}

function categoryIcon(category) {
  const normalizedCategory = category.toLowerCase();

  if (category === "All") return "🍽";
  if (normalizedCategory.includes("pizza")) return "🍕";
  if (normalizedCategory.includes("burger") || normalizedCategory.includes("sandwich")) return "🍔";
  if (normalizedCategory.includes("puff") || normalizedCategory.includes("bakery") || normalizedCategory.includes("roll")) return "🥐";
  if (normalizedCategory.includes("dessert") || normalizedCategory.includes("pastr") || normalizedCategory.includes("pudding") || normalizedCategory.includes("donut") || normalizedCategory.includes("muffin") || normalizedCategory.includes("pie")) return "🍰";
  if (normalizedCategory.includes("beverage") || normalizedCategory.includes("shake") || normalizedCategory.includes("mocktail") || normalizedCategory.includes("coffee") || normalizedCategory.includes("tea")) return "🥤";
  if (normalizedCategory.includes("momos")) return "🥟";
  if (normalizedCategory.includes("chaat")) return "🌮";
  if (normalizedCategory.includes("chinese") || normalizedCategory.includes("noodle")) return "🍜";
  if (normalizedCategory.includes("south indian") || normalizedCategory.includes("snack")) return "🥘";

  return "🍴";
}

function normalizeApiMenuItem(item, index) {
  const stockStatus = String(item.stock_status || item.availability_status || "").toLowerCase();
  const isUnavailable =
    item.is_available === false ||
    item.available === false ||
    item.out_of_stock === true ||
    stockStatus.includes("out") ||
    stockStatus.includes("unavailable");

  return {
    id: Number(item.id || item.menu_id || index + 1),
    name: item.name || item.item_name || item.menu_name || `Menu Item ${index + 1}`,
    category: item.category_name || item.category || "Uncategorized",
    price: Number(item.price || 0),
    image: item.image || item.image_url || "",
    description: item.description || "",
    isAvailable: !isUnavailable,
  };
}

function menuItemsEqual(leftItems, rightItems) {
  if (leftItems.length !== rightItems.length) return false;

  return leftItems.every((left, index) => {
    const right = rightItems[index];
    return (
      left.id === right.id &&
      left.name === right.name &&
      left.category === right.category &&
      left.price === right.price &&
      left.image === right.image &&
      left.description === right.description &&
      left.isAvailable === right.isAvailable
    );
  });
}

function captureKioskMenuView() {
  if (!state.kiosk.enabled || state.kiosk.screen !== "menu") return null;

  const categoriesElement = document.querySelector(".kiosk-categories");
  const menuGridElement = document.querySelector(".kiosk-menu-grid");
  return {
    categoryScrollTop: categoriesElement?.scrollTop || 0,
    categoryScrollLeft: categoriesElement?.scrollLeft || 0,
    menuScrollTop: menuGridElement?.scrollTop || 0,
    menuScrollLeft: menuGridElement?.scrollLeft || 0,
  };
}

function renderKioskPreservingMenuView() {
  const view = captureKioskMenuView();
  renderKiosk();
  if (!view) return;

  window.requestAnimationFrame(() => {
    const categoriesElement = document.querySelector(".kiosk-categories");
    const menuGridElement = document.querySelector(".kiosk-menu-grid");
    if (categoriesElement) {
      categoriesElement.scrollTop = view.categoryScrollTop;
      categoriesElement.scrollLeft = view.categoryScrollLeft;
    }
    if (menuGridElement) {
      menuGridElement.scrollTop = view.menuScrollTop;
      menuGridElement.scrollLeft = view.menuScrollLeft;
    }
  });
}

function updateMenuStats() {
  const trustStats = document.querySelectorAll(".trust-row span");
  if (trustStats[0]) trustStats[0].textContent = `${menuItems.length} menu items`;
  if (trustStats[1]) trustStats[1].textContent = `${Math.max(categories().length - 1, 0)} categories`;
}

async function loadLiveMenu({ background = false } = {}) {
  const hasLastKnownMenu = state.menuStatus === "ready" || state.menuStatus === "empty";
  if (!background || !hasLastKnownMenu) {
    state.menuStatus = "loading";
    state.menuError = "";
    if (state.kiosk.enabled) {
      renderKiosk();
    } else {
      renderFilters();
      renderMenu();
    }
  }

  try {
    const response = await fetchApi("/menu?available=true", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Menu API unavailable");
    }

    const payload = await response.json();
    const apiItems = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
    const availableItems = apiItems
      .map(normalizeApiMenuItem)
      .filter((item) => item.name && Number.isFinite(item.price));

    const hadMenuError = Boolean(state.menuError);
    const menuChanged = !menuItemsEqual(menuItems, availableItems);
    state.menuError = "";
    if (!menuChanged) {
      state.menuStatus = availableItems.length ? "ready" : "empty";
      if (hadMenuError) {
        if (state.kiosk.enabled) {
          renderKioskPreservingMenuView();
        } else {
          renderFilters();
          renderMenu();
        }
      }
      return;
    }

    if (!availableItems.length) {
      menuItems = [];
      state.menuStatus = "empty";
      updateMenuStats();
      if (state.kiosk.enabled) {
        renderKioskPreservingMenuView();
      } else {
        renderFilters();
        renderMenu();
      }
      return;
    }

    menuItems = availableItems;
    state.menuStatus = "ready";

    if (!categories().includes(state.selectedCategory)) {
      state.selectedCategory = "All";
    }

    state.cart = state.cart.filter((cartItem) =>
      menuItems.some((menuItem) => menuItem.id === cartItem.id)
    );
    saveCart();

    updateMenuStats();
    if (state.kiosk.enabled) {
      renderKioskPreservingMenuView();
    } else {
      renderFilters();
      renderMenu();
      renderCart();
    }
  } catch (error) {
    if (background && hasLastKnownMenu) {
      return;
    }

    menuItems = fallbackMenuItems.map(normalizeApiMenuItem);
    state.menuStatus = "ready";
    state.menuError = error.message || "Live menu unavailable. Using saved customer menu.";
    if (elements.chatStatus) {
      setChatStatus("Saved menu ready");
    }
    updateMenuStats();
    if (state.kiosk.enabled) {
      renderKiosk();
    } else {
      renderFilters();
      renderMenu();
    }
  }
}

function triggerClass(element, className, duration = 320) {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => {
    element.classList.remove(className);
  }, duration);
}

function showToast(title, detail = "", type = "info") {
  elements.toast.className = `toast ${type}`;
  elements.toast.innerHTML = `
    <span class="toast-title">${escapeHtml(title)}</span>
    ${detail ? `<span class="toast-detail">${escapeHtml(detail)}</span>` : ""}
  `;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2000);
}

function filteredItems() {
  const search = elements.searchInput.value.trim().toLowerCase();
  return menuItems.filter((item) => {
    const matchesCategory = state.selectedCategory === "All" || item.category === state.selectedCategory;
    const matchesSearch = !search || `${item.name} ${item.category}`.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });
}

function cartQuantityForItem(itemId) {
  return state.cart.find((cartItem) => cartItem.id === itemId)?.qty || 0;
}

function itemAvailable(item) {
  return item?.isAvailable !== false;
}

function slugifyMenuItemName(name) {
  return String(name)
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function itemPhotoPath(item) {
  return `assets/menu-items/items/item-${String(item.id).padStart(3, "0")}-${slugifyMenuItemName(item.name)}.png`;
}

const milkShakePhotoRules = [
  { terms: ["milk badam"], src: "assets/menu-items/milk-shakes/milk-badam.png" },
  { terms: ["strawberry"], src: "assets/menu-items/milk-shakes/strawberry-milk-shake.png" },
  { terms: ["burberry"], src: "assets/menu-items/milk-shakes/burberry-milk-shake.png" },
  { terms: ["bubblegum"], src: "assets/menu-items/milk-shakes/bubblegum-milk-shake.png" },
  { terms: ["butterscotch"], src: "assets/menu-items/milk-shakes/butterscotch-milk-shake.png" },
  { terms: ["chocolate oreo", "oreo"], src: "assets/menu-items/milk-shakes/chocolate-oreo-milk-shake.png" },
  { terms: ["chocolate milk shake"], src: "assets/menu-items/milk-shakes/chocolate-milk-shake.png" },
  { terms: ["banana"], src: "assets/menu-items/milk-shakes/banana-milk-shake.png" },
  { terms: ["mango"], src: "assets/menu-items/milk-shakes/mango-milk-shake.png" },
  { terms: ["cold coffee"], src: "assets/menu-items/milk-shakes/cold-coffee-frappe.png" },
  { terms: ["frappe mocha", "frappe choco"], src: "assets/menu-items/milk-shakes/frappe-mocha.png" },
  { terms: ["frappe caramel"], src: "assets/menu-items/milk-shakes/frappe-caramel.png" },
];

const chilledBeveragePhotoRules = [
  { terms: ["carrot", "gajar"], src: "assets/menu-items/chilled-beverages/carrot-gajar-juice.png" },
  { terms: ["pineapple"], src: "assets/menu-items/chilled-beverages/pineapple-juice.png" },
  { terms: ["orange"], src: "assets/menu-items/chilled-beverages/orange-juice.png" },
  { terms: ["mixed fruit"], src: "assets/menu-items/chilled-beverages/mixed-fruit-juice.png" },
  { terms: ["mosambi"], src: "assets/menu-items/chilled-beverages/mosambi-juice.png" },
  { terms: ["sweet lassi", "sweet lime"], src: "assets/menu-items/chilled-beverages/sweet-lassi.png" },
  { terms: ["masala lassi"], src: "assets/menu-items/chilled-beverages/masala-lassi.png" },
  { terms: ["cold drink"], src: "assets/menu-items/chilled-beverages/cold-drink.png" },
];

const southIndianPhotoRules = [
  { terms: ["plain dosa"], src: "assets/menu-items/south-indian/plain-dosa.png" },
  { terms: ["masala dosa"], src: "assets/menu-items/south-indian/masala-dosa.png" },
  { terms: ["paneer dosa"], src: "assets/menu-items/south-indian/paneer-dosa.png" },
  { terms: ["onion dosa"], src: "assets/menu-items/south-indian/onion-dosa.png" },
  { terms: ["uttapam", "uttapam dosa"], src: "assets/menu-items/south-indian/uttapam-dosa.png" },
  { terms: ["sambhar vada", "sambhar vadda"], src: "assets/menu-items/south-indian/sambhar-vada.png" },
];

const hotBeveragePhotoRules = [
  { terms: ["green tea"], src: "assets/menu-items/hot-beverages/green-tea.png" },
  { terms: ["hot milk", "tea milk"], src: "assets/menu-items/hot-beverages/hot-milk.png" },
  { terms: ["hot coffee"], src: "assets/menu-items/hot-beverages/hot-coffee.png" },
  { terms: ["tea"], src: "assets/menu-items/hot-beverages/tea.png" },
];

const mocktailPhotoRules = [
  { terms: ["mint mojito"], src: "assets/menu-items/mocktails/mint-mojito.png" },
  { terms: ["blue curacao"], src: "assets/menu-items/mocktails/blue-curacao.png" },
  { terms: ["fruit ice tea", "blue ice tea"], src: "assets/menu-items/mocktails/fruit-ice-tea.png" },
  { terms: ["spicy mango punch"], src: "assets/menu-items/mocktails/spicy-mango-punch.png" },
  { terms: ["spicy guava punch"], src: "assets/menu-items/mocktails/spicy-guava-punch.png" },
];

const dessertPhotoRules = [
  { terms: ["moong-dal halwa", "moong dal halwa"], src: "assets/menu-items/delectable-desserts/moong-dal-halwa.png" },
  { terms: ["chenna sandwich roll"], src: "assets/menu-items/delectable-desserts/chenna-sandwich-roll.png" },
  { terms: ["chenna malai roll"], src: "assets/menu-items/delectable-desserts/chenna-malai-roll.png" },
  { terms: ["jalebi"], src: "assets/menu-items/delectable-desserts/jalebi.png" },
  { terms: ["imarti"], src: "assets/menu-items/delectable-desserts/imarti.png" },
  { terms: ["gulab jamun"], src: "assets/menu-items/delectable-desserts/hot-gulab-jamun-plate.png" },
  { terms: ["sponge rasgulla", "rasgulla"], src: "assets/menu-items/delectable-desserts/sponge-rasgulla.png" },
  { terms: ["hot gajrela", "gajrela"], src: "assets/menu-items/delectable-desserts/hot-gajrela.png" },
  { terms: ["rasmalai glass", "angoori"], src: "assets/menu-items/delectable-desserts/rasmalai-glass-angoori.png" },
  { terms: ["vanilla softy ice cream cone"], src: "assets/menu-items/delectable-desserts/vanilla-softy-ice-cream-cone.png" },
  { terms: ["strawberry softy ice cream cone"], src: "assets/menu-items/delectable-desserts/strawberry-softy-ice-cream-cone.png" },
  { terms: ["mix softy cup", "mix flavour softy cup"], src: "assets/menu-items/delectable-desserts/mix-softy-cup.png" },
  { terms: ["vanilla softy cup"], src: "assets/menu-items/delectable-desserts/vanilla-softy-cup.png" },
  { terms: ["strawberry softy cup"], src: "assets/menu-items/delectable-desserts/strawberry-softy-cup.png" },
  { terms: ["falooda kulfi"], src: "assets/menu-items/delectable-desserts/falooda-kulfi.png" },
  { terms: ["rabri falooda", "fruit falooda"], src: "assets/menu-items/delectable-desserts/rabri-falooda.png" },
];

const indianSnackPhotoRules = [
  { terms: ["dhokla plain"], src: "assets/menu-items/indian-snacks/dhokla-plain-plate.png" },
  { terms: ["paneer dhokla", "dry fruit dhokla"], src: "assets/menu-items/indian-snacks/paneer-dhokla-plate.png" },
  { terms: ["sandwich dhokla"], src: "assets/menu-items/indian-snacks/sandwich-dhokla.png" },
  { terms: ["masala dhokla"], src: "assets/menu-items/indian-snacks/masala-dhokla.png" },
  { terms: ["chhole kulcha"], src: "assets/menu-items/indian-snacks/chhole-kulcha-plate.png" },
  { terms: ["stuffed paneer pakoda", "stuffed paneer kulcha"], src: "assets/menu-items/indian-snacks/stuffed-paneer-pakoda.png" },
  { terms: ["stuffed bread pakoda"], src: "assets/menu-items/indian-snacks/stuffed-bread-pakoda.png" },
  { terms: ["chhole bhature"], src: "assets/menu-items/indian-snacks/chhole-bhature-plate.png" },
  { terms: ["samosa with chutney"], src: "assets/menu-items/indian-snacks/samosa-with-chutney.png" },
  { terms: ["samosa with channa"], src: "assets/menu-items/indian-snacks/samosa-with-channa.png" },
  { terms: ["tikki with chutney"], src: "assets/menu-items/indian-snacks/tikki-with-chutney.png" },
  { terms: ["tikki with channa"], src: "assets/menu-items/indian-snacks/tikki-with-channa.png" },
  { terms: ["bedmi puri"], src: "assets/menu-items/indian-snacks/bedmi-puri.png" },
  { terms: ["extra puri"], src: "assets/menu-items/indian-snacks/extra-puri.png" },
  { terms: ["extra pav", "pav plate"], src: "assets/menu-items/indian-snacks/extra-pav.png" },
  { terms: ["pav bhaji"], src: "assets/menu-items/indian-snacks/pav-bhaji.png" },
  { terms: ["channa plate"], src: "assets/menu-items/indian-snacks/channa-plate-extra.png" },
  { terms: ["sambhar plate", "sambar plate"], src: "assets/menu-items/indian-snacks/sambar-plate-extra.png" },
];

function photoPathFromRules(item, category, photoRules) {
  if (item.category !== category) return "";

  const itemName = item.name.toLowerCase();
  const rule = photoRules.find((photoRule) =>
    photoRule.terms.some((term) => itemName.includes(term))
  );

  return rule?.src || "";
}

function milkShakePhotoPath(item) {
  return photoPathFromRules(item, "Milk Shakes", milkShakePhotoRules);
}

function chilledBeveragePhotoPath(item) {
  return photoPathFromRules(item, "Chilled Beverages", chilledBeveragePhotoRules);
}

function southIndianPhotoPath(item) {
  return photoPathFromRules(item, "South Indian", southIndianPhotoRules);
}

function hotBeveragePhotoPath(item) {
  return photoPathFromRules(item, "Hot Beverages", hotBeveragePhotoRules);
}

function mocktailPhotoPath(item) {
  return photoPathFromRules(item, "Mocktails", mocktailPhotoRules);
}

function dessertPhotoPath(item) {
  return photoPathFromRules(item, "Delectable Desserts", dessertPhotoRules);
}

function indianSnackPhotoPath(item) {
  return photoPathFromRules(item, "Indian Snacks", indianSnackPhotoRules);
}

function photoForItem(item) {
  if (item.image) {
    return {
      src: item.image,
      alt: `${item.name} from MAHESH menu`,
    };
  }

  const milkShakePhoto = milkShakePhotoPath(item);
  const chilledBeveragePhoto = chilledBeveragePhotoPath(item);
  const southIndianPhoto = southIndianPhotoPath(item);
  const hotBeveragePhoto = hotBeveragePhotoPath(item);
  const mocktailPhoto = mocktailPhotoPath(item);
  const dessertPhoto = dessertPhotoPath(item);
  const indianSnackPhoto = indianSnackPhotoPath(item);

  return {
    src:
      milkShakePhoto ||
      chilledBeveragePhoto ||
      southIndianPhoto ||
      hotBeveragePhoto ||
      mocktailPhoto ||
      dessertPhoto ||
      indianSnackPhoto ||
      itemPhotoPath(item),
    alt: `${item.name} from MAHESH menu`,
  };
}

function renderFilters() {
  if (state.menuStatus === "loading") {
    elements.filters.innerHTML = `
      <button class="filter-btn is-active" type="button" disabled>
        <span class="filter-icon" aria-hidden="true">🍽</span>
        <span>Loading menu...</span>
      </button>
    `;
    return;
  }

  if (state.menuStatus === "error") {
    elements.filters.innerHTML = "";
    return;
  }

  elements.filters.innerHTML = categories()
    .map((category) => {
      const isActive = category === state.selectedCategory;
      return `
        <button class="filter-btn ${isActive ? "is-active" : ""}" data-category="${escapeHtml(category)}" type="button" aria-pressed="${isActive}">
          <span class="filter-icon" aria-hidden="true">${categoryIcon(category)}</span>
          <span>${escapeHtml(category)}</span>
        </button>
      `;
    })
    .join("");
}

function renderMenu() {
  if (state.menuStatus === "loading") {
    elements.menuCount.textContent = "Loading menu...";
    elements.activeCategoryLabel.textContent = "Connecting to PostgreSQL menu";
    elements.menuGrid.innerHTML = Array.from({ length: 6 })
      .map(
        () => `
          <article class="menu-card skeleton-card" aria-hidden="true">
            <div class="skeleton-photo"></div>
            <div class="menu-card-body">
              <span class="skeleton-line short"></span>
              <span class="skeleton-line"></span>
              <span class="skeleton-line medium"></span>
            </div>
          </article>
        `
      )
      .join("");
    return;
  }

  if (state.menuStatus === "error") {
    elements.menuCount.textContent = "Unable to load menu";
    elements.activeCategoryLabel.textContent = "Database menu unavailable";
    elements.menuGrid.innerHTML = `
      <div class="no-results menu-error">
        <strong>Unable to load menu.</strong>
        <span>${escapeHtml(state.menuError || "Please check the backend server and PostgreSQL connection.")}</span>
        <button class="retry-btn" type="button" data-retry-menu>Retry</button>
      </div>
    `;
    return;
  }

  if (state.menuStatus === "empty") {
    elements.menuCount.textContent = "Showing 0 of 0 items";
    elements.activeCategoryLabel.textContent = "No database menu items found";
    elements.menuGrid.innerHTML = `
      <div class="no-results">
        <strong>No menu items found</strong>
        <span>Add menu items from the admin dashboard or seed the PostgreSQL database.</span>
      </div>
    `;
    return;
  }

  const items = filteredItems();
  elements.menuGrid.classList.remove("is-animating");
  void elements.menuGrid.offsetWidth;
  elements.menuGrid.classList.add("is-animating");
  elements.menuCount.textContent = `Showing ${items.length} of ${menuItems.length} items`;
  elements.activeCategoryLabel.textContent =
    state.selectedCategory === "All" ? "Showing all categories" : `Showing ${state.selectedCategory}`;

  if (!items.length) {
    elements.menuGrid.innerHTML = `
      <div class="no-results">
        <strong>No food found</strong>
        <span>Try a different search word or choose another category.</span>
      </div>
    `;
    return;
  }

  elements.menuGrid.innerHTML = items
    .map((item) => {
      const photo = photoForItem(item);
      const cartQty = cartQuantityForItem(item.id);
      const isAvailable = itemAvailable(item);
      const isBlocked = tableQrOrderingBlocked();
      return `
        <article class="menu-card ${isAvailable ? "" : "is-unavailable"}">
          <div class="item-photo">
            <img
              src="${escapeHtml(photo.src)}"
              alt="${escapeHtml(photo.alt)}"
              loading="lazy"
              onerror="this.onerror=null;this.src='${escapeHtml(MENU_IMAGE_FALLBACK_SRC)}';"
            />
          </div>
          <div class="menu-card-body">
            <span class="category-label">${escapeHtml(item.category)}</span>
            <h3>${escapeHtml(item.name)}</h3>
            <span class="availability-pill ${isAvailable ? "is-available" : "is-unavailable"}">
              ${isAvailable ? "Available" : "Unavailable"}
            </span>
            <div class="menu-meta">
              <span class="price">${formatPrice(item.price)}</span>
              ${
                !isAvailable || isBlocked
                  ? `<button class="add-btn" type="button" disabled>Unavailable</button>`
                  : cartQty
                  ? `<div class="card-qty-control" aria-label="${escapeHtml(item.name)} quantity in cart">
                      <button class="card-qty-btn" data-menu-id="${item.id}" data-menu-delta="-1" type="button" aria-label="Decrease ${escapeHtml(item.name)}">-</button>
                      <span>${cartQty}</span>
                      <button class="card-qty-btn" data-menu-id="${item.id}" data-menu-delta="1" type="button" aria-label="Increase ${escapeHtml(item.name)}">+</button>
                    </div>`
                  : `<button class="add-btn" data-menu-add="${item.id}" type="button">ADD</button>`
              }
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function addToCart(itemId, button) {
  if (tableQrOrderingBlocked()) {
    showToast("Table QR unavailable", state.tableQr.error || "Please ask restaurant staff for a fresh QR code.", "warning");
    return;
  }

  const item = menuItems.find((menuItem) => menuItem.id === itemId);
  if (!item) return;
  if (!itemAvailable(item)) {
    showToast("Item unavailable", `${item.name} is not available right now.`, "warning");
    return;
  }

  addItemToCart(item, 1);
  triggerClass(button, "is-added", 240);
  showToast(`✓ ${item.name} added to cart`, formatPrice(item.price), "success");
}

function addItemToCart(item, quantity = 1) {
  if (tableQrOrderingBlocked()) {
    showToast("Table QR unavailable", state.tableQr.error || "Please ask restaurant staff for a fresh QR code.", "warning");
    return;
  }

  if (!itemAvailable(item)) {
    showToast("Item unavailable", `${item.name} is not available right now.`, "warning");
    return;
  }

  const safeQuantity = Math.max(1, Math.min(MAX_ITEM_QUANTITY, Number(quantity) || 1));
  state.orderSuccess = null;
  state.confirmation = null;
  state.checkoutStep = "cart";
  const existing = state.cart.find((cartItem) => cartItem.id === item.id);
  if (existing) {
    existing.qty = Math.min(MAX_ITEM_QUANTITY, existing.qty + safeQuantity);
  } else {
    if (state.cart.length >= MAX_CART_ITEMS) {
      showToast("Cart limit reached", `You can add up to ${MAX_CART_ITEMS} different items.`, "warning");
      return;
    }
    state.cart.push({ ...item, qty: safeQuantity });
  }

  state.cartFeedback = { itemId: item.id, type: "updated" };
  saveCart();
  renderCart();
  renderMenu();
  renderKiosk();
}

function changeQty(itemId, delta) {
  const existing = state.cart.find((item) => item.id === itemId);
  if (!existing) return;

  if (delta < 0 && existing.qty <= 1) {
    removeCartItem(itemId);
    return;
  }

  state.cart = state.cart
    .map((item) => (item.id === itemId ? { ...item, qty: Math.min(MAX_ITEM_QUANTITY, item.qty + delta) } : item))
    .filter((item) => item.qty > 0);
  state.checkoutStep = "cart";
  state.cartFeedback = { itemId, type: "updated" };
  saveCart();
  renderCart();
  renderMenu();
  renderKiosk();
  showToast("Quantity updated", `${existing.name} is now ${existing.qty + delta}`, "info");
}

function removeCartItem(itemId) {
  const existing = state.cart.find((item) => item.id === itemId);
  if (!existing) return;

  const line = elements.cartItems.querySelector(`[data-cart-id="${itemId}"]`);
  if (line) {
    line.classList.add("is-removing");
  }

  window.setTimeout(() => {
    state.cart = state.cart.filter((item) => item.id !== itemId);
    saveCart();
    renderCart();
    renderMenu();
    renderKiosk();
    showToast("Item removed", existing.name, "warning");
  }, line ? 180 : 0);
}

function cartTotals() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = Math.round(subtotal * GST_RATE * 100) / 100;
  const packing = subtotal > 0 ? PACKING_CHARGE : 0;
  return { count, subtotal, tax, packing, total: subtotal + tax + packing };
}

function currentOrderTypeLabel() {
  if (state.kiosk.enabled) {
    return state.kiosk.orderType === "dine_in" ? "Dine-in" : "Takeaway";
  }
  if (state.tableQr.status === "valid") {
    return "Dine-in";
  }
  return elements.orderType?.value || "Pickup";
}

function orderTypePayloadValue() {
  const orderType = currentOrderTypeLabel().toLowerCase();
  if (orderType.includes("dine")) return "dine_in";
  if (orderType.includes("delivery")) return "delivery";
  return "pickup";
}

function orderMessage() {
  const { subtotal, tax, packing, total } = cartTotals();
  const name = state.kiosk.enabled ? state.kiosk.customerName || "Customer" : elements.customerName.value.trim() || "Customer";
  const phone = state.kiosk.enabled ? state.kiosk.customerPhone || "Not provided" : elements.customerPhone.value.trim() || "Not provided";
  const orderType = currentOrderTypeLabel();

  return [
    "Hello MAHESH, I want to place an order.",
    `Name: ${name}`,
    `Phone: ${phone}`,
    `Order type: ${orderType}`,
    "",
    "Items:",
    ...state.cart.map((item) => `${item.qty} x ${item.name} - ${formatPrice(item.price * item.qty)}`),
    "",
    `Subtotal: ${formatPrice(subtotal)}`,
    `GST: ${formatPrice(tax)}`,
    `Packing: ${formatPrice(packing)}`,
    `Grand total: ${formatPrice(total)}`,
  ].join("\n");
}

function orderSuccessDetails(message) {
  const text = String(message || "");
  const match = text.match(/\b(ORD-[A-Za-z0-9-]+|\d{3,})\b/);

  return {
    orderNumber: match?.[1] || "",
    message: text,
  };
}

function renderCart() {
  const snapshot = !state.cart.length && state.confirmation ? state.confirmation : null;
  const { count, subtotal, tax, packing, total } = snapshot?.totals || cartTotals();
  elements.cartCount.innerHTML = `<span aria-hidden="true">🛒</span><strong>${count}</strong>`;
  elements.cartCount.setAttribute("aria-label", `${count} ${count === 1 ? "item" : "items"} in cart`);
  elements.cartSubtotal.textContent = formatPrice(subtotal);
  elements.cartTax.textContent = formatPrice(tax);
  elements.cartPacking.textContent = formatPrice(packing);
  elements.cartTotal.textContent = formatPrice(total);
  const countChanged = renderCart.previousCount !== undefined && renderCart.previousCount !== count;
  const totalChanged = renderCart.previousTotal !== undefined && renderCart.previousTotal !== total;
  renderCart.previousCount = count;
  renderCart.previousTotal = total;

  if (countChanged) {
    triggerClass(elements.cartCount, "is-bumping");
  }

  if (totalChanged) {
    document.querySelectorAll(".cart-total-line").forEach((line) => {
      triggerClass(line, "is-updated", 300);
    });
  }

  if (!state.cart.length) {
    state.checkoutStep = "cart";
    setPaymentSelectorVisible(false);
    const success = orderSuccessDetails(state.orderSuccess);
    elements.cartItems.innerHTML = state.orderSuccess
      ? `<div class="order-success-card">
          <span class="empty-cart-icon" aria-hidden="true">✓</span>
          <strong>Order saved</strong>
          <span>${escapeHtml(state.orderSuccess)}</span>
        </div>`
      : `<div class="empty-cart">
          <span class="empty-cart-icon" aria-hidden="true">🛒</span>
          <strong>Your cart is empty</strong>
          <span>Add delicious food 🍕</span>
        </div>`;
    if (state.orderSuccess) {
      const successItems = snapshot?.items?.length
        ? `<div class="success-receipt-lines">
            ${snapshot.items
              .map(
                (item) =>
                  `<span><b>${Number(item.qty || 0)} x ${escapeHtml(item.name)}</b>${formatPrice(item.lineTotal)}</span>`
              )
              .join("")}
          </div>
          <div class="success-receipt-total">
            <span>${escapeHtml(snapshot.paymentMethod || "Payment")} total</span>
            <strong>${formatPrice(total)}</strong>
          </div>`
        : "";
      const tableReceipt =
        snapshot?.orderSource === "table_qr"
          ? `<div class="success-table-receipt" aria-label="Confirmed table order receipt">
              <span><b>Order</b><strong>${escapeHtml(snapshot.orderTokenLabel || snapshot.orderLabel || "")}</strong></span>
              <span><b>Table</b><strong>${escapeHtml(snapshot.tableLabel || "")}</strong></span>
              <span><b>Order type</b><strong>${escapeHtml(snapshot.orderType || "Dine-in")}</strong></span>
              <span><b>Payment</b><strong>${escapeHtml(snapshot.paymentMethod || "Pay at Restaurant Counter")}</strong></span>
              <span><b>Subtotal</b><strong>${formatPrice(subtotal)}</strong></span>
              <span><b>GST</b><strong>${formatPrice(tax)}</strong></span>
              <span><b>Packing</b><strong>${formatPrice(packing)}</strong></span>
              <span class="success-table-total"><b>Grand total</b><strong>${formatPrice(total)}</strong></span>
            </div>`
          : "";

      elements.cartItems.innerHTML = `<div class="order-success-card ${snapshot?.orderSource === "table_qr" ? "is-table-order" : ""}">
        <span class="success-orbit" aria-hidden="true">
          <svg class="success-check" viewBox="0 0 52 52" focusable="false">
            <circle class="success-check-circle" cx="26" cy="26" r="22"></circle>
            <path class="success-check-mark" d="M16 27.5 23 34 37 18"></path>
          </svg>
        </span>
        <span class="success-eyebrow">ORDER CONFIRMED</span>
        <strong>${
          snapshot?.orderSource === "table_qr"
            ? `Order ${escapeHtml(snapshot.orderTokenLabel || snapshot.orderLabel || "")} was sent to the kitchen.`
            : "Thank you. We received your order."
        }</strong>
        ${
          success.orderNumber
            ? `<span class="success-order-id">Order ID <b>${escapeHtml(success.orderNumber)}</b></span>`
            : ""
        }
        <span class="success-message">${escapeHtml(success.message)}</span>
        ${successItems}
        ${tableReceipt}
        <span class="success-next-step">The restaurant team will review it shortly.</span>
      </div>`;
    }
    elements.placeOrder.disabled = false;
    elements.cartHint.textContent = state.orderSuccess
      ? "Your order is saved in PostgreSQL and ready for the restaurant team."
      : "Add at least one item before sending an order request.";
    updatePlaceOrderButtonText();
    if (state.tableQr.enabled) applyTableQrControls();
    return;
  }

  elements.cartItems.innerHTML = state.cart
    .map(
      (item) => {
        const isUpdated = state.cartFeedback?.itemId === item.id;
        return `
        <div class="cart-line ${isUpdated ? "is-updated" : ""}" data-cart-id="${item.id}">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatPrice(item.price)} each</span>
          </div>
          <div class="cart-qty">
            <button class="qty-btn" data-id="${item.id}" data-delta="-1" type="button" aria-label="Remove one ${escapeHtml(item.name)}">-</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn" data-id="${item.id}" data-delta="1" type="button" aria-label="Add one ${escapeHtml(item.name)}">+</button>
            <button class="remove-btn" data-id="${item.id}" data-remove="true" type="button" aria-label="Remove ${escapeHtml(item.name)} from cart">x</button>
          </div>
        </div>
      `;
      }
    )
    .join("");
  state.cartFeedback = null;

  setPaymentSelectorVisible(state.checkoutStep === "payment");
  elements.placeOrder.disabled = false;
  elements.cartHint.textContent =
    state.checkoutStep === "payment"
      ? "Choose a payment method, then confirm your order."
      : "Check your name and phone, then proceed to choose a payment method.";
  updatePlaceOrderButtonText();
  if (state.tableQr.enabled) applyTableQrControls();
}

function clearCart() {
  if (!state.cart.length) {
    showToast("Cart is already empty", "Add items from the menu to start an order.", "info");
    return;
  }

  if (state.kiosk.enabled) {
    state.kiosk.clearConfirm = "cart";
    renderKiosk();
    return;
  }

  if (!window.confirm(state.tableQr.enabled ? "Clear this order?" : "Clear your order?")) {
    return;
  }

  elements.cartItems.querySelectorAll(".cart-line").forEach((line) => {
    line.classList.add("is-removing");
  });

  window.setTimeout(() => {
    state.cart = [];
    state.orderSuccess = null;
    state.confirmation = null;
    state.checkoutStep = "cart";
    saveCart();
    renderCart();
    renderMenu();
    showToast("Cart cleared", "All items removed from your order.", "warning");
  }, 180);
}

async function requestJson(path, options = {}) {
  const response = await fetchApi(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data || payload;
}

async function findOrCreateCustomer({ name, phone }) {
  try {
    return await requestJson(`/customers/phone/${encodeURIComponent(phone)}`);
  } catch (error) {
    if (!/not found/i.test(error.message)) {
      throw error;
    }
  }

  try {
    return await requestJson("/customers", {
      method: "POST",
      body: JSON.stringify({ name, phone, country: "India" }),
    });
  } catch (error) {
    if (/already exists/i.test(error.message)) {
      return requestJson(`/customers/phone/${encodeURIComponent(phone)}`);
    }

    throw error;
  }
}

function buildPaymentPayload(customer) {
  const orderTypeLabel = currentOrderTypeLabel();
  const instructionLines = [`Order type: ${orderTypeLabel}`];
  if (state.kiosk.enabled) {
    instructionLines.push("Source: Kiosk");
  } else if (state.tableQr.status === "valid") {
    instructionLines.push("Source: table_qr");
    if (state.tableQr.table?.table_number) {
      instructionLines.push(`Table: ${state.tableQr.table.table_number}`);
    }
  }

  const payload = {
    customer_id: customer.id,
    payment_method: selectedPaymentMethod(),
    order_type: orderTypePayloadValue(),
    idempotency_key: ensureOrderIdempotencyKey(),
    special_instructions: instructionLines.filter(Boolean).join("\n"),
    order_source: tableQrOrderSource(),
    items: state.cart.map((item) => ({
      menu_id: item.id,
      quantity: item.qty,
    })),
  };

  if (state.tableQr.status === "valid") {
    payload.table_token = state.tableQr.token;
  }

  return payload;
}

function ensureOrderIdempotencyKey() {
  if (!state.orderIdempotencyKey) {
    const random = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    state.orderIdempotencyKey = `web-${random}`;
  }
  return state.orderIdempotencyKey;
}

function buildConfirmationSnapshot({ order, paymentData, customer, message }) {
  const orderLabel = order?.order_number || paymentData?.order_number || paymentData?.order_id || order?.id || "";
  const tokenNumber = order?.token_number || paymentData?.token_number || "";
  const trackingUrl = order?.tracking_url || paymentData?.tracking_url || "";
  const totals = cartTotals();
  const tableNumber = order?.table_number || paymentData?.table_number || state.tableQr.table?.table_number || "";
  const orderSource = order?.order_source || paymentData?.order_source || tableQrOrderSource();
  const orderTokenLabel = tokenNumber ? `#${tokenNumber}` : orderLabel;

  return {
    orderLabel,
    orderTokenLabel,
    tokenNumber,
    trackingUrl,
    message:
      orderLabel
        ? `Order ${orderLabel} was sent to the restaurant.${trackingUrl ? ` Track it here: ${trackingUrl}` : ""}`
        : message || "Your order was sent to the restaurant.",
    orderType: currentOrderTypeLabel(),
    paymentMethod: paymentMethodLabel(selectedPaymentMethod()),
    tableNumber,
    tableLabel: tableNumber ? `Table ${tableNumber}` : tableQrDisplayLabel(),
    orderSource,
    customerName: customer?.name || state.kiosk.customerName || elements.customerName?.value?.trim() || "Customer",
    customerPhone: customer?.phone || state.kiosk.customerPhone || elements.customerPhone?.value?.trim() || "",
    totals,
    items: state.cart.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      price: item.price,
      lineTotal: item.price * item.qty,
    })),
    createdAt: new Date().toISOString(),
  };
}

function completeOrderSuccess({ order, paymentData, message, customer }) {
  const snapshot = buildConfirmationSnapshot({ order, paymentData, customer, message });
  const orderLabel = order?.order_number || paymentData?.order_number || paymentData?.order_id || order?.id || "";
  const trackingUrl = order?.tracking_url || paymentData?.tracking_url || "";
  state.confirmation = snapshot;
  state.cart = [];
  state.orderSuccess = orderLabel
    ? `Order ${orderLabel} was sent to the restaurant.${trackingUrl ? ` Track it here: ${trackingUrl}` : ""}`
    : message || "Your order was sent to the restaurant.";
  state.orderIdempotencyKey = "";
  saveCart();
  renderCart();
  renderMenu();
  renderKiosk();
}

async function handleOnlinePayment(customer) {
  const loaded = await loadRazorpayScript();

  if (!loaded) {
    throw new Error("Payment service could not be loaded. Please try again.");
  }

  const result = await requestJson("/payments/create-order", {
    method: "POST",
    body: JSON.stringify(buildPaymentPayload(customer)),
  });

  return new Promise((resolve, reject) => {
    const options = {
      key: result.key_id,
      amount: result.amount,
      currency: result.currency,
      name: "MAHESH",
      description: `Order ${result.order_number || result.restaurant_order_id}`,
      order_id: result.razorpay_order_id,
      method: selectedPaymentMethod(),
      prefill: {
        name: customer.name || elements.customerName.value.trim(),
        email: customer.email || "",
        contact: customer.phone || elements.customerPhone.value.trim(),
      },
      notes: {
        restaurant_order_id: String(result.restaurant_order_id),
      },
      theme: {
        color: "#dc6b19",
      },
      modal: {
        ondismiss() {
          reject(new Error("Payment was cancelled before completion."));
        },
      },
      handler: async (response) => {
        try {
          const verification = await requestJson("/payments/verify", {
            method: "POST",
            body: JSON.stringify({
              restaurant_order_id: result.restaurant_order_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });

          resolve({ paymentData: verification, orderData: result });
        } catch (error) {
          reject(error);
        }
      },
    };

    const paymentObject = new window.Razorpay(options);

    paymentObject.on("payment.failed", (response) => {
      reject(new Error(response.error?.description || "Payment failed. Please try again."));
    });

    paymentObject.open();
  });
}

async function handleOfflinePayment(customer) {
  return requestJson("/payments/cash-order", {
    method: "POST",
    body: JSON.stringify(buildPaymentPayload(customer)),
  });
}

function rememberKioskReceiptPrint(orderId) {
  if (!state.kiosk.enabled || !orderId) return;
  state.kiosk.printedReceiptOrderIds.add(String(orderId));

  try {
    sessionStorage.setItem(
      KIOSK_PRINTED_RECEIPTS_STORAGE_KEY,
      JSON.stringify([...state.kiosk.printedReceiptOrderIds].slice(-100))
    );
  } catch {
    // Session storage is only an extra browser-side duplicate guard.
  }
}

function loadKioskReceiptPrintMemory() {
  if (!state.kiosk.enabled) return;

  try {
    const stored = JSON.parse(sessionStorage.getItem(KIOSK_PRINTED_RECEIPTS_STORAGE_KEY) || "[]");
    state.kiosk.printedReceiptOrderIds = new Set((Array.isArray(stored) ? stored : []).map(String));
  } catch {
    state.kiosk.printedReceiptOrderIds = new Set();
  }
}

async function requestKioskReceiptPrint(order) {
  if (!state.kiosk.enabled || state.tableQr.enabled) return;

  const orderId = Number(order?.id || order?.restaurant_order_id || order?.order_id);
  if (!Number.isInteger(orderId) || orderId < 1) {
    console.warn("[KIOSK_PRINT] missing database order ID", {
      hasId: Boolean(order?.id),
      hasRestaurantOrderId: Boolean(order?.restaurant_order_id),
      hasOrderId: Boolean(order?.order_id),
    });
    return;
  }

  const orderKey = String(orderId);
  if (
    state.kiosk.printedReceiptOrderIds.has(orderKey) ||
    state.kiosk.printingReceiptOrderIds.has(orderKey)
  ) {
    return;
  }

  state.kiosk.printingReceiptOrderIds.add(orderKey);
  const endpoint = `/receipt-printer/kiosk/orders/${encodeURIComponent(orderId)}/receipt`;
  console.info("[KIOSK_PRINT] calling print endpoint", { orderId, endpoint });

  try {
    const response = await fetchApi(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "customer-kiosk" }),
    });
    const payload = await response.json().catch(() => ({}));
    const result = payload.data || payload;

    console.info("[KIOSK_PRINT] response status", {
      orderId,
      status: response.status,
      ok: response.ok,
      printed: Boolean(result?.printed),
      skipped: Boolean(result?.skipped),
      reason: result?.reason || "",
    });

    if (!response.ok) {
      throw new Error(payload.message || "Receipt print request failed");
    }

    if (result?.printed || result?.reason === "already_printed") {
      rememberKioskReceiptPrint(orderId);
    }
  } catch (error) {
    console.warn("[KIOSK_PRINT] print request failed", {
      orderId,
      message: error?.message || "Unknown print error",
    });
  } finally {
    state.kiosk.printingReceiptOrderIds.delete(orderKey);
  }
}

async function loadCustomerNotifications({ announce = false } = {}) {
  const phone = elements.customerPhone.value.trim() || localStorage.getItem(CUSTOMER_PHONE_STORAGE_KEY) || "";
  if (!phone) return;

  try {
    const notifications = await requestJson(`/notifications/phone/${encodeURIComponent(phone)}`);
    if (!Array.isArray(notifications) || notifications.length === 0) return;

    const seenIds = seenNotificationIds();
    const newNotifications = notifications
      .filter((notification) => !seenIds.has(String(notification.id)))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    notifications.forEach((notification) => {
      seenIds.add(String(notification.id));
    });
    saveSeenNotificationIds(seenIds);

    if (announce) {
      newNotifications.slice(-3).forEach((notification) => {
        const type = notification.type === "order_cancelled" ? "warning" : "success";
        showToast(notification.title, notification.message, type);
      });
    }
  } catch {
    // Notification polling should never interrupt menu browsing or ordering.
  }
}

function startCustomerNotificationPolling() {
  if (state.kiosk.enabled || state.tableQr.enabled) return;

  const savedPhone = localStorage.getItem(CUSTOMER_PHONE_STORAGE_KEY);
  if (savedPhone && !elements.customerPhone.value.trim()) {
    elements.customerPhone.value = savedPhone;
  }

  loadCustomerNotifications({ announce: false });
  window.setInterval(() => {
    loadCustomerNotifications({ announce: true });
  }, 30000);
}

async function placeOrder() {
  if (state.isSubmittingOrder) return;

  if (tableQrOrderingBlocked()) {
    showToast("Table QR unavailable", state.tableQr.error || "Please ask restaurant staff for a fresh QR code.", "warning");
    renderTableQrContext();
    applyTableQrControls();
    return;
  }

  if (!state.cart.length) {
    document.querySelector("#menu").scrollIntoView({ behavior: "smooth" });
    showToast("Please add at least one item first", "", "warning");
    return;
  }

  const name = elements.customerName.value.trim();
  const phone = elements.customerPhone.value.trim();

  if (!name || !phone) {
    showToast("Name and phone required", "Add customer details before sending the order.", "warning");
    return;
  }

  if (state.checkoutStep !== "payment") {
    state.checkoutStep = "payment";
    setPaymentSelectorVisible(true);
    await loadPaymentMethods();
    renderCart();
    showToast("Choose payment method", "Select how you want to pay, then confirm the order.", "info");
    return;
  }

  if (isOnlinePayment() && !state.onlinePaymentsEnabled) {
    showToast("Online payment not configured", "Choose Cash on Delivery or Pay at Restaurant Counter for now.", "warning");
    selectPaymentMethod("cash_on_delivery");
    updatePlaceOrderButtonText();
    return;
  }

  elements.placeOrder.disabled = true;
  elements.placeOrder.textContent = state.tableQr.enabled ? "Placing order..." : "Sending...";
  state.isSubmittingOrder = true;

  try {
    saveCustomerPhone(phone);
    const customer = await findOrCreateCustomer({ name, phone });
    if (isOnlinePayment()) {
      const result = await handleOnlinePayment(customer);
      completeOrderSuccess({
        paymentData: result.paymentData,
        order: { order_number: result.orderData.order_number, id: result.orderData.restaurant_order_id },
        customer,
      });
      showToast("Payment confirmed", state.orderSuccess, "success");
    } else {
      const order = await handleOfflinePayment(customer);
      completeOrderSuccess({
        order: order.order,
        message: "Your order was sent to the restaurant.",
        customer,
      });
      showToast(order.notification?.title || "Order saved", order.notification?.message || state.orderSuccess, "success");
    }

    await loadCustomerNotifications({ announce: false });
  } catch (error) {
    const message = error.message || "Please try again.";
    if (/razorpay environment variables are missing/i.test(message)) {
      state.onlinePaymentsEnabled = false;
      applyPaymentAvailability();
      showToast("Online payment not configured", "Choose Cash on Delivery or Pay at Restaurant Counter for now.", "warning");
    } else {
      showToast("Unable to place order", message, "warning");
    }
  } finally {
    state.isSubmittingOrder = false;
    elements.placeOrder.disabled = false;
    updatePlaceOrderButtonText();
  }
}

function addChatMessage(role, message) {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message ${role}`;
  messageEl.textContent = message;
  elements.chatMessages.appendChild(messageEl);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  return messageEl;
}

function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/rs\.?/g, "rupees")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function categoryDocuments() {
  return categories()
    .filter((category) => category !== "All")
    .map((category) => {
      const items = menuItems.filter((item) => item.category === category);
      const prices = items.map((item) => item.price);
      return {
        type: "category",
        category,
        title: category,
        text: `${category}: ${items.map((item) => `${item.name} ${formatPrice(item.price)}`).join(", ")}. Price range ${formatPrice(Math.min(...prices))} to ${formatPrice(Math.max(...prices))}.`,
        items,
      };
    });
}

function menuDocuments() {
  const itemDocs = menuItems.map((item) => ({
    type: "item",
    category: item.category,
    title: item.name,
    text: `${item.name} is in ${item.category}. Price ${formatPrice(item.price)}. Available at MAHESH.`,
    item,
  }));

  const serviceDocs = [
    {
      type: "service",
      title: "Ordering",
      text: "To place an order, choose items, press ADD, enter name and phone, select pickup, dine-in, or delivery, then send the order request.",
    },
    {
      type: "service",
      title: "Timing",
      text: "MAHESH is shown as open daily from 10:00 AM to 10:00 PM.",
    },
    {
      type: "service",
      title: "Voice assistant",
      text: "Customers can use the microphone button to ask questions by voice and can turn spoken replies on or off.",
    },
  ];

  return [...itemDocs, ...categoryDocuments(), ...serviceDocs];
}

function retrieveContext(question, limit = 5) {
  const queryWords = tokenize(question);
  const docs = menuDocuments();

  return docs
    .map((doc) => {
      const docWords = tokenize(`${doc.title} ${doc.text} ${doc.category || ""}`);
      const score = queryWords.reduce((sum, word) => {
        const exactMatches = docWords.filter((docWord) => docWord === word).length;
        const partialMatches = docWords.some((docWord) => docWord.includes(word) || word.includes(docWord)) ? 1 : 0;
        return sum + exactMatches * 3 + partialMatches;
      }, 0);
      return { ...doc, score };
    })
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function itemsUnderBudget(question) {
  const budgetMatch = question.match(/(?:under|below|less than|upto|up to|rs\.?|₹)\s*(\d+)/i);
  if (!budgetMatch) return [];

  const budget = Number(budgetMatch[1]);
  return menuItems
    .filter((item) => item.price <= budget)
    .sort((a, b) => b.price - a.price)
    .slice(0, 8);
}

function recommendationItems(question) {
  const text = question.toLowerCase();
  const sweetWords = ["sweet", "dessert", "pastry", "cake", "donut", "muffin", "pudding"];
  const snackWords = ["snack", "quick", "light", "chaat", "puff", "roll"];
  const spicyWords = ["spicy", "chilli", "masala", "tikka", "chinese"];

  if (sweetWords.some((word) => text.includes(word))) {
    return menuItems
      .filter((item) => ["Pastries", "Donuts", "Muffins / Cupcakes", "Puddings", "Pies / Tarts"].includes(item.category))
      .slice(0, 8);
  }

  if (snackWords.some((word) => text.includes(word))) {
    return menuItems
      .filter((item) => ["Puffs Patties & Rolls", "Chaat", "Burger & Sandwiches"].includes(item.category))
      .slice(0, 8);
  }

  if (spicyWords.some((word) => text.includes(word))) {
    return menuItems
      .filter((item) => ["Perfect Pizzas", "Chinese", "Chaat"].includes(item.category))
      .slice(0, 8);
  }

  return menuItems
    .filter((item) => ["Paneer Puff Pastry", "Veg Cheese Pizza", "Samosa Chaat", "Spring Roll", "Chocolate Muffins"].includes(item.name))
    .slice(0, 5);
}

function formatItemList(items) {
  return items.map((item) => `${item.name} (${formatPrice(item.price)})`).join(", ");
}

function uniqueMenuItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeCompactText(item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function itemMatchesAny(item, words) {
  const text = normalizeMenuText(`${item.name} ${item.category}`);
  return words.some((word) => text.includes(word));
}

function localItemsByName(names, limit = 6) {
  const picks = names
    .map((name) => {
      const target = normalizeCompactText(name);
      return menuItems.find((item) => normalizeCompactText(item.name).includes(target));
    })
    .filter(Boolean);

  return uniqueMenuItems(picks).slice(0, limit);
}

function localFavoriteItems(limit = 6) {
  const picks = localItemsByName([
    "spring roll",
    "spicy veg burger",
    "paneer tikka pizza",
    "mexican pizza",
    "samosa chaat",
    "biscoff pastry",
    "cheese cake pastry",
    "mint mojito",
    "rasmalai",
  ], limit);

  return picks.length ? picks : uniqueMenuItems(recommendationItems("recommend spicy snacks")).slice(0, limit);
}

function localSpicyItems(limit = 6) {
  const picks = localItemsByName([
    "spring roll",
    "spicy veg burger",
    "paneer tikka pizza",
    "mexican pizza",
    "samosa chaat",
    "pav bhaji",
  ], limit);

  return picks.length ? picks : uniqueMenuItems(recommendationItems("spicy snacks")).slice(0, limit);
}

function normalizeIntentText(question = "") {
  return String(question)
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\bwaht\b/g, "what")
    .replace(/\bwht\b/g, "what")
    .replace(/\bwat\b/g, "what")
    .replace(/\bshoud\b/g, "should")
    .replace(/\bshuld\b/g, "should")
    .replace(/\btodays\b/g, "today")
    .replace(/\s+/g, " ")
    .trim();
}

function isMealRecommendationQuestion(question) {
  const normalizedText = normalizeIntentText(question);

  return (
    /\b(what|which|suggest|recommend|confused|hungry)\b/.test(normalizedText) &&
    /\b(should|can|to|want|eat|order|try|have)\b/.test(normalizedText) &&
    /\b(eat|order|try|have|food|item|snack|meal|today)\b/.test(normalizedText)
  );
}

function localMealRecommendation(question) {
  const normalizedText = normalizeIntentText(question);
  let picks = [];

  if (normalizedText.includes("spicy")) {
    picks = localSpicyItems(5);
  } else if (normalizedText.includes("sweet") || normalizedText.includes("dessert")) {
    picks = localItemsByName(["biscoff pastry", "cheese cake pastry", "rasmalai", "gulab jamun", "falooda kulfi"], 5);
  } else if (normalizedText.includes("light")) {
    picks = localItemsByName(["spring roll", "samosa chaat", "mint mojito", "mixed fruit juice"], 5);
  } else {
    picks = localFavoriteItems(5);
  }

  if (!picks.length) return "";

  return `If you are not sure what to eat today, I would suggest: ${formatItemList(picks)}. For a quick snack, pick Spring Roll or Spicy Veg Burger. For something filling, pick Paneer Tikka Pizza.`;
}

function localBirthdayComboItems() {
  return localItemsByName(["cheese cake pastry", "spring roll", "paneer tikka pizza", "mint mojito", "rasmalai"], 5);
}

function localTodaySpecialItems() {
  return localFavoriteItems(6);
}

function localEgglessCandidateItems() {
  return uniqueMenuItems(
    menuItems.filter((item) => itemMatchesAny(item, ["cake", "pastry", "muffin", "pudding", "pie"]))
  ).slice(0, 6);
}

function handleLocalMenuQuestion(question) {
  if (isCartCommand(question)) return "";
  if (state.menuStatus !== "ready" || !menuItems.length) return "";

  const text = question.toLowerCase();
  if (isMealRecommendationQuestion(question)) {
    const recommendation = localMealRecommendation(question);
    if (recommendation) return recommendation;
  }

  const directItem = findMenuItemFromText(question);
  if (directItem) {
    return `${directItem.name} is available for ${formatPrice(directItem.price)}. Would you like me to add it to your cart?`;
  }

  if (text.includes("taste") && text.includes("pizza")) {
    const pizzas = localItemsByName(["mexican pizza", "paneer tikka pizza", "onion and capsicum pizza", "veg cheese pizza", "veggie supreme pizza"], 5);
    if (pizzas.length) {
      return `Pizza taste depends on your choice: Mexican Pizza is tangy and slightly spicy, Paneer Tikka Pizza is smoky and creamy, Onion and Capsicum Pizza is classic veg, and Veg Cheese Pizza is mild and cheesy. Current pizza options: ${formatItemList(pizzas)}.`;
    }
  }

  if (text.includes("best") || text.includes("taste") || text.includes("popular")) {
    const favorites = localFavoriteItems(6);
    if (favorites.length) {
      return `For best taste, I recommend: ${formatItemList(favorites)}. Spring Roll and Spicy Veg Burger are good savory picks; Biscoff Pastry is better if you want sweet.`;
    }
  }

  if (text.includes("spicy") && (text.includes("recommend") || text.includes("suggest") || text.includes("snack") || text.includes("eat"))) {
    const spicyItems = localSpicyItems(6);
    if (spicyItems.length) {
      return `For spicy taste, I recommend: ${formatItemList(spicyItems)}. Spring Roll and Spicy Veg Burger are quick choices; Paneer Tikka Pizza or Mexican Pizza are more filling.`;
    }
  }

  if (text.includes("pizza") && /(?:under|below|less than|upto|up to|rs\.?|₹)\s*(\d+)/i.test(question)) {
    const pizzas = localItemsByName(["mexican pizza", "paneer tikka pizza", "onion and capsicum pizza", "veg cheese pizza"], 4);
    const cheapestPizza = pizzas.slice().sort((a, b) => a.price - b.price)[0];
    if (cheapestPizza) {
      return `I could not find pizza under that budget. The closest pizza starts with ${cheapestPizza.name} at ${formatPrice(cheapestPizza.price)}. Closest choices: ${formatItemList(pizzas)}.`;
    }
  }

  const budgetItems = itemsUnderBudget(question);
  if (budgetItems.length) {
    return `Here are menu items in your budget: ${formatItemList(uniqueMenuItems(budgetItems).slice(0, 6))}.`;
  }

  if (text.includes("birthday") || text.includes("combo")) {
    const comboItems = localBirthdayComboItems();
    if (comboItems.length) {
      return `A good birthday combo from the menu is: ${formatItemList(comboItems)}.`;
    }
  }

  if (text.includes("today") && text.includes("special")) {
    const specialItems = localTodaySpecialItems();
    if (specialItems.length) {
      return `Today's suggested specials are: ${formatItemList(specialItems)}.`;
    }
  }

  if (text.includes("eggless")) {
    const candidates = localEgglessCandidateItems();
    if (candidates.length) {
      return `I need the live database to confirm eggless flags, but these cake and bakery items are on the menu: ${formatItemList(candidates)}.`;
    }
  }

  if (/\b(recommend|suggest|spicy|snack|food|eat|hungry|pizza|burger|roll|chaat|chinese|drink|sweet|dessert)\b/.test(text)) {
    const recommendations = uniqueMenuItems(recommendationItems(question)).slice(0, 6);
    if (recommendations.length) {
      return `I recommend: ${formatItemList(recommendations)}. Would you like me to add any item to your cart?`;
    }
  }

  const context = retrieveContext(question, 3).filter((doc) => doc.type === "item" || doc.type === "category");
  if (context.length) {
    const contextItems = uniqueMenuItems(
      context.flatMap((doc) => (doc.item ? [doc.item] : doc.items || []))
    ).slice(0, 6);

    if (contextItems.length) {
      return `I found these menu matches: ${formatItemList(contextItems)}.`;
    }
  }

  return "";
}

function handleLocalCustomerQuestion(question) {
  const text = question.toLowerCase();
  const normalizedText = text.replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
  const compactText = normalizeCompactText(normalizedText);

  if (/^(hy|hyy|hi|hii|hiii|hlo|helo|hello|hey|heyy|namaste|sat sri akal|ssakal)$/.test(normalizedText) || /^(hy|hyy|hii|hiii|hlo|helo|hello|hey|heyy)$/.test(compactText)) {
    return "Hello! How can I help you today?";
  }

  if (/\b(how are you|how r you|how are u|hows your day|how's your day|how is your day|how was your day|kaise ho)\b/.test(normalizedText)) {
    return "I am doing well, thanks for asking. How can I help you with the menu today?";
  }

  if (/\b(good morning|good afternoon|good evening|good night)\b/.test(normalizedText)) {
    return "Hello! Hope you are having a good day. How can I help you with food or ordering?";
  }

  if (/\b(thank|thanks|thank you|thx)\b/.test(normalizedText)) {
    return "You are welcome. I am here if you want menu suggestions, prices, or help placing an order.";
  }

  if (/\b(who are you|what can you do|help me|what should i ask)\b/.test(normalizedText)) {
    return "I can help you choose food, compare prices, find spicy or sweet items, suggest combos, answer timing/location questions, and add items to your cart when you say add or order.";
  }

  if (/\b(open|close|closing|timing|time|hours|shop time)\b/.test(text)) {
    const settings = state.restaurantSettings || defaultRestaurantSettings;
    return `${settings.restaurantName} is shown as open from ${restaurantHoursText(settings)}. For urgent visits, please confirm with the restaurant before travelling.`;
  }

  if (/\b(address|location|where|located|map|reach)\b/.test(text)) {
    const settings = state.restaurantSettings || defaultRestaurantSettings;
    return `${settings.restaurantName} is listed at ${settings.address}. You can also use the contact section on this website for contact details and directions.`;
  }

  if (/\b(custom|customize|customise|birthday cake|cake order|preorder|pre order|advance order|bulk|party)\b/.test(text)) {
    return "For custom cakes, party orders, or bulk orders, please contact the restaurant in advance. I can still help you browse cakes, snacks, drinks, and combo ideas.";
  }

  if (/\b(order|place order|how to buy|checkout|cart)\b/.test(text)) {
    return "To order, add items to the cart, enter your name and phone number, choose pickup, dine-in, or delivery, then send the order request.";
  }

  if (/\b(delivery|deliver|pickup|dine in|dine-in|takeaway|take away)\b/.test(text)) {
    return "You can choose pickup, dine-in, or delivery on the order form. Delivery availability may depend on your location, so the restaurant can confirm after you send the request.";
  }

  if (/\b(payment|pay|cash|online|upi|card)\b/.test(text)) {
    return "Checkout supports UPI, card, net banking, wallet, Cash on Delivery, and Pay at Restaurant Counter. Online payments are confirmed only after secure server verification.";
  }

  if (/\b(cancel|cancellation|refund|return|exchange|replace|replacement|change order|modify)\b/.test(text)) {
    return "For cancellation, return, exchange, or refund requests, please contact the restaurant as soon as possible with your order details.";
  }

  if (/\b(allergy|allergic|allergen|nuts|peanut|gluten|dairy|egg|eggs|vegan|jain)\b/.test(text)) {
    return "Please mention any allergy or dietary requirement before ordering. Ingredients and cross-contact should be confirmed directly with the restaurant for safety.";
  }

  return "";
}

const quantityWords = {
  a: 1,
  an: 1,
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

function normalizeMenuText(value) {
  return String(value)
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
}

function normalizeCompactText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function stripMenuQuestionWords(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/\b(do you have|would like|can i get)\b/g, " ")
    .replace(/\b(i|we|me|my|please|kindly)\b/g, " ")
    .replace(/\b(do|does|want|wanna|like|eat|have|try|taste|craving|hungry|suggest|recommend|available|is|are|can|you|tell|about|price|cost|rate|of|for)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function quantityFromText(value) {
  const normalized = String(value).toLowerCase();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return quantityWords[normalized] || 1;
}

function isCartCommand(question) {
  const normalized = String(question).toLowerCase();

  return (
    /\badd\b/.test(normalized) ||
    /\border\b/.test(normalized) ||
    /\bbuy\b/.test(normalized) ||
    /\bput\b/.test(normalized) ||
    /\bcart\b/.test(normalized) ||
    /\bremove\b/.test(normalized) ||
    /\bdelete\b/.test(normalized) ||
    /\bclear\b/.test(normalized) ||
    /\bshow my cart\b/.test(normalized) ||
    /\bcart total\b/.test(normalized) ||
    /\btotal\b/.test(normalized) ||
    /\bincrease\b/.test(normalized) ||
    /\bdecrease\b/.test(normalized) ||
    /\breplace\b/.test(normalized) ||
    /\bi'?ll have\b/.test(normalized) ||
    /\bsend me\b/.test(normalized)
  );
}

function rememberRecommendedItems(answer = "") {
  const answerText = normalizeCompactText(answer);
  const mentioned = menuItems.filter((item) => answerText.includes(normalizeCompactText(item.name)));
  state.lastRecommendedItems = uniqueMenuItems(mentioned).slice(0, 6);
}

function formatCartForChat() {
  if (!state.cart.length) return "Your cart is empty.";
  return cartSummaryText("Your cart has:");
}

function findCartItemFromText(text) {
  const item = findMenuItemFromText(text, state.cart);
  if (item) return item;

  const normalizedText = normalizeMenuText(text);
  return state.cart.find((cartItem) => normalizedText.includes(normalizeMenuText(cartItem.name))) || null;
}

function setCartItemQuantity(itemId, quantity) {
  const safeQuantity = Math.min(MAX_ITEM_QUANTITY, Math.max(0, Number(quantity) || 0));

  if (safeQuantity <= 0) {
    state.cart = state.cart.filter((item) => item.id !== itemId);
  } else {
    state.cart = state.cart.map((item) => (item.id === itemId ? { ...item, qty: safeQuantity } : item));
  }
  saveCart();
  renderCart();
  renderMenu();
}

function handleCartManagementCommand(question) {
  const text = question.toLowerCase();

  if (/\b(show my cart|show cart|cart total|what is my cart total|total)\b/.test(text)) {
    return formatCartForChat();
  }

  if (/\b(clear cart|clear my cart|empty cart|remove all)\b/.test(text)) {
    state.cart = [];
    saveCart();
    renderCart();
    renderMenu();
    return "Done. I cleared your cart.";
  }

  if (/\badd\b/.test(text) && /\b(recommended|recommendation|combo)\b/.test(text) && state.lastRecommendedItems.length) {
    state.lastRecommendedItems.forEach((item) => addItemToCart(item, 1));
    return `Done. I added the recommended items:\n${state.lastRecommendedItems.map((item) => `1 x ${item.name}`).join("\n")}\n\n${cartSummaryText("Your cart now has:")}`;
  }

  if (/\breplace\b/.test(text) && text.includes(" with ")) {
    const [oldPart, newPart] = text.split(/\bwith\b/);
    const oldItem = findCartItemFromText(oldPart);
    const newItem = findMenuItemForPhrase(newPart);

    if (!oldItem) return "I could not find the item to replace in your cart.";
    if (!newItem) return "I could not find the replacement item in the menu.";

    const oldQty = oldItem.qty || 1;
    setCartItemQuantity(oldItem.id, 0);
    addItemToCart(newItem, oldQty);
    return `Done. I replaced ${oldItem.name} with ${newItem.name}.\n\n${cartSummaryText("Your cart now has:")}`;
  }

  if (/\b(remove|delete)\b/.test(text)) {
    const item = findCartItemFromText(text);
    if (!item) return "I could not find that item in your cart.";
    setCartItemQuantity(item.id, 0);
    return `Done. I removed ${item.name} from your cart.\n\n${formatCartForChat()}`;
  }

  const quantityMatch = text.match(/\b(?:increase|set|change)\b.+?\b(?:to|quantity to)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (quantityMatch) {
    const item = findCartItemFromText(text);
    if (!item) return "I could not find that item in your cart.";
    const quantity = quantityFromText(quantityMatch[1]);
    setCartItemQuantity(item.id, quantity);
    return `Done. I set ${item.name} quantity to ${quantity}.\n\n${cartSummaryText("Your cart now has:")}`;
  }

  return "";
}

function splitOrderSegments(question) {
  const quantityPattern = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)";
  const connectorBeforeQuantity = new RegExp(`\\s+(?:and|plus|with)\\s+(?=${quantityPattern}\\s+)`, "gi");

  return question
    .toLowerCase()
    .replace(connectorBeforeQuantity, ", ")
    .split(",")
    .map((segment) =>
      segment
        .replace(/\b(please|kindly|can i|could i|would like|i would like|i want|i need|i'll have|ill have|add|order|get|give me|put|to my cart|to cart|in cart|for me)\b/g, " ")
        .replace(/\b(buy|add to cart|put in cart|put it in cart)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function extractCartRequests(question) {
  if (!isCartCommand(question)) return [];

  const quantityPattern = /^(?<qty>\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\s+(?<name>.+)$/i;

  return splitOrderSegments(question)
    .map((segment) => {
      const match = segment.match(quantityPattern);
      const quantity = match ? quantityFromText(match.groups.qty) : 1;
      const name = (match ? match.groups.name : segment)
        .replace(/\b(items?|please|cart|order)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return { quantity, name };
    })
    .filter((request) => request.name.length > 1);
}

function findMenuItemFromText(userText, items = menuItems) {
  const cleanUserText = normalizeCompactText(stripMenuQuestionWords(userText));
  const cleanFullText = normalizeCompactText(userText);

  if (!cleanUserText && !cleanFullText) return null;

  const matches = items
    .map((item) => {
      const itemName = normalizeCompactText(item.name);
      const singularItemName = itemName.replace(/s$/, "");
      const searchableText = cleanUserText || cleanFullText;
      let score = 0;

      if (!itemName) return { item, score };
      if (searchableText === itemName || searchableText === singularItemName) score += 120;
      if (cleanFullText.includes(itemName) || cleanFullText.includes(singularItemName)) score += 100;
      if (itemName.includes(searchableText) || singularItemName.includes(searchableText)) score += 70;
      if (score > 0) score += Math.max(0, 30 - item.name.length);

      return { item, score };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.item || null;
}

function scoreMenuMatch(item, phrase) {
  const normalizedPhrase = normalizeMenuText(phrase);
  const normalizedName = normalizeMenuText(item.name);
  const normalizedCategory = normalizeMenuText(item.category);
  const phraseWords = normalizedPhrase.split(" ").filter(Boolean);
  let score = 0;

  if (!phraseWords.length) return 0;
  if (normalizedName === normalizedPhrase) score += 100;
  if (normalizedName.includes(normalizedPhrase)) score += 60;
  if (normalizedPhrase.includes(normalizedName)) score += 50;
  if (normalizedCategory.includes(normalizedPhrase)) score += 28;

  phraseWords.forEach((word) => {
    if (normalizedName.split(" ").includes(word)) score += 14;
    else if (normalizedName.includes(word)) score += 8;
    if (normalizedCategory.includes(word)) score += 5;
  });

  if (/\bveg\b/.test(normalizedName)) score += 2;
  return score;
}

function findMenuItemForPhrase(phrase) {
  const exactCompactMatch = findMenuItemFromText(phrase);
  if (exactCompactMatch) return exactCompactMatch;

  return menuItems
    .map((item) => ({ item, score: scoreMenuMatch(item, phrase) }))
    .filter((match) => match.score >= 30)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.length - b.item.name.length;
    })[0]?.item || null;
}

function handleMenuAvailabilityQuestion(question) {
  if (isCartCommand(question)) return "";
  if (state.menuStatus !== "ready" || !menuItems.length) return "";

  const item = findMenuItemFromText(question);
  if (!item) return "";

  return `${item.name} is available for ${formatPrice(item.price)}. Would you like me to add it to your cart?`;
}

function cartSummaryText(prefix = "Done! Your cart now has:") {
  const { total } = cartTotals();
  const lines = state.cart.map((item) => `${item.qty} x ${item.name}`);
  return `${prefix}\n${lines.join("\n")}\nTotal: ${formatPrice(total)}`;
}

function handleCartAction(question) {
  const managementAnswer = handleCartManagementCommand(question);
  if (managementAnswer) return managementAnswer;

  const requests = extractCartRequests(question);
  if (!requests.length) return "";

  if (state.menuStatus === "loading") {
    return "I am still loading the live menu. Try again in a moment and I can add those items to your cart.";
  }

  if (state.menuStatus !== "ready" || !menuItems.length) {
    return "I cannot update the cart until the live menu is available. Please retry the menu connection first.";
  }

  const added = [];
  const missed = [];

  requests.forEach((request) => {
    const item = findMenuItemForPhrase(request.name);
    if (!item) {
      missed.push(request.name);
      return;
    }

    addItemToCart(item, request.quantity);
    added.push({ ...item, qty: request.quantity });
  });

  if (!added.length) {
    return `I could not find "${requests.map((request) => request.name).join(", ")}" in the current menu. Try the exact item name from the menu.`;
  }

  showToast("Cart updated by AI", added.map((item) => `${item.qty} x ${item.name}`).join(", "), "success");

  const addedLines = added.map((item) => `${item.qty} x ${item.name}`).join("\n");
  const missedLine = missed.length ? `\n\nI could not find: ${missed.join(", ")}.` : "";
  return `Done! I added:\n${addedLines}\n\n${cartSummaryText("Your cart now has:")}${missedLine}`;
}

function setChatStatus(message) {
  elements.chatStatus.textContent = message;
}

function setChatSending(isSending) {
  state.chatSending = isSending;

  const sendButton = elements.chatForm?.querySelector("button[type='submit']");
  if (sendButton) {
    sendButton.disabled = isSending;
    sendButton.textContent = isSending ? "Sending..." : "Send";
  }

  if (elements.chatInput) {
    elements.chatInput.disabled = isSending;
  }

  elements.chatPrompts?.querySelectorAll("[data-question]").forEach((button) => {
    button.disabled = isSending;
  });
}

function speakAnswer(message) {
  if (!state.voiceReply || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "en-IN";
  utterance.rate = 0.96;
  window.speechSynthesis.speak(utterance);
}

function isLocalHost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function voiceSupportProblem() {
  if (!window.isSecureContext && !isLocalHost()) {
    return "Voice input needs HTTPS or localhost. Open the app on localhost to use the mic.";
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return "Microphone access is not available in this browser.";
  }

  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    return "Voice input works best in Chrome or Edge on desktop.";
  }

  return "";
}

async function requestMicrophonePermission() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  stream.getTracks().forEach((track) => track.stop());
}

function voiceErrorMessage(errorName) {
  const messages = {
    "not-allowed": "Microphone permission was blocked. Allow microphone access in the browser address bar.",
    "service-not-allowed": "Speech recognition service is blocked in this browser. Try Chrome or Edge on localhost.",
    "audio-capture": "No microphone was detected. Check your microphone connection.",
    network: "Speech recognition needs network access in this browser. Try again or type your question.",
    "no-speech": "I did not hear anything. Click Mic and speak again.",
    aborted: "Voice input stopped.",
  };

  return messages[errorName] || "Voice input could not start. Please allow microphone access.";
}

function backendAnswer(data) {
  const answer = data.answer || data.message;
  if (!answer) return "";

  if (Array.isArray(data.recommendations) && data.recommendations.length) {
    return `${answer} Recommendations: ${data.recommendations.join(", ")}.`;
  }

  return answer;
}

function chatStatusForResponse(data) {
  if (data.type === "voice_recommendation") return "Voice recommendation service";
  if (data.type === "database_menu") return "Live database menu";
  if (data.type === "database_fallback") return "Live menu fallback";
  if (data.type === "customer_concierge") return "Customer assistant";
  return "Backend RAG answered";
}

async function askChatbot(question) {
  const cleanQuestion = String(question || "").trim();
  if (!cleanQuestion) return;

  if (state.chatSending) {
    showToast("Please wait", "The assistant is still answering your last question.", "info");
    return;
  }

  if (cleanQuestion.length > MAX_MESSAGE_LENGTH) {
    addChatMessage("user", cleanQuestion.slice(0, MAX_MESSAGE_LENGTH));
    const answer = `Your question is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`;
    addChatMessage("bot", answer);
    setChatStatus("Question too long");
    speakAnswer(answer);
    return;
  }

  setChatSending(true);
  addChatMessage("user", cleanQuestion);
  let pendingMessage = null;

  try {
    const cartActionAnswer = handleCartAction(cleanQuestion);
    if (cartActionAnswer) {
      addChatMessage("bot", cartActionAnswer);
      setChatStatus("Cart updated by AI");
      speakAnswer(cartActionAnswer);
      return;
    }

    pendingMessage = addChatMessage("bot", "Searching MAHESH menu knowledge...");
    setChatStatus("Checking backend RAG...");

    const response = await fetchApi("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: cleanQuestion }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.message) {
        pendingMessage.textContent = errorData.message;
        setChatStatus("Assistant request limited");
        speakAnswer(errorData.message);
        return;
      }
      throw new Error(errorData.message || "AI assistant API failed");
    }

    const data = await response.json();
    const answer = backendAnswer(data);
    if (!answer) {
      throw new Error("AI service returned an empty answer");
    }
    pendingMessage.textContent = answer;
    rememberRecommendedItems(answer);
    setChatStatus(chatStatusForResponse(data));
    speakAnswer(answer);
  } catch (error) {
    console.warn("Customer AI backend unavailable:", error);
    const fallbackAnswer =
      handleLocalMenuQuestion(cleanQuestion) ||
      handleMenuAvailabilityQuestion(cleanQuestion) ||
      handleLocalCustomerQuestion(cleanQuestion);
    const answer =
      fallbackAnswer ||
      "I can help with menu suggestions, prices, cart ordering, shop timing, and location. You can ask: recommend spicy snacks, show drinks under Rs. 100, what is today's special, or add one Spring Roll.";
    if (pendingMessage) {
      pendingMessage.textContent = answer;
    } else {
      addChatMessage("bot", answer);
    }
    rememberRecommendedItems(answer);
    setChatStatus(fallbackAnswer ? "Saved menu answer" : "Customer assistant ready");
    speakAnswer(answer);
  } finally {
    setChatSending(false);
  }
}

function setupVoiceSystem() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const problem = voiceSupportProblem();

  if (problem || !SpeechRecognition) {
    elements.voiceButton.disabled = true;
    elements.voiceButton.textContent = "No mic";
    elements.voiceButton.title = problem || "Voice input is not supported in this browser.";
    setChatStatus(problem || "Text chat ready. Voice is not supported in this browser.");
    return;
  }

  state.recognition = new SpeechRecognition();
  state.recognition.lang = "en-IN";
  state.recognition.interimResults = false;
  state.recognition.maxAlternatives = 1;

  state.recognition.addEventListener("start", () => {
    state.isListening = true;
    elements.voiceButton.classList.add("is-listening");
    elements.voiceButton.textContent = "Stop";
    elements.voiceButton.disabled = false;
    setChatStatus("Listening...");
  });

  state.recognition.addEventListener("end", () => {
    state.isListening = false;
    elements.voiceButton.classList.remove("is-listening");
    elements.voiceButton.textContent = "Mic";
    if (elements.chatStatus.textContent === "Listening...") {
      setChatStatus("Menu RAG ready");
    }
  });

  state.recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript.trim();
    if (!transcript) return;
    elements.chatInput.value = transcript;
    askChatbot(transcript);
    elements.chatInput.value = "";
  });

  state.recognition.addEventListener("error", (event) => {
    const message = voiceErrorMessage(event.error);
    showToast(message);
    setChatStatus(message);
  });
}

function kioskRestaurantName() {
  return state.restaurantSettings?.restaurantName || defaultRestaurantSettings.restaurantName;
}

function kioskLogoSrc() {
  return state.restaurantSettings?.logo || DEFAULT_LOGO_PATH;
}

function kioskConfiguredDisplayMode() {
  const configured = String(state.restaurantSettings?.kioskDisplayMode || defaultRestaurantSettings.kioskDisplayMode).toLowerCase();
  return ["auto", "landscape", "portrait"].includes(configured) ? configured : "auto";
}

function kioskResolvedDisplayMode() {
  const configured = kioskConfiguredDisplayMode();
  if (configured !== "auto") return configured;
  return window.innerHeight > window.innerWidth ? "portrait" : "landscape";
}

function applyKioskDisplayMode() {
  if (!state.kiosk.enabled) return;

  const configured = kioskConfiguredDisplayMode();
  const resolved = kioskResolvedDisplayMode();
  document.body.dataset.kioskDisplayMode = configured;
  document.body.dataset.kioskResolvedLayout = resolved;
  document.body.classList.toggle("kiosk-layout-landscape", resolved === "landscape");
  document.body.classList.toggle("kiosk-layout-portrait", resolved === "portrait");
}

function kioskActiveOrderScreen() {
  return ["order_type", "menu", "details", "payment", "review"].includes(state.kiosk.screen);
}

function handleKioskContextMenu(event) {
  if (!state.kiosk.enabled) return;
  event.preventDefault();
}

function handleKioskMouseDown(event) {
  if (!state.kiosk.enabled || event.button !== 2) return;
  event.preventDefault();
}

function handleKioskDragStart(event) {
  if (!state.kiosk.enabled) return;
  event.preventDefault();
}

function handleKioskOrientationChange() {
  if (!state.kiosk.enabled || kioskConfiguredDisplayMode() !== "auto") return;
  applyKioskDisplayMode();
  renderKiosk();
}

function clearKioskIdleTimers() {
  window.clearTimeout(state.kiosk.idleTimer);
  window.clearTimeout(state.kiosk.idleGraceTimer);
  state.kiosk.idleTimer = null;
  state.kiosk.idleGraceTimer = null;
  updateKioskTimerDebug();
}

function clearKioskConfirmationTimers() {
  window.clearTimeout(state.kiosk.resetTimer);
  window.clearInterval(state.kiosk.resetInterval);
  state.kiosk.resetTimer = null;
  state.kiosk.resetInterval = null;
  state.kiosk.resetRemaining = 0;
  updateKioskTimerDebug();
}

function scheduleKioskIdleTimer() {
  if (!state.kiosk.enabled || !kioskActiveOrderScreen()) return;

  clearKioskIdleTimers();
  state.kiosk.idleTimer = window.setTimeout(() => {
    state.kiosk.idleWarning = true;
    renderKiosk();
    state.kiosk.idleGraceTimer = window.setTimeout(resetKioskSession, KIOSK_IDLE_GRACE_MS);
    updateKioskTimerDebug();
  }, KIOSK_IDLE_TIMEOUT_MS);
  updateKioskTimerDebug();
}

function resetKioskActivity() {
  if (!state.kiosk.enabled || !kioskActiveOrderScreen() || state.kiosk.idleWarning) return;
  scheduleKioskIdleTimer();
}

function continueKioskSession() {
  state.kiosk.idleWarning = false;
  scheduleKioskIdleTimer();
  renderKiosk();
}

function startKioskConfirmationTimer() {
  clearKioskIdleTimers();
  clearKioskConfirmationTimers();
  state.kiosk.resetRemaining = KIOSK_CONFIRMATION_RESET_SECONDS;
  renderKiosk();

  state.kiosk.resetInterval = window.setInterval(() => {
    state.kiosk.resetRemaining = Math.max(0, state.kiosk.resetRemaining - 1);
    const countdown = document.querySelector("#kioskCountdown");
    if (countdown) {
      countdown.textContent = `${state.kiosk.resetRemaining}s`;
    }
  }, 1000);

  state.kiosk.resetTimer = window.setTimeout(resetKioskSession, KIOSK_CONFIRMATION_RESET_SECONDS * 1000);
  updateKioskTimerDebug();
}

function resetKioskSession() {
  clearKioskIdleTimers();
  clearKioskConfirmationTimers();
  state.cart = [];
  state.cartFeedback = null;
  state.confirmation = null;
  state.orderSuccess = null;
  state.checkoutStep = "cart";
  state.paymentMethod = "pay_at_counter";
  state.orderIdempotencyKey = "";
  state.isSubmittingOrder = false;
  state.selectedCategory = "All";
  state.kiosk.screen = "welcome";
  state.kiosk.orderType = "";
  state.kiosk.paymentMethod = "pay_at_counter";
  state.kiosk.searchQuery = "";
  state.kiosk.customerName = "";
  state.kiosk.customerPhone = "";
  state.kiosk.submissionError = "";
  state.kiosk.idleWarning = false;
  state.kiosk.clearConfirm = false;
  state.kiosk.keyboard.activeField = "";
  state.kiosk.keyboard.nameCaps = true;
  saveCart();
  renderKiosk();
}

function setKioskScreen(screen) {
  state.kiosk.screen = screen;
  state.kiosk.submissionError = "";
  state.kiosk.clearConfirm = false;
  state.kiosk.idleWarning = false;
  if (screen !== "details") {
    state.kiosk.keyboard.activeField = "";
  }
  clearKioskIdleTimers();
  clearKioskConfirmationTimers();
  scheduleKioskIdleTimer();
  renderKiosk();
}

function kioskCartLineItems({ controls = true } = {}) {
  return state.cart
    .map(
      (item) => `
        <div class="kiosk-cart-line ${controls ? "has-controls" : "is-readonly"}">
          <div class="kiosk-cart-item-copy">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.category || "Menu")} - ${formatPrice(item.price)} each</span>
          </div>
          <div class="kiosk-cart-item-numbers">
            <span>Qty ${item.qty}</span>
            <strong>${formatPrice(item.price * item.qty)}</strong>
          </div>
          ${
            controls
              ? `<div class="kiosk-qty-control" aria-label="${escapeHtml(item.name)} quantity">
                  <button type="button" data-kiosk-qty="${item.id}" data-delta="-1" aria-label="Decrease ${escapeHtml(item.name)}">-</button>
                  <span>${item.qty}</span>
                  <button type="button" data-kiosk-qty="${item.id}" data-delta="1" aria-label="Increase ${escapeHtml(item.name)}">+</button>
                </div>`
              : ""
          }
        </div>
      `
    )
    .join("");
}

function kioskReceiptItemsMarkup(items = []) {
  return items
    .map(
      (item) => `
        <div class="kiosk-receipt-item">
          <span>${Number(item.qty || 0)} x ${escapeHtml(item.name)}</span>
          <small>${formatPrice(item.price)} each</small>
          <strong>${formatPrice(item.lineTotal)}</strong>
        </div>
      `
    )
    .join("");
}

function kioskTotalsMarkup(totals = cartTotals()) {
  return `
    <div class="kiosk-total-row"><span>Subtotal</span><strong>${formatPrice(totals.subtotal)}</strong></div>
    <div class="kiosk-total-row"><span>GST</span><strong>${formatPrice(totals.tax)}</strong></div>
    <div class="kiosk-total-row"><span>Packing</span><strong>${formatPrice(totals.packing)}</strong></div>
    <div class="kiosk-total-row kiosk-total-grand"><span>Total</span><strong>${formatPrice(totals.total)}</strong></div>
  `;
}

function kioskFilteredItems() {
  const search = state.kiosk.searchQuery.trim().toLowerCase();
  return menuItems.filter((item) => {
    const matchesCategory = state.selectedCategory === "All" || item.category === state.selectedCategory;
    const matchesSearch = !search || `${item.name} ${item.category}`.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });
}

function renderKioskHeader() {
  const orderStepLabels = {
    welcome: "Welcome",
    order_type: "Order type",
    menu: "Menu",
    details: "Details",
    payment: "Payment",
    review: "Review",
    confirmation: "Done",
  };

  return `
    <header class="kiosk-header">
      <div class="kiosk-brand">
        <img src="${escapeHtml(kioskLogoSrc())}" alt="${escapeHtml(kioskRestaurantName())} logo" draggable="false" />
        <div>
          <strong>${escapeHtml(kioskRestaurantName())}</strong>
          <span>${escapeHtml(orderStepLabels[state.kiosk.screen] || "Kiosk")}</span>
        </div>
      </div>
      ${
        state.kiosk.screen !== "welcome" && state.kiosk.screen !== "confirmation"
          ? `<button class="kiosk-ghost-btn" type="button" data-kiosk-action="start-over">Start over</button>`
          : ""
      }
    </header>
  `;
}

function renderKioskWelcome() {
  return `
    <section class="kiosk-welcome">
      <div class="kiosk-welcome-copy">
        <span class="kiosk-eyebrow">Self-order kiosk</span>
        <h1>${escapeHtml(kioskRestaurantName())}</h1>
        <p>Browse the live menu, place your order, and pay at the restaurant counter.</p>
        <button class="kiosk-primary-btn" type="button" data-kiosk-action="start">Start order</button>
      </div>
    </section>
  `;
}

function renderKioskOrderType() {
  return `
    <section class="kiosk-centered">
      <span class="kiosk-eyebrow">Step 1</span>
      <h1>How would you like your order?</h1>
      <div class="kiosk-choice-grid">
        <button type="button" data-kiosk-order-type="dine_in">
          <strong>Dine-in</strong>
          <span>Eat at the restaurant.</span>
        </button>
        <button type="button" data-kiosk-order-type="takeaway">
          <strong>Takeaway</strong>
          <span>Pick up from the counter.</span>
        </button>
      </div>
    </section>
  `;
}

function renderKioskMenuScreen() {
  const items = kioskFilteredItems();
  const totals = cartTotals();
  const menuBody =
    state.menuStatus === "loading"
      ? `<div class="kiosk-empty-state"><strong>Loading menu...</strong><span>Connecting to the restaurant system.</span></div>`
      : state.menuStatus === "empty"
      ? `<div class="kiosk-empty-state"><strong>No menu items available</strong><span>Please ask the counter team for help.</span></div>`
      : items.length
      ? items
          .map((item) => {
            const photo = photoForItem(item);
            const cartQty = cartQuantityForItem(item.id);
            const isAvailable = itemAvailable(item);
            return `
              <article class="kiosk-menu-item ${isAvailable ? "" : "is-unavailable"}">
                <div class="kiosk-item-photo">
                  <img
                    src="${escapeHtml(photo.src)}"
                    alt="${escapeHtml(photo.alt)}"
                    loading="lazy"
                    draggable="false"
                    onerror="this.onerror=null;this.src='${escapeHtml(MENU_IMAGE_FALLBACK_SRC)}';"
                  />
                </div>
                <div class="kiosk-item-content">
                  <span class="kiosk-item-category">${escapeHtml(item.category)}</span>
                  <h3>${escapeHtml(item.name)}</h3>
                  <strong class="kiosk-item-price">${formatPrice(item.price)}</strong>
                </div>
                <div class="kiosk-item-action">
                  ${
                    !isAvailable
                      ? `<button type="button" disabled>UNAVAILABLE</button>`
                      : cartQty
                      ? `<div class="kiosk-qty-control kiosk-card-qty">
                          <button type="button" data-kiosk-qty="${item.id}" data-delta="-1" aria-label="Decrease ${escapeHtml(item.name)}">-</button>
                          <span>${cartQty}</span>
                          <button type="button" data-kiosk-qty="${item.id}" data-delta="1" aria-label="Increase ${escapeHtml(item.name)}">+</button>
                        </div>`
                      : `<button type="button" data-kiosk-add="${item.id}">Add</button>`
                  }
                </div>
              </article>
            `;
          })
          .join("")
      : `<div class="kiosk-empty-state"><strong>No matching items</strong><span>Try another category or search.</span></div>`;

  return `
    <section class="kiosk-menu-layout">
      <aside class="kiosk-categories" aria-label="Menu categories">
        ${categories()
          .map(
            (category) => `
              <button class="${category === state.selectedCategory ? "is-active" : ""}" type="button" data-kiosk-category="${escapeHtml(category)}">
                ${escapeHtml(category)}
              </button>
            `
          )
          .join("")}
      </aside>
      <section class="kiosk-menu-panel">
        <div class="kiosk-panel-title">
          <div>
            <span class="kiosk-eyebrow">${escapeHtml(currentOrderTypeLabel())}</span>
            <h1>Choose items</h1>
          </div>
          <input id="kioskSearchInput" type="search" placeholder="Search menu" value="${escapeHtml(state.kiosk.searchQuery)}" autocomplete="off" />
        </div>
        ${state.menuError ? `<div class="kiosk-warning">${escapeHtml(friendlyNetworkError({ message: state.menuError }))}</div>` : ""}
        <div class="kiosk-menu-grid">${menuBody}</div>
      </section>
      <aside class="kiosk-cart-panel" aria-label="Current order">
        <div>
          <span class="kiosk-eyebrow">Your order</span>
          <h2>${totals.count} ${totals.count === 1 ? "item" : "items"}</h2>
        </div>
        <div class="kiosk-cart-lines">
          ${state.cart.length ? kioskCartLineItems() : `<div class="kiosk-empty-cart">Add items from the menu.</div>`}
        </div>
        <div class="kiosk-totals">${kioskTotalsMarkup(totals)}</div>
        <div class="kiosk-cart-actions">
          <button class="kiosk-secondary-btn" type="button" data-kiosk-action="clear-cart" ${state.cart.length ? "" : "disabled"}>Clear</button>
          <button class="kiosk-primary-btn kiosk-review-order-btn" type="button" data-kiosk-action="details" ${state.cart.length ? "" : "disabled"}>REVIEW ORDER</button>
        </div>
      </aside>
    </section>
  `;
}

function sanitizeKioskName(value = "") {
  return String(value)
    .replace(/[^a-zA-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, KIOSK_NAME_MAX_LENGTH);
}

function sanitizeKioskPhone(value = "") {
  const text = String(value).replace(/[^\d+]/g, "");
  const normalized = text.startsWith("+")
    ? `+${text.slice(1).replace(/\+/g, "")}`
    : text.replace(/\+/g, "");
  return normalized.slice(0, KIOSK_PHONE_MAX_LENGTH);
}

function kioskKeyboardValue(field) {
  return field === "phone" ? state.kiosk.customerPhone : state.kiosk.customerName;
}

function setKioskKeyboardValue(field, value) {
  if (field === "phone") {
    state.kiosk.customerPhone = sanitizeKioskPhone(value);
    return;
  }

  state.kiosk.customerName = sanitizeKioskName(value);
}

function activateKioskKeyboard(field) {
  if (!state.kiosk.enabled || state.kiosk.screen !== "details") return;
  if (state.kiosk.keyboard.activeField === field) {
    resetKioskActivity();
    return;
  }
  state.kiosk.keyboard.activeField = field;
  state.kiosk.submissionError = "";
  resetKioskActivity();
  renderKiosk();
}

function closeKioskKeyboard() {
  state.kiosk.keyboard.activeField = "";
  resetKioskActivity();
  renderKiosk();
}

function handleKioskKeyboardAction(action, key = "") {
  const field = state.kiosk.keyboard.activeField;
  if (!field) return;

  if (action === "done") {
    closeKioskKeyboard();
    return;
  }

  if (action === "caps") {
    state.kiosk.keyboard.nameCaps = !state.kiosk.keyboard.nameCaps;
    resetKioskActivity();
    renderKiosk();
    return;
  }

  const current = kioskKeyboardValue(field);

  if (action === "backspace") {
    setKioskKeyboardValue(field, current.slice(0, -1));
  } else if (action === "clear") {
    setKioskKeyboardValue(field, "");
  } else if (action === "space" && field === "name") {
    setKioskKeyboardValue(field, `${current} `);
  } else if (action === "key") {
    setKioskKeyboardValue(field, `${current}${key}`);
  }

  resetKioskActivity();
  renderKiosk();
}

function renderKioskKeyButton(label, attributes = "", extraClass = "") {
  return `<button class="${extraClass}" type="button" ${attributes}>${escapeHtml(label)}</button>`;
}

function renderKioskNameKeyboard() {
  const caps = state.kiosk.keyboard.nameCaps;
  const rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  return `
    <div class="kiosk-keyboard-keys kiosk-name-keyboard" aria-label="Name keyboard">
      ${rows
        .map(
          (row) => `
            <div class="kiosk-keyboard-row">
              ${row
                .split("")
                .map((letter) => {
                  const value = caps ? letter : letter.toLowerCase();
                  return renderKioskKeyButton(value, `data-kiosk-key-action="key" data-kiosk-key="${escapeHtml(value)}" aria-label="${escapeHtml(value)}"`);
                })
                .join("")}
            </div>
          `
        )
        .join("")}
      <div class="kiosk-keyboard-row kiosk-keyboard-actions">
        ${renderKioskKeyButton(caps ? "SHIFT" : "shift", 'data-kiosk-key-action="caps" aria-label="Toggle caps"')}
        ${renderKioskKeyButton("SPACE", 'data-kiosk-key-action="space" aria-label="Insert space"', "is-wide")}
        ${renderKioskKeyButton("BACKSPACE", 'data-kiosk-key-action="backspace" aria-label="Backspace"', "is-wide")}
        ${renderKioskKeyButton("CLEAR", 'data-kiosk-key-action="clear" aria-label="Clear name"')}
        ${renderKioskKeyButton("DONE", 'data-kiosk-key-action="done" aria-label="Close keyboard"', "is-done")}
      </div>
    </div>
  `;
}

function renderKioskPhoneKeyboard() {
  const rows = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["CLEAR", "0", "BACKSPACE", "DONE"],
  ];

  return `
    <div class="kiosk-keyboard-keys kiosk-phone-keyboard" aria-label="Phone keypad">
      ${rows
        .map(
          (row) => `
            <div class="kiosk-keyboard-row">
              ${row
                .map((key) => {
                  if (key === "BACKSPACE") {
                    return renderKioskKeyButton("BACKSPACE", 'data-kiosk-key-action="backspace" aria-label="Backspace"');
                  }
                  if (key === "CLEAR") {
                    return renderKioskKeyButton("CLEAR", 'data-kiosk-key-action="clear" aria-label="Clear phone"');
                  }
                  if (key === "DONE") {
                    return renderKioskKeyButton("DONE", 'data-kiosk-key-action="done" aria-label="Close keypad"', "is-done");
                  }
                  return renderKioskKeyButton(key, `data-kiosk-key-action="key" data-kiosk-key="${escapeHtml(key)}" aria-label="${key === "+" ? "Plus" : `Digit ${key}`}"`);
                })
                .join("")}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderKioskKeyboard() {
  const activeField = state.kiosk.keyboard.activeField;
  if (!activeField || state.kiosk.screen !== "details") return "";

  const isPhone = activeField === "phone";
  return `
    <div class="kiosk-keyboard-panel" aria-live="polite">
      <div class="kiosk-keyboard-title">
        <span>${isPhone ? "Phone keypad" : "Name keyboard"}</span>
        <strong>${escapeHtml(isPhone ? state.kiosk.customerPhone || "Enter phone" : state.kiosk.customerName || "Enter name")}</strong>
      </div>
      ${isPhone ? renderKioskPhoneKeyboard() : renderKioskNameKeyboard()}
    </div>
  `;
}

function renderKioskDetails() {
  const activeField = state.kiosk.keyboard.activeField;
  return `
    <section class="kiosk-form-screen kiosk-details-screen ${activeField ? "has-keyboard" : ""}">
      <span class="kiosk-eyebrow">Step 3</span>
      <h1>Customer details</h1>
      <div class="kiosk-form-grid">
        <label class="${activeField === "name" ? "is-active" : ""}">
          <span>Name</span>
          <input id="kioskCustomerName" type="text" value="${escapeHtml(state.kiosk.customerName)}" autocomplete="off" inputmode="none" maxlength="${KIOSK_NAME_MAX_LENGTH}" data-kiosk-field="name" aria-label="Customer name" />
        </label>
        <label class="${activeField === "phone" ? "is-active" : ""}">
          <span>Phone</span>
          <input id="kioskCustomerPhone" type="text" value="${escapeHtml(state.kiosk.customerPhone)}" autocomplete="off" inputmode="none" maxlength="${KIOSK_PHONE_MAX_LENGTH}" data-kiosk-field="phone" aria-label="Customer phone number" />
        </label>
      </div>
      ${state.kiosk.submissionError ? `<div class="kiosk-error">${escapeHtml(state.kiosk.submissionError)}</div>` : ""}
      <div class="kiosk-step-actions">
        <button class="kiosk-secondary-btn" type="button" data-kiosk-action="menu">Back</button>
        <button class="kiosk-primary-btn" type="button" data-kiosk-action="payment">Continue</button>
      </div>
      ${renderKioskKeyboard()}
    </section>
  `;
}

function renderKioskPayment() {
  state.kiosk.paymentMethod = "pay_at_counter";
  state.paymentMethod = "pay_at_counter";

  return `
    <section class="kiosk-form-screen">
      <span class="kiosk-eyebrow">Step 4</span>
      <h1>Payment</h1>
      <div class="kiosk-payment-card is-selected">
        <span class="kiosk-payment-label">PAY AT COUNTER</span>
        <strong>Pay at restaurant counter</strong>
        <span>Your order will be saved now. The counter team will collect payment at the counter.</span>
      </div>
      <div class="kiosk-step-actions">
        <button class="kiosk-secondary-btn" type="button" data-kiosk-action="details">Back</button>
        <button class="kiosk-primary-btn" type="button" data-kiosk-action="review">Review order</button>
      </div>
    </section>
  `;
}

function renderKioskReview() {
  const totals = cartTotals();
  return `
    <section class="kiosk-review-screen">
      <div class="kiosk-review-main">
        <span class="kiosk-eyebrow">Step 5</span>
        <h1>Review order</h1>
        <div class="kiosk-review-meta">
          <span>Order type: ${escapeHtml(currentOrderTypeLabel())}</span>
          <span>${escapeHtml(state.kiosk.customerName)}</span>
          <span>${escapeHtml(state.kiosk.customerPhone)}</span>
          <span>Payment: PAY AT COUNTER</span>
        </div>
        <div class="kiosk-review-items">${kioskCartLineItems({ controls: false })}</div>
      </div>
      <aside class="kiosk-review-total">
        ${kioskTotalsMarkup(totals)}
        ${state.kiosk.submissionError ? `<div class="kiosk-error">${escapeHtml(state.kiosk.submissionError)}</div>` : ""}
        <button class="kiosk-primary-btn" type="button" data-kiosk-action="place-order" ${state.isSubmittingOrder ? "disabled" : ""}>
          ${state.isSubmittingOrder ? "Placing order..." : "Place Order"}
        </button>
        <button class="kiosk-secondary-btn" type="button" data-kiosk-action="payment" ${state.isSubmittingOrder ? "disabled" : ""}>Back</button>
      </aside>
    </section>
  `;
}

function renderKioskConfirmation() {
  const snapshot = state.confirmation || {};
  const totals = snapshot.totals || cartTotals();
  return `
    <section class="kiosk-confirmation">
      <div class="kiosk-success-mark" aria-hidden="true">OK</div>
      <span class="kiosk-eyebrow">ORDER CONFIRMED</span>
      <h1>${snapshot.orderLabel ? `Order ID ${escapeHtml(snapshot.orderLabel)}` : "Order ID pending"}</h1>
      <p>Please pay at the restaurant counter. The team has received your order.</p>
      <div class="kiosk-receipt">
        <div><span>Order type</span><strong>${escapeHtml(snapshot.orderType || currentOrderTypeLabel())}</strong></div>
        <div><span>Payment method</span><strong>${escapeHtml(snapshot.paymentMethod || "Pay at Restaurant Counter")}</strong></div>
        <div><span>Name</span><strong>${escapeHtml(snapshot.customerName || "")}</strong></div>
        <div class="kiosk-receipt-items">${kioskReceiptItemsMarkup(snapshot.items || [])}</div>
        <div><span>Subtotal</span><strong>${formatPrice(totals.subtotal)}</strong></div>
        <div><span>GST</span><strong>${formatPrice(totals.tax)}</strong></div>
        <div><span>Packing</span><strong>${formatPrice(totals.packing)}</strong></div>
        <div class="kiosk-receipt-total"><span>Grand total</span><strong>${formatPrice(totals.total)}</strong></div>
      </div>
      <button class="kiosk-primary-btn" type="button" data-kiosk-action="new-order">START NEW ORDER</button>
      <span class="kiosk-countdown">Resetting in <b id="kioskCountdown">${state.kiosk.resetRemaining || KIOSK_CONFIRMATION_RESET_SECONDS}s</b></span>
    </section>
  `;
}

function renderKioskOverlay() {
  if (state.kiosk.clearConfirm) {
    return `
      <div class="kiosk-modal-backdrop">
        <div class="kiosk-modal">
          <h2>Clear this order?</h2>
          <p>${state.kiosk.clearConfirm === "session" ? "This will remove all current customer details and cart items." : "This will remove every item from the current order."}</p>
          <div>
            <button class="kiosk-secondary-btn" type="button" data-kiosk-action="cancel-clear">No</button>
            <button class="kiosk-primary-btn" type="button" data-kiosk-action="confirm-clear">Yes</button>
          </div>
        </div>
      </div>
    `;
  }

  if (state.kiosk.idleWarning) {
    return `
      <div class="kiosk-modal-backdrop">
        <div class="kiosk-modal kiosk-idle-dialog">
          <h2>Are you still there?</h2>
          <p>This kiosk will reset soon to protect your order details.</p>
          <div>
            <button class="kiosk-primary-btn" type="button" data-kiosk-action="continue-session">Continue</button>
            <button class="kiosk-secondary-btn" type="button" data-kiosk-action="new-order">Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  return "";
}

function renderKiosk() {
  if (!state.kiosk.enabled) return;

  const main = document.querySelector("main");
  if (!main) return;

  applyKioskDisplayMode();
  document.title = `${kioskRestaurantName()} Kiosk | Customer Ordering`;
  const screens = {
    welcome: renderKioskWelcome,
    order_type: renderKioskOrderType,
    menu: renderKioskMenuScreen,
    details: renderKioskDetails,
    payment: renderKioskPayment,
    review: renderKioskReview,
    confirmation: renderKioskConfirmation,
  };
  const renderScreen = screens[state.kiosk.screen] || renderKioskWelcome;

  main.innerHTML = `
    <div class="kiosk-app kiosk-layout-${escapeHtml(kioskResolvedDisplayMode())}" data-kiosk-screen="${escapeHtml(state.kiosk.screen)}" data-kiosk-display-mode="${escapeHtml(kioskConfiguredDisplayMode())}">
      ${renderKioskHeader()}
      ${renderScreen()}
      ${renderKioskOverlay()}
    </div>
  `;

  restoreKioskActiveFieldFocus();
}

function validateKioskDetails() {
  const name = document.querySelector("#kioskCustomerName")?.value?.trim() || state.kiosk.customerName.trim();
  const phone = normalizePhone(document.querySelector("#kioskCustomerPhone")?.value || state.kiosk.customerPhone);

  state.kiosk.customerName = name;
  state.kiosk.customerPhone = phone;

  if (!name) {
    state.kiosk.submissionError = "Please enter your name.";
    state.kiosk.keyboard.activeField = "name";
    renderKiosk();
    return false;
  }

  if (!phone || phone.replace(/\D/g, "").length < 7) {
    state.kiosk.submissionError = "Enter a valid phone number.";
    state.kiosk.keyboard.activeField = "phone";
    renderKiosk();
    return false;
  }

  return true;
}

async function placeKioskOrder() {
  if (state.isSubmittingOrder) return;
  if (!state.cart.length) {
    state.kiosk.submissionError = "Add at least one item before placing the order.";
    renderKiosk();
    return;
  }
  if (!validateKioskDetails()) return;

  state.isSubmittingOrder = true;
  state.kiosk.submissionError = "";
  state.paymentMethod = "pay_at_counter";
  renderKiosk();

  try {
    const customer = await findOrCreateCustomer({
      name: state.kiosk.customerName,
      phone: state.kiosk.customerPhone,
    });
    const result = await handleOfflinePayment(customer);
    const order = result.order || result;
    console.info("[KIOSK_PRINT] order created", {
      orderId: order?.id || order?.restaurant_order_id || order?.order_id || null,
      orderNumber: order?.order_number || null,
      kioskEnabled: state.kiosk.enabled,
      tableQrEnabled: state.tableQr.enabled,
    });
    completeOrderSuccess({
      order,
      message: "Your kiosk order was sent to the restaurant.",
      customer,
    });
    state.kiosk.screen = "confirmation";
    state.isSubmittingOrder = false;
    startKioskConfirmationTimer();
    requestKioskReceiptPrint(order);
  } catch (error) {
    state.isSubmittingOrder = false;
    state.kiosk.submissionError = `We could not place this order. Nothing was cleared. ${friendlyNetworkError(error)} Please try again.`;
    renderKiosk();
  }
}

function handleKioskClick(event) {
  const keyboardButton = event.target.closest("[data-kiosk-key-action]");
  if (keyboardButton) {
    handleKioskKeyboardAction(keyboardButton.dataset.kioskKeyAction, keyboardButton.dataset.kioskKey || "");
    return;
  }

  const orderTypeButton = event.target.closest("[data-kiosk-order-type]");
  if (orderTypeButton) {
    state.kiosk.orderType = orderTypeButton.dataset.kioskOrderType;
    setKioskScreen("menu");
    return;
  }

  const categoryButton = event.target.closest("[data-kiosk-category]");
  if (categoryButton) {
    state.selectedCategory = categoryButton.dataset.kioskCategory;
    renderKiosk();
    resetKioskActivity();
    return;
  }

  const addButton = event.target.closest("[data-kiosk-add]");
  if (addButton) {
    const item = menuItems.find((menuItem) => menuItem.id === Number(addButton.dataset.kioskAdd));
    if (item) addItemToCart(item, 1);
    resetKioskActivity();
    return;
  }

  const qtyButton = event.target.closest("[data-kiosk-qty][data-delta]");
  if (qtyButton) {
    changeQty(Number(qtyButton.dataset.kioskQty), Number(qtyButton.dataset.delta));
    resetKioskActivity();
    return;
  }

  const actionButton = event.target.closest("[data-kiosk-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.kioskAction;
  if (action === "start") setKioskScreen("order_type");
  if (action === "menu") setKioskScreen("menu");
  if (action === "details" && state.cart.length) setKioskScreen("details");
  if (action === "payment" && validateKioskDetails()) setKioskScreen("payment");
  if (action === "review") setKioskScreen("review");
  if (action === "place-order") placeKioskOrder();
  if (action === "clear-cart") {
    state.kiosk.keyboard.activeField = "";
    state.kiosk.clearConfirm = "cart";
    renderKiosk();
  }
  if (action === "start-over") {
    state.kiosk.keyboard.activeField = "";
    state.kiosk.clearConfirm = "session";
    renderKiosk();
  }
  if (action === "cancel-clear") {
    state.kiosk.clearConfirm = false;
    renderKiosk();
    scheduleKioskIdleTimer();
  }
  if (action === "confirm-clear") {
    if (state.kiosk.clearConfirm === "session") {
      resetKioskSession();
    } else {
      state.cart = [];
      state.cartFeedback = null;
      state.orderSuccess = null;
      state.confirmation = null;
      state.kiosk.clearConfirm = false;
      state.kiosk.keyboard.activeField = "";
      saveCart();
      renderKiosk();
      scheduleKioskIdleTimer();
    }
  }
  if (action === "continue-session") continueKioskSession();
  if (action === "new-order") resetKioskSession();
}

function handleKioskInput(event) {
  if (event.target.id === "kioskSearchInput") {
    state.kiosk.searchQuery = event.target.value;
    renderKiosk();
    return;
  }
  if (event.target.id === "kioskCustomerName") {
    const sanitized = sanitizeKioskName(event.target.value);
    event.target.value = sanitized;
    state.kiosk.customerName = sanitized;
    state.kiosk.keyboard.activeField = "name";
  }
  if (event.target.id === "kioskCustomerPhone") {
    const sanitized = sanitizeKioskPhone(event.target.value);
    event.target.value = sanitized;
    state.kiosk.customerPhone = sanitized;
    state.kiosk.keyboard.activeField = "phone";
  }
  resetKioskActivity();
}

function handleKioskFocus(event) {
  const field = event.target.dataset?.kioskField;
  if (field === "name" || field === "phone") {
    activateKioskKeyboard(field);
  }
}

function restoreKioskActiveFieldFocus() {
  if (!state.kiosk.enabled || state.kiosk.screen !== "details" || !state.kiosk.keyboard.activeField) return;

  window.requestAnimationFrame(() => {
    const input = document.querySelector(`[data-kiosk-field="${state.kiosk.keyboard.activeField}"]`);
    input?.focus({ preventScroll: true });
    input?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function updateKioskTimerDebug() {
  window.restaurantKioskTimerDebug = {
    menuRefreshTimerCount: state.kiosk.menuRefreshTimer ? 1 : 0,
    settingsRefreshTimerCount: state.kiosk.settingsRefreshTimer ? 1 : 0,
    idleTimerCount: state.kiosk.idleTimer ? 1 : 0,
    idleGraceTimerCount: state.kiosk.idleGraceTimer ? 1 : 0,
    confirmationIntervalCount: state.kiosk.resetInterval ? 1 : 0,
    confirmationResetTimerCount: state.kiosk.resetTimer ? 1 : 0,
  };
}

function clearKioskPollingTimers() {
  window.clearInterval(state.kiosk.menuRefreshTimer);
  window.clearInterval(state.kiosk.settingsRefreshTimer);
  state.kiosk.menuRefreshTimer = null;
  state.kiosk.settingsRefreshTimer = null;
  updateKioskTimerDebug();
}

function startKioskPolling() {
  clearKioskPollingTimers();
  state.kiosk.menuRefreshTimer = window.setInterval(() => loadLiveMenu({ background: true }), 60000);
  state.kiosk.settingsRefreshTimer = window.setInterval(() => loadPublicSettings({ background: true }), 5000);
  updateKioskTimerDebug();
}

function handleKioskWindowFocus() {
  loadPublicSettings({ background: true });
}

function bindKioskEvents() {
  if (state.kiosk.eventsBound) return;
  state.kiosk.eventsBound = true;

  const main = document.querySelector("main");
  main?.addEventListener("click", handleKioskClick);
  main?.addEventListener("input", handleKioskInput);
  main?.addEventListener("focusin", handleKioskFocus);
  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, resetKioskActivity, { passive: true });
  });
  document.addEventListener("contextmenu", handleKioskContextMenu);
  document.addEventListener("mousedown", handleKioskMouseDown);
  document.addEventListener("dragstart", handleKioskDragStart);
  window.addEventListener("resize", handleKioskOrientationChange);
  window.addEventListener("orientationchange", handleKioskOrientationChange);
  window.addEventListener("focus", handleKioskWindowFocus);
  window.addEventListener("beforeunload", clearKioskPollingTimers, { once: true });
}

function startKioskMode() {
  if (state.kiosk.initialized) return;
  state.kiosk.initialized = true;

  document.body.classList.add("kiosk-mode");
  applyKioskDisplayMode();
  loadKioskReceiptPrintMemory();
  document.querySelector(".site-header")?.remove();
  document.querySelector(".site-footer")?.remove();
  document.querySelector(".chat-widget")?.remove();
  state.cart = [];
  state.orderSuccess = null;
  state.confirmation = null;
  state.paymentMethod = "pay_at_counter";
  state.kiosk.paymentMethod = "pay_at_counter";
  bindKioskEvents();
  renderKiosk();
  loadPublicSettings();
  updateMenuStats();
  restoreCart();
  loadPaymentMethods();
  loadLiveMenu();
  startKioskPolling();
}

function bindEvents() {
  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.selectedCategory = button.dataset.category;
    renderFilters();
    renderMenu();
  });

  elements.menuGrid.addEventListener("click", (event) => {
    const retryButton = event.target.closest("[data-retry-menu]");
    if (retryButton) {
      loadLiveMenu();
      return;
    }

    const qtyButton = event.target.closest("[data-menu-id][data-menu-delta]");
    if (qtyButton) {
      changeQty(Number(qtyButton.dataset.menuId), Number(qtyButton.dataset.menuDelta));
      return;
    }

    const button = event.target.closest("[data-menu-add]");
    if (!button) return;
    addToCart(Number(button.dataset.menuAdd), button);
  });

  elements.cartItems.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-id][data-remove]");
    if (removeButton) {
      removeCartItem(Number(removeButton.dataset.id));
      return;
    }

    const button = event.target.closest("[data-id][data-delta]");
    if (!button) return;
    changeQty(Number(button.dataset.id), Number(button.dataset.delta));
  });

  elements.searchInput.addEventListener("input", renderMenu);
  elements.clearCart.addEventListener("click", clearCart);
  elements.customerName.addEventListener("input", renderCart);
  elements.customerPhone.addEventListener("input", () => {
    renderCart();
    saveCustomerPhone(elements.customerPhone.value);
  });
  elements.orderType.addEventListener("change", renderCart);
  elements.paymentMethods?.addEventListener("change", () => {
    state.paymentMethod = selectedPaymentMethod();
    updatePlaceOrderButtonText();
  });

  elements.placeOrder.addEventListener("click", placeOrder);
  elements.chatToggle.addEventListener("click", () => {
    document.querySelector("#ai").scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => {
      elements.chatInput.focus();
    }, 450);
  });

  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = elements.chatInput.value.trim();
    if (!question) return;
    elements.chatInput.value = "";
    askChatbot(question);
  });

  elements.chatPrompts.addEventListener("click", (event) => {
    const button = event.target.closest("[data-question]");
    if (!button) return;
    askChatbot(button.dataset.question);
  });

  elements.voiceButton.addEventListener("click", async () => {
    if (!state.recognition) {
      showToast(voiceSupportProblem() || "Voice input is not supported in this browser.");
      return;
    }

    if (state.isListening) {
      state.recognition.stop();
    } else {
      try {
        elements.voiceButton.disabled = true;
        setChatStatus("Requesting microphone...");
        await requestMicrophonePermission();
        elements.voiceButton.disabled = false;
        state.recognition.start();
      } catch (error) {
        elements.voiceButton.disabled = false;
        const message =
          error?.name === "NotAllowedError"
            ? "Microphone permission was blocked. Allow microphone access in the browser address bar."
            : "Voice input is already starting or unavailable. Please try again.";
        showToast(message);
        setChatStatus(message);
      }
    }
  });

  elements.voiceToggle.addEventListener("click", () => {
    state.voiceReply = !state.voiceReply;
    elements.voiceToggle.textContent = `Voice reply: ${state.voiceReply ? "On" : "Off"}`;
    elements.voiceToggle.setAttribute("aria-pressed", String(state.voiceReply));

    if (!state.voiceReply && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  });
}

function setupActiveNavigation() {
  const navLinks = Array.from(document.querySelectorAll(".main-nav a[href^='#']"));
  const navTargets = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  let activeSection = "home";

  if (!navLinks.length || !navTargets.length) {
    return;
  }

  const setActiveLink = (sectionId) => {
    activeSection = sectionId;

    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeSection}`;
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const currentSectionFromScroll = () => {
    const activationLine = window.innerHeight * 0.38;

    return navTargets.reduce((current, section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= activationLine && rect.bottom > activationLine) {
        return section;
      }

      return current;
    }, navTargets[0]);
  };

  if (!("IntersectionObserver" in window)) {
    setActiveLink(currentSectionFromScroll().id);
    return;
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      setActiveLink(link.getAttribute("href").slice(1));
    });
  });

  const visibleSections = new Map();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleSections.set(entry.target.id, entry);
        } else {
          visibleSections.delete(entry.target.id);
        }
      });

      const activeEntry = Array.from(visibleSections.values()).sort((a, b) => {
        return b.intersectionRatio - a.intersectionRatio;
      })[0];

      if (activeEntry) {
        setActiveLink(activeEntry.target.id);
      }
    },
    {
      rootMargin: "-20% 0px -45% 0px",
      threshold: [0.15, 0.3, 0.45, 0.6],
    }
  );

  navTargets.forEach((section) => observer.observe(section));

  const hashTarget = window.location.hash ? document.querySelector(window.location.hash) : null;
  const currentSection = navTargets
    .filter((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= window.innerHeight * 0.45 && rect.bottom > 0;
    })
    .at(-1);

  if (hashTarget) {
    setActiveLink(hashTarget.id);
  } else if (currentSection) {
    setActiveLink(currentSection.id);
  } else {
    setActiveLink("home");
  }
}

function trackingTokenFromPath() {
  const match = window.location.pathname.match(/\/track-order\/([A-Za-z0-9_-]+)/);
  return match?.[1] || "";
}

function renderTrackingShell() {
  document.querySelector(".site-header")?.remove();
  document.querySelector(".site-footer")?.remove();
  document.querySelector("main").innerHTML = `
    <section class="tracking-page">
      <div class="tracking-card">
        <span class="eyebrow">Live order tracking</span>
        <h1 id="trackingTitle">Loading your order...</h1>
        <p id="trackingMeta">Please wait while we fetch the latest restaurant status.</p>
        <div id="trackingTimeline" class="tracking-timeline"></div>
        <div id="trackingItems" class="tracking-items"></div>
        <p id="trackingUpdated" class="tracking-updated"></p>
      </div>
    </section>
  `;
}

function statusText(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderTrackedOrder(data) {
  const title = document.querySelector("#trackingTitle");
  const meta = document.querySelector("#trackingMeta");
  const timeline = document.querySelector("#trackingTimeline");
  const items = document.querySelector("#trackingItems");
  const updated = document.querySelector("#trackingUpdated");
  if (!title || !meta || !timeline || !items || !updated) return;

  title.textContent = `Order #${data.orderNumber}`;
  meta.textContent = `${data.customerFirstName} • ${data.maskedPhone} • ${statusText(data.orderType)} • Payment ${data.paymentStatus || "Pending"}`;

  const currentIndex = data.timeline.indexOf(data.currentStatus);
  timeline.innerHTML = data.timeline
    .map((status, index) => {
      const isDone = currentIndex >= index || data.currentStatus === "completed";
      const isCurrent = data.currentStatus === status;
      return `<div class="tracking-step ${isDone ? "is-done" : ""} ${isCurrent ? "is-current" : ""}">
        <span></span><strong>${escapeHtml(statusText(status))}</strong>
      </div>`;
    })
    .join("");

  if (data.currentStatus === "cancelled") {
    timeline.innerHTML = `<div class="tracking-cancelled"><strong>Cancelled</strong><span>${escapeHtml(data.cancellationReason || "Please contact the restaurant.")}</span></div>`;
  }

  items.innerHTML = `
    <h2>Items</h2>
    ${(data.items || [])
      .map((item) => `<div><span>${escapeHtml(item.name)} x${Number(item.quantity || 0)}</span><strong>${formatPrice(item.total_price)}</strong></div>`)
      .join("")}
    ${data.estimatedReadyAt ? `<p>Estimated ready: ${new Date(data.estimatedReadyAt).toLocaleString()}</p>` : ""}
  `;
  updated.textContent = `Last updated ${data.lastUpdatedAt ? new Date(data.lastUpdatedAt).toLocaleString() : "just now"}`;
}

async function loadTrackedOrder(token) {
  const data = await requestJson(`/orders/track/${encodeURIComponent(token)}`);
  renderTrackedOrder(data);
}

function startTrackingPage() {
  const token = trackingTokenFromPath();
  if (!token) return false;

  renderTrackingShell();
  loadTrackedOrder(token).catch((error) => {
    document.querySelector("#trackingTitle").textContent = "Tracking link unavailable";
    document.querySelector("#trackingMeta").textContent = error.message || "Please check the link and try again.";
  });

  try {
    const source = new EventSource(apiUrl(`/orders/track/${encodeURIComponent(token)}/events`));
    source.addEventListener("order", (event) => {
      renderTrackedOrder(JSON.parse(event.data));
    });
    source.onerror = () => {
      source.close();
      window.setInterval(() => loadTrackedOrder(token).catch(() => {}), 15000);
    };
  } catch {
    window.setInterval(() => loadTrackedOrder(token).catch(() => {}), 15000);
  }

  return true;
}

if (startTrackingPage()) {
  loadPublicSettings();
} else if (state.kiosk.enabled) {
  startKioskMode();
} else {
  if (state.tableQr.enabled) {
    document.body.classList.add("table-qr-mode");
  }
  loadPublicSettings();
  updateMenuStats();
  restoreCart();
  renderFilters();
  renderMenu();
  renderCart();
  bindEvents();
  setupActiveNavigation();
  setupVoiceSystem();
  startCustomerNotificationPolling();
  loadPaymentMethods();
  resolveTableQrContext();
  loadLiveMenu();
  window.setInterval(loadLiveMenu, 60000);
  window.setInterval(loadPublicSettings, 5000);
  window.addEventListener("focus", loadPublicSettings);
}
