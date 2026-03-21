/**
 * Main Application Logic - Layanan Komputasi DTSL
 * GitHub Pages Version with JSONP API Integration
 */

// ===== GLOBAL STATE =====
var initialData = null;
var dosenList = [];
var softwareRules = {};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    console.log('App initialized');

    var renewalId = getUrlParam('renewal_id');
    if (renewalId) {
        console.log('Renewal detected:', renewalId);
    }

    // Show loading
    showLoading('Memuat data awal...');

    api.getInitialData(renewalId)
        .then(function (response) {
            console.log('API Response received:', response);

            if (response && response.success) {
                initialData = response.data;
            } else {
                throw new Error(response ? response.message : 'Unknown API error');
            }

            // Setup UI Components
            setupThemeToggle();
            setupBranding();
            setupProdiDropdown();
            setupDosenDropdown();
            setupSoftwareSelect();
            setupFormHandlers();
            setupUploadMethodToggle();
            setupComputerToggle();
            setupDateRestrictions();

            // Attach event listener for software change
            $('#software').on('change', handleSoftwareChange);

            // Show announcement if exists
            showAnnouncement();

            // Handle Renewal Prefill
            if (initialData && initialData.renewalData) {
                prefillRenewalForm(initialData.renewalData);
                // Mark as renewal
                document.getElementById('main-content').insertAdjacentHTML('afterbegin',
                    '<div class="alert alert-info shadow-sm mb-4"><strong>🔄 Mode Perpanjangan:</strong> Data Anda telah dimuat otomatis dari permohonan sebelumnya. Silahkan dicek kembali, lakukan edit sesuai kebutuhan.</div>'
                );
            }

            hideLoading();
        })
        .catch(function (error) {
            console.error('Initialization error:', error);
            console.error('Error stack:', error.stack);
            hideLoading();
            // More descriptive alert for debugging
            var errorMsg = error.message || error.toString();
            ui.error('Gagal memuat data: ' + errorMsg + '\n\nSilakan refresh halaman atau coba browser lain.', 'Koneksi Error');
        });
});

function setupDateRestrictions() {
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    var todayStr = yyyy + '-' + mm + '-' + dd;

    // Calculate Max Date for Start Date (H+7)
    var maxDate = new Date();
    maxDate.setDate(today.getDate() + 7);
    var maxYyyy = maxDate.getFullYear();
    var maxMm = String(maxDate.getMonth() + 1).padStart(2, '0');
    var maxDd = String(maxDate.getDate()).padStart(2, '0');
    var maxDateStr = maxYyyy + '-' + maxMm + '-' + maxDd;

    var mulaiEl = document.getElementById('mulai');
    var akhirEl = document.getElementById('akhir');

    if (mulaiEl) {
        mulaiEl.setAttribute('min', todayStr);
        mulaiEl.setAttribute('max', maxDateStr);
        if (!mulaiEl.value) {
            mulaiEl.value = todayStr; // Set default to today
        }
    }
    if (akhirEl) akhirEl.setAttribute('min', todayStr);

    // Ensure akhir min date dynamically updates based on mulai date
    if (mulaiEl && akhirEl) {
        mulaiEl.addEventListener('change', function () {
            var selectedStart = this.value || todayStr;
            akhirEl.setAttribute('min', selectedStart);
            if (akhirEl.value && akhirEl.value < selectedStart) {
                akhirEl.value = selectedStart;
            }
        });
    }
}

// ===== BRANDING =====
function setupBranding() {
    // Defensive check - if initialData is null/undefined, skip
    if (!initialData) {
        console.warn('setupBranding: initialData is not available');
        return;
    }

    console.log('setupBranding called');
    console.log('logo:', initialData.logo ? 'present (length: ' + initialData.logo.length + ')' : 'EMPTY');
    console.log('qr:', initialData.qr ? 'present (length: ' + initialData.qr.length + ')' : 'EMPTY');

    // Set logo
    var logo = document.getElementById('app-logo');
    if (logo) {
        var logoSrc = initialData.logoUrl || initialData.logo || '';
        if (logoSrc.trim()) {
            // Add prefix if missing and it's likely base64 (doesn't start with http or data:)
            if (logoSrc.indexOf('http') !== 0 && logoSrc.indexOf('data:') !== 0) {
                logoSrc = 'data:image/png;base64,' + logoSrc;
            }
            logo.src = logoSrc;
            console.log('✅ Logo set successfully');
        } else {
            console.warn('⚠️ Logo URL/Data is empty');
        }
    }

    // Set QR code
    var qr = document.getElementById('app-qr');
    if (qr) {
        var qrSrc = initialData.qrUrl || initialData.qr || '';
        if (qrSrc.trim()) {
            // Add prefix if missing
            if (qrSrc.indexOf('http') !== 0 && qrSrc.indexOf('data:') !== 0) {
                qrSrc = 'data:image/png;base64,' + qrSrc;
            }
            qr.src = qrSrc;
            console.log('✅ QR set successfully');
        } else {
            console.warn('⚠️ QR URL/Data is empty');
        }
    }
}

