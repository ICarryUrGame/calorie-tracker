// ============================================
// CALORIE TRACKER — Storage Module (Hybrid API & Local Mode)
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
    meals: {} // Date -> Array of meals
  };

  console.log(`[Storage] Uruchomiono w trybie: ${_isLocalMode ? 'LOKALNYM (file://)' : 'SERWEROWYM (http://)'}`);

  // --- Auth API ---
  async function register(username, password, initialGoal = 2000) {
    username = username.trim().lower();
    password = password.trim();

    if (username.length < 3 || password.length < 4) {
      throw new Error('Nazwa użytkownika musi mieć min. 3 znaki, a hasło min. 4 znaki.');
    }

    if (_isLocalMode) {
      // --- Local database in localStorage ---
      const users = _getLocalUsers();
      if (users[username]) {
        throw new Error('Użytkownik o takiej nazwie już istnieje.');
      }

      // Simple secure hash simulation for offline safety
      const passwordHash = _simpleHash(password);
      
      users[username] = {
        username: username,
        passwordHash: passwordHash,
        dailyGoal: initialGoal,
        macroGoals: { protein: Math.round(initialGoal * 0.3 / 4), carbs: Math.round(initialGoal * 0.45 / 4), fat: Math.round(initialGoal * 0.25 / 9) },
        apiKey: '',
        meals: {}
      };

      _saveLocalUsers(users);
      _setSession(`local:${username}`, username);
      await fetchUserData();
      return { success: true };
    } else {
      // --- Server API ---
      try {
        const res = await fetch(`${API_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Błąd rejestracji');

        _setSession(data.token, data.user.username);
        
        await syncUserData({
          dailyGoal: initialGoal,
          macroGoals: { protein: Math.round(initialGoal * 0.3 / 4), carbs: Math.round(initialGoal * 0.45 / 4), fat: Math.round(initialGoal * 0.25 / 9) }
        });

        await fetchUserData();
        return { success: true };
      } catch (e) {
        // Fallback to local mode if server is down
        console.warn('Server registration failed, switching to local database fallback...', e.message);
        throw e;
      }
    }
  }

  async function login(username, password) {
    username = username.trim().lower();
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
      // Load from local localStorage database
      const users = _getLocalUsers();
      const user = users[_state.username];
      if (user) {
        _state.dailyGoal = user.dailyGoal || 2000;
        _state.macroGoals = user.macroGoals || { protein: 150, carbs: 250, fat: 70 };
        _state.apiKey = user.apiKey || '';
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
        
        users[_state.username] = user;
        _saveLocalUsers(users);
      }
      
      // Update state cache
      if (updates.dailyGoal !== undefined) _state.dailyGoal = updates.dailyGoal;
      if (updates.macroGoals !== undefined) _state.macroGoals = updates.macroGoals;
      if (updates.apiKey !== undefined) _state.apiKey = updates.apiKey;
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
        
        // Update local state cache
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

      // Update state cache
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
    // Basic browser-side string hashing for local database separation
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
    deleteAccount
  };
})();
