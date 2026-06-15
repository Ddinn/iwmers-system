'use client';

import dynamic from 'next/dynamic';

// --- RELATIONAL STRUCTURAL INTERFACES ---
export interface AlertData {
  alertid: string;
  districtid: string;
  title: string;
  message: string;
  severity: string;
  issuedat: string;
}

export interface InsightData {
  id: string;
  districtid: string;
  risklevel: 'High' | 'Moderate' | 'Low';
  summary: string;
  recommendation: string;
  districtname?: string;
}

export interface DistrictData {
  districtid: string;
  districtname: string;
  latitude: string | number;
  longitude: string | number;
  stateid?: string;
}

// 👇 NEW: Define the Shelter interface 👇
export interface ShelterData {
  shelterid: string;
  sheltername: string;
  latitude: number | string;
  longitude: number | string;
  capacity: number;
  address: string;
  contactnumber: string;
}

// 1. THE FIX: Declare districts and shelters explicitly
export interface WrapperProps {
  insights: InsightData[];
  alerts: AlertData[];
  userLocation?: [number, number];
  districts: DistrictData[];
  shelters?: ShelterData[]; // <-- Added Shelters
}

// Next.js dynamic client wrapper optimization layer
const DynamicWeatherMap = dynamic(
  () => import('./WeatherMap').then((mod) => mod.WeatherMap),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0F172A] text-slate-500 text-sm animate-pulse rounded-2xl border border-[#1E293B]">
        Loading geospatial telemetry models...
      </div>
    )
  }
);

export default function MapWrapper({ insights, alerts, userLocation, districts, shelters = [] }: WrapperProps) {
  // 2. THE FIX: Channel the properties safely down to the Leaflet instantiation
  return (
    <DynamicWeatherMap 
      userLocation={userLocation} 
      alerts={alerts}
      insights={insights}
      districts={districts}
      shelters={shelters} // <-- Pass the shelters array into the actual map
    />
  );
}