// ===== ANNOUNCEMENT =====
function showAnnouncement() {
    var alertEl = document.getElementById('announcement-alert');
    var textEl = document.getElementById('announcement-text');
    var headerEl = document.getElementById('announcement-header');
    var bodyEl = document.getElementById('announcement-body');
    var chevronEl = document.getElementById('announcement-chevron');
    var statusEl = document.getElementById('announcement-status-text');

    fetch('announcement.html')
        .then(function (response) {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(function (htmlText) {
            if (htmlText.trim()) {
                textEl.innerHTML = htmlText;
                alertEl.classList.remove('d-none');

                // Initial state: explicitly OPEN
                var isExpanded = true;
                if (typeof $ !== 'undefined') {
                    $(bodyEl).show();
                } else {
                    bodyEl.style.display = 'block';
                }
                chevronEl.style.transform = 'rotate(180deg)';
                statusEl.textContent = '- Klik untuk menutup';

                // Toggle logic
                headerEl.addEventListener('click', function () {
                    isExpanded = !isExpanded;
                    if (typeof $ !== 'undefined') {
                        $(bodyEl).slideToggle();
                    } else {
                        bodyEl.style.display = isExpanded ? 'block' : 'none';
                    }
                    chevronEl.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
                    statusEl.textContent = isExpanded ? '- Klik untuk menutup' : '- Klik untuk detail';
                });

                // Auto-collapse timer
                setTimeout(function () {
                    if (isExpanded) {
                        isExpanded = false;
                        if (typeof $ !== 'undefined') {
                            $(bodyEl).slideUp();
                        } else {
                            bodyEl.style.display = 'none';
                        }
                        chevronEl.style.transform = 'rotate(0deg)';
                        statusEl.textContent = '- Klik untuk detail';
                    }
                }, 10000);
            }
        })
        .catch(function (error) {
            console.warn('Failed to load announcement:', error);
        });
}

// ===== THEME TOGGLE =====
function setupThemeToggle() {
    var toggle = document.getElementById('theme-toggle');
    var body = document.body;

    // Load saved theme
    var savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        body.classList.remove('light-mode');
        toggle.innerHTML = '☀️ Light Mode';
    }

    toggle.addEventListener('click', function () {
        body.classList.toggle('light-mode');
        var isLight = body.classList.contains('light-mode');
        toggle.innerHTML = isLight ? '🌙 Dark Mode' : '☀️ Light Mode';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
}

// ===== PRODI DROPDOWN =====
function setupProdiDropdown() {
    if (!initialData || !initialData.prodiList) return;

    var select = document.getElementById('prodi');
    select.innerHTML = '<option value="">-- Pilih Prodi --</option>';

    initialData.prodiList.forEach(function (prodi) {
        var option = document.createElement('option');
        option.value = prodi;
        option.textContent = prodi;
        select.appendChild(option);
    });

    // Handle change
    select.addEventListener('change', handleProdiChange);
}

function handleProdiChange() {
    var prodi = document.getElementById('prodi').value;
    var universitasContainer = document.getElementById('universitas-container');
    var dosenSelect = document.getElementById('dosenPembimbing');
    var dosenManual = document.getElementById('dosenPembimbingManual');

    // Run in a slight delay to allow Select2 to completely render if it hasn't
    setTimeout(function () {
        var select2Container = $(dosenSelect).next('.select2-container');

        if (prodi === 'Non-UGM') {
            // Hide Select2, Show Manual
            if (select2Container.length) select2Container.hide();
            dosenSelect.style.display = 'none'; // Ensure the original select is also hidden
            dosenSelect.required = false;

            dosenManual.style.display = 'block';
            dosenManual.required = true;
            dosenManual.disabled = false; // Enable for typing
            dosenManual.placeholder = "Nama Dosen (Lengkap dengan gelar)";

            // Show universitas field, use manual dosen input
            universitasContainer.style.display = 'block';
            document.getElementById('universitas').required = true;

        } else if (prodi) {
            // Hide universitas, show dosen dropdown (Select2)
            universitasContainer.style.display = 'none';
            document.getElementById('universitas').required = false;

            if (select2Container.length) {
                select2Container.show();
                dosenSelect.required = false; // Never require hidden original select
            } else {
                dosenSelect.style.display = 'block'; // Fallback to show original select
                dosenSelect.required = true;
            }

            dosenManual.style.display = 'none';
            dosenManual.required = false;
            dosenSelect.disabled = false;
        } else {
            // No prodi selected - reset all
            universitasContainer.style.display = 'none';
            document.getElementById('universitas').required = false;

            if (select2Container.length) select2Container.hide();
            dosenSelect.style.display = 'none'; // Hide Select2 on empty prodi
            dosenSelect.required = false;
            dosenSelect.disabled = true;

            dosenManual.style.display = 'block';
            dosenManual.required = false;
            dosenManual.disabled = true; // Disable on empty prodi
            dosenManual.placeholder = "Pilih Prodi dahulu...";
            dosenManual.value = ""; // Clear its value

            // Clear Select2
            $(dosenSelect).val(null).trigger('change');
        }
    }, 50);
}

// ===== DOSEN DROPDOWN =====
function setupDosenDropdown() {
    try {
        if (initialData && (initialData.dosenListDetailed || initialData.dosenList)) {
            dosenList = initialData.dosenListDetailed || initialData.dosenList;

            var selectEl = document.getElementById('dosenPembimbing');
            selectEl.innerHTML = '<option value="">-- Pilih Dosen --</option>';

            dosenList.forEach(function (dosen) {
                var opt = document.createElement('option');
                if (typeof dosen === 'object' && dosen.nama && dosen.inisial) {
                    const fullName = dosen.nama || dosen.inisial;
                    opt.value = fullName;
                    opt.textContent = fullName;
                } else {
                    opt.value = dosen;
                    opt.textContent = dosen;
                }
                selectEl.appendChild(opt);
            });

            // Enable element
            selectEl.disabled = false;

            // Initialize Select2 directly without arbitrary delay
            $('#dosenPembimbing').select2({
                placeholder: 'Pilih Dosen Pembimbing / Pengampu',
                allowClear: true,
                width: '100%',
                dropdownParent: $('#dosenPembimbing').parent()
            });

            // Signal that Dosen Select2 is fully initialized and ready
            document.dispatchEvent(new Event('Select2DosenReady'));
        } else {
            console.warn('Dosen list missing in initialData');
            document.getElementById('dosenPembimbing').innerHTML = '<option value="">-- Dosen Tidak Ditemukan --</option>';
        }
    } catch (error) {
        console.error('Error loading dosen list:', error);
    }
}

// ===== SOFTWARE MULTI-SELECT =====
function setupSoftwareSelect() {
    try {
        if (initialData && initialData.softwareList) {
            var softwareList = initialData.softwareList;
            softwareRules = initialData.softwareRules || {};

            var selectEl = document.getElementById('software');
            selectEl.innerHTML = ''; // Start empty for multi-select

            softwareList.forEach(function (sw) {
                var opt = document.createElement('option');

                if (typeof sw === 'object' && sw.name) {
                    opt.value = sw.name;
                    opt.textContent = sw.name + (sw.isAvailable ? "" : " (Tidak Tersedia)");
                    if (!sw.isAvailable) opt.disabled = true;
                } else {
                    opt.value = sw;
                    opt.textContent = sw;
                }

                selectEl.appendChild(opt);
            });

            setTimeout(function () {
                $('#software').select2({
                    placeholder: 'Pilih Software (boleh lebih > 1)',
                    allowClear: true,
                    width: '100%',
                    dropdownParent: $('#software').parent()
                }).on('change', handleSoftwareChange); // ADDED MISSING EVENT LISTENER
            }, 100);
        } else {
            console.warn('Software list missing in initialData');
        }
    } catch (error) {
        console.error('Error loading software list:', error);
    }
}

// ===== SOFTWARE RESTRICIONS LOGIC (Client-side for 0 Latency) =====
function checkSoftwareRestrictionsClient(softwareStr) {
    if (!softwareStr) return { requiresLab: false, requiresNetwork: false, needsBorrowKey: false, allowedRooms: [], success: true };

    // softwareRules is already a global variable in app.js
    var rules = softwareRules || {};
    var softwareArray = softwareStr.split(',').map(function (s) { return s.trim(); });
    var physicalRooms = ['Ruang Penelitian', 'Ruang Komputer 1', 'Ruang Komputer 2'];

    var requiresLabTotal = false;
    var requiresNetworkTotal = false;
    var needsBorrowKey = false;
    var commonAllowedRooms = physicalRooms.slice();
    var isRestricted = false;

    softwareArray.forEach(function (swName) {
        var swRules = null;
        if (rules[swName]) {
            swRules = rules[swName];
        } else {
            var lowerSwName = swName.toLowerCase();
            for (var key in rules) {
                if (Object.prototype.hasOwnProperty.call(rules, key)) {
                    var lowerKey = key.toLowerCase();
                    if (lowerSwName.indexOf(lowerKey) !== -1 || lowerKey.indexOf(lowerSwName) !== -1) {
                        swRules = rules[key];
                        break;
                    }
                }
            }
        }

        if (swRules) {
            var hasCloud = swRules.some(function (type) { return type.toLowerCase().indexOf('cloud license') !== -1; });
            var hasServer = swRules.some(function (type) { return type.toLowerCase().indexOf('lisensi server') !== -1; });
            var hasBorrow = swRules.some(function (type) { return type.toLowerCase().indexOf('borrow license') !== -1; });

            if (hasBorrow) needsBorrowKey = true;

            // User Rule: Forced lab only if software ONLY has physical room rules
            var isPhysicalOnly = swRules.length > 0 && swRules.every(function (rule) {
                return physicalRooms.some(function (pr) { return rule.toLowerCase().indexOf(pr.toLowerCase()) !== -1; });
            });

            if (isPhysicalOnly) {
                requiresLabTotal = true;
            }
            if (!hasCloud && !hasBorrow && hasServer) {
                requiresNetworkTotal = true;
            }

            var swPhysicalRooms = swRules.filter(function (t) {
                return physicalRooms.some(function (pr) { return t.toLowerCase().indexOf(pr.toLowerCase()) !== -1; });
            });

            if (swPhysicalRooms.length > 0) {
                isRestricted = true;
                commonAllowedRooms = commonAllowedRooms.filter(function (r) {
                    return swPhysicalRooms.some(function (spr) { return spr.toLowerCase().indexOf(r.toLowerCase()) !== -1; });
                });
            }
        }
    });

    return {
        requiresLab: requiresLabTotal,
        requiresNetwork: requiresNetworkTotal,
        needsBorrowKey: needsBorrowKey,
        allowedRooms: isRestricted ? commonAllowedRooms : physicalRooms,
        success: commonAllowedRooms.length > 0
    };
}

function handleSoftwareChange() {
    var selectedSoftware = $('#software').val() || [];
    var warningDiv = document.getElementById('labOnlyWarning');
    var warningText = document.getElementById('labOnlyWarningText');
    var roomSelect = document.getElementById('roomPreference');

    if (selectedSoftware.length > 0) {
        // Perform Instant Check locally (Zero Latency)
        var result = checkSoftwareRestrictionsClient(selectedSoftware.join(', '));
        var requiresLab = result.requiresLab;
        var requiresNetwork = result.requiresNetwork;
        var allowedRooms = result.allowedRooms || [];

        if (requiresLab) {
            warningDiv.classList.remove('d-none');
            warningText.innerHTML = '<strong>Wajib di Lab:</strong> Software ini hanya tersedia di lab Komputasi DTSL. Anda wajib memilih unit komputer di bawah ini.';

            var needsComputerYes = document.getElementById('needsComputerYes');
            var needsComputerNo = document.getElementById('needsComputerNo');

            if (needsComputerYes) needsComputerYes.checked = true;
            if (needsComputerNo) needsComputerNo.disabled = true;

            var computerSection = document.getElementById('computer-section');
            if (computerSection) computerSection.style.display = 'block';

        } else if (result.needsBorrowKey) {
            warningDiv.classList.remove('d-none');
            warningText.innerHTML = '<strong>Borrow License:</strong> Software ini memerlukan Borrow Key yang akan dikirim via email. Proses aktivasi harus menggunakan jaringan internal UGM atau VPN UGM. Borrow Key dapat digunakan maksimal selama 180 hari.';
            document.getElementById('needsComputerNo').disabled = false;
        } else if (requiresNetwork) {
            warningDiv.classList.remove('d-none');
            warningText.innerHTML = '<strong>PENTING:</strong> Gunakan koneksi jaringan internal UGM atau VPN UGM untuk menggunakan lisensi software ini di komputer pribadi.';
            document.getElementById('needsComputerNo').disabled = false;
        } else {
            warningDiv.classList.add('d-none');
            document.getElementById('needsComputerNo').disabled = false;
        }

        Array.prototype.slice.call(roomSelect.options).forEach(function (opt) {
            if (opt.value === '') return;
            opt.disabled = allowedRooms.length > 0 && allowedRooms.indexOf(opt.value) === -1;
        });
        if (result.success === false) {
            ui.warning('Software yang Anda pilih memiliki batasan akses yang tidak kompatibel. Silahkan dikirimkan secara terpisah.', 'Batasan Software');
        }

        // Calibrate Tipe Akses
        autoSetTipeAkses();

    } else {
        warningDiv.classList.add('d-none');
        Array.prototype.slice.call(roomSelect.options).forEach(function (opt) { opt.disabled = false; });
        var needsComputerNo = document.getElementById('needsComputerNo');
        if (needsComputerNo) needsComputerNo.disabled = false;
        document.getElementById('requestType').value = '';
    }
}

function autoSetTipeAkses() {
    var selectedSoftware = $('#software').val() || [];
    var needsComputer = document.getElementById('needsComputerYes').checked;
    var selectedRoom = document.getElementById('roomPreference').value;

    if (selectedSoftware.length === 0) {
        document.getElementById('requestType').value = '';
        handleRequestTypeChange();
        return;
    }

    var hasAnyServerRule = false;
    selectedSoftware.forEach(function (swName) {
        var lowerSwName = swName.toLowerCase();
        var swRules = [];
        for (var key in softwareRules) {
            if (Object.prototype.hasOwnProperty.call(softwareRules, key)) {
                var lowerKey = key.toLowerCase();
                if (lowerSwName.indexOf(lowerKey) !== -1 || lowerKey.indexOf(lowerSwName) !== -1) {
                    swRules = softwareRules[key];
                    break;
                }
            }
        }
        if (swRules.some(function (t) { return t.toLowerCase().indexOf('lisensi server') !== -1; })) {
            hasAnyServerRule = true;
        }
    });

    var accessType = '';
    if (needsComputer && selectedRoom) {
        accessType = selectedRoom;
    } else if (hasAnyServerRule && !needsComputer) {
        accessType = 'Akses Lisensi Server';
    } else {
        // Fallback or generic logic
        accessType = 'Lisensi / Cloud';
    }

    document.getElementById('requestType').value = accessType;
    handleRequestTypeChange();
}

function handleRequestTypeChange() {
    var requestType = document.getElementById('requestType').value;
    var isServer = requestType === 'Akses Lisensi Server';
    var serverFields = document.getElementById('serverAccessFields');
    if (serverFields) {
        serverFields.style.display = isServer ? 'block' : 'none';
        document.getElementById('computerUserName').required = isServer;
        document.getElementById('computerHostname').required = isServer;
    }
}

// ===== UPLOAD METHOD TOGGLE =====
function setupUploadMethodToggle() {
    var methodUpload = document.getElementById('methodUpload');
    var methodLink = document.getElementById('methodLink');
    var uploadContainer = document.getElementById('inputUploadContainer');
    var linkContainer = document.getElementById('inputLinkContainer');
    var uploadInput = document.getElementById('uploadSurat');
    var linkInput = document.getElementById('linkSurat');

    function toggleMode() {
        if (methodUpload.checked) {
            uploadContainer.style.display = 'block';
            linkContainer.style.display = 'none';
            uploadInput.required = true;
            linkInput.required = false;
        } else {
            uploadContainer.style.display = 'none';
            linkContainer.style.display = 'block';
            uploadInput.required = false;
            linkInput.required = true;
        }
    }

    methodUpload.addEventListener('change', toggleMode);
    methodLink.addEventListener('change', toggleMode);
}

// ===== COMPUTER LAB TOGGLE =====
var availableComputers = [];
var filteredComputers = [];
var selectedComputer = null;
var currentPage = 1;
var itemsPerPage = 6;

function setupComputerToggle() {
    var needsComputerYes = document.getElementById('needsComputerYes');
    var needsComputerNo = document.getElementById('needsComputerNo');
    var computerSection = document.getElementById('computer-section');
    var roomPreference = document.getElementById('roomPreference');
    var computerSearch = document.getElementById('computer-search');

    function toggleComputer() {
        if (needsComputerYes.checked) {
            computerSection.style.display = 'block';
            if (roomPreference.value) loadAvailableComputers();
        } else {
            computerSection.style.display = 'none';
            selectedComputer = null;
        }
    }

    needsComputerYes.addEventListener('change', function () {
        toggleComputer();
        autoSetTipeAkses();
    });
    needsComputerNo.addEventListener('change', function () {
        toggleComputer();
        autoSetTipeAkses();
    });

    // Room change listener
    roomPreference.addEventListener('change', function () {
        loadAvailableComputers();
        autoSetTipeAkses();
    });

    // Search listener
    computerSearch.addEventListener('input', filterComputers);

    // Agenda check listeners
    var checkInputs = ['roomPreference', 'mulai', 'akhir'];
    checkInputs.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', function () {
            var result = checkLabAgendas();
            if (id === 'roomPreference' || !result.isBlocked) loadAvailableComputers();
        });
    });

    var btnCheck = document.getElementById('btn-check-kode');
    if (btnCheck) {
        btnCheck.addEventListener('click', function () {
            var result = checkLabAgendas(true); // Pass true to show explicit feedback
            if (!result.isBlocked) {
                ui.success("Akses lab berhasil dibuka!");
                loadAvailableComputers();
            }
        });
    }

    var kodeInput = document.getElementById('kodePeserta');
    if (kodeInput) {
        kodeInput.addEventListener('input', function () {
            var result = checkLabAgendas();
            if (!result.isBlocked) loadAvailableComputers();
        });
    }

    // Pagination listeners
    document.getElementById('prev-page').addEventListener('click', function (e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            renderComputerPage();
        }
    });

    document.getElementById('next-page').addEventListener('click', function (e) {
        e.preventDefault();
        var totalPages = Math.ceil(filteredComputers.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderComputerPage();
        }
    });
}

