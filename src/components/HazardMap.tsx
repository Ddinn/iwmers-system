'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Define the shape of our data
interface Insight {
  districtid: string;
  districts?: {
    districtname?: string;
  };
  risklevel?: string;
  summary?: string;
}

interface AlertItem {
  districtid: string;
}

interface MapProps {
  insights: Insight[];
  alerts: AlertItem[];
}

// Hardcode the coordinates for the districts in Melaka
const districtCoordinates: Record<string, [number, number]> = {
  'ALOR GAJAH': [2.35, 102.18],
  'MELAKA TENGAH': [2.20, 102.25],
  'JASIN': [2.30, 102.43],
  'CENTRAL MELAKA': [2.20, 102.25] // Fallback alias
};

export default function HazardMap({ insights, alerts }: MapProps) {
  const melakaCenter = [2.25, 102.25];

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm z-0 relative">
      <MapContainer 
        center={melakaCenter as L.LatLngExpression} 
        zoom={10} 
        style={{ height: '500px', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Loop through the AI insights and render a marker for each district */}
        {insights.map((insight, index) => {
          const districtName = insight.districts?.districtname?.toUpperCase() || '';
          const coords = districtCoordinates[districtName];
          
          // Count active alerts for this specific district
          const districtAlerts = alerts.filter(a => a.districtid === insight.districtid);

          if (!coords) return null; // Skip if we don't have coordinates

          return (
            <Marker key={index} position={coords}>
              <Popup>
                <div className="max-w-[250px]">
                  <h3 className="font-bold text-lg border-b pb-1 mb-2">{districtName}</h3>
                  <p className="text-sm text-slate-700 mb-2">
                    <b>Risk Level:</b> {insight.risklevel}
                  </p>
                  <p className="text-sm text-slate-600 mb-2">{insight.summary}</p>
                  
                  {districtAlerts.length > 0 ? (
                    <div className="mt-2 bg-red-50 text-red-700 p-2 rounded text-xs border border-red-200">
                      <b>{districtAlerts.length} Active Alert(s)</b>
                    </div>
                  ) : (
                    <div className="mt-2 bg-green-50 text-green-700 p-2 rounded text-xs border border-green-200">
                      All Clear
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}