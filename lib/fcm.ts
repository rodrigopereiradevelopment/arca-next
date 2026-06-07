import { createClient } from "@supabase/supabase-js";

export async function enviarPush(
  usuarioId: string,
  titulo: string,
  mensagem: string,
  dados?: Record<string, unknown>
): Promise<number> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: tokens } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("user_id", usuarioId)
    .eq("ativo", true);

  if (!tokens || tokens.length === 0) return 0;

  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) {
    console.warn("[fcm] FCM_SERVER_KEY not set");
    return 0;
  }

  let enviados = 0;

  for (const { token } of tokens) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: { title: titulo, body: mensagem, sound: "default" },
          data: dados ?? {},
        }),
      });

      if (res.ok) enviados++;
      else {
        const body = await res.json();
        if (
          body?.results?.[0]?.error === "NotRegistered" ||
          body?.results?.[0]?.error === "InvalidRegistration"
        ) {
          await supabase
            .from("device_tokens")
            .update({ ativo: false })
            .eq("token", token);
        }
      }
    } catch (err) {
      console.error("[fcm] send error:", err);
    }
  }

  return enviados;
}

export async function enviarPushParaTokens(
  tokens: string[],
  titulo: string,
  mensagem: string,
  dados?: Record<string, unknown>
): Promise<number> {
  const serverKey = process.env.FCM_SERVER_KEY;
  if (!serverKey) return 0;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let enviados = 0;

  for (const token of tokens) {
    try {
      const res = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${serverKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: { title: titulo, body: mensagem, sound: "default" },
          data: dados ?? {},
        }),
      });

      if (res.ok) enviados++;
      else {
        const body = await res.json();
        if (
          body?.results?.[0]?.error === "NotRegistered" ||
          body?.results?.[0]?.error === "InvalidRegistration"
        ) {
          await supabase
            .from("device_tokens")
            .update({ ativo: false })
            .eq("token", token);
        }
      }
    } catch (err) {
      console.error("[fcm] send error:", err);
    }
  }

  return enviados;
}
