'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { BarChart3, AlertTriangle, Activity, Smartphone, Mail, BellRing } from "lucide-react";

// --- INTERFACES (Mapped to your Supabase schema) ---
interface WeatherAlert {
  title: string;
  severity: string;
  message: string;
}

interface NotificationHistory {
  notificationid: string;
  channel: string;
  status: string;
  sentat: string;
  weatheralerts: WeatherAlert; 
}

// --- UI CONFIGURATION ---
const severityConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "Critical", color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)" },
  warning: { label: "Warning", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
  advisory: { label: "Advisory", color: "#3B82F6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)" },
  info: { label: "Info", color: "#94A3B8", bg: "rgba(148,163,184,0.10)", border: "rgba(148,163,184,0.2)" },
};

function SeverityPill({ severity }: { severity: string }) {
  // Normalize string to match our config keys
  const safeSeverity = (severity || 'info').toLowerCase();
  const cfg = severityConfig[safeSeverity] ?? severityConfig.info;
  
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
      {cfg.label.toUpperCase()}
    </span>
  );
}

function KpiCard({ icon, label, value, sub, valueColor }: { icon: React.ReactNode; label: string; value: string | number; sub: string; valueColor: string; }) {
  return (
    <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 20, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="flex items-center gap-2">
        {icon}
        <span style={{ fontSize: 12, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 36, fontWeight: 800, color: valueColor, lineHeight: 1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "#475569" }}>{sub}</div>
    </div>
  );
}

// --- MAIN PAGE COMPONENT ---
export default function ReportsPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [logs, setLogs] = useState<NotificationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalReceived, setTotalReceived] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUserHistory = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) return router.push('/login'); // Ensure route matches your auth page

      const { data, error } = await supabase
        .from('notificationhistory')
        .select(`
          notificationid,
          channel,
          status,
          sentat,
          weatheralerts ( title, severity, message )
        `)
        .eq('userid', session.user.id)
        .order('sentat', { ascending: false });

      if (!error && data) {
        const historyData = data as unknown as NotificationHistory[];
        setLogs(historyData);
        setTotalReceived(historyData.length);
        setUnreadCount(historyData.filter(log => log.status === 'Sent' || log.status === 'Unread').length);
      } else if (error) {
        console.error("Failed to fetch relational history:", error.message);
      }
      setIsLoading(false);
    };

    fetchUserHistory();
  }, [router, supabase]);

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "#020617" }}>
        <div className="text-slate-500 font-medium animate-pulse flex items-center gap-3">
          <Activity className="animate-spin" size={20} />
          Fetching secure alert history...
        </div>
      </main>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", color: "#E2E8F0", background: "#020617", minHeight: "100vh", padding: "32px", width: "100%" }}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F1F5F9", margin: 0, letterSpacing: "-0.03em" }}>System Analytics & Logs</h1>
          <p style={{ fontSize: 14, color: "#64748B", marginTop: 4 }}>
            Personalized incident ledger · Real-time Operator Communications
          </p>
        </div>
        <div style={{ background: "rgba(37,99,235,0.1)", border: "1px solid rgba(37,99,235,0.25)", borderRadius: 12, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
          <Activity size={16} color="#2563EB" className="animate-pulse" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#2563EB" }}>Live Connection Status</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>
        <KpiCard
          icon={<BarChart3 size={18} color="#2563EB" />}
          label="Total Notifications"
          value={totalReceived}
          sub="Dispatched to your registered devices"
          valueColor="#F1F5F9"
        />
        <KpiCard
          icon={<AlertTriangle size={18} color="#F59E0B" />}
          label="Recent / Unread Dispatches"
          value={unreadCount}
          sub="Awaiting operator acknowledgment"
          valueColor="#F59E0B"
        />
        <KpiCard
          icon={<Activity size={18} color="#10B981" />}
          label="System Status"
          value="NOMINAL"
          sub="All pipelines operational"
          valueColor="#10B981"
        />
      </div>

      {/* Relational Database Table */}
      <div style={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 24, overflow: "hidden" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1E293B", background: "rgba(255,255,255,0.02)" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F1F5F9", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Communication Ledger
          </span>
        </div>
        
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1E293B", background: "rgba(0,0,0,0.2)" }}>
                {["Dispatched At", "Channel", "Status", "Hazard Type", "Severity", "Incident Summary"].map((h) => (
                  <th key={h} style={{ padding: "14px 24px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "#64748B", fontSize: 14 }}>
                    No notifications have been dispatched to your account yet.
                  </td>
                </tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={log.notificationid} style={{ borderBottom: "1px solid #1E293B", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    
                    {/* Timestamp */}
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "#94A3B8", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>
                      {new Date(log.sentat).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    
                    {/* Channel */}
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "#E2E8F0", fontWeight: 500, whiteSpace: "nowrap" }}>
                      <div className="flex items-center gap-2">
                        {log.channel === 'SMS' ? <Smartphone size={14} className="text-blue-400" /> : log.channel === 'Email' ? <Mail size={14} className="text-amber-400" /> : <BellRing size={14} className="text-emerald-400" />}
                        {log.channel}
                      </div>
                    </td>

                    {/* Delivery Status */}
                    <td style={{ padding: "16px 24px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 12, background: log.status === 'Delivered' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)', color: log.status === 'Delivered' ? '#10B981' : '#94A3B8', border: `1px solid ${log.status === 'Delivered' ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.2)'}` }}>
                        {log.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Hazard Title */}
                    <td style={{ padding: "16px 24px", fontSize: 14, fontWeight: 600, color: "#F1F5F9", whiteSpace: "nowrap" }}>
                      {log.weatheralerts?.title || 'Unknown Hazard'}
                    </td>

                    {/* Severity Pill */}
                    <td style={{ padding: "16px 24px" }}>
                      <SeverityPill severity={log.weatheralerts?.severity} />
                    </td>

                    {/* Alert Message Summary */}
                    <td style={{ padding: "16px 24px", fontSize: 13, color: "#64748B", maxWidth: 300, lineHeight: 1.5 }} title={log.weatheralerts?.message}>
                      <div className="truncate">
                        {log.weatheralerts?.message || 'No specific details provided for this alert payload.'}
                      </div>
                    </td>
                    
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Footer info */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #1E293B", background: "rgba(255,255,255,0.02)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#475569" }}>Showing {logs.length} database records</span>
        </div>

      </div>
    </div>
  );
}