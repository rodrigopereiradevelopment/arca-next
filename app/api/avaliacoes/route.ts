import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supermercadoId = searchParams.get('supermercado_id');

  const supabase = getSupabaseServerClient();

  if (supermercadoId) {
    const { data: avaliacoes } = await supabase
      .from('avaliacao_supermercado')
      .select('nota_geral, nota_atendimento, nota_qualidade, nota_preco, comentario, data_avaliacao, user_id')
      .eq('supermercado_id', supermercadoId)
      .eq('verificado', true)
      .order('data_avaliacao', { ascending: false });

    const { data: medias } = await supabase
      .rpc('get_avaliacao_medias', { p_supermercado_id: Number(supermercadoId) });

    if (!medias) {
      const all = await supabase
        .from('avaliacao_supermercado')
        .select('nota_geral, nota_atendimento, nota_qualidade, nota_preco')
        .eq('supermercado_id', supermercadoId);

      const rows = all.data || [];
      const calcMedia = (campo: string) =>
        rows.length > 0
          ? rows.reduce((s: number, r: any) => s + Number(r[campo] || 0), 0) / rows.length
          : 0;

      return NextResponse.json({
        avaliacoes: avaliacoes || [],
        media_geral: Math.round(calcMedia('nota_geral') * 10) / 10,
        media_atendimento: Math.round(calcMedia('nota_atendimento') * 10) / 10,
        media_qualidade: Math.round(calcMedia('nota_qualidade') * 10) / 10,
        media_preco: Math.round(calcMedia('nota_preco') * 10) / 10,
        total: rows.length,
      });
    }

    return NextResponse.json({
      avaliacoes: avaliacoes || [],
      media_geral: Number(medias.media_geral) || 0,
      media_atendimento: Number(medias.media_atendimento) || 0,
      media_qualidade: Number(medias.media_qualidade) || 0,
      media_preco: Number(medias.media_preco) || 0,
      total: Number(medias.total) || 0,
    });
  }

  const { data } = await supabase
    .from('avaliacao_supermercado')
    .select('supermercado_id, nota_geral, nota_atendimento, nota_qualidade, nota_preco');

  const agrupado = (data || []).reduce((acc: any, r: any) => {
    if (!acc[r.supermercado_id]) {
      acc[r.supermercado_id] = { soma_geral: 0, count: 0 };
    }
    acc[r.supermercado_id].soma_geral += Number(r.nota_geral || 0);
    acc[r.supermercado_id].count += 1;
    return acc;
  }, {});

  const resumo = Object.entries(agrupado).map(([id, v]: [string, any]) => ({
    supermercado_id: Number(id),
    media_geral: Math.round((v.soma_geral / v.count) * 10) / 10,
    total: v.count,
  }));

  return NextResponse.json(resumo);
}

export async function POST(req: NextRequest) {
  try {
    const { token, supermercado_id, nota_geral, nota_atendimento, nota_qualidade, nota_preco, comentario } = await req.json();

    if (!token || !supermercado_id) {
      return NextResponse.json({ erro: 'Token e supermercado são obrigatórios.' }, { status: 400 });
    }

    if (!nota_geral || nota_geral < 1 || nota_geral > 5) {
      return NextResponse.json({ erro: 'Nota geral deve ser entre 1 e 5.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ erro: 'Usuário não autenticado.' }, { status: 401 });
    }

    const { error: insertError } = await supabase
      .from('avaliacao_supermercado')
      .insert({
        user_id: user.id,
        supermercado_id: Number(supermercado_id),
        nota_geral: Math.min(5, Math.max(1, Number(nota_geral))),
        nota_atendimento: nota_atendimento ? Math.min(5, Math.max(1, Number(nota_atendimento))) : null,
        nota_qualidade: nota_qualidade ? Math.min(5, Math.max(1, Number(nota_qualidade))) : null,
        nota_preco: nota_preco ? Math.min(5, Math.max(1, Number(nota_preco))) : null,
        comentario: comentario || null,
        verificado: false,
      });

    if (insertError) {
      return NextResponse.json({ erro: 'Erro ao salvar avaliação.' }, { status: 500 });
    }

    return NextResponse.json({ mensagem: 'Avaliação enviada com sucesso!' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204, headers: { 'Allow': 'GET, POST, OPTIONS' } });
}
