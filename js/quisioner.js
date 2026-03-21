var EMOJI_MAP = {
    1: { icon: '😠', text: 'Sangat Kurang', color: '#ef4444' },
    2: { icon: '☹️', text: 'Kurang Baik', color: '#f97316' },
    3: { icon: '😐', text: 'Cukup', color: '#eab308' },
    4: { icon: '🙂', text: 'Baik', color: '#84cc16' },
    5: { icon: '😍', text: 'Sangat Baik', color: '#22c55e' }
};

document.addEventListener('DOMContentLoaded', function () {
    initQuisioner();
    loadBranding();
});

function initQuisioner() {
    // Manual search params parser for ES5
    var search = window.location.search.substring(1);
    var pairs = search.split('&');
    var params = {};
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        if (pair[0]) params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }

    var requestId = params.id;
    if (requestId) {
        document.getElementById('requestId').value = requestId;
    }

    // Attach slider listeners
    var sliders = document.querySelectorAll('.rating-slider');
    for (var j = 0; j < sliders.length; j++) {
        var slider = sliders[j];
        slider.addEventListener('input', function (e) {
            updateRatingFeedback(e.target);
        });
        // Set initial state
        updateRatingFeedback(slider);
    }

    var form = document.getElementById('quisioner-form');
    if (form) form.addEventListener('submit', handleSubmit);
}

function updateRatingFeedback(slider) {
    var val = slider.value;
    var id = slider.name;
    var feedback = EMOJI_MAP[val];

    var emojiEl = document.getElementById('emoji-' + id);
    var textEl = document.getElementById('text-' + id);

    if (emojiEl && textEl) {
        emojiEl.textContent = feedback.icon;
        textEl.textContent = feedback.text;
        textEl.style.color = feedback.color;

        // Add pop animation
        emojiEl.classList.remove('bounce');
        void emojiEl.offsetWidth; // trigger reflow
        emojiEl.classList.add('bounce');

        // Update slider accent color (standard CSS property)
        slider.style.accentColor = feedback.color;
    }
}

function loadBranding() {
    api.getBranding()
        .then(function (res) {
            if (res.success && res.data && res.data.logo) {
                var logoSrc = res.data.logo;
                if (logoSrc.indexOf('http') !== 0 && logoSrc.indexOf('data:') !== 0) {
                    logoSrc = 'data:image/png;base64,' + logoSrc;
                }
                var logoEl = document.getElementById('app-logo');
                if (logoEl) logoEl.src = logoSrc;
            }
        })
        .catch(function (e) {
            console.warn('Failed to load branding', e);
        });
}

function handleSubmit(e) {
    if (e.preventDefault) e.preventDefault();

    var submitBtn = document.getElementById('submit-btn');
    var form = e.target;

    // Manual formData collection for ES5/Old Browser robustness
    var payload = {
        requestId: document.getElementById('requestId').value,
        komputer: document.getElementsByName('komputer')[0].value,
        fasilitas: document.getElementsByName('fasilitas')[0].value,
        kebersihan: document.getElementsByName('kebersihan')[0].value,
        administrasi: document.getElementsByName('administrasi')[0].value,
        software: document.getElementsByName('software')[0].value,
        web_portal: document.getElementsByName('web_portal')[0].value,
        saran: document.getElementsByName('saran')[0] ? document.getElementsByName('saran')[0].value : ''
    };

    // Submit
    submitBtn.disabled = true;
    submitBtn.textContent = "Mengirim...";

    api.run('apiSubmitQuisioner', payload)
        .then(function (res) {
            if (res.success) {
                var formBody = document.getElementById('form-body');
                if (formBody) formBody.style.display = 'none';
                var successMsg = document.getElementById('success-message');
                if (successMsg) successMsg.style.display = 'block';
                window.scrollTo(0, 0);
            } else {
                ui.error("Gagal mengirim quisioner: " + res.message, "Simpan Gagal");
                submitBtn.disabled = false;
                submitBtn.textContent = "Kirim Quisioner";
            }
        })
        .catch(function (err) {
            ui.error("Terjadi kesalahan koneksi: " + err.message, "System Error");
            submitBtn.disabled = false;
            submitBtn.textContent = "Kirim Quisioner";
        });
}
