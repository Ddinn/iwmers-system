'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // User State
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Notification State (RESTORED)
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // Location State
  const [districts, setDistricts] = useState<{ districtid: string, districtname: string }[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session) return router.push('/auth');

      setUserId(session.user.id);
      setEmail(session.user.email || '');

      // 1. Fetch available districts for dropdown
      const { data: districtData } = await supabase.from('districts').select('districtid, districtname').order('districtname');
      if (districtData) setDistricts(districtData);

      // 2. Fetch User Profile
      const { data: profile } = await supabase
        .from('users')
        .select('name, phonenumber, pushenabled, emailenabled, smsenabled')
        .eq('userid', session.user.id)
        .single();

      if (profile) {
        setName(profile.name || '');
        
        // Strip the '+60' from the database before putting it in the input state
        if (profile.phonenumber) {
          setPhone(profile.phonenumber.replace(/^\+60/, ''));
        }
        
        setPushEnabled(profile.pushenabled);
        setEmailEnabled(profile.emailenabled);
        setSmsEnabled(profile.smsenabled);
      }

      // 3. Fetch Primary Pinned Location
      const { data: pinnedData } = await supabase
        .from('pinnedlocation')
        .select('districtid')
        .eq('userid', session.user.id)
        .eq('isprimary', true)
        .single();
        
      if (pinnedData) setSelectedDistrictId(pinnedData.districtid);
      
      setIsLoading(false);
    };
    fetchData();
  }, [router, supabase]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    // Re-attach the +60 securely before saving
    const formattedPhone = phone.trim() ? `+60${phone.trim()}` : null;

    // 1. Update the Users Table
    const { error: userError } = await supabase
      .from('users')
      .update({
        name,
        phonenumber: formattedPhone,
        pushenabled: pushEnabled,
        emailenabled: emailEnabled,
        smsenabled: smsEnabled
      })
      .eq('userid', userId);

    if (userError) {
      setMessage({ type: 'error', text: userError.message });
      setIsSaving(false);
      return;
    }

    // 2. Update the Pinned Location Table
    if (selectedDistrictId) {
      // Un-primary existing locations to prevent duplicates
      await supabase.from('pinnedlocation').update({ isprimary: false }).eq('userid', userId);
      
      // Upsert the new primary location
      const { error: pinError } = await supabase.from('pinnedlocation').upsert({
        userid: userId,
        districtid: selectedDistrictId,
        isprimary: true,
        customname: 'Primary Residence',
        notifydaily: true,
        priority: 1
      }, { onConflict: 'userid, districtid' });

      if (pinError) console.error("Pin Error:", pinError);
    }

    setMessage({ type: 'success', text: 'Profile and preferences updated successfully!' });
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse text-slate-500 font-medium">Loading profile data...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">Account Settings</h1>
          <p className="text-slate-500">Manage your personal information and mapped locations.</p>
        </header>

        {message && (
          <div className={`p-4 rounded-lg border ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Section 1: Personal Info */}
          <div className="p-6 border-b border-slate-100 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">Personal Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" value={email} disabled className="w-full px-4 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed" />
              </div>

              {/* RESTORED: +60 Phone Trick */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
                <div className="flex">
                  <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-slate-600 font-semibold text-sm">
                    +60
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))} 
                    className="w-full px-4 py-2 border border-slate-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="12 345 6789"
                  />
                </div>
              </div>

              {/* NEW: Database-driven District Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Primary Monitoring District</label>
                <select 
                  value={selectedDistrictId} 
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  required
                >
                  <option value="" disabled>Select your district...</option>
                  {districts.map(d => (
                    <option key={d.districtid} value={d.districtid}>{d.districtname}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Notifications (RESTORED) */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Emergency Alert Preferences</h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                <div>
                  <span className="block text-sm font-medium text-slate-800">Push Notifications</span>
                  <span className="block text-xs text-slate-500">Receive alerts directly in your browser.</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                <div>
                  <span className="block text-sm font-medium text-slate-800">Email Summaries</span>
                  <span className="block text-xs text-slate-500">Get daily AI summaries and critical warnings via email.</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={smsEnabled} onChange={(e) => setSmsEnabled(e.target.checked)} className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500" />
                <div>
                  <span className="block text-sm font-medium text-slate-800">SMS / Text Messages</span>
                  <span className="block text-xs text-slate-500">Reserved for high-severity danger alerts only.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="p-6 bg-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:bg-blue-400"
            >
              {isSaving ? 'Saving Changes...' : 'Save Profile'}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}