import { NextResponse } from "next/server";

const VERSAO_ATUAL = {
  versao: "1.2.0",
  versionCode: 20,
  url: "",
  obrigatorio: false,
  mensagem: "Atualização com download direto e instalação automática!",
};
VERSAO_ATUAL.url = `https://github.com/rodrigopereiradevelopment/arca-ionic/releases/download/v${VERSAO_ATUAL.versao}/arca-v${VERSAO_ATUAL.versao}.apk`;

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(VERSAO_ATUAL, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
