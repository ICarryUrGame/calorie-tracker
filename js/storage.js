// ============================================
// CALORIE TRACKER — Storage Module (Hybrid API & Local Mode V2)
// Detects file:// or http:// and syncs data to server OR local storage database
// ============================================

const AppStorage = (() => {
  const API_URL = ''; // Relative to served host
  
  // Detect if running on localhost or LAN
  const _isLocalHost = 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.') ||
    window.location.hostname.startsWith('172.');
  
  // If not on local server, or using file://, use local localStorage DB mode
  const _isLocalMode = window.location.protocol === 'file://' || !_isLocalHost;

  // Local memory cache
  let _state = {
    token: localStorage.getItem('ct_token') || null,
    username: localStorage.getItem('ct_username') || null,
    apiKey: '',
    dailyGoal: 2000,
    macroGoals: { protein: 150, carbs: 250, fat: 70 },
    profile: { weight: 0, height: 0, targetWeight: 0 },
    weightHistory: [], // Array of { date, weight }
    favorites: [], // Array of { id, name, calories, protein, carbs, fat }
    meals: {} // Date -> Array of meals
  };

  console.log(`[Storage] Uruchomiono w trybie: ${_isLocalMode ? 'LOKALNYM (file://)' : 'SERWEROWYM (http://)'}`);

  // --- BMR Calorie Calculator ---
  function calculateGoals(weight, height, targetWeight) {
    // Mifflin-St Jeor formula (assuming age 25 for general estimate)
    // BMR = 10*weight + 6.25*height - 5*25 - 5
    let calories = Math.round(10 * weight + 6.25 * height - 130);
    
    // Activity factor multiplier (assumed moderate: 1.35)
    calories = Math.round(calories * 1.35);

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
        _state.profile = user.profile || { weight: 0, height: 0, targetWeight: 0 };
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
        _state.profile = data.profile || { weight: 0, height: 0, targetWeight: 0 };
        _state.weightHistory = data.weightHistory || [];
        _state.favorites = data.favorites || [];
        _state.meals = data.meals || {};
      } catch (e) {
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
        console.error(e);
        throw e;
      }
    }
  }

  // --- Profile, Weight, and Favorites CRUD ---
  function getProfile() {
    return _state.profile || { weight: 0, height: 0, targetWeight: 0 };
  }

  async function updateProfile(weight, height, targetWeight) {
    const updated = {
      weight: parseFloat(weight) || 0,
      height: parseFloat(height) || 0,
      targetWeight: parseFloat(targetWeight) || 0
    };

    // Recalculate calorie goals based on updated profile
    const calculated = calculateGoals(updated.weight, updated.height, updated.targetWeight);
    
    await syncUserData({
      profile: updated,
      dailyGoal: calculated.dailyGoal,
      macroGoals: calculated.macroGoals
    });
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

    // Sort by date descending, then time descending safely (handling legacy records without 'time')
    records.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      const dateCompare = dateB.localeCompare(dateA);
      if (dateCompare !== 0) return dateCompare;
      
      const timeA = a.time || '';
      const timeB = b.time || '';
      return timeB.localeCompare(timeA);
    });

    // Also update main weight in profile
    const profile = { ..._state.profile };
    profile.weight = parseFloat(weight) || 0;

    // Recalculate goals for current weight
    const calculated = calculateGoals(profile.weight, profile.height, profile.targetWeight);

    await syncUserData({
      weightHistory: records,
      profile: profile,
      dailyGoal: calculated.dailyGoal,
      macroGoals: calculated.macroGoals
    });
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

  function getApiKey() { return _state.apiKey; }
  async function setApiKey(key) {
    await syncUserData({ apiKey: key });
  }

  function getMealsForDate(date) {
    const key = _dateKey(date);
    return _state.meals[key] || [];
  }

  function getDaySummary(date) {
    const meals = getMealsForDate(date);
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };

    meals.forEach(meal => {
      totals.calories += meal.total.calories || 0;
      totals.protein += meal.total.protein || 0;
      totals.carbs += meal.total.carbs || 0;
      totals.fat += meal.total.fat || 0;
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

  function _dateKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _generateId() {
    return 'meal_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
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
    deleteFavorite
  };
})();
