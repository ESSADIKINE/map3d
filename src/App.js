import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import "./App.css";

/* ----------  Mapbox token  ---------- */
mapboxgl.accessToken =
  "pk.eyJ1IjoiZXNzYWRpa2luZSIsImEiOiJjbWJnaTR0NmcwOWR4MmxxdDRtbXR5eHVpIn0.f_FF7MHLTPqj2K_dZnPv_w";

export default function App() {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const directions   = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  /* -------------------------------------------------
     1)  ننتظر حتى يتوفّر  window.Threebox
  -------------------------------------------------- */
  useEffect(() => {
    let tries = 0;
    const waitForTB = setInterval(() => {
      if (window.Threebox) {
        clearInterval(waitForTB);
        initMap();                         // ← أسفل
      } else if (++tries > 20) {           // ~4 ثواني
        clearInterval(waitForTB);
        setError("Threebox لم يُحمَّل بشكل صحيح");
        setLoading(false);
      }
    }, 200);

    return () => clearInterval(waitForTB);
  }, []);

  /* -------------------------------------------------
     2)  INITIALISE MAP + THREEBOX + MODELS
  -------------------------------------------------- */
  const initMap = () => {
    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style:     "mapbox://styles/mapbox/satellite-streets-v11",
        center:    [-7.6941424, 33.5343694],
        zoom:      16,
        pitch:     60,
        bearing:   -17,
        antialias: true
      });

      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.current.addControl(new mapboxgl.ScaleControl());

      map.current.once("style.load", () => {
        /* --- Terrain + Sky --- */
        map.current.addSource("mapbox-dem", {
          type: "raster-dem",
          url:  "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14
        });
        map.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

        map.current.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0, 0],
            "sky-atmosphere-sun-intensity": 15
          }
        });

        /* --- 3-D Buildings --- */
        map.current.addLayer({
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "height"]
            ],
            "fill-extrusion-base": [
              "interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "min_height"]
            ],
            "fill-extrusion-opacity": 0.6
          }
        });

        /* --- THREEBOX instance --- */
        const tb = new window.Threebox(
          map.current,
          map.current.getCanvas().getContext("webgl"),
          { defaultLights: true }
        );

        /* helper: load one GLB */
        const loadGLB = (url, [lng, lat, z], scale = 1, rotDeg = 0) =>
          new Promise((resolve, reject) => {
            tb.Object3D(
              {
                obj: url,
                type: 'gltf',
                scale: scale,
                rotation: { x: 0, y: 0, z: (rotDeg * Math.PI) / 180 },
                units: 'meters',
                anchor: 'center'
              },
              function (obj) {
                // This callback is called when the model is loaded
                obj.setCoords([lng, lat, z]);
                tb.add(obj);
                resolve(obj);
              },
              function (err) {
                reject(err);
              }
            );
          });

        const base = process.env.PUBLIC_URL + "/models";

        Promise.all([
          loadGLB(`${base}/residential_complex.glb`, [-7.6964, 33.5347, 15], 3, 65),
          loadGLB(`${base}/buildings_from_trainz_simulator_2012.glb`, [-7.6955, 33.5345, 3], 0.16, 135)
        ])
        .then(() => {
          /* --- Directions control --- */
          directions.current = new MapboxDirections({
            accessToken: mapboxgl.accessToken,
            profile: "mapbox/driving",
            unit: "metric",
            controls: { profileSwitcher: true },
            flyTo: false
          });
          map.current.addControl(directions.current, "top-left");
          directions.current.setOrigin([-7.6964, 33.5347]);
          directions.current.setDestination([-7.6960, 33.5360]);

          setLoading(false);
        })
        .catch((e) => {
          setError("Model loading error: " + e.message);
          setLoading(false);
        });
      });

      map.current.on("error", e => {
        setError("Map error: " + (e.error || e.message));
        setLoading(false);
      });

    } catch (err) {
      setError("Initialisation error: " + err.message);
      setLoading(false);
    }
  };

  /* -------------------------------------------------
     3)  JSX
  -------------------------------------------------- */
  return (
    <div className="map-container">
      {error && (
        <div className="error-message">
          <b>Error: </b>{error}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading 3-D environment…</p>
        </div>
      )}

      <div ref={mapContainer} className="map" />
    </div>
  );
}
