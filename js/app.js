// ============================================
// CALORIE TRACKER — App Module (Upgraded V3 - Portion Selector & Calendar)
// Main application logic, routing, auth flows, initialization
// ============================================

const App = (() => {
  let _currentDate = new Date();
  let _currentAIResult = null;
  let _isRegisterMode = false;
  
  let _selectedFavForAdd = null;
  let _selectedSearchMatchForAdd = null;

  // --- Initialization ---
  async function init() {
    _bindGlobalEvents();
    lucide.createIcons();

    if (AppStorage.isAuthenticated()) {
      try {
        UI.showLoading('app', 'Wczytywanie Twoich danych...');
        await AppStorage.fetchUserData();
        _showApp();
      } catch (error) {
        UI.showToast(error.message, 'error');
        _showAuth();
      } finally {
        UI.hideLoading();
      }
    } else {
      _showAuth();
    }
  }

  function _showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
    document.querySelector('.bottom-nav').classList.add('hidden');
    _resetAuthForm();
  }

  function _showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.querySelector('.bottom-nav').classList.remove('hidden');

    const displayUser = document.getElementById('display-username');
    if (displayUser) displayUser.textContent = AppStorage.getUsername();

    UI.showView('view-dashboard');
    _refreshDashboard();
    lucide.createIcons();
  }

  function _resetAuthForm() {
    document.getElementById('auth-username').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-weight').value = '';
    document.getElementById('auth-height').value = '';
    document.getElementById('auth-target-weight').value = '';
    _setRegisterMode(false);
  }

  function _setRegisterMode(isRegister) {
    _isRegisterMode = isRegister;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');
    const registerGoalGroup = document.getElementById('register-goal-group');
    const submitText = document.getElementById('auth-submit-text');

    if (isRegister) {
      title.textContent = 'Stwórz konto';
      subtitle.textContent = 'Zarejestruj się, aby obliczyć optymalne cele i zapisywać posiłki.';
      if (submitText) submitText.textContent = 'Zarejestruj się';
      switchText.textContent = 'Masz już konto?';
      switchBtn.textContent = 'Zaloguj się';
      registerGoalGroup.classList.remove('hidden');
    } else {
      title.textContent = 'Zaloguj się';
      subtitle.textContent = 'Wpisz swoje dane, aby uzyskać dostęp do licznika kalorii i kalkulatora.';
      if (submitText) submitText.textContent = 'Zaloguj się';
      switchText.textContent = 'Nie masz jeszcze konta?';
      switchBtn.textContent = 'Zarejestruj się';
      registerGoalGroup.classList.add('hidden');
    }
    lucide.createIcons();
  }

  // --- Event Bindings ---
  function _bindGlobalEvents() {
    // Auth form submit
    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value.trim();

        const submitBtn = document.getElementById('auth-submit-btn');
        submitBtn.disabled = true;
        
        try {
          if (_isRegisterMode) {
            const weight = parseFloat(document.getElementById('auth-weight').value) || 0;
            const height = parseInt(document.getElementById('auth-height').value) || 0;
            const targetWeight = parseFloat(document.getElementById('auth-target-weight').value) || weight;

            if (weight <= 30 || height <= 100) {
              throw new Error('Proszę podać poprawną wagę i wzrost do kalkulatora.');
            }

            const profileData = { weight, height, targetWeight };
            await AppStorage.register(username, password, profileData);
            UI.showToast('Konto utworzone i zapotrzebowanie wyliczone! 🎉', 'success');
          } else {
            await AppStorage.login(username, password);
            UI.showToast('Zalogowano pomyślnie!', 'success');
          }
          _showApp();
        } catch (error) {
          UI.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    // Switch between Login and Register
    document.getElementById('auth-switch-btn')?.addEventListener('click', () => {
      _setRegisterMode(!_isRegisterMode);
    });

    // Logout
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      AppStorage.logout();
      _showAuth();
      UI.showToast('Wylogowano pomyślnie.', 'info');
    });

    // Bottom Navigation
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.dataset.view;
        if (viewId) {
          UI.showView(viewId);
          if (viewId === 'view-dashboard') _refreshDashboard();
          if (viewId === 'view-history') _refreshHistory();
          if (viewId === 'view-weight') _refreshWeight();
          if (viewId === 'view-settings') UI.loadSettings();
        }
      });
    });

    // Date Navigation
    document.getElementById('date-prev')?.addEventListener('click', () => {
      _currentDate.setDate(_currentDate.getDate() - 1);
      _refreshDashboard();
    });

    document.getElementById('date-next')?.addEventListener('click', () => {
      _currentDate.setDate(_currentDate.getDate() + 1);
      _refreshDashboard();
    });

    document.getElementById('date-label')?.addEventListener('click', () => {
      _currentDate = new Date();
      _refreshDashboard();
    });

    // Action Buttons
    document.getElementById('btn-add-text')?.addEventListener('click', () => {
      _openTextModal();
    });

    document.getElementById('btn-add-manual')?.addEventListener('click', () => {
      _openManualModal();
    });

    document.getElementById('btn-open-favorites')?.addEventListener('click', () => {
      _openFavoritesModal();
    });

    // Text Modal
    document.getElementById('text-modal-close')?.addEventListener('click', () => {
      _closeTextModal();
    });

    document.getElementById('text-analyze-btn')?.addEventListener('click', () => {
      _analyzeText();
    });

    document.getElementById('text-save-btn')?.addEventListener('click', () => {
      _saveTextMeal();
    });

    // Text Modal Portions Add Form
    document.getElementById('btn-search-add-cancel')?.addEventListener('click', () => {
      document.getElementById('search-portion-area').classList.add('hidden');
      _selectedSearchMatchForAdd = null;
    });

    document.getElementById('btn-search-add-submit')?.addEventListener('click', () => {
      _submitSearchMatchAdd();
    });

    // Manual Modal Close and Save
    document.getElementById('manual-modal-close')?.addEventListener('click', () => {
      UI.closeModal('manual-modal');
    });

    document.getElementById('manual-save-btn')?.addEventListener('click', () => {
      _saveManualMeal();
    });

    // Favorites Modal Close & Portion Actions
    document.getElementById('favorites-modal-close')?.addEventListener('click', () => {
      UI.closeModal('favorites-modal');
    });

    document.getElementById('btn-fav-add-cancel')?.addEventListener('click', () => {
      document.getElementById('favorites-portion-area').classList.add('hidden');
      _selectedFavForAdd = null;
    });

    document.getElementById('btn-fav-add-submit')?.addEventListener('click', () => {
      _submitFavoriteAdd();
    });

    // Settings Profile Re-calculation
    document.getElementById('btn-recalculate-goals')?.addEventListener('click', async () => {
      const weight = parseFloat(document.getElementById('setting-weight').value) || 0;
      const height = parseInt(document.getElementById('setting-height').value) || 0;
      const targetWeight = parseFloat(document.getElementById('setting-target-weight').value) || weight;

      if (weight <= 30 || height <= 100) {
        UI.showToast('Proszę podać poprawną wagę i wzrost', 'error');
        return;
      }

      try {
        await AppStorage.updateProfile(weight, height, targetWeight);
        UI.showToast('Cele zostały ponownie obliczone i zapisane! 🔄', 'success');
        UI.loadSettings();
        _refreshDashboard();
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });

    document.getElementById('setting-calorie-goal')?.addEventListener('change', async (e) => {
      try {
        await AppStorage.setDailyGoal(e.target.value);
        UI.showToast('Cel kaloryczny zapisany', 'success');
        _refreshDashboard();
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });

    document.getElementById('setting-protein')?.addEventListener('change', _saveSettingsMacros);
    document.getElementById('setting-carbs')?.addEventListener('change', _saveSettingsMacros);
    document.getElementById('setting-fat')?.addEventListener('change', _saveSettingsMacros);

    const apiKeyInput = document.getElementById('setting-api-key');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('focus', () => {
        if (apiKeyInput.dataset.masked === 'true') {
          apiKeyInput.value = AppStorage.getApiKey();
          apiKeyInput.dataset.masked = 'false';
          apiKeyInput.type = 'text';
        }
      });

      apiKeyInput.addEventListener('change', async () => {
        const key = apiKeyInput.value.trim();
        if (key && key.indexOf('•') === -1) {
          try {
            await AppStorage.setApiKey(key);
            UI.showToast('Klucz API zapisany', 'success');
          } catch (err) {
            UI.showToast(err.message, 'error');
          }
        }
      });

      apiKeyInput.addEventListener('blur', () => {
        const key = AppStorage.getApiKey();
        apiKeyInput.value = key ? '•'.repeat(Math.min(key.length, 30)) : '';
        apiKeyInput.dataset.masked = 'true';
      });
    }

    document.getElementById('btn-clear-data')?.addEventListener('click', async () => {
      if (confirm('Czy na pewno chcesz USUNĄĆ konto? Usunie to wszystkie Twoje dane bezpowrotnie.')) {
        try {
          await AppStorage.deleteAccount();
          UI.showToast('Konto zostało usunięte.', 'info');
          _showAuth();
        } catch (err) {
          UI.showToast(err.message, 'error');
        }
      }
    });

    // Weight Records Save
    document.getElementById('btn-save-weight')?.addEventListener('click', async () => {
      const input = document.getElementById('weight-input');
      const val = parseFloat(input.value);

      if (!val || val < 30 || val > 250) {
        UI.showToast('Proszę podać poprawną wagę (30-250kg)', 'error');
        return;
      }

      try {
        await AppStorage.addWeightRecord(val);
        input.value = '';
        _refreshWeight();
        _refreshDashboard();
        UI.showToast('Waga zapisana i cel zaktualizowany! ⚖️', 'success');
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          const id = overlay.id;
          if (id === 'text-modal') _closeTextModal();
          if (id === 'manual-modal') UI.closeModal('manual-modal');
          if (id === 'favorites-modal') UI.closeModal('favorites-modal');
        }
      });
    });

    // Allow Enter to submit text analysis
    document.getElementById('meal-text-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _analyzeText();
      }
    });
  }

  // --- Dashboard ---
  function _refreshDashboard() {
    const summary = AppStorage.getDaySummary(_currentDate);
    const goal = AppStorage.getDailyGoal();
    const macroGoals = AppStorage.getMacroGoals();

    UI.updateDateLabel(_currentDate);
    UI.updateCalorieRing(summary.totals.calories, goal);
    UI.updateMacroBars(summary.totals, macroGoals);
    UI.renderMealsList(summary.meals, _handleDeleteMeal);
    
    // Render the horizontal weekly calendar strip
    UI.renderCalendarStrip(_currentDate, _goToDate);
  }

  async function _handleDeleteMeal(mealId) {
    try {
      await AppStorage.deleteMeal(_currentDate, mealId);
      _refreshDashboard();
      UI.showToast('Posiłek usunięty', 'info');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Weight Tab ---
  function _refreshWeight() {
    const records = AppStorage.getWeightHistory();
    UI.renderWeightHistory(records, _handleDeleteWeight);
  }

  async function _handleDeleteWeight(recordId) {
    try {
      await AppStorage.deleteWeightRecord(recordId);
      _refreshWeight();
      _refreshDashboard();
      UI.showToast('Pomiar wagi usunięty', 'info');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Favorites Modal ---
  function _openFavoritesModal() {
    document.getElementById('favorites-portion-area').classList.add('hidden');
    _selectedFavForAdd = null;
    _refreshFavoritesList();
    UI.openModal('favorites-modal');
  }

  function _refreshFavoritesList() {
    const list = AppStorage.getFavorites();
    UI.renderFavoritesList(list, _selectFavoriteForAdd, _handleDeleteFavorite);
  }

  function _selectFavoriteForAdd(favId) {
    const favorites = AppStorage.getFavorites();
    const fav = favorites.find(f => f.id === favId);
    if (!fav) return;

    _selectedFavForAdd = fav;
    
    const portionArea = document.getElementById('favorites-portion-area');
    const title = document.getElementById('fav-portion-title');
    const qtyInput = document.getElementById('fav-portion-qty');

    if (title) title.textContent = `${fav.name} (${fav.calories} kcal)`;
    if (qtyInput) qtyInput.value = '1';
    
    if (portionArea) portionArea.classList.remove('hidden');
    qtyInput.focus();
  }

  async function _handleDeleteFavorite(favId) {
    try {
      await AppStorage.deleteFavorite(favId);
      _refreshFavoritesList();
      UI.showToast('Posiłek usunięty z ulubionych', 'info');
      
      if (_selectedFavForAdd && _selectedFavForAdd.id === favId) {
        document.getElementById('favorites-portion-area').classList.add('hidden');
        _selectedFavForAdd = null;
      }
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  async function _submitFavoriteAdd() {
    if (!_selectedFavForAdd) return;

    const qty = parseFloat(document.getElementById('fav-portion-qty').value) || 1;
    if (qty <= 0) {
      UI.showToast('Proszę podać poprawną ilość (np. 1 lub 0.5)', 'error');
      return;
    }

    try {
      const mealData = {
        type: 'manual',
        items: [{
          name: _selectedFavForAdd.name,
          amount: qty === 1 ? '1 porcja' : `${qty} × porcja`,
          calories: Math.round(_selectedFavForAdd.calories * qty),
          protein: Math.round(_selectedFavForAdd.protein * qty),
          carbs: Math.round(_selectedFavForAdd.carbs * qty),
          fat: Math.round(_selectedFavForAdd.fat * qty)
        }],
        total: {
          calories: Math.round(_selectedFavForAdd.calories * qty),
          protein: Math.round(_selectedFavForAdd.protein * qty),
          carbs: Math.round(_selectedFavForAdd.carbs * qty),
          fat: Math.round(_selectedFavForAdd.fat * qty)
        }
      };

      await AppStorage.addMeal(_currentDate, mealData);
      UI.closeModal('favorites-modal');
      _refreshDashboard();
      UI.showToast(`Dodano: ${_selectedFavForAdd.name} x${qty} (${mealData.total.calories} kcal)`, 'success');
      _selectedFavForAdd = null;
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Text Analysis & Local DB ---
  function _openTextModal() {
    _currentAIResult = null;
    _selectedSearchMatchForAdd = null;
    document.getElementById('meal-text-input').value = '';
    document.getElementById('text-result-area').innerHTML = '';
    document.getElementById('search-matches-list').innerHTML = '';
    document.getElementById('search-portion-area').classList.add('hidden');
    document.getElementById('text-save-btn').classList.add('hidden');
    UI.openModal('text-modal');
    setTimeout(() => document.getElementById('meal-text-input')?.focus(), 350);
  }

  function _closeTextModal() {
    UI.closeModal('text-modal');
    _currentAIResult = null;
    _selectedSearchMatchForAdd = null;
  }

  async function _analyzeText() {
    const input = document.getElementById('meal-text-input');
    const text = input.value.trim();
    if (!text) {
      UI.showToast('Wpisz co zjadłeś/aś', 'error');
      return;
    }

    const resultArea = document.getElementById('text-result-area');
    const matchesArea = document.getElementById('search-matches-list');
    const analyzeBtn = document.getElementById('text-analyze-btn');
    const saveBtn = document.getElementById('text-save-btn');

    // Reset portions card
    document.getElementById('search-portion-area').classList.add('hidden');
    _selectedSearchMatchForAdd = null;
    resultArea.innerHTML = '';

    // Search local database for items matching input (like 'jajko')
    const matches = FoodDB.search(text, 5);
    if (matches && matches.length > 0) {
      UI.renderSearchMatches(matches, _selectSearchMatchForAdd);
      UI.showToast('Znaleziono dopasowania w bazie!', 'success');
      
      // Let the user also search via AI if they want
      analyzeBtn.innerHTML = '🤖 Pytaj AI (Gemini)';
      return;
    }

    // Fallback: If no matches or if AI was explicitly clicked
    const apiKey = AppStorage.getApiKey();
    if (apiKey) {
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<div class="loading__spinner" style="width:20px;height:20px;border-width:2px"></div> Szukam...';
      saveBtn.classList.add('hidden');
      matchesArea.innerHTML = '';
      UI.showLoading('text-result-area', '🤖 Pytam AI (Gemini)...');

      try {
        _currentAIResult = await AI.analyzeText(text);
        resultArea.innerHTML = UI.renderAIResult(_currentAIResult);
        saveBtn.classList.remove('hidden');
      } catch (error) {
        resultArea.innerHTML = `
          <div class="meals-empty">
            <div class="meals-empty__icon">❌</div>
            <div class="meals-empty__text">${error.message}<br><span class="text-muted text-xs">Spróbuj wpisać prostszą nazwę lub użyj opcji "Ręcznie"</span></div>
          </div>
        `;
        _currentAIResult = null;
      } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '🔍 Szukaj w bazie / Analizuj';
      }
    } else {
      resultArea.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">🔍</div>
          <div class="meals-empty__text">Nie znaleziono "${text}" w bazie<br>
            <span class="text-muted text-xs">Spróbuj prostszych nazw (np. "jajko", "banan") lub dodaj klucz Gemini API w Ustawieniach, by włączyć sztuczną inteligencję.</span>
          </div>
        </div>
      `;
      _currentAIResult = null;
    }
  }

  function _selectSearchMatchForAdd(match) {
    _selectedSearchMatchForAdd = match;

    const portionArea = document.getElementById('search-portion-area');
    const title = document.getElementById('search-portion-title');
    const qtyInput = document.getElementById('search-portion-qty');

    if (title) title.textContent = `${match.name} (${match.calories} kcal | ${match.portion})`;
    if (qtyInput) qtyInput.value = '1';

    if (portionArea) portionArea.classList.remove('hidden');
    qtyInput.focus();
  }

  async function _submitSearchMatchAdd() {
    if (!_selectedSearchMatchForAdd) return;

    const qty = parseFloat(document.getElementById('search-portion-qty').value) || 1;
    if (qty <= 0) {
      UI.showToast('Proszę podać poprawną ilość (np. 1 lub 0.5)', 'error');
      return;
    }

    try {
      const mealData = {
        type: 'text',
        items: [{
          name: _selectedSearchMatchForAdd.name,
          amount: qty === 1 ? _selectedSearchMatchForAdd.portion : `${qty} × ${_selectedSearchMatchForAdd.portion}`,
          calories: Math.round(_selectedSearchMatchForAdd.calories * qty),
          protein: Math.round(_selectedSearchMatchForAdd.protein * qty),
          carbs: Math.round(_selectedSearchMatchForAdd.carbs * qty),
          fat: Math.round(_selectedSearchMatchForAdd.fat * qty)
        }],
        total: {
          calories: Math.round(_selectedSearchMatchForAdd.calories * qty),
          protein: Math.round(_selectedSearchMatchForAdd.protein * qty),
          carbs: Math.round(_selectedSearchMatchForAdd.carbs * qty),
          fat: Math.round(_selectedSearchMatchForAdd.fat * qty)
        }
      };

      await AppStorage.addMeal(_currentDate, mealData);
      UI.closeModal('text-modal');
      _refreshDashboard();
      UI.showToast(`Dodano: ${_selectedSearchMatchForAdd.name} x${qty} (${mealData.total.calories} kcal)`, 'success');
      _selectedSearchMatchForAdd = null;
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  async function _saveTextMeal() {
    if (!_currentAIResult) return;

    try {
      await AppStorage.addMeal(_currentDate, {
        type: 'text',
        items: _currentAIResult.items,
        total: _currentAIResult.total,
      });

      _closeTextModal();
      _refreshDashboard();
      UI.showToast(`Dodano posiłek: ${_currentAIResult.total.calories} kcal`, 'success');
      _currentAIResult = null;
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Manual Entry ---
  function _openManualModal() {
    document.getElementById('manual-name').value = '';
    document.getElementById('manual-calories').value = '';
    document.getElementById('manual-protein').value = '';
    document.getElementById('manual-carbs').value = '';
    document.getElementById('manual-fat').value = '';
    
    const favCheck = document.getElementById('manual-fav-check');
    if (favCheck) favCheck.checked = false;

    UI.openModal('manual-modal');
    setTimeout(() => document.getElementById('manual-name')?.focus(), 350);
  }

  async function _saveManualMeal() {
    const name = document.getElementById('manual-name').value.trim();
    const calories = parseInt(document.getElementById('manual-calories').value) || 0;
    const protein = parseInt(document.getElementById('manual-protein').value) || 0;
    const carbs = parseInt(document.getElementById('manual-carbs').value) || 0;
    const fat = parseInt(document.getElementById('manual-fat').value) || 0;
    const isFav = document.getElementById('manual-fav-check')?.checked || false;

    if (!name) {
      UI.showToast('Wpisz nazwę posiłku', 'error');
      return;
    }
    if (calories <= 0) {
      UI.showToast('Wpisz ilość kalorii', 'error');
      return;
    }

    try {
      const mealItem = {
        name: name,
        amount: '1 porcja',
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
      };

      await AppStorage.addMeal(_currentDate, {
        type: 'manual',
        items: [mealItem],
        total: { calories, protein, carbs, fat },
      });

      if (isFav) {
        try {
          await AppStorage.addFavorite(mealItem);
          UI.showToast('Dodano posiłek i zapisano do Ulubionych! ⭐', 'success');
        } catch (e) {
          UI.showToast(e.message, 'info');
        }
      } else {
        UI.showToast(`Dodano: ${name} (${calories} kcal)`, 'success');
      }

      UI.closeModal('manual-modal');
      _refreshDashboard();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- History ---
  function _refreshHistory() {
    const dates = AppStorage.getAllDatesWithMeals();
    const goal = AppStorage.getDailyGoal();
    UI.renderHistory(dates, goal, _goToDate);
  }

  function _goToDate(dateStr) {
    const parts = dateStr.split('-');
    _currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    UI.showView('view-dashboard');
    _refreshDashboard();
  }

  // --- Settings ---
  async function _saveSettingsMacros() {
    const protein = document.getElementById('setting-protein')?.value || 0;
    const carbs = document.getElementById('setting-carbs')?.value || 0;
    const fat = document.getElementById('setting-fat')?.value || 0;
    try {
      await AppStorage.setMacroGoals({ protein, carbs, fat });
      UI.showToast('Cele makroskładników zapisane', 'success');
      _refreshDashboard();
    } catch (err) {
      UI.showToast(err.message, 'error');
    }
  }

  return { init };
})();

// --- Start App ---
document.addEventListener('DOMContentLoaded', App.init);
