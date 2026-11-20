/**
 * SOLITIUM // GEO-ENGINE & SEISMIC IMPACT CALCULATOR
 * Personal Proximity, Bearing, MMI Attenuation, Wave Arrival & Aftershock Clustering
 */

(function (window) {
    'use strict';

    // Quick City Presets (Default: Surakarta / Solo)
    const CITY_PRESETS = [
        { id: 'solo', name: 'Surakarta (Solo)', lat: -7.5755, lon: 110.8243, province: 'Jawa Tengah' },
        { id: 'madiun', name: 'Madiun', lat: -7.6298, lon: 111.5239, province: 'Jawa Timur' },
        { id: 'jogja', name: 'Yogyakarta', lat: -7.7956, lon: 110.3695, province: 'D.I. Yogyakarta' },
        { id: 'jakarta', name: 'Jakarta', lat: -6.2088, lon: 106.8456, province: 'DKI Jakarta' },
        { id: 'bandung', name: 'Bandung', lat: -6.9175, lon: 107.6191, province: 'Jawa Barat' },
        { id: 'surabaya', name: 'Surabaya', lat: -7.2575, lon: 112.7521, province: 'Jawa Timur' },
        { id: 'semarang', name: 'Semarang', lat: -6.9667, lon: 110.4167, province: 'Jawa Tengah' },
        { id: 'denpasar', name: 'Denpasar', lat: -8.6705, lon: 115.2126, province: 'Bali' },
        { id: 'medan', name: 'Medan', lat: 3.5952, lon: 98.6722, province: 'Sumatera Utara' },
        { id: 'makassar', name: 'Makassar', lat: -5.1477, lon: 119.4327, province: 'Sulawesi Selatan' }
    ];

    const DEFAULT_LOCATION = CITY_PRESETS[0]; // Surakarta / Solo
    const STORAGE_KEY = 'solitium_user_location';

    // 1. User Location Manager
    function getUserLocation() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.lat === 'number' && typeof parsed.lon === 'number') {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[Solitium GeoEngine] Failed to read cached location:', e);
        }
        return DEFAULT_LOCATION;
    }

    function setUserLocation(loc) {
        if (!loc || typeof loc.lat !== 'number' || typeof loc.lon !== 'number') return;
        const payload = {
            id: loc.id || 'custom',
            name: loc.name || 'Custom Coordinates',
            lat: Number(loc.lat),
            lon: Number(loc.lon),
            province: loc.province || '',
            isGPS: !!loc.isGPS
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('solitium:location-changed', { detail: payload }));
        return payload;
    }

    function detectGPSLocation(callback) {
        if (!navigator.geolocation) {
            callback({ success: false, message: 'Geolocation is not supported by your browser' });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = {
                    id: 'gps',
                    name: 'My GPS Location',
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    province: 'Device GPS',
                    isGPS: true
                };
                setUserLocation(loc);
                callback({ success: true, location: loc });
            },
            (err) => {
                callback({ success: false, message: err.message || 'GPS permission denied or unavailable' });
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
        );
    }

    // 2. Haversine Distance Calculation (km)
    function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const toRad = (x) => (x * Math.PI) / 180;
        const R = 6371; // Earth mean radius in km

        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // 3. Compass Bearing & Direction (Degrees -> 16-point compass)
    function calculateBearing(startLat, startLon, destLat, destLon) {
        const toRad = (x) => (x * Math.PI) / 180;
        const toDeg = (x) => (x * 180) / Math.PI;

        const y = Math.sin(toRad(destLon - startLon)) * Math.cos(toRad(destLat));
        const x =
            Math.cos(toRad(startLat)) * Math.sin(toRad(destLat)) -
            Math.sin(toRad(startLat)) * Math.cos(toRad(destLat)) * Math.cos(toRad(destLon - startLon));
        const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;

        const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
        const index = Math.round(brng / 22.5) % 16;
        return {
            degrees: Math.round(brng),
            compass: COMPASS_POINTS[index]
        };
    }

    // Helper: Proximity string (e.g. "142 km SW of your location in Surakarta")
    function formatProximity(userLat, userLon, targetLat, targetLon, cityName) {
        const distKm = Math.round(calculateHaversineDistance(userLat, userLon, targetLat, targetLon));
        // Bearing from user to target
        const bearing = calculateBearing(userLat, userLon, targetLat, targetLon);
        const cityLabel = cityName ? ` (${cityName})` : '';
        return {
            distanceKm: distKm,
            bearing: bearing.compass,
            degrees: bearing.degrees,
            text: `${distKm} km ${bearing.compass} of your location${cityLabel}`
        };
    }

    // 4. Felt Intensity (MMI) Attenuation Engine
    // Calculates estimated Modified Mercalli Intensity using standard attenuation relations
    function estimateMMI(magnitude, depthKm, distanceKm) {
        const mag = parseFloat(magnitude) || 5.0;
        const depth = Math.max(parseFloat(depthKm) || 10, 5);
        const dist = Math.max(parseFloat(distanceKm) || 1, 0.1);

        // Hypocentral distance
        const R_hypo = Math.sqrt(dist * dist + depth * depth);

        // Empirical attenuation model for Indonesian subduction & crustal events
        // Atkinson-Wald modified relation
        let mmiRaw = 1.5 * mag - 2.65 * Math.log(R_hypo) - 0.0028 * R_hypo + 3.15;

        // Depth correction factor (deeper quakes attenuate faster to surface)
        if (depth > 60) {
            mmiRaw -= (depth - 60) * 0.008;
        }

        mmiRaw = Math.max(1.0, Math.min(10.0, mmiRaw));
        const mmiRounded = Math.round(mmiRaw * 10) / 10;

        // Categorize into Roman Numerals & Public Safety Badges
        let roman = 'I';
        let label = 'Not Felt';
        let badgeClass = 'mmi-not-felt';
        let color = '#6B7280'; // gray
        let description = 'Imperceptible except by very few under especially favorable conditions.';
        let advice = 'No safety precautions required.';

        if (mmiRaw < 1.5) {
            roman = 'I';
            label = 'Not Felt';
            badgeClass = 'mmi-i';
            color = '#9CA3AF';
            description = 'No shaking felt by people. Recorded only by seismographs.';
            advice = 'No impact expected at your location.';
        } else if (mmiRaw < 2.5) {
            roman = 'II';
            label = 'Felt by Few';
            badgeClass = 'mmi-ii';
            color = '#3B82F6'; // blue
            description = 'Felt only by a few persons at rest, especially on upper floors of buildings.';
            advice = 'Normal activities may continue.';
        } else if (mmiRaw < 3.5) {
            roman = 'III';
            label = 'Weak Shaking';
            badgeClass = 'mmi-iii';
            color = '#0EA5E9'; // cyan/blue
            description = 'Felt noticeably indoors. Many people do not recognize it as an earthquake.';
            advice = 'Be aware of surroundings, monitor notifications.';
        } else if (mmiRaw < 4.5) {
            roman = 'IV';
            label = 'Light Shaking';
            badgeClass = 'mmi-iv';
            color = '#F59E0B'; // amber
            description = 'Felt indoors by many, outdoors by few. Dishes, windows, doors disturbed.';
            advice = 'Stay alert for potential aftershocks.';
        } else if (mmiRaw < 5.5) {
            roman = 'V';
            label = 'Moderate Shaking';
            badgeClass = 'mmi-v';
            color = '#F97316'; // orange
            description = 'Felt by nearly everyone; many awakened. Some dishes, windows broken.';
            advice = 'Move away from tall cabinets, windows, and unanchored items.';
        } else if (mmiRaw < 6.5) {
            roman = 'VI';
            label = 'Strong Shaking — Take Cover';
            badgeClass = 'mmi-vi';
            color = '#EA580C'; // deep orange
            description = 'Felt by all, many frightened. Some heavy furniture moved; plaster cracks.';
            advice = 'Drop, Cover, and Hold On! Protect head and neck.';
        } else if (mmiRaw < 7.5) {
            roman = 'VII';
            label = 'Very Strong Shaking — Take Cover';
            badgeClass = 'mmi-vii';
            color = '#DC2626'; // red
            description = 'Damage negligible in well-designed buildings; considerable in poorly built structures.';
            advice = 'Take shelter immediately under sturdy furniture. Evacuate after shaking stops.';
        } else {
            roman = 'VIII+';
            label = 'Severe Shaking — Seek Safety Immediately';
            badgeClass = 'mmi-viii';
            color = '#B91C1C'; // dark red
            description = 'Damage slight in specially designed structures; considerable in ordinary buildings.';
            advice = 'EVACUATE to open ground away from buildings, poles, and slopes after tremors subside.';
        }

        // Compute theoretical felt radius in kilometers for various MMI thresholds (for map overlays)
        // Solved approximately for distance where MMI reaches thresholds
        const feltRadii = {
            mmi2: Math.max(10, Math.round(Math.exp((1.5 * mag + 3.15 - 2.0) / 2.65))),
            mmi4: Math.max(5, Math.round(Math.exp((1.5 * mag + 3.15 - 4.0) / 2.65))),
            mmi6: Math.max(0, Math.round(Math.exp((1.5 * mag + 3.15 - 6.0) / 2.65)))
        };

        return {
            value: mmiRounded,
            roman,
            label,
            badgeClass,
            color,
            description,
            advice,
            radiiKm: feltRadii,
            hypocenterDistKm: Math.round(R_hypo)
        };
    }

    // 5. Theoretical Wave Arrival Estimator
    function calculateWaveArrivals(hypocentralDistKm) {
        const R = Math.max(hypocentralDistKm, 5);
        const VP = 6.0;  // P-wave velocity ~ 6.0 km/s in Indonesian crust
        const VS = 3.5;  // S-wave velocity ~ 3.5 km/s
        const V_SURF = 3.0; // Surface wave velocity ~ 3.0 km/s

        const pSeconds = Math.round((R / VP) * 10) / 10;
        const sSeconds = Math.round((R / VS) * 10) / 10;
        const surfSeconds = Math.round((R / V_SURF) * 10) / 10;
        const warningWindowSec = Math.max(0, Math.round((sSeconds - pSeconds) * 10) / 10);

        return {
            pWaveSeconds: pSeconds,
            sWaveSeconds: sSeconds,
            surfaceWaveSeconds: surfSeconds,
            warningGapSeconds: warningWindowSec,
            pWaveSpeed: '6.0 km/s',
            sWaveSpeed: '3.5 km/s'
        };
    }

    // 6. Aftershock Clustering Algorithm
    // Groups events within 50 km and 48 hours of a major event (M >= 5.0)
    function clusterAftershocks(eventsList, radiusKm = 50, windowHours = 48) {
        if (!Array.isArray(eventsList) || eventsList.length === 0) return [];

        // Parse date time into epoch ms
        const enriched = eventsList.map((e, index) => {
            let lat = 0, lon = 0;
            if (e.Coordinates) {
                const parts = e.Coordinates.split(',');
                lat = parseFloat(parts[0]);
                lon = parseFloat(parts[1]);
            } else {
                lat = parseFloat(e.Latitude || e.lat || 0);
                lon = parseFloat(e.Longitude || e.lon || 0);
            }

            // Parse date
            let timestamp = 0;
            if (e.DateTime) {
                timestamp = new Date(e.DateTime).getTime();
            } else if (e.Tanggal && e.Jam) {
                // e.g. "20 Nov 2026", "14:22:00 WIB"
                const cleanTime = e.Jam.replace(/\s*WIB/i, '').trim();
                const dStr = `${e.Tanggal} ${cleanTime}`;
                const parsedDate = new Date(dStr);
                timestamp = isNaN(parsedDate.getTime()) ? Date.now() - index * 3600000 : parsedDate.getTime();
            } else {
                timestamp = Date.now() - index * 3600000;
            }

            return {
                ...e,
                _index: index,
                _lat: lat,
                _lon: lon,
                _mag: parseFloat(e.Magnitude) || 5.0,
                _timestamp: timestamp,
                _clusterId: null,
                _isMainshock: false
            };
        });

        // Sort chronologically ascending
        enriched.sort((a, b) => a._timestamp - b._timestamp);

        const clusters = [];
        let nextClusterId = 1;

        // Identify candidates for mainshocks (Mag >= 5.0)
        for (let i = 0; i < enriched.length; i++) {
            const current = enriched[i];
            if (current._mag >= 5.0 && !current._clusterId) {
                // Check future events within windowHours and radiusKm
                const aftershocks = [];
                const maxTime = current._timestamp + windowHours * 3600 * 1000;

                for (let j = i + 1; j < enriched.length; j++) {
                    const candidate = enriched[j];
                    if (candidate._timestamp > maxTime) break;
                    if (candidate._clusterId) continue;

                    const dist = calculateHaversineDistance(current._lat, current._lon, candidate._lat, candidate._lon);
                    if (dist <= radiusKm) {
                        aftershocks.push(candidate);
                    }
                }

                if (aftershocks.length > 0) {
                    const cId = `CLUSTER_${nextClusterId++}`;
                    current._clusterId = cId;
                    current._isMainshock = true;

                    aftershocks.forEach(a => {
                        a._clusterId = cId;
                        a._isMainshock = false;
                    });

                    clusters.push({
                        clusterId: cId,
                        mainshock: current,
                        aftershocks: aftershocks,
                        totalEvents: aftershocks.length + 1,
                        region: current.Wilayah || current.Region || 'Unknown Region',
                        maxMagnitude: Math.max(current._mag, ...aftershocks.map(a => a._mag))
                    });
                }
            }
        }

        return {
            clusters,
            enrichedEvents: enriched
        };
    }

    // Expose on window.SolitiumGeo
    window.SolitiumGeo = {
        CITY_PRESETS,
        DEFAULT_LOCATION,
        getUserLocation,
        setUserLocation,
        detectGPSLocation,
        calculateHaversineDistance,
        calculateBearing,
        formatProximity,
        estimateMMI,
        calculateWaveArrivals,
        clusterAftershocks
    };

})(window);

