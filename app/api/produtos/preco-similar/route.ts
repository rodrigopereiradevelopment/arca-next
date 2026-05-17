import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  const nome = req.nextUrl.searchParams.get('nome');
  const mercadoId = req.nextUrl.searchParams.get('mercadoId');

  if (!nome || !mercadoId) {
    return NextResponse.json({ preco: 0 }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase.rpc('buscar_preco_similar', {
      nome_produto: nome.toLowerCase(),
      id_mercado: parseInt(mercadoId),
    });
    if (error) throw error;
    return NextResponse.json({ preco: data || 0 });
  } catch {
    return NextResponse.json({ preco: 0 });
  }
}