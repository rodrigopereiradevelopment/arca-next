import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }});
}

export async function POST(req: NextRequest) {
  try {
    const { token, novaSenha } = await req.json();
    if (!token || !novaSenha) {
      return NextResponse.json({ erro: 'Token e nova senha são obrigatórios.' }, { status: 400 });
    }
    if (novaSenha.length < 8) {
      return NextResponse.json({ erro: 'Senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: recovery, error: recoveryErr } = await supabase
      .from('recovery_tokens')
      .select('*')
      .eq('token', token)
      .eq('usado', false)
      .maybeSingle();

    if (recoveryErr || !recovery) {
      return NextResponse.json({ erro: 'Token inválido ou já utilizado.' }, { status: 400 });
    }

    if (new Date(recovery.expires_at) < new Date()) {
      return NextResponse.json({ erro: 'Token expirado. Solicite um novo.' }, { status: 400 });
    }

    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users?.find((u: any) => u.email === recovery.email);
    if (!user) {
      return NextResponse.json({ erro: 'Usuário não encontrado.' }, { status: 404 });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: novaSenha,
    });

    if (updateError) {
      return NextResponse.json({ erro: 'Erro ao atualizar senha.' }, { status: 500 });
    }

    await supabase.from('recovery_tokens').update({ usado: true }).eq('id', recovery.id);

    return NextResponse.json({ mensagem: 'Senha redefinida com sucesso!' });
  } catch {
    return NextResponse.json({ erro: 'Erro ao redefinir senha.' }, { status: 500 });
  }
}
