import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 👇 Define the exact shape of our data to satisfy TypeScript 👇
interface WeatherWarning {
  title: string;
  message: string;
  severity: string;
}

interface HistoryPayload {
  userid: string;
  alertid: string;
  channel: string;
  status: string;
}

export async function GET(request: Request) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const categories = ['THUNDERSTORM', 'RAIN'];
    
    // 👇 FIX 1: Changed to 'const' and strictly typed the array
    const newWarningsFound: WeatherWarning[] = [];

    // 1. FETCH FROM MET MALAYSIA
    for (const category of categories) {
      const metUrl = `https://api.met.gov.my/v2.1/data?datasetid=WARNING&datacategoryid=${category}&start_date=${today}&end_date=${today}`;
      
      const response = await fetch(metUrl, {
        headers: { 'Authorization': `Bearer ${process.env.MET_API_TOKEN}` }
      });
      
      const rawData = await response.json();
      
      if (rawData?.results && rawData.results.length > 0) {
        newWarningsFound.push({
          title: `MET Malaysia: ${category} Warning`,
          message: `Official warning issued for continuous heavy ${category.toLowerCase()}. Please remain vigilant.`,
          severity: category === 'RAIN' ? 'High' : 'Moderate',
        });
      }
    }

    // --- FYP MOCK DATA FALLBACK ---
    if (newWarningsFound.length === 0) {
      newWarningsFound.push({
        title: "MET Malaysia: THUNDERSTORM Warning",
        message: "Thunderstorms, heavy rain and strong winds are expected over the state of Melaka.",
        severity: "High"
      });
    }

    let totalNotificationsLogged = 0;

    // 2. PROCESS EACH WARNING
    for (const warning of newWarningsFound) {
      
      const { data: districtData } = await supabaseAdmin
        .from('districts')
        .select('districtid')
        .ilike('districtname', '%Alor Gajah%')
        .single();
      
      if (!districtData) continue;

      // A. SAVE TO WEATHER ALERTS & GET THE ID BACK
      const { data: alertData, error: alertError } = await supabaseAdmin
        .from('weatheralerts')
        .insert({
          districtid: districtData.districtid,
          title: warning.title,
          message: warning.message,
          severity: warning.severity,
          issuedat: new Date().toISOString()
        })
        .select('alertid') 
        .single();

      if (alertError || !alertData) {
        console.error("Failed to save alert:", alertError);
        continue; 
      }

      // B. FETCH SUBSCRIBED USERS
      const { data: users, error: userError } = await supabaseAdmin
        .from('users') 
        .select('userid, email, phonenumber, emailenabled, smsenabled, pushenabled')
        .eq('role', 'Public');

      if (!userError && users) {
        
        // 👇 FIX 2: Replaced 'any[]' with our strict HistoryPayload type
        const historyPayloads: HistoryPayload[] = [];

        users.forEach(user => {
          if (user.emailenabled && user.email) {
            console.log(`[EMAIL DISPATCHED] To: ${user.email}`);
            historyPayloads.push({ userid: user.userid, alertid: alertData.alertid, channel: 'Email', status: 'Sent' });
          }
          
          if (user.smsenabled && user.phonenumber) {
            console.log(`[SMS DISPATCHED] To: ${user.phonenumber}`);
            historyPayloads.push({ userid: user.userid, alertid: alertData.alertid, channel: 'SMS', status: 'Sent' });
          }
          
          if (user.pushenabled) {
            console.log(`[PUSH DISPATCHED] To Device for: ${user.email}`);
            historyPayloads.push({ userid: user.userid, alertid: alertData.alertid, channel: 'Push', status: 'Sent' });
          }
        });

        // D. EXECUTE BATCH INSERT TO HISTORY TABLE
        if (historyPayloads.length > 0) {
          const { error: historyError } = await supabaseAdmin.from('notificationhistory').insert(historyPayloads);
          if (historyError) {
            console.error("Failed to write history:", historyError);
          } else {
            totalNotificationsLogged += historyPayloads.length;
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${newWarningsFound.length} alerts. Successfully logged ${totalNotificationsLogged} notifications to history.` 
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}