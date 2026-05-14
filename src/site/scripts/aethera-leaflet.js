document.addEventListener("DOMContentLoaded", async () => {
  // Load Aethera Leaflet feature modules before initializing maps.
  const loadFeatureModules = async () => {
    const coreScriptPath = "/scripts/aethera-leaflet-core.js";

    if (!window.AetheraLeafletCore) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");

        script.src = coreScriptPath;
        script.defer = true;

        script.addEventListener("load", resolve, { once: true });
        script.addEventListener("error", reject, { once: true });

        document.head.appendChild(script);
      });
    }

    const { loadScriptOnce } = window.AetheraLeafletCore;

    await loadScriptOnce("/scripts/aethera-leaflet-measure.js");
    await loadScriptOnce("/scripts/aethera-leaflet-markers.js");
  };

  await loadFeatureModules();

  // Pull in shared module helpers.
  const {
    createControlButton,
    createFullscreenController,
    createLogger,
    parseLeafletConfig,
  } = window.AetheraLeafletCore;

  const { attachMeasurementTool } = window.AetheraLeafletMeasure;
  const { loadObsidianLeafletData, renderSavedMarkers } =
    window.AetheraLeafletMarkers;

  // Debug logging helpers.
  const DEBUG = true;
  const { log, warn } = createLogger(DEBUG);

  // Stop if Leaflet is not available.
  if (!window.L) {
    warn("Leaflet library not found");
    return;
  }

  log("Script loaded");
  log("Leaflet found", window.L.version);

  // Find Obsidian Leaflet code blocks rendered by Markdown.
  const leafletBlocks = document.querySelectorAll("pre code.language-leaflet");

  log("Leaflet blocks found:", leafletBlocks.length);

  // Load Obsidian Leaflet plugin data once before rendering maps.
  const obsidianLeafletData = await loadObsidianLeafletData({ warn });

  // Render every Obsidian Leaflet block on the page.
  leafletBlocks.forEach((block, index) => {
    const config = parseLeafletConfig(block.textContent, index);

    if (!config.isValid) {
      warn("Missing image or bounds:", {
        id: config.id,
        imageLine: config.imageLine,
        boundsLine: config.boundsLine,
      });

      return;
    }

    const pre = block.closest("pre");

    if (!pre || !pre.parentElement) {
      warn("Could not replace leaflet block:", config.id);
      return;
    }

    const mapElement = document.createElement("div");

    mapElement.id = config.id;
    mapElement.className = "aethera-leaflet-map";
    mapElement.style.height = config.height;
    mapElement.style.width = config.width;

    pre.parentElement.replaceChild(mapElement, pre);

    const map = L.map(config.id, {
      crs: L.CRS.Simple,
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      zoomSnap: config.zoomDelta,
      zoomDelta: config.zoomDelta,
      wheelPxPerZoomLevel: 120,
      zoomControl: false,
    });

    L.control
      .zoom({
        position: "topleft",
        zoomDelta: config.zoomDelta,
      })
      .addTo(map);

    const bounds = [
      [0, 0],
      [config.mapHeight, config.mapWidth],
    ];

    L.imageOverlay(config.imageUrl, bounds).addTo(map);

    // Reset the map to its original configured view.
    const resetView = () => {
      map.setView([config.centerY, config.centerX], config.defaultZoom);
    };

    // Add the reset view control.
    createControlButton({
      title: "Reset map view",
      label: "◎",
      onClick: resetView,
    }).addTo(map);

    // Add the fullscreen control.
    const fullscreenController = createFullscreenController({
      map,
      mapElement,
    });

    createControlButton({
      title: "Toggle fullscreen",
      label: "⛶",
      onClick: fullscreenController.toggleFullscreen,
    }).addTo(map);

    // Add the measurement tool.
    attachMeasurementTool({
      map,
      mapElement,
      config,
      createControlButton,
    });

    // Initialize the map view before rendering zoom-aware markers.
    resetView();

    // Render markers saved by the Obsidian Leaflet plugin.
    renderSavedMarkers({
      map,
      config,
      leafletData: obsidianLeafletData,
      log,
      warn,
    });

    log("Map rendered:", {
      id: config.id,
      imageUrl: config.imageUrl,
      mapHeight: config.mapHeight,
      mapWidth: config.mapWidth,
      center: [config.centerY, config.centerX],
      minZoom: config.minZoom,
      maxZoom: config.maxZoom,
      defaultZoom: config.defaultZoom,
      zoomDelta: config.zoomDelta,
      unit: config.unit,
      scale: config.scale,
    });
  });
});