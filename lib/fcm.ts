import * as admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";

function initFirebase(): admin.app.App | null {
  if (admin.apps.length) return admin.apps[0]!;

  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      const serviceAccount = JSON.parse(envJson);
      return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (e) {
      console.warn("[fcm] failed to init from FIREBASE_SERVICE_ACCOUNT_JSON:", e);
      return null;
    }
  }

  const filePath = process.env.FIREBASE_ACCOUNT_PATH;
  if (filePath) {
    try {
      const fs = require("fs") as typeof import("fs");
      const raw = fs.readFileSync(filePath, "utf-8");
      const serviceAccount = JSON.parse(raw);
      return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (e) {
      console.warn("[fcm] failed to init from FIREBASE_ACCOUNT_PATH:", e);
      return null;
    }
  }

  console.warn("[fcm] set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ACCOUNT_PATH");
  return null;
}

const app = initFirebase();

export async function enviarPush(
  usuarioId: string,
  titulo: string,
  mensagem: string,
  dados?: Record<string, unknown>
): Promise<number> {
  if (!app) return 0;

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

  const listaTokens = tokens.map((t: any) => t.token).filter(Boolean) as string[];
  if (listaTokens.length === 0) return 0;

  try {
    const response = await admin.messaging().sendEachForMulticast({
      tokens: listaTokens,
      notification: { title: titulo, body: mensagem },
      data: (dados ?? {}) as Record<string, string>,
    });

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success && (
          resp.error?.code === "messaging/registration-token-not-registered" ||
          resp.error?.code === "messaging/invalid-registration-token"
        )) {
          void supabase.from("device_tokens").update({ ativo: false }).eq("token", listaTokens[idx]);
        }
      });
    }

    return response.successCount;
  } catch (err) {
    console.error("[fcm] send error:", err);
    return 0;
  }
}
