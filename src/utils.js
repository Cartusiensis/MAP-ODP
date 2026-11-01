/* ============================
   UTILITIES
============================ */
export function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('show');
    document.getElementById('sidebar-overlay').classList.toggle('show');
}

// On mobile the sidebar covers the map; hide it once an action should show something there
export function closeSidebar() {
    if (document.getElementById('sidebar').classList.contains('show')) toggleSidebar();
}

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const colors = {
        success: 'bg-green-900/90 border-green-700/60 text-green-200',
        error: 'bg-red-900/90 border-red-700/60 text-red-200',
        info: 'bg-card border-border text-fg'
    };
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast-item pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border backdrop-blur-md text-sm font-medium shadow-xl ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} text-xs"></i><span>${escHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3000);
}

export function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

export function formatDistance(meters) {
    return meters < 1000
        ? `${Math.round(meters).toLocaleString()} m`
        : `${(meters / 1000).toFixed(2)} km`;
}
