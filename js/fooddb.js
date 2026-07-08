// ============================================
// CALORIE TRACKER — Food Database
// Local Polish food database with nutritional values
// Per 1 serving (typical portion)
// ============================================

const FoodDB = (() => {
  // Database: [name, calories, protein, carbs, fat, portion]
  const _foods = [
    // --- Pieczywo ---
    ["chleb pszenny", 75, 2, 14, 1, "1 kromka (30g)"],
    ["chleb żytni", 65, 2, 12, 1, "1 kromka (30g)"],
    ["chleb razowy", 60, 3, 11, 1, "1 kromka (30g)"],
    ["bułka pszenna", 140, 4, 26, 2, "1 szt (50g)"],
    ["bułka grahamka", 130, 5, 24, 1, "1 szt (50g)"],
    ["bagietka", 180, 5, 34, 2, "1/4 bagietki (70g)"],
    ["tost", 65, 2, 12, 1, "1 kromka (25g)"],
    ["tortilla", 150, 4, 25, 3, "1 szt (60g)"],
    ["croissant", 230, 5, 26, 12, "1 szt (60g)"],

    // --- Nabiał ---
    ["mleko 2%", 100, 7, 10, 4, "1 szklanka (200ml)"],
    ["mleko 3.2%", 120, 6, 10, 6, "1 szklanka (200ml)"],
    ["jogurt naturalny", 60, 5, 4, 3, "1 szt (150g)"],
    ["jogurt owocowy", 120, 4, 18, 3, "1 szt (150g)"],
    ["jogurt grecki", 150, 9, 6, 10, "1 szt (150g)"],
    ["kefir", 90, 6, 8, 3, "1 szklanka (200ml)"],
    ["ser żółty", 110, 7, 0, 9, "2 plastry (30g)"],
    ["ser biały twaróg", 100, 14, 2, 4, "100g"],
    ["ser twarogowy półtłusty", 80, 12, 2, 3, "100g"],
    ["mozzarella", 85, 6, 1, 6, "30g"],
    ["ser feta", 80, 4, 1, 6, "30g"],
    ["ser pleśniowy", 100, 6, 0, 8, "30g"],
    ["masło", 75, 0, 0, 8, "1 łyżka (10g)"],
    ["śmietana 18%", 45, 1, 1, 4, "1 łyżka (15ml)"],
    ["śmietana 30%", 75, 0, 1, 7, "1 łyżka (15ml)"],

    // --- Jajka ---
    ["jajko", 75, 6, 1, 5, "1 szt (60g)"],
    ["jajko sadzone", 110, 7, 0, 9, "1 szt"],
    ["jajecznica z 2 jajek", 220, 14, 1, 18, "1 porcja"],
    ["jajecznica z 3 jajek", 330, 21, 2, 27, "1 porcja"],
    ["jajko na miękko", 75, 6, 1, 5, "1 szt"],
    ["jajko na twardo", 78, 6, 1, 5, "1 szt"],
    ["omlet z 2 jajek", 190, 13, 1, 15, "1 porcja"],
    ["omlet z 3 jajek", 285, 20, 2, 22, "1 porcja"],

    // --- Wędliny i mięso ---
    ["szynka", 40, 6, 1, 1, "2 plastry (30g)"],
    ["szynka konserwowa", 55, 5, 1, 3, "2 plastry (30g)"],
    ["salami", 120, 5, 0, 11, "4 plastry (30g)"],
    ["kabanos", 110, 6, 1, 9, "1 szt (25g)"],
    ["kiełbasa", 280, 12, 1, 25, "1 szt (100g)"],
    ["parówka", 170, 7, 2, 15, "1 szt (60g)"],
    ["pierś z kurczaka", 165, 31, 0, 4, "1 porcja (150g)"],
    ["udko z kurczaka", 210, 26, 0, 11, "1 szt (150g)"],
    ["kotlet schabowy", 350, 25, 15, 22, "1 szt (150g)"],
    ["kotlet mielony", 250, 18, 8, 16, "1 szt (120g)"],
    ["gulasz wołowy", 300, 25, 10, 18, "1 porcja (250g)"],
    ["polędwica wołowa", 200, 30, 0, 8, "1 porcja (150g)"],
    ["mięso mielone wieprzowe", 260, 17, 0, 21, "100g"],
    ["mięso mielone drobiowe", 150, 20, 0, 8, "100g"],
    ["boczek", 180, 5, 0, 17, "2 plastry (40g)"],
    ["bekon", 130, 7, 0, 11, "3 plastry (30g)"],

    // --- Ryby ---
    ["łosoś", 280, 30, 0, 18, "1 porcja (150g)"],
    ["dorsz", 120, 26, 0, 1, "1 porcja (150g)"],
    ["tuńczyk w puszce", 130, 28, 0, 1, "1 puszka (150g)"],
    ["śledź w oleju", 200, 15, 0, 16, "100g"],
    ["makrela wędzona", 260, 19, 0, 20, "100g"],
    ["paluszki rybne", 200, 8, 18, 10, "4 szt (100g)"],

    // --- Zupy ---
    ["żurek", 250, 10, 20, 14, "1 talerz (350ml)"],
    ["rosół", 120, 8, 10, 5, "1 talerz (350ml)"],
    ["pomidorowa", 180, 5, 25, 7, "1 talerz (350ml)"],
    ["ogórkowa", 130, 4, 12, 7, "1 talerz (350ml)"],
    ["grochowa", 300, 15, 35, 12, "1 talerz (350ml)"],
    ["pieczarkowa", 160, 5, 15, 9, "1 talerz (350ml)"],
    ["barszcz czerwony", 80, 2, 12, 3, "1 talerz (350ml)"],
    ["krem z brokułów", 150, 5, 15, 8, "1 talerz (350ml)"],

    // --- Dania główne ---
    ["pierogi ruskie", 400, 12, 55, 14, "8 szt"],
    ["pierogi z mięsem", 420, 18, 50, 16, "8 szt"],
    ["pierogi z kapustą i grzybami", 350, 8, 52, 12, "8 szt"],
    ["naleśniki z serem", 380, 14, 45, 16, "2 szt"],
    ["naleśniki z dżemem", 350, 8, 55, 12, "2 szt"],
    ["placki ziemniaczane", 300, 6, 35, 15, "3 szt"],
    ["bigos", 250, 12, 10, 18, "1 porcja (250g)"],
    ["gołąbki", 350, 18, 25, 20, "2 szt"],
    ["pyzy", 300, 8, 55, 5, "4 szt"],
    ["kopytka", 280, 7, 50, 5, "1 porcja (200g)"],
    ["kluski śląskie", 260, 6, 48, 4, "1 porcja (200g)"],
    ["makaron z sosem bolognese", 450, 22, 55, 15, "1 talerz"],
    ["spaghetti carbonara", 500, 20, 55, 22, "1 talerz"],
    ["makaron z pesto", 420, 12, 50, 20, "1 talerz"],
    ["lasagne", 450, 22, 35, 24, "1 porcja"],
    ["pizza margherita", 250, 10, 30, 10, "1 kawałek"],
    ["pizza pepperoni", 300, 12, 28, 15, "1 kawałek"],

    // --- Dodatki ---
    ["ryż biały gotowany", 200, 4, 44, 0, "1 porcja (150g)"],
    ["ryż brązowy gotowany", 180, 4, 38, 1, "1 porcja (150g)"],
    ["kasza gryczana", 180, 6, 36, 2, "1 porcja (150g)"],
    ["kasza jaglana", 170, 4, 36, 1, "1 porcja (150g)"],
    ["ziemniaki gotowane", 130, 3, 28, 0, "2 szt (200g)"],
    ["ziemniaki purée", 180, 4, 30, 5, "1 porcja (200g)"],
    ["frytki", 320, 4, 40, 16, "1 porcja (150g)"],
    ["makaron gotowany", 220, 8, 44, 1, "1 porcja (180g)"],

    // --- Warzywa ---
    ["pomidor", 20, 1, 4, 0, "1 szt (150g)"],
    ["ogórek", 10, 1, 2, 0, "1 szt (120g)"],
    ["sałata", 5, 1, 1, 0, "garść (30g)"],
    ["papryka", 30, 1, 6, 0, "1 szt (150g)"],
    ["marchewka", 25, 1, 6, 0, "1 szt (80g)"],
    ["cebula", 20, 1, 4, 0, "1 szt (70g)"],
    ["brokuł", 55, 6, 7, 1, "1 porcja (150g)"],
    ["kalafior", 40, 4, 6, 1, "1 porcja (150g)"],
    ["szpinak", 15, 2, 1, 0, "garść (50g)"],
    ["kukurydza konserwowa", 80, 3, 15, 1, "1/2 puszki (100g)"],
    ["groszek zielony", 60, 4, 9, 0, "1/2 puszki (80g)"],
    ["fasola konserwowa", 100, 7, 17, 0, "1/2 puszki (120g)"],
    ["surówka z kapusty", 40, 1, 6, 1, "1 porcja (100g)"],
    ["sałatka grecka", 180, 5, 8, 14, "1 porcja (200g)"],

    // --- Owoce ---
    ["jabłko", 52, 0, 14, 0, "1 szt (130g)"],
    ["banan", 90, 1, 23, 0, "1 szt (120g)"],
    ["pomarańcza", 60, 1, 15, 0, "1 szt (150g)"],
    ["mandarynka", 35, 1, 9, 0, "1 szt (80g)"],
    ["gruszka", 55, 0, 15, 0, "1 szt (150g)"],
    ["truskawki", 45, 1, 10, 0, "1 szklanka (150g)"],
    ["winogrona", 70, 1, 18, 0, "garść (100g)"],
    ["arbuz", 60, 1, 15, 0, "1 plaster (200g)"],
    ["kiwi", 40, 1, 9, 0, "1 szt (70g)"],
    ["brzoskwinia", 40, 1, 10, 0, "1 szt (120g)"],
    ["śliwka", 25, 0, 6, 0, "1 szt (50g)"],

    // --- Napoje ---
    ["kawa czarna", 5, 0, 0, 0, "1 filiżanka (200ml)"],
    ["kawa z mlekiem", 30, 2, 2, 1, "1 filiżanka (200ml)"],
    ["latte", 120, 6, 10, 5, "1 szt (300ml)"],
    ["cappuccino", 80, 4, 6, 4, "1 szt (200ml)"],
    ["herbata bez cukru", 2, 0, 0, 0, "1 szklanka (250ml)"],
    ["herbata z cukrem", 30, 0, 8, 0, "1 szklanka (250ml)"],
    ["sok pomarańczowy", 90, 1, 22, 0, "1 szklanka (200ml)"],
    ["sok jabłkowy", 80, 0, 20, 0, "1 szklanka (200ml)"],
    ["cola", 85, 0, 21, 0, "1 puszka (200ml)"],
    ["woda", 0, 0, 0, 0, "1 szklanka (250ml)"],
    ["piwo", 150, 1, 12, 0, "1 szt (330ml)"],
    ["wino czerwone", 125, 0, 4, 0, "1 kieliszek (150ml)"],
    ["wino białe", 120, 0, 3, 0, "1 kieliszek (150ml)"],
    ["wódka", 100, 0, 0, 0, "1 kieliszek (40ml)"],

    // --- Słodycze i przekąski ---
    ["czekolada mleczna", 135, 2, 15, 8, "4 kostki (25g)"],
    ["czekolada gorzka", 130, 2, 12, 9, "4 kostki (25g)"],
    ["ciastko", 150, 2, 20, 7, "1 szt (35g)"],
    ["pączek", 300, 5, 38, 14, "1 szt (70g)"],
    ["drożdżówka", 280, 5, 40, 11, "1 szt (80g)"],
    ["wafel", 150, 2, 20, 7, "1 szt (30g)"],
    ["baton proteinowy", 200, 20, 22, 6, "1 szt (60g)"],
    ["baton czekoladowy", 250, 3, 30, 13, "1 szt (50g)"],
    ["chipsy", 270, 3, 26, 17, "1 paczka (50g)"],
    ["paluszki", 190, 5, 34, 4, "1 porcja (50g)"],
    ["orzeszki ziemne", 170, 7, 5, 14, "garść (30g)"],
    ["migdały", 170, 6, 5, 15, "garść (30g)"],
    ["orzechy włoskie", 200, 5, 3, 20, "garść (30g)"],
    ["lody", 200, 3, 25, 10, "2 gałki (100g)"],
    ["sernik", 320, 8, 30, 18, "1 kawałek (120g)"],
    ["szarlotka", 280, 3, 38, 13, "1 kawałek (120g)"],
    ["tiramisu", 350, 6, 35, 20, "1 porcja (120g)"],

    // --- Śniadaniowe ---
    ["płatki owsiane", 150, 5, 27, 3, "1 porcja (40g)"],
    ["płatki kukurydziane", 140, 2, 32, 0, "1 porcja (35g)"],
    ["musli", 180, 4, 30, 5, "1 porcja (50g)"],
    ["granola", 220, 5, 32, 8, "1 porcja (50g)"],
    ["owsianka na mleku", 250, 10, 38, 6, "1 miska"],
    ["owsianka na wodzie", 150, 5, 27, 3, "1 miska"],
    ["kanapka z szynką", 320, 14, 38, 12, "1 szt"],
    ["kanapka z serem", 220, 10, 25, 9, "1 szt"],
    ["kanapka z masłem orzechowym", 280, 8, 28, 15, "1 szt"],
    ["tost z jajkiem", 190, 10, 15, 10, "1 szt"],

    // --- Fast food ---
    ["hamburger", 450, 22, 35, 24, "1 szt"],
    ["cheeseburger", 500, 25, 35, 28, "1 szt"],
    ["hot dog", 300, 10, 28, 16, "1 szt"],
    ["kebab", 550, 25, 45, 30, "1 szt"],
    ["wrap z kurczakiem", 400, 22, 35, 18, "1 szt"],
    ["nuggetsy", 280, 14, 18, 16, "6 szt (100g)"],
    ["sushi maki", 40, 1, 8, 0, "1 kawałek"],
    ["sushi nigiri", 50, 3, 8, 1, "1 kawałek"],

    // --- Inne ---
    ["dżem", 40, 0, 10, 0, "1 łyżka (15g)"],
    ["miód", 45, 0, 12, 0, "1 łyżka (15g)"],
    ["nutella", 80, 1, 9, 5, "1 łyżka (15g)"],
    ["masło orzechowe", 95, 4, 3, 8, "1 łyżka (15g)"],
    ["ketchup", 15, 0, 4, 0, "1 łyżka (15g)"],
    ["majonez", 100, 0, 0, 11, "1 łyżka (15g)"],
    ["oliwa z oliwek", 45, 0, 0, 5, "1 łyżeczka (5ml)"],
    ["cukier", 20, 0, 5, 0, "1 łyżeczka (5g)"],
    ["ryż z warzywami", 280, 6, 50, 5, "1 porcja (250g)"],
    ["sałatka z tuńczykiem", 220, 20, 8, 12, "1 porcja (200g)"],
    ["wrap warzywny", 250, 6, 35, 10, "1 szt"],
    ["tosty z awokado", 250, 5, 22, 16, "1 szt"],
    ["avocado", 160, 2, 9, 15, "1/2 szt (80g)"],
    ["hummus", 70, 3, 6, 4, "2 łyżki (30g)"],
  ];

  // Build search index
  const _index = _foods.map(([name, cal, pro, carb, fat, portion]) => ({
    name, calories: cal, protein: pro, carbs: carb, fat, portion,
    searchKey: _normalize(name),
  }));

  function _normalize(str) {
    return str.toLowerCase()
      .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
      .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
      .replace(/ś/g, 's').replace(/ż/g, 'z').replace(/ź/g, 'z')
      .replace(/[^a-z0-9 ]/g, '');
  }

  /**
   * Search for foods matching the query.
   * Returns array of { name, calories, protein, carbs, fat, portion, score }
   */
  function search(query, maxResults = 10) {
    const normalized = _normalize(query);
    const words = normalized.split(/\s+/).filter(w => w.length > 1);
    if (words.length === 0) return [];

    const scored = _index.map(item => {
      let score = 0;

      // Exact match
      if (item.searchKey === normalized) score += 100;
      // Starts with
      if (item.searchKey.startsWith(normalized)) score += 50;
      // Contains full query
      if (item.searchKey.includes(normalized)) score += 30;

      // Word matching
      words.forEach(word => {
        if (item.searchKey.includes(word)) score += 10;
        // Bonus for word at start
        if (item.searchKey.startsWith(word)) score += 5;
      });

      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

    return scored;
  }

  /**
   * Parse a meal description and try to match foods.
   * Handles "2 jajka sadzone, chleb z masłem" style inputs.
   * Returns { items: [...], total: {...} } in the same format as AI.
   */
  function parseMealDescription(text) {
    // Split by commas, "i", newlines
    const parts = text.split(/[,\n]+|(?:\s+i\s+)/).map(s => s.trim()).filter(Boolean);
    const items = [];

    for (const part of parts) {
      // Try to extract quantity (e.g. "2 jajka")
      const qtyMatch = part.match(/^(\d+)\s+(.+)$/);
      let qty = 1;
      let foodName = part;

      if (qtyMatch) {
        qty = parseInt(qtyMatch[1]);
        foodName = qtyMatch[2];
      }

      const results = search(foodName, 1);
      if (results.length > 0) {
        const food = results[0];
        items.push({
          name: food.name,
          amount: qty > 1 ? `${qty} × ${food.portion}` : food.portion,
          calories: food.calories * qty,
          protein: food.protein * qty,
          carbs: food.carbs * qty,
          fat: food.fat * qty,
        });
      }
    }

    if (items.length === 0) return null;

    return {
      items,
      total: {
        calories: items.reduce((s, i) => s + i.calories, 0),
        protein: items.reduce((s, i) => s + i.protein, 0),
        carbs: items.reduce((s, i) => s + i.carbs, 0),
        fat: items.reduce((s, i) => s + i.fat, 0),
      }
    };
  }

  return {
    search,
    parseMealDescription,
    count: _index.length,
  };
})();
