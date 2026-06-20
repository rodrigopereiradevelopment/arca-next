import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.1.2",
  versionCode: 12,
  url: "https://github.com/rodrigopereiradevelopment/arca-ionic/releases/latest",
  obrigatorio: false,
  mensagem: "Correção de categorias de produtos e categorias exibidas corretamente.",
};

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(VERSAO_ATUAL, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
