// ============================================
// CALORIE TRACKER — AI Module
// Google Gemini API integration
// ============================================

const AI = (() => {
  // Models to try in order (different models have separate quotas)
  const MODELS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];
  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

  const SYSTEM_PROMPT = `Jesteś ekspertem od żywienia i dietetyki. Twoim zadaniem jest analizowanie opisów lub zdjęć posiłków i zwracanie dokładnych informacji o wartościach odżywczych.

ZASADY:
1. Analizuj podany opis lub zdjęcie jedzenia
2. Rozpoznaj poszczególne składniki/produkty
3. Oszacuj ilości jeśli nie podano
4. Oblicz kalorie i makroskładniki dla każdego produktu
5. Zwróć WYŁĄCZNIE poprawny JSON, bez żadnego dodatkowego tekstu
6. Wartości podawaj w liczbach całkowitych
7. Kalorie w kcal, makroskładniki w gramach
8. Bądź realistyczny w szacunkach — typowe polskie porcje
9. Używaj poprawnej polskiej pisowni ze znakami diakrytycznymi (ą, ć, ę, ł, ń, ó, ś, ź, ż), np. "masło" zamiast "maslo", "bułka" zamiast "bulka", "ser żółty" zamiast "ser zolty".

FORMAT ODPOWIEDZI (WYŁĄCZNIE TEN JSON, bez markdown):
{
  "items": [
    {
      "name": "nazwa produktu po polsku",
      "amount": "ilość (np. 100g, 1 szt, 1 szklanka)",
      "calories": 150,
      "protein": 10,
      "carbs": 15,
      "fat": 5
    }
  ],
  "total": {
    "calories": 300,
    "protein": 20,
    "carbs": 30,
    "fat": 10
  }
}`;

  // Status callback for UI updates during retries
  let _statusCallback = null;

  function onStatus(callback) {
    _statusCallback = callback;
  }

  function _updateStatus(msg) {
    if (_statusCallback) _statusCallback(msg);
    console.log('[AI]', msg);
  }

  async function analyzeText(text) {
    const apiKey = AppStorage.getApiKey();
    if (!apiKey) throw new Error('Brak klucza API Gemini. Wpisz poprawny klucz w Ustawieniach konta (zakładka z kołem zębatym) lub spróbuj wpisać prostszą nazwę jedzenia (np. "jajko", "chleb", "masło"), aby wyszukać je bezpośrednio z naszej wbudowanej bazy danych (która nie wymaga klucza API).');

    const body = {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT + '\n\nOPIS POSIŁKU:\n' + text }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      }
    };

    return await _tryAllModels(apiKey, body);
  }

  async function analyzeImage(base64Image, mimeType = 'image/jpeg') {
    const apiKey = AppStorage.getApiKey();
    if (!apiKey) throw new Error('Brak klucza API Gemini. Wpisz poprawny klucz w Ustawieniach konta (zakładka z kołem zębatym) lub użyj wpisywania ręcznego/kodu kreskowego, ponieważ analiza zdjęcia wymaga aktywnego połączenia AI.');

    const cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');

    const body = {
      contents: [{
        parts: [
          { text: SYSTEM_PROMPT + '\n\nAnalizuj zdjęcie posiłku powyżej i zwróć wartości odżywcze.' },
          {
            inlineData: {
              mimeType: mimeType,
              data: cleanBase64
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      }
    };

    return await _tryAllModels(apiKey, body);
  }

  async function _tryAllModels(apiKey, body) {
    let lastError = null;

    for (let i = 0; i < MODELS.length; i++) {
      const model = MODELS[i];
      _updateStatus(`Próbuję model: ${model}...`);

      try {
        const result = await _makeRequest(apiKey, model, body);
        return result;
      } catch (error) {
        lastError = error;
        console.warn(`Model ${model} failed:`, error.message);

        if (error.message.includes('429') || error.message.includes('Limit') || error.message.includes('rate')) {
          if (i < MODELS.length - 1) {
            _updateStatus(`${model} — limit. Próbuję ${MODELS[i + 1]}...`);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
        } else {
          // Non-rate-limit error — don't try other models
          throw error;
        }
      }
    }

    // All models exhausted — don't retry, just inform the user
    throw new Error('Limit API wyczerpany dla wszystkich modeli. Poczekaj 1-2 minuty i spróbuj ponownie.');
  }

  async function _makeRequest(apiKey, model, body) {
    const url = `${API_BASE}/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const apiMsg = errorData.error?.message || '';
      console.error(`Gemini API Error [${model}]:`, response.status, errorData);

      if (response.status === 429) {
        throw new Error(`429: Rate limit (${model})`);
      } else if (response.status === 400 && (apiMsg.includes('API_KEY_INVALID') || apiMsg.includes('API key not valid') || apiMsg.includes('key not valid'))) {
        throw new Error('Nieprawidłowy lub brakujący klucz API Gemini. Wpisz poprawny klucz w Ustawieniach konta (zakładka z kołem zębatym) lub spróbuj wpisać prostszą nazwę jedzenia (np. "jajko", "chleb", "masło"), aby wyszukać je bezpośrednio z naszej wbudowanej bazy danych (która nie wymaga klucza API).');
      } else if (response.status === 400) {
        throw new Error(`Błąd zapytania: ${apiMsg}`);
      } else if (response.status === 403) {
        throw new Error(`Brak dostępu: ${apiMsg || 'Włącz Generative Language API w Google Cloud Console.'}`);
      }
      throw new Error(`Błąd API (${response.status}): ${apiMsg || 'Nieznany błąd'}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Brak odpowiedzi od AI. Spróbuj ponownie.');
    }

    return _parseAIResponse(text);
  }

  function _parseAIResponse(text) {
    let jsonStr = text.trim();

    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd !== -1) {
      jsonStr = jsonStr.slice(braceStart, braceEnd + 1);
    }

    try {
      const parsed = JSON.parse(jsonStr);

      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Nieprawidłowy format odpowiedzi');
      }

      parsed.items = parsed.items.map(item => ({
        name: item.name || 'Nieznany produkt',
        amount: item.amount || '1 porcja',
        calories: Math.round(Number(item.calories) || 0),
        protein: Math.round(Number(item.protein) || 0),
        carbs: Math.round(Number(item.carbs) || 0),
        fat: Math.round(Number(item.fat) || 0),
      }));

      parsed.total = {
        calories: parsed.items.reduce((sum, i) => sum + i.calories, 0),
        protein: parsed.items.reduce((sum, i) => sum + i.protein, 0),
        carbs: parsed.items.reduce((sum, i) => sum + i.carbs, 0),
        fat: parsed.items.reduce((sum, i) => sum + i.fat, 0),
      };

      return parsed;
    } catch (e) {
      console.error('AI Response parsing error:', e, '\nRaw text:', text);
      throw new Error('Nie udało się przeanalizować odpowiedzi AI. Spróbuj ponownie.');
    }
  }

  return {
    analyzeText,
    analyzeImage,
    onStatus,
  };
})();
