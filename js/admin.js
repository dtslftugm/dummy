/**
 * Admin Dashboard Logic for GitHub Pages
 * Menghubungkan UI admin.html dengan APIClient
 */

var pendingRequests = [];
var activeUsersList = [];
var currentUser = null;
var sessionToken = localStorage.getItem('adminAuthToken');

// Modal Objects (Global for access across functions)
var processModalObj = null;
var expiredModalObj = null;
var agendaModalObj = null;

// State management for process modal
var currentRequest = null;
var currentReassignedComputer = null;

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    setupUI();
    validateSession();
    loadAppBranding(); // Milestone 11 Branding

    // Login Form Handler
    var loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

function setupUI() {
    // Search filter (Now targeting Active Users, Milestone 18)
    var searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            renderActiveUsersTable(e.target.value);
        });
    }
}

function validateSession() {
    if (!sessionToken) {
        showLogin();
        return;
    }

    api.checkAuth(sessionToken)
        .then(function (res) {
            if (res.success && res.data && res.data.authenticated) {
                currentUser = res.data.user;
                showDashboard();
            } else {
                handleLogoutAction();
            }
        })
        .catch(function (err) {
            console.error("Auth check failed:", err);
            showLogin();
        });
}

function handleLogin(e) {
    if (e.preventDefault) e.preventDefault();
    var email = document.getElementById('login-email').value;
    var pass = document.getElementById('login-password').value;

    showLoading("Autentikasi...");
    api.adminLogin(email, pass)
        .then(function (res) {
            if (res.success && res.data) {
                localStorage.setItem('adminAuthToken', res.data.token);
                sessionToken = res.data.token;
                currentUser = res.data.user;
                showDashboard();
            } else {
                ui.error("Login Gagal: " + (res.message || "Email atau password salah"), "Login Error");
            }
        })
        .catch(function (err) {
            ui.error("Error: " + err.message, "System Error");
        })
        .finally(function () {
            hideLoading();
        });
}

function showDashboard() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('dashboard-app').style.display = 'block';
    document.getElementById('user-display-name').textContent = currentUser.nama;
    loadRequests();
    checkExpiringLicenses(); // Milestone 10
}

function showLogin() {
    document.getElementById('login-container').style.display = 'flex';
    document.getElementById('dashboard-app').style.display = 'none';
}

function handleLogout() {
    ui.confirm("Logout dari dashboard?", "Konfirmasi Logout")
        .then(function (confirmed) {
            if (confirmed) {
                handleLogoutAction();
            }
        });
}

function handleLogoutAction() {
    localStorage.removeItem('adminAuthToken');
    sessionToken = null;
    showLogin();
}

function loadRequests() {
    showLoading("Memuat data...");
    api.getAdminRequests()
        .then(function (res) {
            if (res.success) {
                pendingRequests = res.data || [];

                // Update stats
                if (res.stats) {
                    document.getElementById('count-pending').textContent = res.stats.pending || 0;
                    document.getElementById('count-active-users').textContent = res.stats.activeUsers || 0;
                    document.getElementById('count-expired').textContent = res.stats.toRevoke || 0;

                    // New Stats (Synced from GAS)
                    if (document.getElementById('count-maintenance')) {
                        document.getElementById('count-maintenance').textContent = (res.stats.labMaintenance || 0) + (res.stats.licenseMaintenance || 0);
                    }
                    if (document.getElementById('count-total-requests')) {
                        document.getElementById('count-total-requests').textContent =
                            (res.stats.labUsed || 0) + ' / ' + (res.stats.labTotal || 0) + ' PC';
                    }
                }

                renderTable();

                // Render Active Users
                if (res.activeUsers) {
                    activeUsersList = res.activeUsers.sort(function (a, b) {
                        // 1. Sort by Nama (Alphabetical Ascending)
                        var nameA = (a.nama || "").toLowerCase();
                        var nameB = (b.nama || "").toLowerCase();
                        if (nameA < nameB) return -1;
                        if (nameA > nameB) return 1;

                        // 2. Sort by Expired On (Ascending)
                        var dateA = new Date(a.expiredOn || 0).getTime();
                        var dateB = new Date(b.expiredOn || 0).getTime();

                        // If standard parse is successful, compare numerically
                        if (!isNaN(dateA) && !isNaN(dateB)) {
                            return dateA - dateB;
                        }

                        // Fallback: String Compare
                        var strA = a.expiredOn || "";
                        var strB = b.expiredOn || "";
                        if (strA < strB) return -1;
                        if (strA > strB) return 1;
                        return 0;
                    });
                    renderActiveUsersTable();
                } else {
                    activeUsersList = [];
                    renderActiveUsersTable();
                }

                // Load Maintenance if stats show some
                if (res.stats && res.stats.labMaintenance > 0) {
                    // Maintenance managed in maintenance.html
                }
            }
        })
        .catch(function (err) {
            console.error("Load requests failed:", err);
        })
        .finally(function () {
            hideLoading();
        });
}

