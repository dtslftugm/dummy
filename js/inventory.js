/**
 * DTSL Device Inventory Logic v2.1
 * Handles real-time monitoring, bulk selection, and dynamic remote commands
 */

let allDevices = [];
let selectedUuids = new Set();
let currentModalUuids = []; // Context for the active command modal

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('inventory_auth') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        fetchDevices();
    }

    // Select All Listener
    document.getElementById('selectAll').addEventListener('change', function() {
        toggleSelectAll(this.checked);
    });
});

/** Auth */
function handleLogin() {
    const pass = document.getElementById('auth-password').value;
    if (pass === 'DTSL#Admin#2026') {
        sessionStorage.setItem('inventory_auth', 'true');
        document.getElementById('login-overlay').style.display = 'none';
        fetchDevices();
    } else { alert('Password Salah!'); }
}

/** Data Fetching */
async function fetchDevices() {
    showLoading(true);
    try {
        const response = await fetch(window.CONFIG.INVENTORY_API_URL);
        const result = await response.json();
        if (result.success) {
            allDevices = result.data;
            renderTable(allDevices);
            updateStats(allDevices);
        } else { showToast('Error: ' + result.message, 'danger'); }
    } catch (err) {
        showToast('Connection Error: Gagal menghubungi API Inventory', 'danger');
    } finally { showLoading(false); }
}

