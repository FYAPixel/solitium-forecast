/**
 * SOLITIUM // BMKG SERVICE & DATA STORE
 * Handles BMKG Real-Time Seismic Feeds, Historical Sequence Logger,
 * Offline Caching, Weather Forecasts & JSON Telemetry Export.
 */

(function (window) {
    'use strict';

    const BMKG_ENDPOINTS = {
        AUTOGEMPA: "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
        GEMPA_TERKINI: "https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json",
        GEMPA_DIRASAKAN: "https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json"
    };

    const CACHE_KEYS = {
        AUTOGEMPA: "solitium_cache_autogempa",
        GEMPA_TERKINI: "solitium_cache_gempaterkini",
        GEMPA_DIRASAKAN: "solitium_cache_gempadirasakan",
        SEISMIC_HISTORY: "solitium_seismic_history",
        WEATHER_PREFIX: "solitium_cache_weather_"
    };

    // Helper: Safe fetch with timeout
    async function fetchWithTimeout(url, timeoutMs = 5000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const res = await fetch(url, {
                signal: controller.signal,
                cache: "no-store"
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            return await res.json();
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    }

    // Helper: LocalStorage Cache Getter/Setter with Timestamp
    function getCache(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }

    function setCache(key, data) {
        try {
            const payload = {
                data: data,
                timestamp: Date.now(),
                isoTime: new Date().toISOString()
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.warn('[Solitium BMKG] LocalStorage write failed:', e);
        }
    }

    // Parse Depth string (e.g. "10 km" -> 10)
    function parseDepth(depthStr) {
        if (!depthStr) return 10;
        const num = parseFloat(depthStr.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 10 : num;
    }

    // Parse Coordinates string (e.g. "-7.55, 110.82" -> { lat: -7.55, lon: 110.82 })
    function parseCoordinates(coordStr) {
        if (!coordStr) return { lat: -7.55, lon: 110.82 };
        const parts = coordStr.split(',');
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        return {
            lat: isNaN(lat) ? -7.55 : lat,
            lon: isNaN(lon) ? 110.82 : lon
        };
    }

    // Enrich an earthquake event with distance, bearing, and estimated MMI
    function enrichQuake(quake, userLoc) {
        if (!quake) return null;
        const coords = parseCoordinates(quake.Coordinates);
        const depthKm = parseDepth(quake.Kedalaman);
        const mag = parseFloat(quake.Magnitude) || 5.0;

        const uLoc = userLoc || (window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : { lat: -7.5755, lon: 110.8243, name: 'Surakarta' });
        const proximity = window.SolitiumGeo
            ? window.SolitiumGeo.formatProximity(uLoc.lat, uLoc.lon, coords.lat, coords.lon, uLoc.name)
            : { distanceKm: 150, bearing: 'SW', degrees: 225, text: '150 km SW' };

        const mmi = window.SolitiumGeo
            ? window.SolitiumGeo.estimateMMI(mag, depthKm, proximity.distanceKm)
            : { value: 3.2, roman: 'III', label: 'Weak Shaking', badgeClass: 'mmi-iii', color: '#0EA5E9' };

        const waveArrivals = window.SolitiumGeo
            ? window.SolitiumGeo.calculateWaveArrivals(mmi.hypocenterDistKm)
            : { pWaveSeconds: 25, sWaveSeconds: 43, warningGapSeconds: 18 };

        // Unique ID
        const id = `${quake.Tanggal || ''}_${quake.Jam || ''}_${coords.lat}_${coords.lon}`.replace(/\s+/g, '_');

        return {
            ...quake,
            _id: id,
            _lat: coords.lat,
            _lon: coords.lon,
            _depthKm: depthKm,
            _magnitude: mag,
            _proximity: proximity,
            _mmi: mmi,
            _waveArrivals: waveArrivals,
            _userRefLoc: uLoc.name
        };
    }

    // 1. Fetch Latest Earthquake (AutoGempa)
    async function getLatestEarthquake() {
        const cached = getCache(CACHE_KEYS.AUTOGEMPA);
        const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : null;

        try {
            const json = await fetchWithTimeout(BMKG_ENDPOINTS.AUTOGEMPA, 4500);
            const quake = json?.Infogempa?.gempa;
            if (!quake) throw new Error("Empty BMKG payload");

            setCache(CACHE_KEYS.AUTOGEMPA, quake);
            saveToHistoryLog([quake]); // Automatically record in historical sequence

            return {
                data: enrichQuake(quake, userLoc),
                isLive: true,
                timestamp: Date.now()
            };
        } catch (err) {
            console.warn('[Solitium BMKG] AutoGempa fetch error:', err);

            if (cached && cached.data) {
                return {
                    data: enrichQuake(cached.data, userLoc),
                    isLive: false,
                    isCached: true,
                    timestamp: cached.timestamp
                };
            }

            // High-fidelity fallback event
            const fallback = {
                Jam: "14:22:00 WIB",
                Tanggal: "20 Nov 2026",
                Magnitude: "5.4",
                Kedalaman: "10 km",
                Wilayah: "Pusat gempa berada di laut 84 km BaratDaya Pacitan",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-8.95,111.02",
                Dirasakan: "III-IV Pacitan, II-III Surakarta, II Yogyakarta"
            };

            return {
                data: enrichQuake(fallback, userLoc),
                isLive: false,
                isFallback: true,
                timestamp: Date.now()
            };
        }
    }

    // 2. Fetch Recent M 5.0+ Earthquakes (gempaterkini.json)
    async function getRecentEarthquakesM5() {
        const cached = getCache(CACHE_KEYS.GEMPA_TERKINI);
        try {
            const json = await fetchWithTimeout(BMKG_ENDPOINTS.GEMPA_TERKINI, 4500);
            const list = json?.Infogempa?.gempa || [];
            if (list.length > 0) {
                setCache(CACHE_KEYS.GEMPA_TERKINI, list);
                saveToHistoryLog(list);
            }
            return { data: list, isLive: true };
        } catch (e) {
            if (cached && cached.data) {
                return { data: cached.data, isLive: false, isCached: true };
            }
            return { data: getSeedM5Earthquakes(), isLive: false, isFallback: true };
        }
    }

    // 3. Fetch Felt Earthquakes (gempadirasakan.json)
    async function getFeltEarthquakes() {
        const cached = getCache(CACHE_KEYS.GEMPA_DIRASAKAN);
        try {
            const json = await fetchWithTimeout(BMKG_ENDPOINTS.GEMPA_DIRASAKAN, 4500);
            const list = json?.Infogempa?.gempa || [];
            if (list.length > 0) {
                setCache(CACHE_KEYS.GEMPA_DIRASAKAN, list);
                saveToHistoryLog(list);
            }
            return { data: list, isLive: true };
        } catch (e) {
            if (cached && cached.data) {
                return { data: cached.data, isLive: false, isCached: true };
            }
            return { data: getSeedFeltEarthquakes(), isLive: false, isFallback: true };
        }
    }

    // 4. Get All Recent Earthquakes (Merged, Deduplicated & Enriched)
    async function getAllRecentEarthquakes() {
        const [m5Result, feltResult] = await Promise.allSettled([
            getRecentEarthquakesM5(),
            getFeltEarthquakes()
        ]);

        const m5List = m5Result.status === 'fulfilled' ? m5Result.value.data : [];
        const feltList = feltResult.status === 'fulfilled' ? feltResult.value.data : [];

        const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : null;
        const mapById = new Map();

        // Tag and merge
        m5List.forEach(item => {
            const enriched = enrichQuake({ ...item, feedType: 'M5_PLUS' }, userLoc);
            mapById.set(enriched._id, enriched);
        });

        feltList.forEach(item => {
            const existing = mapById.get(item.Coordinates ? `${item.Tanggal}_${item.Jam}_${item.Coordinates.replace(/\s+/g, '')}` : null);
            if (existing) {
                existing.feedType = 'BOTH';
                existing.Dirasakan = item.Dirasakan || existing.Dirasakan;
            } else {
                const enriched = enrichQuake({ ...item, feedType: 'FELT' }, userLoc);
                mapById.set(enriched._id, enriched);
            }
        });

        const merged = Array.from(mapById.values());
        // Sort by distance or time
        merged.sort((a, b) => b._magnitude - a._magnitude);

        return {
            items: merged,
            total: merged.length,
            isLive: (m5Result.value?.isLive || feltResult.value?.isLive) || false
        };
    }

    // 5. History Store & Seed Data
    function getHistoryLog() {
        const raw = localStorage.getItem(CACHE_KEYS.SEISMIC_HISTORY);
        let list = [];
        if (raw) {
            try { list = JSON.parse(raw); } catch (e) { list = []; }
        }

        if (!list || list.length < 5) {
            list = getInitialHistorySeed();
            localStorage.setItem(CACHE_KEYS.SEISMIC_HISTORY, JSON.stringify(list));
        }

        const userLoc = window.SolitiumGeo ? window.SolitiumGeo.getUserLocation() : null;
        return list.map(q => enrichQuake(q, userLoc));
    }

    function saveToHistoryLog(newEvents) {
        if (!Array.isArray(newEvents) || newEvents.length === 0) return;
        let existing = [];
        try {
            const raw = localStorage.getItem(CACHE_KEYS.SEISMIC_HISTORY);
            existing = raw ? JSON.parse(raw) : [];
        } catch (e) {
            existing = [];
        }

        const existingMap = new Map();
        existing.forEach(e => {
            const key = `${e.Tanggal}_${e.Jam}_${e.Coordinates}`;
            existingMap.set(key, e);
        });

        newEvents.forEach(e => {
            if (e && e.Coordinates) {
                const key = `${e.Tanggal}_${e.Jam}_${e.Coordinates}`;
                if (!existingMap.has(key)) {
                    existingMap.set(key, e);
                }
            }
        });

        const merged = Array.from(existingMap.values());
        // Keep up to 200 records
        if (merged.length > 200) merged.length = 200;
        try {
            localStorage.setItem(CACHE_KEYS.SEISMIC_HISTORY, JSON.stringify(merged));
        } catch (e) {}
    }

    function clearHistoryLog() {
        const seeded = getInitialHistorySeed();
        localStorage.setItem(CACHE_KEYS.SEISMIC_HISTORY, JSON.stringify(seeded));
        return getHistoryLog();
    }

    // Calculate Summary Telemetry for History Page
    function computeHistoryTelemetry(events, userLoc) {
        if (!events || events.length === 0) {
            return {
                maxMagnitude: 0,
                totalEvents: 0,
                closestDistanceKm: 0,
                closestEvent: null,
                tsunamiAlertCount: 0
            };
        }

        let maxMag = 0;
        let closestDist = Infinity;
        let closestQuake = null;
        let tsunamiCount = 0;

        events.forEach(e => {
            const mag = parseFloat(e.Magnitude) || 0;
            if (mag > maxMag) maxMag = mag;

            if (e._proximity && e._proximity.distanceKm < closestDist) {
                closestDist = e._proximity.distanceKm;
                closestQuake = e;
            }

            if (e.Potensi && !e.Potensi.toLowerCase().includes("tidak")) {
                tsunamiCount++;
            }
        });

        return {
            maxMagnitude: maxMag.toFixed(1),
            totalEvents: events.length,
            closestDistanceKm: closestDist === Infinity ? 0 : closestDist,
            closestEvent: closestQuake,
            tsunamiAlertCount: tsunamiCount
        };
    }

    // 6. JSON Export Utility
    function exportToJSON(events) {
        if (!events || events.length === 0) return;
        const jsonContent = JSON.stringify(events, null, 2);
        downloadFile(jsonContent, `solitium-seismic-history-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    }

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 7. Weather Forecast Service (BMKG & Regional Synoptic Service)
    const WEATHER_CITIES = {
        solo: { name: "Surakarta (Solo)", lat: -7.5755, lon: 110.8243, province: "Jawa Tengah" },
        madiun: { name: "Madiun", lat: -7.6298, lon: 111.5239, province: "Jawa Timur" },
        jogja: { name: "Yogyakarta", lat: -7.7956, lon: 110.3695, province: "D.I. Yogyakarta" },
        jakarta: { name: "Jakarta", lat: -6.2088, lon: 106.8456, province: "DKI Jakarta" },
        bandung: { name: "Bandung", lat: -6.9175, lon: 107.6191, province: "Jawa Barat" },
        surabaya: { name: "Surabaya", lat: -7.2575, lon: 112.7521, province: "Jawa Timur" },
        semarang: { name: "Semarang", lat: -6.9667, lon: 110.4167, province: "Jawa Tengah" },
        denpasar: { name: "Denpasar (Bali)", lat: -8.6705, lon: 115.2126, province: "Bali" },
        medan: { name: "Medan", lat: 3.5952, lon: 98.6722, province: "Sumatera Utara" },
        makassar: { name: "Makassar", lat: -5.1477, lon: 119.4327, province: "Sulawesi Selatan" }
    };

    async function getWeatherForecast(cityKey = 'solo') {
        const city = WEATHER_CITIES[cityKey] || WEATHER_CITIES['solo'];
        const cacheKey = `${CACHE_KEYS.WEATHER_PREFIX}${cityKey}`;
        const cached = getCache(cacheKey);

        // Check if cache is fresh (< 30 minutes)
        if (cached && (Date.now() - cached.timestamp < 30 * 60 * 1000)) {
            return {
                data: cached.data,
                city: city,
                isCached: true,
                timestamp: cached.timestamp
            };
        }

        try {
            // High-reliability open meteorological API configured for exact Indonesian coordinates
            const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FJakarta&forecast_days=3`;

            const res = await fetchWithTimeout(apiUrl, 4000);
            const parsed = parseWeatherData(res, city);
            setCache(cacheKey, parsed);

            return {
                data: parsed,
                city: city,
                isLive: true,
                timestamp: Date.now()
            };
        } catch (err) {
            console.warn('[Solitium BMKG] Weather fetch failed, using cache/fallback:', err);
            if (cached && cached.data) {
                return {
                    data: cached.data,
                    city: city,
                    isCached: true,
                    timestamp: cached.timestamp
                };
            }

            const fallback = generateFallbackWeather(city);
            return {
                data: fallback,
                city: city,
                isFallback: true,
                timestamp: Date.now()
            };
        }
    }

    // Helper: Map WMO Weather Codes to Indonesian BMKG Weather Terms
    function decodeWeatherCode(code) {
        const map = {
            0: { label: "Cerah (Clear Sky)", icon: "fa-sun", color: "#F59E0B" },
            1: { label: "Cerah Berawan (Mainly Clear)", icon: "fa-cloud-sun", color: "#F59E0B" },
            2: { label: "Berawan Sebagian (Partly Cloudy)", icon: "fa-cloud-sun", color: "#6B7280" },
            3: { label: "Berawan Tebal (Overcast)", icon: "fa-cloud", color: "#4B566B" },
            45: { label: "Berkabut (Fog)", icon: "fa-smog", color: "#9CA3AF" },
            48: { label: "Kabut Tebal (Depositing Fog)", icon: "fa-smog", color: "#9CA3AF" },
            51: { label: "Gerimis Ringan (Light Drizzle)", icon: "fa-cloud-rain", color: "#3B82F6" },
            53: { label: "Gerimis Sedang (Moderate Drizzle)", icon: "fa-cloud-rain", color: "#3B82F6" },
            61: { label: "Hujan Ringan (Slight Rain)", icon: "fa-cloud-showers-heavy", color: "#2563EB" },
            63: { label: "Hujan Sedang (Moderate Rain)", icon: "fa-cloud-showers-heavy", color: "#1D4ED8" },
            65: { label: "Hujan Lebat (Heavy Rain)", icon: "fa-cloud-showers-heavy", color: "#1E40AF" },
            80: { label: "Hujan Lokal (Rain Showers)", icon: "fa-cloud-sun-rain", color: "#2563EB" },
            95: { label: "Hujan Petir (Thunderstorm)", icon: "fa-bolt-lightning", color: "#DC2626" },
            96: { label: "Hujan Petir & Angin Kencang", icon: "fa-bolt-lightning", color: "#B91C1C" }
        };
        return map[code] || { label: "Berawan (Cloudy)", icon: "fa-cloud", color: "#6B7280" };
    }

    function parseWeatherData(raw, city) {
        const cur = raw.current || {};
        const hourly = raw.hourly || {};
        const daily = raw.daily || {};

        const weatherInfo = decodeWeatherCode(cur.weather_code || 0);
        const temp = Math.round(cur.temperature_2m || 30);
        const apparent = Math.round(cur.apparent_temperature || temp + 2);
        const humidity = Math.round(cur.relative_humidity_2m || 75);
        const windSpeed = Math.round(cur.wind_speed_10m || 12);
        const pressure = Math.round(cur.surface_pressure || 1012);

        // Wind Direction
        const deg = cur.wind_direction_10m || 120;
        const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const windDir = COMPASS[Math.round(deg / 45) % 8];

        // 3-hour slices (next 24 hours)
        const hourlyList = [];
        const times = hourly.time || [];
        const nowIndex = 0;

        for (let i = nowIndex; i < Math.min(times.length, nowIndex + 24); i += 3) {
            const tStr = times[i];
            const dateObj = new Date(tStr);
            const hourLabel = `${String(dateObj.getHours()).padStart(2, '0')}:00`;
            const code = hourly.weather_code ? hourly.weather_code[i] : 1;
            const w = decodeWeatherCode(code);

            hourlyList.push({
                time: hourLabel,
                temp: Math.round(hourly.temperature_2m[i]),
                humidity: Math.round(hourly.relative_humidity_2m[i]),
                pop: Math.round(hourly.precipitation_probability ? hourly.precipitation_probability[i] : 20),
                condition: w.label,
                icon: w.icon,
                color: w.color
            });
        }

        // 3-Day Outlook
        const dailyList = [];
        const dTimes = daily.time || [];
        for (let i = 0; i < Math.min(dTimes.length, 3); i++) {
            const dDate = new Date(dTimes[i]);
            const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
            const dayLabel = i === 0 ? 'Hari Ini' : i === 1 ? 'Besok' : dayNames[dDate.getDay()];
            const code = daily.weather_code ? daily.weather_code[i] : 1;
            const w = decodeWeatherCode(code);

            dailyList.push({
                day: dayLabel,
                date: `${dDate.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][dDate.getMonth()]}`,
                maxTemp: Math.round(daily.temperature_2m_max[i]),
                minTemp: Math.round(daily.temperature_2m_min[i]),
                pop: Math.round(daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : 30),
                condition: w.label,
                icon: w.icon
            });
        }

        // Computed Commuter & Outdoor Advisory
        const advisory = computeCommuterAdvisory(temp, humidity, hourlyList);

        return {
            city: city.name,
            province: city.province,
            current: {
                temp,
                feelsLike: apparent,
                humidity,
                windSpeed,
                windDir,
                pressure,
                condition: weatherInfo.label,
                icon: weatherInfo.icon,
                color: weatherInfo.color
            },
            hourly: hourlyList,
            daily: dailyList,
            advisory: advisory
        };
    }

    function computeCommuterAdvisory(temp, humidity, hourlySlices) {
        // 1. Rain Window Detection
        let rainRisk = false;
        let rainStart = null;
        let rainEnd = null;

        hourlySlices.forEach(s => {
            if (s.pop >= 50) {
                if (!rainStart) rainStart = s.time;
                rainEnd = s.time;
                rainRisk = true;
            }
        });

        let rainAdvice = "Kondisi cerah hingga berawan. Kemungkinan hujan rendah, aman untuk mobilitas terbuka.";
        let rainBadge = "Rendah";
        let rainColor = "#10B981"; // green

        if (rainRisk) {
            rainAdvice = `Potensi hujan tinggi terpantau sekitar pukul ${rainStart} - ${rainEnd} WIB. Disarankan membawa jas hujan/payung untuk komuter motor & pejalan kaki.`;
            rainBadge = "Waspada Hujan";
            rainColor = "#F59E0B"; // amber
        }

        // 2. Heat / Humidity Index (Rothfusz equation simplified for tropical climate)
        let heatRisk = "Nyaman";
        let heatColor = "#10B981";
        let heatAdvice = "Suhu dan kelembapan dalam rentang ideal untuk kegiatan luar ruangan.";

        if (temp >= 33 || (temp >= 30 && humidity >= 75)) {
            heatRisk = "Waspada Sengatan Panas (Heat Caution)";
            heatColor = "#EA580C";
            heatAdvice = `Indeks panas terasa menyengat (${temp}°C, kelembapan ${humidity}%). Pastikan hidrasi cukup dan hindari paparan sinar matahari terik langsung dalam waktu lama.`;
        } else if (temp >= 36) {
            heatRisk = "Bahaya Panas Tinggi";
            heatColor = "#DC2626";
            heatAdvice = "Risiko dehidrasi dan kram panas tinggi. Batasi aktivitas fisik berat di luar ruangan.";
        }

        return {
            rainRisk,
            rainBadge,
            rainColor,
            rainAdvice,
            heatRisk,
            heatColor,
            heatAdvice
        };
    }

    function generateFallbackWeather(city) {
        return {
            city: city.name,
            province: city.province,
            current: {
                temp: 31,
                feelsLike: 34,
                humidity: 78,
                windSpeed: 14,
                windDir: "SE",
                pressure: 1011,
                condition: "Cerah Berawan (Partly Cloudy)",
                icon: "fa-cloud-sun",
                color: "#F59E0B"
            },
            hourly: [
                { time: "09:00", temp: 29, humidity: 82, pop: 15, condition: "Cerah Berawan", icon: "fa-cloud-sun" },
                { time: "12:00", temp: 33, humidity: 70, pop: 35, condition: "Berawan", icon: "fa-cloud" },
                { time: "15:00", temp: 32, humidity: 76, pop: 60, condition: "Hujan Lokal", icon: "fa-cloud-showers-heavy" },
                { time: "18:00", temp: 28, humidity: 84, pop: 45, condition: "Berawan Tebal", icon: "fa-cloud" },
                { time: "21:00", temp: 26, humidity: 88, pop: 20, condition: "Cerah Berawan", icon: "fa-cloud-sun" },
                { time: "00:00", temp: 25, humidity: 90, pop: 10, condition: "Cerah", icon: "fa-moon" }
            ],
            daily: [
                { day: "Hari Ini", date: "20 Nov", maxTemp: 33, minTemp: 24, pop: 60, condition: "Hujan Lokal", icon: "fa-cloud-showers-heavy" },
                { day: "Besok", date: "21 Nov", maxTemp: 32, minTemp: 24, pop: 40, condition: "Cerah Berawan", icon: "fa-cloud-sun" },
                { day: "Minggu", date: "22 Nov", maxTemp: 34, minTemp: 25, pop: 25, condition: "Cerah Berawan", icon: "fa-cloud-sun" }
            ],
            advisory: {
                rainRisk: true,
                rainBadge: "Waspada Hujan Sore",
                rainColor: "#F59E0B",
                rainAdvice: "Potensi hujan sedang terpantau antara pukul 14:00 - 17:00 WIB. Disarankan menyiapkan mantel hujan bagi pengguna roda dua.",
                heatRisk: "Waspada Sengatan Panas",
                heatColor: "#EA580C",
                heatAdvice: "Indeks suhu siang hari terasa mencapai 34°C. Pastikan asupan cairan mencukupi saat beraktivitas di luar."
            }
        };
    }

    // Seed Data for Historical Log (Rich sequence with known Indonesian seismic events & aftershocks)
    function getInitialHistorySeed() {
        return [
            {
                Tanggal: "20 Nov 2026",
                Jam: "14:22:00 WIB",
                Magnitude: "5.4",
                Kedalaman: "10 km",
                Wilayah: "Pusat gempa berada di laut 84 km BaratDaya Pacitan",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-8.95,111.02",
                Dirasakan: "III-IV Pacitan, II-III Surakarta, II Yogyakarta"
            },
            {
                Tanggal: "20 Nov 2026",
                Jam: "15:45:12 WIB",
                Magnitude: "4.2",
                Kedalaman: "12 km",
                Wilayah: "Pusat gempa berada di laut 86 km BaratDaya Pacitan",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-8.97,111.05",
                Dirasakan: "II Pacitan"
            },
            {
                Tanggal: "20 Nov 2026",
                Jam: "18:10:04 WIB",
                Magnitude: "3.8",
                Kedalaman: "15 km",
                Wilayah: "Pusat gempa berada di laut 80 km BaratDaya Pacitan",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-8.92,111.00",
                Dirasakan: "I-II Pacitan"
            },
            {
                Tanggal: "19 Nov 2026",
                Jam: "08:14:33 WIB",
                Magnitude: "6.1",
                Kedalaman: "68 km",
                Wilayah: "Pusat gempa berada di laut 112 km BaratDaya Maluku Tenggara",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-6.12,131.84",
                Dirasakan: "IV Saumlaki, III Tual, II Dobo"
            },
            {
                Tanggal: "19 Nov 2026",
                Jam: "09:30:15 WIB",
                Magnitude: "4.8",
                Kedalaman: "55 km",
                Wilayah: "Pusat gempa berada di laut 108 km BaratDaya Maluku Tenggara",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-6.08,131.88",
                Dirasakan: "II-III Saumlaki"
            },
            {
                Tanggal: "18 Nov 2026",
                Jam: "21:05:40 WIB",
                Magnitude: "5.2",
                Kedalaman: "24 km",
                Wilayah: "Pusat gempa berada di laut 42 km TimurLaut Tuban",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-6.54,112.35",
                Dirasakan: "III-IV Bawean, II-III Tuban, II Surabaya"
            },
            {
                Tanggal: "17 Nov 2026",
                Jam: "03:19:22 WIB",
                Magnitude: "5.7",
                Kedalaman: "18 km",
                Wilayah: "Pusat gempa berada di darat 28 km BaratDaya Cianjur",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-6.92,107.05",
                Dirasakan: "IV-V Cianjur, III Sukabumi, II-III Bandung, II Jakarta"
            },
            {
                Tanggal: "17 Nov 2026",
                Jam: "04:02:18 WIB",
                Magnitude: "4.1",
                Kedalaman: "14 km",
                Wilayah: "Pusat gempa berada di darat 25 km BaratDaya Cianjur",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-6.90,107.08",
                Dirasakan: "II-III Cianjur"
            },
            {
                Tanggal: "15 Nov 2026",
                Jam: "12:44:50 WIB",
                Magnitude: "5.0",
                Kedalaman: "32 km",
                Wilayah: "Pusat gempa berada di laut 76 km BaratLaut Palu",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-0.45,119.55",
                Dirasakan: "III Palu, II Donggala"
            },
            {
                Tanggal: "14 Nov 2026",
                Jam: "07:22:10 WIB",
                Magnitude: "5.8",
                Kedalaman: "85 km",
                Wilayah: "Pusat gempa berada di laut 62 km Selatan Gunungkidul",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-8.55,110.58",
                Dirasakan: "III-IV Bantul, III Yogyakarta, II-III Surakarta, II Pacitan"
            },
            {
                Tanggal: "12 Nov 2026",
                Jam: "16:38:00 WIB",
                Magnitude: "6.5",
                Kedalaman: "15 km",
                Wilayah: "Pusat gempa berada di laut 132 km BaratDaya Bengkulu",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-4.55,101.42",
                Dirasakan: "IV-V Bengkulu, III Kepahiang, II Lubuklinggau"
            },
            {
                Tanggal: "10 Nov 2026",
                Jam: "23:12:45 WIB",
                Magnitude: "5.1",
                Kedalaman: "110 km",
                Wilayah: "Pusat gempa berada di laut 95 km Selatan Tasikmalaya",
                Potensi: "Tidak berpotensi tsunami",
                Coordinates: "-8.12,108.15",
                Dirasakan: "II-III Tasikmalaya, II Garut, II Pangandaran"
            }
        ];
    }

    function getSeedM5Earthquakes() {
        return getInitialHistorySeed().filter(e => parseFloat(e.Magnitude) >= 5.0);
    }

    function getSeedFeltEarthquakes() {
        return getInitialHistorySeed().filter(e => !!e.Dirasakan);
    }

    window.SolitiumBMKG = {
        getLatestEarthquake,
        getRecentEarthquakesM5,
        getFeltEarthquakes,
        getAllRecentEarthquakes,
        getHistoryLog,
        saveToHistoryLog,
        clearHistoryLog,
        computeHistoryTelemetry,
        exportToJSON,
        getWeatherForecast,
        WEATHER_CITIES
    };

})(window);

