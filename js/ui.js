// ============================================
// CALORIE TRACKER — UI Module
// Rendering, components, and visual updates
// ============================================

const UI = (() => {
  // --- Toast Notifications ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✓', error: '✕', info: 'ℹ' };

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // --- Calorie Ring Chart ---
  function updateCalorieRing(consumed, goal) {
    const circumference = 2 * Math.PI * 80; // r=80
    const pct = Math.min(consumed / goal, 1.5); // Cap at 150%
    const offset = circumference - (pct * circumference);

    const progressEl = document.getElementById('ring-progress');
    const valueEl = document.getElementById('ring-value');
    const remainingEl = document.getElementById('ring-remaining');

    if (progressEl) {
      progressEl.style.strokeDashoffset = Math.max(0, offset);
      progressEl.classList.toggle('calorie-ring__progress--over', consumed > goal);
    }

    if (valueEl) {
      _animateNumber(valueEl, consumed);
    }

    if (remainingEl) {
      const remaining = goal - consumed;
      if (remaining >= 0) {
        remainingEl.textContent = `Zostało ${remaining} kcal`;
        remainingEl.className = 'calorie-ring__remaining calorie-ring__remaining--under';
      } else {
        remainingEl.textContent = `Przekroczono o ${Math.abs(remaining)} kcal`;
        remainingEl.className = 'calorie-ring__remaining calorie-ring__remaining--over';
      }
    }
  }

  // --- Macro Bars ---
  function updateMacroBars(totals, goals) {
    const macros = [
      { key: 'protein', label: 'Białko', unit: 'g' },
      { key: 'carbs', label: 'Węgle', unit: 'g' },
      { key: 'fat', label: 'Tłuszcze', unit: 'g' },
    ];

    macros.forEach(({ key }) => {
      const valueEl = document.getElementById(`macro-${key}-value`);
      const goalEl = document.getElementById(`macro-${key}-goal`);
      const fillEl = document.getElementById(`macro-${key}-fill`);

      if (valueEl) valueEl.textContent = Math.round(totals[key] || 0);
      if (goalEl) goalEl.textContent = `/ ${goals[key] || 0} g`;
      if (fillEl) {
        const pct = goals[key] ? Math.min(100, ((totals[key] || 0) / goals[key]) * 100) : 0;
        fillEl.style.width = pct + '%';
      }
    });
  }

  // --- Meals List ---
  function renderMealsList(meals, onDelete) {
    const container = document.getElementById('meals-list');
    const countEl = document.getElementById('meals-count');

    if (countEl) countEl.textContent = `${meals.length} posiłków`;

    if (!container) return;

    if (meals.length === 0) {
      container.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">
            <i data-lucide="utensils" style="width:40px; height:40px; margin: 0 auto; opacity: 0.35"></i>
          </div>
          <div class="meals-empty__text" style="margin-top:12px">Brak posiłków na ten dzień<br>
            <span class="text-muted text-xs">Dodaj posiłek tekstem lub zdjęciem</span>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = meals.map(meal => `
      <div class="meal-card" data-meal-id="${meal.id}">
        <div class="meal-card__header">
          <div class="meal-card__time">
            <i data-lucide="clock" style="width:14px; height:14px"></i>
            <span>${meal.time}</span>
            <span style="margin-left:4px; opacity:0.6; display:inline-flex">
              ${meal.type === 'photo' ? '<i data-lucide="camera" style="width:14px; height:14px"></i>' : (meal.type === 'manual' ? '<i data-lucide="pen-tool" style="width:14px; height:14px"></i>' : '<i data-lucide="text-cursor" style="width:14px; height:14px"></i>')}
            </span>
          </div>
          <div class="meal-card__calories">${meal.total.calories} kcal</div>
        </div>
        <div class="meal-card__items">
          ${meal.items.map(item => `
            <div class="meal-card__item">
              <span class="meal-card__item-name">${item.name}</span>
              <span class="meal-card__item-amount">${item.amount}</span>
              <span class="meal-card__item-cal">${item.calories} kcal</span>
            </div>
          `).join('')}
        </div>
        <div class="meal-card__footer">
          <button class="meal-card__delete" data-delete-id="${meal.id}">
            <i data-lucide="trash" style="width:14px; height:14px"></i> Usuń
          </button>
        </div>
      </div>
    `).join('');

    // Attach delete handlers
    container.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteId;
        if (onDelete) onDelete(id);
      });
    });

    // Render Lucide SVGs
    lucide.createIcons();
  }

  // --- AI Result Preview ---
  function renderAIResult(result) {
    if (!result || !result.items) return '';

    return `
      <div class="ai-result">
        ${result.items.map(item => `
          <div class="ai-result__item">
            <div class="ai-result__item-info">
              <div class="ai-result__item-name">${item.name}</div>
              <div class="ai-result__item-amount">${item.amount}</div>
            </div>
            <div class="ai-result__item-cal">${item.calories} kcal</div>
          </div>
        `).join('')}
        <div class="ai-result__total">
          <span class="ai-result__total-label">Razem</span>
          <span class="ai-result__total-value">${result.total.calories} kcal</span>
        </div>
        <div class="ai-result__macros">
          <div class="ai-result__macro">
            <div class="ai-result__macro-value" style="color:var(--accent-blue)">${result.total.protein}g</div>
            <div class="ai-result__macro-label">Białko</div>
          </div>
          <div class="ai-result__macro">
            <div class="ai-result__macro-value" style="color:var(--accent-orange)">${result.total.carbs}g</div>
            <div class="ai-result__macro-label">Węgle</div>
          </div>
          <div class="ai-result__macro">
            <div class="ai-result__macro-value" style="color:var(--accent-yellow)">${result.total.fat}g</div>
            <div class="ai-result__macro-label">Tłuszcze</div>
          </div>
        </div>
      </div>
    `;
  }

  // --- History ---
  function renderHistory(dates, dailyGoal, onDayClick) {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (dates.length === 0) {
      container.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">📅</div>
          <div class="meals-empty__text">Brak historii<br>
            <span class="text-muted text-xs">Zacznij dodawać posiłki!</span>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = dates.map(dateStr => {
      const summary = AppStorage.getDaySummary(new Date(dateStr));
      const pct = dailyGoal > 0 ? summary.totals.calories / dailyGoal : 0;

      let indicatorClass = 'empty';
      if (summary.mealCount > 0) {
        if (pct <= 0.9) indicatorClass = 'green';
        else if (pct <= 1.1) indicatorClass = 'yellow';
        else indicatorClass = 'red';
      }

      const dateObj = new Date(dateStr);
      const dayName = dateObj.toLocaleDateString('pl-PL', { weekday: 'long' });
      const dateFormatted = dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });

      return `
        <div class="history-day" data-date="${dateStr}">
          <div class="history-day__indicator history-day__indicator--${indicatorClass}"></div>
          <div class="history-day__info">
            <div class="history-day__date">${dayName}, ${dateFormatted}</div>
            <div class="history-day__meals">${summary.mealCount} posiłków</div>
          </div>
          <div style="text-align:right">
            <div class="history-day__calories">${summary.totals.calories} kcal</div>
            <div class="history-day__goal">/ ${dailyGoal} kcal</div>
          </div>
          <div class="history-day__arrow">
            <i data-lucide="chevron-right" style="width:16px; height:16px"></i>
          </div>
        </div>
      `;
    }).join('');

    // Render Lucide SVGs
    lucide.createIcons();

    // Attach click handlers
    container.querySelectorAll('.history-day').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        if (onDayClick) onDayClick(date);
      });
    });
  }

  // --- Date Navigation ---
  function updateDateLabel(date) {
    const labelEl = document.getElementById('date-label');
    const todayEl = document.getElementById('date-today');
    if (!labelEl) return;

    const today = new Date();
    const isToday = _isSameDay(date, today);
    const isYesterday = _isSameDay(date, new Date(today.getTime() - 86400000));

    const dayName = date.toLocaleDateString('pl-PL', { weekday: 'long' });
    const dateFormatted = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });

    labelEl.textContent = `${dayName}, ${dateFormatted}`;

    if (todayEl) {
      if (isToday) {
        todayEl.textContent = 'Dzisiaj';
        todayEl.style.display = '';
      } else if (isYesterday) {
        todayEl.textContent = 'Wczoraj';
        todayEl.style.display = '';
      } else {
        todayEl.style.display = 'none';
      }
    }
  }

  // --- Settings ---
  function loadSettings() {
    const goalInput = document.getElementById('setting-calorie-goal');
    const proteinInput = document.getElementById('setting-protein');
    const carbsInput = document.getElementById('setting-carbs');
    const fatInput = document.getElementById('setting-fat');
    const apiKeyInput = document.getElementById('setting-api-key');

    if (goalInput) goalInput.value = AppStorage.getDailyGoal();

    const macros = AppStorage.getMacroGoals();
    if (proteinInput) proteinInput.value = macros.protein;
    if (carbsInput) carbsInput.value = macros.carbs;
    if (fatInput) fatInput.value = macros.fat;

    if (apiKeyInput) {
      const key = AppStorage.getApiKey();
      apiKeyInput.value = key ? '•'.repeat(Math.min(key.length, 30)) : '';
      apiKeyInput.dataset.masked = 'true';
    }
  }

  // --- Helpers ---
  function _animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 600;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(current + (target - current) * eased);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  function _isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  }

  // --- Modals ---
  function openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(viewId);
    if (view) view.classList.add('active');

    // Update nav
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });
  }

  // --- Weight History ---
  function renderWeightHistory(records, onDelete) {
    const container = document.getElementById('weight-history-list');
    if (!container) return;

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">
            <i data-lucide="scale" style="width:36px; height:36px; margin:0 auto; opacity:0.35"></i>
          </div>
          <div class="meals-empty__text" style="margin-top:12px">Brak pomiarów wagi</div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = records.map(r => {
      const dateObj = new Date(r.date);
      const dateFormatted = dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' });
      const timeDisplay = r.time ? `<span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 6px">Godz: ${r.time}</span>` : '';
      
      return `
        <div class="history-day" style="cursor:default; margin-bottom:8px">
          <div class="history-day__indicator" style="background:var(--accent-purple); box-shadow:0 0 8px var(--accent-purple)"></div>
          <div class="history-day__info">
            <div class="history-day__date">${dateFormatted}${timeDisplay}</div>
          </div>
          <div style="display:flex; align-items:center; gap:16px">
            <div class="history-day__calories" style="color:var(--text-primary)">${r.weight} kg</div>
            <button class="meal-card__delete" data-delete-weight-id="${r.id}" style="padding:6px; border-radius:50%">
              <i data-lucide="trash" style="width:14px; height:14px"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Delete handler
    container.querySelectorAll('[data-delete-weight-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.deleteWeightId;
        if (onDelete) onDelete(id);
      });
    });

    lucide.createIcons();
  }

  // --- Calendar Strip ---
  function renderCalendarStrip(selectedDate, onDayClick) {
    const container = document.getElementById('calendar-strip');
    if (!container) return;

    // Get current Monday
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(current.setDate(diff));

    const days = [];
    const dayNames = ['PN', 'WT', 'ŚR', 'CZ', 'PT', 'SO', 'ND'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      
      const summary = AppStorage.getDaySummary(d);
      const kcal = summary.totals.calories;
      
      const isSelected = _isSameDay(d, selectedDate);
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

      days.push({
        name: dayNames[i],
        num: d.getDate(),
        kcal: kcal,
        active: isSelected,
        dateStr: dateStr
      });
    }

    container.innerHTML = days.map(d => `
      <div class="calendar-day ${d.active ? 'active' : ''}" data-date="${d.dateStr}">
        <span class="calendar-day__name">${d.name}</span>
        <span class="calendar-day__num">${d.num}</span>
        <span class="calendar-day__kcal ${d.kcal === 0 ? 'empty' : ''}">${d.kcal > 0 ? `${d.kcal}` : '-'}</span>
      </div>
    `).join('');

    // Attach click events
    container.querySelectorAll('.calendar-day').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        if (onDayClick) onDayClick(date);
      });
    });
  }

  // --- Search matches in text modal ---
  function renderSearchMatches(matches, onSelect) {
    const container = document.getElementById('search-matches-list');
    if (!container) return;

    if (!matches || matches.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px; font-weight: 700">Dopasowania w bazie (kliknij aby dodać):</div>
      <div style="display: flex; flex-direction: column; gap: 8px">
        ${matches.map(m => `
          <div class="history-day search-match-row" data-match-name="${m.name}" style="padding: 10px 14px; margin-bottom: 0px">
            <div class="history-day__indicator" style="background:var(--accent-green); box-shadow:0 0 8px var(--accent-green)"></div>
            <div class="history-day__info" style="cursor:pointer">
              <div class="history-day__date" style="font-size: 0.9rem">${m.name}</div>
              <div class="history-day__meals" style="font-size: 0.75rem; color: var(--text-secondary)">
                ${m.calories} kcal/porcja (${m.portion})
              </div>
            </div>
            <i data-lucide="plus" style="width: 16px; height: 16px; color: var(--accent-green); opacity: 0.8"></i>
          </div>
        `).join('')}
      </div>
    `;

    // Click handler
    container.querySelectorAll('.search-match-row').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.dataset.matchName;
        const match = matches.find(m => m.name === name);
        if (onSelect && match) onSelect(match);
      });
    });

    lucide.createIcons();
  }

  // --- Favorites List ---
  function renderFavoritesList(favorites, onSelect, onDelete) {
    const container = document.getElementById('favorites-list-area');
    if (!container) return;

    if (!favorites || favorites.length === 0) {
      container.innerHTML = `
        <div class="meals-empty">
          <div class="meals-empty__icon">
            <i data-lucide="star" style="width:36px; height:36px; margin:0 auto; opacity:0.35"></i>
          </div>
          <div class="meals-empty__text" style="margin-top:12px">Brak ulubionych dań<br>
            <span class="text-muted text-xs">Dodaj posiłek ręcznie i zaznacz gwiazdkę, aby zapisać go jako ulubiony</span>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = favorites.map(f => `
      <div class="history-day fav-item-row" data-fav-id="${f.id}" style="margin-bottom:8px">
        <div class="history-day__indicator" style="background:var(--accent-yellow); box-shadow:0 0 8px var(--accent-yellow)"></div>
        <div class="history-day__info" style="cursor:pointer">
          <div class="history-day__date">${f.name}</div>
          <div class="history-day__meals" style="color:var(--text-accent)">${f.calories} kcal | B:${f.protein}g W:${f.carbs}g T:${f.fat}g</div>
        </div>
        <button class="meal-card__delete" data-delete-fav-id="${f.id}" style="padding:8px; border-radius:50%; z-index:10">
          <i data-lucide="trash" style="width:14px; height:14px"></i>
        </button>
      </div>
    `).join('');

    // Attach click events
    container.querySelectorAll('.fav-item-row').forEach(row => {
      const info = row.querySelector('.history-day__info');
      info.addEventListener('click', () => {
        const id = row.dataset.favId;
        if (onSelect) onSelect(id);
      });

      const delBtn = row.querySelector('[data-delete-fav-id]');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = delBtn.dataset.deleteFavId;
        if (onDelete) onDelete(id);
      });
    });

    lucide.createIcons();
  }

  // --- Settings ---
  function loadSettings() {
    const goalInput = document.getElementById('setting-calorie-goal');
    const proteinInput = document.getElementById('setting-protein');
    const carbsInput = document.getElementById('setting-carbs');
    const fatInput = document.getElementById('setting-fat');
    const apiKeyInput = document.getElementById('setting-api-key');

    const weightInput = document.getElementById('setting-weight');
    const heightInput = document.getElementById('setting-height');
    const targetWeightInput = document.getElementById('setting-target-weight');

    if (goalInput) goalInput.value = AppStorage.getDailyGoal();

    const macros = AppStorage.getMacroGoals();
    if (proteinInput) proteinInput.value = macros.protein;
    if (carbsInput) carbsInput.value = macros.carbs;
    if (fatInput) fatInput.value = macros.fat;

    if (apiKeyInput) {
      const key = AppStorage.getApiKey();
      apiKeyInput.value = key ? '•'.repeat(Math.min(key.length, 30)) : '';
      apiKeyInput.dataset.masked = 'true';
    }

    const profile = AppStorage.getProfile();
    if (weightInput) weightInput.value = profile.weight || '';
    if (heightInput) heightInput.value = profile.height || '';
    if (targetWeightInput) targetWeightInput.value = profile.targetWeight || '';
  }

  // --- Helpers ---
  function _animateNumber(el, target) {
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 600;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(current + (target - current) * eased);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // --- Loading States ---
  function showLoading(containerId, message = 'Analizuję...') {
    if (containerId === 'app') {
      const loader = document.getElementById('loading-screen');
      const text = document.getElementById('loading-text');
      if (loader && text) {
        text.textContent = message;
        loader.classList.remove('hidden');
      }
      return;
    }

    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = `
        <div class="loading">
          <div class="loading__spinner"></div>
          <div class="loading__text">${message}</div>
        </div>
      `;
    }
  }

  function hideLoading() {
    const loader = document.getElementById('loading-screen');
    if (loader) loader.classList.add('hidden');
  }

  function _isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  // --- Public API ---
  return {
    showToast,
    updateCalorieRing,
    updateMacroBars,
    renderMealsList,
    renderAIResult,
    renderHistory,
    updateDateLabel,
    loadSettings,
    openModal,
    closeModal,
    showView,
    showLoading,
    hideLoading,
    renderWeightHistory,
    renderFavoritesList,
    renderCalendarStrip,
    renderSearchMatches
  };
})();
