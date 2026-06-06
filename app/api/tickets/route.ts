import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
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
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const body: any = {};
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token necessario", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !user) return corsErr("Usuario nao autenticado", 401);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("tickets")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return corsErr(error.message, 500);

    return corsOk({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("[tickets] GET error:", err);
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

    const { tipo, titulo, descricao } = body;
    if (!tipo || !titulo || !descricao) return corsErr("tipo, titulo e descricao obrigatorios", 400);

    const tiposValidos = ["preco", "mercado", "bug", "sugestao", "duvida"];
    if (!tiposValidos.includes(tipo)) return corsErr("tipo invalido", 400);

    const { data, error } = await supabase
      .from("tickets")
      .insert({ user_id: user.id, tipo, titulo, descricao })
      .select()
      .single();

    if (error) return corsErr(error.message, 500);

    await supabase.from("tickets_mensagens").insert({
      ticket_id: data.id,
      autor: "usuario",
      texto: descricao,
    });

    return corsOk(data);
  } catch (err) {
    console.error("[tickets] POST error:", err);
    return corsErr("Erro interno", 500);
  }
}
