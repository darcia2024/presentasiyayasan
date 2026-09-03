// PERISA AZHARIYAH — Header CORS bersama untuk seluruh Edge Function.
//
// Situs statisnya disajikan dari domain Cloudflare (bukan domain Supabase),
// jadi permintaan ke Edge Function selalu lintas origin. Tanpa header ini,
// browser santri/wali akan menolak responsnya sebelum sempat dibaca.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Balasan standar untuk preflight OPTIONS. Panggil di awal tiap handler. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
