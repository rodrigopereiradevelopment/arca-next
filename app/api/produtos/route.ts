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

function paraFront(p: any) {
  return {
    id: p.id,
    nome: p.nome,
    descricao: p.descricao || "",
    marca: p.marca || "",
    ean: p.codigo_barras || "",
    categoria: "",
    categoria_id: p.categoria_id,
    imagem_url: p.imagem_url || "",
    ativo: p.ativo,
    tipo: p.tipo || "industrializado",
    peso_volume: p.peso_volume || "",
    precosAtivos: 0,
    created_at: p.created_at,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = req.nextUrl;
    const busca = searchParams.get("busca");
    const ativo = searchParams.get("ativo");
    const categoria_id = searchParams.get("categoria_id");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("produtos")
      .select("*", { count: "exact" });

    if (ativo !== "todos") {
      query = query.eq("ativo", ativo !== "false");
    }

    if (categoria_id) {
      query = query.eq("categoria_id", parseInt(categoria_id));
    }

    if (busca) {
      query = query.or(
        `nome.ilike.%${busca}%,codigo_barras.ilike.%${busca}%`
      );
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    return corsOk({
      data: (data ?? []).map(paraFront),
      total: count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("[produtos] GET error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao listar produtos",
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

    const { token: _t, id: _i, ean, ...rest } = body;

    if (!rest.nome) return corsErr("Nome é obrigatório", 400);

    const insertData: Record<string, any> = {
      nome: rest.nome,
      descricao: rest.descricao || null,
      marca: rest.marca || null,
      codigo_barras: ean || rest.ean || rest.codigo_barras || null,
      imagem_url: rest.imagem_url || null,
      tipo: rest.tipo || "industrializado",
      peso_volume: rest.peso_volume || null,
      categoria_id: rest.categoria_id || null,
    };

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("produtos")
      .insert(insertData)
      .select("*")
      .single();

    if (error) throw error;

    return corsOk(paraFront(data));
  } catch (error) {
    console.error("[produtos] POST error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao criar produto",
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

    const { token: _t, id: _i, ean, ...rest } = body;

    const updateData: Record<string, any> = {};
    const campos = [
      "nome", "descricao", "marca", "tipo", "peso_volume", "imagem_url", "categoria_id",
    ];
    for (const campo of campos) {
      if (rest[campo] !== undefined) {
        updateData[campo] = rest[campo];
      }
    }
    if (ean !== undefined) updateData.codigo_barras = ean;
    if (rest.ean !== undefined) updateData.codigo_barras = rest.ean;

    if (Object.keys(updateData).length === 0) {
      return corsErr("Nenhum campo para atualizar", 400);
    }

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("produtos")
      .update(updateData)
      .eq("id", id)
      .select("*");

    if (error) throw error;
    if (!data || data.length === 0) {
      return corsErr("Produto não encontrado", 404);
    }

    return corsOk(paraFront(data[0]));
  } catch (error) {
    console.error("[produtos] PUT error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao atualizar produto",
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
    const { error } = await supabase
      .from("produtos")
      .update({ ativo: false })
      .eq("id", id);

    if (error) throw error;

    return corsOk({ ok: true });
  } catch (error) {
    console.error("[produtos] DELETE error:", error);
    return corsErr(
      error instanceof Error ? error.message : "Erro ao excluir produto",
      500
    );
  }
}
