// Konfigurasi Akun Utama & Global State
const ADMIN_USER = "DSSMANSALA2026##";
let currentUser = "";
let isExamActive = false;
let violationCount = 0;
let clockInterval = null;
let html5QrcodeScanner = null;

// Konfigurasi Kunci Audio Otomatis (Web Audio API)
let audioCtx = null;
let gainNode = null;
let sourceNode = null;
const alertSound = document.getElementById('alert-sound');

// Elemen DOM Selector
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const loginPage = document.getElementById('login-page');
const examPage = document.getElementById('exam-page');
const adminPage = document.getElementById('admin-page');
const examIframe = document.getElementById('exam-iframe');
const logOutput = document.getElementById('log-output');

const notificationContainer = document.getElementById('notification-container');
const btnBiometric = document.getElementById('btn-biometric');
const btnOpenScanner = document.getElementById('btn-open-scanner');
const btnCloseScanner = document.getElementById('btn-close-scanner');
const scannerModal = document.getElementById('scanner-modal');

const logoutModal = document.getElementById('logout-modal');
const btnTriggerLogout = document.getElementById('btn-trigger-logout');
const btnCancelLogout = document.getElementById('btn-cancel-logout');
const btnFinalLogout = document.getElementById('btn-final-logout');
const logoutConfirmInput = document.getElementById('logout-confirm-input');
const clockDisplay = document.getElementById('clock-display');

// --- 1. NOTIFIKASI ANIMASI CUSTOM (TOAST ENGINE) ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if(type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if(type === 'danger') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';

    toast.innerHTML = `${icon} <span>${message}</span>`;
    notificationContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4500);
}

// --- 2. AUDIO SECURITY HARD LOCK ENGINE (SETENGAH VOLUME BROWSER) ---
function initAudioEngine() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        sourceNode = audioCtx.createMediaElementSource(alertSound);
        
        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    }
}

function playSecureAlarm() {
    initAudioEngine();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // Paksa amplitudo suara internal browser di level 0.5 (Setengah Volume Maksimal)
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    alertSound.play().catch(err => console.log("Menunggu interaksi awal pengguna untuk trigger audio"));
    
    // Perlindungan lapis kedua objek media HTML5
    alertSound.volume = 1.0; 
}

function stopSecureAlarm() {
    alertSound.pause();
    alertSound.currentTime = 0;
}

// Kunci volume paksa: Jika siswa mencoba menurunkan volume aplikasi via script/elemen
alertSound.addEventListener('volumechange', () => {
    if (isExamActive && !alertSound.paused) {
        if(gainNode) gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    }
});

// --- 3. WIDGET REALTIME JAM ASIA/JAKARTA (WIB) ---
function startJakartaClock() {
    if(clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
        const formatWaktu = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
        }).format(new Date());
        clockDisplay.textContent = `${formatWaktu.replace(/\./g, ':')} WIB`;
    }, 1000);
}

function getJakartaTimestamp() {
    return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date()).replace(/\./g, ':');
}

// --- 4. INTEGRASI KAMERA BARCODE (LANGSUNG MENUJU SOAL) ---
btnOpenScanner.addEventListener('click', () => {
    scannerModal.classList.add('open');
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 15, qrbox: 250 });
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
});

function onScanSuccess(decodedText, decodedResult) {
    // Validasi apakah isi dari barcode berupa URL link soal (gform/situs sekolah)
    if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        showToast("Barcode Soal Terbaca! Membuka lembar soal...", "success");
        
        html5QrcodeScanner.clear();
        scannerModal.classList.remove('open');
        
        currentUser = "Siswa (Scan Barcode)";
        switchPage('exam-page');
        
        // Membuka link soal langsung di dalam iframe aplikasi agar tidak kabur ke Chrome
        examIframe.src = decodedText;
        startExamSession();
    } else {
        showToast("Isi Barcode valid, namun bukan merupakan link tautan URL Ujian!", "danger");
    }
}

function onScanFailure(error) {}

btnCloseScanner.addEventListener('click', () => {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    scannerModal.classList.remove('open');
    showToast("Pemindaian barcode dibatalkan.", "info");
});

// --- 5. LOGIKA AUTENTIKASI ADMIN & LOGIN MANUAL ---
async function checkBiometricSupport() {
    if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        try {
            const isSupported = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (isSupported) btnBiometric.style.display = 'inline-flex';
        } catch (err) { console.log(err); }
    }
}
checkBiometricSupport();

