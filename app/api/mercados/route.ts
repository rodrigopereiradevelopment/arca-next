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

async function isAdmin(token: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error("[mercados] isAdmin - getUser error:", error.message);
      return false;
    }
    if (!user) {
      console.error("[mercados] isAdmin - user not found");
      return false;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError) {
      console.error("[mercados] isAdmin - profile error:", profileError.message);
      return false;
    }
    if (profile?.role !== "admin") {
      console.error(`[mercados] isAdmin - role is "${profile?.role}" expected "admin"`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mercados] isAdmin - exception:", e);
    return false;
  }
}

async function geocodeAddress(endereco: string) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}&limit=1&countrycodes=br`,
      { headers: { "User-Agent": "ARCA-App/1.0" } }
    );
    const data = await res.json();
    if (data?.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

function montarEndereco(m: any): string {
  return [m.rua, m.numero, m.complemento, m.bairro, m.cidade, m.estado]
    .filter(Boolean).join(", ");
}

function paraFront(item: any) {
  return {
    id: item.id,
    nome: item.nome,
    cidade: item.cidade || "",
    status: item.status || "pendente",
    responsavel: item.responsavel || "",
    cnpj: item.cnpj || "",
    telefone: item.telefone || "",
    email: item.email || "",
    cep: item.cep || "",
    rua: item.rua || "",
    numero: item.numero || "",
    complemento: item.complemento || "",
    bairro: item.bairro || "",
    estado: item.estado || "",
    admin_nome: item.responsavel || "",
    admin_cpf: item.admin_cpf || "",
    admin_email: item.admin_email || "",
    admin_telefone: item.admin_telefone || "",
    admin_senha: "",
    logo_url: item.logo_url || "",
    latitude: item.latitude ?? 0,
    longitude: item.longitude ?? 0,
    endereco: item.endereco || montarEndereco(item),
    created_at: item.created_at,
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const status = req.nextUrl.searchParams.get("status");
    let query = supabase.from("supermercados").select("*").order("nome");
    if (status && status !== "todos") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return corsOk((data ?? []).map(paraFront));
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro ao listar", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    if (!token) return corsErr("Token obrigatório", 401);

    const supabase = getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return corsErr("Token inválido", 401);

    const { token: _t, id: _i, ...m } = body;
    if (!m.nome) return corsErr("Nome é obrigatório", 400);

    const enderecoCompleto = montarEndereco(m);
    const geo = await geocodeAddress(`${enderecoCompleto}, ${m.cidade || ""}, ${m.estado || ""}`);

    const insertData: Record<string, any> = {
      nome: m.nome,
      cnpj: m.cnpj || null,
      telefone: m.telefone || null,
      email: m.email || null,
      endereco: enderecoCompleto || null,
      cidade: m.cidade || null,
      cep: m.cep || null,
      rua: m.rua || null,
      numero: m.numero || null,
      complemento: m.complemento || null,
      bairro: m.bairro || null,
      estado: m.estado || null,
      status: m.status || "pendente",
      responsavel: m.admin_nome || m.responsavel || null,
      admin_cpf: m.admin_cpf || null,
      admin_email: m.admin_email || null,
      admin_telefone: m.admin_telefone || null,
      logo_url: m.logo_url || null,
    };
    if (geo) {
      insertData.latitude = geo.lat;
      insertData.longitude = geo.lng;
    }

    const { data, error } = await supabase
      .from("supermercados").insert(insertData).select().single();
    if (error) throw error;
    return corsOk(paraFront(data));
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro ao criar", 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    const id = body?.id;
    if (!token || !id) return corsErr("Token e id obrigatórios", 400);
    if (!(await isAdmin(token))) return corsErr("Sem permissão", 403);

    const { token: _t, id: _i, ...m } = body;
    const supabase = getSupabaseServerClient();

    const updateData: Record<string, any> = {};
    const fields = [
      "nome", "cnpj", "telefone", "email", "status", "cidade", "cep",
      "rua", "numero", "complemento", "bairro", "estado",
      "responsavel", "admin_cpf", "admin_email", "admin_telefone", "logo_url",
    ];
    for (const f of fields) {
      if (m[f] !== undefined) updateData[f] = m[f];
    }
    if (m.admin_nome) updateData.responsavel = m.admin_nome;

    // Geocoding — falha não deve impedir o update
    const enderecoCompleto = montarEndereco(m);
    if (enderecoCompleto) updateData.endereco = enderecoCompleto;
    try {
      if (m.rua || m.cidade || m.estado) {
        const geo = await geocodeAddress(`${enderecoCompleto}, ${m.cidade || ""}, ${m.estado || ""}`);
        if (geo) {
          updateData.latitude = geo.lat;
          updateData.longitude = geo.lng;
        }
      }
    } catch (geoErr) {
      console.warn("[mercados] Geocoding ignorado:", geoErr);
    }

    if (Object.keys(updateData).length === 0) {
      return corsErr("Nenhum campo para atualizar", 400);
    }

    const { data, error } = await supabase
      .from("supermercados").update(updateData).eq("id", id).select();
    if (error) throw error;
    if (!data || data.length === 0) {
      return corsErr("Mercado não encontrado", 404);
    }
    return corsOk(paraFront(data[0]));
  } catch (error) {
    console.error("[mercados] PUT error:", error);
    return corsErr(error instanceof Error ? error.message : "Erro ao atualizar", 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const token = extrairToken(req, body);
    const id = body?.id;
    if (!token || !id) return corsErr("Token e id obrigatórios", 400);
    if (!(await isAdmin(token))) return corsErr("Sem permissão", 403);

    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("supermercados").delete().eq("id", id);
    if (error) throw error;
    return corsOk({ ok: true });
  } catch (error) {
    return corsErr(error instanceof Error ? error.message : "Erro ao excluir", 500);
  }
}
