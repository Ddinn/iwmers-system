'use server';

import { headers } from 'next/headers';

// FIXED: Added targetDistrict: string to the parameters
export async function triggerLiveSimulation(targetDistrict: string) {
  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';

  try {
    const res = await fetch(`${protocol}://${host}/api/weather/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json', 
        'Cache-Control': 'no-store' 
      },
      // FIXED: Safely passing the district into the API body
      body: JSON.stringify({ targetDistrict }) 
    });
    
    const data = await res.json();
    return data;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage };
  }
}