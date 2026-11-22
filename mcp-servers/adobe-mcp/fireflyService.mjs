import { db } from '../../backend/db.mjs';

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value.trim() : '';
}

export async function generateFireflyScene({ brand, prompt, format = 'post' }) {
  const apiKey = getSetting('firefly_api_key');
  const finalPrompt =
    prompt ||
    `Editorial commercial photography for ${brand.sector} brand ${brand.name}, ${brand.tone} mood, clean negative space on the left for typography, studio lighting, ultra realistic`;

  if (!apiKey) {
    return {
      mode: 'offline_ready',
      prompt: finalPrompt,
      message: 'Adobe Firefly API anahtarı henüz girilmedi. Anahtar eklendiğinde bu prompt ile otomatik görsel üretilip Photoshop katmanına yerleştirilecektir.'
    };
  }

  const size =
    format === 'story' ? { width: 1080, height: 1920 } : format === 'linkedin' ? { width: 1920, height: 1080 } : { width: 1080, height: 1350 };

  const res = await fetch('https://firefly-api.adobe.io/v3/images/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ prompt: finalPrompt, size, contentClass: 'photo' })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firefly API hatasi (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { mode: 'live_firefly', prompt: finalPrompt, outputs: data.outputs || [] };
}

export async function enhanceOrRecreateWithFirefly({ brand, heroImagePath, action = 'recompose', format = 'post' }) {
  const apiKey = getSetting('firefly_api_key');
  const actionMap = {
    recompose: `Generative Recompose (${format}): Shift subject to right third and expand studio background on the left for clean negative space.`,
    restyle: `Generative Restyle: Preserve subject structure from reference photo, apply ${brand.tone} commercial magazine lighting and ${brand.primary_color} color mood.`,
    relight: `Photoshop 2027 Relight Recipe: Add 2 warm key/rim virtual light sources matching ${brand.accent_color} with soft shadow falloff.`
  };

  const recipePrompt = actionMap[action] || actionMap.recompose;

  if (!apiKey) {
    return {
      mode: 'offline_ready',
      action,
      heroImagePath: heroImagePath || '',
      recipePrompt,
      message: `Adobe 2027 (${action.toUpperCase()}) reçetesi hazırlandı. Firefly API anahtarı eklendiğinde klasördeki fotoğraf otomatik olarak yeniden oluşturulacak/genişletilecektir.`
    };
  }

  return generateFireflyScene({ brand, prompt: `${recipePrompt} Brand: ${brand.name} (${brand.sector}).`, format });
}
