import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function corsOk(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

function corsErr(erro: string, status: number) {
  return NextResponse.json({ erro }, { status, headers: CORS_HEADERS });
}

function extrairToken(req: NextRequest, body: any): string | null {
  if (body?.token && typeof body.token === "string") return body.token;
  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const body: any = {};
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { data: lista, error: listaErr } = await supabase
      .from("listas")
      .select("id")
      .eq("user_id", user.id)
      .eq("nome", "Meu Carrinho")
      .eq("ativa", true)
      .maybeSingle();

    if (listaErr) return corsErr(listaErr.message, 500);
    if (!lista) return corsOk({ itens: [] });

    const { data: itens, error: itensErr } = await supabase
      .from("itens_da_lista")
      .select(`
        id, quantidade, comprado,
        produto:produtos!inner(id, nome, imagem_url, codigo_barras, categoria_id)
      `)
      .eq("lista_id", lista.id);

    if (itensErr) return corsErr(itensErr.message, 500);

    const mapped = (itens ?? []).map(i => ({
      id: i.id,
      produto_id: (i.produto as any)?.id,
      nome: (i.produto as any)?.nome,
      imagem_url: (i.produto as any)?.imagem_url || "",
      quantidade: i.quantidade,
      comprado: i.comprado,
    }));

    return corsOk({ itens: mapped });
  } catch (err) {
    console.error("[carrinho] GET error:", err);
    return corsErr("Erro interno", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { itens } = body;

    let { data: lista } = await supabase
      .from("listas")
      .select("id")
      .eq("user_id", user.id)
      .eq("nome", "Meu Carrinho")
      .maybeSingle();

    if (!lista) {
      const { data: nova, error: createErr } = await supabase
        .from("listas")
        .insert({ user_id: user.id, nome: "Meu Carrinho", ativa: true })
        .select("id")
        .single();

      if (createErr) return corsErr(createErr.message, 500);
      lista = nova;
    }

    await supabase.from("itens_da_lista").delete().eq("lista_id", lista!.id);

    if (itens && Array.isArray(itens) && itens.length > 0) {
      const rows = itens.map((item: any) => ({
        lista_id: lista!.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade || 1,
        comprado: false,
      }));

      const { error: insertErr } = await supabase
        .from("itens_da_lista")
        .insert(rows);

      if (insertErr) return corsErr(insertErr.message, 500);
    }

    return corsOk({ sucesso: true, mensagem: "Carrinho sincronizado" });
  } catch (err) {
    console.error("[carrinho] POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
