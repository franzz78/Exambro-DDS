// Konfigurasi Akun & State Aplikasi
const ADMIN_USER = "DSSMANSALA2026##";
let currentUser = "";
let isExamActive = false;
let violationCount = 0;
let clockInterval = null;
let html5QrcodeScanner = null;

// Elemen DOM Utama
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const loginPage = document.getElementById('login-page');
const examPage = document.getElementById('exam-page');
const adminPage = document.getElementById('admin-page');
const webcamElement = document.getElementById('webcam');
const cameraStatus = document.getElementById('camera-status');
const logOutput = document.getElementById('log-output');

// Elemen Fitur Tambahan Baru
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

const btnStartCamera = document.getElementById('btn-start-camera');
const recordingBadge = document.getElementById('recording-badge');
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

    // Hilangkan otomatis dalam 4 detik dengan animasi slideOut
    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
}

// --- 2. ENGINE JAM ASIA/JAKARTA & TIMESTAMP ---
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

// --- 3. SCANNER BARCODE / QR CODE KARTU SISWA ---
btnOpenScanner.addEventListener('click', () => {
    scannerModal.classList.add('open');
    
    // Inisialisasi library scanner internal website
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
});

function onScanSuccess(decodedText, decodedResult) {
    // Jalur sukses: membaca text barcode kartu ujian siswa
    showToast(`Barcode Terbaca: ${decodedText}`, "success");
    usernameInput.value = decodedText;
    
    // Matikan scanner & tutup modal otomatis
    html5QrcodeScanner.clear();
    scannerModal.classList.remove('open');
    
    // Otomatis login sebagai identitas siswa hasil scan tersebut
    currentUser = decodedText;
    switchPage('exam-page');
    startExamSession();
}

function onScanFailure(error) {
    // Log kegagalan pencarian frame barcode (diabaikan agar kamera terus scanning)
}

btnCloseScanner.addEventListener('click', () => {
    if (html5QrcodeScanner) html5QrcodeScanner.clear();
    scannerModal.classList.remove('open');
    showToast("Pemindaian barcode dibatalkan.", "info");
});

// --- 4. LOGIN SIDIK JARI & MANUAL VALIDATION ---
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
    } else if (inputUser !== "") {
        currentUser = inputUser;
        switchPage('exam-page');
        startExamSession();
    }
});

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

// --- 5. LIVE REKAM KAMERA PENGAWAS ---
btnStartCamera.addEventListener('click', async () => {
    try {
        cameraStatus.textContent = "Menghubungkan...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamElement.srcObject = stream;
        cameraStatus.textContent = "Live Stream Aktif";
        cameraStatus.style.color = "#22c55e";
        recordingBadge.style.display = 'flex';
        btnStartCamera.style.opacity = '0.5';
        btnStartCamera.disabled = true;
        showToast("Live Perekaman Pengawas Website Aktif.", "success");
    } catch (err) {
        cameraStatus.textContent = "Akses Gagal";
        cameraStatus.style.color = "#ef4444";
        showToast("Akses kamera ditolak browser!", "danger");
    }
});

function stopWebcam() {
    if (webcamElement.srcObject) webcamElement.srcObject.getTracks().forEach(t => t.stop());
    recordingBadge.style.display = 'none';
    btnStartCamera.disabled = false;
    btnStartCamera.style.opacity = '1';
    cameraStatus.textContent = "Kamera Belum Terhubung";
    cameraStatus.style.color = "#94a3b8";
}

// --- 6. DETEKSI LAYAR BELAH & SPLIT SCREEN ---
function startExamSession() {
    isExamActive = true;
    violationCount = 0;
    startJakartaClock();
    showToast(`Sesi pengerjaan siswa [${currentUser}] dimulai.`, "success");
    addLog("SYSTEM", `Siswa [${currentUser}] resmi memulai ujian.`);

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
    
    showToast(`Peringatan #${violationCount}: Dilarang membelah layar atau pindah aplikasi!`, "danger");
    addLog("CHEAT", `[${timestamp} WIB] SISWA: "${currentUser}" terdeteksi membelah layar / buka aplikasi lain! (Pelanggaran ke-${violationCount})`);
}

// --- 7. LOGIKA KELUAR WAJIB KETIK "Selesai" ---
btnTriggerLogout.addEventListener('click', () => {
    // Munculkan pop-up modal khusus konfirmasi mengetik kata
    logoutModal.classList.add('open');
    logoutConfirmInput.value = "";
    btnFinalLogout.disabled = true;
    logoutConfirmInput.focus();
});

// Deteksi input teks dari siswa secara realtime
logoutConfirmInput.addEventListener('input', () => {
    if (logoutConfirmInput.value.trim() === "Selesai") {
        btnFinalLogout.disabled = false; // Buka kunci tombol keluar
    } else {
        btnFinalLogout.disabled = true;
    }
});

btnCancelLogout.addEventListener('click', () => {
    logoutModal.classList.remove('open');
});

btnFinalLogout.addEventListener('click', () => {
    logoutModal.classList.remove('open');
    showToast("Sesi ujian ditutup dengan aman.", "success");
    resetAppState();
});

// --- 8. RIWAYAT LOG KONSOL ADMIN ---
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
    if(confirm("Hapus seluruh catatan riwayat kecurangan?")) {
        localStorage.removeItem('exambro_logs');
        renderLogs();
    }
});

function resetAppState() {
    isExamActive = false;
    stopWebcam();
    if(clockInterval) clearInterval(clockInterval);
    window.removeEventListener('blur', reportViolation);
    document.removeEventListener('visibilitychange', handleVisibility);
    usernameInput.value = "";
    switchPage('login-page');
}

document.getElementById('btn-admin-logout').addEventListener('click', resetAppState);
renderLogs();

