'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- STANDARD LEAFLET ICONS ---
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- COLORED ICONS FOR RISK LEVELS ---
const redIcon = new L.Icon({ ...DefaultIcon.options, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png' });
const orangeIcon = new L.Icon({ ...DefaultIcon.options, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png' });
const greenIcon = new L.Icon({ ...DefaultIcon.options, iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' });

// 👇 NEW: CUSTOM PPS EVACUATION CENTER ICON (Pulse Animation) 👇
const ppsIcon = L.divIcon({
  html: `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; background: #10B981; border: 2px solid #FFFFFF; border-radius: 50%; box-shadow: 0 4px 12px rgba(16,185,129,0.4);">
      <div style="position: absolute; width: 100%; height: 100%; background: #10B981; border-radius: 50%; opacity: 0.4; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top: 5px;"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </div>
    <style>
      @keyframes ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
    </style>
  `,
  className: 'custom-pps-icon',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// --- STRICT TYPES ---
interface AlertPayload {
  districtid: string;
  title: string;
}

interface InsightPayload {
  districtid: string;
  districtname?: string;
  risklevel: string;
  summary: string;
}

interface DistrictPayload {
  districtid: string;
  districtname: string;
  latitude: string | number;
  longitude: string | number;
}

// 👇 NEW: Shelter Interface 👇
export interface ShelterPayload {
  shelterid: string;
  sheltername: string;
  latitude: number | string;
  longitude: number | string;
  capacity: number;
  address: string;
  contactnumber: string;
}

export interface MapProps {
  showShelters?: boolean;
  userLocation?: [number, number];
  alerts?: AlertPayload[];
  insights?: InsightPayload[];
  districts?: DistrictPayload[]; 
  shelters?: ShelterPayload[]; // <-- Add shelters to Props
}

// --- MAP PANNING CONTROLLER ---
function MapUpdater({ center }: { center?: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 11, { animate: true, duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

// --- MAIN COMPONENT ---
export function WeatherMap({ showShelters = false, userLocation, alerts = [], insights = [], districts = [], shelters = [] }: MapProps) {
  const centerPosition = userLocation || [2.25, 102.25];

  // DYNAMIC RISK CALCULATION: Maps your REAL Database Districts to map pins
  const dynamicDistricts = districts.map(district => {
    // Check if the AI Analysis flagged this real database district
    const districtInsight = insights.find(i => 
      i.districtname?.toLowerCase() === district.districtname?.toLowerCase() || 
      i.districtid === district.districtid
    );
    
    // Check if there are active raw weather alerts for this district
    const hasAlert = alerts.some(a => 
      a.districtid === district.districtid || 
      a.title?.toLowerCase().includes(district.districtname?.toLowerCase())
    );

    // Default to Safe
    let risk = "Safe";
    let color = "#10B981";
    let icon = greenIcon;

    // Escalate to Critical if there's an alert or High AI Risk
    if (hasAlert || districtInsight?.risklevel === 'High') {
      risk = "Critical Risk";
      color = "#EF4444";
      icon = redIcon;
    } 
    // Escalate to Advisory if AI flags Moderate Risk
    else if (districtInsight?.risklevel === 'Moderate') {
      risk = "Advisory";
      color = "#F59E0B";
      icon = orangeIcon;
    }

    return { 
      ...district, 
      lat: Number(district.latitude), // Ensures string DB coords become numbers
      lng: Number(district.longitude), 
      risk, 
      color, 
      icon, 
      summary: districtInsight?.summary || "Conditions Nominal" 
    };
  }).filter(d => !isNaN(d.lat) && !isNaN(d.lng)); // Filter out missing coordinates

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", borderRadius: 16, overflow: "hidden", zIndex: 0 }}>
      <MapContainer center={centerPosition as L.LatLngExpression} zoom={11} style={{ height: '100%', width: '100%' }}>
        <MapUpdater center={userLocation} />
        
        {/* Standard Map Colors (No black map) */}
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* User Location */}
        {userLocation && (
          <>
            <Marker position={userLocation as L.LatLngExpression}>
              <Popup><b>Your Live Device Location</b></Popup>
            </Marker>
            {/* The exact blue radius circle requested */}
            <Circle 
              center={userLocation as L.LatLngExpression} 
              pathOptions={{ fillColor: '#0000FF', color: '#0000FF', fillOpacity: 0.15, weight: 2 }} 
              radius={12000} 
            />
          </>
        )}

        {/* Dynamic District Pins driven by REAL Database Coordinates */}
        {!showShelters && dynamicDistricts.map((district) => (
          <Marker key={district.districtid} position={[district.lat, district.lng]} icon={district.icon}>
            <Popup>
              <b>{district.districtname}</b><br/>
              Status: <span style={{ color: district.color, fontWeight: "bold" }}>{district.risk}</span>
              <p style={{ fontSize: 11, marginTop: 4, color: "#64748B" }}>{district.summary}</p>
            </Popup>
          </Marker>
        ))}

        {/* 👇 NEW: RENDER ACTIVE EVACUATION SHELTER PINS (PPS) 👇 */}
        {shelters.map((shelter) => {
          const lat = parseFloat(String(shelter.latitude));
          const lng = parseFloat(String(shelter.longitude));
          
          if (isNaN(lat) || isNaN(lng)) return null;

          return (
            <Marker key={shelter.shelterid} position={[lat, lng]} icon={ppsIcon}>
              <Popup>
                <div style={{ color: '#0F172A', fontFamily: 'system-ui', padding: '2px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#059669' }}>
                    🟢 PPS: {shelter.sheltername}
                  </h4>
                  <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#64748B', lineHeight: '1.4' }}>
                    {shelter.address}
                  </p>
                  <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '6px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span><strong>Max Capacity:</strong> {shelter.capacity} evacuees</span>
                    {shelter.contactnumber && <span><strong>Emergency Tel:</strong> {shelter.contactnumber}</span>}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Live Badge Overlay */}
      {userLocation && (
        <div style={{ position: "absolute", top: 12, left: 12, zIndex: 400, background: "rgba(16,185,129,0.9)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 20, padding: "6px 12px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "pulse 2s infinite" }} />
          <span style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>DEVICE TRACKING ACTIVE</span>
        </div>
      )}
    </div>
  );
}