function loadAvailableComputers() {
    var room = document.getElementById('roomPreference').value;
    var container = document.getElementById('computer-selection-container');
    var loading = document.getElementById('computer-loading');
    var list = document.getElementById('computer-list');
    var noComputers = document.getElementById('no-computers');
    var pagination = document.getElementById('computer-pagination');

    if (!room) {
        container.style.display = 'none';
        return;
    }

    // --- BLOCK IF AGENDA CONFLICT EXISTS ---
    var conflictResult = checkLabAgendas();
    if (conflictResult.isBlocked) {
        loading.style.display = 'none';
        list.innerHTML = '';
        noComputers.classList.remove('d-none');
        noComputers.innerHTML = '<div class="alert alert-warning fw-bold mb-0">🔒 Ruangan Terkunci: Silakan masukkan "Kode Peserta" yang benar di atas untuk mengikuti kegiatan.</div>';
        pagination.classList.add('d-none');
        container.style.display = 'block';
        return;
    }

    container.style.display = 'block';
    loading.style.display = 'block';
    list.innerHTML = '';
    noComputers.classList.add('d-none');
    noComputers.innerHTML = '<div class="text-muted mb-2">Tidak ada komputer tersedia di ruangan ini.</div>';
    pagination.classList.add('d-none');

    api.getAvailableComputers(room)
        .then(function (response) {
            availableComputers = (response && response.data) ? response.data : [];
            filterComputers();
        })
        .catch(function (error) {
            console.error('Error loading computers:', error);
            loading.style.display = 'none';
            ui.error('Gagal memuat daftar komputer.', 'Gagal Memuat');
        });
}

