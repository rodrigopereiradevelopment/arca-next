import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.1.1",
  versionCode: 11,
  url: "https://github.com/rodrigopereiradevelopment/arca-ionic/releases/latest",
  obrigatorio: false,
  mensagem: "Correções de bugs: header, navegação imersiva, favoritos, mapa, editar produtos.",
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
