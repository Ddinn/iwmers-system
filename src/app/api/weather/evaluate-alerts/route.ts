import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ThresholdRule = {
  thresholdid: string;
  metric: string;
  minvalue: string | number | null;
  maxvalue: string | number | null;
  alertlevel: string;
  districtid: string;
  hazardtypeid: string;
};

type ForecastRow = {
  forecastid: string;
  districtid: string;
  datatype: string;
  value: string;
  validfrom: string | null;
  validto: string | null;
  districts: { districtname: string }[] | null;
};

export async function GET() {
  try {
    console.log('Starting exact-schema Hazard Threshold Evaluation...');

    // 1. Fetch configured thresholds matching your precise public.hazardthresholds DDL
    const { data: thresholds, error: thresholdError } = await supabaseAdmin
      .from('hazardthresholds')
      .select('thresholdid, metric, minvalue, maxvalue, alertlevel, districtid, hazardtypeid');

    if (thresholdError) throw thresholdError;
    if (!thresholds || thresholds.length === 0) {
      return NextResponse.json({ success: true, message: 'No hazard thresholds configured in the database.' });
    }

    // 2. Fetch recent forecast metrics to cross-reference
    const { data: forecasts, error: forecastError } = await supabaseAdmin
      .from('weatherforecast')
      .select('forecastid, districtid, datatype, value, validfrom, validto, districts(districtname)')
      .order('validfrom', { ascending: false });

    if (forecastError) throw forecastError;
    if (!forecasts || forecasts.length === 0) {
      return NextResponse.json({ success: true, message: 'No recent forecast data found to evaluate.' });
    }

    const parseThresholdValue = (value: string | number | null): number | null => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    let alertsTriggered = 0;
    const pendingAlerts = [];

    // 3. Process records through explicit range boundaries
    for (const forecast of forecasts) {
      const numericValue = parseFloat(forecast.value);
      if (isNaN(numericValue)) continue; // Range checks require numerical data points (e.g., FGA Max Temp)

      const districtName = forecast.districts?.[0]?.districtname ?? 'Unknown District';

      for (const rule of thresholds) {
        // Enforce both metric compatibility and district boundary isolation
        if (forecast.datatype !== rule.metric || forecast.districtid !== rule.districtid) continue;

        let isBreached = false;
        let reason = '';

        // Check Upper Bound Breaches (e.g., Temperature exceeds Max Allowed)
        const maxLimit = parseThresholdValue(rule.maxvalue);
        if (maxLimit !== null && numericValue > maxLimit) {
          isBreached = true;
          reason = `Recorded value of ${numericValue} exceeded the maximum safety limit of ${maxLimit}.`;
        }

        // Check Lower Bound Breaches (e.g., Temperature drops below Min Allowed)
        const minLimit = parseThresholdValue(rule.minvalue);
        if (minLimit !== null && numericValue < minLimit) {
          isBreached = true;
          reason = `Recorded value of ${numericValue} fell below the minimum safety limit of ${minLimit}.`;
        }

        // 4. If a threshold condition is met, construct an exact match for public.weatheralerts
        if (isBreached) {
          pendingAlerts.push({
            districtid: forecast.districtid, // UUID
            severity: rule.alertlevel,        // e.g., Warning, Danger
            title: `${rule.metric} Threshold Breach in ${districtName}`,
            message: `Automated System Alert: Critical environmental shift observed. ${reason}`,
            expiryat: forecast.validto ? new Date(forecast.validto).toISOString() : null
            // alertid uses gen_random_uuid() automatically via your DDL default
            // issuedat uses timezone('utc'::text, now()) automatically via your DDL default
          });
          alertsTriggered++;
        }
      }
    }

    // 5. Batch insert compliant alerts directly into Supabase
    if (pendingAlerts.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('weatheralerts')
        .insert(pendingAlerts);

      if (insertError) throw insertError;
    }

    return NextResponse.json({
      success: true,
      message: `Evaluation pipeline executed smoothly. Evaluated ${forecasts.length} rows against active boundaries and committed ${alertsTriggered} alerts to public.weatheralerts.`
    });

  } catch (error: unknown) {
    console.error('Threshold Engine Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}