function filterComputers() {
    var searchTerm = document.getElementById('computer-search').value.toLowerCase();

    filteredComputers = availableComputers.filter(function (comp) {
        var name = (comp.name || '').toLowerCase();
        var sw = (comp.softwareInstalled || '').toLowerCase();
        return name.indexOf(searchTerm) !== -1 || sw.indexOf(searchTerm) !== -1;
    });

    currentPage = 1;
    renderComputerPage();
}

function renderComputerPage() {
    var loading = document.getElementById('computer-loading');
    var list = document.getElementById('computer-list');
    var noComputers = document.getElementById('no-computers');
    var pagination = document.getElementById('computer-pagination');
    var pageInfo = document.getElementById('page-info');

    loading.style.display = 'none';
    list.innerHTML = '';

    if (filteredComputers.length === 0) {
        noComputers.classList.remove('d-none');
        pagination.classList.add('d-none');
        return;
    }

    noComputers.classList.add('d-none');

    // Calculate pagination
    var totalPages = Math.ceil(filteredComputers.length / itemsPerPage);
    var start = (currentPage - 1) * itemsPerPage;
    var end = start + itemsPerPage;
    var items = filteredComputers.slice(start, end);

    items.forEach(function (comp) {
        var col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4';

        var isSelected = selectedComputer && selectedComputer.name === comp.name;

        col.innerHTML = '<div class="card h-100 computer-card ' + (isSelected ? 'selected' : '') + '" style="cursor: pointer; transition: all 0.2s;">' +
            '<div class="card-body p-3">' +
            '<h6 class="card-title fw-bold mb-1">' + comp.name + '</h6>' +
            '<div class="small text-muted mb-2">📍 ' + (comp.location || '-') + '</div>' +
            '<div class="small mb-2" style="font-size: 0.75rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">' +
            '<strong>💾:</strong> ' + (comp.softwareInstalled || '-') +
            '</div>' +
            '</div>' +
            '</div>';

        col.querySelector('.card').addEventListener('click', function () {
            selectedComputer = comp;
            renderComputerPage();
        });

        list.appendChild(col);
    });

    if (totalPages > 1) {
        pagination.classList.remove('d-none');
        pageInfo.textContent = 'Page ' + currentPage + ' / ' + totalPages;
        document.getElementById('prev-page').parentElement.classList.toggle('disabled', currentPage === 1);
        document.getElementById('next-page').parentElement.classList.toggle('disabled', currentPage === totalPages);
    } else {
        pagination.classList.add('d-none');
    }
}

