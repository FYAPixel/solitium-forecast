/**
 * SOLITIUM // PERSONAL SEISMIC IMPACT & WEATHER INTELLIGENCE PLATFORM
 * Main Orchestration Script
 */

document.addEventListener("DOMContentLoaded", () => {
    'use strict';

    // 1. Initialize Global Shared Components
    initNavigation();
    initLocationBar();

    // 2. Identify Current Page & Boot Respective Module
    const path = window.location.pathname.toLowerCase();
    const isDashboard = path.includes("dashboard") || document.getElementById("quake-map");
    const isRecent = path.includes("alerts") || path.includes("recent") || document.getElementById("recent-quakes-map");
    const isHistory = path.includes("earthquakes") || path.includes("history") || document.getElementById("history-table-body");
    const isWeather = path.includes("weather") || document.getElementById("weather-hero-container");

    if (isDashboard && document.getElementById("quake-map")) {
        initDashboard();
    } else if (isRecent && document.getElementById("recent-quakes-map")) {
        initRecentEarthquakes();
    } else if (isHistory && document.getElementById("history-table-body")) {
        initHistory();
    } else if (isWeather && document.getElementById("weather-hero-container")) {
        initWeather();
    }
});

/* ==========================================================================
   GLOBAL NAVIGATION & USER LOCATION BAR
   ========================================================================== */

function initNavigation() {
    // Mobile navigation drawer toggle
    const toggleBtn = document.querySelector(".nav-toggle-btn");
    const navLinks = document.querySelector(".nav-links");
    if (toggleBtn && navLinks) {
        toggleBtn.addEventListener("click", () => {
            navLinks.classList.toggle("open");
        });
    }

    // Set active link highlight based on current filename
    const currentPath = window.location.pathname.toLowerCase();
    const links = document.querySelectorAll(".nav-link");

    links.forEach(link => {
        const href = link.getAttribute("href")?.toLowerCase() || "";
        if (
            (currentPath.endsWith(href) && href !== "") ||
            (currentPath.includes("dashboard") && href.includes("dashboard")) ||
            ((currentPath.includes("alerts") || currentPath.includes("recent")) && (href.includes("alerts") || href.includes("recent"))) ||
            ((currentPath.includes("earthquakes") || currentPath.includes("history")) && (href.includes("earthquakes") || href.includes("history"))) ||
            (currentPath.includes("weather") && href.includes("weather"))
        ) {
            link.classList.add("active");
        }
    });
}

