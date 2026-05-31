exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let answers;
  try {
    ({ answers } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Service not configured — please contact Ask4Leasing.' }) };
  }

  const prompt = `You are a UK car leasing specialist at Ask4Leasing (ask4leasing.co.uk). A customer completed a 5-question quiz. Recommend exactly 3 specific cars to lease in the UK.

Customer answers:
- Use: ${answers[1]}
- Monthly budget: ${answers[2]}
- Vehicle type: ${answers[3]}
- Fuel preference: ${answers[4]}
- Needed: ${answers[5]}

Rules:
- Recommend real, currently available models in the UK (2024/2025 model year)
- Match fuel preference strictly (if they chose "Full electric", only recommend EVs)
- Stay within or close to the stated budget
- For personal use show prices inc. VAT; for business use show prices exc. VAT
- Be honest about price ranges — these are ballpark estimates, not quotes
- Each reason must be a single specific sentence explaining why THIS car suits THIS customer

Respond with this JSON only (no markdown, no extra text):
{
  "recommendations": [
    { "name": "Make Model Variant", "reason": "One specific sentence.", "price": "From £XXX/mo" },
    { "name": "Make Model Variant", "reason": "One specific sentence.", "price": "From £XXX/mo" },
    { "name": "Make Model Variant", "reason": "One specific sentence.", "price": "From £XXX/mo" }
  ]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: 'You are a UK car leasing specialist. Respond ONLY with valid JSON — no markdown, no commentary.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Something went wrong' })
    };
  }
};
