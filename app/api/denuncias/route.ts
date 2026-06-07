import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function POST(req: NextRequest) {
  try {
    const { token, motivo, descricao, produto_id, preco_id, supermercado_id } = await req.json();
    if (!token || !motivo) {
      return NextResponse.json({ erro: 'Token e motivo são obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
    }

    const { error } = await supabase.from('denuncias').insert({
      user_id: user.id, motivo, descricao, produto_id, preco_id, supermercado_id, status: 'pendente',
    });

    if (error) {
      console.error('DENUNCIA INSERT ERROR:', error);
      return NextResponse.json({ erro: 'Erro ao enviar denúncia.' }, { status: 500 });
    }

    return NextResponse.json({ mensagem: 'Denúncia enviada com sucesso!' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ erro: 'Token obrigatório.' }, { status: 401 });

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isMod = profile?.role === 'admin' || profile?.role === 'moderator';

    let query = supabase
      .from('denuncias')
      .select(`
        id, motivo, descricao, status, created_at, resolvido_em,
        produto_id, preco_id, supermercado_id, user_id,
        moderador_id,
        produtos!left(id, nome, imagem_url),
        supermercados!left(id, nome, logo_url)
      `)
      .order('created_at', { ascending: false });

    if (!isMod) {
      query = query.eq('user_id', user.id);
    }

    const { data } = await query;
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { token, denuncia_id, status } = await req.json();
    if (!token || !denuncia_id) {
      return NextResponse.json({ erro: 'Token e denuncia_id obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
      return NextResponse.json({ erro: 'Apenas moderadores podem resolver denúncias.' }, { status: 403 });
    }

    const { error } = await supabase
      .from('denuncias')
      .update({
        status: status || 'resolvido',
        moderador_id: user.id,
        resolvido_em: new Date().toISOString(),
      })
      .eq('id', denuncia_id);

    if (error) return NextResponse.json({ erro: 'Erro ao atualizar denúncia.' }, { status: 500 });

    return NextResponse.json({ mensagem: 'Denúncia atualizada!' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204, headers: { Allow: 'GET, POST, PUT, OPTIONS' } });
}
