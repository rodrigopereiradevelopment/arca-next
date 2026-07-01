import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const { data } = await getSupabase()
    .from('historico_listas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { token, nome, itens, total_estimado } = await req.json();
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  if (!nome || !itens || !Array.isArray(itens)) {
    return NextResponse.json({ erro: 'Nome e itens obrigatórios' }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from('historico_listas')
    .insert({ user_id: userId, nome, itens, total_estimado: total_estimado || 0 })
    .select();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ erro: 'Erro ao criar lista' }, { status: 500 });
  return NextResponse.json(data[0]);
}

export async function PUT(req: NextRequest) {
  const { token, id, nome, itens, total_estimado } = await req.json();
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const atualizar: Record<string, any> = {};
  if (nome !== undefined) atualizar.nome = nome;
  if (itens !== undefined) atualizar.itens = itens;
  if (total_estimado !== undefined) atualizar.total_estimado = total_estimado;
  if (Object.keys(atualizar).length === 0) {
    return NextResponse.json({ erro: 'Nada para atualizar' }, { status: 400 });
  }
  const { data, error } = await getSupabase()
    .from('historico_listas')
    .update(atualizar)
    .eq('id', id)
    .eq('user_id', userId)
    .select();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  if (!data || data.length === 0) return NextResponse.json({ erro: 'Lista não encontrada' }, { status: 404 });
  return NextResponse.json(data[0]);
}

export async function DELETE(req: NextRequest) {
  const { token, id } = await req.json();
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const { error } = await getSupabase()
    .from('historico_listas')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
