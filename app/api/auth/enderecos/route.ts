import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizeEndereco, validateEndereco } from '@/lib/validation';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUserId(token: string) {
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user.id;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const { data } = await getSupabase().from('enderecos').select('*').eq('user_id', userId).order('principal', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const raw = await req.json();
  const { token, ...enderecoRaw } = raw;
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  
  // Sanitizar e validar
  const endereco = sanitizeEndereco(enderecoRaw);
  const errors = validateEndereco(enderecoRaw);
  if (errors.length > 0) {
    return NextResponse.json({ erro: errors[0] }, { status: 400 });
  }
  
  const supabase = getSupabase();
  if (enderecoRaw.principal) await supabase.from('enderecos').update({ principal: false }).eq('user_id', userId);
  const { data, error } = await supabase.from("enderecos").insert({ ...endereco, user_id: userId }).select();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ erro: 'Erro ao criar endereço' }, { status: 500 });
  return NextResponse.json(data[0]);
}

export async function PUT(req: NextRequest) {
  const raw = await req.json();
  const { token, id, ...enderecoRaw } = raw;
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  
  // Sanitizar
  const endereco = sanitizeEndereco(enderecoRaw);
  
  const supabase = getSupabase();
  if (enderecoRaw.principal) await supabase.from('enderecos').update({ principal: false }).eq('user_id', userId);
  const { data, error } = await supabase.from('enderecos').update(endereco).eq('id', id).eq('user_id', userId).select();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ erro: 'Endereço não encontrado' }, { status: 404 });
  return NextResponse.json(data[0]);
}

export async function DELETE(req: NextRequest) {
  const { token, id } = await req.json();
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const { error } = await getSupabase().from('enderecos').delete().eq('id', id).eq('user_id', userId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