function renderTable(filter) {
    var filterValue = filter || '';
    var tbody = document.getElementById('requestTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var query = filterValue.toLowerCase();
    var filtered = pendingRequests.filter(function (r) {
        var nama = (r.nama || "").toLowerCase();
        var rid = (r.requestId || "").toLowerCase();
        var nim = (r.nim || "").toLowerCase();
        return nama.indexOf(query) !== -1 || rid.indexOf(query) !== -1 || nim.indexOf(query) !== -1;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-5 text-muted">Tidak ada data permohonan baru.</td></tr>';
        return;
    }

    filtered.forEach(function (req) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' +
            '<div class="fw-bold">' + req.nama + '</div>' +
            '<div class="text-muted small">' + req.nim + ' | ID: ' + req.requestId + '</div>' +
            '</td>' +
            '<td>' +
            '<div class="small">' + req.software + '</div>' +
            '<div class="text-muted extra-small">' + req.roomPreference + '</div>' +
            '</td>' +
            '<td><span class="badge bg-light text-dark border">' + req.requestType + '</span></td>' +
            '<td class="text-center">' +
            '<button class="btn btn-primary btn-sm rounded-pill px-3" onclick="openProcessModal(\'' + req.requestId + '\')">Proses</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

function renderActiveUsersTable(filterText) {
    var tbody = document.getElementById('activeUsersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var query = (filterText || "").toLowerCase();

    // Default to the global list we saved during loadRequests
    var usersToRender = activeUsersList;

    // Apply filter if search input is active
    if (query !== "") {
        usersToRender = usersToRender.filter(function (u) {
            var nama = (u.nama || "").toLowerCase();
            var nim = (u.nim || "").toLowerCase();
            var rid = (u.requestId || "").toLowerCase();
            return nama.indexOf(query) !== -1 || nim.indexOf(query) !== -1 || rid.indexOf(query) !== -1;
        });
    }

    if (!usersToRender || usersToRender.length === 0) {
        if (query !== "") {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">Filter: Tidak ada user aktif yang sesuai dengan "' + filterText + '".</td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-4 text-muted">Tidak ada user aktif.</td></tr>';
        }
        return;
    }

    usersToRender.forEach(function (user) {
        var reqComputer = user.computer || '-';
        var tr = document.createElement('tr');

        // Make row clickable only if they need a computer AND it is assigned
        var hasComputer = user.needsComputer === true && (reqComputer && reqComputer !== '-');
        if (hasComputer) {
            tr.style.cursor = 'pointer';
            tr.onclick = function () { openActiveUserModal(user.nama, user.nim, reqComputer); };
        }

        tr.innerHTML = '<td>' +
            '<div class="fw-bold">' + (user.nama || "-") + '</div>' +
            '<div class="text-muted small">' + (user.nim || "-") + '</div>' +
            '<div class="text-muted extra-small">' + (user.email || "-") + '</div>' +
            '</td>' +
            '<td>' +
            '<div class="small fw-bold text-primary">' + (user.software || '-') + '</div>' +
            '<div class="text-muted small"><i class="bi bi-geo-alt"></i> ' + (user.room || '-') + '</div>' +
            '<div class="text-muted extra-small"><i class="bi bi-pc-display"></i> ' + (user.computer || '-') + '</div>' +
            '</td>' +
            '<td>' +
            '<div class="fw-bold small">' + (user.requestId || '-') + '</div>' +
            '<div class="text-danger extra-small">Berakhir: ' + (user.expiredOn || '-') + '</div>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

function scrollToActiveUsers() {
    var section = document.getElementById('active-users-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function handleFinishLicenseCleanup(requestId) {
    var checkLicense = document.getElementById('check-license-' + requestId);

    if (!checkLicense || !checkLicense.checked) {
        ui.warning("Konfirmasi bahwa user telah dihapus dari vendor dashboard.", "Ceklis Diperlukan");
        return;
    }

    ui.confirm("Selesaikan tugas cleanup untuk ID " + requestId + "?", "Selesaikan Cleanup")
        .then(function (confirmed) {
            if (!confirmed) return;

            showLoading("Memproses...");
            api.run('apiCompleteLicenseCleanup', { requestId: requestId })
                .then(function (res) {
                    if (res.success) {
                        ui.success("Berhasil: Tugas cleanup selesai.");
                        loadRequests();
                    } else {
                        ui.error("Gagal: " + res.message);
                    }
                })
                .catch(function (err) {
                    ui.error("Error: " + err.message);
                })
                .finally(function () {
                    hideLoading();
                });
        });
}

// Global functions for UI
window.loadRequests = loadRequests;
window.showSection = function (sectionId) {
    console.log("Switching to section:", sectionId);
};
window.scrollToActiveUsers = scrollToActiveUsers;
window.handleFinishLicenseCleanup = handleFinishLicenseCleanup;

/**
 * --- REQUEST PROCESSING LOGIC ---
 */

function openProcessModal(requestId) {
    var req = pendingRequests.find(function (r) { return r.requestId === requestId; });
    if (!req) return;

    if (!processModalObj) {
        processModalObj = new bootstrap.Modal(document.getElementById('processModal'));
    }

    currentRequest = req;
    currentReassignedComputer = null;

    // 1. Set Labels
    document.getElementById('modal-request-id').textContent = requestId;
    document.getElementById('modal-nama').textContent = req.nama || '-';
    document.getElementById('modal-nim').textContent = req.nim || '-';
    document.getElementById('modal-prodi').textContent = req.prodi || '-';

    var isNonUgm = req.prodi && req.prodi.indexOf('Non-UGM') === 0;
    var univContainer = document.getElementById('universitas-container');
    if (univContainer) univContainer.style.display = isNonUgm ? 'block' : 'none';
    var univEl = document.getElementById('modal-universitas');
    if (univEl) univEl.textContent = req.universitas || '-';

    var dosenEl = document.getElementById('modal-dosen');
    if (dosenEl) dosenEl.textContent = req.dosen || '-';

    // Renewal Identification & Badge
    var renewalBadge = document.getElementById('modal-renewal-badge');
    if (renewalBadge) {
        if (req.isRenewal) {
            renewalBadge.classList.remove('d-none');
        } else {
            renewalBadge.classList.add('d-none');
        }
    }

    var topikEl = document.getElementById('modal-topik');
    if (topikEl) topikEl.textContent = req.topik || '-';

    var keperluanEl = document.getElementById('modal-keperluan');
    if (keperluanEl) keperluanEl.textContent = req.keperluan || '-';

    var catatanEl = document.getElementById('modal-catatan');
    if (catatanEl) catatanEl.textContent = req.catatan || '-';

    document.getElementById('modal-request-type').textContent = req.requestType || '-';
    document.getElementById('modal-email').textContent = req.email || '-';

    var phoneLink = document.getElementById('modal-phone');
    if (phoneLink) {
        if (req.phone && req.phone.includes('wa.me')) {
            phoneLink.href = req.phone;
        } else {
            phoneLink.href = '#';
            phoneLink.textContent = req.phone || '📱 WhatsApp';
        }
    }

    // Render Software badges
    var swContainer = document.getElementById('modal-software');
    if (swContainer) {
        swContainer.innerHTML = '';
        if (req.software) {
            req.software.split(',').forEach(function (s) {
                var span = document.createElement('span');
                span.className = 'badge bg-light text-dark border small me-1';
                span.textContent = s.trim();
                swContainer.appendChild(span);
            });
        }
    }

    var docLink = document.getElementById('modal-doc-link');
    if (docLink) docLink.href = req.fileUrl || '#';

    // 2. Reset UI State & Inputs
    document.getElementById('admin-notes').value = '';
    var keyInput = document.getElementById('activation-key-input');
    var anydeskPasswordInput = document.getElementById('anydesk-password-input');
    if (keyInput) keyInput.value = '';
    if (anydeskPasswordInput) anydeskPasswordInput.value = '';

    // Visibility management
    var keyContainer = document.getElementById('activation-key-container');
    var anydeskPasswordContainer = document.getElementById('anydesk-password-container');
    var specContainer = document.getElementById('computer-specs-container');
    var serverLicenseContainer = document.getElementById('server-license-container');
    var reallocateSelector = document.getElementById('reallocate-selector');
    var specDetails = document.getElementById('spec-details-box');
    var winUserContainer = document.getElementById('check-win-user-container');

    // Default: Hide all optional sections
    if (keyContainer) keyContainer.classList.add('d-none');
    if (anydeskPasswordContainer) anydeskPasswordContainer.classList.add('d-none');
    if (specContainer) specContainer.classList.add('d-none');
    if (serverLicenseContainer) serverLicenseContainer.classList.add('d-none');
    if (reallocateSelector) reallocateSelector.classList.add('d-none');
    if (specDetails) specDetails.classList.remove('d-none');
    document.getElementById('reallocate-btn').innerText = "🔄 Change";

    if (winUserContainer) {
        winUserContainer.classList.add('d-none');
        document.getElementById('id-check-win-user').checked = false;
    }

    // 3. Logic-based Visibility & Content
    // Milestone 17 Fix: STRICT equality check for room consistency
    var isRuangPenelitian = (req.roomPreference === 'Ruang Penelitian');
    var daysToAdd = isRuangPenelitian ? 14 : 30;

    // Normalize Today to Midnight Local for calculation base
    var baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    // Logic: If renewal, use prevExpirationDate (standard Date parsing)
    if (req.isRenewal && req.prevExpirationDate) {
        // Parse the ISO string or Date object passed from backend
        var prevDate = new Date(req.prevExpirationDate);

        if (!isNaN(prevDate.getTime())) {
            // Ensure we only use the date part for comparison (prevent time-of-day edge cases)
            var normalizedPrev = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate());

            // If previous date is in the future, use it as building block
            if (normalizedPrev > baseDate) {
                baseDate = normalizedPrev;
            }
        }
    }

    // Final Calculation Result
    var expDate = new Date(baseDate.getTime());
    expDate.setDate(expDate.getDate() + daysToAdd);

    // Milestone 17: Format using project-standard method (adhering to local time)
    // toISOString() uses UTC, so we adjust by the timezone offset to keep it "Local"
    var tzOffset = expDate.getTimezoneOffset() * 60000; // in ms
    var localExpDate = new Date(expDate.getTime() - tzOffset);
    document.getElementById('expiration-date-input').value = localExpDate.toISOString().split('T')[0];

    // Activation Key / Borrow License (Clean labeling like GAS)
    if (req.needsKey || req.requestType === 'Borrow License') {
        if (keyContainer) {
            keyContainer.classList.remove('d-none');
            var label = document.getElementById('activation-key-label');
            if (label) {
                if (req.software && req.software.toLowerCase().includes('vissim')) {
                    label.textContent = "Borrow License / Activation Key";
                    if (keyInput) keyInput.placeholder = "Enter generated borrow key...";
                } else {
                    label.textContent = (req.requestType === 'Borrow License') ? "Activation Key (Manual)" : "License Key / Code";
                    if (keyInput) keyInput.placeholder = "Enter key from vendor...";
                }
            }
        }
    }

    // AnyDesk (Only for Research Room)
    if (req.roomPreference === 'Ruang Penelitian') {
        if (anydeskPasswordContainer) anydeskPasswordContainer.classList.remove('d-none');
        updateAnydeskPasswordUI();
    }

    // Server License Configuration
    if (serverLicenseContainer) {
        var isServerType = (req.requestType || "") === 'Akses Lisensi Server';
        if (req.needsServerInfo || isServerType || (req.computerUsername && req.computerHostname)) {
            serverLicenseContainer.classList.remove('d-none');
            var serverConfigInput = document.getElementById('server-license-config');
            var applicantConfigStr = "allow=" + (req.computerUsername || "") + "@" + (req.computerHostname || "");

            if (serverConfigInput) {
                if (isServerType && req.software) {
                    serverConfigInput.value = "Menarik data Dosen & User aktif dari server...";

                    // Fetch active users + dosen rules
                    api.run('admin-active-software-users', { softwareName: req.software })
                        .then(function (res) {
                            if (res.success && res.data && res.data.allowlist) {
                                // Combine existing rules with the new applicant
                                serverConfigInput.value = res.data.allowlist + "\n" + applicantConfigStr;
                            } else {
                                serverConfigInput.value = applicantConfigStr + "\n(Gagal menarik data list aktif: " + (res.message || "Unknown Error") + ")";
                            }
                        })
                        .catch(function (err) {
                            serverConfigInput.value = applicantConfigStr + "\n(" + err + ")";
                        });
                } else {
                    // Fallback for non-server type (or if software name is missing)
                    serverConfigInput.value = applicantConfigStr;
                }
            }
        }
    }

    // Computer Specs (Visibility based on Request Type & Preference)
    var reqType = req.requestType || "";
    var isLaptopPribadi = (req.roomPreference || "").toLowerCase().indexOf("laptop pribadi") !== -1;
    var isPureLicense = reqType.indexOf("Borrow License") !== -1 || reqType.indexOf("Cloud License") !== -1 || reqType.indexOf("Akses Lisensi Server") !== -1;
    var noComputerNeeded = isLaptopPribadi || isPureLicense;

    var computerToShow = req.preferredComputer;
    var hasValidComputer = computerToShow && computerToShow !== 'Auto Assign' && computerToShow !== 'Belum Dialokasikan';

    if (hasValidComputer || !noComputerNeeded) {
        specContainer.classList.remove('d-none');

        if (hasValidComputer) {
            document.getElementById('spec-name').textContent = computerToShow;
            api.jsonpRequest('admin-get-computer-details', { computerName: computerToShow })
                .then(function (res) {
                    if (res.success && res.data) {
                        document.getElementById('spec-anydesk').textContent = res.data.anydeskId || '-';
                        document.getElementById('spec-ip').textContent = res.data.ipAddress || '-';
                        document.getElementById('spec-location').textContent = res.data.location || '-';

                        if (req.roomPreference === 'Ruang Penelitian' && anydeskPasswordInput) {
                            if (res.data.anydeskPassword) anydeskPasswordInput.value = res.data.anydeskPassword;
                        }
                    }
                });
        } else {
            document.getElementById('spec-name').textContent = "Belum Dialokasikan";
            document.getElementById('spec-anydesk').textContent = '-';
            document.getElementById('spec-ip').textContent = '-';
            document.getElementById('spec-location').textContent = '-';
        }
    }

    // Show Windows User check only for Computer access
    if (winUserContainer && !noComputerNeeded) {
        winUserContainer.classList.remove('d-none');
    }

    processModalObj.show();
}

function toggleReallocate() {
    var selector = document.getElementById('reallocate-selector');
    var details = document.getElementById('spec-details-box');
    var btn = document.getElementById('reallocate-btn');

    if (selector.classList.contains('d-none')) {
        selector.classList.remove('d-none');
        details.classList.add('d-none');
        btn.innerText = "✖ Cancel";
        loadAvailableComputers();
    } else {
        selector.classList.add('d-none');
        details.classList.remove('d-none');
        btn.innerText = "🔄 Change";
    }
}

function loadAvailableComputers() {
    var select = document.getElementById('replacement-computer-select');
    select.innerHTML = '<option value="">Memuat...</option>';

    api.getAvailableComputers()
        .then(function (res) {
            select.innerHTML = '<option value="">-- Pilih unit pengganti --</option>';
            if (res.success && res.data) {
                res.data.forEach(function (c) {
                    var opt = document.createElement('option');
                    opt.value = c.name;
                    opt.innerText = c.name + " (" + (c.location || "Lab") + ")";
                    select.appendChild(opt);
                });
            }
        });
}

function applyReallocation() {
    var select = document.getElementById('replacement-computer-select');
    var newComp = select.value;
    if (!newComp) return;

    currentReassignedComputer = newComp;
    document.getElementById('spec-name').textContent = newComp + " (Manual)";

    api.jsonpRequest('admin-get-computer-details', { computerName: newComp })
        .then(function (res) {
            if (res.success && res.data) {
                document.getElementById('spec-anydesk').textContent = res.data.anydeskId || '-';
                document.getElementById('spec-ip').textContent = res.data.ipAddress || '-';
                document.getElementById('spec-location').textContent = res.data.location || '-';

                // Toggle back to details
                toggleReallocate();
                // Update AnyDesk Password display
                updateAnydeskPasswordUI();
            }
        });
}

function updateAnydeskPasswordUI() {
    var computerName = currentReassignedComputer || (currentRequest ? currentRequest.preferredComputer : '');
    var timestamp = currentRequest ? currentRequest.timestamp : '';

    if (!computerName || computerName === 'Auto Assign') {
        return;
    }

    api.jsonpRequest('admin-generate-anydesk-password', {
        computerName: computerName,
        dateStr: timestamp
    }).then(function (res) {
        if (res.success) {
            var passInput = document.getElementById('anydesk-password-input');
            if (passInput) passInput.value = res.data;
        }
    });
}

function submitApproval() {
    if (!document.getElementById('check-doc').checked) {
        ui.warning("Mohon verifikasi kelengkapan dokumen terlebih dahulu.", "Verifikasi Dokumen");
        return;
    }

    var winUserContainer = document.getElementById('check-win-user-container');
    if (winUserContainer && !winUserContainer.classList.contains('d-none')) {
        if (!document.getElementById('id-check-win-user').checked) {
            ui.warning("Mohon verifikasi pembuatan Windows User terlebih dahulu.", "Verifikasi User");
            return;
        }
    }

    // Server License Info Validation
    if (currentRequest && currentRequest.needsServerInfo) {
        var isLabPC = currentRequest.requestType === "Lisensi + Komputer" || currentRequest.requestType === "Komputer";
        if (!isLabPC && (!currentRequest.computerUsername || !currentRequest.computerHostname)) {
            ui.error("Data Username dan Hostname wajib diisi oleh mahasiswa untuk lisensi tipe Server (Perangkat Pribadi).", "Data Tidak Lengkap");
            return;
        }
    }

    var data = {
        requestId: currentRequest.requestId,
        customExpirationDate: document.getElementById('expiration-date-input').value,
        adminNotes: document.getElementById('admin-notes').value,
        activationKey: document.getElementById('activation-key-input').value,
        anydeskPassword: document.getElementById('anydesk-password-input') ? document.getElementById('anydesk-password-input').value : "",
        newComputerName: currentReassignedComputer
    };

    showLoading("Memproses Approval...");
    api.jsonpRequest('admin-approve', data)
        .then(function (res) {
            if (res.success) {
                if (res.debugLogs && res.debugLogs.length > 0) {
                    console.log("=== BACKEND DEBUG LOGS ===");
                    console.log(res.debugLogs.join("\n"));
                    ui.success("Disetujui.\nLOGS: " + res.debugLogs.join(" | "));
                } else {
                    ui.success("Permohonan berhasil disetujui.");
                }
                processModalObj.hide();

                // Clear state (Fixed in Milestone 9)
                var keyInput = document.getElementById('activation-key-input');
                if (keyInput) keyInput.value = '';

                var notesInput = document.getElementById('admin-notes');
                if (notesInput) notesInput.value = '';

                var docCheck = document.getElementById('check-doc');
                if (docCheck) docCheck.checked = false;

                var winUserCheck = document.getElementById('id-check-win-user');
                if (winUserCheck) winUserCheck.checked = false;

                loadRequests();
            } else {
                ui.error("Gagal: " + res.message);
            }
        })
        .catch(function (err) {
            ui.error("Error: " + err.message);
        })
        .finally(function () {
            hideLoading();
        });
}

function submitRejection() {
    ui.prompt("Masukkan alasan penolakan:", "Tolak Permohonan")
        .then(function (reason) {
            if (!reason) return;

            showLoading("Memproses Penolakan...");
            api.jsonpRequest('admin-reject', {
                requestId: currentRequest.requestId,
                reason: reason
            })
                .then(function (res) {
                    if (res.success) {
                        ui.success("Permohonan telah ditolak.");
                        processModalObj.hide();
                        loadRequests();
                    } else {
                        ui.error("Gagal: " + res.message);
                    }
                })
                .catch(function (err) {
                    ui.error("Error: " + err.message);
                })
                .finally(function () {
                    hideLoading();
                });
        });
}

window.openProcessModal = openProcessModal;
window.submitApproval = submitApproval;
window.submitRejection = submitRejection;

/**
 * --- EXPIRED USAGE LOGIC ---
 */

function showExpiredModal() {
    if (!expiredModalObj) {
        expiredModalObj = new bootstrap.Modal(document.getElementById('expiredModal'));
    }
    expiredModalObj.show();
    loadExpiredUsage();
}

function loadExpiredUsage() {
    var tbody = document.getElementById('expiredTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Memuat data...</td></tr>';

    api.jsonpRequest('admin-expired-usage')
        .then(function (res) {
            if (res.success && res.data) {
                renderExpiredTable(res.data);
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Tidak ada data expired.</td></tr>';
            }
        })
        .catch(function (err) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3">Gagal memuat data.</td></tr>';
        });
}

function renderExpiredTable(data) {
    var tbody = document.getElementById('expiredTableBody');
    tbody.innerHTML = '';

    data.forEach(function (item) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td>' +
            '<div class="fw-bold">' + item.nama + '</div>' +
            '<div class="extra-small text-muted">' + item.email + '</div>' +
            '</td>' +
            '<td>' +
            '<div class="small fw-bold">' + item.software + '</div>' +
            '<div class="extra-small text-muted">' + item.computer + ' (' + item.room + ')</div>' +
            '</td>' +
            '<td class="text-danger fw-bold small">' + item.expirationDate + '</td>' +
            '<td class="text-center">' +
            '<button class="btn btn-outline-danger btn-sm" onclick="handleRevoke(\'' + item.requestId + '\', \'' + item.nama + '\', ' + item.rowIndex + ', \'' + item.type + '\')">Revoke</button>' +
            '</td>';
        tbody.appendChild(tr);
    });
}

function handleRevoke(requestId, name, rowIndex, requestType) {
    var needsComputer = requestType === "Lisensi + Komputer" || requestType === "Komputer";
    var confirmMsg = "Cabut akses untuk " + name + "?";
    if (needsComputer) {
        confirmMsg += " Komputer akan dijadwalkan maintenance.";
    }

    ui.confirm(confirmMsg, "Cabut Akses")
        .then(function (confirmed) {
            if (!confirmed) return;

            showLoading("Mencabut akses...");
            api.jsonpRequest('admin-revoke', { requestId: requestId, rowIndex: rowIndex })
                .then(function (res) {
                    if (res.success) {
                        ui.success("Akses berhasil dicabut.");
                        expiredModalObj.hide();
                        loadRequests();
                    } else {
                        ui.error("Gagal: " + res.message);
                    }
                })
                .catch(function (err) {
                    ui.error("Error: " + err.message);
                })
                .finally(function () {
                    hideLoading();
                });
        });
}

window.showExpiredModal = showExpiredModal;
window.handleRevoke = handleRevoke;

/**
 * --- ACTIVE USER DETAIL LOGIC ---
 */

var activeUserModalObj = null;

function openActiveUserModal(nama, nim, computerName) {
    if (!activeUserModalObj) {
        activeUserModalObj = new bootstrap.Modal(document.getElementById('activeUserModal'));
    }

    document.getElementById('active-modal-nama').textContent = nama || '-';
    document.getElementById('active-modal-nim').textContent = nim || '-';
    document.getElementById('active-spec-name').textContent = computerName || '-';
    document.getElementById('active-spec-anydesk').textContent = 'Memuat...';
    document.getElementById('active-spec-ip').textContent = 'Memuat...';
    document.getElementById('active-anydesk-password-input').value = '';

    var hasComputer = (computerName && computerName !== '-' && computerName !== 'Auto Assign' && computerName !== 'Belum Dialokasikan');
    var infoCard = document.getElementById('active-computer-info-card');
    var noComputerCard = document.getElementById('active-no-computer-card');

    if (hasComputer) {
        if (infoCard) infoCard.classList.remove('d-none');
        if (noComputerCard) noComputerCard.classList.add('d-none');
    } else {
        if (infoCard) infoCard.classList.add('d-none');
        if (noComputerCard) noComputerCard.classList.remove('d-none');
        activeUserModalObj.show();
        return;
    }

    activeUserModalObj.show();

    api.jsonpRequest('admin-get-computer-details', { computerName: computerName })
        .then(function (res) {
            if (res.success && res.data) {
                document.getElementById('active-spec-anydesk').textContent = res.data.anydeskId || '-';
                document.getElementById('active-spec-ip').textContent = res.data.ipAddress || '-';
                document.getElementById('active-anydesk-password-input').value = res.data.anydeskPassword || '';
            } else {
                document.getElementById('active-spec-anydesk').textContent = 'Gagal memuat';
                document.getElementById('active-spec-ip').textContent = 'Gagal memuat';
            }
        });
}

function copyActiveAnydeskCommand(type) {
    var pass = document.getElementById('active-anydesk-password-input').value.trim();
    var targetEl = document.getElementById(type === 'id' ? 'active-spec-anydesk' : 'active-spec-ip');
    var target = targetEl ? targetEl.textContent.replace(/\s/g, '') : '';

    if (!target || target === '-') {
        ui.warning("ID AnyDesk atau IP Address tidak ditemukan/belum termuat.");
        return;
    }

    var cmd = 'echo ' + pass + ' | "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe" ' + target + ' --with-password';

    if (typeof Utils !== 'undefined' && Utils.copyToClipboard) {
        Utils.copyToClipboard(cmd, "Command AnyDesk berhasil disalin ke clipboard.");
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(cmd).then(function () {
            ui.success("Command CMD berhasil disalin ke clipboard.");
        });
    } else {
        ui.error("Clipboard API tidak didukung di browser ini.");
    }
}

window.openActiveUserModal = openActiveUserModal;
window.copyActiveAnydeskCommand = copyActiveAnydeskCommand;


/**
 * --- AGENDA MANAGEMENT ---
 */

function openAgendaModal() {
    if (!agendaModalObj) {
        agendaModalObj = new bootstrap.Modal(document.getElementById('agendaModal'));

        // Setup 24-hour flatpickr format for agenda times
        if (typeof flatpickr !== 'undefined') {
            flatpickr("#agenda-mulai", {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                time_24hr: true
            });
            flatpickr("#agenda-selesai", {
                enableTime: true,
                dateFormat: "Y-m-d H:i",
                time_24hr: true
            });
        }
    }
    refreshAgendaList();
    agendaModalObj.show();
}

function refreshAgendaList() {
    var tbody = document.getElementById('agenda-list');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3 small">Memuat data agenda...</td></tr>';

    api.jsonpRequest('admin-agendas')
        .then(function (res) {
            if (!tbody) return;
            var agendas = res.data || [];

            if (agendas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3 small">Tidak ada agenda mendatang</td></tr>';
                return;
            }

            tbody.innerHTML = agendas.map(function (a) {
                var kodeBadge = a.kodePeserta ? '<div class="extra-small mt-1"><span class="badge bg-warning-subtle text-dark border-warning border">🔑 ' + a.kodePeserta + '</span></div>' : '';
                return '<tr>' +
                    '<td class="fw-bold text-primary">' + a.ruangan + '</td>' +
                    '<td>' +
                    '<div>' + a.kegiatan + '</div>' +
                    kodeBadge +
                    '</td>' +
                    '<td><div class="small">' + a.mulai + ' - ' + a.selesai + '</div></td>' +
                    '<td class="text-center">' +
                    '<div class="d-flex justify-content-center gap-1">' +
                    '<button class="btn btn-outline-danger btn-sm rounded-circle p-1" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;" onclick="handleHapusAgenda(' + a.rowIndex + ')" title="Hapus">❌</button>' +
                    '<button class="btn btn-outline-warning btn-sm rounded-circle p-1" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center;" onclick="handleBroadcastAgenda(' + a.rowIndex + ')" title="Siarkan Pengingat">📢</button>' +
                    '</div>' +
                    '</td>' +
                    '</tr>';
            }).join('');
        })
        .catch(function (err) {
            if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-3 small">Error memuat data</td></tr>';
        });
}

function handleSimpanAgenda() {
    var data = {
        ruangan: document.getElementById('agenda-ruangan').value,
        kegiatan: document.getElementById('agenda-kegiatan').value,
        mulai: document.getElementById('agenda-mulai').value,
        selesai: document.getElementById('agenda-selesai').value,
        deskripsi: document.getElementById('agenda-deskripsi').value,
        kodePeserta: document.getElementById('agenda-kode').value
    };

    showLoading("Menyimpan Agenda...");
    api.jsonpRequest('admin-save-agenda', data)
        .then(function (res) {
            if (res.success) {
                ui.success("Agenda berhasil disimpan.");
                document.getElementById('agendaForm').reset();
                refreshAgendaList();
            } else {
                ui.error("Gagal: " + res.message);
            }
        })
        .catch(function (err) {
            ui.error("Error: " + err.message);
        })
        .finally(function () {
            hideLoading();
        });
}

function handleHapusAgenda(rowIndex) {
    ui.confirm("Hapus agenda ini?", "Hapus Agenda")
        .then(function (confirmed) {
            if (!confirmed) return;

            showLoading("Menghapus...");
            api.jsonpRequest('admin-delete-agenda', { rowIndex: rowIndex })
                .then(function (res) {
                    if (res.success) {
                        ui.success("Agenda dihapus.");
                        refreshAgendaList();
                    } else {
                        ui.error("Gagal: " + res.message);
                    }
                })
                .catch(function (err) {
                    ui.error("Error: " + err.message);
                })
                .finally(function () {
                    hideLoading();
                });
        });
}

function handleBroadcastAgenda(rowIndex) {
    ui.confirm("Siarkan pengingat agenda ke pengguna terkait?", "Broadcast Agenda")
        .then(function (confirmed) {
            if (!confirmed) return;

            showLoading("Menyiarkan...");
            api.jsonpRequest('admin-broadcast-agenda', { rowIndex: rowIndex })
                .then(function (res) {
                    if (res.success) {
                        ui.success("Broadcast terkirim ke " + res.count + " pengguna.");
                    } else {
                        ui.error("Gagal: " + res.message);
                    }
                })
                .catch(function (err) {
                    ui.error("Error: " + err.message);
                })
                .finally(function () {
                    hideLoading();
                });
        });
}

window.openAgendaModal = openAgendaModal;
window.handleSimpanAgenda = handleSimpanAgenda;
window.handleHapusAgenda = handleHapusAgenda;
window.handleBroadcastAgenda = handleBroadcastAgenda;

/**
 * --- BRANDING LOGIC (Milestone 11) ---
 */
function loadAppBranding() {
    api.getBranding()
        .then(function (res) {
            if (res.success && res.data) {
                setupBranding(res.data);
            }
        })
        .catch(function (e) {
            console.warn('Error loading branding:', e);
        });
}

function setupBranding(data) {
    if (!data) return;

    var logoEls = document.querySelectorAll('#app-logo, #login-logo');
    if (data.logo) {
        var logoSrc = data.logo;
        if (logoSrc.trim() && logoSrc.indexOf('http') !== 0 && logoSrc.indexOf('data:') !== 0) {
            logoSrc = 'data:image/png;base64,' + logoSrc;
        }
        for (var i = 0; i < logoEls.length; i++) {
            logoEls[i].src = logoSrc;
        }
    }

    var qrEl = document.getElementById('app-qr');
    if (data.qr && qrEl) {
        var qrSrc = data.qr;
        if (qrSrc.trim() && qrSrc.indexOf('http') !== 0 && qrSrc.indexOf('data:') !== 0) {
            qrSrc = 'data:image/png;base64,' + qrSrc;
        }
        qrEl.src = qrSrc;
    }
}

// showLoading and hideLoading are now provided globally by ui-helper.js
/**
 * LICENSE EXPIRATION MONITORING (Milestone 10)
 */
function checkExpiringLicenses() {
    api.jsonpRequest('admin-expiring-licenses')
        .then(function (res) {
            if (res.success && res.data && res.data.length > 0) {
                renderExpirationBanner(res.data);
            }
        })
        .catch(function (err) {
            console.warn("Failed to check expiring licenses:", err);
        });
}

function renderExpirationBanner(licenses) {
    var container = document.getElementById('license-banner-container');
    if (!container) return;

    var html = '<div class="alert alert-warning alert-dismissible fade show shadow-sm border-start border-warning border-5" role="alert" style="border-radius: 12px; margin-bottom: 2rem;">' +
        '<div class="d-flex align-items-center">' +
        '<div class="fs-4 me-3">⚠️</div>' +
        '<div>' +
        '<strong class="outfit">Peringatan Lisensi:</strong> ' + licenses.length + ' software akan berakhir dalam waktu dekat.' +
        '<div class="small mt-1">';

    licenses.forEach(function (lic, idx) {
        var badgeColor = lic.daysLeft < 7 ? 'bg-danger' : 'bg-warning text-dark';
        html += '<span class="badge ' + badgeColor + ' me-2 mb-1">' + lic.name + ' (' + lic.daysLeft + ' hari)</span>';
    });

    html += '</div></div></div>' +
        '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
        '</div>';

    container.innerHTML = html;
}

function copyAnydeskCommand(type) {
    var passInput = document.getElementById('anydesk-password-input');
    var pass = passInput ? passInput.value.trim() : '';
    var targetEl = document.getElementById(type === 'id' ? 'spec-anydesk' : 'spec-ip');
    var target = targetEl ? targetEl.textContent.replace(/\s/g, '') : '';

    if (!target || target === '-') {
        if (typeof Toast !== 'undefined') Toast.warn("Data Kurang", "ID AnyDesk atau IP Address tidak ditemukan.");
        return;
    }

    var cmd = 'echo ' + pass + ' | "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe" ' + target + ' --with-password';

    if (typeof Utils !== 'undefined' && Utils.copyToClipboard) {
        Utils.copyToClipboard(cmd, "Command AnyDesk berhasil disalin ke clipboard.");
    } else {
        navigator.clipboard.writeText(cmd).then(function () {
            if (typeof Toast !== 'undefined') Toast.success("Salin Berhasil", "Command disalin ke clipboard.");
        });
    }
}


function copyServerConfig() {
    var configInput = document.getElementById('server-license-config');
    if (configInput && configInput.value) {
        navigator.clipboard.writeText(configInput.value).then(function () {
            if (typeof Toast !== 'undefined') {
                Toast.success("Salin Berhasil", "Konfigurasi lisensi disalin ke clipboard.");
            } else {
                ui.success("Konfigurasi lisensi disalin ke clipboard.");
            }
        });
    }
}

window.copyServerConfig = copyServerConfig;
