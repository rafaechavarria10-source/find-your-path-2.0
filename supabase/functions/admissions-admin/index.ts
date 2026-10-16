import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { ok: false, error: "Método no permitido." });

  try {
    const authorization = request.headers.get("Authorization") || "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken || accessToken === authorization) {
      return json(401, { ok: false, error: "Inicia sesión para consultar los registros." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Missing Supabase admin environment configuration.");
      return json(500, { ok: false, error: "El servicio de admisiones no está configurado." });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user) return json(401, { ok: false, error: "La sesión no es válida." });
    if (authData.user.app_metadata?.role !== "admissions") {
      return json(403, { ok: false, error: "La cuenta no tiene acceso al panel de admisiones." });
    }

    const body = await request.json();
    if (body?.action !== "list") return json(400, { ok: false, error: "La acción solicitada no es válida." });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const rows = [];
    const pageSize = 500;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await adminClient.from("participants")
        .select("first_name,last_name,email,phone,school,grad_year,events,athlete,sport,results,submitted_at")
        .order("submitted_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) {
        console.error("Could not fetch participant records:", error.message);
        return json(500, { ok: false, error: "No se pudieron consultar los registros." });
      }
      rows.push(...data);
      if (data.length < pageSize) break;
    }

    const eventNames: Record<string, string> = {
      "open-day": "Open Day",
      tryouts: "Tryouts",
      camps: "Campamentos",
    };
    const records = rows.map((row) => {
      const topAreas = row.results?.topAreas || [];
      const programs = row.results?.programs || [];
      return {
        name: `${row.first_name} ${row.last_name}`.trim(),
        email: row.email,
        phone: row.phone,
        school: row.school,
        gradYear: row.grad_year,
        events: (row.events || []).map((event: string) => eventNames[event] || event).join(", "),
        athlete: row.athlete ? "Sí" : "No",
        sport: row.sport,
        areas: topAreas.map((area: { label?: string; pct?: number }) => area.label ? `${area.label}${area.pct == null ? "" : ` (${area.pct}%)`}` : "").filter(Boolean).join("\n"),
        programs: programs.map((program: { name?: string; pct?: number }) => program.name ? `${program.name}${program.pct == null ? "" : ` (${program.pct}%)`}` : "").filter(Boolean).join("\n"),
        date: row.submitted_at,
      };
    });

    return json(200, { ok: true, records, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Admissions admin request failed:", error);
    return json(400, { ok: false, error: "No se pudo procesar la solicitud del panel." });
  }
});
