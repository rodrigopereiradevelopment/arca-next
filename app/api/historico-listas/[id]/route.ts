import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE,POST,OPTIONS",
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: any = {};
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { error } = await supabase
      .from("historico_listas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return corsErr(error.message, 500);
    return corsOk({ sucesso: true });
  } catch (err) {
    console.error("[historico-listas] DELETE error:", err);
    return corsErr("Erro interno", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { data: lista, error: getErr } = await supabase
      .from("historico_listas")
      .select("itens")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (getErr || !lista) return corsErr("Lista nao encontrada", 404);

    const itens = (lista.itens as any[]) ?? [];

    let { data: carrinho } = await supabase
      .from("listas")
      .select("id")
      .eq("user_id", user.id)
      .eq("nome", "Meu Carrinho")
      .eq("ativa", true)
      .maybeSingle();

    if (!carrinho) {
      const { data: nova, error: createErr } = await supabase
        .from("listas")
        .insert({ user_id: user.id, nome: "Meu Carrinho", ativa: true })
        .select("id")
        .single();

      if (createErr) return corsErr(createErr.message, 500);
      carrinho = nova;
    }

    await supabase.from("itens_da_lista").delete().eq("lista_id", carrinho.id);

    if (itens.length > 0) {
      const rows = itens.map((item: any) => ({
        lista_id: carrinho.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade || 1,
        comprado: false,
      }));

      const { error: insertErr } = await supabase
        .from("itens_da_lista")
        .insert(rows);

      if (insertErr) return corsErr(insertErr.message, 500);
    }

    return corsOk({ sucesso: true, mensagem: "Lista restaurada para o carrinho" });
  } catch (err) {
    console.error("[historico-listas] POST restore error:", err);
    return corsErr("Erro interno", 500);
  }
}
