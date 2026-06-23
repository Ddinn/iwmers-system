import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- STRICT TYPES ---
interface WeatherForecastRow {
  forecastid: string;
  datatype: string;
  value: string;
  validfrom: string;
  validto: string;
  createdat: string;
  districtid: string;
}

interface DistrictJoin {
  districtname: string;
}

interface AIAnalysisRow {
  districtid: string;
  risklevel: 'High' | 'Moderate' | 'Low';
  summary: string;
  recommendation: string;
  generatedat: string;
  districts: DistrictJoin | DistrictJoin[] | null;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getStateId(stateName: string): string {
  const map: Record<string, string> = {
    'Johor': 'c480324d-0d4e-499d-8ee9-d98751fbaaee',
    'Kedah': '327b6463-026c-4833-93f5-6e537eccd4bb',
    'Kelantan': '55c91226-d5de-4a8e-b2bc-cb1214bf7bd3',
    'Melaka': 'e662ac7a-4c92-4da5-b77a-c3ef0302d3dc',
    'Negeri Sembilan': 'e01056dd-8de8-4545-bb62-73864aeb03e5',
    'Pahang': 'af3744f7-2515-4d65-858b-84860db5eb7f',
    'Pulau Pinang': '7bfe52a8-eac2-4bd9-8711-c6a246cdb6a1',
    'Perak': '0491a646-df8f-49f1-a132-9049216ad5c5',
    'Perlis': 'd6f1825b-79a1-4644-a877-4ffa60c33c14',
    'Selangor': '7cabbbed-9c6b-4a70-977c-8de197284182',
    'Terengganu': '789d9f20-5600-4764-b14d-65a762f445e9',
    'Sabah': '8f4be8ed-708d-4c42-b546-a1960fea8e25',
    'Sarawak': '89c8f020-37a4-435a-b61b-8892a0c6a04b',
    'Kuala Lumpur': '7c3f17d2-3d96-49c2-8b1e-2487be2b48e6',
    'Labuan': '7fa37859-5999-482e-9cee-bfce440c98cc',
    'Putrajaya': '29b88faa-70ed-4ca8-8025-7f9a2dbfbeec'
  };
  return map[stateName] || '04'; 
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetStateName = searchParams.get('state') || 'Melaka';
    const targetStateId = getStateId(targetStateName);

    // 1. Fetch Districts
    const { data: districtRows, error: districtError } = await supabaseAdmin
      .from('districts')
      .select('*')
      .eq('stateid', targetStateId);

    if (districtError) console.warn('Districts fetch exception:', districtError);
    
    const validDistricts = districtRows || [];
    const validDistrictIds = validDistricts.map(d => d.districtid);

    if (validDistrictIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          metrics: { temperature: "--", minTemperature: "--", condition: "No Data", activeAlerts: 0 },
          alerts: [], insights: [], districts: [], shelters: [], weatherDataCount: 0, trend: []
        }
      });
    }

    // 2. Fetch Active Alerts
    const { data: activeAlerts, error: alertsError } = await supabaseAdmin
      .from('weatheralerts')
      .select('*')
      .in('districtid', validDistrictIds)
      .order('issuedat', { ascending: false });

    if (alertsError) console.warn('Alerts fetch exception:', alertsError);

    // 3. Fetch AI Insights
    const { data: aiInsights, error: aiError } = await supabaseAdmin
      .from('aianalysis')
      .select('districtid, risklevel, summary, recommendation, generatedat, districts(districtname)')
      .in('districtid', validDistrictIds)
      .order('generatedat', { ascending: false })
      .limit(10);

    if (aiError) console.warn('AI Insights fetch exception:', aiError);

    const transformedInsights = (aiInsights as unknown as AIAnalysisRow[])?.map((insight) => {
      const singleDistrict = Array.isArray(insight.districts) ? insight.districts[0] : insight.districts;
      return {
        districtid: insight.districtid,
        risklevel: insight.risklevel,
        summary: insight.summary,
        recommendation: insight.recommendation,
        generatedat: insight.generatedat,
        districtname: singleDistrict?.districtname || `${targetStateName} Region`
      };
    }) || [];

    // 👇 ADDED: 3B. Fetch Active PPS Evacuation Shelters 👇
    const { data: shelters, error: sheltersError } = await supabaseAdmin
      .from('shelters')
      .select('*')
      .in('districtid', validDistrictIds);

    if (sheltersError) console.warn('Shelters fetch exception:', sheltersError);

    // 4. Fetch Raw MET Forecasts
    const { data: weatherRows, error: weatherError } = await supabaseAdmin
      .from('weatherforecast')
      .select('*')
      .in('districtid', validDistrictIds)
      .order('createdat', { ascending: false });

    if (weatherError) console.warn('MET Forecast data fetch exception:', weatherError);
    const forecastData = (weatherRows as WeatherForecastRow[]) || [];

    // 5. Extract Metrics & Calculate Exact Mean
    const latestMaxTempRow = forecastData.find(x => x.datatype === 'FMAXT');
    const latestMinTempRow = forecastData.find(x => x.datatype === 'FMINT');
    const latestConditionRow = forecastData.find(x => ['FSIGW', 'FGA', 'FGM', 'FGI'].includes(x.datatype));

    let meanTempStr = '--';
    if (latestMaxTempRow && latestMinTempRow) {
      const maxT = parseFloat(latestMaxTempRow.value);
      const minT = parseFloat(latestMinTempRow.value);
      if (!isNaN(maxT) && !isNaN(minT)) {
        meanTempStr = ((maxT + minT) / 2).toFixed(1);
      }
    }

    const metrics = {
      temperature: meanTempStr !== '--' ? `${meanTempStr}°C` : '--',
      minTemperature: latestMinTempRow ? `${latestMinTempRow.value}°C` : '--', 
      condition: latestConditionRow ? latestConditionRow.value : 'Nominal',
      activeAlerts: activeAlerts?.length ?? 0
    };

    // 6. Pivot Trend Data
    const trendMap: Record<string, { time: string; temp: number; rain: number }> = {};
    forecastData.slice(0, 80).forEach((item) => {
      const timestamp = item.validfrom || item.createdat;
      if (!timestamp) return;
      const timeStr = new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' });
      if (!trendMap[timeStr]) trendMap[timeStr] = { time: timeStr, temp: 28, rain: 0 }; 

      if (item.datatype === 'FMAXT' || item.datatype === 'FMINT') {
        const tempVal = parseFloat(item.value);
        if (!isNaN(tempVal)) trendMap[timeStr].temp = tempVal;
      }
      if (item.datatype === 'REAL_RAIN_MM') {
        const rainVal = parseFloat(item.value);
        if (!isNaN(rainVal)) trendMap[timeStr].rain = rainVal;
      }
    });

    const trend = Object.values(trendMap).reverse();

    return NextResponse.json({
      success: true,
      data: {
        metrics,
        alerts: activeAlerts || [],
        insights: transformedInsights,
        districts: validDistricts, 
        shelters: shelters || [], // Send PPS array down to client
        weatherDataCount: forecastData.length,
        trend: trend.length > 0 ? trend : [{ time: "00:00", temp: 25, rain: 0 }]
      }
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Critical aggregation fault';
    console.error('Server side error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}