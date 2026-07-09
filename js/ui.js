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
  function renderMealsList(meals, onDelete, onEdit) {
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
            <span class="text-muted text-xs">Dodaj posiłek tekstem, zdjęciem lub kodem kreskowym</span>
          </div>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    const validMeals = (meals || []).filter(m => m !== null && m !== undefined);
    container.innerHTML = validMeals.map(meal => {
      const t = meal.total || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      const items = meal.items || [];
      const time = meal.time || '--:--';
      
      return `
        <div class="meal-card" data-meal-id="${meal.id}">
          <div class="meal-card__header">
            <div class="meal-card__time">
              <i data-lucide="clock" style="width:14px; height:14px"></i>
              <span>${time}</span>
              <span style="margin-left:4px; opacity:0.6; display:inline-flex">
                ${meal.type === 'photo' ? '<i data-lucide="camera" style="width:14px; height:14px"></i>' : (meal.type === 'manual' ? '<i data-lucide="pen-tool" style="width:14px; height:14px"></i>' : (meal.type === 'barcode' ? '<i data-lucide="scan-barcode" style="width:14px; height:14px"></i>' : '<i data-lucide="text-cursor" style="width:14px; height:14px"></i>'))}
              </span>
            </div>
            <div class="meal-card__calories">${t.calories || 0} kcal</div>
          </div>
          <div class="meal-card__items">
            ${items.map(item => `
              <div class="meal-card__item">
                <span class="meal-card__item-name">${item.name || 'Brak nazwy'}</span>
                <span class="meal-card__item-amount">${item.amount || '1 szt.'}</span>
                <span class="meal-card__item-cal">${item.calories || 0} kcal</span>
              </div>
            `).join('')}
          </div>
          <div class="meal-card__footer" style="display:flex; justify-content:space-between; align-items:center">
            <button class="meal-card__edit" data-edit-id="${meal.id}" style="background:none; border:none; color:var(--accent-green); font-size:0.75rem; display:inline-flex; align-items:center; gap:4px; cursor:pointer; font-weight:600; padding:6px 0">
              <i data-lucide="edit-3" style="width:14px; height:14px"></i> Edytuj
            </button>
            <button class="meal-card__delete" data-delete-id="${meal.id}">
              <i data-lucide="trash" style="width:14px; height:14px"></i> Usuń
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach edit handlers
    container.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editId;
        if (onEdit) onEdit(id);
      });
    });

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
  function renderAIResult(result, prefix = 'text') {
    if (!result || !result.items) return '';

    return `
      <div class="ai-result" data-prefix="${prefix}">
        ${result.items.map((item, idx) => `
          <div class="ai-result__item" data-index="${idx}" style="display:flex; flex-direction:column; gap:12px; background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:12px; padding:14px; margin-bottom:12px; align-items:stretch">
            <!-- First row: Name & Portion -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px">
              <input type="text" class="ai-item-name-input" value="${item.name}" style="background:transparent; border:none; color:var(--text-primary); font-weight:700; font-size:1.05rem; width:55%; border-bottom:1px dashed transparent; outline:none; transition:border-color 0.2s" onfocus="this.style.borderBottomColor='var(--accent-green)'" onblur="this.style.borderBottomColor='transparent'">
              <input type="text" class="ai-item-amount-input" value="${item.amount}" style="background:transparent; border:none; color:var(--text-secondary); font-size:0.85rem; text-align:right; width:40%; border-bottom:1px dashed transparent; outline:none; transition:border-color 0.2s" onfocus="this.style.borderBottomColor='var(--accent-green)'" onblur="this.style.borderBottomColor='transparent'">
            </div>
            
            <!-- Second row: Clean aligned grid for nutrients -->
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; text-align:center; border-top:1px solid var(--border-glass); padding-top:10px">
              <div style="display:flex; flex-direction:column; gap:4px">
                <span style="font-size:0.68rem; color:var(--accent-green); font-weight:700; text-transform:uppercase; letter-spacing:0.02em">Kalorie</span>
                <input type="number" class="ai-item-cal-input" value="${item.calories}" style="background:var(--bg-glass-strong); border:1px solid var(--border-glass); border-radius:6px; color:var(--accent-green); font-weight:800; font-size:0.9rem; width:100%; text-align:center; padding:6px 2px; outline:none; transition:border-color 0.2s, box-shadow 0.2s" onfocus="this.style.borderColor='var(--accent-green)';" onblur="this.style.borderColor='var(--border-glass)';">
              </div>
              <div style="display:flex; flex-direction:column; gap:4px">
                <span style="font-size:0.68rem; color:var(--accent-blue); font-weight:700; text-transform:uppercase; letter-spacing:0.02em">Białko</span>
                <input type="number" class="ai-item-protein-input" value="${item.protein}" style="background:var(--bg-glass-strong); border:1px solid var(--border-glass); border-radius:6px; color:var(--accent-blue); font-weight:800; font-size:0.9rem; width:100%; text-align:center; padding:6px 2px; outline:none; transition:border-color 0.2s, box-shadow 0.2s" onfocus="this.style.borderColor='var(--accent-blue)';" onblur="this.style.borderColor='var(--border-glass)';">
              </div>
              <div style="display:flex; flex-direction:column; gap:4px">
                <span style="font-size:0.68rem; color:var(--accent-orange); font-weight:700; text-transform:uppercase; letter-spacing:0.02em">Węgle</span>
                <input type="number" class="ai-item-carbs-input" value="${item.carbs}" style="background:var(--bg-glass-strong); border:1px solid var(--border-glass); border-radius:6px; color:var(--accent-orange); font-weight:800; font-size:0.9rem; width:100%; text-align:center; padding:6px 2px; outline:none; transition:border-color 0.2s, box-shadow 0.2s" onfocus="this.style.borderColor='var(--accent-orange)';" onblur="this.style.borderColor='var(--border-glass)';">
              </div>
              <div style="display:flex; flex-direction:column; gap:4px">
                <span style="font-size:0.68rem; color:var(--accent-yellow); font-weight:700; text-transform:uppercase; letter-spacing:0.02em">Tłuszcze</span>
                <input type="number" class="ai-item-fat-input" value="${item.fat}" style="background:var(--bg-glass-strong); border:1px solid var(--border-glass); border-radius:6px; color:var(--accent-yellow); font-weight:800; font-size:0.9rem; width:100%; text-align:center; padding:6px 2px; outline:none; transition:border-color 0.2s, box-shadow 0.2s" onfocus="this.style.borderColor='var(--accent-yellow)';" onblur="this.style.borderColor='var(--border-glass)';">
              </div>
            </div>
          </div>
        `).join('')}
        <div class="ai-result__total">
          <span class="ai-result__total-label">Razem</span>
          <span class="ai-result__total-value" id="${prefix}-total-calories">${result.total.calories} kcal</span>
        </div>
        <div class="ai-result__macros">
          <div class="ai-result__macro">
            <div class="ai-result__macro-value" id="${prefix}-total-protein" style="color:var(--accent-blue)">${result.total.protein}g</div>
            <div class="ai-result__macro-label">Białko</div>
          </div>
          <div class="ai-result__macro">
            <div class="ai-result__macro-value" id="${prefix}-total-carbs" style="color:var(--accent-orange)">${result.total.carbs}g</div>
            <div class="ai-result__macro-label">Węgle</div>
          </div>
          <div class="ai-result__macro">
            <div class="ai-result__macro-value" id="${prefix}-total-fat" style="color:var(--accent-yellow)">${result.total.fat}g</div>
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

  // --- Monthly Calendar Grid ---
  function renderMonthlyCalendar(year, month, selectedDate, onDayClick) {
    const grid = document.getElementById('calendar-month-grid');
    const label = document.getElementById('calendar-month-label');
    if (!grid || !label) return;

    const monthNames = [
      'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
      'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
    ];

    label.textContent = `${monthNames[month]} ${year}`;

    // Get first day of the month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Adjust first day (Monday as first day of week index 0)
    const offset = firstDay === 0 ? 6 : firstDay - 1;

    let html = '';

    // Empty offset days
    for (let i = 0; i < offset; i++) {
      html += `<div class="calendar-month-day empty-day"></div>`;
    }

    const goal = AppStorage.getDailyGoal();
    const today = new Date();

    // Month days
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const summary = AppStorage.getDaySummary(d);
      const kcal = summary.totals.calories;
      
      const isActive = _isSameDay(d, selectedDate);
      
      let targetClass = '';
      let kcalText = '';
      let streakClass = '';
      
      if (kcal > 0) {
        kcalText = `${kcal} kcal`;
        const pct = goal > 0 ? kcal / goal : 0;
        if (kcal <= goal) {
          streakClass = 'streak-border';
          if (pct <= 0.5) targetClass = 'heat-1';
          else if (pct <= 0.8) targetClass = 'heat-2';
          else if (pct <= 0.95) targetClass = 'heat-3';
          else targetClass = 'heat-4';
        } else {
          targetClass = 'heat-over';
        }
      }

      const activeClass = isActive ? 'active-day' : '';
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      html += `
        <div class="calendar-month-day ${targetClass} ${streakClass} ${activeClass}" data-date="${dateStr}">
          <span class="calendar-month-day__num">${day}</span>
          <span class="calendar-month-day__kcal">${kcalText}</span>
        </div>
      `;
    }

    grid.innerHTML = html;

    // Attach click events
    grid.querySelectorAll('.calendar-month-day:not(.empty-day)').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        if (onDayClick) onDayClick(date);
      });
    });
  }

  // --- Streak UI ---
  function updateStreak(streak) {
    const badge = document.getElementById('streak-badge');
    const count = document.getElementById('streak-count');
    if (!badge || !count) return;

    if (streak > 0) {
      count.textContent = streak;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
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
    renderSearchMatches,
    renderMonthlyCalendar,
    updateStreak,
    renderMonthSummary,
    renderWeeklyReport,
    renderWaterTracker,
    renderIFWidget,
    renderBMICard,
    renderAchievements
  };
  
  function renderMonthSummary(year, month) {
    const totalDays = new Date(year, month + 1, 0).getDate();
    let sumKcal = 0;
    let daysWithMeals = 0;
    let daysNormal = 0;
    let daysOver = 0;
    const goal = AppStorage.getDailyGoal();

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const summary = AppStorage.getDaySummary(d);
      const kcal = summary.totals.calories;
      if (kcal > 0) {
        sumKcal += kcal;
        daysWithMeals++;
        if (kcal <= goal) daysNormal++;
        else daysOver++;
      }
    }

    const avgKcal = daysWithMeals > 0 ? Math.round(sumKcal / daysWithMeals) : 0;

    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 0) {
      prevMonth = 11;
      prevYear--;
    }
    const prevTotalDays = new Date(prevYear, prevMonth + 1, 0).getDate();
    let prevSumKcal = 0;
    let prevDaysWithMeals = 0;
    for (let day = 1; day <= prevTotalDays; day++) {
      const d = new Date(prevYear, prevMonth, day);
      const summary = AppStorage.getDaySummary(d);
      const kcal = summary.totals.calories;
      if (kcal > 0) {
        prevSumKcal += kcal;
        prevDaysWithMeals++;
      }
    }
    const prevAvgKcal = prevDaysWithMeals > 0 ? Math.round(prevSumKcal / prevDaysWithMeals) : 0;

    let vsPrevText = '—';
    if (avgKcal > 0 && prevAvgKcal > 0) {
      const diff = avgKcal - prevAvgKcal;
      const pct = Math.round((diff / prevAvgKcal) * 100);
      if (pct > 0) vsPrevText = `+${pct}% vs poprz.`;
      else if (pct < 0) vsPrevText = `${pct}% vs poprz.`;
      else vsPrevText = 'bez zmian';
    }

    const avgEl = document.getElementById('month-avg-kcal');
    const normalEl = document.getElementById('month-days-normal');
    const overEl = document.getElementById('month-days-over');
    const vsPrevEl = document.getElementById('month-vs-prev');

    if (avgEl) avgEl.textContent = `${avgKcal} kcal`;
    if (normalEl) normalEl.textContent = `${daysNormal} dni`;
    if (overEl) overEl.textContent = `${daysOver} dni`;
    if (vsPrevEl) vsPrevEl.textContent = vsPrevText;
  }

  function renderWeeklyReport() {
    const today = new Date();
    let sumKcal = 0;
    let daysWithMeals = 0;
    let daysNormal = 0;
    const goal = AppStorage.getDailyGoal();

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const summary = AppStorage.getDaySummary(d);
      const kcal = summary.totals.calories;
      if (kcal > 0) {
        sumKcal += kcal;
        daysWithMeals++;
        if (kcal <= goal) daysNormal++;
      }
    }

    const avgKcal = daysWithMeals > 0 ? Math.round(sumKcal / daysWithMeals) : 0;

    const avgEl = document.getElementById('week-avg-kcal');
    const goalEl = document.getElementById('week-days-goal');

    if (avgEl) avgEl.textContent = `${avgKcal} kcal`;
    if (goalEl) goalEl.textContent = `${daysNormal} dni`;
  }

  function renderWaterTracker(current, goal) {
    const container = document.getElementById('water-cups-container');
    const currentEl = document.getElementById('water-current');
    const goalEl = document.getElementById('water-goal-val');

    if (currentEl) currentEl.textContent = current;
    if (goalEl) goalEl.textContent = goal;

    if (!container) return;

    let html = '';
    for (let i = 0; i < goal; i++) {
      const isFilled = i < current;
      html += `<span class="water-cup" style="cursor:pointer; opacity: ${isFilled ? 1 : 0.25}; margin-right:4px">💧</span>`;
    }
    container.innerHTML = html;
  }

  function renderIFWidget() {
    const fastingWidget = document.getElementById('fasting-widget');
    const ifSettings = AppStorage.getIFSettings();
    const ifProtocolVal = document.getElementById('if-protocol-val');
    const ifTimer = document.getElementById('if-timer');
    const ifTimerLabel = document.getElementById('if-timer-label');
    const ifStatusBadge = document.getElementById('if-status-badge');
    const ifStartTime = document.getElementById('if-start-time');

    if (!fastingWidget) return;

    if (!ifSettings.enabled) {
      fastingWidget.classList.add('hidden');
      return;
    }

    fastingWidget.classList.remove('hidden');
    if (ifProtocolVal) ifProtocolVal.textContent = ifSettings.protocol;

    const [fastHours, eatHours] = ifSettings.protocol.split(':').map(Number);
    const startHour = ifSettings.startHour;

    if (ifStartTime) ifStartTime.textContent = `${String(startHour).padStart(2, '0')}:00`;

    const now = new Date();
    const currentHour = now.getHours();

    const fastStartHour = (startHour + eatHours) % 24;
    
    let isEating = false;
    if (startHour + eatHours <= 24) {
      isEating = currentHour >= startHour && currentHour < (startHour + eatHours);
    } else {
      isEating = currentHour >= startHour || currentHour < ((startHour + eatHours) % 24);
    }

    let diffSeconds = 0;
    if (isEating) {
      if (ifStatusBadge) {
        ifStatusBadge.textContent = 'Okno jedzenia';
        ifStatusBadge.style.background = 'var(--accent-green-dim)';
        ifStatusBadge.style.color = 'var(--accent-green)';
      }
      if (ifTimerLabel) ifTimerLabel.textContent = 'do końca okna jedzenia';
      
      let target = new Date();
      target.setHours(fastStartHour, 0, 0, 0);
      if (target < now) target.setDate(target.getDate() + 1);
      diffSeconds = Math.floor((target - now) / 1000);
    } else {
      if (ifStatusBadge) {
        ifStatusBadge.textContent = 'Okno postu';
        ifStatusBadge.style.background = 'var(--accent-purple-dim)';
        ifStatusBadge.style.color = 'var(--accent-purple)';
      }
      if (ifTimerLabel) ifTimerLabel.textContent = 'do końca postu';

      let target = new Date();
      target.setHours(startHour, 0, 0, 0);
      if (target < now) target.setDate(target.getDate() + 1);
      diffSeconds = Math.floor((target - now) / 1000);
    }

    if (diffSeconds < 0) diffSeconds = 0;

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    if (ifTimer) {
      ifTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
  }

  function renderBMICard(weight, height) {
    const bmiValEl = document.getElementById('bmi-value');
    const bmiCatEl = document.getElementById('bmi-category');
    const bmiPointer = document.getElementById('bmi-scale-pointer');

    if (!weight || !height || height <= 0) {
      if (bmiValEl) bmiValEl.textContent = '--.-';
      if (bmiCatEl) bmiCatEl.textContent = 'Brak danych';
      if (bmiPointer) bmiPointer.style.left = '0%';
      return;
    }

    const bmi = (weight / ((height / 100) * (height / 100))).toFixed(1);
    if (bmiValEl) bmiValEl.textContent = bmi;

    let category = 'Prawidłowa';
    let color = 'var(--accent-green)';
    let percentage = 40;

    if (bmi < 18.5) {
      category = 'Niedowaga';
      color = 'var(--accent-blue)';
      percentage = Math.max(5, (bmi / 18.5) * 25);
    } else if (bmi < 25.0) {
      category = 'Prawidłowa waga';
      color = 'var(--accent-green)';
      percentage = 25 + ((bmi - 18.5) / 6.5) * 25;
    } else if (bmi < 30.0) {
      category = 'Nadwaga';
      color = 'var(--accent-orange)';
      percentage = 50 + ((bmi - 25.0) / 5.0) * 25;
    } else {
      category = 'Otyłość';
      color = 'var(--accent-red)';
      percentage = Math.min(95, 75 + ((bmi - 30.0) / 10.0) * 20);
    }

    if (bmiCatEl) {
      bmiCatEl.textContent = category;
      bmiCatEl.style.color = color;
    }
    if (bmiPointer) {
      bmiPointer.style.left = `${percentage}%`;
    }
  }

  function renderAchievements() {
    const gam = Gamification.getGamificationData();
    const info = Gamification.getLevelInfo(gam.xp);

    const levelEl = document.getElementById('gam-level');
    const xpEl = document.getElementById('gam-xp');
    const xpFill = document.getElementById('gam-xp-fill');
    const nextLevelEl = document.getElementById('gam-next-level');

    if (levelEl) levelEl.textContent = info.level;
    if (xpEl) xpEl.textContent = gam.xp;
    if (xpFill) xpFill.style.width = `${info.progress * 100}%`;
    if (nextLevelEl) nextLevelEl.textContent = `Do następnego poziomu: ${info.nextThreshold - gam.xp} XP`;

    const dashLevel = document.getElementById('dash-level');
    const dashXpFill = document.getElementById('dash-xp-fill');
    const dashXpTxt = document.getElementById('dash-xp-txt');
    if (dashLevel) dashLevel.textContent = info.level;
    if (dashXpFill) dashXpFill.style.width = `${info.progress * 100}%`;
    if (dashXpTxt) dashXpTxt.textContent = `${gam.xp} XP`;

    const badges = Gamification.getAllBadges();
    const badgesGrid = document.getElementById('badges-grid');
    if (badgesGrid) {
      badgesGrid.innerHTML = badges.map(b => `
        <div class="badge-card ${b.unlocked ? 'unlocked' : 'locked'}" title="${b.desc}">
          <div class="badge-card__icon">${b.unlocked ? b.icon : '🔒'}</div>
          <div class="badge-card__name">${b.name}</div>
          <div class="badge-card__desc">${b.desc}</div>
        </div>
      `).join('');
    }

    const challenges = Gamification.getActiveChallenges();
    const challengesList = document.getElementById('challenges-list');
    if (challengesList) {
      challengesList.innerHTML = challenges.map(ch => {
        const pct = Math.round((ch.progress / ch.target) * 100);
        return `
          <div class="challenge-card ${ch.completed ? 'completed' : ''}">
            <div class="challenge-card__icon">${ch.icon}</div>
            <div class="challenge-card__info">
              <div class="challenge-card__name">${ch.name}</div>
              <div class="challenge-card__desc">${ch.desc}</div>
              <div class="challenge-card__progress-container">
                <div class="challenge-card__progress-bar">
                  <div class="challenge-card__progress-fill" style="width: ${pct}%"></div>
                </div>
                <div class="text-xs text-muted" style="margin-left:8px; white-space:nowrap">${ch.progress} / ${ch.target}</div>
              </div>
            </div>
            <div class="challenge-card__reward">+${ch.xpReward} XP</div>
          </div>
        `;
      }).join('');
    }
  }
})();
