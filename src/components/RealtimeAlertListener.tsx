'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ToastNotification } from '@/components/ToastNotification'; // Assuming you have this from earlier!

export default function RealtimeAlertListener() {
  const supabase = createClient();
  const [liveAlert, setLiveAlert] = useState<{ show: boolean; message: string; sub: string } | null>(null);

  useEffect(() => {
    // 1. Create a channel to listen to the weatheralerts table
    const alertChannel = supabase
      .channel('live-weather-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // We only care when a NEW alert is created
          schema: 'public',
          table: 'weatheralerts',
        },
        (payload) => {
          // 2. This callback fires the millisecond a new row is added!
          const newAlert = payload.new;
          
          setLiveAlert({
            show: true,
            message: `🚨 EMERGENCY: ${newAlert.title}`,
            sub: newAlert.message,
          });

          // Optional: Play an alert sound for high severity
          if (newAlert.severity === 'High') {
            const audio = new Audio('/alert-sound.mp3'); // Add a short mp3 to your /public folder
            audio.play().catch(e => console.log("Audio play blocked by browser:", e));
          }
        }
      )
      .subscribe();

    // 3. Cleanup the subscription when the user leaves the app
    return () => {
      supabase.removeChannel(alertChannel);
    };
  }, [supabase]);

  if (!liveAlert?.show) return null;

  return (
    <ToastNotification 
      show={liveAlert.show}
      message={liveAlert.message}
      sub={liveAlert.sub}
      onClose={() => setLiveAlert(null)}
    />
  );
}