import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, payload } = body;

    // 1. UPDATE EXISTING SHELTERS TABLE
    if (action === 'UPDATE_PPS') {
      const { shelterid, capacity, status } = payload;
      const { error } = await supabaseAdmin
        .from('shelters')
        .update({ capacity: parseInt(capacity), status })
        .eq('shelterid', shelterid);

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'PPS updated successfully.' });
    }

    // 2. INSERT INTO EXISTING WEATHER ALERTS TABLE
    if (action === 'CREATE_ALERT') {
      const { districtid, title, message, severity } = payload;
      const { error } = await supabaseAdmin
        .from('weatheralerts')
        .insert({
          districtid,
          title,
          message,
          severity,
          issuedat: new Date().toISOString()
        });

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Emergency alert broadcasted to public map.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid admin action.' }, { status: 400 });

  // 👇 THE FIX: Changed to 'unknown' and added a safe type check 👇
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}