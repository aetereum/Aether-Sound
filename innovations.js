// ===== INNOVACIONES: Reactividad musical, Selector de acento, Modo foco, Orden móvil =====
(function innovativeUI() {
  try {
    // 1) REACTIVIDAD MUSICAL GLOBAL
    let currentEnergy = 0;
    window.__setDeckEnergy = function(deckLetter, energy) {
      currentEnergy = Math.max(0, Math.min(1, energy || 0));
      document.documentElement.style.setProperty('--reactive', String(currentEnergy));
    };

    // 2) SELECTOR DE ACENTO (Chips en header)
    function initAccentPicker() {
      const header = document.querySelector('header');
      if (!header || header.querySelector('.accent-picker')) return;
      const picker = document.createElement('div');
      picker.className = 'accent-picker';
      picker.innerHTML = `
        <span>Acento:</span>
        <div class="accent-chip active" style="background: linear-gradient(135deg, #3aa0ff, #124cdb);" data-accent="blue" title="Azul"></div>
        <div class="accent-chip" style="background: linear-gradient(135deg, #7c4dff, #4527a0);" data-accent="purple" title="Púrpura"></div>
        <div class="accent-chip" style="background: linear-gradient(135deg, #00e5ff, #00acc1);" data-accent="cyan" title="Cian"></div>
        <div class="accent-chip" style="background: linear-gradient(135deg, #00ff95, #00c853);" data-accent="green" title="Verde"></div>
        <div class="accent-chip" style="background: linear-gradient(135deg, #ff6b6b, #d32f2f);" data-accent="red" title="Rojo"></div>
      `;
      picker.addEventListener('click', (e) => {
        const chip = e.target.closest('.accent-chip');
        if (!chip) return;
        picker.querySelectorAll('.accent-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const accent = chip.dataset.accent;
        const accents = {
          blue: { main: '#3aa0ff', secondary: '#9ad1ff' },
          purple: { main: '#7c4dff', secondary: '#b794f6' },
          cyan: { main: '#00e5ff', secondary: '#4dd0e1' },
          green: { main: '#00ff95', secondary: '#66ff99' },
          red: { main: '#ff6b6b', secondary: '#ff9999' },
        };
        if (accents[accent]) {
          document.documentElement.style.setProperty('--accent', accents[accent].main);
          document.documentElement.style.setProperty('--accent-2', accents[accent].secondary);
        }
      });
      header.appendChild(picker);
    }

    // 3) MODO FOCO (botón por panel + ESC para salir)
    function initFocusMode() {
      const panels = document.querySelectorAll('.panel');
      panels.forEach(panel => {
        if (panel.querySelector('.focus-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'focus-btn';
        btn.textContent = 'Foco';
        btn.addEventListener('click', () => {
          document.body.classList.add('focus-mode');
          panels.forEach(p => p.classList.remove('focused'));
          panel.classList.add('focused');
        });
        panel.appendChild(btn);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
          document.body.classList.remove('focus-mode');
          document.querySelectorAll('.panel.focused').forEach(p => p.classList.remove('focused'));
        }
      });
    }

    // 4) ORDEN MÓVIL INTELIGENTE + RESIZE LISTENER
    function smartReorder() {
      try {
        const grid = document.querySelector('main > section.grid');
        if (!grid) return;
        const isMobile = window.innerWidth <= 768;
        const mixer = document.querySelector('#mixer-pro');
        const credits = document.querySelector('#credits-panel');
        const pulses = document.querySelector('#pulses-panel');
        const bi = document.querySelector('#bi-panel');
        const outputsPanel = document.getElementById('output-list')?.closest('.panel');
        const orchestrPanel = document.getElementById('plan-pre')?.closest('.panel');
        const localPanel = document.getElementById('btn-composition')?.closest('.panel');
        const albumPanel = document.getElementById('album-title')?.closest('.panel');
        let desiredOrder;
        if (isMobile) {
          desiredOrder = [mixer, localPanel, outputsPanel, orchestrPanel, albumPanel, credits, pulses, bi];
        } else {
          desiredOrder = [mixer, outputsPanel, orchestrPanel, localPanel, credits, albumPanel, pulses, bi];
        }
        const filtered = desiredOrder.filter(Boolean);
        if (!filtered.length) return;
        // Solo reordenar si el primero difiere para evitar trabajo innecesario
        if (grid.firstElementChild === filtered[0]) return;
        filtered.forEach(el => {
          if (el && el.parentElement === grid) grid.appendChild(el);
        });
      } catch (_) {}
    }

    function initAll() {
      initAccentPicker();
      initFocusMode();
      smartReorder();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      initAll();
    } else {
      window.addEventListener('DOMContentLoaded', initAll, { once: true });
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(smartReorder, 300);
    });
  } catch (err) {
    console.warn('Innovative UI init error:', err);
  }
})();
