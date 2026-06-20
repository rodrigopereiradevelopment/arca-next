import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function POST(req: NextRequest) {
  const { token, nome, telefone, cidade, cpf, estado, raio_busca, foto_perfil } = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });

  const updateData: Record<string, any> = { id: user.id, nome, telefone, cidade, cpf, estado, raio_busca };
  if (foto_perfil !== undefined) updateData.foto_perfil = foto_perfil;

  const { error } = await supabase
    .from('profiles')
    .upsert(updateData);

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });

  const { data } = await supabase
    .from('profiles')
    .select('nome, telefone, cidade, cpf, foto_perfil, estado, raio_busca')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json(data ?? {});
}
