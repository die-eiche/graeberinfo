const content = document.getElementById('content');
const refreshButton = document.getElementById('refresh');
const apiBase = (window.WERHATDIENST_CONFIG && window.WERHATDIENST_CONFIG.apiBase) || '';

function renderDays(data) {
  content.innerHTML = data.days.map(day => `
    <section class="day-card">
      <div class="day-title">${day.weekday}, ${day.date}</div>
      <div class="staff">
        ${day.staff.length
          ? day.staff.join(', ')
          : `<span class="note">${day.note || 'Kein Dienst eingetragen.'}</span>`}
      </div>
    </section>
  `).join('');
}

async function loadData() {
  content.innerHTML = '<p>Lade Dienste…</p>';
  refreshButton.disabled = true;

  try {
    const response = await fetch(`${apiBase}/api/dienste?t=${Date.now()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Fehler beim Laden');
    }

    renderDays(data);
  } catch (error) {
    content.innerHTML = `<div class="error"><strong>Fehler:</strong> ${error.message}</div>`;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', loadData);
loadData();
