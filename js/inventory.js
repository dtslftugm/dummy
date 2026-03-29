/**
 * DTSL Device Inventory Logic
 * Handles real-time monitoring and remote commands via Google Apps Script
 */

let allDevices = [];
let currentDeviceUuid = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if previously logged in (simple session)
    if (sessionStorage.getItem('inventory_auth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        fetchDevices();
    }
});

/**
 * Simple Authentication Handler
 */
function handleLogin() {
    const pass = document.getElementById('auth-password').value;
    // Simple password check (In real scenario, this would be more secure)
    if (pass === 'admin1234') {
        sessionStorage.setItem('inventory_auth', 'true');
        document.getElementById('login-overlay').style.display = 'none';
        fetchDevices();
    } else {
        alert('Password Salah!');
    }
}

/**
 * Fetch Device Data from Google Apps Script
 */
async function fetchDevices() {
    showLoading(true);
    try {
        const response = await fetch(window.CONFIG.INVENTORY_API_URL);
        const result = await response.json();

        if (result.success) {
            allDevices = result.data;
            renderTable(allDevices);
            updateStats(allDevices);
        } else {
            showToast('Error: ' + result.message, 'danger');
        }
    } catch (err) {
        showToast('Connection Error: Gagal menghubungi API Inventory', 'danger');
        console.error(err);
    } finally {
        showLoading(false);
    }
}

/**
 * Render Device Table
 */
function renderTable(devices) {
    const tbody = document.getElementById('deviceTable');
    tbody.innerHTML = '';

    const now = new Date();

    devices.sort((a, b) => a.name.localeCompare(b.name)).forEach(d => {
        // Status Check (Online if updated in last 10 minutes)
        const updatedAt = d.updated_at ? new Date(d.updated_at) : null;
        const diffMinutes = updatedAt ? (now - updatedAt) / (1000 * 60) : 999;
        
        let statusClass = 'bg-danger-subtle text-danger';
        let statusText = 'Offline';
        
        if (diffMinutes < 10) {
            statusClass = 'bg-success-subtle text-success';
            statusText = 'Online';
        } else if (diffMinutes < 60) {
            statusClass = 'bg-warning-subtle text-warning';
            statusText = 'Late Heartbeat';
        }

        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => showDetail(d.uuid);
        row.innerHTML = `
            <td class="ps-4 fw-bold outfit">${d.name}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><code class="text-secondary small">${d.ip_addresses}</code></td>
            <td><div class="small fw-semibold">${d.operating_system_name}</div><div class="extra-small text-muted">${d.processor_type}</div></td>
            <td>
                <div class="d-flex gap-1">
                    ${d.rustdesk_id && d.rustdesk_id !== 'N/A' ? `<span class="badge bg-primary text-white" title="RustDesk Ready">RD</span>` : ''}
                    ${d.anydesk_id && d.anydesk_id !== 'N/A' ? `<span class="badge bg-danger text-white" title="AnyDesk Ready">AD</span>` : ''}
                    ${d.teamviewer_id && d.teamviewer_id !== 'N/A' ? `<span class="badge bg-info text-white" title="TV Ready">TV</span>` : ''}
                </div>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-emerald rounded-pill px-3" onclick="event.stopPropagation(); showDetail('${d.uuid}')">Manage</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Filter devices by search input
 */
document.getElementById('searchInput').onkeyup = function() {
    const val = this.value.toLowerCase();
    const filtered = allDevices.filter(d => 
        d.name.toLowerCase().includes(val) || 
        d.ip_addresses.toLowerCase().includes(val) ||
        d.mac_addresses.toLowerCase().includes(val)
    );
    renderTable(filtered);
};

/**
 * Update Dashboard Stats
 */
function updateStats(devices) {
    const now = new Date();
    const online = devices.filter(d => {
        const up = d.updated_at ? new Date(d.updated_at) : null;
        return up && (now - up) / (1000 * 60) < 10;
    }).length;

    document.getElementById('stat-total').innerText = devices.length;
    document.getElementById('stat-online').innerText = online;
    document.getElementById('stat-offline').innerText = devices.length - online;
    document.getElementById('stat-alert').innerText = devices.filter(d => d.status && d.status.includes('Alert')).length;
}

/**
 * Show Device Details in Modal
 */
function showDetail(uuid) {
    const d = allDevices.find(x => x.uuid === uuid);
    if (!d) return;

    currentDeviceUuid = uuid;
    document.getElementById('modal-hostname').innerText = d.name;
    document.getElementById('modal-manu').innerText = d.manufacturer;
    document.getElementById('modal-model').innerText = d.model;
    document.getElementById('modal-cpu').innerText = d.processor_type;
    document.getElementById('modal-ram').innerText = d.memory_total_size;
    document.getElementById('modal-sn').innerText = d.serial_number;
    document.getElementById('modal-rustdesk').innerText = d.rustdesk_id || 'N/A';
    document.getElementById('modal-anydesk').innerText = d.anydesk_id || 'N/A';
    document.getElementById('modal-mac').innerText = d.mac_addresses;
    
    // Clear select
    document.getElementById('command-select').value = '';

    const modal = new bootstrap.Modal(document.getElementById('detailModal'));
    modal.show();
}

/**
 * Submit Remote Command
 */
async function submitCommand() {
    const cmd = document.getElementById('command-select').value;
    if (!cmd) return alert('Pilih perintah terlebih dahulu!');

    showLoading(true);
    try {
        const response = await fetch(window.CONFIG.INVENTORY_API_URL, {
            method: 'POST',
            mode: 'no-cors', // standard for GAS
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: 'update-command',
                uuid: currentDeviceUuid,
                command: cmd
            })
        });

        // "no-cors" doesn't return response body, assuming success if no error thrown
        showToast('✅ Perintah berhasil dijadwalkan. Akan dieksekusi saat Heartbeat berikutnya.', 'success');
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        setTimeout(fetchDevices, 2000); // Reload after brief delay
    } catch (err) {
        showToast('Failed to send command: ' + err.message, 'danger');
    } finally {
        showLoading(false);
    }
}

/**
 * Send WOL (Magic Packet) via Local Gateway
 */
async function sendWOL() {
    const mac = document.getElementById('wol-mac').value.trim();
    if (!mac) return alert('Masukkan MAC address!');

    showLoading(true);
    try {
        const gatewayUrl = window.CONFIG.GATEWAY_URL + '/wake';
        const response = await fetch(gatewayUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mac: mac })
        });
        const result = await response.json();

        if (result.success) {
            showToast('⚡ Magic Packet berhasil dikirim!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('wolModal')).hide();
        } else {
            showToast('Gateway Error: ' + result.message, 'danger');
        }
    } catch (err) {
        showToast('Gateway Offline: Pastikan Gateway Lokal (10.47.106.9) sudah aktif.', 'danger');
    } finally {
        showLoading(false);
    }
}

function showWOLModal() {
    new bootstrap.Modal(document.getElementById('wolModal')).show();
}

/**
 * Helpers
 */
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showToast(msg, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    const toastBody = document.getElementById('toast-body');
    toastBody.innerText = msg;
    
    // Set color based on type
    const header = toastEl.querySelector('.toast-header');
    header.className = `toast-header text-white bg-${type === 'danger' ? 'danger' : 'emerald-700'}`;
    
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

/** Custom CSS for emerald toast */
const style = document.createElement('style');
style.innerHTML = '.bg-emerald-700 { background-color: #047857 !important; }';
document.head.appendChild(style);
