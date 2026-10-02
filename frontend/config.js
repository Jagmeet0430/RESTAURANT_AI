// Runtime customer-site configuration.
// Define RESTAURANTAI_API_BASE_URL before this script to override the default.
(function () {
  const host = window.location.hostname.toLowerCase();
  const isLocalHost = (hostname) =>
    ["", "localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const isLocal = isLocalHost(host);
  const productionBase = "https://restaurant-ai-4myq.onrender.com/api";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const defaultBase = isLocal
    ? `${protocol}//${host || "localhost"}:5001/api`
    : productionBase;
  let configuredBase = window.RESTAURANTAI_API_BASE_URL;

  try {
    const configuredUrl = new URL(configuredBase);
    if (!/^https?:$/.test(configuredUrl.protocol) ||
        (!isLocal && (isLocalHost(configuredUrl.hostname) || configuredUrl.protocol !== "https:"))) {
      configuredBase = "";
    }
  } catch {
    configuredBase = "";
  }

  window.RESTAURANTAI_API_BASE_URL = (configuredBase || defaultBase).replace(/\/+$/, "");
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    const logUrl = new URL(window.RESTAURANTAI_API_BASE_URL);
    console.log("RestaurantAI API:", logUrl.origin + logUrl.pathname);
  }
})();
