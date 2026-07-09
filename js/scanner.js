// ============================================
// CALORIE TRACKER — Barcode Scanner Module
// OpenFoodFacts API integration
// ============================================

const Scanner = (() => {
  const API_BASE = 'https://world.openfoodfacts.org/api/v2/product';

  async function lookupBarcode(barcode) {
    const code = barcode.trim();
    if (!code || code.length < 8) {
      throw new Error('Wpisz poprawny kod kreskowy (min. 8 cyfr).');
    }

    try {
      const res = await fetch(`${API_BASE}/${code}.json`);
      if (!res.ok) throw new Error('Produkt nie znaleziony');

      const data = await res.json();
      if (data.status !== 1 || !data.product) {
        throw new Error('Nie znaleziono produktu o tym kodzie kreskowym w bazie OpenFoodFacts.');
      }

      const p = data.product;
      const nutriments = p.nutriments || {};

      return {
        name: p.product_name_pl || p.product_name || 'Nieznany produkt',
        brand: p.brands || '',
        image: p.image_front_small_url || '',
        portion: p.serving_size || '100g',
        calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
        protein: Math.round(nutriments.proteins_100g || nutriments.proteins || 0),
        carbs: Math.round(nutriments.carbohydrates_100g || nutriments.carbohydrates || 0),
        fat: Math.round(nutriments.fat_100g || nutriments.fat || 0),
        per100g: true,
      };
    } catch (e) {
      if (e.message.includes('Failed to fetch')) {
        throw new Error('Brak połączenia z internetem. Skaner wymaga połączenia z bazą OpenFoodFacts.');
      }
      throw e;
    }
  }

  return { lookupBarcode };
})();
