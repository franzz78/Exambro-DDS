// Konfigurasi Utama & Tautan Google Form Soal Bawaan
const ADMIN_USER = "DSSMANSALA2026##";
const DEFAULT_EXAM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSeko9XAv0x9uHmaOFHp2LTW5-vJv3xLFhtPm8kHLiXc8jN6qg/viewform";

let currentUser = "";
let isExamActive = false;
let violationCount = 0;
let clockInterval = null;
let html5QrcodeScanner = null;

// Mengambil status gerbang akses kontrol admin (Default: Terbuka)
let isGateOpen = localStorage.getItem('exambro_gate_status') !== 'closed';

// Engine Kontrol Frekuensi Audio (Web Audio API)
let audioCtx = null;
let gainNode = null;
let sourceNode = null;
const alertSound = document.getElementById('alert-sound');

// DOM Selector
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const loginPage = document.getElementById('login-page');
const examPage = document.getElementById('exam-page');
const adminPage = document.getElementById('admin-page');
const examIframe = document.getElementById('exam-iframe');
const logOutput = document.getElementById('log-output');
const gateStatusBadge = document.getElementById('gate-status-badge');

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

const btnGateOpen = document.getElementById('btn-gate-open');
const btnGateClose = document.getElementById('btn-gate-close');

// --- 1. SUNTIKAN TOAST NOTIFICATION ---
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

// --- 2. DETEKSI IDENTITAS & NAMA DEVICE ---
function getDeviceName() {
    const ua = navigator.userAgent;
    let deviceName = "Unknown Device";
    
    if (/android/i.test(ua)) {
        const match = ua.match(/Android\s([0-9\.]+);\s([^;)]+)/);
        deviceName = match ? `Android (${match[2]})` : "Perangkat Android";
    } else if (/iPhone/i.test(ua)) {
        deviceName = "Apple iPhone";
    } else if (/iPad/i.test(ua)) {
        deviceName = "Apple iPad";
    } else if (/Windows NT/i.test(ua)) {
        deviceName = "PC / Laptop Windows";
    } else if (/Macintosh/i.test(ua)) {
        deviceName = "Apple MacBook";
    }
    return deviceName;
}

// --- 3. POWER ENGINE AUDIO ALARM LOCK (SETENGAH VOLUME BROWSER) ---
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
    // Set tingkatan penguatan gelombang suara konstan di amplitudo tengah (0.5)
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    alertSound.play().catch(err => console.log("Menunggu instruksi ketuk layar awal"));
    alertSound.volume = 1.0; 
}

function stopSecureAlarm() {
    alertSound.pause();
    alertSound.currentTime = 0;
}

alertSound.addEventListener('volumechange', () => {
    if (isExamActive && !alertSound.paused) {
        if(gainNode) gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    }
});

// --- 4. JAM REALTIME DIGITAL ASIA/JAKARTA ---
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

// --- 5. LOGIKA TOMBOL BUKA/TUTUP GERBANG AKSES ADMIN ---
function updateGateUI() {
    if (isGateOpen) {
        gateStatusBadge.className = "gate-status open";
        gateStatusBadge.innerHTML = '<i class="fa-solid fa-door-open"></i> Akses Ujian: TERBUKA';
        btnGateOpen.className = "btn-success-active";
        btnGateClose.className = "btn-danger-outline";
    } else {
        gateStatusBadge.className = "gate-status closed";
        gateStatusBadge.innerHTML = '<i class="fa-solid fa-lock"></i> Akses Ujian: DITUTUP ADMIN';
        btnGateOpen.className = "btn-success-active inactive";
        btnGateClose.className = "btn-danger-outline active";
    }
}

btnGateOpen.addEventListener('click', () => {
    isGateOpen = true;
    localStorage.setItem('exambro_gate_status', 'open');
    updateGateUI();
    addLog("SYSTEM", `[${getJakartaTimestamp()} WIB] ADMIN: Membuka gerbang akses masuk ujian.`);
    renderLogs();
    showToast("Gerbang akses masuk ujian sukses DIBUKA.", "success");
});

btnGateClose.addEventListener('click', () => {
    isGateOpen = false;
    localStorage.setItem('exambro_gate_status', 'closed');
    updateGateUI();
    addLog("SYSTEM", `[${getJakartaTimestamp()} WIB] ADMIN: Menutup total gerbang masuk ujian.`);
    renderLogs();
    showToast("Gerbang akses ujian berhasil DITUTUP total.", "danger");
});