// ===== FORM SUBMISSION =====
function setupFormHandlers() {
    var form = document.getElementById('submission-form');
    var mulaiInput = document.getElementById('mulai');
    var akhirInput = document.getElementById('akhir');

    // Real-time Date Validation
    if (mulaiInput) {
        mulaiInput.addEventListener('change', function () {
            var selectedMulai = new Date(this.value);
            selectedMulai.setHours(0, 0, 0, 0);
            var today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedMulai < today) {
                ui.warning('Tanggal mulai tidak boleh di masa lalu. Telah dikembalikan ke tanggal hari ini.', 'Validasi Tanggal');
                
                var yyyy = today.getFullYear();
                var mm = String(today.getMonth() + 1).padStart(2, '0');
                var dd = String(today.getDate()).padStart(2, '0');
                this.value = yyyy + '-' + mm + '-' + dd;
            }
        });
    }

    if (akhirInput) {
        akhirInput.addEventListener('change', function () {
            var selectedAkhir = new Date(this.value);
            selectedAkhir.setHours(0, 0, 0, 0);
            var selectedMulaiValue = mulaiInput.value;

            if (selectedMulaiValue) {
                var selectedMulai = new Date(selectedMulaiValue);
                selectedMulai.setHours(0, 0, 0, 0);
                if (selectedAkhir < selectedMulai) {
                    ui.warning('Tanggal akhir tidak boleh mendahului tanggal mulai.', 'Validasi Tanggal');
                    this.value = ''; // Clear invalid date
                }
            }
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Collect form data
        var formData = collectFormData();

        // Validate
        if (!validateFormData(formData)) {
            return;
        }

        // Handle File Reading first if needed
        var fileInput = document.getElementById('uploadSurat');
        var processSubmission = function (fileObj) {
            showLoading('Menyimpan data...');
            api.submitRequest(formData)
                .then(function (result) {
                    if (result.success && result.data) {
                        var rowIndex = result.data.rowIndex;
                        var requestId = result.data.requestId;

                        // Step 2: Upload File if exists
                        if (fileObj && rowIndex) {
                            showLoading('Mengunggah file (Step 2/2)...');
                            api.uploadFile({
                                rowIndex: rowIndex,
                                fileData: fileObj.data,
                                mimeType: fileObj.mimeType,
                                fileName: fileObj.name
                            }).then(function (uploadResult) {
                                console.log('Upload result (opaque):', uploadResult);
                                finalizeSuccess(requestId);
                            }).catch(function (uploadErr) {
                                console.error('File upload failed:', uploadErr);
                                ui.warning('Data tersimpan, namun unggahan file gagal. Admin akan menghubungi Anda jika diperlukan.', 'Upload Pending');
                                finalizeSuccess(requestId);
                            });
                        } else {
                            finalizeSuccess(requestId);
                        }
                    } else {
                        hideLoading();
                        ui.error('Gagal menyimpan: ' + (result.message || 'Unknown error'), 'Simpan Gagal');
                    }
                })
                .catch(function (error) {
                    hideLoading();
                    console.error('Submission error:', error);
                    ui.error('Terjadi kesalahan: ' + error.message, 'System Error');
                });
        };

        var finalizeSuccess = function (requestId) {
            hideLoading();
            showSuccessModal(requestId || 'Berhasil');
            resetForm();
        };

        if (formData.uploadMethod === 'upload' && fileInput.files.length > 0) {
            showLoading('Membaca file...');
            getFileBase64(fileInput.files[0])
                .then(function (fileObj) {
                    processSubmission(fileObj);
                })
                .catch(function (err) {
                    hideLoading();
                    ui.error('Gagal membaca file: ' + err.message, 'File Error');
                });
        } else {
            processSubmission(null);
        }
    });
}

/**
 * Helper to convert File to Base64
 */
function getFileBase64(file) {
    return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
            var result = reader.result;
            var base64String = result.split(',')[1];
            resolve({
                data: base64String,
                mimeType: file.type,
                name: file.name
            });
        };
        reader.onerror = function (error) { reject(error); };
        reader.readAsDataURL(file);
    });
}

function collectFormData() {
    // Get keperluan (radio buttons)
    var keperluan = document.querySelector('input[name="keperluan"]:checked');

    // Clean and format phone number
    var rawPhone = document.getElementById('phone').value.replace(/\D/g, '');
    if (rawPhone.indexOf('0') === 0) rawPhone = rawPhone.substring(1);
    else if (rawPhone.indexOf('62') === 0) rawPhone = rawPhone.substring(2);
    var formattedPhone = 'https://wa.me/+62' + rawPhone;

    // Get software values (Select2 multi-select)
    var softwareValues = $('#software').val() || [];

    return {
        keperluanPenggunaan: keperluan ? keperluan.value : '',
        emailAddress: document.getElementById('email').value,
        nama: document.getElementById('nama').value,
        phone: formattedPhone,
        nim: document.getElementById('nim').value,
        emailUGM: document.getElementById('emailUGM').value,
        prodi: document.getElementById('prodi').value,
        dosenPembimbing: getDosenValue(),
        universitas: document.getElementById('universitas').value,
        topikJudul: document.getElementById('topik').value,
        software: softwareValues.join(', '),
        needsComputer: (document.querySelector('input[name="needsComputer"]:checked') || {}).value === 'yes',
        computerRoomPreference: document.getElementById('roomPreference').value,
        preferredComputer: selectedComputer ? selectedComputer.name : '',
        mulaiPemakaian: document.getElementById('mulai').value,
        akhirPemakaian: document.getElementById('akhir').value,
        catatan: document.getElementById('catatan').value,
        uploadMethod: (document.querySelector('input[name="uploadMethod"]:checked') || {}).value,
        linkSurat: document.getElementById('linkSurat').value,
        requestType: document.getElementById('requestType').value,
        computerUserName: (document.getElementById('computerUserName') || {}).value || '',
        computerHostname: (document.getElementById('computerHostname') || {}).value || '',
        isRenewal: !!getUrlParam('renewal_id'),
        previousRequestId: getUrlParam('renewal_id') || ""
    };
}

function getDosenValue() {
    var prodi = document.getElementById('prodi').value;
    var val = "";
    if (prodi === 'Non-UGM') {
        val = document.getElementById('dosenPembimbingManual').value;
    } else {
        val = $('#dosenPembimbing').val();
    }
    return val || "";
}

