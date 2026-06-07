import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

const OFF_API = 'https://world.openfoodfacts.org/api/v2/product';
const USER_AGENT = 'ARCA-App/1.0 (contato: rodrigopereira.development@gmail.com)';

interface InfoNutricional {
  nome: string;
  ingredientes: string | null;
  alergenos: string[];
  nutricao: {
    energia: number | null;
    gorduras: number | null;
    gorduras_saturadas: number | null;
    carboidratos: number | null;
    acucares: number | null;
    fibras: number | null;
    proteinas: number | null;
    sal: number | null;
  };
  nutri_score: string | null;
  nova_group: number | null;
}

const DIAS_CACHE = 7;

export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get('barcode');
  if (!barcode) {
    return NextResponse.json({ erro: 'Código de barras é obrigatório.' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();

    const { data: cached } = await supabase
      .from('info_nutricional_cache')
      .select('dados, fetched_at')
      .eq('codigo_barras', barcode)
      .single();

    if (cached) {
      const dias = (Date.now() - new Date(cached.fetched_at).getTime()) / 86400000;
      if (dias < DIAS_CACHE) {
        return NextResponse.json(cached.dados);
      }
    }

    const url = `${OFF_API}/${barcode}.json`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      return NextResponse.json({ erro: 'Produto não encontrado.' }, { status: 404 });
    }

    const raw = await res.json();
    if (raw.status !== 1) {
      return NextResponse.json({ erro: 'Produto não encontrado.' }, { status: 404 });
    }

    const p = raw.product;
    const parsed: InfoNutricional = {
      nome: p.product_name || '',
      ingredientes: p.ingredients_text || null,
      alergenos: (p.allergens_tags || []).filter((a: string) => a.startsWith('en:')).map((a: string) => a.replace('en:', '')),
      nutricao: {
        energia: p.nutriments?.['energy-kcal_100g'] ?? null,
        gorduras: p.nutriments?.fat_100g ?? null,
        gorduras_saturadas: p.nutriments?.['saturated-fat_100g'] ?? null,
        carboidratos: p.nutriments?.carbohydrates_100g ?? null,
        acucares: p.nutriments?.sugars_100g ?? null,
        fibras: p.nutriments?.fiber_100g ?? null,
        proteinas: p.nutriments?.proteins_100g ?? null,
        sal: p.nutriments?.salt_100g ?? null,
      },
      nutri_score: p.nutrition_grades ?? null,
      nova_group: p.nova_group ?? null,
    };

    await supabase
      .from('info_nutricional_cache')
      .upsert(
        { codigo_barras: barcode, dados: parsed, fetched_at: new Date().toISOString() },
        { onConflict: 'codigo_barras' }
      );

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ erro: 'Erro ao buscar informações nutricionais.' }, { status: 500 });
  }
}
