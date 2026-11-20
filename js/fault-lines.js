/**
 * SOLITIUM // INDONESIAN TECTONIC FAULT LINES & SUBDUCTION ZONES
 * Vector GeoJSON Dataset of Active Indonesian Faults & Trenches
 */

(function (window) {
    'use strict';

    const INDONESIAN_FAULTS_GEOJSON = {
        type: "FeatureCollection",
        features: [
            // 1. Sunda Megathrust (Sumatra - Java - Nusa Tenggara Subduction Trench)
            {
                type: "Feature",
                properties: {
                    name: "Sunda Megathrust (Sumatra - Java Trench)",
                    type: "Subduction Megathrust",
                    tectonicZone: "Indo-Australian & Eurasian Plate Boundary",
                    slipRate: "50 - 70 mm/year",
                    riskLevel: "Extreme",
                    description: "Major convergent plate boundary generating megathrust earthquakes and regional tsunamis along Sumatra, Java, Bali, and Nusa Tenggara."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [92.5, 9.8], [93.2, 7.5], [94.5, 4.2], [96.0, 1.8], [98.2, -0.9],
                        [100.1, -2.8], [102.0, -4.5], [104.5, -6.8], [107.0, -8.3], [110.5, -9.2],
                        [114.0, -9.5], [117.5, -9.8], [121.0, -10.2], [124.0, -10.8], [127.5, -11.2],
                        [130.5, -10.5], [133.0, -8.5], [133.5, -6.2], [131.5, -4.5]
                    ]
                }
            },
            // 2. Great Sumatran Fault (Semangko Fault System)
            {
                type: "Feature",
                properties: {
                    name: "Great Sumatran Fault (Semangko)",
                    type: "Dextral Strike-Slip Fault",
                    tectonicZone: "Sumatra Volcanic Arc Spine",
                    slipRate: "15 - 27 mm/year",
                    riskLevel: "Very High",
                    description: "High-slip inland strike-slip fault traversing the entire length of the Bukit Barisan mountain range across Sumatra."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [95.3, 5.7], [95.9, 4.8], [96.6, 3.8], [97.3, 2.8], [98.2, 1.8],
                        [99.1, 0.9], [100.1, -0.2], [100.8, -1.0], [101.5, -1.9], [102.4, -3.1],
                        [103.3, -4.2], [104.3, -5.2], [104.8, -5.9]
                    ]
                }
            },
            // 3. Baribis - Kendeng Fold and Thrust Belt (Java Back-Arc)
            {
                type: "Feature",
                properties: {
                    name: "Baribis - Kendeng Thrust Belt",
                    type: "Reverse / Thrust Fault",
                    tectonicZone: "Java In-land Active Basin",
                    slipRate: "3 - 6 mm/year",
                    riskLevel: "High",
                    description: "Active inland back-arc thrust running through West, Central, and East Java, traversing south of Jakarta, Semarang, and near Surakarta/Solo."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [106.8, -6.6], [107.5, -6.8], [108.2, -6.9], [109.1, -7.0],
                        [110.2, -7.0], [110.8, -7.2], [111.5, -7.3], [112.4, -7.4], [113.2, -7.5]
                    ]
                }
            },
            // 4. Opak Fault (Yogyakarta)
            {
                type: "Feature",
                properties: {
                    name: "Opak Active Fault",
                    type: "Normal / Strike-Slip Fault",
                    tectonicZone: "Yogyakarta Depression Basin",
                    slipRate: "2.4 - 4 mm/year",
                    riskLevel: "High",
                    description: "Responsible for the devastating 2006 M 6.3 Yogyakarta earthquake. Extends along the Opak River valley."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [110.28, -8.02], [110.38, -7.88], [110.45, -7.78], [110.51, -7.65]
                    ]
                }
            },
            // 5. Cimandiri & Lembang Faults (West Java)
            {
                type: "Feature",
                properties: {
                    name: "Cimandiri - Lembang Fault System",
                    type: "Sinistral Strike-Slip / Oblique",
                    tectonicZone: "West Java Arc",
                    slipRate: "3 - 5 mm/year",
                    riskLevel: "High",
                    description: "Traverses Pelabuhan Ratu through Sukabumi, Cianjur, and north of Bandung metropolitan area."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [106.5, -7.0], [106.9, -6.9], [107.2, -6.85], [107.6, -6.8], [107.8, -6.75]
                    ]
                }
            },
            // 6. Palu-Koro Fault (Central Sulawesi)
            {
                type: "Feature",
                properties: {
                    name: "Palu-Koro Fault",
                    type: "Sinistral Strike-Slip Fault",
                    tectonicZone: "Sulawesi Collision Complex",
                    slipRate: "35 - 45 mm/year",
                    riskLevel: "Extreme",
                    description: "Ultra-fast slipping strike-slip fault that triggered the 2018 M 7.5 Palu supershear earthquake, liquefaction, and tsunami."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [119.5, 0.5], [119.8, -0.8], [119.9, -1.5], [120.3, -2.5], [120.7, -3.2]
                    ]
                }
            },
            // 7. Matano Fault (Sulawesi)
            {
                type: "Feature",
                properties: {
                    name: "Matano Active Fault",
                    type: "Sinistral Strike-Slip",
                    tectonicZone: "East Sulawesi Microplate",
                    slipRate: "18 - 24 mm/year",
                    riskLevel: "Very High",
                    description: "Major active strike-slip boundary cutting across Central to Southeast Sulawesi into Tolo Bay."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [120.3, -2.5], [121.2, -2.6], [122.1, -2.7], [123.0, -2.9]
                    ]
                }
            },
            // 8. Flores Back-Arc Thrust
            {
                type: "Feature",
                properties: {
                    name: "Flores Back-Arc Thrust",
                    type: "Back-Arc Thrust Fault",
                    tectonicZone: "Flores Sea / Lesser Sunda Arc",
                    slipRate: "8 - 12 mm/year",
                    riskLevel: "High",
                    description: "Marine thrust zone north of Bali, Lombok, and Flores responsible for the 2018 Lombok earthquake sequence."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [115.5, -8.1], [116.5, -8.0], [118.0, -8.0], [119.5, -8.1], [121.5, -8.0], [123.5, -7.8]
                    ]
                }
            },
            // 9. Sorong Fault System (Papua - Maluku)
            {
                type: "Feature",
                properties: {
                    name: "Sorong Megashear Fault",
                    type: "Sinistral Strike-Slip Megashear",
                    tectonicZone: "Pacific - Australian Oblique Boundary",
                    slipRate: "20 - 32 mm/year",
                    riskLevel: "Very High",
                    description: "Massive east-west megashear cutting across northern Bird's Head of Papua, Raja Ampat, into the Molucca Sea."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [125.0, -1.8], [127.5, -1.5], [130.0, -1.0], [131.5, -0.8], [133.5, -0.7], [136.0, -1.8]
                    ]
                }
            },
            // 10. Banda Arc & Seram Thrust
            {
                type: "Feature",
                properties: {
                    name: "Banda Arc / Seram Trough",
                    type: "Curved Subduction & Retroarc Thrust",
                    tectonicZone: "Banda Microplate",
                    slipRate: "15 - 25 mm/year",
                    riskLevel: "High",
                    description: "Tectonically complex curved subduction zone capable of deep and intermediate high-magnitude events."
                },
                geometry: {
                    type: "LineString",
                    coordinates: [
                        [127.0, -3.2], [128.5, -3.0], [130.5, -3.2], [131.5, -4.2], [130.5, -5.5], [128.5, -6.5]
                    ]
                }
            }
        ]
    };

    // Styling configuration for Leaflet
    function getFaultLineStyle(feature) {
        const isMegathrust = feature.properties.type.includes("Subduction");
        return {
            color: isMegathrust ? "#DC2626" : "#FF5500", // Red for Megathrust, Solitium Orange for Inland Faults
            weight: isMegathrust ? 3.5 : 2.5,
            opacity: 0.85,
            dashArray: isMegathrust ? "8, 6" : "4, 4"
        };
    }

    function createFaultsLayer(map, options = {}) {
        if (!window.L) return null;

        const layer = L.geoJSON(INDONESIAN_FAULTS_GEOJSON, {
            style: getFaultLineStyle,
            onEachFeature: (feature, l) => {
                const p = feature.properties;
                const isMegathrust = p.type.includes("Subduction");
                const badgeColor = isMegathrust ? "#DC2626" : "#FF5500";
                const badgeBg = isMegathrust ? "#FEF2F2" : "#FFF8F5";

                l.bindPopup(`
                    <div style="font-family: 'Mona Sans', sans-serif; font-size: 13px; line-height: 1.4; min-width: 210px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 10px; font-weight: 700; color: ${badgeColor}; background: ${badgeBg}; border: 1px solid ${badgeColor}33; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">
                                ${p.type}
                            </span>
                            <span style="font-size: 11px; font-weight: 600; color: #6B7280;">Slip: ${p.slipRate}</span>
                        </div>
                        <strong style="color: #111827; font-size: 14px; display: block; margin-bottom: 4px;">
                            ${p.name}
                        </strong>
                        <p style="margin: 0; color: #4B566B; font-size: 12px; margin-bottom: 6px;">
                            ${p.description}
                        </p>
                        <div style="font-size: 11px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 4px;">
                            <strong>Tectonic Zone:</strong> ${p.tectonicZone}
                        </div>
                    </div>
                `);

                l.on('mouseover', () => {
                    l.setStyle({ weight: 4.5, opacity: 1.0 });
                });
                l.on('mouseout', () => {
                    l.setStyle(getFaultLineStyle(feature));
                });
            }
        });

        if (options.addToMap && map) {
            layer.addTo(map);
        }

        return layer;
    }

    window.SolitiumFaults = {
        data: INDONESIAN_FAULTS_GEOJSON,
        createLayer: createFaultsLayer,
        getStyle: getFaultLineStyle
    };

})(window);

