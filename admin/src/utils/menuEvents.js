const MENU_UPDATED_EVENT = "restaurantai:menu-updated";
const MENU_UPDATED_STORAGE_KEY = "restaurantai_menu_updated_at";

export function publishMenuUpdated() {
  const timestamp = String(Date.now());

  try {
    localStorage.setItem(MENU_UPDATED_STORAGE_KEY, timestamp);
  } catch {
    // Storage can be unavailable in private/browser-restricted contexts.
  }

  window.dispatchEvent(new CustomEvent(MENU_UPDATED_EVENT, { detail: { timestamp } }));
}

export function subscribeToMenuUpdates(callback) {
  const handleMenuUpdated = () => callback();
  const handleStorage = (event) => {
    if (event.key === MENU_UPDATED_STORAGE_KEY) {
      callback();
    }
  };

  window.addEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(MENU_UPDATED_EVENT, handleMenuUpdated);
    window.removeEventListener("storage", handleStorage);
  };
}
