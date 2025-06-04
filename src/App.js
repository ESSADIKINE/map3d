import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import "./App.css";                 // optional, only for your own styles

// --------------- Mapbox token ---------------
mapboxgl.accessToken =
  "pk.eyJ1IjoiZXNzYWRpa2luZSIsImEiOiJjbWJnaTR0NmcwOWR4MmxxdDRtbXR5eHVpIn0.f_FF7MHLTPqj2K_dZnPv_w";

// --------------- Threebox global -----------
const Threebox = window.Threebox;

export default function App() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ---------- initialise once --------------
  useEffect(() => {
    if (!mapboxgl.accessToken) {
      setError("Missing Mapbox token");
      return;
    }

    // 1) Create the map
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v11",
      center: [-7.6941424, 33.5343694],
      zoom: 16,
      pitch: 60,
      bearing: -17,
      antialias: true
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current.addControl(new mapboxgl.ScaleControl());

    // 2) After style is ready
    mapRef.current.once("style.load", () => {
      // --- DEM & terrain
      mapRef.current.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14
      });
      mapRef.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

      // --- Sky
      mapRef.current.addLayer({
        id: "sky",
        type: "sky",
        paint: {
          "sky-type": "atmosphere",
          "sky-atmosphere-sun": [0, 0],
          "sky-atmosphere-sun-intensity": 15
        }
      });

      // --- 3-D buildings
      mapRef.current.addLayer({
        id: "3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#aaa",
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "height"]
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "min_height"]
          ],
          "fill-extrusion-opacity": 0.6
        }
      });

      // 3) Threebox
      const gl =
        mapRef.current.painter?.context?.gl ||
        mapRef.current.getCanvas().getContext("webgl");
      const tb = new Threebox(mapRef.current, gl, { defaultLights: true });

      // helper to load a GLB
      async function addModel(url, lng, lat, z, scale = 1, rotDeg = 0) {
        try {
          const model = await tb.loadGLTF(url);
          model.setCoords([lng, lat, z]);
          model.setScale(scale);
          model.setRotation({ z: (rotDeg * Math.PI) / 180 });
          tb.add(model);
          tb.update();                       // force redraw
        } catch (e) {
          console.error("Model error:", e);
        }
      }

      // ⚠️ Models must be under public/models/
      const base = process.env.PUBLIC_URL + "/models";
      addModel(`${base}/residential_complex.glb`, -7.6964, 33.5347, 15, 3, 65);
      addModel(
        `${base}/buildings_from_trainz_simulator_2012.glb`,
        -7.6955,
        33.5345,
        3,
        0.16,
        135
      );

      // 4) Directions control
      const directions = new MapboxDirections({
        accessToken: mapboxgl.accessToken,
        profile: "mapbox/driving",
        unit: "metric",
        controls: { inputs: true, instructions: true, profileSwitcher: true },
        flyTo: false
      });
      mapRef.current.addControl(directions, "top-left");

      directions.setOrigin([-7.6964, 33.5347]);
      directions.setDestination([-7.696, 33.536]);

      setLoading(false);
    });

    mapRef.current.on("error", e => setError("Map error: " + e.error));
    return () => mapRef.current?.remove();
  }, []);

  // ---------- UI -------------
  return (
    <div className="map-container">
      {error && <div className="error-message">{error}</div>}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <h2>Loading 3-D Map…</h2>
            <progress />
          </div>
        </div>
      )}

      <div ref={mapContainer} className="map" />
    </div>
  );
}
