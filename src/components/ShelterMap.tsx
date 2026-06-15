'use client';

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
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

// EXPLICIT MATCH TO YOUR DATABASE SCHEMA
export interface ShelterData {
  shelterid: string;
  sheltername: string;
  latitude: number;
  longitude: number;
  capacity: number;
  address: string;
  contactnumber: string;
  status: string;
  districts?: {
    districtname: string;
  };
}

interface ShelterMapProps {
  shelters: ShelterData[];
  userLocation?: [number, number];
}

export default function ShelterMap({ shelters, userLocation }: ShelterMapProps) {
  const center = userLocation || [2.25, 102.25];

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm z-0 relative h-[500px] w-full">
      <MapContainer 
        center={center as L.LatLngExpression} 
        zoom={11} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {userLocation && (
          <Circle 
            center={userLocation as L.LatLngExpression} 
            pathOptions={{ fillColor: 'blue', color: 'blue', fillOpacity: 0.1 }} 
            radius={15000}
          >
            <Popup>Your approximate location</Popup>
          </Circle>
        )}

        {shelters.map((shelter) => {
          // Verify coordinates exist before rendering marker
          if (!shelter.latitude || !shelter.longitude) return null;

          return (
            <Marker key={shelter.shelterid} position={[shelter.latitude, shelter.longitude]}>
              <Popup>
                <div className="min-w-[200px]">
                  <h3 className="font-bold text-lg border-b pb-1 mb-2">{shelter.sheltername}</h3>
                  <p className="text-sm text-slate-600 mb-1">
                    <b>District:</b> {shelter.districts?.districtname || 'Unknown'}
                  </p>
                  <p className="text-sm text-slate-600 mb-1">
                    <b>Address:</b> {shelter.address || 'Not specified'}
                  </p>
                  <p className="text-sm text-slate-600 mb-2">
                    <b>Contact:</b> {shelter.contactnumber || 'N/A'}
                  </p>
                  
                  <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-center">
                    <span className="text-sm font-semibold text-slate-700">
                      Max Capacity: {shelter.capacity ? `${shelter.capacity} people` : 'Unknown'}
                    </span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}