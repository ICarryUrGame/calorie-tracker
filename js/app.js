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

  let _calendarActiveYear = null;
  let _calendarActiveMonth = null;

  let _currentPhotoData = null;
  let _currentPhotoResult = null;

  // Chart instances
  let _chartWeightInstance = null;
  let _chartCaloriesInstance = null;
  let _chartMacrosInstance = null;
  let _currentBarcodeProduct = null;

  // --- Initialization ---
  async function init() {
    _bindGlobalEvents();
    lucide.createIcons();

    // Unregister Service Workers and clear caches to immediately bypass caching issues
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then(keys => {
        for (let key of keys) {
          caches.delete(key);
        }
      });
    }

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
    // Remove active from all views first
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show auth screen
    const authScreen = document.getElementById('auth-screen');
    authScreen.classList.remove('hidden');
    authScreen.classList.add('active');
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

    // Set Theme
    const theme = AppStorage.getTheme();
    document.documentElement.setAttribute('data-theme', theme);

    // Fasting Widget Auto Refresh
    setInterval(UI.renderIFWidget, 1000);

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

    document.querySelectorAll('.bottom-nav__item').forEach(item => {
      item.addEventListener('click', () => {
        const viewId = item.dataset.view;
        if (viewId) {
          UI.showView(viewId);
          if (viewId === 'view-dashboard') _refreshDashboard();
          if (viewId === 'view-stats') _refreshStats();
          if (viewId === 'view-calendar') _refreshCalendar();
          if (viewId === 'view-weight') _refreshWeight();
          if (viewId === 'view-achievements') _refreshAchievements();
          if (viewId === 'view-settings') _loadSettingsView();
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

    // Photo Modal
    document.getElementById('btn-add-photo')?.addEventListener('click', () => {
      _openPhotoModal();
    });

    document.getElementById('photo-modal-close')?.addEventListener('click', () => {
      _closePhotoModal();
    });

    document.getElementById('photo-upload-area')?.addEventListener('click', () => {
      document.getElementById('photo-file-input')?.click();
    });

    // Drag and drop
    const uploadArea = document.getElementById('photo-upload-area');
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--accent-purple)'; });
      uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = 'var(--border-glass)'; });
      uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--border-glass)'; if (e.dataTransfer.files[0]) _handlePhotoFile(e.dataTransfer.files[0]); });
    }

    document.getElementById('photo-file-input')?.addEventListener('change', (e) => {
      if (e.target.files[0]) _handlePhotoFile(e.target.files[0]);
    });

    document.getElementById('photo-change-btn')?.addEventListener('click', () => {
      document.getElementById('photo-preview-area').classList.add('hidden');
      document.getElementById('photo-upload-area').classList.remove('hidden');
      document.getElementById('photo-analyze-btn').classList.add('hidden');
      document.getElementById('photo-result-area').innerHTML = '';
      document.getElementById('photo-save-btn').classList.add('hidden');
      _currentPhotoData = null;
      document.getElementById('photo-file-input').value = '';
    });

    document.getElementById('photo-analyze-btn')?.addEventListener('click', () => {
      _analyzePhoto();
    });

    document.getElementById('photo-save-btn')?.addEventListener('click', () => {
      _savePhotoMeal();
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

    // Monthly Calendar Navigation
    document.getElementById('calendar-prev-month')?.addEventListener('click', () => {
      _calendarPrevMonth();
    });

    document.getElementById('calendar-next-month')?.addEventListener('click', () => {
      _calendarNextMonth();
    });

    document.getElementById('calendar-month-label')?.addEventListener('click', () => {
      if (_calendarActiveYear === null) {
        _calendarActiveYear = _currentDate.getFullYear();
        _calendarActiveMonth = _currentDate.getMonth();
      }
      document.getElementById('month-picker-select').value = _calendarActiveMonth;
      document.getElementById('year-picker-select').value = _calendarActiveYear;
      UI.openModal('month-picker-modal');
    });

    document.getElementById('month-picker-close')?.addEventListener('click', () => {
      UI.closeModal('month-picker-modal');
    });

    document.getElementById('btn-submit-month-picker')?.addEventListener('click', () => {
      _calendarActiveMonth = parseInt(document.getElementById('month-picker-select').value);
      _calendarActiveYear = parseInt(document.getElementById('year-picker-select').value);
      UI.closeModal('month-picker-modal');
      _refreshCalendar();
    });

    // Settings Profile Re-calculation
    document.getElementById('btn-recalculate-goals')?.addEventListener('click', async () => {
      const weight = parseFloat(document.getElementById('setting-weight').value) || 0;
      const height = parseInt(document.getElementById('setting-height').value) || 0;
      const targetWeight = parseFloat(document.getElementById('setting-target-weight').value) || weight;
      const exerciseDays = document.getElementById('setting-exercise-days')?.value || '0';
      const activeLifestyle = document.getElementById('setting-active-lifestyle')?.value || 'sedentary';
      const manualGoals = document.getElementById('setting-manual-goals')?.checked || false;

      if (weight <= 30 || height <= 100) {
        UI.showToast('Proszę podać poprawną wagę i wzrost', 'error');
        return;
      }

      try {
        await AppStorage.updateProfile(weight, height, targetWeight, exerciseDays, activeLifestyle, manualGoals);
        UI.showToast('Dane metryki zostały zapisane, a cele BMR zaktualizowane! 💾', 'success');
        _loadSettingsView();
        _refreshDashboard();
      } catch (err) {
        UI.showToast(err.message, 'error');
      }
    });

    const _autoSaveProfile = async () => {
      const weight = parseFloat(document.getElementById('setting-weight').value) || 0;
      const height = parseInt(document.getElementById('setting-height').value) || 0;
      const targetWeight = parseFloat(document.getElementById('setting-target-weight').value) || weight;
      const exerciseDays = document.getElementById('setting-exercise-days')?.value || '0';
      const activeLifestyle = document.getElementById('setting-active-lifestyle')?.value || 'sedentary';
      const manualGoals = document.getElementById('setting-manual-goals')?.checked || false;

      if (weight > 30 && height > 100) {
        try {
          await AppStorage.updateProfile(weight, height, targetWeight, exerciseDays, activeLifestyle, manualGoals);
          _refreshDashboard();
        } catch (e) {
          console.error(e);
        }
      }
    };

    document.getElementById('setting-weight')?.addEventListener('change', _autoSaveProfile);
    document.getElementById('setting-height')?.addEventListener('change', _autoSaveProfile);
    document.getElementById('setting-target-weight')?.addEventListener('change', _autoSaveProfile);
    document.getElementById('setting-exercise-days')?.addEventListener('change', _autoSaveProfile);
    document.getElementById('setting-active-lifestyle')?.addEventListener('change', _autoSaveProfile);
    document.getElementById('setting-manual-goals')?.addEventListener('change', _autoSaveProfile);

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

    // Water Tracker Click Events
    document.getElementById('btn-water-plus')?.addEventListener('click', async () => {
      await AppStorage.addWater(_currentDate);
      Gamification.addXP('addWater');
      _refreshDashboard();
      
      // Check Achievements
      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }
    });

    document.getElementById('btn-water-minus')?.addEventListener('click', async () => {
      await AppStorage.removeWater(_currentDate);
      _refreshDashboard();
    });

    // Barcode Scanner Events
    document.getElementById('btn-add-barcode')?.addEventListener('click', () => {
      document.getElementById('barcode-input').value = '';
      document.getElementById('barcode-result-card').classList.add('hidden');
      _stopBarcodeCamera();
      UI.openModal('barcode-modal');
    });

    document.getElementById('barcode-modal-close')?.addEventListener('click', () => {
      _stopBarcodeCamera();
      UI.closeModal('barcode-modal');
    });

    document.getElementById('btn-toggle-barcode-camera')?.addEventListener('click', () => {
      _toggleBarcodeCamera();
    });

    document.getElementById('btn-barcode-lookup')?.addEventListener('click', () => {
      _lookupBarcode();
    });

    document.getElementById('btn-barcode-add-submit')?.addEventListener('click', () => {
      _submitBarcodeAdd();
    });

    document.getElementById('barcode-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        _lookupBarcode();
      }
    });

    // IF Settings Changes
    document.getElementById('setting-if-enabled')?.addEventListener('change', async (e) => {
      const enabled = e.target.checked;
      const protocol = document.getElementById('setting-if-protocol').value;
      const startHour = parseInt(document.getElementById('setting-if-start').value) || 12;
      await AppStorage.setIFSettings({ enabled, protocol, startHour });
      UI.showToast('Ustawienia IF zapisane', 'success');
      _refreshDashboard();
    });

    document.getElementById('setting-if-protocol')?.addEventListener('change', async (e) => {
      const enabled = document.getElementById('setting-if-enabled').checked;
      const protocol = e.target.value;
      const startHour = parseInt(document.getElementById('setting-if-start').value) || 12;
      await AppStorage.setIFSettings({ enabled, protocol, startHour });
      UI.showToast('Protokół IF zapisany', 'success');
      _refreshDashboard();
    });

    document.getElementById('setting-if-start')?.addEventListener('change', async (e) => {
      const enabled = document.getElementById('setting-if-enabled').checked;
      const protocol = document.getElementById('setting-if-protocol').value;
      const startHour = parseInt(e.target.value) || 12;
      await AppStorage.setIFSettings({ enabled, protocol, startHour });
      UI.showToast('Godzina startu IF zapisana', 'success');
      _refreshDashboard();
    });



    // CSV Export
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      _exportCSV();
    });

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          const id = overlay.id;
          if (id === 'text-modal') _closeTextModal();
          if (id === 'manual-modal') UI.closeModal('manual-modal');
          if (id === 'favorites-modal') UI.closeModal('favorites-modal');
          if (id === 'photo-modal') _closePhotoModal();
          if (id === 'barcode-modal') {
            _stopBarcodeCamera();
            UI.closeModal('barcode-modal');
          }
          if (id === 'month-picker-modal') UI.closeModal('month-picker-modal');
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

    const _bindAIEditListeners = (containerId, isPhoto = false) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.addEventListener('input', (e) => {
        const result = isPhoto ? _currentPhotoResult : _currentAIResult;
        if (!result || !result.items) return;

        const itemsElements = container.querySelectorAll('.ai-result__item');
        itemsElements.forEach(el => {
          const idx = parseInt(el.dataset.index);
          if (isNaN(idx) || !result.items[idx]) return;

          const name = el.querySelector('.ai-item-name-input')?.value || '';
          const amount = el.querySelector('.ai-item-amount-input')?.value || '';
          const calories = Math.max(0, parseInt(el.querySelector('.ai-item-cal-input')?.value) || 0);
          const protein = Math.max(0, parseInt(el.querySelector('.ai-item-protein-input')?.value) || 0);
          const carbs = Math.max(0, parseInt(el.querySelector('.ai-item-carbs-input')?.value) || 0);
          const fat = Math.max(0, parseInt(el.querySelector('.ai-item-fat-input')?.value) || 0);

          result.items[idx] = { name, amount, calories, protein, carbs, fat };
        });

        // Recalculate totals
        result.total = {
          calories: result.items.reduce((sum, i) => sum + i.calories, 0),
          protein: result.items.reduce((sum, i) => sum + i.protein, 0),
          carbs: result.items.reduce((sum, i) => sum + i.carbs, 0),
          fat: result.items.reduce((sum, i) => sum + i.fat, 0),
        };

        // Update display values directly (without re-rendering inputs to avoid focus loss!)
        const prefix = isPhoto ? 'photo' : 'text';
        const calEl = document.getElementById(`${prefix}-total-calories`);
        const proteinEl = document.getElementById(`${prefix}-total-protein`);
        const carbsEl = document.getElementById(`${prefix}-total-carbs`);
        const fatEl = document.getElementById(`${prefix}-total-fat`);

        if (calEl) calEl.textContent = `${result.total.calories} kcal`;
        if (proteinEl) proteinEl.textContent = `${result.total.protein}g`;
        if (carbsEl) carbsEl.textContent = `${result.total.carbs}g`;
        if (fatEl) fatEl.textContent = `${result.total.fat}g`;
      });
    };

    _bindAIEditListeners('text-result-area', false);
    _bindAIEditListeners('photo-result-area', true);
  }

  // --- Dashboard ---
  function _refreshDashboard() {
    const summary = AppStorage.getDaySummary(_currentDate);
    const goal = AppStorage.getDailyGoal();
    const macroGoals = AppStorage.getMacroGoals();

    UI.updateDateLabel(_currentDate);
    UI.updateCalorieRing(summary.totals.calories, goal);
    UI.updateMacroBars(summary.totals, macroGoals);
    UI.renderMealsList(summary.meals, _handleDeleteMeal, _handleEditMeal);
    
    // Render the horizontal weekly calendar strip
    UI.renderCalendarStrip(_currentDate, _goToDate);

    // Update the streak flame badge
    const streak = AppStorage.getStreak();
    UI.updateStreak(streak);



    // Weekly Report
    UI.renderWeeklyReport();

    // XP/Levels progress on Dash
    const gam = Gamification.getGamificationData();
    const info = Gamification.getLevelInfo(gam.xp);
    const dashLevel = document.getElementById('dash-level');
    const dashXpFill = document.getElementById('dash-xp-fill');
    const dashXpTxt = document.getElementById('dash-xp-txt');
    if (dashLevel) dashLevel.textContent = info.level;
    if (dashXpFill) dashXpFill.style.width = `${info.progress * 100}%`;
    if (dashXpTxt) dashXpTxt.textContent = `${gam.xp} XP`;
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

    // Refresh BMI card
    const profile = AppStorage.getProfile();
    const currentWeight = records.length > 0 ? records[0].weight : profile.weight;
    UI.renderBMICard(currentWeight, profile.height);
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

      Gamification.addXP('addMeal');
      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }

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
    const isAIForced = analyzeBtn.innerHTML.includes('Pytaj AI') || analyzeBtn.innerHTML.includes('Gemini');
    if (matches && matches.length > 0 && !isAIForced) {
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
        resultArea.innerHTML = UI.renderAIResult(_currentAIResult, 'text');
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

      Gamification.addXP('addMeal');
      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }

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
      const items = _currentAIResult.items || [];
      const total = _currentAIResult.total || {
        calories: items.reduce((sum, i) => sum + (i.calories || 0), 0),
        protein: items.reduce((sum, i) => sum + (i.protein || 0), 0),
        carbs: items.reduce((sum, i) => sum + (i.carbs || 0), 0),
        fat: items.reduce((sum, i) => sum + (i.fat || 0), 0),
      };

      await AppStorage.addMeal(_currentDate, {
        type: 'text',
        items: items,
        total: total,
      });

      Gamification.addXP('addMeal');
      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }

      _closeTextModal();
      _refreshDashboard();
      UI.showToast(`Dodano posiłek: ${total.calories} kcal`, 'success');
      _currentAIResult = null;
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Manual Entry ---

  // --- Photo Analysis ---
  function _openPhotoModal() {
    _currentPhotoData = null;
    _currentPhotoResult = null;
    document.getElementById('photo-upload-area').classList.remove('hidden');
    document.getElementById('photo-preview-area').classList.add('hidden');
    document.getElementById('photo-analyze-btn').classList.add('hidden');
    document.getElementById('photo-result-area').innerHTML = '';
    document.getElementById('photo-save-btn').classList.add('hidden');
    const fileInput = document.getElementById('photo-file-input');
    if (fileInput) fileInput.value = '';
    UI.openModal('photo-modal');
    lucide.createIcons();
  }

  function _closePhotoModal() {
    UI.closeModal('photo-modal');
    _currentPhotoData = null;
    _currentPhotoResult = null;
  }

  async function _handlePhotoFile(file) {
    try {
      const base64 = await Camera.processFileUpload(file);
      _currentPhotoData = base64;

      // Show preview
      const previewImg = document.getElementById('photo-preview-img');
      previewImg.src = base64;
      document.getElementById('photo-upload-area').classList.add('hidden');
      document.getElementById('photo-preview-area').classList.remove('hidden');
      document.getElementById('photo-analyze-btn').classList.remove('hidden');
      document.getElementById('photo-result-area').innerHTML = '';
      document.getElementById('photo-save-btn').classList.add('hidden');
      _currentPhotoResult = null;
      lucide.createIcons();
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  async function _analyzePhoto() {
    if (!_currentPhotoData) {
      UI.showToast('Najpierw dodaj zdjęcie', 'error');
      return;
    }

    const analyzeBtn = document.getElementById('photo-analyze-btn');
    const resultArea = document.getElementById('photo-result-area');
    const saveBtn = document.getElementById('photo-save-btn');

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<div class="loading__spinner" style="width:20px;height:20px;border-width:2px"></div> Analizuję...';
    saveBtn.classList.add('hidden');
    UI.showLoading('photo-result-area', '🤖 Analizuję zdjęcie z AI...');

    try {
      _currentPhotoResult = await AI.analyzeImage(_currentPhotoData);
      resultArea.innerHTML = UI.renderAIResult(_currentPhotoResult, 'photo');
      saveBtn.classList.remove('hidden');
    } catch (error) {
      resultArea.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">❌</div>
          <div class="meals-empty__text">${error.message}<br><span class="text-muted text-xs">Spróbuj ponownie lub użyj opcji "Ręcznie"</span></div>
        </div>
      `;
      _currentPhotoResult = null;
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<i data-lucide="sparkles"></i> <span>🤖 Analizuj z AI (Gemini)</span>';
      lucide.createIcons();
    }
  }

  async function _savePhotoMeal() {
    if (!_currentPhotoResult) return;

    try {
      const items = _currentPhotoResult.items || [];
      const total = _currentPhotoResult.total || {
        calories: items.reduce((sum, i) => sum + (i.calories || 0), 0),
        protein: items.reduce((sum, i) => sum + (i.protein || 0), 0),
        carbs: items.reduce((sum, i) => sum + (i.carbs || 0), 0),
        fat: items.reduce((sum, i) => sum + (i.fat || 0), 0),
      };

      await AppStorage.addMeal(_currentDate, {
        type: 'photo',
        items: items,
        total: total,
      });

      Gamification.addXP('addMeal');
      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }

      _closePhotoModal();
      _refreshDashboard();
      UI.showToast(`Dodano posiłek ze zdjęcia: ${total.calories} kcal`, 'success');
      _currentPhotoResult = null;
      _currentPhotoData = null;
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Manual Entry (continued) ---
  let _editingMealId = null;

  function _handleEditMeal(mealId) {
    _editingMealId = mealId;
    const summary = AppStorage.getDaySummary(_currentDate);
    const meal = summary.meals.find(m => m.id === mealId);
    if (!meal) return;

    document.getElementById('manual-name').value = meal.items.map(i => i.name).join(', ');
    document.getElementById('manual-calories').value = meal.total.calories;
    document.getElementById('manual-protein').value = meal.total.protein;
    document.getElementById('manual-carbs').value = meal.total.carbs;
    document.getElementById('manual-fat').value = meal.total.fat;

    const favCheck = document.getElementById('manual-fav-check');
    if (favCheck) favCheck.checked = false;

    UI.openModal('manual-modal');
  }

  function _openManualModal() {
    _editingMealId = null;
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

      if (_editingMealId) {
        await AppStorage.updateMeal(_currentDate, _editingMealId, {
          items: [mealItem],
          total: { calories, protein, carbs, fat }
        });
        _editingMealId = null;
        UI.showToast(`Zaktualizowano posiłek: ${name}`, 'success');
      } else {
        await AppStorage.addMeal(_currentDate, {
          type: 'manual',
          items: [mealItem],
          total: { calories, protein, carbs, fat },
        });

        Gamification.addXP('addMeal');

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
      }

      UI.closeModal('manual-modal');
      _refreshDashboard();

      // Check Achievements
      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Monthly Calendar Tab ---
  function _refreshCalendar() {
    if (_calendarActiveYear === null) {
      _calendarActiveYear = _currentDate.getFullYear();
      _calendarActiveMonth = _currentDate.getMonth();
    }
    UI.renderMonthlyCalendar(_calendarActiveYear, _calendarActiveMonth, _currentDate, _goToDate);
    UI.renderMonthSummary(_calendarActiveYear, _calendarActiveMonth);
    
    // Render the history list directly beneath the monthly calendar
    const dates = AppStorage.getAllDatesWithMeals();
    const goal = AppStorage.getDailyGoal();
    UI.renderHistory(dates, goal, _goToDate);
  }

  function _calendarPrevMonth() {
    _calendarActiveMonth--;
    if (_calendarActiveMonth < 0) {
      _calendarActiveMonth = 11;
      _calendarActiveYear--;
    }
    _refreshCalendar();
  }

  function _calendarNextMonth() {
    _calendarActiveMonth++;
    if (_calendarActiveMonth > 11) {
      _calendarActiveMonth = 0;
      _calendarActiveYear++;
    }
    _refreshCalendar();
  }

  function _goToDate(dateStr) {
    const parts = dateStr.split('-');
    _currentDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    _calendarActiveYear = _currentDate.getFullYear();
    _calendarActiveMonth = _currentDate.getMonth();
    UI.showView('view-dashboard');
    _refreshDashboard();
  }

  // --- Statistics View (Chart.js) ---
  function _refreshStats() {
    const today = new Date();
    
    const allDates = AppStorage.getAllDatesWithMeals();
    const goal = AppStorage.getDailyGoal();
    let sumKcal = 0;
    let daysWithMeals = 0;
    let daysInGoal = 0;
    
    allDates.forEach(d => {
      const summary = AppStorage.getDaySummary(new Date(d));
      const kcal = summary.totals.calories;
      if (kcal > 0) {
        sumKcal += kcal;
        daysWithMeals++;
        if (kcal <= goal) daysInGoal++;
      }
    });
    
    const avgKcal = daysWithMeals > 0 ? Math.round(sumKcal / daysWithMeals) : 0;
    
    const avgEl = document.getElementById('stats-avg-cal');
    const goalEl = document.getElementById('stats-days-goal');
    if (avgEl) avgEl.textContent = `${avgKcal} kcal`;
    if (goalEl) goalEl.textContent = `${daysInGoal} / ${daysWithMeals}`;

    // Weight Line Chart
    const weightHistory = [...AppStorage.getWeightHistory()].reverse();
    const profile = AppStorage.getProfile();
    const targetWeight = profile.targetWeight || 0;
    
    const canvasWeight = document.getElementById('chart-weight');
    if (canvasWeight) {
      if (_chartWeightInstance) _chartWeightInstance.destroy();
      
      const labels = weightHistory.map(w => w.date.substring(5));
      const weights = weightHistory.map(w => w.weight);
      const targetLine = new Array(labels.length).fill(targetWeight);

      _chartWeightInstance = new Chart(canvasWeight, {
        type: 'line',
        data: {
          labels: labels.length > 0 ? labels : ['Brak'],
          datasets: [
            {
              label: 'Waga (kg)',
              data: weights.length > 0 ? weights : [0],
              borderColor: '#8c52ff',
              backgroundColor: 'rgba(140, 82, 255, 0.1)',
              tension: 0.3,
              fill: true
            },
            {
              label: 'Cel (kg)',
              data: targetLine.length > 0 ? targetLine : [0],
              borderColor: '#ff4a5a',
              borderDash: [5, 5],
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a5a5c5' } },
            x: { grid: { display: false }, ticks: { color: '#a5a5c5' } }
          }
        }
      });
    }

    // Calories Bar Chart
    const canvasCalories = document.getElementById('chart-calories');
    if (canvasCalories) {
      if (_chartCaloriesInstance) _chartCaloriesInstance.destroy();
      
      const calorieLabels = [];
      const calorieData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString('pl-PL', { weekday: 'short' });
        const summary = AppStorage.getDaySummary(d);
        calorieLabels.push(dayStr);
        calorieData.push(summary.totals.calories);
      }

      _chartCaloriesInstance = new Chart(canvasCalories, {
        type: 'line',
        data: {
          labels: calorieLabels,
          datasets: [
            {
              label: 'Spożyte kalorie',
              data: calorieData,
              borderColor: '#00f076',
              backgroundColor: 'rgba(0, 240, 118, 0.1)',
              tension: 0.3,
              fill: true
            },
            {
              label: 'Cel kaloryczny',
              data: new Array(calorieLabels.length).fill(goal),
              borderColor: '#ff4a5a',
              borderDash: [5, 5],
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a5a5c5' } },
            x: { grid: { display: false }, ticks: { color: '#a5a5c5' } }
          }
        }
      });
    }

    // Macros Doughnut Chart
    const canvasMacros = document.getElementById('chart-macros');
    if (canvasMacros) {
      if (_chartMacrosInstance) _chartMacrosInstance.destroy();
      
      let totalP = 0, totalC = 0, totalF = 0;
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const summary = AppStorage.getDaySummary(d);
        totalP += summary.totals.protein || 0;
        totalC += summary.totals.carbs || 0;
        totalF += summary.totals.fat || 0;
      }

      _chartMacrosInstance = new Chart(canvasMacros, {
        type: 'doughnut',
        data: {
          labels: ['Białko', 'Węgle', 'Tłuszcz'],
          datasets: [{
            data: [totalP, totalC, totalF],
            backgroundColor: ['#3d8bff', '#ff9100', '#ffdb3d'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#a5a5c5', font: { size: 10 } } } }
        }
      });
    }
  }

  // --- Achievements View ---
  function _refreshAchievements() {
    UI.renderAchievements();
  }

  // --- Settings View ---
  function _loadSettingsView() {
    UI.loadSettings();

    const profile = AppStorage.getProfile();
    const exerciseDaysSelect = document.getElementById('setting-exercise-days');
    const activeLifestyleSelect = document.getElementById('setting-active-lifestyle');
    const manualGoalsCheck = document.getElementById('setting-manual-goals');

    if (exerciseDaysSelect) exerciseDaysSelect.value = profile.exerciseDays || '0';
    if (activeLifestyleSelect) activeLifestyleSelect.value = profile.activeLifestyle || 'sedentary';
    if (manualGoalsCheck) manualGoalsCheck.checked = !!profile.manualGoals;

  }

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

  // --- Day Notes & Mood View ---
  let _isNotesBindingSet = false;
  function _loadDayNoteView() {
    const note = AppStorage.getDayNote(_currentDate);
    const textarea = document.getElementById('day-note-text');
    if (textarea) textarea.value = note.text;

    document.querySelectorAll('#mood-selector .mood-btn').forEach(btn => {
      btn.classList.remove('selected');
      if (btn.dataset.mood === note.mood) {
        btn.classList.add('selected');
      }
    });

    if (!_isNotesBindingSet) {
      _isNotesBindingSet = true;
      
      textarea?.addEventListener('change', async () => {
        const text = textarea.value;
        const currentMood = document.querySelector('#mood-selector .mood-btn.selected')?.dataset.mood || '';
        const currentNote = AppStorage.getDayNote(_currentDate);
        await AppStorage.saveDayNote(_currentDate, text, currentMood, currentNote.energy);
      });

      document.querySelectorAll('#mood-selector .mood-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          document.querySelectorAll('#mood-selector .mood-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          const mood = btn.dataset.mood;
          const text = document.getElementById('day-note-text')?.value || '';
          const currentNote = AppStorage.getDayNote(_currentDate);
          await AppStorage.saveDayNote(_currentDate, text, mood, currentNote.energy);
          
          Gamification.addXP('addWater');
          _refreshDashboard();
        });
      });
    }
  }

  // --- Barcode Scanner Logic ---
  async function _lookupBarcode() {
    const input = document.getElementById('barcode-input');
    const lookupBtn = document.getElementById('btn-barcode-lookup');
    const resultCard = document.getElementById('barcode-result-card');
    const statusArea = document.getElementById('barcode-status-area');

    const barcode = input.value.trim();
    if (!barcode) {
      UI.showToast('Wpisz kod kreskowy najpierw', 'error');
      return;
    }

    lookupBtn.disabled = true;
    lookupBtn.innerHTML = 'Szukam...';
    resultCard.classList.add('hidden');
    statusArea.textContent = 'Szukam produktu w bazie OpenFoodFacts...';

    try {
      const prod = await Scanner.lookupBarcode(barcode);
      _currentBarcodeProduct = prod;

      document.getElementById('barcode-prod-name').textContent = prod.name;
      document.getElementById('barcode-prod-brand').textContent = prod.brand || 'Brak marki';
      document.getElementById('barcode-prod-kcal').textContent = `${prod.calories} kcal`;
      document.getElementById('barcode-prod-portion').textContent = prod.portion || '100g';
      document.getElementById('barcode-prod-protein').textContent = `${prod.protein}g`;
      document.getElementById('barcode-prod-carbs').textContent = `${prod.carbs}g`;
      document.getElementById('barcode-prod-fat').textContent = `${prod.fat}g`;

      const prodImg = document.getElementById('barcode-prod-img');
      if (prod.image) {
        prodImg.src = prod.image;
        prodImg.style.display = 'block';
      } else {
        prodImg.style.display = 'none';
      }

      resultCard.classList.remove('hidden');
      statusArea.textContent = 'Znaleziono produkt!';
    } catch (e) {
      statusArea.textContent = `Błąd: ${e.message}`;
      UI.showToast(e.message, 'error');
      _currentBarcodeProduct = null;
    } finally {
      lookupBtn.disabled = false;
      lookupBtn.innerHTML = 'Szukaj';
    }
  }

  async function _submitBarcodeAdd() {
    if (!_currentBarcodeProduct) return;

    const weightInput = document.getElementById('barcode-prod-weight');
    const grams = parseInt(weightInput.value) || 100;

    if (grams <= 0) {
      UI.showToast('Wpisz poprawną gramaturę', 'error');
      return;
    }

    const factor = grams / 100;
    const calories = Math.round(_currentBarcodeProduct.calories * factor);
    const protein = Math.round(_currentBarcodeProduct.protein * factor);
    const carbs = Math.round(_currentBarcodeProduct.carbs * factor);
    const fat = Math.round(_currentBarcodeProduct.fat * factor);

    try {
      const mealItem = {
        name: _currentBarcodeProduct.name,
        amount: `${grams}g`,
        calories: calories,
        protein: protein,
        carbs: carbs,
        fat: fat,
      };

      await AppStorage.addMeal(_currentDate, {
        type: 'barcode',
        items: [mealItem],
        total: { calories, protein, carbs, fat },
      });

      Gamification.addXP('addMeal');
      UI.closeModal('barcode-modal');
      _refreshDashboard();
      UI.showToast(`Dodano produkt: ${_currentBarcodeProduct.name} (${calories} kcal)`, 'success');
      _currentBarcodeProduct = null;

      Gamification.updateChallengeProgress();
      const newBadges = Gamification.checkBadges();
      if (newBadges.length > 0) {
        newBadges.forEach(b => {
          UI.showToast(`✨ Odznaka odblokowana: ${b.name} (${b.icon})!`, 'success');
        });
      }
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Export CSV ---
  function _exportCSV() {
    try {
      const dates = AppStorage.getAllDatesWithMeals();
      const weightHistory = AppStorage.getWeightHistory();
      const dailyGoal = AppStorage.getDailyGoal();
      const macroGoals = AppStorage.getMacroGoals();
      const waterGoal = AppStorage.getWaterGoal ? AppStorage.getWaterGoal() : 8;

      if (dates.length === 0) {
        UI.showToast('Brak danych do wyeksportowania.', 'info');
        return;
      }

      // Sort dates chronologically (oldest to newest)
      const sortedDates = [...dates].sort((a, b) => a.localeCompare(b));

      let csv = '\ufeff'; // BOM for Excel encoding compatibility
      
      // --- SECTION 1: DAILY SUMMARIES ---
      csv += '=== SEKCJA 1: PODSUMOWANIE DZIENNE ===\n';
      csv += 'Data;Waga (kg);Cel Kaloryczny (kcal);Spożyte Kalorie (kcal);Bilans (kcal);Cel Białka (g);Spożyte Białko (g);Cel Węglowodanów (g);Spożyte Węglowodany (g);Cel Tłuszczu (g);Spożyte Tłuszcze (g);Wypita Woda (szklanki);Cel Wody (szklanki);Notatka / Samopoczucie\n';

      sortedDates.forEach(d => {
        const dateObj = new Date(d);
        const summary = AppStorage.getDaySummary(dateObj);
        
        // Find weight for this date
        const weightRecord = weightHistory.find(w => w.date === d);
        const weightVal = weightRecord ? weightRecord.weight : '';

        // Water
        const waterVal = AppStorage.getWaterForDate ? AppStorage.getWaterForDate(dateObj) : 0;

        // Day Note
        const noteObj = AppStorage.getDayNote ? AppStorage.getDayNote(dateObj) : { text: '' };
        const cleanNote = (noteObj.text || '').replace(/[\n\r;]/g, ' ');

        const balance = summary.totals.calories - dailyGoal;
        const balanceTxt = balance > 0 ? `+${balance}` : balance;

        csv += `${d};${weightVal};${dailyGoal};${summary.totals.calories};${balanceTxt};${macroGoals.protein};${summary.totals.protein};${macroGoals.carbs};${summary.totals.carbs};${macroGoals.fat};${summary.totals.fat};${waterVal};${waterGoal};${cleanNote}\n`;
      });

      csv += '\n\n';

      // --- SECTION 2: DETAILED MEAL LOG ---
      csv += '=== SEKCJA 2: SZCZEGÓŁOWA LISTA POSIŁKÓW ===\n';
      csv += 'Data;Godzina;Typ Wpisu;Produkt / Posiłek;Ilość;Kalorie (kcal);Białko (g);Węglowodany (g);Tłuszcz (g)\n';

      sortedDates.forEach(d => {
        const summary = AppStorage.getDaySummary(new Date(d));
        summary.meals.forEach(m => {
          const typeTxt = m.type === 'text' ? 'AI Tekst' : (m.type === 'photo' ? 'AI Zdjęcie' : (m.type === 'barcode' ? 'Kod kreskowy' : 'Ręcznie'));
          m.items.forEach(item => {
            const cleanName = (item.name || '').replace(/[\n\r;]/g, ' ');
            const cleanAmount = (item.amount || '').replace(/[\n\r;]/g, ' ');
            csv += `${d};${m.time || ''};${typeTxt};${cleanName};${cleanAmount};${item.calories || 0};${item.protein || 0};${item.carbs || 0};${item.fat || 0}\n`;
          });
        });
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `calorieai_historia_${new Date().toISOString().substring(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      UI.showToast('Wyeksportowano rozszerzoną historię do CSV! 📥', 'success');
    } catch (e) {
      UI.showToast(e.message, 'error');
    }
  }

  // --- Barcode Camera Stream Scanning ---
  let _barcodeStream = null;
  let _barcodeScanning = false;

  async function _toggleBarcodeCamera() {
    const container = document.getElementById('barcode-scanner-container');
    const video = document.getElementById('barcode-scanner-video');
    const btnTxt = document.getElementById('barcode-camera-btn-text');

    if (_barcodeScanning) {
      _stopBarcodeCamera();
      return;
    }

    try {
      _barcodeStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = _barcodeStream;
      video.setAttribute('playsinline', true);
      await video.play();

      container.classList.remove('hidden');
      if (btnTxt) btnTxt.textContent = 'Zatrzymaj skaner';
      _barcodeScanning = true;

      _startBarcodeDetectionLoop();
    } catch (err) {
      console.error('[Scanner] Kamera error:', err);
      UI.showToast('Nie można uruchomić kamery.', 'error');
    }
  }

  function _stopBarcodeCamera() {
    const container = document.getElementById('barcode-scanner-container');
    const video = document.getElementById('barcode-scanner-video');
    const btnTxt = document.getElementById('barcode-camera-btn-text');

    _barcodeScanning = false;
    if (_barcodeStream) {
      _barcodeStream.getTracks().forEach(track => track.stop());
      _barcodeStream = null;
    }
    if (video) video.srcObject = null;
    container?.classList.add('hidden');
    if (btnTxt) btnTxt.textContent = 'Zeskanuj kod aparatem';
  }

  async function _startBarcodeDetectionLoop() {
    const video = document.getElementById('barcode-scanner-video');
    if (!video || !_barcodeScanning) return;

    if (!('BarcodeDetector' in window)) {
      const statusArea = document.getElementById('barcode-status-area');
      if (statusArea) statusArea.textContent = 'Natywne skanowanie nieobsługiwane na tym urządzeniu. Wpisz kod ręcznie.';
      return;
    }

    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
    const detector = new BarcodeDetector({ formats });

    async function checkFrame() {
      if (!_barcodeScanning) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          const input = document.getElementById('barcode-input');
          if (input) input.value = code;
          
          _stopBarcodeCamera();
          UI.showToast(`Zeskanowano kod: ${code} 🔊`, 'success');
          _lookupBarcode();
          return;
        }
      } catch (err) {
        // frame decode error
      }
      
      if (_barcodeScanning) {
        requestAnimationFrame(checkFrame);
      }
    }

    requestAnimationFrame(checkFrame);
  }

  return { init };
})();

// --- Start App ---
document.addEventListener('DOMContentLoaded', App.init);
