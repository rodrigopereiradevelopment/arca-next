import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

export async function GET(req: NextRequest) {
  const produtoId = req.nextUrl.searchParams.get("produtoId");
  const mercadoId = req.nextUrl.searchParams.get("mercadoId");

  if (!produtoId || !mercadoId) {
    return NextResponse.json({ error: "Faltam parâmetros" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("precos")
      .select("preco")
      .eq("produto_id", parseInt(produtoId))
      .eq("supermercado_id", parseInt(mercadoId))
      .order("data_coleta", { ascending: false })
      .limit(1)
      .single();

    if (error) return NextResponse.json({ preco: 0 }, { status: 404 });
    return NextResponse.json({ preco: data?.preco || 0 });
  } catch {
    return NextResponse.json({ preco: 0 }, { status: 500 });
  }
}
