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

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const { data } = await getSupabase().from('enderecos').select('*').eq('user_id', userId).order('principal', { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { token, ...endereco } = await req.json();
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const supabase = getSupabase();
  if (endereco.principal) await supabase.from('enderecos').update({ principal: false }).eq('user_id', userId);
  const { id: _id, ...enderecoSemId } = endereco;
  const { data, error } = await supabase.from("enderecos").insert({ ...enderecoSemId, user_id: userId }).select().single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
  const { token, id, ...endereco } = await req.json();
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });
  const userId = await getUserId(token);
  if (!userId) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });
  const supabase = getSupabase();
  if (endereco.principal) await supabase.from('enderecos').update({ principal: false }).eq('user_id', userId);
  const { data, error } = await supabase.from('enderecos').update(endereco).eq('id', id).eq('user_id', userId).select().single();
  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json(data);
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
