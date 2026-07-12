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

const state = {
  selectedCategory: "All",
  cart: [],
  cartFeedback: null,
  orderSuccess: null,
  menuStatus: "loading",
  menuError: "",
  voiceReply: true,
  recognition: null,
  isListening: false,
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

const DEFAULT_API_BASE_URL = "http://localhost:5001/api";
const LEGACY_API_BASE_URL = "http://localhost:5001/api";
const storedApiBaseUrl = localStorage.getItem("restaurantApiBaseUrl");
const configuredApiBaseUrl = window.RESTAURANT_API_BASE_URL || DEFAULT_API_BASE_URL;
const API_BASE_URLS = [
  configuredApiBaseUrl,
  DEFAULT_API_BASE_URL,
  storedApiBaseUrl,
  LEGACY_API_BASE_URL,
]
  .filter(Boolean)
  .map((url) => url.replace(/\/$/, ""))
  .filter((url, index, urls) => urls.indexOf(url) === index);
let API_BASE_URL = API_BASE_URLS[0];
const CART_STORAGE_KEY = "restaurantai_cart";
const GST_RATE = 0.05;
const PACKING_CHARGE = 10;

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

function formatPrice(value) {
  return `Rs. ${Number(value || 0).toFixed(0)}`;
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart));
}

function restoreCart() {
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
  return {
    id: Number(item.id || item.menu_id || index + 1),
    name: item.name || item.item_name || item.menu_name || `Menu Item ${index + 1}`,
    category: item.category_name || item.category || "Uncategorized",
    price: Number(item.price || 0),
    image: item.image || item.image_url || "",
    description: item.description || "",
  };
}

function updateMenuStats() {
  const trustStats = document.querySelectorAll(".trust-row span");
  if (trustStats[0]) trustStats[0].textContent = `${menuItems.length} menu items`;
  if (trustStats[1]) trustStats[1].textContent = `${Math.max(categories().length - 1, 0)} categories`;
}

