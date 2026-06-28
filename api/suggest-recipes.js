export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, apiKey } = req.body;
  const finalKey = apiKey || process.env.VITE_GROCERY_AGENT_KEY || process.env.GROCERY_AGENT_KEY;

  if (!finalKey) {
    return res.status(400).json({ error: 'Groq API Key is not configured.' });
  }

  const isGroq = finalKey.startsWith('gsk_');

  try {
    if (isGroq) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${finalKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: status ${response.status}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    } else {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${finalKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: status ${response.status}`);
      }
      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    console.error('Serverless suggestion error:', err);
    return res.status(500).json({ error: err.message });
  }
}
