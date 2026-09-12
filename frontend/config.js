// Runtime customer-site configuration.
// For LAN clients, set this to "http://SERVER-LAN-IP:5001/api".
(function () {
  const host = window.location.hostname;

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.");

  window.RESTAURANTAI_API_BASE_URL = isLocal
    ? `${window.location.protocol}//${host}:5001/api`
    : "https://restaurant-ai-4myq.onrender.com/api";
})();