async function loadLiveMenu() {
  state.menuStatus = "loading";
  state.menuError = "";
  renderFilters();
  renderMenu();

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

    if (!availableItems.length) {
      menuItems = [];
      state.menuStatus = "empty";
      updateMenuStats();
      renderFilters();
      renderMenu();
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
    renderFilters();
    renderMenu();
    renderCart();
  } catch (error) {
    menuItems = [];
    state.menuStatus = "error";
    state.menuError = error.message || "Unable to load menu.";
    updateMenuStats();
    renderFilters();
    renderMenu();
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
      return `
        <article class="menu-card">
          <div class="item-photo">
            <img
              src="${escapeHtml(photo.src)}"
              alt="${escapeHtml(photo.alt)}"
              loading="lazy"
              onerror="this.onerror=null;this.src='assets/hero-food.png';"
            />
          </div>
          <div class="menu-card-body">
            <span class="category-label">${escapeHtml(item.category)}</span>
            <h3>${escapeHtml(item.name)}</h3>
            <div class="menu-meta">
              <span class="price">${formatPrice(item.price)}</span>
              ${
                cartQty
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
  const item = menuItems.find((menuItem) => menuItem.id === itemId);
  if (!item) return;

  addItemToCart(item, 1);
  triggerClass(button, "is-added", 240);
  showToast(`✓ ${item.name} added to cart`, formatPrice(item.price), "success");
}

function addItemToCart(item, quantity = 1) {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  state.orderSuccess = null;
  const existing = state.cart.find((cartItem) => cartItem.id === item.id);
  if (existing) {
    existing.qty += safeQuantity;
  } else {
    state.cart.push({ ...item, qty: safeQuantity });
  }

  state.cartFeedback = { itemId: item.id, type: "updated" };
  saveCart();
  renderCart();
  renderMenu();
}

function changeQty(itemId, delta) {
  const existing = state.cart.find((item) => item.id === itemId);
  if (!existing) return;

  if (delta < 0 && existing.qty <= 1) {
    removeCartItem(itemId);
    return;
  }

  state.cart = state.cart
    .map((item) => (item.id === itemId ? { ...item, qty: item.qty + delta } : item))
    .filter((item) => item.qty > 0);
  state.cartFeedback = { itemId, type: "updated" };
  saveCart();
  renderCart();
  renderMenu();
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

function orderMessage() {
  const { subtotal, tax, packing, total } = cartTotals();
  const name = elements.customerName.value.trim() || "Customer";
  const phone = elements.customerPhone.value.trim() || "Not provided";
  const orderType = elements.orderType.value;

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

function renderCart() {
  const { count, subtotal, tax, packing, total } = cartTotals();
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
    elements.placeOrder.disabled = false;
    elements.cartHint.textContent = state.orderSuccess
      ? "Your order is saved in PostgreSQL and ready for the restaurant team."
      : "Add at least one item before sending an order request.";
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

  elements.cartHint.textContent = "Check your name and phone before sending the order request.";
}

function clearCart() {
  if (!state.cart.length) {
    showToast("Cart is already empty", "Add items from the menu to start an order.", "info");
    return;
  }

  elements.cartItems.querySelectorAll(".cart-line").forEach((line) => {
    line.classList.add("is-removing");
  });

  window.setTimeout(() => {
    state.cart = [];
    state.orderSuccess = null;
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

async function placeOrder() {
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

  elements.placeOrder.disabled = true;
  elements.placeOrder.textContent = "Sending...";

  try {
    const customer = await findOrCreateCustomer({ name, phone });
    const order = await requestJson("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customer.id,
        payment_method: "Cash",
        special_instructions: `Order type: ${elements.orderType.value}`,
        items: state.cart.map((item) => ({
          menu_id: item.id,
          quantity: item.qty,
        })),
      }),
    });

    const orderLabel = order.order_number || order.id || "";
    state.cart = [];
    state.orderSuccess = orderLabel
      ? `Order ${orderLabel} was sent to the restaurant.`
      : "Your order was sent to the restaurant.";
    saveCart();
    renderCart();
    renderMenu();
    showToast("Order saved", state.orderSuccess, "success");
  } catch (error) {
    showToast("Unable to place order", error.message || "Please try again.", "warning");
  } finally {
    elements.placeOrder.disabled = false;
    elements.placeOrder.textContent = "Send order request";
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

function quantityFromText(value) {
  const normalized = String(value).toLowerCase();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return quantityWords[normalized] || 1;
}

function isCartIntent(question) {
  return /\b(add|order|want|need|get|give me|put|cart|i'll have|ill have|can i get|send me)\b/i.test(question);
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
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);
}

function extractCartRequests(question) {
  if (!isCartIntent(question)) return [];

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
  return menuItems
    .map((item) => ({ item, score: scoreMenuMatch(item, phrase) }))
    .filter((match) => match.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.length - b.item.name.length;
    })[0]?.item || null;
}

function cartSummaryText(prefix = "Done! Your cart now has:") {
  const { total } = cartTotals();
  const lines = state.cart.map((item) => `${item.qty} x ${item.name}`);
  return `${prefix}\n${lines.join("\n")}\nTotal: ${formatPrice(total)}`;
}

function handleCartAction(question) {
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
  if (data.type === "database_fallback") return "Live menu fallback";
  return "Backend RAG answered";
}

async function askChatbot(question) {
  addChatMessage("user", question);

  const cartActionAnswer = handleCartAction(question);
  if (cartActionAnswer) {
    addChatMessage("bot", cartActionAnswer);
    setChatStatus("Cart updated by AI");
    speakAnswer(cartActionAnswer);
    return;
  }

  const pendingMessage = addChatMessage("bot", "Searching MAHESH menu knowledge...");
  setChatStatus("Checking backend RAG...");

  try {
    const response = await fetchApi("/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
    });

    if (!response.ok) {
      throw new Error("AI assistant API failed");
    }

    const data = await response.json();
    const answer = backendAnswer(data);
    if (!answer) {
      throw new Error("AI service returned an empty answer");
    }
    pendingMessage.textContent = answer;
    setChatStatus(chatStatusForResponse(data));
    speakAnswer(answer);
  } catch (error) {
    const answer = "The backend AI service is unavailable right now. Please start the RAG/Gemini service and try again.";
    pendingMessage.textContent = answer;
    setChatStatus("Backend AI unavailable");
    speakAnswer(answer);
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
  elements.customerPhone.addEventListener("input", renderCart);
  elements.orderType.addEventListener("change", renderCart);

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

updateMenuStats();
restoreCart();
renderFilters();
renderMenu();
renderCart();
bindEvents();
setupActiveNavigation();
setupVoiceSystem();
loadLiveMenu();