// --- 6. SCANNER CAMERA (LANGSUNG MEMBUKA TAUTAN GOOGLE FORM) ---
btnOpenScanner.addEventListener('click', () => {
    if (!isGateOpen) {
        showToast("Masuk Ditolak! Gerbang pengerjaan soal saat ini dikunci oleh Admin.", "danger");
        return;
    }
    scannerModal.classList.add('open');
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 15, qrbox: 250 });
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
});

function onScanSuccess(decodedText, decodedResult) {
    if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        if (!isGateOpen) {
            showToast("Akses mendadak dikunci oleh Pusat!", "danger");
            html5QrcodeScanner.clear();
            scannerModal.remove();
            return;
        }
        showToast("Barcode terbaca! Membuka halaman soal ujian...", "success");
        html5QrcodeScanner.clear();
        scannerModal.classList.remove('open');
        
        currentUser = "Siswa (Scan Barcode)";
        switchPage('exam-page');
        
        // Membuka tautan URL Google Form hasil scan langsung di dalam iframe Exambro
        examIframe.src = decodedText;
        startExamSession();
    } else {
        showToast("Isi QR Code / Barcode salah! Bukan tautan link ujian.", "danger");
    }
}

function onScanFailure(error) {}

btnCloseScanner.addEventListener('click', () => {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    scannerModal.classList.remove('open');
    showToast("Pemindaian barcode dibatalkan.", "info");
});

// --- 7. HANDLING LOGIN INTERACTION ---
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
            addLog("SYSTEM", `Admin [Dennis Septiano] masuk via Sidik Jari pada pukul ${getJakartaTimestamp()} WIB.`);
            renderLogs();
            showToast("Otentikasi Berhasil! Selamat Datang Dennis Septiano.", "success");
        }
    } catch (err) {
        showToast("Sidik jari tidak terdaftar atau dibatalkan.", "danger");
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
        if (!isGateOpen) {
            showToast("Gerbang pengerjaan ditutup!", "danger");
            return;
        }
        // Jika kolom kosong atau berisi kata 'soal', buka form ujian default yang diberikan
        if (inputUser === "" || inputUser.toLowerCase() === "soal") {
            currentUser = "Siswa (Default Link)";
            switchPage('exam-page');
            examIframe.src = DEFAULT_EXAM_URL;
            startExamSession();
        } else if (inputUser.startsWith('http')) {
            currentUser = "Siswa (Manual Link)";
            switchPage('exam-page');
            examIframe.src = inputUser;
            startExamSession();
        } else {
            showToast("Masukkan kode admin atau gunakan tombol 'Scan Barcode Soal'!", "danger");
        }
    }
});

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// --- 8. REALTIME MONITOR LOCK (ANTI LAYAR BELAH) ---
function startExamSession() {
    isExamActive = true;
    violationCount = 0;
    startJakartaClock();
    initAudioEngine();

    const currentDevice = getDeviceName();
    addLog("SYSTEM", `Siswa terhubung menggunakan: [${currentDevice}] menuju lembar Google Form.`);
    renderLogs();

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
    const currentDevice = getDeviceName();
    
    // Aktifkan sirene paksa setengah volume
    playSecureAlarm();
    
    showToast(`KECURANGAN TERDETEKSI! Dilarang membelah layar (Split-Screen)!`, "danger");
    addLog("CHEAT", `[${timestamp} WIB] PELANGGARAN: Siswa di perangkat [${currentDevice}] mencoba split-screen / pindah tab! (Ke-${violationCount})`);
    renderLogs();
}

// --- 9. TOMBOL FINISH HARUS KETIK "Selesai" ---
btnTriggerLogout.addEventListener('click', () => {
    logoutModal.classList.add('open');
    logoutConfirmInput.value = "";
    btnFinalLogout.disabled = true;
    logoutConfirmInput.focus();
});

logoutConfirmInput.addEventListener('input', () => {
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
    stopSecureAlarm();
    showToast("Ujian diselesaikan dengan aman.", "success");
    resetAppState();
});

// --- 10. REKAP LOG STORAGE CONSOLE ---
function addLog(type, message) {
    let logs = JSON.parse(localStorage.getItem('exambro_logs')) || [];
    logs.push({ type, message });
    localStorage.setItem('exambro_logs', JSON.stringify(logs));
}

function renderLogs() {
    logOutput.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('exambro_logs')) || [];
    if (logs.length === 0) {
        logOutput.innerHTML = '<div class="log-item system">[SYSTEM] Menunggu aktivitas pengerjaan soal siswa...</div>';
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
    if(confirm("Hapus seluruh daftar rekaman kecurangan dan nama device?")) {
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

// Render tampilan awal gerbang akses
updateGateUI();
renderLogs();
    
