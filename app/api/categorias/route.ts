import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/db/supabase";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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

async function isAdminOrModerador(token: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    return profile?.role === "admin" || profile?.role === "moderador";
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (error) throw error;

    return corsOk(
      (data ?? []).map((c: any) => ({
        id: c.id,
        nome: c.nome,
        descricao: c.descricao || "",
        icone: c.icone || "",
        totalProdutos: 0,
      }))
    );
  } catch (error) {
    console.error("[categorias] GET error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao listar categorias",
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token obrigatório", 401);
    if (!(await isAdminOrModerador(token))) return corsErr("Sem permissão", 403);

    const { token: _t, id: _i, ...rest } = body;

    if (!rest.nome || !rest.nome.trim()) {
      return corsErr("Nome é obrigatório", 400);
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("categorias")
      .insert({
        nome: rest.nome.trim(),
        descricao: rest.descricao || null,
        icone: rest.icone || null,
      })
      .select()
      .single();

    if (error) throw error;

    return corsOk({
      id: data.id,
      nome: data.nome,
      descricao: data.descricao || "",
      icone: data.icone || "",
      totalProdutos: 0,
    });
  } catch (error) {
    console.error("[categorias] POST error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao criar categoria",
      500
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    const id = body?.id;
    if (!token || !id) return corsErr("Token e id obrigatórios", 400);
    if (!(await isAdminOrModerador(token))) return corsErr("Sem permissão", 403);

    const { token: _t, id: _i, ...rest } = body;

    const updateData: Record<string, any> = {};
    if (rest.nome !== undefined) updateData.nome = rest.nome.trim();
    if (rest.descricao !== undefined) updateData.descricao = rest.descricao;
    if (rest.icone !== undefined) updateData.icone = rest.icone;

    if (Object.keys(updateData).length === 0) {
      return corsErr("Nenhum campo para atualizar", 400);
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("categorias")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) throw error;
    if (!data || data.length === 0) {
      return corsErr("Categoria não encontrada", 404);
    }

    return corsOk({
      id: data[0].id,
      nome: data[0].nome,
      descricao: data[0].descricao || "",
      icone: data[0].icone || "",
    });
  } catch (error) {
    console.error("[categorias] PUT error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao atualizar categoria",
      500
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    const id = body?.id;
    if (!token || !id) return corsErr("Token e id obrigatórios", 400);
    if (!(await isAdminOrModerador(token))) return corsErr("Sem permissão", 403);

    const supabase = getSupabaseServerClient();

    const { count } = await supabase
      .from("produtos")
      .select("*", { count: "exact", head: true })
      .eq("categoria_id", id)
      .eq("ativo", true);

    const { error } = await supabase
      .from("categorias")
      .update({ ativo: false })
      .eq("id", id);

    if (error) throw error;

    return corsOk({
      ok: true,
      produtosDesassociados: count ?? 0,
      mensagem: count && count > 0
        ? `Categoria desativada. ${count} produto(s) foram desassociados.`
        : "Categoria desativada.",
    });
  } catch (error) {
    console.error("[categorias] DELETE error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao excluir categoria",
      500
    );
  }
}