function validateFormData(data) {
    if (!data.keperluanPenggunaan) {
        ui.alert('Pilih salah satu Keperluan Penggunaan (TA, Penelitian, Lomba, atau Tugas) untuk melanjutkan.', 'Pilihan Diperlukan', 'warning')
            .then(function () {
                var card = document.getElementById('keperluan-card');
                if (card) {
                    card.classList.add('invalid-selection');
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    var radios = document.getElementsByName('keperluan');
                    for (var i = 0; i < radios.length; i++) {
                        radios[i].addEventListener('change', function () {
                            card.classList.remove('invalid-selection');
                        }, { once: true });
                    }
                }
            });
        return false;
    }

    if (!data.emailAddress || !data.nama || !data.nim) {
        var firstMissing = !data.emailAddress ? 'email' : (!data.nama ? 'nama' : 'nim');
        ui.alert('Harap lengkapi data personal (Email, Nama, dan NIM) Anda.', 'Data Belum Lengkap', 'warning')
            .then(function () {
                var el = document.getElementById(firstMissing);
                if (el) {
                    el.classList.add('is-invalid'); // Add visual cue
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function () { el.focus(); }, 300);
                    $(el).one('input change', function () { el.classList.remove('is-invalid'); });
                }
            });
        return false;
    }

    if (!data.prodi) {
        ui.alert('Silakan pilih Program Studi Anda.', 'Prodi Diperlukan', 'warning')
            .then(function () {
                var el = document.getElementById('prodi');
                if (el) {
                    el.classList.add('is-invalid');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function () { el.focus(); }, 300);
                    $(el).one('change', function () { el.classList.remove('is-invalid'); });
                }
            });
        return false;
    }

    if (!data.dosenPembimbing) {
        var prodiVal = document.getElementById('prodi').value;
        ui.alert('Harap pilih atau isi nama Dosen Pembimbing / Pengampu Anda.', 'Dosen Diperlukan', 'warning')
            .then(function () {
                if (prodiVal === 'Non-UGM') {
                    var el = document.getElementById('dosenPembimbingManual');
                    if (el) {
                        el.classList.add('is-invalid');
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(function () { el.focus(); }, 300);
                        $(el).one('input', function () { el.classList.remove('is-invalid'); });
                    }
                } else {
                    var el = document.getElementById('dosenPembimbing');
                    if (el) {
                        el.classList.add('invalid-select2');
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(function () { $('#dosenPembimbing').select2('open'); }, 300);
                        $('#dosenPembimbing').one('change', function () {
                            el.classList.remove('invalid-select2');
                        });
                    }
                }
            });
        return false;
    }

    if (!data.topikJudul) {
        ui.alert('Isi topik atau judul penelitian/tugas Anda.', 'Topik Diperlukan', 'warning')
            .then(function () {
                var el = document.getElementById('topik');
                if (el) {
                    el.classList.add('is-invalid');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function () { el.focus(); }, 300);
                    $(el).one('input', function () { el.classList.remove('is-invalid'); });
                }
            });
        return false;
    }

    if (!data.software || data.software === '') {
        ui.alert('Harap pilih minimal satu software yang akan digunakan.', 'Software Diperlukan', 'warning')
            .then(function () {
                var el = document.getElementById('software');
                if (el) {
                    el.classList.add('invalid-select2');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function () { $('#software').select2('open'); }, 300);
                    $('#software').one('change', function () {
                        el.classList.remove('invalid-select2');
                    });
                }
            });
        return false;
    }

    if (!data.mulaiPemakaian) {
        ui.alert('Silakan tentukan tanggal mulai rencana penggunaan Anda.', 'Tanggal Diperlukan', 'warning')
            .then(function () {
                var el = document.getElementById('mulai');
                if (el) {
                    el.classList.add('is-invalid');
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(function () { el.focus(); }, 300);
                    $(el).one('change input', function () { el.classList.remove('is-invalid'); });
                }
            });
        return false;
    }

    // --- NEW VALIDATION: COMPUTER LAB REQUIREMENTS ---
    if (data.needsComputer) {
        if (!data.computerRoomPreference) {
            ui.alert('Anda memilih menggunakan komputer lab, silakan pilih ruangan terlebih dahulu.', 'Ruangan Diperlukan', 'warning')
                .then(function () {
                    var el = document.getElementById('roomPreference');
                    if (el) {
                        el.classList.add('is-invalid');
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        setTimeout(function () { el.focus(); }, 300);
                        $(el).one('change', function () { el.classList.remove('is-invalid'); });
                    }
                });
            return false;
        }

        if (!data.preferredComputer) {
            ui.alert('Silakan pilih salah satu unit komputer yang tersedia di daftar.', 'Unit Diperlukan', 'warning')
                .then(function () {
                    var container = document.getElementById('computer-selection-container');
                    if (container) {
                        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        container.classList.add('invalid-selection');
                        setTimeout(function () { container.classList.remove('invalid-selection'); }, 2000);
                    }
                });
            return false;
        }
    }

    // Date Validation (ES5)
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var maxStartDate = new Date();
    maxStartDate.setDate(today.getDate() + 7);
    maxStartDate.setHours(23, 59, 59, 999);

    var selectedDate = new Date(data.mulaiPemakaian);
    selectedDate.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
        ui.alert('Tanggal mulai tidak boleh di masa lalu. Silakan pilih tanggal hari ini atau yang akan datang.', 'Validasi Tanggal', 'warning');
        return false;
    }

    if (selectedDate > maxStartDate) {
        ui.alert('Tanggal mulai maksimal adalah 7 hari dari sekarang.', 'Validasi Tanggal', 'warning');
        return false;
    }

    if (data.akhirPemakaian) {
        var endDate = new Date(data.akhirPemakaian);
        endDate.setHours(0, 0, 0, 0);
        if (endDate < selectedDate) {
            ui.alert('Tanggal akhir tidak boleh mendahului tanggal mulai.', 'Validasi Tanggal', 'warning');
            return false;
        }
    }

    // Check upload method
    if (data.uploadMethod === 'upload') {
        var fileList = document.getElementById('uploadSurat').files;
        var file = fileList ? fileList[0] : null;
        if (!file) {
            ui.alert('Harap unggah file surat keterangan yang diperlukan.', 'File Diperlukan', 'warning');
            return false;
        }
        if (file.size > 3 * 1024 * 1024) {
            ui.alert('Ukuran file terlalu besar (maksimal 3MB).', 'File Terlalu Besar', 'warning');
            return false;
        }

        // Validate Extension
        var allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
        var fileName = file.name || "";
        var ext = fileName.split('.').pop().toLowerCase();
        if (allowedExtensions.indexOf(ext) === -1) {
            ui.alert('Format file tidak didukung. Harap gunakan PDF atau Gambar (JPG/PNG).', 'Format Tidak Sesuai', 'warning');
            return false;
        }
    } else if (data.uploadMethod === 'link') {
        if (!data.linkSurat) {
            ui.alert('Silakan sertakan link surat keterangan Anda.', 'Link Diperlukan', 'warning');
            return false;
        }
    }

    return true;
}

