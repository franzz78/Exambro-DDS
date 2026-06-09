// Konfigurasi Akun & State Aplikasi
const ADMIN_USER = "DSSMANSALA2026##";
let currentUser = "";
let isExamActive = false;
let violationCount = 0;
let clockInterval = null;
let html5QrcodeScanner = null;

// Konfigurasi Sistem Audio Anti-Hack Volume
let audioCtx = null;
let gainNode = null;
let sourceNode = null;
const alertSound = document.getElementById('alert-sound');

// Elemen DOM
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

// --- 1. ENGINE NOTIFIKASI CUSTOM BERANIMASI ---
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

// --- 2. INSTALASI ALARM & LOCK VOLUME (WEB AUDIO API) ---
function initAudioEngine() {
    if (!audioCtx) {
        // Membuat jembatan kontrol audio browser internal
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        sourceNode = audioCtx.createMediaElementSource(alertSound);
        
        // Hubungkan: Jalur Suara -> Pengatur Volume Internal -> Speaker
        sourceNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    }
}

function playSecureAlarm() {
    initAudioEngine();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    // KUNCI AMALITUDO KE 0.5 (Setengah Volume Maksimal Output Browser)
    // Walau user mematikan/mengecilkan volume tombol samping, browser dipaksa menyemburkan intensitas gelombang 50%
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    alertSound.play().catch(err => console.log("Menunggu interaksi pengguna untuk memicu audio"));
    
    // Cegah modifikasi objek audio manual lewat inspeksi script
    alertSound.volume = 1.0; 
}

function stopSecureAlarm() {
    alertSound.pause();
    alertSound.currentTime = 0;
}

// Proteksi Tambahan: Jika siswa mencoba memanipulasi pemutar audio
alertSound.addEventListener('volumechange', () => {
    if (isExamActive && alertSound.paused === false) {
        // Jika volume diganti paksa sewaktu melanggar, balikan paksa amplitudonya
        if(gainNode) gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    }
});

// --- 3. ENGINE JAM JAKARTA ---
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

// --- 4. SCANNER QR CODE / BARCODE (LINK INTEGRASI WEBSITE) ---
btnOpenScanner.addEventListener('click', () => {
    scannerModal.classList.add('open');
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 15, qrbox: 250 });
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
});

function onScanSuccess(decodedText, decodedResult) {
    // Validasi apakah barcode berisi tautan website (misal gform/situs sekolah)
    if (decodedText.startsWith('http://') || decodedText.startsWith('https://')) {
        showToast("Tautan Barcode Ditemukan! Mengalihkan ke halaman ujian...", "success");
        
        html5QrcodeScanner.clear();
        scannerModal.classList.remove('open');
        
        currentUser = "Siswa (Scan Barcode)";
        switchPage('exam-page');
        
        // Memasukkan URL Google Form hasil scan langsung ke dalam Iframe Exambro
        examIframe.src = decodedText;
        startExamSession();
    } else {
        showToast("Barcode valid, namun bukan merupakan tautan URL Ujian!", "danger");
    }
}

function onScanFailure(error) {}

btnCloseScanner.addEventListener('click', () => {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    scannerModal.classList.remove('open');
    showToast("Pemindaian barcode dibatalkan.", "info");
});

// --- 5. LOGIN MANUAL & SIDIK JARI ---
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
            addLog("SYSTEM", `Admin [Dennis Septiano] masuk via Sidik Jari pada ${getJakartaTimestamp()} WIB.`);
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
        addLog("SYSTEM", `Admin login manual pada ${getJakartaTimestamp()} WIB.`);
        renderLogs();
        showToast("Selamat Datang Admin Dennis Septiano.", "success");
    } else {
        // Jalur login manual jika menginputkan tautan manual
        if (inputUser.startsWith('http')) {
            currentUser = "Siswa (Manual Link)";
            switchPage('exam-page');
            examIframe.src = inputUser;
            startExamSession();
        } else {
            showToast("Untuk login siswa, masukkan link ujian atau gunakan tombol Scan Barcode!", "danger");
        }
    }
});

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// --- 6. PENGAWASAN LAYAR BELAH & DETEKSI KECURANGAN ---
function startExamSession() {
    isExamActive = true;
    violationCount = 0;
    startJakartaClock();
    
    // Inisialisasi awal Audio Engine saat halaman diklik siswa pertama kali
    initAudioEngine();

    addLog("SYSTEM", `Siswa memulai ujian pada link: ${examIframe.src}`);

    // Listener pendeteksi fokus jendela layar belah / split screen
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
    
    // BUNYIKAN ALARM SECARA OTOMATIS DAN PAKSA LOCK DI SETENGAH VOLUME
    playSecureAlarm();
    
    showToast(`PERINGATAN KECURANGAN! Dilarang membelah layar/membuka Chrome! Alarm berbunyi kencang.`, "danger");
    addLog("CHEAT", `[${timestamp} WIB] SISWA terdeteksi split-screen/pindah tab! (Pelanggaran ke-${violationCount})`);
    renderLogs();
}

// --- 7. LOGIKA TOMBOL KELUAR WAJIB KETIK "Selesai" ---
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
    stopSecureAlarm(); // Matikan alarm apabila keluar secara sah
    showToast("Sesi ujian ditutup dengan aman.", "success");
    resetAppState();
});

// --- 8. LOGS MANAGEMENT ---
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
    
