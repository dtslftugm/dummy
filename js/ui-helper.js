/**
 * UI Helper - Layanan Komputasi DTSL
 * Handles custom Toasts and Modals to replace native browser alerts
 * Standard: ES5 (Safe Mode)
 */

var ui = {
    _modal: null,
    _toastCount: 0,

    init: function () {
        this._injectStyles();
        this._injectContainers();
    },

    /**
     * Show a premium alert modal
     * @param {string} title 
     * @param {string} message 
     * @param {string} type 'success', 'error', 'warning', 'info'
     * @returns {Promise}
     */
    alert: function (message, title, type) {
        var _this = this;
        title = title || 'Pesan Sistem';
        type = type || 'info';

        return new Promise(function (resolve) {
            var modalEl = document.getElementById('ui-global-modal');
            var header = document.getElementById('ui-modal-header');
            var titleEl = document.getElementById('ui-modal-title');
            var body = document.getElementById('ui-modal-body');
            var footer = document.getElementById('ui-modal-footer');
            var icon = '';

            // Set Type Specifics
            header.className = 'modal-header border-0 pb-0';
            if (type === 'error') icon = '❌ ';
            else if (type === 'success') icon = '✅ ';
            else if (type === 'warning') icon = '⚠️ ';
            else icon = 'ℹ️ ';

            titleEl.innerHTML = '<span class="fw-bold">' + icon + title + '</span>';
            body.innerHTML = '<p class="mb-0 text-center py-3">' + message + '</p>';

            // Single "OK" button
            footer.innerHTML = '<button type="button" class="btn btn-primary rounded-pill px-4 fw-bold" data-bs-dismiss="modal">Oke</button>';

            if (!_this._modal) {
                _this._modal = new bootstrap.Modal(modalEl);
            }

            modalEl.addEventListener('hidden.bs.modal', function handler() {
                modalEl.removeEventListener('hidden.bs.modal', handler);
                resolve();
            });

            _this._modal.show();
        });
    },

    /**
     * Show a confirm modal
     * @returns {Promise<boolean>}
     */
    confirm: function (message, title) {
        var _this = this;
        title = title || 'Konfirmasi';

        return new Promise(function (resolve) {
            var modalEl = document.getElementById('ui-global-modal');
            var header = document.getElementById('ui-modal-header');
            var titleEl = document.getElementById('ui-modal-title');
            var body = document.getElementById('ui-modal-body');
            var footer = document.getElementById('ui-modal-footer');

            header.className = 'modal-header border-0 pb-0';
            titleEl.innerHTML = '<span class="fw-bold">❓ ' + title + '</span>';
            body.innerHTML = '<p class="mb-0 text-center py-3">' + message + '</p>';

            footer.innerHTML =
                '<button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal" id="btn-ui-cancel">Batal</button>' +
                '<button type="button" class="btn btn-primary rounded-pill px-4 fw-bold" id="btn-ui-confirm">Ya, Lanjutkan</button>';

            if (!_this._modal) {
                _this._modal = new bootstrap.Modal(modalEl);
            }

            var confirmed = false;
            var onConfirm = function () {
                confirmed = true;
                _this._modal.hide();
            };

            document.getElementById('btn-ui-confirm').onclick = onConfirm;

            modalEl.addEventListener('hidden.bs.modal', function handler() {
                modalEl.removeEventListener('hidden.bs.modal', handler);
                resolve(confirmed);
            });

            _this._modal.show();
        });
    },

    /**
     * Show a prompt modal
     * @returns {Promise<string|null>}
     */
    prompt: function (message, title, defaultValue) {
        var _this = this;
        title = title || 'Input Diperlukan';
        defaultValue = defaultValue || '';

        return new Promise(function (resolve) {
            var modalEl = document.getElementById('ui-global-modal');
            var header = document.getElementById('ui-modal-header');
            var titleEl = document.getElementById('ui-modal-title');
            var body = document.getElementById('ui-modal-body');
            var footer = document.getElementById('ui-modal-footer');

            header.className = 'modal-header border-0 pb-0';
            titleEl.innerHTML = '<span class="fw-bold">📝 ' + title + '</span>';
            body.innerHTML =
                '<p class="mb-2 text-center">' + message + '</p>' +
                '<input type="text" id="ui-prompt-input" class="form-control rounded-pill px-3" value="' + defaultValue + '">';

            footer.innerHTML =
                '<button type="button" class="btn btn-light rounded-pill px-4" data-bs-dismiss="modal">Batal</button>' +
                '<button type="button" class="btn btn-primary rounded-pill px-4 fw-bold" id="btn-ui-prompt-submit">Kirim</button>';

            if (!_this._modal) {
                _this._modal = new bootstrap.Modal(modalEl);
            }

            var result = null;
            var onSubmit = function () {
                result = document.getElementById('ui-prompt-input').value;
                _this._modal.hide();
            };

            // Focus input after modal shown
            modalEl.addEventListener('shown.bs.modal', function handler() {
                modalEl.removeEventListener('shown.bs.modal', handler);
                document.getElementById('ui-prompt-input').focus();
            });

            document.getElementById('btn-ui-prompt-submit').onclick = onSubmit;
            document.getElementById('ui-prompt-input').onkeyup = function (e) {
                if (e.key === 'Enter') onSubmit();
            };

            modalEl.addEventListener('hidden.bs.modal', function handler() {
                modalEl.removeEventListener('hidden.bs.modal', handler);
                resolve(result);
            });

            _this._modal.show();
        });
    },

    /**
     * Show a quick toast notification
     */
    success: function (message) { this.toast(message, 'success'); },
    error: function (message) { this.toast(message, 'danger'); },
    info: function (message) { this.toast(message, 'info'); },
    warning: function (message) { this.toast(message, 'warning'); },

    loading: function (message) {
        var overlay = document.getElementById('loading-overlay');
        var textEl = document.getElementById('loading-text');
        if (overlay) overlay.style.display = 'flex';
        if (textEl) textEl.textContent = message || 'Memuat...';
    },

    hideLoading: function () {
        var overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    toast: function (message, type) {
        var container = document.getElementById('ui-toast-container');
        var id = 'toast-' + (++this._toastCount);
        var icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'danger') icon = '❌';
        else if (type === 'warning') icon = '⚠️';

        var textColorClass = (type === 'warning') ? 'text-dark' : 'text-white';
        var closeBtnClass = (type === 'warning') ? 'btn-close' : 'btn-close btn-close-white';

        var html =
            '<div id="' + id + '" class="toast align-items-center ' + textColorClass + ' bg-' + (type || 'primary') + ' border-0 shadow-lg mb-2" role="alert" aria-live="assertive" aria-atomic="true">' +
            '  <div class="d-flex">' +
            '    <div class="toast-body">' +
            '      <span class="me-2">' + icon + '</span>' + message +
            '    </div>' +
            '    <button type="button" class="' + closeBtnClass + ' me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>' +
            '  </div>' +
            '</div>';

        container.insertAdjacentHTML('beforeend', html);
        var toastEl = document.getElementById(id);
        var toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();

        // Cleanup DOM after hide
        toastEl.addEventListener('hidden.bs.toast', function () {
            toastEl.parentNode.removeChild(toastEl);
        });
    },

    _injectContainers: function () {
        // Modal Container
        if (!document.getElementById('ui-global-modal')) {
            var modalHtml =
                '<div class="modal fade" id="ui-global-modal" tabindex="-1" aria-hidden="true">' +
                '  <div class="modal-dialog modal-dialog-centered">' +
                '    <div class="modal-content border-0 shadow-lg" style="border-radius: 20px;">' +
                '      <div id="ui-modal-header" class="modal-header border-0 pb-0">' +
                '        <h5 class="modal-title" id="ui-modal-title"></h5>' +
                '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                '      </div>' +
                '      <div class="modal-body" id="ui-modal-body"></div>' +
                '      <div class="modal-footer border-0 pt-0 justify-content-center" id="ui-modal-footer"></div>' +
                '    </div>' +
                '  </div>' +
                '</div>';
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Toast Container
        if (!document.getElementById('ui-toast-container')) {
            var toastHtml = '<div id="ui-toast-container" class="toast-container position-fixed bottom-0 end-0 p-3" style="z-index: 9999;"></div>';
            document.body.insertAdjacentHTML('beforeend', toastHtml);
        }
    },

    _injectStyles: function () {
        var css = '.toast { font-family: "Outfit", sans-serif; border-radius: 12px; }' +
            '.modal-content { font-family: "Outfit", sans-serif; background-color: var(--bg-container, #fff) !important; color: var(--text-main, #333) !important; border: 1px solid var(--border-color, #dee2e6) !important; }' +
            '.modal-header, .modal-footer { border-color: var(--border-color, #dee2e6) !important; }' +
            'body:not(.light-mode) .btn-close:not(.btn-close-white) { filter: invert(1) grayscale(100%) brightness(200%); }' +
            '.modal-body { color: inherit !important; }';
        var style = document.createElement('style');
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }
};

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ui.init(); });
} else {
    ui.init();
}

// Global Override for alert (Optional, but user asked to "trap/catch")
window.nativeAlert = window.alert;
window.alert = function (msg) {
    ui.alert(msg);
};

// Global aliases for backward compatibility
window.showLoading = function (msg) { ui.loading(msg); };
window.hideLoading = function () { ui.hideLoading(); };
