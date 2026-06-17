import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function GET() {
  const supabase = getSupabaseServerClient();
  const hoje = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('cupons_desconto')
    .select(`
      *,
      supermercado:supermercado_id (nome, logo_url)
    `)
    .eq('ativo', true)
    .lte('data_inicio', hoje)
    .gte('data_fim', hoje)
    .order('created_at', { ascending: false });

  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  try {
    const { token, cupom_id } = await req.json();
    if (!token || !cupom_id) {
      return NextResponse.json({ erro: 'Token e cupom são obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
    }

    const { data: cupom } = await supabase
      .from('cupons_desconto')
      .select('*')
      .eq('id', cupom_id)
      .single();

    if (!cupom || !cupom.ativo) {
      return NextResponse.json({ erro: 'Cupom inválido ou expirado.' }, { status: 400 });
    }

    if (cupom.usos_realizados >= cupom.maximo_usos) {
      return NextResponse.json({ erro: 'Cupom esgotado.' }, { status: 400 });
    }

    const { data: jaUsou } = await supabase
      .from('uso_cupons')
      .select('id')
      .eq('cupom_id', cupom_id)
      .eq('user_id', user.id)
      .single();

    if (jaUsou) {
      return NextResponse.json({ erro: 'Você já usou este cupom.' }, { status: 400 });
    }

    const { error: usoError } = await supabase
      .from('uso_cupons')
      .insert({ cupom_id, user_id: user.id, valor_economia: cupom.valor_desconto || cupom.valor || 0 });

    if (usoError) {
      return NextResponse.json({ erro: 'Erro ao usar cupom.' }, { status: 500 });
    }

    await supabase
      .from('cupons_desconto')
      .update({ usos_realizados: (cupom.usos_realizados || 0) + 1 })
      .eq('id', cupom_id);

    return NextResponse.json({ mensagem: 'Cupom utilizado com sucesso!' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { 'Allow': 'GET, POST, OPTIONS' } });
}
