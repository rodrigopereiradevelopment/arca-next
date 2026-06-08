import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { token, nome, telefone, cidade } = await req.json();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });

  const { error } = await supabase
    .from('profiles')
    .update({ nome, telefone, cidade })
    .eq('id', user.id);

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
    .select('nome, telefone, cidade, foto_perfil')
    .eq('id', user.id)
    .single();

  return NextResponse.json(data || {});
}
