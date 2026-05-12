document.addEventListener("DOMContentLoaded", () => {
  console.log("[Aethera Leaflet] Script loaded");

  if (!window.L) {
    console.warn("[Aethera Leaflet] Leaflet library not found");
    return;
  }

  console.log("[Aethera Leaflet] Leaflet found", window.L.version);
});