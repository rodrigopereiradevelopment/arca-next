import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ erro: 'Token obrigatório.' }, { status: 401 });

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { data } = await supabase
      .from('favoritos')
      .select(`
        id, created_at, produto_id,
        produtos!inner (
          id, nome, imagem_url, marca,
          precos (id, preco, promocao, supermercado_id, supermercados (nome, logo_url))
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const resultado = (data ?? []).map((f: any) => {
      const precos = f.produtos?.precos ?? [];
      let menorPreco = 0;
      let mercadoMaisBarato = '';
      if (precos.length > 0) {
        const sorted = [...precos].sort((a: any, b: any) => a.preco - b.preco);
        menorPreco = sorted[0].preco;
        mercadoMaisBarato = sorted[0].supermercados?.nome || '';
      }
      return {
        id: f.id,
        produto_id: f.produto_id,
        created_at: f.created_at,
        nome: f.produtos?.nome || '',
        imagem_url: f.produtos?.imagem_url || '',
        marca: f.produtos?.marca || '',
        menorPreco,
        mercadoMaisBarato,
        precos: precos.map((p: any) => ({
          valor: p.preco,
          promocao: p.promocao,
          mercado: p.supermercados?.nome || '',
          logo: p.supermercados?.logo_url || '',
        })),
      };
    });

    return NextResponse.json(resultado);
  } catch (err) {
    console.error('FAVORITOS GET ERROR:', err);
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, produto_id } = await req.json();
    if (!token || !produto_id) {
      return NextResponse.json({ erro: 'Token e produto_id obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { error } = await supabase
      .from('favoritos')
      .insert({ user_id: user.id, produto_id });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ mensagem: 'Produto já favoritado.' });
      }
      return NextResponse.json({ erro: 'Erro ao favoritar.' }, { status: 500 });
    }

    return NextResponse.json({ mensagem: 'Favoritado!' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const produto_id = Number(req.nextUrl.searchParams.get('produto_id'));
    const token = req.nextUrl.searchParams.get('token') || req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token || !produto_id) {
      return NextResponse.json({ erro: 'Token e produto_id obrigatórios.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });

    const { error } = await supabase
      .from('favoritos')
      .delete()
      .eq('user_id', user.id)
      .eq('produto_id', produto_id);

    if (error) return NextResponse.json({ erro: 'Erro ao remover favorito.' }, { status: 500 });

    return NextResponse.json({ mensagem: 'Removido dos favoritos.' });
  } catch {
    return NextResponse.json({ erro: 'Erro interno.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}
