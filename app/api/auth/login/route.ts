import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function POST(req: NextRequest) {
  const { email, senha } = await req.json();
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return NextResponse.json({ erro: error.message }, { status: 401 });
  const { data: perfil } = await supabase
    .from('profiles').select('nome, role').eq('id', data.user.id).maybeSingle();
  return NextResponse.json({
    id: data.user.id,
    email: data.user.email,
    nome: perfil?.nome || email.split('@')[0],
    tipo: perfil?.role || 'usuario',
    token: data.session?.access_token
  });
}
