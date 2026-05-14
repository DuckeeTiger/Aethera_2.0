// Shared helpers for Aethera Leaflet maps.
window.AetheraLeafletCore = (() => {
  // Create debug logging helpers.
  const createLogger = (debug) => {
    const log = (...args) => {
      if (debug) {
        console.log("[Aethera Leaflet]", ...args);
      }
    };

    const warn = (...args) => {
      console.warn("[Aethera Leaflet]", ...args);
    };

    return {
      log,
      warn,
    };
  };

  // Load a script once, then resolve when it is available.
  const loadScriptOnce = (src) =>
    new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);

      if (existingScript?.dataset.loaded === "true") {
        resolve();
        return;
      }

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });

        existingScript.addEventListener("error", () => reject(), {
          once: true,
        });

        return;
      }

      const script = document.createElement("script");

      script.src = src;
      script.defer = true;

      script.addEventListener(
        "load",
        () => {
          script.dataset.loaded = "true";
          resolve();
        },
        { once: true }
      );

      script.addEventListener(
        "error",
        () => {
          reject(new Error(`Could not load script: ${src}`));
        },
        { once: true }
      );

      document.head.appendChild(script);
    });

  // Create a standard Aethera Leaflet control button.
  const createControlButton = ({ title, label, onClick, position = "topleft" }) => {
    const control = L.Control.extend({
      options: {
        position,
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

    return new control({ position });
  };

  // Parse the Obsidian Leaflet block into a map config object.
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

  // Escape text before placing it inside HTML.
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  // Keep marker color values safe for inline CSS variables.
  const getSafeMarkerColor = (color, fallback = "#dddddd") => {
    const value = String(color || "").trim();

    if (/^#[0-9a-fA-F]{3,8}$/.test(value)) {
      return value;
    }

    return fallback;
  };

  // Create fullscreen helpers for one map instance.
  const createFullscreenController = ({ map, mapElement }) => {
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

    const toggleFullscreen = (button) => {
      fullscreenButton = button;

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

    const handleFullscreenChange = () => {
      if (!isNativeFullscreen()) {
        mapElement.classList.remove("aethera-leaflet-map-expanded");
      }

      updateFullscreenButtonState();
      invalidateMapSize();
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return {
      toggleFullscreen,
    };
  };

  return {
    createControlButton,
    createFullscreenController,
    createLogger,
    escapeHtml,
    getSafeMarkerColor,
    loadScriptOnce,
    parseLeafletConfig,
  };
})();