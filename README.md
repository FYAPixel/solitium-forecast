# SOLITIUM

A lightweight, real-time seismic monitoring and meteorological dashboard for Indonesia, powered by official BMKG Open Data APIs. Built with a clean, soft-white utility interface, interactive epicenter mapping, and fast client-side caching.

---

## About SOLITIUM

**Solitium** is an independent **student project** developed by **FAYPixel** as part of my software engineering coursework and portfolio at **IDN Boarding School**.

The primary objective of Solitium is to practice real-world API integration, asynchronous JavaScript (`fetch`, `AbortController`, and `localStorage` caching), and geospatial data visualization without relying on heavy frontend frameworks.

---

## Key Features

- **Live Earthquake Monitor:** Fetches the latest seismic event from BMKG (`autogempa.json`), displaying magnitude, depth, timestamp, affected region, and tsunami potential status.
- **Interactive Epicenter Mapping:** Integrates **Leaflet.js** with Esri World Light Gray tiles to plot earthquake coordinates directly onto an interactive map with custom markers.
- **Seismic History Log:** Queries BMKG's recent earthquake feed (`gempaterkini.json`) to render a structured, scannable table of the 15 most recent major seismic events.
- **Regional Weather Forecasts:** Displays local weather data across Indonesian regions using BMKG meteorological endpoints.
- **Instant Cache & Fallback Protection:** Uses `localStorage` caching and a 5-second request timeout so the dashboard renders immediately on reload and stays functional even on unstable connections.

---

## Tech Stack

- **HTML5:** Semantic multi-page structure.
- **CSS3:** Custom CSS variables, flexbox, CSS grids, and responsive layouts.
- **Javascript:** Asynchronous API fetching, DOM manipulation.
- **Leaflet.JS:** Interactive map rendering and coordinate plotting.
- **BMKG Open Data API:** Live seismic and meteorological JSON feeds (`data.bmkg.go.id`).
