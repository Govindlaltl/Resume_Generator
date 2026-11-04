
const OPENROUTER_API_URL =
  'https://openrouter.ai/api/v1/chat/completions';

async function generateText(prompt, instructions, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const error = new Error('OPENROUTER_API_KEY is not configured.');
    error.status = 503;
    throw error;
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',

      ...(typeof options.temperature === 'number'
        ? { temperature: options.temperature }
        : {}),

      messages: [
        {
          role: 'system',
          content: instructions
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('Invalid response received from OpenRouter.');
  }

  if (!response.ok) {
    const error = new Error(
      data.error?.message ||
      `OpenRouter request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  const content = data.choices?.[0]?.message?.content;

  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map(item => item.text || '').join('\n')
      : '';

  if (!text.trim()) {
    throw new Error('OpenRouter returned an empty response.');
  }

  return text.trim();
}

module.exports = { generateText };