// ===== SUCCESS MODAL =====
function showSuccessModal(requestId) {
    var modalEl = document.getElementById('success-modal');
    if (!modalEl) return;

    var message = document.getElementById('success-message');
    if (message) {
        message.textContent = 'Permohonan berhasil dikirim! Request ID: ' + requestId + '. Email konfirmasi telah dikirim.';
    }

    // Get or create instance to avoid duplicate objects
    var modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);

    // Fix ARIA Warning: remove aria-hidden before showing
    modalEl.removeAttribute('aria-hidden');

    // Add hidden listener to ensure focus is moved properly when closed
    modalEl.addEventListener('hide.bs.modal', function () {
        // Blur any focused element inside to prevent "Blocked aria-hidden"
        if (document.activeElement && modalEl.contains(document.activeElement)) {
            document.activeElement.blur();
        }

        // Ensure we are at the top when modal closes
        setTimeout(function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            try { window.parent.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { }
        }, 50);
    }, { once: true });

    modalInstance.show();

    // Smooth scroll to top when showing success modal
    setTimeout(function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        try { window.parent.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { }
    }, 100);
}

// ===== LOADING OVERLAY =====
function showLoading(message) {
    if (!message) message = 'Memuat...';
    var overlay = document.getElementById('loading-overlay');
    var messageEl = document.getElementById('loading-message');
    if (messageEl) messageEl.textContent = message;
    overlay.classList.add('active');
}

function hideLoading() {
    var overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('active');
}

// ===== COMPREHENSIVE RESET =====
function resetForm() {
    var form = document.getElementById('submission-form');
    if (!form) return;

    // 1. Reset standard HTML fields
    form.reset();

    // 2. Reset Select2 (Software & Dosen)
    $('#software').val(null).trigger('change');
    $('#dosenPembimbing').val(null).trigger('change');

    // 3. Reset Computer Selection State
    selectedComputer = null;
    availableComputers = [];
    filteredComputers = [];
    currentPage = 1;

    // 4. Reset UI Sections & Warnings
    document.getElementById('computer-section').style.display = 'none';
    var serverFields = document.getElementById('serverAccessFields');
    if (serverFields) serverFields.style.display = 'none';

    var warningDiv = document.getElementById('labOnlyWarning');
    if (warningDiv) warningDiv.classList.add('d-none');

    var roomSelect = document.getElementById('roomPreference');
    if (roomSelect) {
        var options = Array.prototype.slice.call(roomSelect.options);
        options.forEach(function (opt) { opt.disabled = false; });
    }

    var computerList = document.getElementById('computer-list');
    if (computerList) computerList.innerHTML = '';

    var computerPagination = document.getElementById('computer-pagination');
    if (computerPagination) computerPagination.classList.add('d-none');

    var universitasContainer = document.getElementById('universitas-container');
    if (universitasContainer) universitasContainer.style.display = 'none';

    var dosenManual = document.getElementById('dosenPembimbingManual');
    // Removed forceful hide here because handleProdiChange handles the new default state

    // Trigger UI synchronization for Prodi-dependent fields
    handleProdiChange();

    console.log('Form reset completed');

    // Fix scroll issue: use smooth scrolling and a slight delay to ensure DOM is ready
    setTimeout(function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        try { window.parent.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { }
    }, 100);
}

// ===== HELPERS =====

function getUrlParam(name) {
    var search = window.location.search.substring(1);
    var pairs = search.split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        if (decodeURIComponent(pair[0]) === name) {
            return decodeURIComponent(pair[1] || '');
        }
    }
    return null;
}

function prefillRenewalForm(data) {
    if (!data) return;

    if (data.nama) document.getElementById('nama').value = data.nama;
    if (data.nim) document.getElementById('nim').value = data.nim;
    if (data.emailAddress) document.getElementById('email').value = data.emailAddress;
    if (data.emailUGM) document.getElementById('emailUGM').value = data.emailUGM;

    if (data.phone) {
        var phone = data.phone.replace('https://wa.me/+62', '');
        document.getElementById('phone').value = phone;
    }

    if (data.prodi) {
        document.getElementById('prodi').value = data.prodi;
        handleProdiChange(); // Force UI update (Select2 vs Manual)
    }

    if (data.universitas) document.getElementById('universitas').value = data.universitas;
    if (data.topikJudul) document.getElementById('topik').value = data.topikJudul;

    if (data.software) {
        var swArray = data.software.split(',').map(function (s) { return s.trim(); });
        $('#software').val(swArray).trigger('change');
    }

    if (data.keperluanPenggunaan) {
        var radio = document.querySelector('input[name="keperluan"][value="' + data.keperluanPenggunaan + '"]');
        if (radio) radio.checked = true;
    }

    if (data.dosenPembimbing) {
        var prodi = document.getElementById('prodi').value;
        if (prodi === 'Non-UGM') {
            document.getElementById('dosenPembimbingManual').value = data.dosenPembimbing;
        } else {
            // Function to perform injection
            var injectDosen = function () {
                var newOption = new Option(data.dosenPembimbing, data.dosenPembimbing, true, true);
                $('#dosenPembimbing').append(newOption).trigger('change');
            };

            // Check if Select2 container already exists
            if ($('#dosenPembimbing').next('.select2-container').length > 0) {
                injectDosen();
            } else {
                // Wait for the custom ready event
                document.addEventListener('Select2DosenReady', injectDosen, { once: true });
            }
        }
    }

    // 1. Handle Computer Selection State & LOCK The Options
    var needsYes = document.getElementById('needsComputerYes');
    var needsNo = document.getElementById('needsComputerNo');

    // Prevent user from changing the renewal mode and breaking the banner logic
    if (needsYes) needsYes.disabled = true;
    if (needsNo) needsNo.disabled = true;

    if (data.preferredComputer) {
        if (needsYes) needsYes.checked = true;

        // Show the computer section manually
        var computerSection = document.getElementById('computer-section');
        if (computerSection) computerSection.style.display = 'block';

        // Select Room but HIDE the entire Room Picker container as per user request
        var roomSelect = document.getElementById('roomPreference');
        var roomContainer = document.getElementById('roomPreferenceContainer');
        if (roomSelect) {
            roomSelect.value = data.computerRoomPreference || '';
            roomSelect.disabled = true; // Lock room during renewal
            if (roomContainer) roomContainer.style.display = 'none'; // Hide picker
        }

        // Mark the selected computer
        selectedComputer = { name: data.preferredComputer };

        // Hide the entire computer search/grid section so user isn't distracted
        var pList = document.getElementById('computer-selection-container');
        if (pList) pList.style.display = 'none';
    } else {
        if (needsNo) needsNo.checked = true;
    }

    // 2. Construct Combined Renewal Info Banner
    var banner = document.getElementById('renewalInfoBanner');
    var rnName = document.getElementById('renewalComputerName');
    
    if (banner && rnName) {
        banner.classList.remove('d-none');
        var htmlParts = [];
        
        // Add Computer Info
        if (data.preferredComputer) {
            banner.classList.add('alert-info');
            banner.style.backgroundColor = '#e8f4fd';
            htmlParts.push('Unit Komputer: <strong>' + data.preferredComputer + '</strong> <small class="text-muted">(Ruangan: ' + (data.computerRoomPreference || '-') + ')</small>');
        } else {
            banner.classList.add('alert-success');
            banner.style.backgroundColor = '#e8fdf2';
            htmlParts.push('Perangkat Utama: <strong>Laptop / PC Pribadi</strong>');
        }

        // Add Software Info
        if (data.software) {
            htmlParts.push('Lisensi & Software: <strong style="color: var(--bs-primary);">' + data.software + '</strong>');
        } else {
            console.error("Critical Backend Error: Software array is empty or undefined for Renewal ID.");
            ui.error("Kesalahan Data Kritis: Data Lisensi/Software sebelumnya tidak ditemukan atau kosong. Mohon hubungi Administrator Lab atau buat permohonan baru secara manual.", "Data Incomplete");
            htmlParts.push('<span class="text-danger fw-bold">⚠️ Data Software/Lisensi Hilang!</span>');
        }

        rnName.innerHTML = htmlParts.join('<br>');
    }

    if (data.computerUserName) document.getElementById('computerUserName').value = data.computerUserName;
    if (data.computerHostname) document.getElementById('computerHostname').value = data.computerHostname;

    // Populate Attachment Link if exists
    if (data.linkSurat) {
        var methodLink = document.getElementById('methodLink');
        if (methodLink) {
            methodLink.checked = true;
            // Trigger change event to fire the UI toggle logic bound in setupUploadMethodToggle
            var event = new Event('change');
            methodLink.dispatchEvent(event);
        }
        var linkInput = document.getElementById('linkSuratKeterangan') || document.getElementById('linkSurat');
        if (linkInput) {
            linkInput.value = data.linkSurat;
        }
    }

    // Auto-fill Start Date from Previous Expiration Date
    if (data.previousExpirationDate) {
        var mulaiEl = document.getElementById('mulai');
        if (mulaiEl) {
            mulaiEl.value = data.previousExpirationDate;
            
            // Trigger change event so end-date constraints and related logic evaluate correctly
            var dateEvent = new Event('change');
            mulaiEl.dispatchEvent(dateEvent);
        }
    }

    // Evaluate access type based on newly filled form data (hides/shows server fields)
    setTimeout(function () {
        autoSetTipeAkses();
    }, 200);
}

