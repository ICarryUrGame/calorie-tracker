// ============================================
// CALORIE TRACKER — Gamification Module
// Badges, XP, Levels, Weekly Challenges
// ============================================

const Gamification = (() => {
  // --- Badge Definitions ---
  const BADGES = [
    { id: 'first_meal', name: 'Pierwszy posiłek', icon: '🍽️', desc: 'Dodaj swój pierwszy posiłek', condition: (s) => s.totalMeals >= 1 },
    { id: 'photographer', name: 'Fotograf', icon: '📸', desc: 'Przeanalizuj posiłek ze zdjęcia', condition: (s) => s.photoMeals >= 1 },
    { id: 'week_streak', name: 'Tydzień w normie', icon: '🔥', desc: '7 dni z rzędu w celu kalorycznym', condition: (s) => s.streak >= 7 },
    { id: 'month_streak', name: 'Miesiąc w normie', icon: '💪', desc: '30 dni z rzędu w celu kalorycznym', condition: (s) => s.streak >= 30 },
    { id: 'hundred_meals', name: 'Setka', icon: '💯', desc: 'Zarejestruj 100 posiłków', condition: (s) => s.totalMeals >= 100 },
    { id: 'water_master', name: 'Wodny mistrz', icon: '💧', desc: '7 dni z pełnym celem wody', condition: (s) => s.waterStreakDays >= 7 },
    { id: 'goal_weight', name: 'Cel wagowy', icon: '🏆', desc: 'Osiągnij swoją docelową wagę', condition: (s) => s.goalWeightReached },
    { id: 'collector', name: 'Kolekcjoner', icon: '⭐', desc: 'Zapisz 10 ulubionych posiłków', condition: (s) => s.favoritesCount >= 10 },
    { id: 'ten_meals', name: 'Regularny', icon: '📝', desc: 'Zarejestruj 10 posiłków', condition: (s) => s.totalMeals >= 10 },
    { id: 'fifty_meals', name: 'Konsekwentny', icon: '🎯', desc: 'Zarejestruj 50 posiłków', condition: (s) => s.totalMeals >= 50 },
    { id: 'ai_user', name: 'AI Explorer', icon: '🤖', desc: 'Użyj analizy AI po raz pierwszy', condition: (s) => s.aiMeals >= 1 },
    { id: 'three_day_streak', name: 'Dobry start', icon: '✨', desc: '3 dni z rzędu w celu', condition: (s) => s.streak >= 3 },
  ];

  // --- Challenge Pool ---
  const CHALLENGE_POOL = [
    { id: 'cal_under_5', name: 'Kontrola kalorii', desc: 'Nie przekrocz celu kalorycznego przez 5 dni', icon: '🎯', target: 5, type: 'days_under_cal', xpReward: 50 },
    { id: 'water_3', name: 'Nawodnienie', desc: 'Wypij pełny cel wody przez 3 dni', icon: '💧', target: 3, type: 'days_full_water', xpReward: 30 },
    { id: 'photo_3', name: 'Fotodziennik', desc: 'Dodaj 3 posiłki ze zdjęcia', icon: '📸', target: 3, type: 'photo_meals', xpReward: 35 },
    { id: 'protein_4', name: 'Białkowy tydzień', desc: 'Osiągnij cel białka przez 4 dni', icon: '🥩', target: 4, type: 'days_protein_goal', xpReward: 40 },
    { id: 'log_7', name: 'Codzienny dziennik', desc: 'Dodaj posiłek przez 7 dni z rzędu', icon: '📝', target: 7, type: 'days_with_meals', xpReward: 45 },
    { id: 'low_fat_4', name: 'Lekkie jedzenie', desc: 'Nie przekrocz celu tłuszczu przez 4 dni', icon: '🥗', target: 4, type: 'days_under_fat', xpReward: 40 },
  ];

  // --- XP Level Thresholds ---
  function getLevelInfo(xp) {
    const thresholds = [0, 100, 250, 500, 850, 1300, 1900, 2700, 3800, 5200, 7000, 9500, 13000, 17500, 23000, 30000];
    let level = 1;
    for (let i = 1; i < thresholds.length; i++) {
      if (xp >= thresholds[i]) level = i + 1;
      else break;
    }
    const currentThreshold = thresholds[level - 1] || 0;
    const nextThreshold = thresholds[level] || thresholds[thresholds.length - 1] + 5000;
    const progress = nextThreshold > currentThreshold ? (xp - currentThreshold) / (nextThreshold - currentThreshold) : 1;
    return { level, xp, currentThreshold, nextThreshold, progress: Math.min(1, progress) };
  }

  // --- XP Rewards ---
  const XP_REWARDS = {
    addMeal: 5,
    dayInGoal: 10,
    addWater: 3,
    earnBadge: 20,
    completeChallenge: 0, // per-challenge xpReward
  };

  // --- Core Functions ---
  function getStats() {
    const gam = _getGamData();
    const streak = AppStorage.getStreak();
    const favorites = AppStorage.getFavorites();
    const profile = AppStorage.getProfile();
    const weightHistory = AppStorage.getWeightHistory();
    const allDates = AppStorage.getAllDatesWithMeals();

    let totalMeals = 0;
    let photoMeals = 0;
    let aiMeals = 0;
    allDates.forEach(d => {
      const meals = AppStorage.getMealsForDate ? AppStorage.getDaySummary(new Date(d)).meals : [];
      const dayMeals = AppStorage.getDaySummary(new Date(d)).meals || [];
      totalMeals += dayMeals.length;
      dayMeals.forEach(m => {
        if (m.type === 'photo') photoMeals++;
        if (m.type === 'text') aiMeals++;
      });
    });

    let goalWeightReached = false;
    if (profile.targetWeight > 0 && weightHistory.length > 0) {
      const latestWeight = weightHistory[0]?.weight || 0;
      if (profile.targetWeight <= profile.weight) {
        goalWeightReached = latestWeight <= profile.targetWeight;
      } else {
        goalWeightReached = latestWeight >= profile.targetWeight;
      }
    }

    // Water streak
    let waterStreakDays = 0;
    const waterData = _getWaterData();
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = _dateKey(d);
      const waterGoal = AppStorage.getWaterGoal ? AppStorage.getWaterGoal() : 8;
      if (waterData[key] && waterData[key] >= waterGoal) {
        waterStreakDays++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      totalMeals,
      photoMeals,
      aiMeals,
      streak,
      waterStreakDays,
      goalWeightReached,
      favoritesCount: favorites.length,
    };
  }

  function checkBadges() {
    const gam = _getGamData();
    const stats = getStats();
    const newBadges = [];

    BADGES.forEach(badge => {
      if (!gam.badges.includes(badge.id) && badge.condition(stats)) {
        gam.badges.push(badge.id);
        gam.xp += XP_REWARDS.earnBadge;
        newBadges.push(badge);
      }
    });

    if (newBadges.length > 0) {
      _saveGamData(gam);
    }

    return newBadges;
  }

  function addXP(action) {
    const gam = _getGamData();
    const reward = XP_REWARDS[action] || 0;
    if (reward > 0) {
      gam.xp += reward;
      _saveGamData(gam);
    }
    return reward;
  }

  function getGamificationData() {
    return _getGamData();
  }

  function getAllBadges() {
    const gam = _getGamData();
    return BADGES.map(b => ({
      ...b,
      unlocked: gam.badges.includes(b.id),
    }));
  }

  function getActiveChallenges() {
    const gam = _getGamData();
    if (!gam.challenges || gam.challenges.length === 0 || _isNewWeek(gam.challengeWeek)) {
      gam.challenges = _generateWeeklyChallenges();
      gam.challengeWeek = _getWeekKey();
      _saveGamData(gam);
    }
    return gam.challenges;
  }

  function updateChallengeProgress() {
    const gam = _getGamData();
    if (!gam.challenges) return [];
    const completed = [];

    gam.challenges.forEach(ch => {
      if (ch.completed) return;
      const progress = _calculateChallengeProgress(ch);
      ch.progress = progress;
      if (progress >= ch.target && !ch.completed) {
        ch.completed = true;
        gam.xp += ch.xpReward;
        completed.push(ch);
      }
    });

    _saveGamData(gam);
    return completed;
  }

  // --- Internal Helpers ---
  function _getGamData() {
    try {
      const data = localStorage.getItem('ct_gamification');
      return data ? JSON.parse(data) : { xp: 0, badges: [], challenges: [], challengeWeek: '' };
    } catch { return { xp: 0, badges: [], challenges: [], challengeWeek: '' }; }
  }

  function _saveGamData(data) {
    localStorage.setItem('ct_gamification', JSON.stringify(data));
  }

  function _getWaterData() {
    try {
      const data = localStorage.getItem('ct_water');
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  }

  function _dateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _getWeekKey() {
    const d = new Date();
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }

  function _isNewWeek(savedWeek) {
    return savedWeek !== _getWeekKey();
  }

  function _generateWeeklyChallenges() {
    const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3).map(ch => ({
      ...ch,
      progress: 0,
      completed: false,
    }));
  }

  function _calculateChallengeProgress(challenge) {
    const today = new Date();
    let count = 0;
    const goal = AppStorage.getDailyGoal();
    const macroGoals = AppStorage.getMacroGoals();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const summary = AppStorage.getDaySummary(d);
      const kcal = summary.totals.calories;
      const waterData = _getWaterData();
      const dateKey = _dateKey(d);

      switch (challenge.type) {
        case 'days_under_cal':
          if (kcal > 0 && kcal <= goal) count++;
          break;
        case 'days_full_water':
          if (waterData[dateKey] && waterData[dateKey] >= (AppStorage.getWaterGoal ? AppStorage.getWaterGoal() : 8)) count++;
          break;
        case 'photo_meals':
          summary.meals.forEach(m => { if (m.type === 'photo') count++; });
          break;
        case 'days_protein_goal':
          if (summary.totals.protein >= macroGoals.protein) count++;
          break;
        case 'days_with_meals':
          if (summary.meals.length > 0) count++;
          break;
        case 'days_under_fat':
          if (kcal > 0 && summary.totals.fat <= macroGoals.fat) count++;
          break;
      }
    }
    return Math.min(count, challenge.target);
  }

  return {
    BADGES,
    getLevelInfo,
    getStats,
    checkBadges,
    addXP,
    getGamificationData,
    getAllBadges,
    getActiveChallenges,
    updateChallengeProgress,
    XP_REWARDS,
  };
})();
