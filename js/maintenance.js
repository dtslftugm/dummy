/**
 * Maintenance Management Logic (Standardized)
 */

// Instances are already created in api-client.js and ui-helper.js
// var api = new APIClient(); 
// var ui = (global ui object from ui-helper.js)
var maintenanceList = [];
var allComputers = [];
var processModal;
var manualModal;

document.addEventListener('DOMContentLoaded', function () {
    processModal = new bootstrap.Modal(document.getElementById('processMaintenanceModal'));
    manualModal = new bootstrap.Modal(document.getElementById('manualMaintenanceModal'));
    loadMaintenanceData();
    loadAllComputers();

    // Search listener
    var searchInput = document.getElementById('maintenanceSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            renderMaintenanceTable(e.target.value);
        });
    }

    // Auth check (Optional but recommended)
    var token = localStorage.getItem('adminAuthToken');
    if (!token) {
        window.location.href = 'admin.html';
    }
});

function loadMaintenanceData() {
    ui.loading("Memuat data maintenance...");

    api.run('apiGetMaintenanceList')
        .then(function (res) {
            ui.hideLoading();
            if (res.success) {
                maintenanceList = res.data || [];
                renderMaintenanceTable();
                renderLogTable(res.logs || []); // If backend provides logs
            } else {
                ui.error("Gagal memuat data: " + res.message);
            }
        })
        .catch(function (err) {
            ui.hideLoading();
            ui.error("Error: " + err);
        });
}

