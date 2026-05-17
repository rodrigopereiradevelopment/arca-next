import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function POST() {
  const supabase = getSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