function initLocationBar() {
    const locationContainers = document.querySelectorAll(".location-bar-container");
    if (!locationContainers.length || !window.SolitiumGeo) return;

    const userLoc = window.SolitiumGeo.getUserLocation();
    const presets = window.SolitiumGeo.CITY_PRESETS;

    locationContainers.forEach(container => {
        container.innerHTML = `
            <div class="location-bar">
                <div class="location-current">
                    <i class="fa-solid fa-location-dot"></i>
                    <span>Personal Reference: <strong id="user-city-name">${userLoc.name}</strong></span>
                    ${userLoc.isGPS ? '<span class="location-badge-gps">GPS Active</span>' : ''}
                </div>
                <div class="location-actions">
                    <label for="city-selector" style="font-size: 11px; font-weight: 700; color: var(--text-muted);">CHANGE CITY:</label>
                    <select id="city-selector" class="city-select-dropdown" aria-label="Select Reference City">
                        ${presets.map(c => `
                            <option value="${c.id}" ${c.name === userLoc.name || (!userLoc.isGPS && c.id === userLoc.id) ? 'selected' : ''}>
                                ${c.name} (${c.province})
                            </option>
                        `).join('')}
                    </select>
                    <button type="button" id="btn-detect-gps" class="btn-gps" title="Detect GPS coordinates">
                        <i class="fa-solid fa-crosshairs"></i>
                        <span>Use GPS</span>
                    </button>
                </div>
            </div>
        `;

        // Bind dropdown change
        const select = container.querySelector("#city-selector");
        if (select) {
            select.addEventListener("change", (e) => {
                const chosen = presets.find(p => p.id === e.target.value);
                if (chosen) {
                    window.SolitiumGeo.setUserLocation(chosen);
                    window.location.reload();
                }
            });
        }

        // Bind GPS detect
        const gpsBtn = container.querySelector("#btn-detect-gps");
        if (gpsBtn) {
            gpsBtn.addEventListener("click", () => {
                gpsBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Detecting...`;
                window.SolitiumGeo.detectGPSLocation((res) => {
                    if (res.success) {
                        window.location.reload();
                    } else {
                        alert(`GPS Detection: ${res.message}. Falling back to default city.`);
                        gpsBtn.innerHTML = `<i class="fa-solid fa-crosshairs"></i> Use GPS`;
                    }
                });
            });
        }
    });
}

/* ==========================================================================
   MODULE 1: DASHBOARD (MAIN MAP, PROXIMITY & MMI)
   ========================================================================== */

function initDashboard() {
    const mapContainer = document.getElementById('quake-map');
    if (!mapContainer || !window.L) return;

    const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : { lat: -7.5755, lon: 110.8243, name: 'Surakarta' };
    let map, quakeMarker, userMarker, proximityLine;
    let faultLinesLayer = null;
    let pWaveCircle = null, sWaveCircle = null;

    // 1. Initialize Leaflet Map
    map = L.map('quake-map', {
        zoomControl: true,
        attributionControl: false
    }).setView([userLoc.lat, userLoc.lon], 6);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
    }).addTo(map);

    // Add Esri attribution discreetly in bottom right
    L.control.attribution({ position: 'bottomright', prefix: 'Tiles &copy; Esri' }).addTo(map);

    // Plot User Location Marker
    const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `
            <div style="position: relative; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 100%; height: 100%; background: #2563EB; border-radius: 50%; opacity: 0.25; animation: pWaveRipple 2s infinite;"></div>
                <div style="width: 10px; height: 10px; background: #2563EB; border: 2px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.3);"></div>
            </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    userMarker = L.marker([userLoc.lat, userLoc.lon], { icon: userIcon }).addTo(map);
    userMarker.bindPopup(`
        <div style="font-family: 'Mona Sans', sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="color: #2563EB;">Your Location</strong><br>
            <span>${userLoc.name}</span><br>
            <small style="color: #6B7280;">${userLoc.lat.toFixed(4)}, ${userLoc.lon.toFixed(4)}</small>
        </div>
    `);

    // Fault Lines Layer
    if (window.SolitiumFaults) {
        faultLinesLayer = window.SolitiumFaults.createLayer(map, { addToMap: true });
    }

    // 2. Fetch Latest BMKG Earthquake
    async function loadLatestEarthquake() {
        if (!window.SolitiumBMKG) return;

        const result = await window.SolitiumBMKG.getLatestEarthquake();
        const quake = result.data;
        if (!quake) return;

        // Render Telemetry Elements
        setText("feed-status", result.isLive ? `LIVE_FEED // ${quake.Jam}` : (result.isCached ? "CACHED_FEED // OFFLINE MODE" : "DEMO_FEED // LOCAL BACKUP"));
        setText("quake-mag", `M ${quake.Magnitude}`);
        setText("quake-depth", quake.Kedalaman);
        setText("quake-time", `${quake.Tanggal} - ${quake.Jam}`);
        setText("quake-region", quake.Wilayah);
        setText("quake-potential", quake.Potensi);

        // Proximity & Bearing
        const proxEl = document.getElementById("quake-proximity");
        if (proxEl && quake._proximity) {
            proxEl.innerHTML = `<i class="fa-solid fa-location-arrow"></i> ${quake._proximity.text}`;
        }

        // Felt Intensity (MMI) Badge & Info
        const mmiContainer = document.getElementById("quake-mmi-container");
        if (mmiContainer && quake._mmi) {
            mmiContainer.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                    <span class="mmi-badge ${quake._mmi.badgeClass}">
                        <i class="fa-solid fa-gauge-high"></i>
                        MMI ${quake._mmi.roman} • ${quake._mmi.label}
                    </span>
                    <span style="font-size: 12px; color: var(--text-muted);">${quake._mmi.advice}</span>
                </div>
            `;
        }

        // Wave Arrival Telemetry Widget
        const waveContainer = document.getElementById("quake-wave-arrivals");
        if (waveContainer && quake._waveArrivals) {
            const w = quake._waveArrivals;
            waveContainer.innerHTML = `
                <div class="wave-arrival-container">
                    <div class="wave-arrival-title">
                        <i class="fa-solid fa-water"></i>
                        <span>Wave Arrival Estimator (${userLoc.name})</span>
                    </div>
                    <div class="wave-grid">
                        <div class="wave-cell">
                            <span class="wave-label">P-WAVE</span>
                            <span class="wave-val">${w.pWaveSeconds}s</span>
                        </div>
                        <div class="wave-cell">
                            <span class="wave-label">S-WAVE</span>
                            <span class="wave-val highlight">${w.sWaveSeconds}s</span>
                        </div>
                        <div class="wave-cell">
                            <span class="wave-label">LEAD TIME</span>
                            <span class="wave-val">${w.warningGapSeconds}s</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Plot Epicenter on Leaflet Map
        plotEpicenter(quake);
    }

    function plotEpicenter(quake) {
        if (!map || isNaN(quake._lat) || isNaN(quake._lon)) return;

        const latLng = [quake._lat, quake._lon];

        // Fit bounds to show both user and epicenter
        const bounds = L.latLngBounds([userLoc.lat, userLoc.lon], latLng);
        map.fitBounds(bounds.pad(0.35));

        // Remove previous layers
        if (quakeMarker) map.removeLayer(quakeMarker);
        if (proximityLine) map.removeLayer(proximityLine);
        if (pWaveCircle) map.removeLayer(pWaveCircle);
        if (sWaveCircle) map.removeLayer(sWaveCircle);

        // Concentric Animated Wave Ripples
        // P-Wave Ripple (Large, outer blue/cyan circle)
        pWaveCircle = L.circle(latLng, {
            radius: Math.min(240000, Math.max(40000, quake._mmi.radiiKm.mmi2 * 1000)),
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '4, 4'
        }).addTo(map);

        // S-Wave Ripple (Inner destructive zone)
        sWaveCircle = L.circle(latLng, {
            radius: Math.min(120000, Math.max(20000, quake._mmi.radiiKm.mmi4 * 1000)),
            color: '#FF5500',
            fillColor: '#FF5500',
            fillOpacity: 0.15,
            weight: 2
        }).addTo(map);

        // Epicenter Circle Marker with pulsing core
        quakeMarker = L.circleMarker(latLng, {
            color: '#FFFFFF',
            fillColor: '#FF5500',
            fillOpacity: 0.95,
            radius: 12,
            weight: 3
        }).addTo(map);

        // Connecting dashed line between user & epicenter
        proximityLine = L.polyline([[userLoc.lat, userLoc.lon], latLng], {
            color: '#6B7280',
            weight: 2,
            dashArray: '6, 6',
            opacity: 0.7
        }).addTo(map);

        quakeMarker.bindPopup(`
            <div style="font-family: 'Mona Sans', sans-serif; font-size: 13px; min-width: 200px; line-height: 1.4;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <span style="font-size: 14px; font-weight: 800; color: #FF5500;">Magnitude ${quake.Magnitude}</span>
                    <span class="mmi-badge ${quake._mmi.badgeClass}" style="font-size: 10px; padding: 2px 6px;">MMI ${quake._mmi.roman}</span>
                </div>
                <strong style="color: #111827; display: block; margin-bottom: 4px;">${quake.Wilayah}</strong>
                <div style="font-size: 11.5px; color: #4B566B; margin-bottom: 4px;">
                    <strong>Depth:</strong> ${quake.Kedalaman} | <strong>Time:</strong> ${quake.Jam}
                </div>
                <div style="font-size: 11.5px; color: var(--accent-orange); font-weight: 600; border-top: 1px solid #E5E7EB; padding-top: 4px;">
                    <i class="fa-solid fa-location-arrow"></i> ${quake._proximity.text}
                </div>
            </div>
        `).openPopup();
    }

    // 3. Map Control Toolbar Handlers
    const toggleFaultsBtn = document.getElementById("btn-toggle-faults");
    if (toggleFaultsBtn && faultLinesLayer) {
        toggleFaultsBtn.addEventListener("click", () => {
            if (map.hasLayer(faultLinesLayer)) {
                map.removeLayer(faultLinesLayer);
                toggleFaultsBtn.classList.remove("active");
            } else {
                map.addLayer(faultLinesLayer);
                toggleFaultsBtn.classList.add("active");
            }
        });
    }

    const resetMapBtn = document.getElementById("btn-reset-map");
    if (resetMapBtn) {
        resetMapBtn.addEventListener("click", () => {
            map.setView([userLoc.lat, userLoc.lon], 6);
        });
    }

    // Load Live Earthquake
    loadLatestEarthquake();
}

/* ==========================================================================
   MODULE 2: RECENT EARTHQUAKES (SEARCH, FILTERS, INTERACTIVE MAP & MODAL)
   ========================================================================== */

function initRecentEarthquakes() {
    const mapEl = document.getElementById("recent-quakes-map");
    const listEl = document.getElementById("recent-quakes-list");
    const countEl = document.getElementById("recent-quake-count");
    if (!mapEl || !listEl || !window.SolitiumBMKG) return;

    const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : { lat: -7.5755, lon: 110.8243, name: 'Surakarta' };
    let map, markersLayer = null;
    let allQuakes = [];
    let selectedMarker = null;

    // Initialize Map
    map = L.map('recent-quakes-map', {
        zoomControl: true,
        attributionControl: false
    }).setView([-2.5489, 118.0149], 5);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: 'Tiles &copy; Esri' }).addTo(map);

    if (window.SolitiumFaults) {
        window.SolitiumFaults.createLayer(map, { addToMap: true });
    }

    // User marker
    L.circleMarker([userLoc.lat, userLoc.lon], {
        radius: 8,
        color: '#FFFFFF',
        fillColor: '#2563EB',
        fillOpacity: 1,
        weight: 2
    }).addTo(map).bindPopup(`<strong>Your Location:</strong> ${userLoc.name}`);

    // Modal elements
    const modalOverlay = document.getElementById("quake-modal-overlay");
    const modalBody = document.getElementById("quake-modal-body");
    const modalClose = document.getElementById("quake-modal-close");

    if (modalClose && modalOverlay) {
        modalClose.addEventListener("click", () => modalOverlay.classList.remove("open"));
        modalOverlay.addEventListener("click", (e) => {
            if (e.target === modalOverlay) modalOverlay.classList.remove("open");
        });
    }

    // Filter Elements
    const searchInput = document.getElementById("filter-search");
    const magSelect = document.getElementById("filter-mag");
    const depthSelect = document.getElementById("filter-depth");
    const distSelect = document.getElementById("filter-dist");
    const btnReset = document.getElementById("filter-reset");

    async function loadData() {
        listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading recent seismic events...</div>`;

        const res = await window.SolitiumBMKG.getAllRecentEarthquakes();
        allQuakes = res.items || [];
        applyFilters();
    }

    function applyFilters() {
        const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
        const minMag = magSelect ? parseFloat(magSelect.value) || 0 : 0;
        const depthVal = depthSelect ? depthSelect.value : "all";
        const maxDist = distSelect ? parseFloat(distSelect.value) || Infinity : Infinity;

        const filtered = allQuakes.filter(q => {
            // Text search
            if (query && !q.Wilayah.toLowerCase().includes(query)) return false;
            // Mag filter
            if (q._magnitude < minMag) return false;
            // Depth filter
            if (depthVal === "shallow" && q._depthKm >= 60) return false;
            if (depthVal === "intermediate" && (q._depthKm < 60 || q._depthKm > 300)) return false;
            if (depthVal === "deep" && q._depthKm <= 300) return false;
            // Distance filter
            if (q._proximity && q._proximity.distanceKm > maxDist) return false;

            return true;
        });

        if (countEl) countEl.textContent = `${filtered.length} Events Displayed`;
        renderList(filtered);
        plotMapMarkers(filtered);
    }

    function renderList(quakes) {
        if (quakes.length === 0) {
            listEl.innerHTML = `
                <div style="padding: 32px; text-align: center; color: var(--text-muted);">
                    <i class="fa-solid fa-filter-circle-xmark" style="font-size: 28px; margin-bottom: 8px;"></i>
                    <p>No earthquakes match your current filter parameters.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = quakes.map((q, idx) => `
            <div class="quake-card-item" data-id="${q._id}" data-index="${idx}">
                <div class="quake-card-header">
                    <span class="quake-mag-tag">M ${q.Magnitude}</span>
                    <span class="quake-time-tag">${q.Tanggal} • ${q.Jam}</span>
                </div>
                <div class="quake-region-text">${q.Wilayah}</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <span class="mmi-badge ${q._mmi.badgeClass}" style="font-size: 10px; padding: 2px 6px;">
                        MMI ${q._mmi.roman} • ${q._mmi.label}
                    </span>
                    <span style="font-size: 11px; color: var(--text-muted);">Depth: <strong>${q.Kedalaman}</strong></span>
                </div>
                <div class="quake-card-footer">
                    <span style="color: var(--accent-orange); font-weight: 600;">
                        <i class="fa-solid fa-location-arrow"></i> ${q._proximity.distanceKm} km ${q._proximity.bearing}
                    </span>
                    <span style="text-decoration: underline; font-weight: 600; color: var(--text-muted);">View Telemetry &rarr;</span>
                </div>
            </div>
        `).join('');

        // Card Click Handler
        listEl.querySelectorAll(".quake-card-item").forEach(card => {
            card.addEventListener("click", () => {
                const idx = parseInt(card.getAttribute("data-index"), 10);
                const q = quakes[idx];
                if (!q) return;

                // Highlight card
                listEl.querySelectorAll(".quake-card-item").forEach(c => c.classList.remove("selected"));
                card.classList.add("selected");

                // Pan Map
                if (map && !isNaN(q._lat) && !isNaN(q._lon)) {
                    map.setView([q._lat, q._lon], 7, { animate: true });
                }

                // Open Detail Modal
                openDetailModal(q);
            });
        });
    }

    function plotMapMarkers(quakes) {
        if (!map) return;
        if (markersLayer) map.removeLayer(markersLayer);

        markersLayer = L.featureGroup();

        quakes.forEach(q => {
            if (isNaN(q._lat) || isNaN(q._lon)) return;

            const mag = q._magnitude;
            const color = mag >= 6.0 ? '#DC2626' : mag >= 5.0 ? '#FF5500' : '#F59E0B';
            const radius = Math.max(6, Math.min(14, mag * 2));

            const m = L.circleMarker([q._lat, q._lon], {
                radius: radius,
                color: '#FFFFFF',
                fillColor: color,
                fillOpacity: 0.9,
                weight: 1.5
            });

            m.bindPopup(`
                <div style="font-family: 'Mona Sans', sans-serif; font-size: 12px; min-width: 180px;">
                    <strong style="color: ${color}; font-size: 13px;">Magnitude ${q.Magnitude}</strong><br>
                    <span>${q.Wilayah}</span><br>
                    <small>Kedalaman: ${q.Kedalaman} | ${q.Jam}</small><br>
                    <small style="color: #FF5500;">${q._proximity.text}</small>
                </div>
            `);

            m.on('click', () => openDetailModal(q));
            markersLayer.addLayer(m);
        });

        markersLayer.addTo(map);
    }

    function openDetailModal(q) {
        if (!modalOverlay || !modalBody) return;

        modalBody.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="quake-mag-tag" style="font-size: 20px; padding: 4px 12px;">M ${q.Magnitude}</span>
                    <span class="mmi-badge ${q._mmi.badgeClass}">MMI ${q._mmi.roman} • ${q._mmi.label}</span>
                </div>
                <span class="tsunami-badge" style="margin: 0;">${q.Potensi || 'Tidak berpotensi tsunami'}</span>
            </div>

            <h3 style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">${q.Wilayah}</h3>
            <p style="font-size: 12px; font-family: monospace; color: var(--text-muted); margin-bottom: 16px;">
                ${q.Tanggal} • ${q.Jam} • Epicenter: ${q._lat.toFixed(4)}, ${q._lon.toFixed(4)}
            </p>

            <div class="quake-meta-grid" style="margin-bottom: 16px;">
                <div class="meta-item">
                    <span class="meta-label">DEPTH</span>
                    <span class="meta-value accent-text">${q.Kedalaman}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">DISTANCE FROM YOU</span>
                    <span class="meta-value accent-text">${q._proximity.distanceKm} km ${q._proximity.bearing}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">YOUR CITY REF</span>
                    <span class="meta-value">${q._userRefLoc}</span>
                </div>
            </div>

            <div class="wave-arrival-container" style="margin-bottom: 16px;">
                <div class="wave-arrival-title">
                    <i class="fa-solid fa-water"></i>
                    <span>Wave Arrival Estimator at ${q._userRefLoc}</span>
                </div>
                <div class="wave-grid">
                    <div class="wave-cell">
                        <span class="wave-label">P-WAVE TIME</span>
                        <span class="wave-val">${q._waveArrivals.pWaveSeconds}s</span>
                    </div>
                    <div class="wave-cell">
                        <span class="wave-label">S-WAVE TIME</span>
                        <span class="wave-val highlight">${q._waveArrivals.sWaveSeconds}s</span>
                    </div>
                    <div class="wave-cell">
                        <span class="wave-label">WARNING LEAD TIME</span>
                        <span class="wave-val">${q._waveArrivals.warningGapSeconds}s</span>
                    </div>
                </div>
            </div>

            <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 6px; padding: 12px; font-size: 12px;">
                <strong>Impact & Safety Directive:</strong>
                <p style="margin: 4px 0 0 0; color: var(--text-muted);">${q._mmi.advice}</p>
                ${q.Dirasakan ? `<p style="margin: 6px 0 0 0; color: #4B566B;"><strong>Felt Reports:</strong> ${q.Dirasakan}</p>` : ''}
            </div>
        `;

        modalOverlay.classList.add("open");
    }

    // Attach Filter Event Listeners
    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (magSelect) magSelect.addEventListener("change", applyFilters);
    if (depthSelect) depthSelect.addEventListener("change", applyFilters);
    if (distSelect) distSelect.addEventListener("change", applyFilters);
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (magSelect) magSelect.value = "0";
            if (depthSelect) depthSelect.value = "all";
            if (distSelect) distSelect.value = "all";
            applyFilters();
        });
    }

    loadData();
}

/* ==========================================================================
   MODULE 3: EARTHQUAKE HISTORY (CLUSTERING, LOG & CSV/JSON EXPORT)
   ========================================================================== */

function initHistory() {
    const tableBody = document.getElementById("history-table-body");
    const clusterContainer = document.getElementById("cluster-list-container");
    if (!tableBody || !window.SolitiumBMKG) return;

    const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : { lat: -7.5755, lon: 110.8243, name: 'Surakarta' };
    let historyEvents = [];

    function renderHistory() {
        historyEvents = window.SolitiumBMKG.getHistoryLog();

        // 1. Calculate Summary Telemetry Cards
        const telemetry = window.SolitiumBMKG.computeHistoryTelemetry(historyEvents, userLoc);
        setText("hist-max-mag", `M ${telemetry.maxMagnitude}`);
        setText("hist-total-events", telemetry.totalEvents);
        setText("hist-closest-dist", `${telemetry.closestDistanceKm} km`);
        setText("hist-closest-sub", telemetry.closestEvent ? `${telemetry.closestEvent.Wilayah.slice(0, 32)}...` : '--');

        // 2. Run Aftershock Clustering
        const clusterResult = window.SolitiumGeo.clusterAftershocks(historyEvents, 50, 48);
        const clusters = clusterResult.clusters || [];
        setText("hist-cluster-count", clusters.length);

        // Render Cluster List
        if (clusterContainer) {
            if (clusters.length === 0) {
                clusterContainer.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">No aftershock sequences currently detected within 50 km and 48 hours.</div>`;
            } else {
                clusterContainer.innerHTML = clusters.map(c => `
                    <div class="cluster-item">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span class="quake-mag-tag" style="font-size: 11px; padding: 2px 6px;">Mainshock M ${c.mainshock._mag}</span>
                                <strong style="font-size: 13px; color: var(--text-main);">${c.region}</strong>
                            </div>
                            <div style="font-size: 11.5px; color: var(--text-muted);">
                                Sequence Time: ${c.mainshock.Tanggal} ${c.mainshock.Jam} • Max Sequence Mag: M ${c.maxMagnitude.toFixed(1)}
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <span class="mmi-badge mmi-iv" style="font-size: 10px;">
                                <i class="fa-solid fa-burst"></i> ${c.aftershocks.length} Aftershocks Detected
                            </span>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 3. Render Table
        tableBody.innerHTML = historyEvents.map(e => `
            <tr>
                <td><strong>${e.Tanggal}</strong><br><small style="color: var(--text-muted);">${e.Jam}</small></td>
                <td><span class="quake-mag-tag" style="font-size: 12px;">M ${e.Magnitude}</span></td>
                <td>${e.Kedalaman}</td>
                <td style="max-width: 280px; white-space: normal; line-height: 1.4;">${e.Wilayah}</td>
                <td><strong>${e._proximity ? e._proximity.distanceKm + ' km ' + e._proximity.bearing : '--'}</strong></td>
                <td><span class="mmi-badge ${e._mmi.badgeClass}" style="font-size: 10px;">MMI ${e._mmi.roman}</span></td>
                <td><span class="tsunami-badge" style="font-size: 10px; margin: 0;">${e.Potensi ? (e.Potensi.toLowerCase().includes('tidak') ? 'Aman' : 'Waspada') : 'Aman'}</span></td>
            </tr>
        `).join('');
    }

    // Export Handlers (JSON Only)
    const btnJson = document.getElementById("btn-export-json");
    if (btnJson) {
        btnJson.addEventListener("click", () => {
            window.SolitiumBMKG.exportToJSON(historyEvents);
        });
    }

    const btnResetData = document.getElementById("btn-reset-history");
    if (btnResetData) {
        btnResetData.addEventListener("click", () => {
            if (confirm("Reset historical seismic sequence to default seed catalog?")) {
                window.SolitiumBMKG.clearHistoryLog();
                renderHistory();
            }
        });
    }

    renderHistory();
}

/* ==========================================================================
   MODULE 4: WEATHER FORECAST (CURRENT, TIMELINE & COMMUTER ADVISORY)
   ========================================================================== */

function initWeather() {
    const heroContainer = document.getElementById("weather-hero-container");
    const advisoryContainer = document.getElementById("weather-advisory-container");
    const hourlyContainer = document.getElementById("weather-hourly-container");
    const dailyContainer = document.getElementById("weather-daily-container");
    const citySelect = document.getElementById("weather-city-select");

    if (!heroContainer || !window.SolitiumBMKG) return;

    const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : { id: 'solo' };
    let currentCityKey = userLoc.id && userLoc.id !== 'custom' && userLoc.id !== 'gps' ? userLoc.id : 'solo';

    if (citySelect) {
        citySelect.value = currentCityKey;
        citySelect.addEventListener("change", (e) => {
            currentCityKey = e.target.value;
            loadWeather(currentCityKey);
        });
    }

    async function loadWeather(cityKey) {
        heroContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching meteorological telemetry...</div>`;

        const res = await window.SolitiumBMKG.getWeatherForecast(cityKey);
        const w = res.data;
        if (!w) return;

        // 1. Current Conditions Hero Card
        heroContainer.innerHTML = `
            <div class="weather-hero-card">
                <div style="font-size: 11px; font-family: monospace; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
                    <i class="fa-solid fa-cloud-sun"></i> REGIONAL FORECAST // ${w.city.toUpperCase()} (${w.province.toUpperCase()})
                </div>
                <div class="weather-current-row">
                    <div class="weather-temp-block">
                        <i class="fa-solid ${w.current.icon} weather-big-icon"></i>
                        <div>
                            <div class="weather-temp-num">${w.current.temp}&deg;C</div>
                            <div class="weather-condition-desc">${w.current.condition}</div>
                            <div class="weather-feels-like">Feels like ${w.current.feelsLike}&deg;C</div>
                        </div>
                    </div>
                    <div class="weather-metrics-pills">
                        <div class="weather-pill">
                            <i class="fa-solid fa-droplet"></i>
                            <div>
                                <div style="font-size: 10px; color: var(--text-muted);">HUMIDITY</div>
                                <strong>${w.current.humidity}%</strong>
                            </div>
                        </div>
                        <div class="weather-pill">
                            <i class="fa-solid fa-wind"></i>
                            <div>
                                <div style="font-size: 10px; color: var(--text-muted);">WIND</div>
                                <strong>${w.current.windSpeed} km/h (${w.current.windDir})</strong>
                            </div>
                        </div>
                        <div class="weather-pill">
                            <i class="fa-solid fa-gauge"></i>
                            <div>
                                <div style="font-size: 10px; color: var(--text-muted);">PRESSURE</div>
                                <strong>${w.current.pressure} hPa</strong>
                            </div>
                        </div>
                        <div class="weather-pill">
                            <i class="fa-solid fa-shield-halved"></i>
                            <div>
                                <div style="font-size: 10px; color: var(--text-muted);">AIR STATUS</div>
                                <strong style="color: #10B981;">Baik (Good)</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 2. Commuter & Outdoor Advisory Card
        if (advisoryContainer) {
            const adv = w.advisory;
            advisoryContainer.innerHTML = `
                <div class="advisory-card">
                    <h2 class="card-title">Commuter & Outdoor Advisory</h2>
                    <p class="card-text">Automated meteorological alerts computed for regional transit, cycling, and outdoor activities.</p>
                    <div class="advisory-grid">
                        <div class="advisory-item">
                            <div class="advisory-header">
                                <span class="advisory-title">
                                    <i class="fa-solid fa-cloud-showers-heavy" style="color: ${adv.rainColor};"></i>
                                    Rain Window Risk
                                </span>
                                <span class="advisory-badge" style="background-color: ${adv.rainColor}1A; color: ${adv.rainColor}; border: 1px solid ${adv.rainColor}44;">
                                    ${adv.rainBadge}
                                </span>
                            </div>
                            <p class="advisory-text">${adv.rainAdvice}</p>
                        </div>
                        <div class="advisory-item">
                            <div class="advisory-header">
                                <span class="advisory-title">
                                    <i class="fa-solid fa-temperature-arrow-up" style="color: ${adv.heatColor};"></i>
                                    Heat & Humidity Index
                                </span>
                                <span class="advisory-badge" style="background-color: ${adv.heatColor}1A; color: ${adv.heatColor}; border: 1px solid ${adv.heatColor}44;">
                                    ${adv.heatRisk}
                                </span>
                            </div>
                            <p class="advisory-text">${adv.heatAdvice}</p>
                        </div>
                    </div>
                </div>
            `;
        }

        // 3. Hourly Timeline
        if (hourlyContainer) {
            hourlyContainer.innerHTML = `
                <h2 class="card-title">3-Hour Interval Progression</h2>
                <div class="hourly-timeline">
                    ${w.hourly.map(h => `
                        <div class="hourly-card">
                            <span class="hourly-time">${h.time}</span>
                            <i class="fa-solid ${h.icon} hourly-icon"></i>
                            <span class="hourly-temp">${h.temp}&deg;</span>
                            <span class="hourly-pop"><i class="fa-solid fa-droplet"></i> ${h.pop}%</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // 4. 3-Day Outlook
        if (dailyContainer) {
            dailyContainer.innerHTML = `
                <h2 class="card-title">3-Day Regional Outlook</h2>
                <div class="daily-grid">
                    ${w.daily.map(d => `
                        <div class="daily-card">
                            <div>
                                <strong style="font-size: 14px; color: var(--text-main); display: block;">${d.day}</strong>
                                <span style="font-size: 11.5px; color: var(--text-muted);">${d.date}</span>
                                <div style="font-size: 12px; font-weight: 600; color: #4B566B; margin-top: 4px;">${d.condition}</div>
                            </div>
                            <div style="text-align: right;">
                                <i class="fa-solid ${d.icon}" style="font-size: 22px; color: var(--accent-orange); margin-bottom: 4px;"></i>
                                <div style="font-size: 14px; font-weight: 800; color: var(--text-main);">${d.maxTemp}&deg; / <span style="color: var(--text-muted); font-size: 12px;">${d.minTemp}&deg;</span></div>
                                <span style="font-size: 11px; color: #2563EB; font-weight: 600;"><i class="fa-solid fa-droplet"></i> ${d.pop}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    }

    loadWeather(currentCityKey);
}

// Utility: DOM text setter
function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}
