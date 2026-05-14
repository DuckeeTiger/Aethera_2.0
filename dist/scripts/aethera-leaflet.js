document.addEventListener("DOMContentLoaded", async () => {
  const DEBUG = true;

  const log = (...args) => {
    if (DEBUG) {
      console.log("[Aethera Leaflet]", ...args);
    }
  };

  const warn = (...args) => {
    console.warn("[Aethera Leaflet]", ...args);
  };

  if (!window.L) {
    warn("Leaflet library not found");
    return;
  }

  log("Script loaded");
  log("Leaflet found", window.L.version);

  const leafletBlocks = document.querySelectorAll("pre code.language-leaflet");

  log("Leaflet blocks found:", leafletBlocks.length);

  const createControlButton = ({ title, label, onClick }) => {
    const control = L.Control.extend({
      options: {
        position: "topleft",
      },

      onAdd: () => {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar aethera-leaflet-control"
        );

        const button = L.DomUtil.create(
          "button",
          "aethera-leaflet-control-button",
          container
        );

        button.type = "button";
        button.title = title;
        button.setAttribute("aria-label", title);
        button.textContent = label;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.preventDefault(event);
          onClick(button);
        });

        return container;
      },
    });

    return new control();
  };

  const parseLeafletConfig = (rawConfig, index) => {
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

      const markdownMatch = imageLine.match(/\[[^\]]+\]\(([^)]+)\)/);

      if (markdownMatch) {
        return markdownMatch[1].trim();
      }

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
      return {
        isValid: false,
        id,
        imageLine,
        boundsLine,
      };
    }

    const mapHeight = Number(boundsMatch[1]);
    const mapWidth = Number(boundsMatch[2]);

    return {
      isValid: true,
      id,
      imageUrl,
      mapHeight,
      mapWidth,
      height: getValue("height", "700px"),
      width: getValue("width", "100%"),
      centerY: getNumber("lat", mapHeight / 2),
      centerX: getNumber("long", mapWidth / 2),
      minZoom: getNumber("minZoom", -3),
      maxZoom: getNumber("maxZoom", 2.5),
      defaultZoom: getNumber("defaultZoom", -1),
      zoomDelta: getNumber("zoomDelta", 0.5),
      unit: getValue("unit", "km"),
      scale: getNumber("scale", 1),
    };
  };

  const formatDistance = (distance, unit) => {
    if (distance >= 100) {
      return `${distance.toFixed(0)} ${unit}`;
    }

    if (distance >= 10) {
      return `${distance.toFixed(1)} ${unit}`;
    }

    return `${distance.toFixed(2)} ${unit}`;
  };

  const getPixelDistance = (pointA, pointB) => {
    const dy = pointB.lat - pointA.lat;
    const dx = pointB.lng - pointA.lng;

    return Math.sqrt(dx * dx + dy * dy);
  };

    // Load marker data exported from the Obsidian Leaflet plugin.
  const loadObsidianLeafletData = async () => {
    try {
      const response = await fetch("/scripts/obsidian-leaflet-data.json");

      if (!response.ok) {
        warn("Obsidian Leaflet data file not found");
        return null;
      }

      return await response.json();
    } catch (error) {
      warn("Could not load Obsidian Leaflet data file", error);
      return null;
    }
  };

  // Find saved Obsidian marker data for the current map id.
  const getSavedMapData = (leafletData, mapId) => {
    if (!Array.isArray(leafletData?.mapMarkers)) {
      return null;
    }

    return leafletData.mapMarkers.find((savedMap) => savedMap.id === mapId);
  };

  // Build a marker icon lookup table from Obsidian Leaflet data.
  const buildMarkerIconLookup = (leafletData) => {
    const icons = new Map();

    if (leafletData?.defaultMarker) {
      icons.set("default", leafletData.defaultMarker);
    }

    if (Array.isArray(leafletData?.markerIcons)) {
      leafletData.markerIcons.forEach((icon) => {
        if (icon?.type) {
          icons.set(icon.type, icon);
        }
      });
    }

    return icons;
  };

  // Convert marker type names into safe CSS class names.
  const normalizeMarkerTypeClass = (type) =>
    String(type || "default")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-")
      .replace(/[^a-z0-9-]/g, "-");

  // Escape marker titles before placing them inside popup HTML.
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Create a CSS based Leaflet marker icon using Obsidian marker colors.
  const createSavedMarkerIcon = (savedMarker, markerIcons) => {
    const markerType = savedMarker.type || "default";
    const iconConfig =
      markerIcons.get(markerType) ||
      markerIcons.get("default") ||
      {};

    const color = iconConfig.color || "#dddddd";
    const typeClass = normalizeMarkerTypeClass(markerType);

    return L.divIcon({
      className: "aethera-map-marker-icon",
      iconSize: [28, 38],
      iconAnchor: [14, 38],
      popupAnchor: [0, -34],
      tooltipAnchor: [0, -34],
      html: `
        <div
          class="aethera-map-marker aethera-map-marker-${typeClass}"
          style="--aethera-marker-color: ${color};"
        >
          <span class="aethera-map-marker-dot"></span>
        </div>
      `,
    });
  };

  // Check whether a saved marker should be visible at the current zoom level.
  const isMarkerVisibleAtZoom = (savedMarker, zoom) => {
    const parseZoomLimit = (value) => {
      if (value === null || value === undefined || value === "") {
        return null;
      }

      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : null;
    };

    const minZoom = parseZoomLimit(savedMarker.minZoom);
    const maxZoom = parseZoomLimit(savedMarker.maxZoom);

    if (minZoom !== null && zoom < minZoom) {
      return false;
    }

    if (maxZoom !== null && zoom > maxZoom) {
      return false;
    }

    return true;
  };

  // Render saved Obsidian Leaflet markers for the current map.
  const renderSavedMarkers = ({ map, config, leafletData }) => {
    const savedMapData = getSavedMapData(leafletData, config.id);

    if (!savedMapData?.markers?.length) {
      log("No saved markers found for map:", config.id);
      return [];
    }

    const markerIcons = buildMarkerIconLookup(leafletData);
    const renderedMarkers = [];

    savedMapData.markers.forEach((savedMarker) => {
      if (!Array.isArray(savedMarker.loc) || savedMarker.loc.length < 2) {
        warn("Skipping marker with invalid location:", savedMarker);
        return;
      }

      const [y, x] = savedMarker.loc;
      const title =
        savedMarker.link ||
        savedMarker.description ||
        savedMarker.type ||
        "Marker";

      const leafletMarker = L.marker([y, x], {
        icon: createSavedMarkerIcon(savedMarker, markerIcons),
        title,
      });

      leafletMarker.bindTooltip(title, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });

      leafletMarker.bindPopup(`<strong>${escapeHtml(title)}</strong>`);

      renderedMarkers.push({
        savedMarker,
        leafletMarker,
        isVisible: false,
      });
    });

    const updateSavedMarkerVisibility = () => {
      const currentZoom = map.getZoom();

      renderedMarkers.forEach((entry) => {
        const shouldBeVisible = isMarkerVisibleAtZoom(
          entry.savedMarker,
          currentZoom
        );

        if (shouldBeVisible && !entry.isVisible) {
          entry.leafletMarker.addTo(map);
          entry.isVisible = true;
          return;
        }

        if (!shouldBeVisible && entry.isVisible) {
          map.removeLayer(entry.leafletMarker);
          entry.isVisible = false;
        }
      });
    };

    updateSavedMarkerVisibility();
    map.on("zoomend", updateSavedMarkerVisibility);

    log("Saved markers prepared:", {
      mapId: config.id,
      count: renderedMarkers.length,
    });

    return renderedMarkers;
  };

  // Load Obsidian Leaflet plugin data once before rendering maps.
  const obsidianLeafletData = await loadObsidianLeafletData();

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


    const resetView = () => {
      map.setView([config.centerY, config.centerX], config.defaultZoom);
    };

    let fullscreenButton = null;

    const invalidateMapSize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    };

    const isFallbackFullscreen = () =>
      mapElement.classList.contains("aethera-leaflet-map-expanded");

    const isNativeFullscreen = () => document.fullscreenElement === mapElement;

    const updateFullscreenButtonState = () => {
      if (!fullscreenButton) {
        return;
      }

      fullscreenButton.classList.toggle(
        "is-active",
        isNativeFullscreen() || isFallbackFullscreen()
      );
    };

    const enterFallbackFullscreen = () => {
      mapElement.classList.add("aethera-leaflet-map-expanded");
      updateFullscreenButtonState();
      invalidateMapSize();
    };

    const exitFallbackFullscreen = () => {
      mapElement.classList.remove("aethera-leaflet-map-expanded");
      updateFullscreenButtonState();
      invalidateMapSize();
    };

    const toggleFullscreen = () => {
      if (isNativeFullscreen()) {
        document.exitFullscreen?.();
        return;
      }

      if (isFallbackFullscreen()) {
        exitFallbackFullscreen();
        return;
      }

      if (mapElement.requestFullscreen) {
        mapElement.requestFullscreen().catch(() => {
          enterFallbackFullscreen();
        });

        return;
      }

      enterFallbackFullscreen();
    };

    let measuring = false;
    let measurementLocked = false;
    let measureButton = null;
    let measurePoints = [];
    let measureLine = null;
    let measureMarkers = [];
    let measureTooltip = null;

    const updateMeasureButtonState = () => {
      if (!measureButton) {
        return;
      }

      measureButton.classList.toggle(
        "is-active",
        measuring || measurementLocked
      );
    };

    const setMeasuring = (isActive) => {
      measuring = isActive;
      mapElement.classList.toggle("aethera-measuring", measuring);
      updateMeasureButtonState();
    };

    const getTotalMeasuredDistance = () => {
      if (measurePoints.length < 2) {
        return 0;
      }

      let totalPixels = 0;

      for (let i = 1; i < measurePoints.length; i++) {
        totalPixels += getPixelDistance(measurePoints[i - 1], measurePoints[i]);
      }

      return totalPixels * config.scale;
    };

    const removeLayerIfExists = (layer) => {
      if (layer) {
        map.removeLayer(layer);
      }
    };

    const clearMeasurement = () => {
      measurePoints = [];
      measurementLocked = false;

      removeLayerIfExists(measureLine);
      removeLayerIfExists(measureTooltip);

      measureLine = null;
      measureTooltip = null;

      measureMarkers.forEach((marker) => {
        map.removeLayer(marker);
      });

      measureMarkers = [];

      updateMeasureButtonState();
    };

    const updateMeasureLine = () => {
      removeLayerIfExists(measureLine);
      removeLayerIfExists(measureTooltip);

      measureLine = null;
      measureTooltip = null;

      if (measurePoints.length < 2) {
        return;
      }

      measureLine = L.polyline(measurePoints, {
        className: "aethera-measure-line",
      }).addTo(map);

      const lastPoint = measurePoints[measurePoints.length - 1];
      const totalDistance = getTotalMeasuredDistance();

      measureTooltip = L.tooltip({
        permanent: true,
        direction: "top",
        className: "aethera-measure-tooltip",
        offset: [0, -10],
      })
        .setLatLng(lastPoint)
        .setContent(formatDistance(totalDistance, config.unit))
        .addTo(map);
    };

    const startNewMeasurement = () => {
      clearMeasurement();
      setMeasuring(true);
    };

    const finishMeasurement = () => {
      if (!measuring) {
        return;
      }

      measuring = false;
      measurementLocked = measurePoints.length > 0;

      mapElement.classList.remove("aethera-measuring");
      updateMeasureButtonState();

      if (measurePoints.length === 1 && measureTooltip) {
        measureTooltip.setContent("1 point");
      }
    };

    const addMeasurePoint = (point) => {
      if (!measuring) {
        return;
      }

      measurePoints.push(point);

      const marker = L.circleMarker(point, {
        radius: 5,
        className: "aethera-measure-point",
      }).addTo(map);

      measureMarkers.push(marker);

      if (measurePoints.length === 1) {
        removeLayerIfExists(measureTooltip);

        measureTooltip = L.tooltip({
          permanent: true,
          direction: "top",
          className: "aethera-measure-tooltip",
          offset: [0, -10],
        })
          .setLatLng(point)
          .setContent("Start")
          .addTo(map);

        return;
      }

      updateMeasureLine();
    };

    const handleMeasureClick = (event) => {
      if (!measuring) {
        return;
      }

      addMeasurePoint(event.latlng);
    };

    const handleMeasureFinish = (event) => {
      if (!measuring) {
        return;
      }

      event?.originalEvent?.preventDefault();
      finishMeasurement();
    };

    createControlButton({
      title: "Reset map view",
      label: "◎",
      onClick: resetView,
    }).addTo(map);

    createControlButton({
      title: "Toggle fullscreen",
      label: "⛶",
      onClick: (button) => {
        fullscreenButton = button;
        toggleFullscreen();
      },
    }).addTo(map);

    createControlButton({
      title: "Measure route distance",
      label: "📏",
      onClick: (button) => {
        measureButton = button;

        if (measuring) {
          finishMeasurement();
          return;
        }

        if (measurementLocked || measurePoints.length > 0) {
          clearMeasurement();
          setMeasuring(false);
          return;
        }

        startNewMeasurement();
      },
    }).addTo(map);

    map.on("click", handleMeasureClick);
    map.on("contextmenu", handleMeasureFinish);

    const handleFullscreenChange = () => {
        if (!isNativeFullscreen()) {
          mapElement.classList.remove("aethera-leaflet-map-expanded");
        }

      updateFullscreenButtonState();
      invalidateMapSize();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Initialize the map view before rendering zoom-aware markers.
    resetView();

    // Render markers saved by the Obsidian Leaflet plugin.
    renderSavedMarkers({
      map,
      config,
      leafletData: obsidianLeafletData,
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