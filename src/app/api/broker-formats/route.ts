import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth/getAuthUser';
import { createClient } from '@/lib/supabase/server';
import { generateFormatFingerprint } from '@/lib/parsers/broker-format-matcher';
import type { ColumnMapping } from '@/types';

/**
 * GET /api/broker-formats
 * Retrieve all broker formats, ordered by times_used DESC.
 * No auth required - broker formats are shared knowledge.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: formats, error } = await supabase
      .from('broker_formats')
      .select('*')
      .order('times_used', { ascending: false });

    if (error) {
      console.error('Failed to fetch broker formats:', error);
      return NextResponse.json({ error: 'Failed to fetch broker formats' }, { status: 500 });
    }

    return NextResponse.json({ formats });
  } catch (err) {
    console.error('Broker formats GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/broker-formats
 * Save a new broker format mapping.
 * Requires auth. On fingerprint conflict, increments times_used and
 * updates the mapping if the new confidence is higher.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { formatName, mapping, headers, headerRowIndex } = body as {
      formatName: string;
      mapping: ColumnMapping;
      headers: string[];
      headerRowIndex: number;
    };

    // Validate required fields
    if (!formatName || typeof formatName !== 'string' || formatName.trim().length === 0) {
      return NextResponse.json({ error: 'formatName is required' }, { status: 400 });
    }
    if (!mapping || typeof mapping !== 'object') {
      return NextResponse.json({ error: 'mapping is required' }, { status: 400 });
    }
    if (!mapping.symbol || !mapping.dateTime || !mapping.quantity || !mapping.price) {
      return NextResponse.json(
        { error: 'mapping must include symbol, dateTime, quantity, and price' },
        { status: 400 }
      );
    }
    if (!Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json({ error: 'headers must be a non-empty array' }, { status: 400 });
    }
    if (typeof headerRowIndex !== 'number' || headerRowIndex < 0) {
      return NextResponse.json(
        { error: 'headerRowIndex must be a non-negative number' },
        { status: 400 }
      );
    }

    const fingerprint = await generateFormatFingerprint(headers);
    const supabase = await createClient();

    // Check if a format with this fingerprint already exists
    const { data: existing, error: lookupError } = await supabase
      .from('broker_formats')
      .select('*')
      .eq('format_fingerprint', fingerprint)
      .maybeSingle();

    if (lookupError) {
      console.error('Failed to look up broker format:', lookupError);
      return NextResponse.json({ error: 'Failed to check existing formats' }, { status: 500 });
    }

    if (existing) {
      // Fingerprint conflict: increment times_used, update mapping if confidence is higher
      const newConfidence = 100; // New submissions have full confidence
      const updateFields: Record<string, unknown> = {
        times_used: existing.times_used + 1,
      };

      if (newConfidence > existing.confidence_score) {
        updateFields.column_symbol = mapping.symbol;
        updateFields.column_datetime = mapping.dateTime;
        updateFields.column_side = mapping.side;
        updateFields.column_quantity = mapping.quantity;
        updateFields.column_price = mapping.price;
        updateFields.column_commission = mapping.commission;
        updateFields.column_proceeds = mapping.proceeds;
        updateFields.column_currency = mapping.currency;
        updateFields.column_account = mapping.accountId;
        updateFields.column_asset_category = mapping.assetCategory;
        updateFields.confidence_score = newConfidence;
        updateFields.format_name = formatName.trim();
      }

      const { data: updated, error: updateError } = await supabase
        .from('broker_formats')
        .update(updateFields)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error('Failed to update broker format:', updateError);
        return NextResponse.json({ error: 'Failed to update broker format' }, { status: 500 });
      }

      return NextResponse.json({ format: updated, action: 'updated' });
    }

    // Insert new format
    const { data: created, error: insertError } = await supabase
      .from('broker_formats')
      .insert({
        created_by: user.id,
        format_name: formatName.trim(),
        format_fingerprint: fingerprint,
        column_symbol: mapping.symbol,
        column_datetime: mapping.dateTime,
        column_side: mapping.side,
        column_quantity: mapping.quantity,
        column_price: mapping.price,
        column_commission: mapping.commission,
        column_proceeds: mapping.proceeds,
        column_currency: mapping.currency,
        column_account: mapping.accountId,
        column_asset_category: mapping.assetCategory,
        header_row_index: headerRowIndex,
        sample_headers: headers,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert broker format:', insertError);
      return NextResponse.json({ error: 'Failed to save broker format' }, { status: 500 });
    }

    return NextResponse.json({ format: created, action: 'created' }, { status: 201 });
  } catch (err) {
    console.error('Broker formats POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
