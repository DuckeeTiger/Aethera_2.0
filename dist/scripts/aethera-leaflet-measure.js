// Measurement tools for Aethera Leaflet maps.
window.AetheraLeafletMeasure = (() => {
  // Format measured map distance into a readable label.
  const formatDistance = (distance, unit) => {
    if (distance >= 100) {
      return `${distance.toFixed(0)} ${unit}`;
    }

    if (distance >= 10) {
      return `${distance.toFixed(1)} ${unit}`;
    }

    return `${distance.toFixed(2)} ${unit}`;
  };

  // Calculate pixel distance between two CRS.Simple points.
  const getPixelDistance = (pointA, pointB) => {
    const dy = pointB.lat - pointA.lat;
    const dx = pointB.lng - pointA.lng;

    return Math.sqrt(dx * dx + dy * dy);
  };

  // Attach the route measurement tool to a map.
  const attachMeasurementTool = ({ map, mapElement, config, createControlButton }) => {
    let measuring = false;
    let measurementLocked = false;
    let measureButton = null;
    let measurePoints = [];
    let measureLine = null;
    let measureMarkers = [];
    let measureTooltip = null;

    // Update the measurement button active state.
    const updateMeasureButtonState = () => {
      if (!measureButton) {
        return;
      }

      measureButton.classList.toggle(
        "is-active",
        measuring || measurementLocked
      );
    };

    // Turn measurement mode on or off.
    const setMeasuring = (isActive) => {
      measuring = isActive;
      mapElement.classList.toggle("aethera-measuring", measuring);
      updateMeasureButtonState();
    };

    // Calculate the total measured route distance.
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

    // Remove a Leaflet layer if it exists.
    const removeLayerIfExists = (layer) => {
      if (layer) {
        map.removeLayer(layer);
      }
    };

    // Clear all measurement layers and state.
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

    // Update the measurement polyline and distance tooltip.
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

    // Start a new measurement.
    const startNewMeasurement = () => {
      clearMeasurement();
      setMeasuring(true);
    };

    // Finish the current measurement without clearing it.
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

    // Add a measurement point to the map.
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

    // Handle map clicks while measurement mode is active.
    const handleMeasureClick = (event) => {
      if (!measuring) {
        return;
      }

      addMeasurePoint(event.latlng);
    };

    // Finish measurement on context menu.
    const handleMeasureFinish = (event) => {
      if (!measuring) {
        return;
      }

      event?.originalEvent?.preventDefault();
      finishMeasurement();
    };

    // Add the measurement control.
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

    // Register measurement map events.
    map.on("click", handleMeasureClick);
    map.on("contextmenu", handleMeasureFinish);
  };

  return {
    attachMeasurementTool,
  };
})();