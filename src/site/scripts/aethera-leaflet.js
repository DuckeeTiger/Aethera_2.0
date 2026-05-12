document.addEventListener("DOMContentLoaded", () => {
  console.log("[Aethera Leaflet] Script loaded");

  if (!window.L) {
    console.warn("[Aethera Leaflet] Leaflet library not found");
    return;
  }

  console.log("[Aethera Leaflet] Leaflet found", window.L.version);

  const leafletBlocks = document.querySelectorAll("pre code.language-leaflet");

  console.log("[Aethera Leaflet] Leaflet blocks found:", leafletBlocks.length);

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
        button.innerHTML = label;

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

    const unit = getValue("unit", "km");
    const scale = getNumber("scale", 1);

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

    L.control
      .zoom({
        position: "topleft",
        zoomDelta,
      })
      .addTo(map);

    const bounds = [
      [0, 0],
      [mapHeight, mapWidth],
    ];

    L.imageOverlay(imageUrl, bounds).addTo(map);

    const resetView = () => {
      map.setView([centerY, centerX], defaultZoom);
    };

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        mapElement.requestFullscreen?.();
        return;
      }

      document.exitFullscreen?.();
    };

    let measuring = false;
    let measurementLocked = false;
    let measureButton = null;
    let measurePoints = [];
    let measureLine = null;
    let measureMarkers = [];
    let measureTooltip = null;

    const formatDistance = (distance) => {
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

    const getTotalMeasuredDistance = () => {
      if (measurePoints.length < 2) {
        return 0;
      }

      let totalPixels = 0;

      for (let i = 1; i < measurePoints.length; i++) {
        totalPixels += getPixelDistance(measurePoints[i - 1], measurePoints[i]);
      }

      return totalPixels * scale;
    };

    const clearMeasurement = () => {
      measurePoints = [];
      measurementLocked = false;

      if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
      }

      if (measureTooltip) {
        map.removeLayer(measureTooltip);
        measureTooltip = null;
      }

      measureMarkers.forEach((marker) => {
        map.removeLayer(marker);
      });

      measureMarkers = [];

      updateMeasureButtonState();
    };

    const updateMeasureLine = () => {
      if (measureLine) {
        map.removeLayer(measureLine);
        measureLine = null;
      }

      if (measureTooltip) {
        map.removeLayer(measureTooltip);
        measureTooltip = null;
      }

      if (measurePoints.length >= 2) {
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
          .setContent(formatDistance(totalDistance))
          .addTo(map);
      }
    };

 const updateMeasureButtonState = () => {
  if (measureButton) {
    measureButton.classList.toggle(
      "is-active",
      measuring || measurementLocked
    );
  }
};

const setMeasuring = (isActive) => {
  measuring = isActive;
  mapElement.classList.toggle("aethera-measuring", measuring);
  updateMeasureButtonState();
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
        if (measureTooltip) {
          map.removeLayer(measureTooltip);
        }

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

      if (event && event.originalEvent) {
        event.originalEvent.preventDefault();
      }

      finishMeasurement();
    };

    createControlButton({
      title: "Reset map view",
      label: "⌂",
      onClick: resetView,
    }).addTo(map);

    createControlButton({
      title: "Toggle fullscreen",
      label: "⛶",
      onClick: toggleFullscreen,
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

    document.addEventListener("fullscreenchange", () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
    });

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
      unit,
      scale,
    });
  });
});