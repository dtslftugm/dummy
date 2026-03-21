/**
 * API Client - Hybrid Wrapper untuk Google Apps Script (ES5 Version)
 * Mendukung akses via JSONP (GitHub/External) dan google.script.run (Inside GAS)
 */
function APIClient() {
    this.callbackCounter = 0;
    this.functionMap = {
        'apiGetInitialData': 'initial-data',
        'apiGetAvailableComputers': 'computers-available',
        'apiGetBranding': 'branding',
        'apiCheckSoftwareRestrictions': 'check-restrictions',
        'apiSubmitRequest': 'submit-request',
        'apiAdminLogin': 'admin-login',
        'apiCheckAuth': 'admin-check-auth',
        'apiGetAdminRequests': 'admin-requests',
        'apiApproveRequest': 'admin-approve',
        'apiRejectRequest': 'admin-reject',
        'apiRevokeRequest': 'admin-revoke',
        'apiGetMaintenanceList': 'admin-maintenance-list',
        'apiCompleteMaintenance': 'admin-maintenance-complete',
        'apiGetExpiredUsage': 'admin-expired-usage',
        'apiGetAgendas': 'admin-agendas',
        'apiSimpanAgenda': 'admin-save-agenda',
        'apiHapusAgenda': 'admin-delete-agenda',
        'apiSiarkanPengingatAgenda': 'admin-broadcast-agenda',
        'apiGetComputerDetails': 'admin-get-computer-details',
        'apiCompleteLicenseCleanup': 'admin-license-cleanup',
        'apiSubmitQuisioner': 'submit-quisioner',
        'apiUpdateMaintenanceStatus': 'admin-maintenance-update',
        'apiGetAllComputerNames': 'admin-all-computers',
        'apiSetManualMaintenance': 'admin-maintenance-manual',
        'apiGetReportingFilters': 'admin-reporting-filters',
        'apiGetStatisticsData': 'admin-statistics',
        'apiLogout': 'admin-logout'
    };
    console.log('APIClient (ES5) initialized');
}

/**
 * Get Base URL from CONFIG
 */
APIClient.prototype.getBaseURL = function () {
    var globalConfig = (typeof CONFIG !== 'undefined') ? CONFIG : (window.CONFIG || {});
    return globalConfig.API_URL || '';
};

/**
 * Detect environment
 */
APIClient.prototype.isInGAS = function () {
    return typeof google !== 'undefined' && google.script && google.script.run;
};

/**
 * Generic run method (Hybrid)
 */
APIClient.prototype.run = function (functionName, params) {
    var _this = this;
    if (this.isInGAS()) {
        return new Promise(function (resolve, reject) {
            var runner = google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(function (err) {
                    console.error("GAS Error (" + functionName + "):", err);
                    reject(err);
                });
            runner[functionName](params);
        });
    } else {
        var path = this.functionMap[functionName] || functionName;
        return this.jsonpRequest(path, params);
    }
};

/**
 * JSONP Request (ES5 Compatible)
 */
APIClient.prototype.jsonpRequest = function (path, params) {
    var _this = this;
    return new Promise(function (resolve, reject) {
        var rawURL = _this.getBaseURL();
        var cleanBaseURL = (rawURL || '').trim();

        if (!cleanBaseURL) {
            reject(new Error('API URL (CONFIG.API_URL) belum diatur di config.js'));
            return;
        }

        _this.callbackCounter++;
        var callbackName = 'cb' + _this.callbackCounter + '_' + Date.now();
        var script = document.createElement('script');

        var queryString = 'path=' + encodeURIComponent(path) + '&callback=' + encodeURIComponent(callbackName);
        if (params && typeof params === 'object') {
            for (var key in params) {
                if (Object.prototype.hasOwnProperty.call(params, key)) {
                    var val = params[key];
                    if (val === null || val === undefined) val = "";
                    queryString += '&' + encodeURIComponent(key) + '=' + encodeURIComponent(val);
                }
            }
        }

        var finalURL = cleanBaseURL + (cleanBaseURL.indexOf('?') === -1 ? '?' : '&') + queryString + '&_t=' + Date.now();
        console.log('JSONP Request attempt:', finalURL);

        // Force anonymous request to avoid Google Multiple-Account redirect issues
        script.crossOrigin = 'anonymous';
        script.src = finalURL;

        var timeout = setTimeout(function () {
            if (window[callbackName]) {
                delete window[callbackName];
                if (script.parentNode) script.parentNode.removeChild(script);
                reject(new Error('Request Timeout - Google Script tidak merespon dalam 15 detik.'));
            }
        }, 15000);

        window[callbackName] = function (response) {
            clearTimeout(timeout);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);

            if (response && response.success) {
                resolve(response);
            } else {
                var msg = (response && response.message) ? response.message : 'Request failed at backend';
                reject(new Error(msg));
            }
        };

        script.onerror = function () {
            clearTimeout(timeout);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
            console.error('Script failed to load:', finalURL);
            var diag = "\nBaseURL: " + cleanBaseURL + "\nCallback: " + callbackName;
            reject(new Error('Script load failed.' + diag + '\nFull URL: ' + finalURL));
        };

        document.body.appendChild(script);
    });
};

// --- ENDPOINTS ---

APIClient.prototype.getInitialData = function (renewalId) {
    return this.run('apiGetInitialData', renewalId ? { renewal_id: renewalId } : {});
};

APIClient.prototype.getAvailableComputers = function (room) {
    return this.run('apiGetAvailableComputers', room ? { room: room } : {});
};

APIClient.prototype.getBranding = function () {
    return this.run('apiGetBranding');
};

APIClient.prototype.submitRequest = function (formData) {
    return this.run('apiSubmitRequest', formData);
};

APIClient.prototype.adminLogin = function (email, password) {
    return this.run('apiAdminLogin', { email: email, password: password });
};

APIClient.prototype.checkAuth = function (token) {
    return this.run('apiCheckAuth', { token: token });
};

APIClient.prototype.getAdminRequests = function () {
    return this.run('apiGetAdminRequests');
};

APIClient.prototype.approveRequest = function (data) {
    return this.run('apiApproveRequest', data);
};

APIClient.prototype.rejectRequest = function (data) {
    return this.run('apiRejectRequest', data);
};

APIClient.prototype.getReportingFilters = function () {
    return this.run('apiGetReportingFilters', {});
};

APIClient.prototype.getStatisticsData = function (filters) {
    return this.run('apiGetStatisticsData', filters);
};

APIClient.prototype.uploadFile = function (data) {
    if (this.isInGAS()) {
        return this.run('apiUploadFile', data);
    }

    var payload = JSON.stringify({
        path: 'upload-file',
        rowIndex: data.rowIndex,
        fileData: data.fileData,
        mimeType: data.mimeType,
        fileName: data.fileName
    });

    return fetch(this.getBaseURL(), {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: payload
    }).then(function () {
        return { success: true, opaque: true };
    });
};

// Create instance
var api = new APIClient();
var GAS = api;
