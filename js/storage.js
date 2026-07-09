// ============================================
// CALORIE TRACKER — Storage Module (Hybrid API & Local Mode V2)
// Detects file:// or http:// and syncs data to server OR local storage database
// ============================================

const AppStorage = (() => {
  // If served on a local development server (like VS Code Live Server on 5500), but Python server runs on 3000
  const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? (window.location.port === '3000' ? '' : 'http://localhost:3000')
    : '';
  
  // Detect if running on static GitHub Pages or locally via file://
  const _isGitHubPages = window.location.hostname.includes('github.io');
  const _isLocalMode = window.location.protocol === 'file://' || _isGitHubPages;

  function _cleanProfile(p) {
    p = p || {};
    return {
      weight: parseFloat(p.weight) || 0,
      height: parseInt(p.height) || 0,
      targetWeight: parseFloat(p.targetWeight) || 0,
      exerciseDays: p.exerciseDays || '0',
      activeLifestyle: p.activeLifestyle || 'sedentary',
      manualGoals: !!p.manualGoals,
      waterGoal: parseInt(p.waterGoal) || 8,
      waterIntake: p.waterIntake || {},
      ifSettings: p.ifSettings || { enabled: false, protocol: '16:8', startHour: 12 },
      dayNotes: p.dayNotes || {},
      theme: p.theme || 'dark'
    };
  }

  // Local memory cache
  let _state = {
    token: localStorage.getItem('ct_token') || null,
    username: localStorage.getItem('ct_username') || null,
    apiKey: '',
    dailyGoal: 2000,
    macroGoals: { protein: 150, carbs: 250, fat: 70 },
    profile: _cleanProfile(null),
    weightHistory: [], // Array of { date, weight }
    favorites: [], // Array of { id, name, calories, protein, carbs, fat }
    meals: {} // Date -> Array of meals
  };

  console.log(`[Storage] Uruchomiono w trybie: ${_isLocalMode ? 'LOKALNYM (file://)' : 'SERWEROWYM (http://)'}`);

  // --- BMR Calorie Calculator ---
  function calculateGoals(weight, height, targetWeight, exerciseDays = '0', activeLifestyle = 'sedentary') {
    // Mifflin-St Jeor formula (assuming age 25 for general estimate)
    // BMR = 10*weight + 6.25*height - 5*25 - 5
    let calories = Math.round(10 * weight + 6.25 * height - 130);
    
    // Activity Factor Multiplier based on Lifestyle + Exercise:
    let activityMultiplier = 1.2; // Sedentary + no exercise
    
    if (activeLifestyle === 'active') {
      activityMultiplier += 0.15; // base boost for active daily job/lifestyle
    }
    
    if (exerciseDays === '1-3') {
      activityMultiplier += 0.175;
    } else if (exerciseDays === '3-5') {
      activityMultiplier += 0.35;
    } else if (exerciseDays === '6-7') {
      activityMultiplier += 0.525;
    }

    calories = Math.round(calories * activityMultiplier);

    // Adjust based on expected target weight
    if (targetWeight < weight) {
      calories -= 400; // Deficit
    } else if (targetWeight > weight) {
      calories += 300; // Surplus
    }
    
    // Ensure logical floor
    calories = Math.max(1200, calories);

    // Macros:
    // Protein: 1.8g per kg
    const protein = Math.round(1.8 * weight);
    // Fat: 1.0g per kg
    const fat = Math.round(1.0 * weight);
    // Carbs: rest of calories
    const carbs = Math.max(50, Math.round((calories - (protein * 4) - (fat * 9)) / 4));

    return {
      dailyGoal: calories,
      macroGoals: { protein, carbs, fat }
    };
  }

  // --- Auth API ---
  async function register(username, password, profileData = null) {
    username = username.trim().toLowerCase();
    password = password.trim();

    if (username.length < 3 || password.length < 4) {
      throw new Error('Nazwa użytkownika musi mieć min. 3 znaki, a hasło min. 4 znaki.');
    }

    // Determine initial targets
    let dailyGoal = 2000;
    let macroGoals = { protein: 150, carbs: 250, fat: 70 };
    let profile = { weight: 0, height: 0, targetWeight: 0 };
    let weightHistory = [];

    if (profileData && profileData.weight && profileData.height) {
      profile = {
        weight: parseFloat(profileData.weight) || 0,
        height: parseFloat(profileData.height) || 0,
        targetWeight: parseFloat(profileData.targetWeight) || 0
      };
      
      const calculated = calculateGoals(profile.weight, profile.height, profile.targetWeight);
      dailyGoal = calculated.dailyGoal;
      macroGoals = calculated.macroGoals;

      // Add first record to history
      weightHistory.push({
        date: _dateKey(new Date()),
        weight: profile.weight
      });
    }

    if (_isLocalMode) {
      const users = _getLocalUsers();
      if (users[username]) {
        throw new Error('Użytkownik o takiej nazwie już istnieje.');
      }

      const passwordHash = _simpleHash(password);
      
      users[username] = {
        username: username,
        passwordHash: passwordHash,
        dailyGoal: dailyGoal,
        macroGoals: macroGoals,
        apiKey: '',
        profile: profile,
        weightHistory: weightHistory,
        favorites: [],
        meals: {}
      };

      _saveLocalUsers(users);
      _setSession(`local:${username}`, username);
      await fetchUserData();
      return { success: true };
    } else {
      try {
        const res = await fetch(`${API_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Błąd rejestracji');

        _setSession(data.token, data.user.username);
        
        // Sync calculated goals and profile info to SQL server
        await syncUserData({
          dailyGoal,
          macroGoals,
          profile,
          weightHistory
        });

        await fetchUserData();
        return { success: true };
      } catch (e) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          throw new Error('Nie można połączyć się z serwerem. Upewnij się, że serwer działa (python server.py) na porcie 3000, lub otwórz plik index.html bezpośrednio w przeglądarce (file://), aby korzystać z bazy lokalnej (Local Storage).');
        }
        console.warn('Server registration failed, offline mode not connected', e.message);
        throw e;
      }
    }
  }

  async function login(username, password) {
    username = username.trim().toLowerCase();
    password = password.trim();

    if (_isLocalMode) {
      const users = _getLocalUsers();
      const user = users[username];
      
      if (!user || user.passwordHash !== _simpleHash(password)) {
        throw new Error('Nieprawidłowa nazwa użytkownika lub hasło.');
      }

      _setSession(`local:${username}`, username);
      await fetchUserData();
      return { success: true };
    } else {
      try {
        const res = await fetch(`${API_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Błąd logowania');

        _setSession(data.token, data.user.username);
        await fetchUserData();
        return { success: true };
      } catch (e) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          throw new Error('Nie można połączyć się z serwerem. Upewnij się, że serwer działa (python server.py) na porcie 3000, lub otwórz plik index.html bezpośrednio w przeglądarce (file://), aby korzystać z bazy lokalnej (Local Storage).');
        }
        throw e;
      }
    }
  }

  function logout() {
    _state.token = null;
    _state.username = null;
    _state.meals = {};
    _state.apiKey = '';
    _state.profile = { weight: 0, height: 0, targetWeight: 0 };
    _state.weightHistory = [];
    _state.favorites = [];
    localStorage.removeItem('ct_token');
    localStorage.removeItem('ct_username');
  }

  function isAuthenticated() {
    return !!_state.token;
  }

  function getUsername() {
    return _state.username || 'Użytkownik';
  }

  // --- Session Management ---
  function _setSession(token, username) {
    _state.token = token;
    _state.username = username;
    localStorage.setItem('ct_token', token);
    localStorage.setItem('ct_username', username);
  }

  // --- Data Fetching & Sync ---
  async function fetchUserData() {
    if (!isAuthenticated()) return;

    if (_isLocalMode || _state.token.startsWith('local:')) {
      const users = _getLocalUsers();
      const user = users[_state.username];
      if (user) {
        _state.dailyGoal = user.dailyGoal || 2000;
        _state.macroGoals = user.macroGoals || { protein: 150, carbs: 250, fat: 70 };
        _state.apiKey = user.apiKey || '';
        _state.profile = _cleanProfile(user.profile);
        _state.weightHistory = user.weightHistory || [];
        _state.favorites = user.favorites || [];
        _state.meals = user.meals || {};
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/api/user-data`, {
          headers: { 'Authorization': _state.token }
        });
        if (!res.ok) {
          if (res.status === 401) {
            logout();
            throw new Error('Sesja wygasła. Zaloguj się ponownie.');
          }
          throw new Error('Nie udało się pobrać danych');
        }

        const data = await res.json();
        _state.dailyGoal = data.dailyGoal || 2000;
        _state.macroGoals = data.macroGoals || { protein: 150, carbs: 250, fat: 70 };
        _state.apiKey = data.apiKey || '';
        _state.profile = _cleanProfile(data.profile);
        _state.weightHistory = data.weightHistory || [];
        _state.favorites = data.favorites || [];
        _state.meals = data.meals || {};
      } catch (e) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          throw new Error('Nie można połączyć się z serwerem. Upewnij się, że serwer działa (python server.py).');
        }
        console.error('Fetch error:', e);
        throw e;
      }
    }
  }

  async function syncUserData(updates) {
    if (!isAuthenticated()) return;

    if (_isLocalMode || _state.token.startsWith('local:')) {
      const users = _getLocalUsers();
      const user = users[_state.username];
      if (user) {
        if (updates.dailyGoal !== undefined) user.dailyGoal = updates.dailyGoal;
        if (updates.macroGoals !== undefined) user.macroGoals = updates.macroGoals;
        if (updates.apiKey !== undefined) user.apiKey = updates.apiKey;
        if (updates.profile !== undefined) user.profile = updates.profile;
        if (updates.weightHistory !== undefined) user.weightHistory = updates.weightHistory;
        if (updates.favorites !== undefined) user.favorites = updates.favorites;
        
        users[_state.username] = user;
        _saveLocalUsers(users);
      }
      
      // Update state cache
      if (updates.dailyGoal !== undefined) _state.dailyGoal = updates.dailyGoal;
      if (updates.macroGoals !== undefined) _state.macroGoals = updates.macroGoals;
      if (updates.apiKey !== undefined) _state.apiKey = updates.apiKey;
      if (updates.profile !== undefined) _state.profile = updates.profile;
      if (updates.weightHistory !== undefined) _state.weightHistory = updates.weightHistory;
      if (updates.favorites !== undefined) _state.favorites = updates.favorites;
    } else {
      try {
        const res = await fetch(`${API_URL}/api/sync-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': _state.token
          },
          body: JSON.stringify(updates)
        });

        if (!res.ok) throw new Error('Błąd synchronizacji celów');
        
        if (updates.dailyGoal !== undefined) _state.dailyGoal = updates.dailyGoal;
        if (updates.macroGoals !== undefined) _state.macroGoals = updates.macroGoals;
        if (updates.apiKey !== undefined) _state.apiKey = updates.apiKey;
        if (updates.profile !== undefined) _state.profile = updates.profile;
        if (updates.weightHistory !== undefined) _state.weightHistory = updates.weightHistory;
        if (updates.favorites !== undefined) _state.favorites = updates.favorites;
      } catch (e) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          throw new Error('Nie można połączyć się z serwerem do synchronizacji danych. Upewnij się, że serwer działa (python server.py).');
        }
        console.error('Sync error:', e);
        throw e;
      }
    }
  }

  // --- Meals CRUD ---
  async function addMeal(date, mealData) {
    if (!isAuthenticated()) return;

    const dateKey = _dateKey(date);
    
    const meal = {
      id: _generateId(),
      date: dateKey,
      time: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }),
      type: mealData.type || 'text',
      items: mealData.items || [],
      total: mealData.total || { calories: 0, protein: 0, carbs: 0, fat: 0 },
      createdAt: Date.now()
    };

    if (_isLocalMode || _state.token.startsWith('local:')) {
      const users = _getLocalUsers();
      const user = users[_state.username];
      if (user) {
        if (!user.meals[dateKey]) user.meals[dateKey] = [];
        user.meals[dateKey].push(meal);
        
        users[_state.username] = user;
        _saveLocalUsers(users);
        
        if (!_state.meals[dateKey]) _state.meals[dateKey] = [];
        _state.meals[dateKey].push(meal);
      }
      return meal;
    } else {
      try {
        const res = await fetch(`${API_URL}/api/sync-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': _state.token
          },
          body: JSON.stringify({ meals: [meal] })
        });

        if (!res.ok) throw new Error('Nie udało się zapisać posiłku');

        if (!_state.meals[dateKey]) _state.meals[dateKey] = [];
        _state.meals[dateKey].push(meal);
        return meal;
      } catch (e) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          throw new Error('Nie można połączyć się z serwerem. Upewnij się, że serwer działa (python server.py).');
        }
        console.error(e);
        throw e;
      }
    }
  }

  async function deleteMeal(date, mealId) {
    if (!isAuthenticated()) return;

    const dateKey = _dateKey(date);

    if (_isLocalMode || _state.token.startsWith('local:')) {
      const users = _getLocalUsers();
      const user = users[_state.username];
      if (user && user.meals[dateKey]) {
        user.meals[dateKey] = user.meals[dateKey].filter(m => m.id !== mealId);
        if (user.meals[dateKey].length === 0) delete user.meals[dateKey];
        
        users[_state.username] = user;
        _saveLocalUsers(users);
      }

      if (_state.meals[dateKey]) {
        _state.meals[dateKey] = _state.meals[dateKey].filter(m => m.id !== mealId);
        if (_state.meals[dateKey].length === 0) delete _state.meals[dateKey];
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/api/delete-meal?id=${mealId}`, {
          method: 'DELETE',
          headers: { 'Authorization': _state.token }
        });

        if (!res.ok) throw new Error('Nie udało się usunąć posiłku');

        if (_state.meals[dateKey]) {
          _state.meals[dateKey] = _state.meals[dateKey].filter(m => m.id !== mealId);
          if (_state.meals[dateKey].length === 0) delete _state.meals[dateKey];
        }
      } catch (e) {
        if (e.message === 'Failed to fetch' || e.name === 'TypeError') {
          throw new Error('Nie można połączyć się z serwerem. Upewnij się, że serwer działa (python server.py).');
        }
        console.error(e);
        throw e;
      }
    }
  }

  // --- Profile, Weight, and Favorites CRUD ---
  function getProfile() {
    return _state.profile || { weight: 0, height: 0, targetWeight: 0 };
  }

  async function updateProfile(weight, height, targetWeight, exerciseDays = '0', activeLifestyle = 'sedentary', manualGoals = false) {
    const updated = {
      weight: parseFloat(weight) || 0,
      height: parseFloat(height) || 0,
      targetWeight: parseFloat(targetWeight) || 0,
      exerciseDays: exerciseDays,
      activeLifestyle: activeLifestyle,
      manualGoals: !!manualGoals,
      waterGoal: _state.profile.waterGoal || 8,
      waterIntake: _state.profile.waterIntake || {},
      ifSettings: _state.profile.ifSettings || { enabled: false, protocol: '16:8', startHour: 12 },
      dayNotes: _state.profile.dayNotes || {},
      theme: _state.profile.theme || 'dark'
    };

    let updates = {
      profile: updated
    };

    if (!updated.manualGoals) {
      // Recalculate calorie goals based on updated profile
      const calculated = calculateGoals(updated.weight, updated.height, updated.targetWeight, updated.exerciseDays, updated.activeLifestyle);
      updates.dailyGoal = calculated.dailyGoal;
      updates.macroGoals = calculated.macroGoals;
    }

    await syncUserData(updates);
  }

  function getWeightHistory() {
    return _state.weightHistory || [];
  }

  async function addWeightRecord(weight) {
    const records = [...(_state.weightHistory || [])];
    const dateStr = _dateKey(new Date());
    const timeStr = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    const newRecord = {
      id: 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      date: dateStr,
      time: timeStr,
      weight: parseFloat(weight) || 0
    };

    records.push(newRecord);

    records.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      const dateCompare = dateB.localeCompare(dateA);
      if (dateCompare !== 0) return dateCompare;
      
      const timeA = a.time || '';
      const timeB = b.time || '';
      return timeB.localeCompare(timeA);
    });

    const profile = { ..._state.profile };
    profile.weight = parseFloat(weight) || 0;

    let updates = {
      weightHistory: records,
      profile: profile
    };

    if (!profile.manualGoals) {
      const calculated = calculateGoals(profile.weight, profile.height, profile.targetWeight, profile.exerciseDays, profile.activeLifestyle);
      updates.dailyGoal = calculated.dailyGoal;
      updates.macroGoals = calculated.macroGoals;
    }

    await syncUserData(updates);
  }

  async function deleteWeightRecord(recordId) {
    const records = (_state.weightHistory || []).filter(r => r.id !== recordId);
    await syncUserData({ weightHistory: records });
  }

  function getFavorites() {
    return _state.favorites || [];
  }

  async function addFavorite(item) {
    const favorites = [..._state.favorites];
    
    // Check duplicates
    if (favorites.some(f => f.name.toLowerCase() === item.name.toLowerCase())) {
      throw new Error('Ten posiłek jest już w Twoich ulubionych.');
    }

    favorites.push({
      id: 'fav_' + Date.now().toString(36),
      name: item.name,
      calories: Math.round(item.calories) || 0,
      protein: Math.round(item.protein) || 0,
      carbs: Math.round(item.carbs) || 0,
      fat: Math.round(item.fat) || 0
    });

    await syncUserData({ favorites });
  }

  async function deleteFavorite(favId) {
    const favorites = _state.favorites.filter(f => f.id !== favId);
    await syncUserData({ favorites });
  }

  // --- Getters & Setters ---
  function getDailyGoal() { return _state.dailyGoal; }
  async function setDailyGoal(val) {
    const goal = Math.max(500, Math.min(10000, parseInt(val) || 2000));
    await syncUserData({ dailyGoal: goal });
  }

  function getMacroGoals() { return _state.macroGoals; }
  async function setMacroGoals(goals) {
    const updated = {
      protein: Math.max(0, parseInt(goals.protein) || 0),
      carbs: Math.max(0, parseInt(goals.carbs) || 0),
      fat: Math.max(0, parseInt(goals.fat) || 0),
    };
    await syncUserData({ macroGoals: updated });
  }

  function getApiKey() { return _state.apiKey || ''; }
  async function setApiKey(key) {
    await syncUserData({ apiKey: key });
  }

  function getMealsForDate(date) {
    const key = _dateKey(date);
    return _state.meals[key] || [];
  }

  function getDaySummary(date) {
    const meals = (getMealsForDate(date) || []).filter(m => m !== null && m !== undefined);
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

    meals.forEach(meal => {
      const t = meal.total || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      totals.calories += t.calories || 0;
      totals.protein += t.protein || 0;
      totals.carbs += t.carbs || 0;
      totals.fat += t.fat || 0;
    });

    return {
      meals,
      mealCount: meals.length,
      totals,
    };
  }

  function getAllDatesWithMeals() {
    return Object.keys(_state.meals).sort().reverse();
  }

  async function deleteAccount() {
    if (_isLocalMode || _state.token.startsWith('local:')) {
      const users = _getLocalUsers();
      delete users[_state.username];
      _saveLocalUsers(users);
    }
    logout();
  }

  // --- Local Database Helpers ---
  function _getLocalUsers() {
    try {
      const data = localStorage.getItem('ct_local_users');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  function _saveLocalUsers(users) {
    localStorage.setItem('ct_local_users', JSON.stringify(users));
  }

  function _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  function getStreak() {
    let streak = 0;
    let checkDate = new Date();
    const goal = getDailyGoal();
    
    // Safety break counter to prevent infinite loop
    let safetyCounter = 0;
    
    while (safetyCounter < 365) {
      const dateStr = _dateKey(checkDate);
      const summary = getDaySummary(checkDate);
      const kcal = summary.totals.calories;
      
      const isToday = _isSameDay(checkDate, new Date());
      
      if (kcal > 0 && kcal <= goal) {
        streak++;
      } else {
        // If it's today and they haven't eaten yet, don't break the streak immediately; check yesterday
        if (isToday && kcal === 0) {
          // Keep check going to yesterday
        } else {
          break;
        }
      }
      
      checkDate.setDate(checkDate.getDate() - 1);
      safetyCounter++;
    }
    return streak;
  }

  function _isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  function _dateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _generateId() {
    return 'meal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // --- Water Tracking ---
  function getWaterGoal() {
    return _state.profile.waterGoal || 8;
  }
  async function setWaterGoal(goal) {
    _state.profile.waterGoal = Math.max(1, parseInt(goal) || 8);
    await syncUserData({ profile: _state.profile });
  }
  function getWaterForDate(date) {
    const key = _dateKey(date);
    return _state.profile.waterIntake[key] || 0;
  }
  async function addWater(date) {
    const key = _dateKey(date);
    _state.profile.waterIntake[key] = (_state.profile.waterIntake[key] || 0) + 1;
    await syncUserData({ profile: _state.profile });
    return _state.profile.waterIntake[key];
  }
  async function removeWater(date) {
    const key = _dateKey(date);
    const val = _state.profile.waterIntake[key] || 0;
    if (val > 0) {
      _state.profile.waterIntake[key] = val - 1;
      await syncUserData({ profile: _state.profile });
    }
    return _state.profile.waterIntake[key] || 0;
  }

  // --- IF Settings ---
  function getIFSettings() {
    return _state.profile.ifSettings || { enabled: false, protocol: '16:8', startHour: 12 };
  }
  async function setIFSettings(settings) {
    _state.profile.ifSettings = {
      enabled: !!settings.enabled,
      protocol: settings.protocol || '16:8',
      startHour: parseInt(settings.startHour) ?? 12
    };
    await syncUserData({ profile: _state.profile });
  }

  // --- Day Notes ---
  function getDayNote(date) {
    const key = _dateKey(date);
    return _state.profile.dayNotes[key] || { text: '', mood: '', energy: '' };
  }
  async function saveDayNote(date, text, mood, energy) {
    const key = _dateKey(date);
    _state.profile.dayNotes[key] = {
      text: (text || '').trim(),
      mood: mood || '',
      energy: energy || ''
    };
    await syncUserData({ profile: _state.profile });
  }

  // --- Theme ---
  function getTheme() {
    return _state.profile.theme || 'dark';
  }
  async function setTheme(theme) {
    _state.profile.theme = theme === 'light' ? 'light' : 'dark';
    await syncUserData({ profile: _state.profile });
  }

  // --- Update Meal ---
  async function updateMeal(date, mealId, updatedData) {
    if (!isAuthenticated()) return;

    const dateKey = _dateKey(date);

    if (_isLocalMode || _state.token.startsWith('local:')) {
      const users = _getLocalUsers();
      const user = users[_state.username];
      if (user && user.meals[dateKey]) {
        user.meals[dateKey] = user.meals[dateKey].map(m => m.id === mealId ? { ...m, ...updatedData } : m);
        users[_state.username] = user;
        _saveLocalUsers(users);
      }
      
      if (_state.meals[dateKey]) {
        _state.meals[dateKey] = _state.meals[dateKey].map(m => m.id === mealId ? { ...m, ...updatedData } : m);
      }
    } else {
      const existingMeal = _state.meals[dateKey]?.find(m => m.id === mealId);
      if (existingMeal) {
        const mergedMeal = { ...existingMeal, ...updatedData, date: dateKey };
        await syncUserData({ meals: [mergedMeal] });
        
        if (_state.meals[dateKey]) {
          _state.meals[dateKey] = _state.meals[dateKey].map(m => m.id === mealId ? { ...m, ...updatedData } : m);
        }
      }
    }
  }

  return {
    register,
    login,
    logout,
    isAuthenticated,
    getUsername,
    fetchUserData,
    getDailyGoal,
    setDailyGoal,
    getMacroGoals,
    setMacroGoals,
    getApiKey,
    setApiKey,
    getDaySummary,
    addMeal,
    deleteMeal,
    getAllDatesWithMeals,
    deleteAccount,
    getProfile,
    updateProfile,
    getWeightHistory,
    addWeightRecord,
    deleteWeightRecord,
    getFavorites,
    addFavorite,
    deleteFavorite,
    getStreak,
    getWaterGoal,
    setWaterGoal,
    getWaterForDate,
    addWater,
    removeWater,
    getIFSettings,
    setIFSettings,
    getDayNote,
    saveDayNote,
    getTheme,
    setTheme,
    updateMeal
  };
})();