function renderMaintenanceTable(query) {
    var tbody = document.getElementById('maintenanceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var filter = query || '';
    var filtered = maintenanceList.filter(function (item) {
        var q = filter.toLowerCase();
        return (item.targetName || "").toLowerCase().indexOf(q) !== -1 ||
            (item.requestId || "").toLowerCase().indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5 text-muted">Tidak ada data maintenance ditemukan.</td></tr>';
        return;
    }

    filtered.forEach(function (item) {
        var tr = document.createElement('tr');

        var statusClass = 'bg-secondary';
        var statusText = item.status || 'In Maintenance';

        var cleanStatus = statusText.toLowerCase();
        if (cleanStatus.indexOf('maintenance') !== -1) { statusClass = 'bg-warning text-dark'; }
        else if (cleanStatus.indexOf('repair') !== -1) { statusClass = 'bg-danger'; }
        else if (cleanStatus.indexOf('revoked') !== -1) { statusClass = 'bg-warning text-dark'; }
        else if (cleanStatus.indexOf('available') !== -1) { statusClass = 'bg-success'; }

        tr.innerHTML = '<td>' +
            '<span class="badge ' + (item.type === 'PC' ? 'bg-primary' : 'bg-info') + ' mb-1" style="font-size: 10px;">' + item.type + '</span><br>' +
            '<span class="fw-bold">' + item.targetName + '</span>' +
            '</td>' +
            '<td><span class="status-badge ' + statusClass + '">' + statusText.toUpperCase() + '</span></td>' +
            '<td>' +
            '<div class="small fw-bold">' + (item.lastUser || '-') + '</div>' +
            '<div class="text-muted extra-small">ID: ' + (item.requestId || '-') + '</div>' +
            '</td>' +
            '<td>' +
            '<div class="small">' + (item.lastMaintenance || '-') + '</div>' +
            '<div class="text-muted extra-small">' + (item.daysAgo || 0) + ' hari lalu</div>' +
            '</td>' +
            '<td class="text-center pe-4">' +
            // Use rowIndex + requestId as a pseudo-unique identifier so identical software names don't clash
            '<button class="btn btn-primary btn-sm rounded-pill px-3" onclick="openMaintenanceModal(\'' + (item.requestId || 'N/A') + '\', \'' + item.type + '\', \'' + item.targetName.replace(/'/g, "\\'") + '\')">Proses</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

function renderLogTable(logs) {
    var tbody = document.getElementById('logTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // This part depends on backend giving separate logs
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-3 text-muted">Histori belum tersedia.</td></tr>';
        return;
    }
}

function openMaintenanceModal(reqId, type, originalName) {
    // Find item precisely by requestId AND name
    var item = maintenanceList.find(function (i) {
        var idMatch = reqId === 'N/A' ? (!i.requestId || i.requestId === 'N/A') : (i.requestId === reqId);
        return idMatch && i.type === type && i.targetName === originalName;
    });

    // Fallback if exact match fails (e.g. legacy data)
    if (!item) {
        item = maintenanceList.find(function (i) { return i.targetName === originalName && i.type === type; });
    }
    if (!item) return;

    document.getElementById('m-target-name').textContent = item.targetName;
    // We attach the unique requestId onto the modal element as a dataset so `completeMaintenance` can use it safely
    document.getElementById('m-target-name').dataset.reqid = item.requestId || "";

    document.getElementById('m-target-type').value = type;
    document.getElementById('maintenanceForm').reset();

    // Vendor Specific Variables
    var vendorSection = document.getElementById('m-vendor-instructions-section');
    var vendorManualSearch = document.getElementById('vendor-manual-search');
    var vendorAllowlistGen = document.getElementById('vendor-allowlist-generation');
    var vendorAllowlistResult = document.getElementById('vendor-allowlist-result');

    // Context-aware labels
    var lblStorage = document.querySelector('label[for="check-storage"]');
    var lblJunk = document.querySelector('label[for="check-junk"]');
    var lblAnydesk = document.querySelector('label[for="check-anydesk"]');

    if (type === 'License') {
        lblStorage.textContent = 'Hapus dari Cloud Vendor Dashboard';
        lblJunk.textContent = 'Verifikasi Status Revoked';
        lblAnydesk.textContent = 'Email Konfirmasi (Optional)';
        document.getElementById('m-storage').placeholder = 'ID Lisensi / Key';

        var anydeskSection = document.getElementById('m-anydesk-section');
        if (anydeskSection) anydeskSection.style.display = 'none';

        // Show Vendor Instructions
        if (vendorSection) {
            vendorSection.style.display = 'block';

            // Hide the unified check-vendor for standalone licenses to avoid double-checkboxes
            var checkVendorWrapper = document.getElementById('check-vendor').closest('.form-check');
            if (checkVendorWrapper) checkVendorWrapper.style.display = 'none';

            var vendorName = (item.vendor || "").toString().toLowerCase();

            if (vendorName.indexOf('geoslope') !== -1 || vendorName.indexOf('bentley') !== -1) {
                vendorManualSearch.style.display = 'block';
                vendorAllowlistGen.style.display = 'none';
                document.getElementById('m-vendor-name').value = item.userName || "";
                document.getElementById('m-vendor-email').value = item.userEmail || "";
            } else if (vendorName.indexOf('fine') !== -1 || vendorName.indexOf('rocscience') !== -1) {
                vendorManualSearch.style.display = 'none';
                vendorAllowlistGen.style.display = 'block';
                vendorAllowlistResult.style.display = 'none'; // hidden until generated

                // Store software name on the button for the generator
                document.getElementById('btnGenerateAllowlist').dataset.software = item.targetName;
            } else {
                vendorSection.style.display = 'none'; // fallback
            }
        }
    } else {
        lblStorage.textContent = 'Cek Storage';
        lblJunk.textContent = 'Hapus File Sampah';
        lblAnydesk.textContent = 'Cek Koneksi AnyDesk';
        document.getElementById('m-storage').placeholder = 'Misal: 1400GB Free / OK';

        var anydeskSection = document.getElementById('m-anydesk-section');
        if (anydeskSection) {
            anydeskSection.style.display = 'block';
            document.getElementById('m-anydesk-id').value = item.anydeskId && item.anydeskId !== "-" ? item.anydeskId : '-';
            document.getElementById('m-anydesk-pass').value = item.anydeskPassword || '';
        }

        // Feature: Consolidated License + PC card support
        if (vendorSection) {
            if (item.pendingLicenseCleanup && item.pendingLicenses && item.pendingLicenses.length > 0) {
                vendorSection.style.display = 'block';

                var checkVendorWrapper = document.getElementById('check-vendor').closest('.form-check');
                if (checkVendorWrapper) checkVendorWrapper.style.display = 'block';
                document.getElementById('check-vendor').checked = false;

                // For simplicity in the UI, we take the primary/first license vendor rules
                var primaryLicense = item.pendingLicenses[0];
                var vendorName = (primaryLicense.vendor || "").toString().toLowerCase();

                if (vendorName.indexOf('geoslope') !== -1 || vendorName.indexOf('bentley') !== -1) {
                    vendorManualSearch.style.display = 'block';
                    vendorAllowlistGen.style.display = 'none';
                    document.getElementById('m-vendor-name').value = item.licenseUserName || "";
                    document.getElementById('m-vendor-email').value = item.licenseUserEmail || "";
                    document.getElementById('lbl-vendor').textContent = '✅ Saya telah menghapus user dari Dashboard Vendor (' + primaryLicense.vendor + ')';
                } else if (vendorName.indexOf('fine') !== -1 || vendorName.indexOf('rocscience') !== -1) {
                    vendorManualSearch.style.display = 'none';
                    vendorAllowlistGen.style.display = 'block';
                    vendorAllowlistResult.style.display = 'none'; // hidden until generated

                    // Store software name on the button for the generator
                    document.getElementById('btnGenerateAllowlist').dataset.software = primaryLicense.name;
                    document.getElementById('lbl-vendor').textContent = '✅ Saya telah menerapkan Allowlist baru di Server';
                } else {
                    vendorSection.style.display = 'none'; // fallback
                }
            } else {
                vendorSection.style.display = 'none';
            }
        }
    }

    // Pre-fill issues and notes if available
    if (item.notes) {
        var rawNotes = item.notes;
        var issueText = "";
        var noteText = "";

        // Specifically handled the logic created by apiUpdateMaintenanceStatus or apiSetManualMaintenance
        if (rawNotes.indexOf('[ISSUE]') !== -1 || rawNotes.indexOf('[NOTE]') !== -1 || rawNotes.indexOf('[MANUAL]') !== -1) {

            if (rawNotes.indexOf('[MANUAL]') !== -1) {
                // If it's a manual entry without explicit tags
                issueText = rawNotes.replace('[MANUAL]', '').trim();
            } else {
                // Parse [ISSUE] and [NOTE] tags
                var splitIssue = rawNotes.split('[NOTE]');

                var issuePart = splitIssue[0];
                var notePart = splitIssue.length > 1 ? splitIssue[1] : "";

                if (issuePart.indexOf('[ISSUE]') !== -1) {
                    issueText = issuePart.replace('[ISSUE]', '').trim();
                }

                noteText = notePart.trim();
            }
        } else if (item.status && (item.status.indexOf('Pending Repair') !== -1 || item.status.indexOf('Maintenance') !== -1)) {
            // Milestone 19 Fix: Automated maintenance messages should NOT be treated as hardware issues
            var lowerNotes = rawNotes.toLowerCase();
            if (lowerNotes.indexOf('maintenance required') !== -1 || lowerNotes.indexOf('license/session expired') !== -1) {
                noteText = rawNotes; // Put in Resolution box
                issueText = "";      // Keep issues empty
            } else {
                // Fallback for older notes/actual issues without tags
                issueText = rawNotes;
            }
        }

        document.getElementById('m-issues').value = issueText;
        document.getElementById('m-resolution').value = noteText;
    }

    processModal.show();
}

function loadAllComputers() {
    api.run('apiGetAllComputerNames')
        .then(function (res) {
            if (res.success) {
                allComputers = res.data || [];
                var datalist = document.getElementById('computerList');
                if (datalist) {
                    datalist.innerHTML = '';
                    allComputers.forEach(function (comp) {
                        var opt = document.createElement('option');
                        opt.value = comp.name;
                        opt.textContent = comp.status;
                        datalist.appendChild(opt);
                    });
                }
            }
        });
}

function openManualMaintenanceModal() {
    document.getElementById('manual-comp-name').value = '';
    document.getElementById('manual-issue').value = '';
    manualModal.show();
}

function submitManualMaintenance() {
    var compName = document.getElementById('manual-comp-name').value.trim();
    var issue = document.getElementById('manual-issue').value.trim();

    if (!compName) {
        ui.warning("Pilih atau ketik nama komputer.", "Data Kurang lengkap");
        return;
    }

    ui.loading("Menambahkan ke antrean...");
    api.run('apiSetManualMaintenance', { computerName: compName, issue: issue })
        .then(function (res) {
            ui.hideLoading();
            if (res.success) {
                manualModal.hide();
                ui.success(res.message);
                loadMaintenanceData(); // Refresh table
            } else {
                ui.error(res.message);
            }
        })
        .catch(function (err) {
            ui.hideLoading();
            ui.error("Error: " + err);
        });
}

function saveMaintenanceProgress() {
    var name = document.getElementById('m-target-name').textContent;
    var issues = document.getElementById('m-issues').value;

    if (!issues.trim()) {
        ui.warning("Isi bagian 'Masalah Ditemukan' untuk menyimpan sebagai Pending Repair.", "Info Diperlukan");
        return;
    }

    var data = {
        computerName: name,
        issues: issues,
        resolution: document.getElementById('m-resolution').value,
        storage: document.getElementById('m-storage').value,
        mType: document.getElementById('m-type').value,
        checkStorage: document.getElementById('check-storage').checked,
        checkJunk: document.getElementById('check-junk').checked,
        checkAnydesk: document.getElementById('check-anydesk').checked,
        status: 'Pending Repair'
    };

    updateStatus(data, 'apiUpdateMaintenanceStatus');
}

function completeMaintenance() {
    var name = document.getElementById('m-target-name').textContent;
    var type = document.getElementById('m-target-type').value;
    var typeBadge = document.getElementById('m-target-type-badge') ? document.getElementById('m-target-type-badge').textContent : type;
    var isPcPlusLicense = (type === 'PC' && document.getElementById('m-vendor-instructions-section').style.display === 'block');

    if (!document.getElementById('check-storage').checked || !document.getElementById('check-junk').checked) {
        ui.warning("Pastikan tugas utama sudah dicentang.", "Ceklis Belum Lengkap");
        return;
    }

    if (isPcPlusLicense && !document.getElementById('check-vendor').checked) {
        ui.warning("Pastikan Anda sudah mencentang konfirmasi pengelolaan Lisensi.", "Aksi Lisensi Belum Selesai");
        return;
    }

    var data = {
        computerName: name,
        issues: document.getElementById('m-issues').value,
        resolution: document.getElementById('m-resolution').value,
        storage: document.getElementById('m-storage').value,
        mType: document.getElementById('m-type').value,
        checkStorage: document.getElementById('check-storage').checked,
        checkJunk: document.getElementById('check-junk').checked,
        checkAnydesk: document.getElementById('check-anydesk').checked,
        hasLicenseCleanup: isPcPlusLicense,
        status: 'Available'
    };

    // Include the requestId
    data.requestId = document.getElementById('m-target-name').dataset.reqid || "";

    console.log("[DEBUG] completeMaintenance: payload", data);
    console.log("[DEBUG] isPcPlusLicense", isPcPlusLicense, "requestId", data.requestId);

    // Use specific API for standalone licenses if needed
    var apiMethod = (type === 'License') ? 'apiCompleteLicenseCleanup' : 'apiCompleteMaintenance';

    updateStatus(data, apiMethod);
}

function updateStatus(data, apiMethod) {
    ui.loading("Menyimpan data...");

    api.run(apiMethod, data)
        .then(function (res) {
            console.log("[DEBUG] updateStatus res", res);
            ui.hideLoading();
            if (res.success) {
                processModal.hide();
                ui.success("Berhasil diupdate.");
                loadMaintenanceData();
            } else {
                ui.error("Gagal: " + res.message);
            }
        })
        .catch(function (err) {
            ui.hideLoading();
            ui.error("Error: " + err);
        });
}

function copyMaintenanceAnydeskCommand() {
    var pass = document.getElementById('m-anydesk-pass').value;
    var target = document.getElementById('m-anydesk-id').value.replace(/\s/g, '');

    if (!target || target === '-') {
        if (typeof ui !== 'undefined') ui.warning("ID AnyDesk tidak ditemukan.", "Data Kurang");
        return;
    }

    if (!pass) pass = "N/A";

    var cmd = 'echo ' + pass + ' | "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe" ' + target + ' --with-password';

    if (navigator.clipboard) {
        navigator.clipboard.writeText(cmd).then(function () {
            if (typeof ui !== 'undefined') ui.success("Command AnyDesk berhasil disalin ke clipboard.");
        });
    }
}

// Vendor Maintenance Functions
function copyVendorInput(elementId) {
    var elem = document.getElementById(elementId);
    if (!elem) return;

    var text = elem.value || elem.textContent;
    if (!text || text === "-") return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function () {
            if (typeof ui !== 'undefined') ui.success("Berhasil disalin: " + text.substring(0, 20) + (text.length > 20 ? "..." : ""));
        }).catch(function (err) {
            console.error('Copy failed: ', err);
        });
    } else {
        elem.select();
        document.execCommand('copy');
        if (typeof ui !== 'undefined') ui.success("Disalin.");
    }
}

function generateVendorAllowlist() {
    var btn = document.getElementById('btnGenerateAllowlist');
    var softwareName = btn.dataset.software;
    if (!softwareName) return;

    if (typeof ui !== 'undefined') ui.loading("Sedang menarik data wildcard dosen & pengguna aktif...");
    var resultDiv = document.getElementById('vendor-allowlist-result');
    var textArea = document.getElementById('m-vendor-allowlist-text');

    btn.disabled = true;

    // Fixed endpoint name below:
    api.run('admin-active-software-users', { softwareName: softwareName })
        .then(function (res) {
            if (typeof ui !== 'undefined') ui.hideLoading();
            btn.disabled = false;

            if (res.success) {
                textArea.value = res.data.allowlist;
                resultDiv.style.display = 'block';
                if (typeof ui !== 'undefined') ui.success("Berhasil men-generate daftar Allowlist.");
            } else {
                if (typeof ui !== 'undefined') ui.error("Gagal generate: " + res.message);
            }
        })
        .catch(function (err) {
            if (typeof ui !== 'undefined') ui.hideLoading();
            btn.disabled = false;
            if (typeof ui !== 'undefined') ui.error("Error mengambil list dari server: " + err);
        });
}
