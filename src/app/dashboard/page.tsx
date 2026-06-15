'use client';

import { useEffect, useState } from "react";
import { RefreshCw, Brain, Thermometer, Droplets, ShieldAlert, TrendingUp, MapPin } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid } from "recharts";
import { ToastNotification } from "@/components/ToastNotification"; 
import MapWrapper, { type AlertData, type InsightData } from '@/components/MapWrapper';
import { triggerLiveSimulation } from "@/app/action/demo";

// --- STRICT TYPES FOR TYPE SAFETY ---
interface DistrictData {
  districtid: string;
  districtname: string;
  latitude: string | number;
  longitude: string | number;
  stateid?: string;
}

interface DashboardApiResponse {
  success: boolean;
  data: {
    metrics: {
      temperature: string;
      minTemperature: string;
      condition: string;
      activeAlerts: number;
    };
    alerts: AlertData[];
    insights: InsightData[];
    districts: DistrictData[];
    weatherDataCount: number;
    trend: Array<{ time: string; temp: number; rain: number }>;
  };
}

// --- SPATIAL MATH ENGINE ---
const MELAKA_DISTRICTS = {
  'Alor Gajah': { lat: 2.3833, lng: 102.2167 },
  'Jasin': { lat: 2.3110, lng: 102.4330 },
  'Melaka Tengah': { lat: 2.2215, lng: 102.2530 }
};

function getClosestDistrict(userLat: number, userLng: number): string {
  let closest = 'Alor Gajah';
  let minDistance = Infinity;
  for (const [district, coords] of Object.entries(MELAKA_DISTRICTS)) {
    const distance = Math.sqrt(Math.pow(userLat - coords.lat, 2) + Math.pow(userLng - coords.lng, 2));
    if (distance < minDistance) {
      minDistance = distance;
      closest = district;
    }
  }
  return closest;
}

// --- FIGMA UI COMPONENTS ---
function BentoCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 20, padding: 20, ...style }}>
      {children}
    </div>
  );
}

function Sparkline({ color, data }: { color: string; data: Array<{ idx?: number; v: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function WeatherCard({ icon, label, value, sub, color, sparkColor, isStatus, sparkData }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string; sparkColor: string; isStatus?: boolean; sparkData: Array<{ idx?: number; v: number }> }) {
  return (
    <BentoCard style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, color: "#64748B", fontWeight: 500 }}>{label}</span>
        {icon}
      </div>
      {isStatus ? (
        <div style={{ background: color + "18", border: `1px solid ${color}35`, borderRadius: 8, padding: "6px 10px", display: "inline-block", alignSelf: "flex-start" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "0.05em" }}>{value}</span>
        </div>
      ) : (
        <div style={{ fontSize: 24, fontWeight: 800, color: "#F1F5F9", lineHeight: 1 }}>{value}</div>
      )}
      <Sparkline color={sparkColor} data={sparkData} />
      <span style={{ fontSize: 11, color: "#475569" }}>{sub}</span>
    </BentoCard>
  );
}

