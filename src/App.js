import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDirections from '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions';
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import "./App.css";

// Initialize Mapbox token (should be in your environment variables)
mapboxgl.accessToken = "pk.eyJ1IjoiZXNzYWRpa2luZSIsImEiOiJjbWJnaTR0NmcwOWR4MmxxdDRtbXR5eHVpIn0.f_FF7MHLTPqj2K_dZnPv_w";
const Threebox = window.Threebox;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const directions = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!mapboxgl.accessToken) {
      setError("Mapbox access token is missing");
      return;
    }

    try {
      // Initialize map
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: "mapbox://styles/mapbox/satellite-streets-v11",
        center: [-7.6941424, 33.5343694],
        zoom: 16,
        pitch: 60,
        bearing: -17,
        antialias: true
      });

      // Add basic controls
      map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
      map.current.addControl(new mapboxgl.ScaleControl());

      // Add 3D terrain
      map.current.on("style.load", () => {
        map.current.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14
        });

        map.current.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

        // Add sky layer
        map.current.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 15
          }
        });

        // Add 3D buildings
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

        // Initialize Threebox for 3D models
        const tb = new Threebox(
          map.current,
          map.current.getCanvas().getContext("webgl"),
          {
            defaultLights: true,
            enableSelectingObjects: true,
            enableTooltips: true
          }
        );

        // Helper function to load GLB models
        const addModel = async (url, position, scale, rotation) => {
          try {
            const model = await tb.loadGLTF(url);
            model.setCoords([position[0], position[1], position[2] || 0]);
            model.setScale(scale);
            model.setRotation({ x: 0, y: 0, z: rotation || 0 });
            tb.add(model);
            
            // Adjust model scale based on zoom
            map.current.on("zoom", () => {
              const zoom = map.current.getZoom();
              const zoomScale = Math.min(1, Math.max(0.5, zoom / 16));
              model.setScale(scale * zoomScale);
            });
          } catch (err) {
            console.error(`Error loading model ${url}:`, err);
          }
        };

        // Add residential complex
        addModel(
          "./models/residential_complex.glb",
          [-7.6964, 33.5347, 15],
          3,
          65
        );

        // Add Trainz buildings
        addModel(
          "./models/buildings_from_trainz_simulator_2012.glb",
          [-7.6955, 33.5345, 3],
          0.16,
          135
        );

        // Add directions control
        directions.current = new MapboxDirections({
          accessToken: mapboxgl.accessToken,
          unit: "metric",
          profile: "mapbox/driving",
          controls: {
            inputs: true,
            instructions: true,
            profileSwitcher: true
          },
          flyTo: false
        });

        map.current.addControl(directions.current, "top-left");

        // Set default route from residential complex to Hassan II Mosque
        setTimeout(() => {
          directions.current.setOrigin([-7.6964, 33.5347]);
          directions.current.setDestination([-7.6960, 33.5360]);
        }, 2000);

        setLoading(false);
      });

      // Error handling
      map.current.on("error", (err) => {
        setError(`Map error: ${err.error}`);
      });

      // Cleanup
      return () => {
        if (map.current) map.current.remove();
      };
    } catch (err) {
      setError(`Initialization error: ${err.message}`);
    }
  }, []);

  return (
    <div className="map-container">
      {error ? (
        <div className="error-message">{error}</div>
      ) : loading ? (
        <div className="loading-overlay">
          <div className="loading-content">
            <h2>Loading 3D Map...</h2>
            <progress value="0" max="100"></progress>
          </div>
        </div>
      ) : null}
      <div ref={mapContainer} className="map" />
    </div>
  );
}