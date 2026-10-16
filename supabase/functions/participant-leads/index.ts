import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const allowedEvents = new Set(["open-day", "tryouts", "camps"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { ok: false, error: "Método no permitido." });

  try {
    const payload = await request.json();
    const lead = payload?.lead;
    const results = payload?.results;
    if (!lead || typeof lead !== "object" || !results || typeof results !== "object") {
      return json(400, { ok: false, error: "Faltan los datos del formulario o sus resultados." });
    }

    const firstName = String(lead.firstName || "").trim();
    const lastName = String(lead.lastName || "").trim();
    const email = String(lead.email || "").trim().toLowerCase();
    const phone = String(lead.phone || "").trim();
    const school = String(lead.school || "").trim();
    const gradYear = String(lead.gradYear || "").trim();
    const role = String(lead.role || "");
    const events = Array.isArray(lead.events) ? lead.events : [];
    const sport = String(lead.sport || "").trim();
    const privacyNoticeVersion = String(payload.privacyNoticeVersion || "").trim();

    if (!firstName || firstName.length > 120 || !lastName || lastName.length > 120) {
      return json(400, { ok: false, error: "El nombre y apellido son obligatorios." });
    }
    if (!emailPattern.test(email) || email.length > 320) {
      return json(400, { ok: false, error: "El correo electrónico no es válido." });
    }
    if (phone.length > 40 || school.length > 200 || sport.length > 120 || gradYear.length > 10) {
      return json(400, { ok: false, error: "Uno o más campos exceden la longitud permitida." });
    }
    if (!["estudiante", "tutor"].includes(role) || events.length > 3
      || events.some((event: unknown) => typeof event !== "string" || !allowedEvents.has(event))) {
      return json(400, { ok: false, error: "El rol o los eventos seleccionados no son válidos." });
    }
    if (lead.consent !== true || !privacyNoticeVersion || privacyNoticeVersion.length > 80) {
      return json(400, { ok: false, error: "Se requiere consentimiento y una versión válida del aviso de privacidad." });
    }
    if (JSON.stringify(results).length > 100_000) {
      return json(400, { ok: false, error: "El resumen de resultados excede el tamaño permitido." });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing Supabase service environment configuration.");
      return json(500, { ok: false, error: "El servicio no está configurado." });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.from("participants").insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      school,
      grad_year: gradYear,
      role,
      events,
      athlete: lead.athlete === true,
      sport,
      recommended_event: typeof lead.recommendedEvent === "string" ? lead.recommendedEvent : null,
      results,
      consent: true,
      privacy_notice_version: privacyNoticeVersion,
      consented_at: new Date().toISOString(),
      source: "find-your-path",
    }).select("id").single();

    if (error) {
      console.error("Could not insert participant record:", error.message);
      return json(500, { ok: false, error: "No se pudo guardar el registro." });
    }

    return json(201, { ok: true, id: data.id });
  } catch (error) {
    console.error("Participant intake failed:", error);
    return json(400, { ok: false, error: "No se pudo procesar el registro." });
  }
});
