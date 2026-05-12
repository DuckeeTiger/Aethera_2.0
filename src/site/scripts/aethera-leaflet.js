document.addEventListener("DOMContentLoaded", () => {
  console.log("[Aethera Leaflet] Script loaded");

  if (!window.L) {
    console.warn("[Aethera Leaflet] Leaflet library not found");
    return;
  }

  console.log("[Aethera Leaflet] Leaflet found", window.L.version);

  const leafletBlocks = document.querySelectorAll("pre code.language-leaflet");

  console.log("[Aethera Leaflet] Leaflet blocks found:", leafletBlocks.length);

  leafletBlocks.forEach((block, index) => {
    const rawConfig = block.textContent;

    const getValue = (key, fallback = null) => {
      const regex = new RegExp(`^${key}:\\s*(.+?)(?:\\s+###.*)?$`, "m");
      const match = rawConfig.match(regex);

      return match ? match[1].trim() : fallback;
    };

    const getNumber = (key, fallback) => {
      const value = getValue(key);

      if (value === null) {
        return fallback;
      }

      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const resolveImageUrl = (imageLine) => {
      if (!imageLine) {
        return null;
      }

      // Website / Digital Garden output:
      // image: [Aethera_Labeled_v4.png](/img/user/images/Aethera_Labeled_v4.png)
      const markdownMatch = imageLine.match(/\[[^\]]+\]\(([^)]+)\)/);

      if (markdownMatch) {
        return markdownMatch[1].trim();
      }

      // Obsidian source fallback:
      // image: [[Aethera_Labeled_v4.png]]
      const wikiMatch = imageLine.match(/\[\[([^[\]]+)\]\]/);

      if (wikiMatch) {
        const fileName = wikiMatch[1].trim();

        return `/img/user/images/${encodeURIComponent(fileName)}`;
      }

      return null;
    };

    const rawId = getValue("id", `aethera-map-${index}`);
    const id = rawId.replace(/\s+/g, "-");

    const imageLine = getValue("image", "");
    const imageUrl = resolveImageUrl(imageLine);

    const boundsLine = getValue("bounds", "");
    const boundsMatch = boundsLine.match(
      /\[\[0,0\],\s*\[(\d+),\s*(\d+)\]\]/
    );

    if (!imageUrl || !boundsMatch) {
      console.warn("[Aethera Leaflet] Missing image or bounds:", {
        id,
        imageLine,
        boundsLine,
      });

      return;
    }

    const mapHeight = Number(boundsMatch[1]);
    const mapWidth = Number(boundsMatch[2]);

    const height = getValue("height", "700px");
    const width = getValue("width", "100%");

    const centerY = getNumber("lat", mapHeight / 2);
    const centerX = getNumber("long", mapWidth / 2);

    const minZoom = getNumber("minZoom", -3);
    const maxZoom = getNumber("maxZoom", 2.5);
    const defaultZoom = getNumber("defaultZoom", -1);
    const zoomDelta = getNumber("zoomDelta", 0.5);

    const mapElement = document.createElement("div");

    mapElement.id = id;
    mapElement.className = "aethera-leaflet-map";
    mapElement.style.height = height;
    mapElement.style.width = width;

    const pre = block.closest("pre");

    if (!pre || !pre.parentElement) {
      console.warn("[Aethera Leaflet] Could not replace leaflet block:", id);
      return;
    }

    pre.parentElement.replaceChild(mapElement, pre);

    const map = L.map(id, {
      crs: L.CRS.Simple,
      minZoom,
      maxZoom,
      zoomSnap: zoomDelta,
      zoomDelta,
      wheelPxPerZoomLevel: 120,
      zoomControl: false,
    });

    L.control.zoom({
      position: "topleft",
      zoomDelta,
    }).addTo(map);

    const bounds = [
      [0, 0],
      [mapHeight, mapWidth],
    ];

    L.imageOverlay(imageUrl, bounds).addTo(map);

    map.setView([centerY, centerX], defaultZoom);

    console.log("[Aethera Leaflet] Map rendered:", {
      id,
      imageUrl,
      mapHeight,
      mapWidth,
      center: [centerY, centerX],
      minZoom,
      maxZoom,
      defaultZoom,
      zoomDelta,
    });
  });
});