import { NextRequest, NextResponse } from 'next/server';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: NextRequest) {
  const { pergunta } = await req.json();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Você é o assistente virtual do ARCA, app de comparação de preços de supermercados em Mogi Mirim, SP. Responda em português, de forma amigável e objetiva. Máximo 3 parágrafos.\n\nPergunta: ${pergunta}` }] }]
    })
  });

  const data = await res.json();

  if (!data.candidates) {
    return NextResponse.json({ resposta: 'Erro: ' + JSON.stringify(data) }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const texto = data.candidates[0].content.parts[0].text;
  return NextResponse.json({ resposta: texto }, { headers: { 'Access-Control-Allow-Origin': '*' } });
}