// ===== AGENDA CONFLICT CHECK =====
function checkLabAgendas(isManualCheck) {
    var roomEl = document.getElementById('roomPreference');
    var mulaiEl = document.getElementById('mulai');
    var akhirEl = document.getElementById('akhir');
    var warningEl = document.getElementById('agendaConflictWarning');
    var kodePesertaContainer = document.getElementById('kodePesertaContainer');
    var kodePesertaInput = document.getElementById('kodePeserta');

    if (!roomEl || !mulaiEl || !warningEl) return { isBlocked: false };

    var room = roomEl.value;
    var startStr = mulaiEl.value;
    var endStr = akhirEl.value;

    if (!room || !startStr) {
        warningEl.classList.add('d-none');
        kodePesertaContainer.classList.add('d-none');
        return { isBlocked: false };
    }

    var clientStart = parseAppDate(startStr);
    var clientEnd = endStr ? parseAppDate(endStr) : parseAppDate(startStr);
    if (!endStr) {
        clientEnd.setHours(23, 59, 59);
    }

    // Check against agendas from initialData
    var agendas = (initialData && initialData.agendas) ? initialData.agendas : [];
    var conflict = null;

    for (var i = 0; i < agendas.length; i++) {
        var a = agendas[i];
        if (a.ruangan === room || a.ruangan === "Semua Ruangan" || room === "Semua Ruangan") {
            var exStart = parseAppDate(a.mulaiRaw || a.mulai);
            var exEnd = parseAppDate(a.selesaiRaw || a.selesai);

            if (!exStart || !exEnd || isNaN(exStart.getTime())) continue;

            if (clientStart <= exEnd && clientEnd >= exStart) {
                conflict = a;
                break;
            }
        }
    }

    if (conflict) {
        var userCode = (kodePesertaInput.value || "").trim().toUpperCase();
        var agendaCode = (conflict.kodePeserta || "").trim().toUpperCase();

        if (agendaCode && userCode === agendaCode) {
            warningEl.classList.remove('alert-danger');
            warningEl.classList.add('alert-success');
            warningEl.innerHTML = '✅ <strong>Kode Diterima:</strong> Anda sedang meminjam unit dalam sesi acara <strong>' + conflict.kegiatan + '</strong>.';
            warningEl.classList.remove('d-none');
            kodePesertaContainer.classList.remove('d-none');
            return { isBlocked: false };
        }

        // --- EXPLICIT FEEDBACK ON MANUAL CHECK ---
        if (isManualCheck && userCode !== "" && userCode !== agendaCode) {
            ui.error("Kode Peserta tidak sesuai. Silakan hubungi admin atau asisten lab.");
        }

        var mulaiDisp = new Date(conflict.mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        var selesaiDisp = new Date(conflict.selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        var rangeDisp = mulaiDisp;
        if (mulaiDisp !== selesaiDisp) rangeDisp = mulaiDisp + ' s.d ' + selesaiDisp;

        warningEl.innerHTML = '⚠️ <strong>Lab Terbatas/Tutup:</strong> Ada agenda <strong>' + conflict.kegiatan + '</strong> pada ' + rangeDisp + '. Silakan pilih tanggal atau ruangan lain.';
        warningEl.classList.remove('alert-success');
        warningEl.classList.add('alert-danger');
        warningEl.classList.remove('d-none');
        kodePesertaContainer.classList.remove('d-none');
        return { isBlocked: true };
    } else {
        warningEl.classList.add('d-none');
        kodePesertaContainer.classList.add('d-none');
        return { isBlocked: false };
    }
}

/**
 * Robust Date Parser for App (Handles ISO, Date Objects, and DD-MMM-YYYY)
 */
function parseAppDate(dateInput) {
    if (!dateInput) return null;
    if (dateInput instanceof Date) return dateInput;

    // Try standard parsing first
    var d = new Date(dateInput);
    if (!isNaN(d.getTime())) return d;

    // Handle DD-MMM-YYYY (e.g., 11-Mar-2026)
    if (typeof dateInput === 'string' && dateInput.indexOf('-') !== -1) {
        var parts = dateInput.split('-');
        if (parts.length === 3) {
            var day = parseInt(parts[0], 10);
            var monthStr = parts[1].toLowerCase().substring(0, 3);
            var year = parseInt(parts[2], 10);

            var monthMap = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'mei': 4, 'may': 4,
                'jun': 5, 'jul': 6, 'agt': 7, 'aug': 7, 'sep': 8, 'okt': 9,
                'oct': 9, 'nov': 10, 'des': 11, 'dec': 11
            };

            if (monthMap[monthStr] !== undefined) {
                return new Date(year, monthMap[monthStr], day);
            }
        }
    }

    return null;
}
