'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Zap, Lock, Mail, Eye, EyeOff, User, ShieldAlert } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  
  // Supabase Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Notification Preferences
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // UI State
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // --- SIGN IN FLOW ---
        // 👇 Here is where we extract 'data' so TypeScript can see it! 👇
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Check the user's role from their metadata
        const userRole = data.user?.user_metadata?.role;

        // SMART ROUTING
        if (userRole === 'Admin') {
          router.push('/admin'); // Send Admins to the Command Center
        } else {
          router.push('/dashboard'); // Send Public Users to the Map
        }
        
      } else {
        // --- SIGN UP FLOW ---
        const formattedPhone = phone.trim() ? `+60${phone.trim()}` : null;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              phonenumber: formattedPhone,
              pushenabled: pushEnabled,
              emailenabled: emailEnabled,
              smsenabled: smsEnabled,
              role: 'Public' // Automatically assign them the Public role
            }
          }
        });
        if (error) throw error;
        
        alert('Account created successfully! You can now sign in.');
        setIsLogin(true); 
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    background: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "12px 14px 12px 40px",
    color: "#0F172A",
    fontSize: "14px",
    outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden" style={{ background: "#020617", fontFamily: "'Inter', sans-serif" }}>
      
      {/* Background Grid & Glow (Figma Aesthetics) */}
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(37,99,235,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none" }} />
      <div style={{ position: "fixed", top: "10%", left: "50%", transform: "translateX(-50%)", width: 600, height: 300, background: "radial-gradient(ellipse, rgba(37,99,235,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 460, background: "#0F172A", border: "1px solid #1E293B", borderRadius: 24, padding: "40px", position: "relative", zIndex: 1, boxShadow: "0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(37,99,235,0.1)" }}>
        
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-8 gap-4">
          <div className="flex items-center justify-center rounded-2xl" style={{ width: 60, height: 60, background: "linear-gradient(135deg, #2563EB, #1D4ED8)", boxShadow: "0 8px 32px rgba(37,99,235,0.4)" }}>
            <Zap size={28} color="#fff" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <div style={{ color: "#2563EB", fontSize: 12, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Atmos</div>
            <h1 style={{ color: "#E2E8F0", fontSize: 22, fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>
              {isLogin ? 'Welcome to Command' : 'Create Operator Account'}
            </h1>
            <p style={{ color: "#64748B", fontSize: 13, marginTop: 6 }}>
              {isLogin ? 'Disaster Risk Monitoring & Early Warning' : 'Register for emergency weather alerts'}
            </p>
          </div>
        </div>

        {/* Error Handling */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          
          {/* --- SIGN UP FIELDS --- */}
          {!isLogin && (
            <>
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>Full Name</label>
                <div style={{ position: "relative" }}>
                  <User size={16} color="#475569" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Muhammad Arifuddin" style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "#2563EB")} onBlur={(e) => (e.target.style.borderColor = "#334155")} />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>Phone Number (Optional)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-[#334155] bg-[#1E293B] text-[#94A3B8] font-semibold text-sm">
                    +60
                  </span>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} placeholder="12 345 6789" style={{ ...inputStyle, paddingLeft: 14, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} onFocus={(e) => (e.target.style.borderColor = "#2563EB")} onBlur={(e) => (e.target.style.borderColor = "#334155")} />
                </div>
              </div>

              {/* Dark Mode Notification Preferences */}
              <div className="bg-[#1E293B]/50 p-4 rounded-xl border border-[#334155] space-y-3 mt-2">
                <p className="text-sm font-semibold text-[#E2E8F0] border-b border-[#334155] pb-2">Alert Preferences</p>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} className="w-4 h-4 rounded border-[#334155] bg-[#0F172A] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#0F172A]" />
                  <span className="text-sm text-[#94A3B8]">Enable Push Notifications</span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="w-4 h-4 rounded border-[#334155] bg-[#0F172A] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#0F172A]" />
                  <span className="text-sm text-[#94A3B8]">Receive Email Alerts</span>
                </label>
                
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input type="checkbox" checked={smsEnabled} onChange={(e) => setSmsEnabled(e.target.checked)} className="w-4 h-4 rounded border-[#334155] bg-[#0F172A] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#0F172A]" />
                  <span className="text-sm text-[#94A3B8]">Receive SMS Warnings</span>
                </label>
              </div>
            </>
          )}

          {/* --- ALWAYS VISIBLE: Email & Password --- */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>Email Address</label>
            <div style={{ position: "relative" }}>
              <Mail size={16} color="#475569" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@melaka.gov.my" style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "#2563EB")} onBlur={(e) => (e.target.style.borderColor = "#334155")} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>Password</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} color="#475569" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
              <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••" minLength={6} style={inputStyle} onFocus={(e) => (e.target.style.borderColor = "#2563EB")} onBlur={(e) => (e.target.style.borderColor = "#334155")} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 4 }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isLogin && (
            <div className="flex justify-end">
              <button type="button" style={{ background: "none", border: "none", color: "#2563EB", fontSize: 13, cursor: "pointer" }}>
                Forgot credentials?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%", padding: "14px", marginTop: 8,
              background: isLoading ? "#1D4ED8" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
              border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 600,
              cursor: isLoading ? "not-allowed" : "pointer", boxShadow: "0 4px 24px rgba(37,99,235,0.35)",
              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {isLoading ? (
              <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Processing...</>
            ) : (
              <>{isLogin ? <><Lock size={16} /> Secure Login</> : "Initialize Account"}</>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(null); }}
            style={{ background: "none", border: "none", color: "#64748B", fontSize: 13, cursor: "pointer" }}
          >
            {isLogin ? (
              <>New operator? <span style={{ color: "#2563EB", fontWeight: 600 }}>Create Account</span></>
            ) : (
              <>Already have an operator ID? <span style={{ color: "#2563EB", fontWeight: 600 }}>Secure Login</span></>
            )}
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}