import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ erro: 'Token obrigatório' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ erro: 'Token inválido' }, { status: 401 });

    await supabase.from('profiles').update({
      ativo: false,
      nome: '[conta desativada]',
      cpf: null,
      telefone: null,
      cidade: null,
      foto_perfil: null,
    }).eq('id', user.id);

    await supabase.auth.admin.updateUserById(user.id, {
      email: `desativado-${user.id.slice(0, 8)}@arca.app`,
    });

    return NextResponse.json({ ok: true, mensagem: 'Conta desativada com sucesso' });
  } catch (err) {
    console.error('[deletar-conta] POST error:', err);
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 });
  }
}
