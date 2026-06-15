import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MET_API_URL = 'https://api.met.gov.my/v2.1/data';
const MET_TOKEN = process.env.MET_MALAYSIA_TOKEN!;

// Define a typed shape for MET API result items to avoid `any`
interface MetResult {
  datatype: string;
  value: number | string | null;
  date: string;
  attributes?: {
    unit?: string;
  };
}

// Typed shape for inserting into Supabase weatherforecast table
interface WeatherForecast {
  datatype: string;
  value: number | string | null;
  validfrom: string; // ISO string
  validto: string; // ISO string
  unit: string;
  districtid: number | string;
}

export async function POST(request: Request) {
  try {

    // --- SECURITY CHECK ---
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized. Only the Vercel Cron system can trigger this.' }, { status: 401 });
    }
    // ----------------------

    // 1. Get today's date and tomorrow's date for the API query
    const today = new Date().toISOString().split('T')[0];
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = tomorrowDate.toISOString().split('T')[0];

    // 2. Fetch the State ID for Melaka from your database
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from('states')
      .select('stateid, statename')
      .ilike('statename', '%Mel%') // '%Mel%' catches Melaka, Malacca, etc.
      .limit(1);

    // If there is a Supabase error, tell us exactly what it is!
    if (stateError) {
      throw new Error(`Database Error when finding state: ${stateError.message}`);
    }

    // If it found 0 matches, print out all the states it DOES have so we can check
    if (!stateData || stateData.length === 0) {
      const { data: allStates } = await supabaseAdmin.from('states').select('statename');
      throw new Error(`Could not find Melaka. Available states in DB are: ${JSON.stringify(allStates)}`);
    }

    const targetStateId = stateData[0].stateid;
    console.log(`Found State: ${stateData[0].statename}`);

    // 3. Fetch all Districts belonging to Melaka
    const { data: districts, error: districtError } = await supabaseAdmin
      .from('districts')
      .select('districtid, metlocationid, districtname')
      .eq('stateid', targetStateId);

    if (districtError) {
      throw new Error(`Database Error when finding districts: ${districtError.message}`);
    }
    if (!districts || districts.length === 0) {
      throw new Error(`State found, but 0 districts were linked to ${stateData[0].statename}.`);
    }

    const allForecasts: WeatherForecast[] = [];

    // 4. Loop through each district and fetch its weather forecast
    for (const district of districts) {
      console.log(`Fetching weather for ${district.districtname}...`);
      
      const fetchUrl = `${MET_API_URL}?datasetid=FORECAST&datacategoryid=GENERAL&locationid=${district.metlocationid}&start_date=${today}&end_date=${tomorrow}`;
      
      const response = await fetch(fetchUrl, {
        headers: { 'Authorization': `METToken ${MET_TOKEN.trim()}` }
      });

      if (!response.ok) {
        console.error(`Failed to fetch for ${district.districtname}`);
        continue; // Skip this district if it fails, move to the next
      }

      const data = await response.json();

      // 5. Map the MET API results to your WEATHERFORECAST table structure
      if (data.results && data.results.length > 0) {
        const results = data.results as MetResult[];
        const formattedData = results.map((item: MetResult) => ({
          datatype: item.datatype, // e.g., FGA (Max Temp), FGM (Min Temp), FGI (Weather)
          value: item.value,
          validfrom: new Date(item.date).toISOString(),
          validto: new Date(new Date(item.date).getTime() + 86400000).toISOString(), // +24 hours
          unit: item.attributes?.unit || 'N/A',
          districtid: district.districtid // Links safely via your foreign key!
        }));

        allForecasts.push(...formattedData);
      }
    }

    // 6. Insert all gathered forecasts into Supabase
    if (allForecasts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('weatherforecast')
        .insert(allForecasts);

      if (insertError) throw insertError;
    }

    // Return success metrics
    return NextResponse.json({
      success: true,
      message: 'MET Malaysia Sync Completed',
      metrics: {
        forecasts_inserted: allForecasts.length
      }
    });

  } catch (error: unknown) {
    console.error('Weather Sync Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}