// 👇 UPGRADED AI LINE COMPONENT TO SHOW RECOMMENDATIONS 👇
function AILine({ badge, color, summary, recommendation, districtName }: { badge: string; color: string; summary: string; recommendation?: string; districtName?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, borderBottom: "1px solid #1E293B", paddingBottom: 14, paddingTop: 4 }}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 10, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}30`, borderRadius: 6, padding: "2px 7px", letterSpacing: "0.06em" }}>
          {badge.toUpperCase()}
        </span>
        {districtName && <span style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 600 }}>{districtName}</span>}
      </div>
      <p style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.5, margin: 0 }}>{summary}</p>
      
      {/* THE RECOMMENDATION ACTION BOX */}
      {recommendation && (
        <div style={{ display: "flex", gap: 8, background: color + "0D", border: `1px solid ${color}25`, padding: "8px 10px", borderRadius: 8, marginTop: 2 }}>
          <ShieldAlert size={14} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 11.5, color: "#CBD5E1", lineHeight: 1.4, margin: 0 }}>
            <strong style={{ color: color, fontWeight: 700, letterSpacing: "0.03em" }}>ACTION: </strong>
            {recommendation}
          </p>
        </div>
      )}
    </div>
  );
}

// --- MAIN PAGE ---
export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', sub: '' });
  const [deviceCoords, setDeviceCoords] = useState<[number, number] | undefined>(undefined);
  const [selectedState, setSelectedState] = useState('Melaka');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const MALAYSIAN_STATES = [
    'Melaka', 'Johor', 'Selangor', 'Negeri Sembilan', 'Pahang', 
    'Perak', 'Kedah', 'Pulau Pinang', 'Kelantan', 'Terengganu', 
    'Perlis', 'Sabah', 'Sarawak', 'Kuala Lumpur'
  ];

  const [dashboardData, setDashboardData] = useState({
    alerts: [] as AlertData[],
    insights: [] as InsightData[],
    districts: [] as DistrictData[], 
    metrics: { temperature: "--", minTemperature: "--", condition: "Clear", activeAlerts: 0 },
    trend: [
      { time: "00:00", temp: 28, rain: 4 }, { time: "04:00", temp: 27, rain: 8 },
      { time: "08:00", temp: 29, rain: 15 }, { time: "12:00", temp: 33, rain: 22 }
    ]
  });

  useEffect(() => {
    let isMounted = true;

    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/dashboard?state=${encodeURIComponent(selectedState)}`);
        const json = await res.json() as DashboardApiResponse;

        if (isMounted && json.success && json.data) {
          setDashboardData(prev => ({
            alerts: json.data.alerts || [],
            insights: json.data.insights || [],
            districts: json.data.districts || [], 
            metrics: json.data.metrics || prev.metrics,
            trend: json.data.trend && json.data.trend.length > 0 ? json.data.trend : prev.trend
          }));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [selectedState, refreshTrigger]);

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setDeviceCoords([position.coords.latitude, position.coords.longitude]);
        },
        (err) => console.warn("Dashboard console initial GPS tracking failed:", err.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const handleSimulation = async () => {
    setIsSimulating(true);
    let targetDistrict = 'Alor Gajah'; 

    try {
      if ('geolocation' in navigator) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        setDeviceCoords([position.coords.latitude, position.coords.longitude]);
        targetDistrict = getClosestDistrict(position.coords.latitude, position.coords.longitude);
      }
    } catch (err) {
      console.warn("GPS Denied or Timeout.", err);
    }

    const result = await triggerLiveSimulation(targetDistrict);
    
    if (result.success) {
      try {
        await fetch(`/api/sync-rainfall?state=${encodeURIComponent(selectedState)}`, { 
          method: 'GET' 
        });
      } catch (scrapeErr) {
        console.warn("Rainfall scrape failed, proceeding with MET data only:", scrapeErr);
      }
      
      const syncedCount = result.metrics?.forecasts_inserted ?? 0;
      setToastConfig({
        show: true,
        message: `TARGET LOCKED: ${targetDistrict}`,
        sub: `Successfully synced ${syncedCount} records from MET Malaysia. Running AI analysis...`
      });

      setIsAnalyzing(true);
      try {
        const aiResponse = await fetch('/api/ai/analyze', {
          method: 'GET',
          headers: { 'Cache-Control': 'no-store' }
        });
        
        const aiData = await aiResponse.json();
        
        if (aiData.success) {
          setToastConfig({
            show: true,
            message: `TARGET LOCKED: ${targetDistrict}`,
            sub: `✅ Synced ${syncedCount} records & completed AI analysis.`
          });
        } else {
          setToastConfig({
            show: true,
            message: `TARGET LOCKED: ${targetDistrict}`,
            sub: `✅ Synced ${syncedCount} records (AI analysis issues encountered)`
          });
        }
      } catch (aiError) {
        console.error('AI Analysis error:', aiError);
      } finally {
        setIsAnalyzing(false);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      setRefreshTrigger(prev => prev + 1);
      setIsSimulating(false);
    } else {
      alert('Pipeline Failed: ' + result.error);
      setIsSimulating(false);
      setIsAnalyzing(false);
    }
  };

  const temperatureSpark = dashboardData.trend.length > 0 
    ? dashboardData.trend.map(d => ({ idx: 0, v: d.temp })) 
    : [{ idx: 0, v: 0 }];
  
  const precipitationSpark = dashboardData.trend.length > 0 
    ? dashboardData.trend.map(d => ({ idx: 0, v: d.rain })) 
    : [{ idx: 0, v: 0 }];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#E2E8F0", padding: "32px", minHeight: "100vh", background: "#020617", overflowX: "hidden" }}>
      
      <ToastNotification 
        show={toastConfig.show} 
        onClose={() => setToastConfig({ ...toastConfig, show: false })}
        message={toastConfig.message}
        sub={toastConfig.sub}
      />

      {/* Header Container */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#F1F5F9", margin: 0 }}>Atmos Command</h1>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>Real-time disaster risk monitoring · {selectedState}, Malaysia</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <MapPin size={16} color="#94A3B8" style={{ position: "absolute", left: 14, pointerEvents: "none" }} />
            <select 
              value={selectedState} 
              onChange={(e) => {
                setIsLoading(true);
                setSelectedState(e.target.value);
              }}
              style={{
                appearance: "none", background: "#0F172A", border: "1px solid #1E293B",
                borderRadius: 12, padding: "10px 36px 10px 40px", color: "#F1F5F9",
                fontSize: 14, fontWeight: 500, cursor: "pointer", outline: "none"
              }}
            >
              {MALAYSIAN_STATES.map(state => (
                <option key={state} value={state}>{state} Region</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSimulation}
            disabled={isSimulating || isAnalyzing}
            style={{
              display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
              border: "none", borderRadius: 12, padding: "10px 18px", color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: isSimulating || isAnalyzing ? "not-allowed" : "pointer", opacity: isSimulating || isAnalyzing ? 0.7 : 1, boxShadow: "0 4px 16px rgba(37,99,235,0.3)"
            }}
          >
            {isSimulating || isAnalyzing ? <span className="animate-spin"><RefreshCw size={15} /></span> : <RefreshCw size={15} />}
            {isSimulating ? "Syncing..." : isAnalyzing ? "Analyzing..." : "Sync MET Data"}
          </button>
        </div>
      </div>

      {/* Row 1 — Map + AI */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 16 }}>
        <BentoCard style={{ padding: 0, overflow: "hidden", minHeight: 320 }}>
          <div style={{ height: 320 }}>
            <MapWrapper 
              insights={dashboardData.insights} 
              alerts={dashboardData.alerts} 
              userLocation={deviceCoords} 
              districts={dashboardData.districts} 
            />
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid #1E293B" }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>Weather Risk Map · {selectedState} State</span>
          </div>
        </BentoCard>

        <BentoCard style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="flex items-center gap-2">
            <Brain size={16} color="#2563EB" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Analysis</span>
          </div>
          
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444" }} />
            <span style={{ color: "#EF4444", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>
              {dashboardData.alerts.length > 0 ? "HIGH RISK" : "NOMINAL"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, overflowY: "auto", maxHeight: "260px", paddingRight: 4 }}>
            {isLoading ? (
               <div className="text-slate-500 text-sm animate-pulse mt-2">Loading Database Insights...</div>
            ) : dashboardData.insights.length > 0 ? (
               dashboardData.insights.slice(0, 3).map((insight, i) => (
                 <AILine 
                   key={i} 
                   districtName={insight.districtname}
                   badge={insight.risklevel} 
                   color={insight.risklevel === 'High' ? "#EF4444" : insight.risklevel === 'Moderate' ? "#F59E0B" : "#10B981"} 
                   summary={insight.summary} 
                   recommendation={insight.recommendation}
                 />
               ))
            ) : (
               <div className="text-slate-500 text-sm mt-2">No active AI threats detected.</div>
            )}
          </div>
        </BentoCard>
      </div>

      {/* Row 2 — Streamlined Core Metric Weather Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
        <WeatherCard 
          icon={<Thermometer size={18} color="#EF4444" />} 
          label="Mean Temperature" 
          value={dashboardData.metrics.temperature} 
          sub={`Expected Min: ${dashboardData.metrics.minTemperature}`} 
          color="#EF4444" 
          sparkColor="#EF4444" 
          sparkData={temperatureSpark} 
        />
        
        <WeatherCard 
          icon={<Droplets size={18} color="#2563EB" />} 
          label="General Forecast" 
          value={dashboardData.metrics.condition} 
          sub="Current atmospheric outlook" 
          color="#2563EB" 
          sparkColor="#2563EB" 
          sparkData={precipitationSpark} 
        />
        
        <WeatherCard 
          icon={<ShieldAlert size={18} color={dashboardData.metrics.activeAlerts > 0 ? "#EF4444" : "#10B981"} />} 
          label="Active Alerts" 
          value={dashboardData.metrics.activeAlerts > 0 ? `${dashboardData.metrics.activeAlerts} Active` : "Clear"} 
          sub={`${dashboardData.alerts.length} registered threat zones`} 
          color={dashboardData.metrics.activeAlerts > 0 ? "#EF4444" : "#10B981"} 
          sparkColor={dashboardData.metrics.activeAlerts > 0 ? "#EF4444" : "#10B981"} 
          isStatus 
          sparkData={precipitationSpark} 
        />
      </div>

      {/* Row 3 — WEATHER TRENDS CONTAINER */}
      <BentoCard style={{ paddingBottom: 16 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} color="#2563EB" />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#F1F5F9" }}>48-Hour Weather Trends</span>
          </div>
          <div className="flex items-center gap-4">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 24, height: 2, background: "#2563EB", borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>Temperature (°C)</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 24, height: 2, background: "#10B981", borderRadius: 2 }} />
              <span style={{ fontSize: 12, color: "#64748B" }}>Rainfall (mm)</span>
            </div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={dashboardData.trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rainGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fill: "#475569", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, fontSize: 12 }} labelStyle={{ color: "#94A3B8" }} />
            <Area type="monotone" dataKey="temp" stroke="#2563EB" strokeWidth={2} fill="url(#tempGrad)" dot={false} />
            <Area type="monotone" dataKey="rain" stroke="#10B981" strokeWidth={2} fill="url(#rainGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </BentoCard>

    </div>
  );
}