import { NextRequest, NextResponse } from "next/server";
import {
  listProductsFromSupabase,
  normalizeLimit,
  saveRawProductInMongo,
} from "@/lib/services/products-service";

export async function GET(req: NextRequest) {
  try {
    const limit = normalizeLimit(req.nextUrl.searchParams.get("limit"), 20);
    const products = await listProductsFromSupabase(limit);
    return NextResponse.json({ ok: true, source: "supabase", products });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Erro ao listar produtos",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body?.nome || typeof body.nome !== "string") {
      return NextResponse.json(
        { ok: false, error: "Campo 'nome' e obrigatorio." },
        { status: 400 }
      );
    }

    const result = await saveRawProductInMongo({
      nome: body.nome,
      mercado: body.mercado,
      cidade: body.cidade ?? "Mogi Mirim",
      preco: typeof body.preco === "number" ? body.preco : undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "Produto bruto salvo no Mongo para tratamento posterior.",
      mongo: result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Erro ao salvar produto bruto",
      },
      { status: 500 }
    );
  }
}
