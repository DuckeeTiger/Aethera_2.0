// Marker rendering and filtering for Aethera Leaflet maps.
window.AetheraLeafletMarkers = (() => {
  const { escapeHtml, getSafeMarkerColor } = window.AetheraLeafletCore;

  // Load marker data exported from the Obsidian Leaflet plugin.
  const loadObsidianLeafletData = async ({ warn }) => {
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

  // Convert marker type names into readable filter labels.
  const getMarkerTypeLabel = (type) => {
    const normalizedType = String(type || "default").trim().toLowerCase();

    const labels = {
      default: "Default",
      poi: "Point of Interest",
      point_of_interest: "Point of Interest",
      "point-of-interest": "Point of Interest",
      city: "City",
      region: "Region",
      kingdom: "Kingdom",
      river: "River",
      sea: "Sea",
      ocean: "Ocean",
      road: "Road",
      mountain: "Mountain",
      capital: "Capital",
      lake: "Lake",
    };

    if (labels[normalizedType]) {
      return labels[normalizedType];
    }

    return normalizedType
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  };

  // Get all marker types used by the current map.
  const getUsedMarkerTypes = (savedMapData) => {
    const types = new Set();

    if (!Array.isArray(savedMapData?.markers)) {
      return [];
    }

    savedMapData.markers.forEach((marker) => {
      types.add(marker.type || "default");
    });

    return Array.from(types).sort((typeA, typeB) =>
      getMarkerTypeLabel(typeA).localeCompare(getMarkerTypeLabel(typeB))
    );
  };

  // Create the localStorage key for marker filter state.
  const getMarkerFilterStorageKey = (mapId) => `aethera-map-filter-${mapId}`;

  // Read marker filter state safely from localStorage.
  const readMarkerFilterState = (mapId, fallbackTypes) => {
    try {
      const storedValue = localStorage.getItem(getMarkerFilterStorageKey(mapId));

      if (!storedValue) {
        return new Set(fallbackTypes);
      }

      const parsedValue = JSON.parse(storedValue);

      if (!Array.isArray(parsedValue)) {
        return new Set(fallbackTypes);
      }

      return new Set(parsedValue);
    } catch {
      return new Set(fallbackTypes);
    }
  };

  // Save marker filter state safely to localStorage.
  const saveMarkerFilterState = (mapId, activeTypes, warn) => {
    try {
      localStorage.setItem(
        getMarkerFilterStorageKey(mapId),
        JSON.stringify(Array.from(activeTypes))
      );
    } catch {
      warn("Could not save marker filter state");
    }
  };

  // Create a CSS based Leaflet marker icon using Obsidian marker colors.
  const createSavedMarkerIcon = (savedMarker, markerIcons) => {
    const markerType = savedMarker.type || "default";
    const iconConfig =
      markerIcons.get(markerType) || markerIcons.get("default") || {};

    const color = getSafeMarkerColor(iconConfig.color);
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

  // Create a marker filter panel control.
  const createMarkerFilterControl = ({
    mapId,
    markerTypes,
    markerIcons,
    activeTypes,
    onChange,
    warn,
  }) => {
    const control = L.Control.extend({
      options: {
        position: "topright",
      },

      onAdd: () => {
        const container = L.DomUtil.create(
          "div",
          "leaflet-bar aethera-marker-filter-control"
        );

        const button = L.DomUtil.create(
          "button",
          "aethera-leaflet-control-button aethera-marker-filter-toggle",
          container
        );

        button.type = "button";
        button.title = "Filter map markers";
        button.setAttribute("aria-label", "Filter map markers");
        button.textContent = "☰";

        const panel = L.DomUtil.create(
          "div",
          "aethera-marker-filter-panel",
          container
        );

        panel.hidden = true;

        const header = L.DomUtil.create(
          "div",
          "aethera-marker-filter-header",
          panel
        );

        header.textContent = "Markers";

        const actions = L.DomUtil.create(
          "div",
          "aethera-marker-filter-actions",
          panel
        );

        const showAllButton = L.DomUtil.create(
          "button",
          "aethera-marker-filter-action",
          actions
        );

        showAllButton.type = "button";
        showAllButton.textContent = "Show all";

        const hideAllButton = L.DomUtil.create(
          "button",
          "aethera-marker-filter-action",
          actions
        );

        hideAllButton.type = "button";
        hideAllButton.textContent = "Hide all";

        const list = L.DomUtil.create(
          "div",
          "aethera-marker-filter-list",
          panel
        );

        const notifyChange = () => {
          saveMarkerFilterState(mapId, activeTypes, warn);
          onChange();
        };

        const checkboxEntries = markerTypes.map((type) => {
          const iconConfig =
            markerIcons.get(type) || markerIcons.get("default") || {};

          const row = L.DomUtil.create(
            "label",
            "aethera-marker-filter-row",
            list
          );

          const checkbox = L.DomUtil.create(
            "input",
            "aethera-marker-filter-checkbox",
            row
          );

          checkbox.type = "checkbox";
          checkbox.checked = activeTypes.has(type);

          const swatch = L.DomUtil.create(
            "span",
            "aethera-marker-filter-swatch",
            row
          );

          swatch.style.setProperty(
            "--aethera-marker-color",
            getSafeMarkerColor(iconConfig.color)
          );

          const label = L.DomUtil.create(
            "span",
            "aethera-marker-filter-label",
            row
          );

          label.textContent = getMarkerTypeLabel(type);

          L.DomEvent.on(checkbox, "change", () => {
            if (checkbox.checked) {
              activeTypes.add(type);
            } else {
              activeTypes.delete(type);
            }

            notifyChange();
          });

          return {
            type,
            checkbox,
          };
        });

        L.DomEvent.on(button, "click", (event) => {
          L.DomEvent.preventDefault(event);

          panel.hidden = !panel.hidden;
          button.classList.toggle("is-active", !panel.hidden);
        });

        L.DomEvent.on(showAllButton, "click", (event) => {
          L.DomEvent.preventDefault(event);

          markerTypes.forEach((type) => activeTypes.add(type));

          checkboxEntries.forEach((entry) => {
            entry.checkbox.checked = true;
          });

          notifyChange();
        });

        L.DomEvent.on(hideAllButton, "click", (event) => {
          L.DomEvent.preventDefault(event);

          activeTypes.clear();

          checkboxEntries.forEach((entry) => {
            entry.checkbox.checked = false;
          });

          notifyChange();
        });

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      },
    });

    return new control({
      position: "topright",
    });
  };

  // Render saved Obsidian Leaflet markers for the current map.
  const renderSavedMarkers = ({ map, config, leafletData, log, warn }) => {
    const savedMapData = getSavedMapData(leafletData, config.id);

    if (!savedMapData?.markers?.length) {
      log("No saved markers found for map:", config.id);
      return [];
    }

    const markerIcons = buildMarkerIconLookup(leafletData);
    const markerTypes = getUsedMarkerTypes(savedMapData);
    const activeTypes = readMarkerFilterState(config.id, markerTypes);
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

      const escapedTitle = escapeHtml(title);

      const leafletMarker = L.marker([y, x], {
        icon: createSavedMarkerIcon(savedMarker, markerIcons),
        title,
      });

      leafletMarker.bindTooltip(escapedTitle, {
        direction: "top",
        offset: [0, -30],
        opacity: 0.95,
      });

      leafletMarker.bindPopup(`<strong>${escapedTitle}</strong>`);

      renderedMarkers.push({
        savedMarker,
        leafletMarker,
        isVisible: false,
      });
    });

    const updateSavedMarkerVisibility = () => {
      const currentZoom = map.getZoom();

      renderedMarkers.forEach((entry) => {
        const markerType = entry.savedMarker.type || "default";
        const isTypeEnabled = activeTypes.has(markerType);
        const isZoomAllowed = isMarkerVisibleAtZoom(
          entry.savedMarker,
          currentZoom
        );

        const shouldBeVisible = isTypeEnabled && isZoomAllowed;

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

    createMarkerFilterControl({
      mapId: config.id,
      markerTypes,
      markerIcons,
      activeTypes,
      onChange: updateSavedMarkerVisibility,
      warn,
    }).addTo(map);

    map.on("zoomend", updateSavedMarkerVisibility);

    log("Saved markers prepared:", {
      mapId: config.id,
      count: renderedMarkers.length,
      types: markerTypes,
    });

    return renderedMarkers;
  };

  return {
    loadObsidianLeafletData,
    renderSavedMarkers,
  };
})();