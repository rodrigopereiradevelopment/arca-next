import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/db/supabase';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ erro: 'E-mail é obrigatório.' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();

    const { data: user } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!user) {
      return NextResponse.json({ mensagem: 'Se o e-mail existir, você receberá um link de recuperação.' });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await supabase.from('recovery_tokens').insert({
      email,
      token,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });

    const resetLink = `https://arca-ionic.vercel.app/#/redefinir-senha?token=${token}`;

    const { Resend } = await import('resend');
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY não configurada.');
    const resend = new Resend(key);

    await resend.emails.send({
      from: 'ARCA <onboarding@resend.dev>',
      to: email,
      subject: 'Recuperação de Senha — ARCA',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #00BF9F;">Recuperação de Senha</h2>
          <p>Você solicitou a recuperação de senha do <strong>ARCA</strong>.</p>
          <p>Clique no link abaixo para redefinir sua senha:</p>
          <a href="${resetLink}" style="display: inline-block; background: #00BF9F; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
            Redefinir Senha
          </a>
          <p style="color: #888; font-size: 14px;">Este link expira em 1 hora.</p>
          <p style="color: #888; font-size: 14px;">Se você não solicitou, ignore este e-mail.</p>
        </div>
      `,
    });

    return NextResponse.json({ mensagem: 'Se o e-mail existir, você receberá um link de recuperação.' });
  } catch {
    return NextResponse.json({ erro: 'Erro ao processar solicitação.' }, { status: 500 });
  }
}
