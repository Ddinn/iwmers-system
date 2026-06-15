import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MET_API_URL = 'https://api.met.gov.my/v2.1/locations';
const MET_TOKEN = process.env.MET_MALAYSIA_TOKEN!;

interface MetLocation {
  id: string;
  name: string;
  locationrootid?: string | null; // FIX 1: Corrected property name
}

async function fetchAllMetLocations(categoryId: string): Promise<MetLocation[]> {
  let allLocations: MetLocation[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let fetchUrl = `${MET_API_URL}?locationcategoryid=${categoryId}`;
    if (offset > 0) {
      fetchUrl += `&offset=${offset}`;
    }

    const response = await fetch(fetchUrl, {
      headers: { 'Authorization': `METToken ${MET_TOKEN.trim()}` }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MET API Error (${response.status}): ${errorText} | URL: ${fetchUrl}`);
    }

    const data: { results?: MetLocation[] } = await response.json();
    
    if (data.results && data.results.length > 0) {
      allLocations = [...allLocations, ...data.results];
      
      if (data.results.length === 50) {
        offset += 50;
      } else {
        hasMore = false; 
      }
    } else {
      hasMore = false; 
    }
  }
  
  return allLocations;
}

export async function GET() {
  try {
    console.log('Fetching States...');
    const statesData = await fetchAllMetLocations('STATE');
    
    console.log('Fetching Districts...');
    const districtsData = await fetchAllMetLocations('DISTRICT');

    // 1. Format and Insert into 'states'
    const formattedStates = statesData.map((state) => ({
      statename: state.name,
      statecode: state.id.split(':')[1] || state.id, 
      metlocationid: state.id,
    }));

    const { data: insertedStates, error: stateError } = await supabaseAdmin
      .from('states')
      .upsert(formattedStates, { onConflict: 'metlocationid' })
      .select();

    if (stateError) throw stateError;

    // 2. Format and Insert into 'districts'
    const formattedDistricts = districtsData.map((district) => {
      // FIX 2: Match using locationrootid to link the district to the state
      const matchingState = insertedStates.find(s => s.metlocationid === district.locationrootid);
      
      return {
        districtname: district.name,
        metlocationid: district.id,
        stateid: matchingState ? matchingState.stateid : null
      };
    }).filter(d => d.stateid !== null); 

    const { error: districtError } = await supabaseAdmin
      .from('districts')
      .upsert(formattedDistricts, { onConflict: 'metlocationid' });

    if (districtError) throw districtError;

    return NextResponse.json({ 
      success: true, 
      message: `Successfully synced ${formattedStates.length} States and ${formattedDistricts.length} Districts from MET Malaysia.`
    });

  } catch (error: unknown) {
    console.error('Sync Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}