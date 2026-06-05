import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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

    const { data: listas, error } = await supabase
      .from("historico_listas")
      .select("id, nome, itens, total_estimado, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return corsErr(error.message, 500);

    return corsOk(listas ?? []);
  } catch (err) {
    console.error("[historico-listas] GET error:", err);
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

    const { nome, itens } = body;
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return corsErr("Lista vazia", 400);
    }

    const total = itens.reduce((acc: number, i: any) => acc + ((i.menorPreco || 0) * (i.quantidade || 1)), 0);

    const { data, error } = await supabase
      .from("historico_listas")
      .insert({
        user_id: user.id,
        nome: nome || "Lista salva",
        itens: itens.map((i: any) => ({
          produto_id: i.id || i.produto_id,
          nome: i.nome,
          img: i.img || i.imagem_url || "",
          quantidade: i.quantidade || 1,
          menorPreco: i.menorPreco || 0,
          mercadoMaisBarato: i.mercadoMaisBarato || "",
        })),
        total_estimado: total,
      })
      .select("id, nome, itens, total_estimado, created_at")
      .single();

    if (error) return corsErr(error.message, 500);

    return corsOk(data, 201);
  } catch (err) {
    console.error("[historico-listas] POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
