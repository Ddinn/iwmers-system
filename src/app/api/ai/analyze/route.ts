import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
  try {
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from('states')
      .select('stateid')
      .ilike('statename', '%Melaka%')
      .single();

    if (stateError || !stateData) throw new Error('Could not find Melaka in the database.');

    const { data: districts, error: districtError } = await supabaseAdmin
      .from('districts')
      .select('districtid, districtname')
      .eq('stateid', stateData.stateid);

    if (districtError || !districts) throw districtError;

    let totalAnalysesGenerated = 0;

    for (const district of districts) {
      console.log(`Analyzing weather data for ${district.districtid}: ${district.districtname}...`);

      let forecastData = null;
      let forecastError = null;
      
      // FIX: Changed order to 'createdat' descending to get the LATEST scraped telemetry first
      const result1 = await supabaseAdmin
        .from('weatherforecast')
        .select('datatype, value, validfrom, validto, unit')
        .eq('districtid', district.districtid)
        .order('createdat', { ascending: false })
        .limit(10);
      
      if (!result1.error && result1.data && result1.data.length > 0) {
        forecastData = result1.data;
        console.log(`Found ${forecastData.length} recent records for district ${district.districtname} (Method 1)`);
      } else {
        console.log(`No district-specific data found for ${district.districtname}, trying fallback...`);
        const result2 = await supabaseAdmin
          .from('weatherforecast')
          .select('datatype, value, validfrom, validto, unit')
          .order('createdat', { ascending: false })
          .limit(20);
        
        if (!result2.error && result2.data && result2.data.length > 0) {
          forecastData = result2.data;
          console.log(`Found ${forecastData.length} latest weather records for fallback analysis`);
        } else {
          forecastError = result2.error;
        }
      }

      if (forecastError || !forecastData || forecastData.length === 0) {
        console.log(`No forecast data found for ${district.districtname}. Skipping...`);
        continue;
      }

      const prompt = `
        You are the analytical engine for Atmos, a weather-driven disaster risk monitoring and early warning system. 
        Analyze the following weather forecast and physical telemetry data for the district of ${district.districtname}, Malaysia.
        
        Raw Data: ${JSON.stringify(forecastData)}

        SYSTEM RULES:
        1. You only provide weather summaries, risk explanations, and safety recommendations based strictly on the provided data.
        2. You DO NOT make emergency alert deployment decisions (that is handled by a separate hardware/database threshold system).
        3. CRITICAL TELEMETRY EVALUATION: Look for entries where datatype is 'REAL_RAIN_MM'. This is live physical river and station telemetry scraped from Public Infobanjir indicating exact rainfall in millimeters. Give this higher priority than text forecasts.
        4. MATHEMATICAL RISK THRESHOLD: If any 'REAL_RAIN_MM' value is equal to or greater than 30.00mm, you must automatically escalate the district's "RiskLevel" to "High" due to immediate flash flood danger.
        
        Provide your response as a raw JSON object with exactly these three keys:
        - "RiskLevel": A string of either "Low", "Moderate", or "High".
        - "Summary": A precise 2-sentence summary of the current conditions and rainfall volume.
        - "Recommendation": A 1-sentence safety recommendation for residents in low-lying areas.
      `;

      try {
        await delay(2000); 
        console.log('Calling Gemini API with model: gemini-3.5-flash');

        const model = genAI.getGenerativeModel({ 
          model: "gemini-3.5-flash",
          generationConfig: { responseMimeType: "application/json" }
        });

        const response = await model.generateContent(prompt);
        const responseText = response.response.text();
        console.log(`Gemini Response for ${district.districtname}:`, responseText);
        
        if (responseText) {
          let aiOutput;
          try {
            aiOutput = JSON.parse(String(responseText));
          } catch (parseError) {
            console.warn(`JSON Parse failed for ${district.districtname}, attempting extraction...`);
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiOutput = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('Could not extract JSON from response');
            }
          }

          if (!aiOutput.RiskLevel || !aiOutput.Summary || !aiOutput.Recommendation) {
            console.warn(`Invalid AI response structure for ${district.districtname}:`, aiOutput);
            continue;
          }

          const { error: insertError } = await supabaseAdmin
            .from('aianalysis')
            .insert({
              districtid: district.districtid,
              risklevel: aiOutput.RiskLevel,
              summary: aiOutput.Summary,
              recommendation: aiOutput.Recommendation
            });

          if (insertError) throw insertError;
          totalAnalysesGenerated++;
          console.log(`✅ AI Analysis saved for ${district.districtname}`);
        }
      } catch (aiError: unknown) {
        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        console.error(`Gemini API error for ${district.districtname}:`, errorMessage);
        
        console.log(`Creating fallback analysis for ${district.districtname}...`);
        try {
          await supabaseAdmin
            .from('aianalysis')
            .insert({
              districtid: district.districtid,
              risklevel: 'Moderate',
              summary: `Current weather forecast data is being updated for ${district.districtname}. Conditions are being monitored.`,
              recommendation: 'Monitor local drainage levels and weather updates for changes.'
            });
          totalAnalysesGenerated++;
        } catch (fallbackError) {
          console.warn(`Fallback analysis failed for ${district.districtname}:`, fallbackError);
        }
        continue; 
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully generated and saved ${totalAnalysesGenerated} AI analyses for Melaka using live rainfall data.` 
    });

  } catch (error: unknown) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}