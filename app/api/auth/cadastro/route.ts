import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const { nome, email, senha } = await req.json();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true
  });

  if (error) return NextResponse.json({ erro: error.message }, { status: 400 });

  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      nome,
      role: 'user'
    });
  }

  return NextResponse.json({ ok: true, id: data.user?.id });
}
