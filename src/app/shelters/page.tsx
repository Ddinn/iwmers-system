'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Phone, Building2, CheckCircle2, Clock, Activity } from "lucide-react";
import ShelterMapWrapper from '@/components/ShelterMapWrapper';
import { ShelterData } from '@/components/ShelterMap';

interface ExtendedShelterData extends ShelterData {
  capacity: number;
  occupied: number;
  contactnumber: string;
  status: string;
}

export default function SheltersPage() {
  const supabase = createClient();
  const [shelters, setShelters] = useState<ExtendedShelterData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocName, setUserLocName] = useState<string | null>(null);
  
  // State to hold latitude/longitude coordinates for Leaflet map component
  const [deviceCoords, setDeviceCoords] = useState<[number, number] | undefined>(undefined);
  const [trackingStatus, setTrackingStatus] = useState<string>('Initializing GPS...');

  // Fallback coordinates dictionary matching database district names
  const fallbackGeocode: Record<string, [number, number]> = {
    'durian tunggal': [2.3130, 102.2810],
    'alor gajah': [2.3833, 102.2167],
    'ayer keroh': [2.2700, 102.2850],
    'jasin': [2.3110, 102.4330],
    'melaka tengah': [2.2215, 102.2530]
  };

  useEffect(() => {
    const fetchShelterAndLocationData = async () => {
      // 1. Fetch Shelters from Supabase and parse coordinate types safely
      const { data: shelterData, error } = await supabase
        .from('shelters')
        .select('*, districts(districtname)')
        .order('sheltername');

      if (!error && shelterData) {
        const formattedShelters = shelterData.map(shelter => ({
          ...shelter,
          latitude: Number(shelter.latitude),
          longitude: Number(shelter.longitude),
          // Set safe schema defaults for metric UI if fields are unpopulated
          capacity: shelter.capacity || 300,
          occupied: shelter.occupied || 0,
        }));
        setShelters(formattedShelters as ExtendedShelterData[]);
      }

      // 2. Fetch Active User Pinned Location Settings
      const { data: { session } } = await supabase.auth.getSession();
      let profileDistrictName = '';

      if (session) {
        const { data: pinned } = await supabase
          .from('pinnedlocation')
          .select('districts(districtname)')
          .eq('userid', session.user.id)
          .eq('isprimary', true)
          .single();
          
        type District = { districtname?: string };
        type PinnedRecord = { districts?: District | District[] } | null;
        const pinnedRecord = pinned as PinnedRecord;
        const districtObj = Array.isArray(pinnedRecord?.districts)
          ? pinnedRecord!.districts[0]
          : pinnedRecord?.districts;

        if (districtObj?.districtname) {
          profileDistrictName = districtObj.districtname;
          setUserLocName(profileDistrictName);
        }
      }

      // 3. Hardware GPS Geolocation Verification Engine
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setDeviceCoords([latitude, longitude]);
            setTrackingStatus('Live Device Tracking Active');
            setIsLoading(false);
          },
          (geoError) => {
            console.warn('Geolocation access restricted/timed out:', geoError.message);
            setTrackingStatus('GPS Denied - Using Profile Default');
            
            if (profileDistrictName) {
              const searchKey = profileDistrictName.toLowerCase();
              const matchedFallback = Object.keys(fallbackGeocode).find(key => searchKey.includes(key));
              if (matchedFallback) {
                setDeviceCoords(fallbackGeocode[matchedFallback]);
              }
            }
            setIsLoading(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setTrackingStatus('Browser Geolocation Unsupported');
        if (profileDistrictName) {
          const searchKey = profileDistrictName.toLowerCase();
          const matchedFallback = Object.keys(fallbackGeocode).find(key => searchKey.includes(key));
          if (matchedFallback) setDeviceCoords(fallbackGeocode[matchedFallback]);
        }
        setIsLoading(false);
      }
    };

    fetchShelterAndLocationData();
  }, [supabase]);

  // Derived dashboard analytics from database values
  const activeCount = shelters.filter((s) => s.status?.toLowerCase() === "active").length;
  const totalOccupied = shelters.reduce((acc, s) => acc + (s.occupied || 0), 0);
  const totalCapacity = shelters.reduce((acc, s) => acc + (s.capacity || 1), 0);
  const aggregatePercent = Math.round((totalOccupied / totalCapacity) * 100);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#E2E8F0", background: "#020617", minHeight: "100vh", padding: "32px", width: "100%" }}>
      
      {/* Dynamic Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", margin: 0, letterSpacing: "-0.03em" }}>Emergency Shelters</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            {activeCount} active facilities reporting · {totalOccupied.toLocaleString()} total evacuees registered state-wide
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div
            style={{
              background: deviceCoords && trackingStatus.includes('Live') ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
              border: `1px solid ${deviceCoords && trackingStatus.includes('Live') ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)"}`,
              borderRadius: 12,
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: deviceCoords && trackingStatus.includes('Live') ? "#10B981" : "#F59E0B", animation: "pulse 2s infinite" }} />
            <span style={{ color: deviceCoords && trackingStatus.includes('Live') ? "#10B981" : "#F59E0B", fontSize: 13, fontWeight: 600 }}>
              🛰️ {trackingStatus}
            </span>
          </div>

          {userLocName && (
            <div style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center" }}>
              <span style={{ color: "#3B82F6", fontSize: 13, fontWeight: 600 }}>
                📍 Pinned District: {userLocName}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Geospatial Layout Block */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }}>
        
        {/* Interactive Mapping Node Container */}
        <div
          style={{
            background: "#0F172A",
            border: "1px solid #1E293B",
            borderRadius: 24,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: 530, position: "relative" }}>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 text-slate-400 text-sm font-medium animate-pulse">
                <Activity className="animate-spin mr-2" size={16} /> Synchronizing geospatial coordinate layers...
              </div>
            ) : (
              <ShelterMapWrapper shelters={shelters} userLocation={deviceCoords} />
            )}
          </div>
          
          <div style={{ padding: "16px 24px", borderTop: "1px solid #1E293B", background: "rgba(255,255,255,0.01)", display: "flex", gap: 24 }}>
            <StatPill color="#10B981" label="Active Facilities" value={activeCount} />
            <StatPill color="#F59E0B" label="Standby Capacity" value={shelters.length - activeCount} />
            <StatPill color="#2563EB" label="State Occupancy Rate" value={`${aggregatePercent}%`} />
          </div>
        </div>

        {/* Real-time Facility Capacity Sidebar */}
        <div
          style={{
            background: "#0F172A",
            border: "1px solid #1E293B",
            borderRadius: 24,
            display: "flex",
            flexDirection: "column",
            height: 602,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "20px 24px", borderBottom: "1px solid #1E293B", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-slate-400" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Evacuation Registry
              </span>
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {shelters.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                No shelter registration entries found in database registry.
              </div>
            ) : (
              shelters.map((shelter) => {
                const capacity = shelter.capacity || 300;
                const occupied = shelter.occupied || 0;
                const pct = Math.round((occupied / capacity) * 100);
                
                const rawStatus = (shelter.status || 'standby').toLowerCase();
                const badgeColor = rawStatus === "active" ? "#10B981" : "#F59E0B";
                
                const dObj = Array.isArray(shelter.districts) ? shelter.districts[0] : shelter.districts;
                const districtDisplay = dObj?.districtname || 'State-wide';

                return (
                  <div
                    key={shelter.shelterid}
                    style={{
                      background: "#0B1220",
                      border: "1px solid #1E293B",
                      borderRadius: 16,
                      padding: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.3 }}>
                          {shelter.sheltername}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                          {districtDisplay} District
                        </div>
                      </div>
                      <StatusBadge status={rawStatus} color={badgeColor} />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Phone size={12} className="text-slate-600" />
                      <span style={{ fontSize: 12, color: "#64748B", fontFamily: "JetBrains Mono, monospace" }}>
                        {shelter.contactnumber || 'No Contact Listed'}
                      </span>
                    </div>

                    {/* Adaptive Capacity Sub-Render */}
                    <div>
                      <div className="flex justify-between mb-1.5" style={{ fontSize: 11 }}>
                        <span style={{ color: "#475569", fontWeight: 500 }}>Live Capacity Status</span>
                        <span style={{ color: "#94A3B8", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
                          {occupied} / {capacity} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 6, background: "#1E293B", borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${Math.min(pct, 100)}%`,
                            background: pct > 85 ? "#EF4444" : pct > 60 ? "#F59E0B" : "#10B981",
                            borderRadius: 4,
                            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// --- SUBSIDIARY INTERFACE LAYOUT COMPONENTS ---
function StatusBadge({ status, color }: { status: string; color: string }) {
  const Icon = status === "active" ? CheckCircle2 : Clock;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        background: color + "15",
        border: `1px solid ${color}30`,
        borderRadius: 20,
        padding: "4px 10px",
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={12} color={color} />
      <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.02em" }}>
        {status}
      </span>
    </div>
  );
}

function StatPill({ color, label, value }: { color: string; label: string; value: string | number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>{label}:</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{value}</span>
    </div>
  );
}