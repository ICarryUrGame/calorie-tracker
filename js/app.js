// ============================================
// CALORIE TRACKER — App Module
// Main application logic, routing, auth flows, initialization
// ============================================

const App = (() => {
  let _currentDate = new Date();
  let _currentAIResult = null;
  let _cameraActive = false;
  let _photoDataUrl = null;
  let _isRegisterMode = false;

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
    document.getElementById('auth-goal').value = '2000';
    _setRegisterMode(false);
  }

  function _setRegisterMode(isRegister) {
    _isRegisterMode = isRegister;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');
    const registerGoalGroup = document.getElementById('register-goal-group');

    if (isRegister) {
      title.textContent = 'Stwórz konto';
      subtitle.textContent = 'Zarejestruj się, aby zapisywać posiłki i kontrolować kalorie z każdego urządzenia.';
      submitBtn.textContent = '🚀 Zarejestruj się';
      switchText.textContent = 'Masz już konto?';
      switchBtn.textContent = 'Zaloguj się';
      registerGoalGroup.classList.remove('hidden');
    } else {
      title.textContent = 'Zaloguj się';
      subtitle.textContent = 'Wpisz swoje dane, aby uzyskać dostęp do licznika kalorii i synchronizacji danych.';
      submitBtn.textContent = '🔑 Zaloguj się';
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
        const goal = parseInt(document.getElementById('auth-goal').value) || 2000;

        const submitBtn = document.getElementById('auth-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Proszę czekać...';

        try {
          if (_isRegisterMode) {
            await AppStorage.register(username, password, goal);
            UI.showToast('Konto zostało pomyślnie utworzone! 🎉', 'success');
          } else {
            await AppStorage.login(username, password);
            UI.showToast('Zalogowano pomyślnie!', 'success');
          }
          _showApp();
        } catch (error) {
          UI.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = _isRegisterMode ? '🚀 Zarejestruj się' : '🔑 Zaloguj się';
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

    document.getElementById('btn-add-photo')?.addEventListener('click', () => {
      _openPhotoModal();
    });

    document.getElementById('btn-add-manual')?.addEventListener('click', () => {
      _openManualModal();
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

    // Photo Modal
    document.getElementById('photo-modal-close')?.addEventListener('click', () => {
      _closePhotoModal();
    });

    document.getElementById('btn-start-camera')?.addEventListener('click', () => {
      _startCameraCapture();
    });

    document.getElementById('btn-capture')?.addEventListener('click', () => {
      _capturePhoto();
    });

    document.getElementById('btn-upload-file')?.addEventListener('click', () => {
      document.getElementById('file-input')?.click();
    });

    document.getElementById('file-input')?.addEventListener('change', (e) => {
      _handleFileUpload(e.target.files[0]);
    });

    document.getElementById('photo-analyze-btn')?.addEventListener('click', () => {
      _analyzePhoto();
    });

    document.getElementById('photo-save-btn')?.addEventListener('click', () => {
      _savePhotoMeal();
    });

    document.getElementById('photo-retake-btn')?.addEventListener('click', () => {
      _resetPhotoModal();
    });

    // Manual Modal Close and Save
    document.getElementById('manual-modal-close')?.addEventListener('click', () => {
      UI.closeModal('manual-modal');
    });

    document.getElementById('manual-save-btn')?.addEventListener('click', () => {
      _saveManualMeal();
    });

    // Upload area drag/click
    const uploadArea = document.getElementById('upload-area');
    if (uploadArea) {
      uploadArea.addEventListener('click', () => {
        document.getElementById('file-input')?.click();
      });

      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--accent-green)';
        uploadArea.style.background = 'var(--accent-green-dim)';
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        uploadArea.style.background = '';
        const file = e.dataTransfer.files[0];
        if (file) _handleFileUpload(file);
      });
    }

    // Settings
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

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          const id = overlay.id;
          if (id === 'text-modal') _closeTextModal();
          if (id === 'photo-modal') _closePhotoModal();
          if (id === 'manual-modal') UI.closeModal('manual-modal');
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

  // --- Text Analysis & Local DB ---
  function _openTextModal() {
    _currentAIResult = null;
    document.getElementById('meal-text-input').value = '';
    document.getElementById('text-result-area').innerHTML = '';
    document.getElementById('text-save-btn').classList.add('hidden');
    UI.openModal('text-modal');
    setTimeout(() => document.getElementById('meal-text-input')?.focus(), 350);
  }

  function _closeTextModal() {
    UI.closeModal('text-modal');
    _currentAIResult = null;
  }

  async function _analyzeText() {
    const input = document.getElementById('meal-text-input');
    const text = input.value.trim();
    if (!text) {
      UI.showToast('Wpisz co zjadłeś/aś', 'error');
      return;
    }

    const resultArea = document.getElementById('text-result-area');
    const analyzeBtn = document.getElementById('text-analyze-btn');
    const saveBtn = document.getElementById('text-save-btn');

    // 1. Try local database first
    const localResult = FoodDB.parseMealDescription(text);
    if (localResult && localResult.items.length > 0) {
      _currentAIResult = localResult;
      resultArea.innerHTML = UI.renderAIResult(_currentAIResult);
      saveBtn.classList.remove('hidden');
      UI.showToast('Znaleziono w lokalnej bazie!', 'success');
      return;
    }

    // 2. If API key is set, try AI
    const apiKey = AppStorage.getApiKey();
    if (apiKey) {
      analyzeBtn.disabled = true;
      analyzeBtn.innerHTML = '<div class="loading__spinner" style="width:20px;height:20px;border-width:2px"></div> Szukam...';
      saveBtn.classList.add('hidden');
      UI.showLoading('text-result-area', '🤖 Nie znaleziono w bazie, pytam AI...');

      AI.onStatus((msg) => {
        const statusEl = document.querySelector('#text-result-area .loading__text');
        if (statusEl) statusEl.textContent = msg;
      });

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
        analyzeBtn.innerHTML = '🔍 Szukaj / Analizuj';
      }
    } else {
      // No API key & no database hit
      resultArea.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">🔍</div>
          <div class="meals-empty__text">Nie znaleziono "${text}" w bazie<br>
            <span class="text-muted text-xs">Spróbuj prostszych nazw (np. "jajecznica", "banan") lub dodaj klucz Gemini API w Ustawieniach, by włączyć sztuczną inteligencję.</span>
          </div>
        </div>
      `;
      _currentAIResult = null;
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

  // --- Photo Analysis ---
  function _openPhotoModal() {
    _currentAIResult = null;
    _photoDataUrl = null;
    _resetPhotoModal();
    UI.openModal('photo-modal');
  }

  function _closePhotoModal() {
    Camera.stopCamera();
    _cameraActive = false;
    UI.closeModal('photo-modal');
    _currentAIResult = null;
    _photoDataUrl = null;
  }

  function _resetPhotoModal() {
    Camera.stopCamera();
    _cameraActive = false;
    _photoDataUrl = null;
    _currentAIResult = null;

    const previewArea = document.getElementById('photo-preview-area');
    const resultArea = document.getElementById('photo-result-area');
    const cameraSection = document.getElementById('camera-section');
    const capturedSection = document.getElementById('captured-section');
    const analyzeBtn = document.getElementById('photo-analyze-btn');
    const saveBtn = document.getElementById('photo-save-btn');
    const retakeBtn = document.getElementById('photo-retake-btn');

    if (previewArea) previewArea.innerHTML = '';
    if (resultArea) resultArea.innerHTML = '';
    if (cameraSection) cameraSection.classList.remove('hidden');
    if (capturedSection) capturedSection.classList.add('hidden');
    if (analyzeBtn) analyzeBtn.classList.add('hidden');
    if (saveBtn) saveBtn.classList.add('hidden');
    if (retakeBtn) retakeBtn.classList.add('hidden');

    document.getElementById('camera-start-section').classList.remove('hidden');
    document.getElementById('camera-live-section').classList.add('hidden');
  }

  async function _startCameraCapture() {
    const video = document.getElementById('camera-video');
    const cameraSection = document.getElementById('camera-section');

    try {
      await Camera.startCamera(video);
      _cameraActive = true;

      if (cameraSection) {
        document.getElementById('camera-start-section').classList.add('hidden');
        document.getElementById('camera-live-section').classList.remove('hidden');
      }
    } catch (error) {
      UI.showToast(error.message, 'error');
    }
  }

  function _capturePhoto() {
    try {
      _photoDataUrl = Camera.capturePhoto();
      Camera.stopCamera();
      _cameraActive = false;
      _showCapturedPhoto(_photoDataUrl);
    } catch (error) {
      UI.showToast(error.message, 'error');
    }
  }

  async function _handleFileUpload(file) {
    try {
      _photoDataUrl = await Camera.processFileUpload(file);
      _showCapturedPhoto(_photoDataUrl);
    } catch (error) {
      UI.showToast(error.message, 'error');
    }
  }

  function _showCapturedPhoto(dataUrl) {
    const previewArea = document.getElementById('photo-preview-area');
    const cameraSection = document.getElementById('camera-section');
    const capturedSection = document.getElementById('captured-section');
    const analyzeBtn = document.getElementById('photo-analyze-btn');
    const retakeBtn = document.getElementById('photo-retake-btn');

    if (previewArea) {
      previewArea.innerHTML = `<img src="${dataUrl}" alt="Zdjęcie posiłku">`;
    }

    if (cameraSection) cameraSection.classList.add('hidden');
    if (capturedSection) capturedSection.classList.remove('hidden');
    if (analyzeBtn) analyzeBtn.classList.remove('hidden');
    if (retakeBtn) retakeBtn.classList.remove('hidden');
  }

  async function _analyzePhoto() {
    if (!_photoDataUrl) {
      UI.showToast('Najpierw zrób zdjęcie lub wybierz plik', 'error');
      return;
    }

    const apiKey = AppStorage.getApiKey();
    if (!apiKey) {
      UI.showToast('Do analizy zdjęć wymagany jest klucz Gemini API. Dodaj go w Ustawieniach.', 'error');
      return;
    }

    const resultArea = document.getElementById('photo-result-area');
    const analyzeBtn = document.getElementById('photo-analyze-btn');
    const saveBtn = document.getElementById('photo-save-btn');

    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<div class="loading__spinner" style="width:20px;height:20px;border-width:2px"></div> Analizuję...';
    saveBtn.classList.add('hidden');
    UI.showLoading('photo-result-area', '🤖 AI rozpoznaje jedzenie ze zdjęcia...');

    AI.onStatus((msg) => {
      const statusEl = document.querySelector('#photo-result-area .loading__text');
      if (statusEl) statusEl.textContent = msg;
    });

    try {
      _currentAIResult = await AI.analyzeImage(_photoDataUrl);
      resultArea.innerHTML = UI.renderAIResult(_currentAIResult);
      saveBtn.classList.remove('hidden');
    } catch (error) {
      resultArea.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">❌</div>
          <div class="meals-empty__text">${error.message}</div>
        </div>
      `;
      _currentAIResult = null;
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '🔍 Analizuj zdjęcie';
    }
  }

  async function _savePhotoMeal() {
    if (!_currentAIResult) return;

    try {
      await AppStorage.addMeal(_currentDate, {
        type: 'photo',
        items: _currentAIResult.items,
        total: _currentAIResult.total,
      });

      _closePhotoModal();
      _refreshDashboard();
      UI.showToast(`Dodano posiłek: ${_currentAIResult.total.calories} kcal`, 'success');
      _currentAIResult = null;
      _photoDataUrl = null;
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
    UI.openModal('manual-modal');
    setTimeout(() => document.getElementById('manual-name')?.focus(), 350);
  }

  async function _saveManualMeal() {
    const name = document.getElementById('manual-name').value.trim();
    const calories = parseInt(document.getElementById('manual-calories').value) || 0;
    const protein = parseInt(document.getElementById('manual-protein').value) || 0;
    const carbs = parseInt(document.getElementById('manual-carbs').value) || 0;
    const fat = parseInt(document.getElementById('manual-fat').value) || 0;

    if (!name) {
      UI.showToast('Wpisz nazwę posiłku', 'error');
      return;
    }
    if (calories <= 0) {
      UI.showToast('Wpisz ilość kalorii', 'error');
      return;
    }

    try {
      await AppStorage.addMeal(_currentDate, {
        type: 'manual',
        items: [{
          name: name,
          amount: '1 porcja',
          calories: calories,
          protein: protein,
          carbs: carbs,
          fat: fat,
        }],
        total: { calories, protein, carbs, fat },
      });

      UI.closeModal('manual-modal');
      _refreshDashboard();
      UI.showToast(`Dodano: ${name} (${calories} kcal)`, 'success');
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
    // Parse year, month, date from string to prevent timezone offset shifts
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