/** Table Rendering */
function renderTable(devices) {
    const tbody = document.getElementById('deviceTable');
    tbody.innerHTML = '';
    const now = new Date();

    devices.sort((a, b) => a.name.localeCompare(b.name)).forEach(d => {
        const updatedAt = d.updated_at ? new Date(d.updated_at) : null;
        const diffMinutes = updatedAt ? (now - updatedAt) / (1000 * 60) : 999;
        
        let statusClass = 'bg-danger-subtle text-danger';
        let statusText = 'Offline';
        if (diffMinutes < 10) { statusClass = 'bg-success-subtle text-success'; statusText = 'Online'; }
        else if (diffMinutes < 60) { statusClass = 'bg-warning-subtle text-warning'; statusText = 'Late'; }

        const isChecked = selectedUuids.has(d.uuid);
        const row = document.createElement('tr');
        row.className = isChecked ? 'table-active' : '';
        row.innerHTML = `
            <td class="ps-4">
                <input type="checkbox" class="form-check-input row-select" 
                       ${isChecked ? 'checked' : ''} 
                       onchange="handleSelect('${d.uuid}', this.checked)">
            </td>
            <td class="fw-bold outfit" style="cursor:pointer" onclick="showDetail('${d.uuid}')">${d.name}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td><code class="text-secondary small">${d.ip_addresses}</code></td>
            <td>
                <div class="d-flex gap-1">
                    ${d.rustdesk_id && d.rustdesk_id !== 'N/A' ? `<span class="badge bg-primary text-white">RD</span>` : ''}
                    ${d.anydesk_id && d.anydesk_id !== 'N/A' ? `<span class="badge bg-danger text-white">AD</span>` : ''}
                    ${d.teamviewer_id && d.teamviewer_id !== 'N/A' ? `<span class="badge bg-info text-white">TV</span>` : ''}
                </div>
            </td>
            <td class="text-end pe-4">
                <button class="btn btn-sm btn-outline-emerald rounded-pill px-3" onclick="showDetail('${d.uuid}')">Manage</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    updateBulkBar();
}

/** Selection Logic */
function handleSelect(uuid, checked) {
    if (checked) selectedUuids.add(uuid);
    else selectedUuids.delete(uuid);
    renderTable(allDevices); // Re-render to update row styles
}

function toggleSelectAll(checked) {
    if (checked) allDevices.forEach(d => selectedUuids.add(d.uuid));
    else selectedUuids.clear();
    renderTable(allDevices);
}

function clearSelection() {
    selectedUuids.clear();
    document.getElementById('selectAll').checked = false;
    renderTable(allDevices);
}

function updateBulkBar() {
    const bar = document.getElementById('bulkBar');
    const count = selectedUuids.size;
    document.getElementById('selectedCount').innerText = count;
    bar.classList.toggle('d-none', count === 0);
}

/** Modals Management */
function showDetail(uuid) {
    const d = allDevices.find(x => x.uuid === uuid);
    if (!d) return;
    currentModalUuids = [uuid];
    
    document.getElementById('modal-hostname').innerText = d.name;
    document.getElementById('modal-manu').innerText = d.manufacturer;
    document.getElementById('modal-model').innerText = d.model;
    document.getElementById('modal-cpu').innerText = d.processor_type;
    document.getElementById('modal-ram').innerText = d.memory_total_size;
    document.getElementById('modal-sn').innerText = d.serial_number;
    document.getElementById('modal-ip').innerText = d.ip_addresses;
    document.getElementById('modal-rustdesk').innerText = d.rustdesk_id || 'N/A';
    document.getElementById('modal-anydesk').innerText = d.anydesk_id || 'N/A';

    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

function openSingleCommand() {
    bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
    const d = allDevices.find(x => x.uuid === currentModalUuids[0]);
    document.getElementById('command-target-name').innerText = d.name;
    showCommandModal();
}

function openBulkModal() {
    currentModalUuids = Array.from(selectedUuids);
    document.getElementById('command-target-name').innerText = `${currentModalUuids.length} Perangkat Terpilih`;
    showCommandModal();
}

function showCommandModal() {
    document.getElementById('command-type').value = '';
    document.getElementById('command-params').classList.add('d-none');
    new bootstrap.Modal(document.getElementById('commandModal')).show();
}

/** Dynamic Command Inputs */
function updateCommandInputs() {
    const type = document.getElementById('command-type').value;
    const container = document.getElementById('command-params');
    container.innerHTML = '';
    container.classList.remove('d-none');

    if (!type) { container.classList.add('d-none'); return; }

    const fields = {
        'create-user': ['Username', 'Password (none for blank)'],
        'reset-password': ['Username', 'Password Baru'],
        'reset-anydesk': ['Password Baru'],
        'rename-computer': ['Host Name Baru (A-Z, 0-9, -)']
    };

    if (fields[type]) {
        fields[type].forEach((label, idx) => {
            const div = document.createElement('div');
            div.className = 'mb-3';
            div.innerHTML = `
                <label class="form-label extra-small fw-bold text-muted">${label}</label>
                <input type="text" class="form-control form-control-sm rounded-3 cmd-input" data-index="${idx}" placeholder="Input ${label.split(' ')[0]}...">
            `;
            container.appendChild(div);
        });
    } else {
        container.innerHTML = `<p class="text-center text-muted small mb-0 py-2">Perintah ini tidak memerlukan parameter tambahan.</p>`;
    }
}

/** Command Execution */
async function executeCommand() {
    const type = document.getElementById('command-type').value;
    if (!type) return alert('Pilih jenis perintah!');

    const inputs = document.querySelectorAll('.cmd-input');
    const params = Array.from(inputs).map(i => i.value.trim());

    // Validation
    if (inputs.length > 0 && params.some(p => p === '')) {
        return alert('Harap isi semua parameter perintah!');
    }

    // Build command string based on type
    let finalCommand = type;
    if (params.length > 0) {
        finalCommand = `${type}:${params.join(':')}`;
    }

    showLoading(true);
    try {
        const response = await fetch(window.CONFIG.INVENTORY_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                path: 'update-command',
                uuids: currentModalUuids,
                command: finalCommand
            })
        });

        showToast(`✅ Perintah "${type}" dijadwalkan untuk ${currentModalUuids.length} PC.`, 'success');
        bootstrap.Modal.getInstance(document.getElementById('commandModal')).hide();
        clearSelection();
        setTimeout(fetchDevices, 2000);
    } catch (err) {
        showToast('Gagal mengirim perintah: ' + err.message, 'danger');
    } finally {
        showLoading(false);
    }
}

/** Stats */
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

/** WOL */
async function sendWOL() {
    const mac = document.getElementById('wol-mac').value.trim();
    if (!mac) return alert('Masukkan MAC address!');
    showLoading(true);
    try {
        const response = await fetch(window.CONFIG.GATEWAY_URL + '/wake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mac: mac })
        });
        const result = await response.json();
        if (result.success) {
            showToast('⚡ Magic Packet berhasil dikirim!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('wolModal')).hide();
        } else { showToast('Gateway Error: ' + result.message, 'danger'); }
    } catch (err) { showToast('Gateway Offline: Pastikan Gateway Lokal aktif.', 'danger'); }
    finally { showLoading(false); }
}

function showWOLModal() { new bootstrap.Modal(document.getElementById('wolModal')).show(); }
function showLoading(show) { document.getElementById('loading').style.display = show ? 'flex' : 'none'; }
function showToast(msg, type = 'success') {
    const toastEl = document.getElementById('liveToast');
    document.getElementById('toast-body').innerText = msg;
    toastEl.querySelector('.toast-header').className = `toast-header text-white bg-${type === 'danger' ? 'danger' : 'emerald-700'}`;
    new bootstrap.Toast(toastEl).show();
}

/** Copy Config Helper */
function copyConfig() {
    const d = allDevices.find(x => x.uuid === currentModalUuids[0]);
    const text = `Name: ${d.name}\nIP: ${d.ip_addresses}\nMAC: ${d.mac_addresses}\nRustDesk: ${d.rustdesk_id}`;
    navigator.clipboard.writeText(text).then(() => showToast('Config disalin ke clipboard!'));
}

const style = document.createElement('style');
style.innerHTML = `
    .bg-emerald-700 { background-color: #047857 !important; }
    .extra-small { font-size: 0.7rem; }
    .table-active { background-color: #ecfdf5 !important; }
`;
document.head.appendChild(style);