btnBiometric.addEventListener('click', async () => {
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const options = {
            publicKey: {
                challenge: challenge, rp: { name: "Exambro" },
                user: { id: new Uint8Array([1]), name: "admin@dssmansala.com", displayName: "Dennis Septiano" },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
                timeout: 60000
            }
        };
        const credential = await navigator.credentials.create(options);
        if (credential) {
            currentUser = "Admin (Biometric)";
            usernameInput.value = ADMIN_USER;
            switchPage('admin-page');
            addLog("SYSTEM", `Admin masuk via Sidik Jari pada pukul ${getJakartaTimestamp()} WIB.`);
            renderLogs();
            showToast("Login Biometrik Berhasil! Selamat Datang Dennis Septiano.", "success");
        }
    } catch (err) {
        showToast("Otentikasi sidik jari gagal atau dibatalkan.", "danger");
    }
});

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputUser = usernameInput.value.trim();

    if (inputUser === ADMIN_USER) {
        currentUser = "Admin";
        switchPage('admin-page');
        addLog("SYSTEM", `Admin manual login pada pukul ${getJakartaTimestamp()} WIB.`);
        renderLogs();
        showToast("Selamat Datang Admin Dennis Septiano.", "success");
    } else {
        // Fallback login manual link soal jika tidak menggunakan barcode
        if (inputUser.startsWith('http')) {
            currentUser = "Siswa (Manual Link)";
            switchPage('exam-page');
            examIframe.src = inputUser;
            startExamSession();
        } else {
            showToast("Siswa wajib menggunakan tombol 'Scan Barcode Soal' atau input Link Soal langsung!", "danger");
        }
    }
});

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// --- 6. LIVE SENSOR DETEKSI KECURANGAN LAYAR BELAH ---
function startExamSession() {
    isExamActive = true;
    violationCount = 0;
    startJakartaClock();
    initAudioEngine(); // Siapkan engine suara

    addLog("SYSTEM", `Siswa masuk lembar soal: ${examIframe.src}`);

    // Daftarkan listener fokus aplikasi
    window.addEventListener('blur', reportViolation);
    document.addEventListener('visibilitychange', handleVisibility);
}

function handleVisibility() {
    if (document.hidden && isExamActive) reportViolation();
}

function reportViolation() {
    if (!isExamActive) return;
    violationCount++;
    const timestamp = getJakartaTimestamp();
    
    // NYALAKAN ALARM DAN KUNCI DI SETENGAH VOLUME OTOMATIS
    playSecureAlarm();
    
    showToast(`PELANGGARAN TERDETEKSI! Jangan membelah layar/buka tab lain! Alarm aktif setengah volume.`, "danger");
    addLog("CHEAT", `[${timestamp} WIB] SISWA melanggar split-screen atau ganti aplikasi! (Pelanggaran ke-${violationCount})`);
    renderLogs();
}

// --- 7. LOGIKA VALIDASI TOMBOL KELUAR WAJIB KETIK "Selesai" ---
btnTriggerLogout.addEventListener('click', () => {
    logoutModal.classList.add('open');
    logoutConfirmInput.value = "";
    btnFinalLogout.disabled = true;
    logoutConfirmInput.focus();
});

logoutConfirmInput.addEventListener('input', () => {
    // Validasi pengetikan kata sensitif "Selesai"
    if (logoutConfirmInput.value.trim() === "Selesai") {
        btnFinalLogout.disabled = false;
    } else {
        btnFinalLogout.disabled = true;
    }
});

btnCancelLogout.addEventListener('click', () => {
    logoutModal.classList.remove('open');
});

btnFinalLogout.addEventListener('click', () => {
    logoutModal.classList.remove('open');
    stopSecureAlarm(); // Matikan alarm jika siswa keluar secara valid
    showToast("Berhasil keluar dari ujian dengan aman.", "success");
    resetAppState();
});

// --- 8. MANAGEMENT LOG LOCAL STORAGE ---
function addLog(type, message) {
    let logs = JSON.parse(localStorage.getItem('exambro_logs')) || [];
    logs.push({ type, message });
    localStorage.setItem('exambro_logs', JSON.stringify(logs));
}

function renderLogs() {
    logOutput.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('exambro_logs')) || [];
    if (logs.length === 0) {
        logOutput.innerHTML = '<div class="log-item system">[SYSTEM] Belum ada aktivitas kecurangan terekam.</div>';
        return;
    }
    logs.forEach(item => {
        const div = document.createElement('div');
        div.className = `log-item ${item.type === 'CHEAT' ? 'cheat' : 'system'}`;
        div.innerText = item.message;
        logOutput.appendChild(div);
    });
    logOutput.scrollTop = logOutput.scrollHeight;
}

document.getElementById('btn-clear-log').addEventListener('click', () => {
    if(confirm("Hapus seluruh catatan riwayat kecurangan?")) {
        localStorage.removeItem('exambro_logs');
        renderLogs();
    }
});

function resetAppState() {
    isExamActive = false;
    stopSecureAlarm();
    if(clockInterval) clearInterval(clockInterval);
    window.removeEventListener('blur', reportViolation);
    document.removeEventListener('visibilitychange', handleVisibility);
    usernameInput.value = "";
    examIframe.src = "about:blank";
    switchPage('login-page');
}

document.getElementById('btn-admin-logout').addEventListener('click', resetAppState);
renderLogs();
