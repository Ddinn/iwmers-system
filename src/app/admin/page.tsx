'use client';

import { useState, useEffect } from 'react';
import { ShieldAlert, Radio, Home } from 'lucide-react';
import { ToastNotification } from '@/components/ToastNotification';

interface Shelter {
  shelterid: string;
  sheltername: string;
  capacity: number;
  status: string;
}

interface District {
  districtid: string;
  districtname: string;
}

export default function AdminCommandCenter() {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true); 
  const [toast, setToast] = useState({ show: false, message: '', sub: '' });
  
  // 👇 THE FIX 1: Create a declarative refresh trigger 👇
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [alertForm, setAlertForm] = useState({ districtid: '', title: '', message: '', severity: 'High' });

  // 👇 THE FIX 2: Move the fetch logic safely inside the useEffect 👇
  useEffect(() => {
    let isMounted = true; // Prevents memory leaks if the component unmounts quickly

    const loadAdminData = async () => {
      try {
        const res = await fetch('/api/dashboard?state=Melaka', { cache: 'no-store' });
        const data = await res.json();
        
        if (isMounted && data.success) {
          setShelters(data.data.shelters || []);
          setDistricts(data.data.districts || []);
          
          setAlertForm(prev => {
            if (!prev.districtid && data.data.districts?.length > 0) {
              return { ...prev, districtid: data.data.districts[0].districtid };
            }
            return prev;
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadAdminData();

    // Cleanup function
    return () => { isMounted = false; };
  }, [refreshTrigger]); // <-- Triggers re-run ONLY when refreshTrigger changes

  const handleUpdatePPS = async (shelterid: string, newCapacity: number, newStatus: string) => {
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'UPDATE_PPS', payload: { shelterid, capacity: newCapacity, status: newStatus } })
    });
    const data = await res.json();
    if (data.success) {
      setToast({ show: true, message: 'PPS Updated', sub: 'The public map has been updated.' });
      
      // 👇 THE FIX 3: Update the trigger to quietly refresh the data 👇
      setRefreshTrigger(prev => prev + 1); 
    }
  };

  const handleBroadcastAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify({ action: 'CREATE_ALERT', payload: alertForm })
    });
    const data = await res.json();
    if (data.success) {
      setToast({ show: true, message: 'Alert Broadcasted', sub: 'Warning pushed to public dashboard instantly.' });
      setAlertForm({ ...alertForm, title: '', message: '' }); 
    }
  };

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", padding: "32px", minHeight: "100vh", background: "#020617", color: "#F8FAFC" }}>
      <ToastNotification show={toast.show} onClose={() => setToast({ ...toast, show: false })} message={toast.message} sub={toast.sub} />
      
      <div className="mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-rose-500">
          <ShieldAlert /> Atmos Command Center
        </h1>
        <p className="text-slate-400 text-sm mt-1">Restricted Access: System Overrides & Logistics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PANEL 1: PPS CAPACITY MANAGEMENT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
            <Home className="text-emerald-400" size={20} />
            <h2 className="text-lg font-semibold text-slate-200">PPS Capacity Management</h2>
          </div>
          
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {loading ? <p className="text-slate-500 text-sm">Loading logistics data...</p> : shelters.map(pps => (
              <div key={pps.shelterid} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-emerald-400 text-sm">{pps.sheltername}</h3>
                  <p className="text-xs text-slate-500 mt-1">Current Max: {pps.capacity} pax</p>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    defaultValue={pps.capacity}
                    id={`cap-${pps.shelterid}`}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1 w-20 outline-none focus:border-emerald-500"
                  />
                  <select 
                    id={`status-${pps.shelterid}`}
                    defaultValue={pps.status}
                    className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-2 outline-none focus:border-emerald-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Full">Full</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <button 
                    onClick={() => {
                      const cap = (document.getElementById(`cap-${pps.shelterid}`) as HTMLInputElement).value;
                      const stat = (document.getElementById(`status-${pps.shelterid}`) as HTMLSelectElement).value;
                      handleUpdatePPS(pps.shelterid, parseInt(cap), stat);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-lg transition"
                  >
                    Update
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PANEL 2: MANUAL EMERGENCY BROADCAST */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
            <Radio className="text-rose-400" size={20} />
            <h2 className="text-lg font-semibold text-slate-200">Broadcast Emergency Alert</h2>
          </div>
          
          <form onSubmit={handleBroadcastAlert} className="space-y-4">
            <p className="text-xs text-slate-400 mb-4">
              Bypass AI analysis and manually push an emergency warning directly to the public dashboard.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target District</label>
              <select 
                required
                value={alertForm.districtid}
                onChange={e => setAlertForm({...alertForm, districtid: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-rose-500"
              >
                {districts.map(d => (
                  <option key={d.districtid} value={d.districtid}>{d.districtname}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Alert Severity</label>
              <select 
                value={alertForm.severity}
                onChange={e => setAlertForm({...alertForm, severity: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-rose-500"
              >
                <option value="High">Critical (Red)</option>
                <option value="Moderate">Warning (Amber)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Headline Title</label>
              <input 
                required
                type="text" 
                placeholder="e.g., Flash Flood Warning - Jalan Mawar"
                value={alertForm.title}
                onChange={e => setAlertForm({...alertForm, title: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Evacuation Instructions</label>
              <textarea 
                required
                rows={3}
                placeholder="Detail the threat and provide immediate instructions to the public..."
                value={alertForm.message}
                onChange={e => setAlertForm({...alertForm, message: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-4 py-2.5 outline-none focus:border-rose-500 resize-none"
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl transition shadow-[0_0_15px_rgba(225,29,72,0.3)] mt-4"
            >
              DEPLOY ALERT
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}