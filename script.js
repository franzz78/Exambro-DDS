// Konfigurasi Akun Utama & Global State
const ADMIN_USER = "DSSMANSALA2026##";
let currentUser = "";
let isExamActive = false;
let violationCount = 0;
let clockInterval = null;
let html5QrcodeScanner = null;

// State Baru Kontrol Akses Admin (Default Terbuka)
let isGateOpen = localStorage.getItem('exambro_gate_status') !== 'closed';

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

// Elemen Baru Tombol Admin Akses
const btnGateOpen = document.getElementById('btn-gate-open');
const btnGateClose = document.getElementById('btn-gate-close');

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

// --- 2. FITUR DETEKSI NAMA DEVICE/PERANGKAT OTOMATIS ---
function getDeviceName() {
    const ua = navigator.userAgent;
    let deviceName = "Unknown Device";
    
    if (/android/i.test(ua)) {
        // Coba ekstrak model spesifik tipe HP Android jika tertera
        const match = ua.match(/Android\s([0-9\.]+);\s([^;)]+)/);
        deviceName = match ? `Android (${match[2]})` : "Perangkat Android";
    } else if (/iPhone/i.test(ua)) {
        deviceName = "Apple iPhone";
    } else if (/iPad/i.test(ua)) {
        deviceName = "Apple iPad";
    } else if (/Windows NT/i.test(ua)) {
        deviceName = "PC / Laptop Windows";
    } else if (/Macintosh/i.test(ua)) {
        deviceName = "Apple MacBook/Mac";
    } else if (/Linux/i.test(ua)) {
        deviceName = "Linux Desktop";
    }
    return deviceName;
}

// --- 3. AUDIO LOCK ENGINE (AMPLITUDO 0.5 - ANTI-LAYAR BELAH) ---
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
    // Paksa intensitas suara di level tengah (0.5), walau volume fisik dikecilkan siswa, audio browser tetap memekik
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    alertSound.play().catch(err => console.log("Menunggu ketukan layar siswa untuk inisialisasi audio"));
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

// --- 4. WIDGET JAM REALTIME JAKARTA ---
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

// --- 5. MANAGEMENT FUNGSI KONTROL GERBANG AKSES UJIAN ---
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
    addLog("SYSTEM", `[${getJakartaTimestamp()} WIB] KONTROL: Admin membuka akses gerbang masuk ujian.`);
    renderLogs();
    showToast("Gerbang akses ujian berhasil DIBUKA untuk siswa.", "success");
});

btnGateClose.addEventListener('click', () => {
    isGateOpen = false;
    localStorage.setItem('exambro_gate_status', 'closed');
    updateGateUI();
    addLog("SYSTEM", `[${getJakartaTimestamp()} WIB] KONTROL: Admin menutup total gerbang masuk ujian.`);
    renderLogs();
    showToast("Gerbang akses ujian berhasil DITUTUP. Siswa tidak bisa masuk!", "danger");
});

// --- 6. INTEGRASI KAMERA SCANNER BARCODE SOAL ---
btnOpenScanner.addEventListener('click', () => {
    // PROTEKSI UTAMA: Cek apakah Admin sedang menutup akses gerbang ujian
    if (!isGateOpen) {
        showToast("Gagal Masuk! Akses ujian saat ini ditutup/dikunci oleh Admin.", "danger");
        return;
    }
    scannerModal.classList.add('open');
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 15, qrbox: 250 });
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
});

function onScanSuccess(decodedText, decodedResult) {
    if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        // Cek kembali perlindungan gerbang sebelum merender iframe soal
        if (!isGateOpen) {
            showToast("Akses mendadak dikunci oleh Admin!", "danger");
            html5QrcodeScanner.clear();
            scannerModal.classList.remove('open');
            return;
        }
        
        showToast("Barcode valid! Memuat perangkat dan mengunci lembar soal...", "success");
        html5QrcodeScanner.clear();
        scannerModal.classList.remove('open');
        
        currentUser = "Siswa (Scan Barcode)";
        switchPage('exam-page');
        
        examIframe.src = decodedText;
        startExamSession();
    } else {
        showToast("Isi Barcode salah! Bukan tautan website lembar soal.", "danger");
    }
}

function onScanFailure(error) {}

btnCloseScanner.addEventListener('click', () => {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    scannerModal.classList.remove('open');
    showToast("Pemindaian barcode dibatalkan.", "info");
});

// --- 7. SISTEM LOGIN BIOMETRIK & KODE MANUAL ---
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
        if (!isGateOpen) {
            showToast("Akses masuk ditutup oleh Admin!", "danger");
            return;
        }
        if (inputUser.startsWith('http')) {
            currentUser = "Siswa (Manual Tautan)";
            switchPage('exam-page');
            examIframe.src = inputUser;
            startExamSession();
        } else {
            showToast("Gunakan tombol 'Scan Barcode Soal' atau input URL lengkap!", "danger");
        }
    }
});

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// --- 8. LIVE PENGAWASAN LAYAR BELAH (ANTI SPLIT-SCREEN) ---
function startExamSession() {
    isExamActive = true;
    violationCount = 0;
    startJakartaClock();
    initAudioEngine();

    // Deteksi nama device otomatis siswa yang masuk
    const deviceSiswa = getDeviceName();

    addLog("SYSTEM", `Siswa masuk ujian menggunakan DEVICE: [${deviceSiswa}] pada pukul ${getJakartaTimestamp()} WIB.`);
    renderLogs();

    // Jalankan deteksi pengunci layar belah / kehilangan fokus tab
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
    const deviceSiswa = getDeviceName();
    
    // Bunyikan sirene kencang di level gain browser 0.5
    playSecureAlarm();
    
    showToast(`ALARM! Dilarang membelah layar (Split Screen) atau pindah tab!`, "danger");
    addLog("CHEAT", `[${timestamp} WIB] PELANGGARAN: Siswa di perangkat [${deviceSiswa}] mencoba membelah layar/buka tab lain! (Ke-${violationCount})`);
    renderLogs();
}

// --- 9. TOMBOL KELUAR VALIDASI TEKS "Selesai" ---
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
    showToast("Sesi pengerjaan ditutup dengan aman.", "success");
    resetAppState();
});

// --- 10. MANAGEMENT REKAP LOG LOCALSTORAGE ---
function addLog(type, message) {
    let logs = JSON.parse(localStorage.getItem('exambro_logs')) || [];
    logs.push({ type, message });
    localStorage.setItem('exambro_logs', JSON.stringify(logs));
}

function renderLogs() {
    logOutput.innerHTML = "";
    let logs = JSON.parse(localStorage.getItem('exambro_logs')) || [];
    if (logs.length === 0) {
        logOutput.innerHTML = '<div class="log-item system">[SYSTEM] Belum ada aktivitas terekam.</div>';
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
    if(confirm("Hapus seluruh catatan riwayat kecurangan dan nama device?")) {
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

// Inisialisasi awal UI saat memuat halaman pertama kali
updateGateUI();
renderLogs();
                              
