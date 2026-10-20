const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const promptFor = (client: Record<string, unknown>) => `
Eres un asistente comercial para una demostración de Ultracem.
Analiza únicamente estos datos del cliente:
${JSON.stringify(client)}

Devuelve una sola recomendación concreta para el asesor, en español, de máximo 25 palabras.
No inventes ventas, precios, nombres ni datos que no aparezcan en la entrada.
`;

async function askOpenRouter(prompt: string, key: string) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENROUTER_MODEL') || 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 80,
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter respondió ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim();
}

async function askGemini(prompt: string, key: string) {
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!response.ok) throw new Error(`Gemini respondió ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const client = await request.json();
    if (!client || typeof client !== 'object' || !client.name) return json({ error: 'Faltan datos del cliente' }, 400);
    const prompt = promptFor(client);
    const openRouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    let recommendation;

    if (openRouterKey) {
      try { recommendation = await askOpenRouter(prompt, openRouterKey); } catch (_error) { /* fallback */ }
    }
    if (!recommendation && geminiKey) recommendation = await askGemini(prompt, geminiKey);
    if (!recommendation) return json({ error: 'No hay un proveedor de IA configurado.' }, 503);
    return json({ recommendation });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'No se pudo generar la recomendación.' }, 500);
  }
});
