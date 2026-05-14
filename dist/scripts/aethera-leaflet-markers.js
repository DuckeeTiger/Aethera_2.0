// Marker rendering and filtering for Aethera Leaflet maps.
window.AetheraLeafletMarkers = (() => {
  const { escapeHtml, getSafeMarkerColor } = window.AetheraLeafletCore;

  // Normalize note and marker titles for reliable lookup.
  const normalizeLookupText = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/&amp;/g, "&")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  // Normalize URLs so searchIndex and translation registry can be compared.
  const normalizeUrl = (url) => {
    const value = String(url || "").trim();

    if (!value) {
      return "";
    }

    const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;

    return withLeadingSlash.endsWith("/")
      ? withLeadingSlash
      : `${withLeadingSlash}/`;
  };

  // Get the current site language from URL, localStorage, or document language.
  const getCurrentLanguage = () => {
    const path = window.location.pathname.toLowerCase();

    if (path.startsWith("/hu/")) {
      return "hu";
    }

    if (path.startsWith("/en/")) {
      return "en";
    }

    const storedLanguage = localStorage.getItem("dg-language");

    if (storedLanguage === "hu" || storedLanguage === "en") {
      return storedLanguage;
    }

    const documentLanguage = document.documentElement.lang?.toLowerCase();

    if (documentLanguage?.startsWith("hu")) {
      return "hu";
    }

    return "en";
  };

  // Load the generated site search index for note title to URL lookup.
  const loadSearchIndex = async ({ warn }) => {
    try {
      const response = await fetch("/searchIndex.json");

      if (!response.ok) {
        warn("Search index not found");
        return [];
      }

      const searchIndex = await response.json();

      return Array.isArray(searchIndex) ? searchIndex : [];
    } catch (error) {
      warn("Could not load search index", error);
      return [];
    }
  };

  // Load the generated translation registry.
  const loadTranslationRegistry = async ({ warn }) => {
    try {
      const response = await fetch("/assets/translations.json");

      if (!response.ok) {
        warn("Translation registry not found");
        return {};
      }

      const registry = await response.json();

      return registry && typeof registry === "object" ? registry : {};
    } catch (error) {
      warn("Could not load translation registry", error);
      return {};
    }
  };

  // Build note lookup maps from searchIndex and translations.json.
  const buildNoteLookup = (searchIndex, translationRegistry) => {
    const titleLookup = new Map();
    const urlLookup = new Map();
    const urlToTranslations = new Map();

    Object.values(translationRegistry || {}).forEach((translations) => {
      if (!translations || typeof translations !== "object") {
        return;
      }

      Object.values(translations).forEach((url) => {
        const normalizedUrl = normalizeUrl(url);

        if (normalizedUrl) {
          urlToTranslations.set(normalizedUrl, translations);
        }
      });
    });

    searchIndex.forEach((entry) => {
      if (!entry?.title || !entry?.url) {
        return;
      }

      const normalizedTitle = normalizeLookupText(entry.title);
      const normalizedUrl = normalizeUrl(entry.url);

      if (!normalizedTitle || !normalizedUrl) {
        return;
      }

      const note = {
        title: entry.title,
        url: normalizedUrl,
        translations: urlToTranslations.get(normalizedUrl) || null,
      };

      if (!titleLookup.has(normalizedTitle)) {
        titleLookup.set(normalizedTitle, note);
      }

      urlLookup.set(normalizedUrl, note);
    });

    return {
      titleLookup,
      urlLookup,
    };
  };

  // Find a note by marker link/title.
  const getNoteForMarker = (savedMarker, noteLookup) => {
    const markerTitle = savedMarker.link || "";
    const normalizedMarkerTitle = normalizeLookupText(markerTitle);

    if (!normalizedMarkerTitle || !noteLookup?.titleLookup) {
      return null;
    }

    return noteLookup.titleLookup.get(normalizedMarkerTitle) || null;
  };

  // Get the localized version of a matched note.
  const getLocalizedNote = (note, noteLookup, language) => {
    if (!note) {
      return null;
    }

    const localizedUrl = normalizeUrl(note.translations?.[language]);

    if (!localizedUrl) {
      return note;
    }

    return (
      noteLookup?.urlLookup?.get(localizedUrl) || {
        title: note.title,
        url: localizedUrl,
        translations: note.translations,
      }
    );
  };

  // Create popup content for a marker.
  const createMarkerPopupContent = ({ title, note, isPinned = false }) => {
    const escapedTitle = escapeHtml(title);
    const pinnedClass = isPinned ? " is-pinned" : "";

    if (!note?.url) {
      return `
        <div class="aethera-marker-popup${pinnedClass}">
          <strong class="aethera-marker-popup-title">${escapedTitle}</strong>
        </div>
      `;
    }

    return `
      <div class="aethera-marker-popup${pinnedClass}">
        <a class="aethera-marker-popup-title-link" href="${escapeHtml(note.url)}">
          ${escapedTitle}
        </a>
      </div>
    `;
  };

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
          <span class="aethera-map-marker-symbol" aria-hidden="true"></span>
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
  const renderSavedMarkers = ({
    map,
    config,
    leafletData,
    noteLookup,
    log,
    warn,
  }) => {
    const savedMapData = getSavedMapData(leafletData, config.id);

    if (!savedMapData?.markers?.length) {
      log("No saved markers found for map:", config.id);
      return [];
    }

    const markerIcons = buildMarkerIconLookup(leafletData);
    const markerTypes = getUsedMarkerTypes(savedMapData);
    const activeTypes = readMarkerFilterState(config.id, markerTypes);
    let currentLanguage = getCurrentLanguage();
    let pinnedEntry = null;
    let hoverEntry = null;
    let hoverCloseTimer = null;
    const renderedMarkers = [];

    // Update one marker popup/title for the current language and pin state.
    const updateMarkerLanguage = (entry) => {
      const localizedNote = getLocalizedNote(
        entry.matchedNote,
        noteLookup,
        currentLanguage
      );

      const title = localizedNote?.title || entry.fallbackTitle;
      const popupContent = createMarkerPopupContent({
        title,
        note: localizedNote,
        isPinned: entry.isPopupPinned,
      });

      entry.title = title;
      entry.localizedNote = localizedNote;
      entry.leafletMarker.options.title = title;
      entry.leafletMarker.setPopupContent(popupContent);

      const markerElement = entry.leafletMarker.getElement();

      if (markerElement) {
        markerElement.setAttribute("title", title);
      }
    };

    // Clear any delayed hover close timer.
    const clearHoverCloseTimer = () => {
      if (hoverCloseTimer) {
        clearTimeout(hoverCloseTimer);
        hoverCloseTimer = null;
      }
    };

    // Close every temporary hover popup except the optional current one.
    const closeOtherHoverPopups = (currentEntry = null) => {
      renderedMarkers.forEach((entry) => {
        if (entry === currentEntry || entry.isPopupPinned) {
          return;
        }

        entry.leafletMarker.closePopup();

        if (hoverEntry === entry) {
          hoverEntry = null;
        }
      });
    };

    // Close a popup and reset its pinned state.
    const closeEntryPopup = (entry) => {
      if (!entry) {
        return;
      }

      clearHoverCloseTimer();

      entry.isPopupPinned = false;
      updateMarkerLanguage(entry);
      entry.leafletMarker.closePopup();

      if (pinnedEntry === entry) {
        pinnedEntry = null;
      }

      if (hoverEntry === entry) {
        hoverEntry = null;
      }
    };

    // Close a hover popup after a short delay, unless the mouse enters the popup.
    const scheduleHoverPopupClose = (entry) => {
      if (entry.isPopupPinned) {
        return;
      }

      clearHoverCloseTimer();

      hoverCloseTimer = setTimeout(() => {
        if (!entry.isPopupPinned && hoverEntry === entry) {
          entry.leafletMarker.closePopup();
          hoverEntry = null;
        }

        hoverCloseTimer = null;
      }, 250);
    };

    // Keep hover popup open while the mouse is over the popup itself.
    const attachPopupHoverHandlers = (entry) => {
      const popupElement = entry.leafletMarker.getPopup()?.getElement();

      if (!popupElement || entry.popupElement === popupElement) {
        return;
      }

      entry.popupElement = popupElement;

      popupElement.addEventListener("mouseenter", () => {
        clearHoverCloseTimer();
      });

      popupElement.addEventListener("mouseleave", () => {
        scheduleHoverPopupClose(entry);
      });
    };

    // Open a temporary hover popup.
    const openHoverPopup = (entry) => {
      clearHoverCloseTimer();

      if (pinnedEntry && pinnedEntry !== entry) {
        closeEntryPopup(pinnedEntry);
      }

      closeOtherHoverPopups(entry);

      if (entry.isPopupPinned) {
        return;
      }

      hoverEntry = entry;

      updateMarkerLanguage(entry);
      entry.leafletMarker.openPopup();

      requestAnimationFrame(() => {
        attachPopupHoverHandlers(entry);
      });
    };

    // Close a temporary hover popup after a small grace period.
    const closeHoverPopup = (entry) => {
      if (hoverEntry !== entry) {
        return;
      }

      scheduleHoverPopupClose(entry);
    };

    // Pin a popup after marker click.
    const pinPopup = (entry) => {
      clearHoverCloseTimer();
      closeOtherHoverPopups(entry);

      if (pinnedEntry && pinnedEntry !== entry) {
        closeEntryPopup(pinnedEntry);
      }

      entry.isPopupPinned = true;
      pinnedEntry = entry;
      hoverEntry = null;

      updateMarkerLanguage(entry);
      entry.leafletMarker.openPopup();

      requestAnimationFrame(() => {
        attachPopupHoverHandlers(entry);
      });
    };

    // Refresh all marker popups/titles when the site language changes.
    const updateAllMarkerLanguages = (language) => {
      if (language === "en" || language === "hu") {
        currentLanguage = language;
      } else {
        currentLanguage = getCurrentLanguage();
      }

      renderedMarkers.forEach(updateMarkerLanguage);

      log("Marker language updated:", {
        mapId: config.id,
        language: currentLanguage,
      });
    };

    savedMapData.markers.forEach((savedMarker) => {
      if (!Array.isArray(savedMarker.loc) || savedMarker.loc.length < 2) {
        warn("Skipping marker with invalid location:", savedMarker);
        return;
      }

      const [y, x] = savedMarker.loc;
      const fallbackTitle =
        savedMarker.link ||
        savedMarker.description ||
        savedMarker.type ||
        "Marker";

      const matchedNote = getNoteForMarker(savedMarker, noteLookup);

      const leafletMarker = L.marker([y, x], {
        icon: createSavedMarkerIcon(savedMarker, markerIcons),
        title: fallbackTitle,
      });

      leafletMarker.bindPopup("", {
        closeButton: true,
        autoClose: false,
        closeOnClick: false,
        className: "aethera-marker-popup-shell",
      });

      const markerEntry = {
        savedMarker,
        leafletMarker,
        fallbackTitle,
        matchedNote,
        localizedNote: null,
        title: fallbackTitle,
        popupElement: null,
        isPopupPinned: false,
        isVisible: false,
      };

      leafletMarker.on("mouseover", () => {
        openHoverPopup(markerEntry);
      });

      leafletMarker.on("mouseout", () => {
        closeHoverPopup(markerEntry);
      });

      leafletMarker.on("click", (event) => {
        if (event?.originalEvent) {
          event.originalEvent.preventDefault();
          event.originalEvent.stopPropagation();
        }

        pinPopup(markerEntry);
      });

      leafletMarker.on("popupclose", () => {
        if (markerEntry.isPopupPinned) {
          markerEntry.isPopupPinned = false;

          if (pinnedEntry === markerEntry) {
            pinnedEntry = null;
          }

          if (hoverEntry === markerEntry) {
            hoverEntry = null;
          }

          updateMarkerLanguage(markerEntry);
        }
      });

      updateMarkerLanguage(markerEntry);
      renderedMarkers.push(markerEntry);
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
          updateMarkerLanguage(entry);
          return;
        }

        if (!shouldBeVisible && entry.isVisible) {
          closeEntryPopup(entry);
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

    map.on("click", () => {
      if (pinnedEntry) {
        closeEntryPopup(pinnedEntry);
      }
    });

    window.addEventListener("dg-language-changed", (event) => {
      updateAllMarkerLanguages(event.detail);
    });

    log("Saved markers prepared:", {
      mapId: config.id,
      count: renderedMarkers.length,
      types: markerTypes,
      language: currentLanguage,
    });

    return renderedMarkers;
  };

  return {
    buildNoteLookup,
    loadObsidianLeafletData,
    loadSearchIndex,
    loadTranslationRegistry,
    renderSavedMarkers,
  };
})();