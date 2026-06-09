// Pengaturan Akun & State Aplikasi
const ADMIN_USER = "DSSMANSALA2026##";
let currentUser = "";
let isExamActive = false;
let violationCount = 0;

// Penangkapan Elemen DOM
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const loginPage = document.getElementById('login-page');
const examPage = document.getElementById('exam-page');
const adminPage = document.getElementById('admin-page');
const webcamElement = document.getElementById('webcam');
const cameraStatus = document.getElementById('camera-status');
const logOutput = document.getElementById('log-output');
const btnBiometric = document.getElementById('btn-biometric');

// --- 1. SISTEM DETEKSI HARDWARE SIDIK JARI ---
async function checkBiometricSupport() {
    if (window.PublicKeyCredential && 
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        
        try {
            const isSupported = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (isSupported) {
                btnBiometric.style.display = 'inline-flex';
                addLog("SYSTEM", "Hardware Biometrik terdeteksi aktif pada perangkat.");
            }
        } catch (err) {
            console.log("Gagal memvalidasi modul biometrik:", err);
        }
    }
}
checkBiometricSupport();

// Event Handler login sidik jari
btnBiometric.addEventListener('click', async () => {
    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const options = {
            publicKey: {
                challenge: challenge,
                rp: { name: "Exambro Dennis Septiano" },
                user: {
                    id: new Uint8Array([1, 2, 3, 4]),
                    name: "admin@dssmansala.com",
                    displayName: "Dennis Septiano"
                },
                pubKeyCredParams: [{ type: "public-key", alg: -7 }],
                authenticatorSelection: {
                    authenticatorAttachment: "platform",
                    userVerification: "required"
                },
                timeout: 60000
            }
        };

        const credential = await navigator.credentials.create(options);

        if (credential) {
            currentUser = "Admin (Biometric)";
            usernameInput.value = ADMIN_USER;
            switchPage('admin-page');
            addLog("SYSTEM", "Admin [Dennis Septiano] berhasil login cepat via SIDIK JARI.");
            renderLogs();
            alert("Login Biometrik Berhasil! Selamat Datang Admin Dennis Septiano.");
        }
    } catch (err) {
        console.error(err);
        alert("Autentikasi sidik jari gagal atau dibatalkan.");
    }
});

// --- 2. LOGIKA FORMLOGIN MANUAL ---
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const inputUser = usernameInput.value.trim();

    if (inputUser === ADMIN_USER) {
        currentUser = "Admin";
        switchPage('admin-page');
        addLog("SYSTEM", "Admin masuk ke Konsol via Kredensial Manual.");
        renderLogs();
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

// --- 3. INFRASTRUKTUR KAMERA PENGALAMAN ---
async function initWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamElement.srcObject = stream;
        cameraStatus.textContent = "Kamera Aktif";
        cameraStatus.style.color = "#22c55e";
    } catch (err) {
        cameraStatus.textContent = "Kamera Terblokir";
        cameraStatus.style.color = "#ef4444";
        alert("Aplikasi meminta akses kamera demi validasi pengerjaan.");
    }
}

function stopWebcam() {
    if (webcamElement.srcObject) {
        webcamElement.srcObject.getTracks().forEach(track => track.stop());
    }
}

// --- 4. ENGINE DETEKSI LAYAR BELAH (SPLIT SCREEN) ---
function startExamSession() {
    isExamActive = true;
    violationCount = 0;
    initWebcam();
    
    addLog("SYSTEM", `Siswa [${currentUser}] resmi memulai sesi ujian.`);

    // Melacak hilangnya fokus (split screen / ganti app / drop down tab)
    window.addEventListener('blur', reportViolation);
    document.addEventListener('visibilitychange', handleVisibility);
}

function handleVisibility() {
    if (document.hidden) {
        reportViolation();
    }
}

function reportViolation() {
    if (!isExamActive) return;

    violationCount++;
    const timestamp = new Date().toLocaleTimeString('id-ID');
    
    // Alert menghentikan aktivitas sementara di layar siswa
    alert(`[DETEKSI KECURANGAN #${violationCount}]\nAnda dilarang keras membelah layar (split screen) atau membuka aplikasi lain saat ujian!`);

    const logMsg = `[${timestamp}] SISWA: "${currentUser}" terdeteksi membelah layar/buka aplikasi lain! (Pelanggaran ke-${violationCount})`;
    addLog("CHEAT", logMsg);
}

// --- 5. MANAGEMENT RECOREN LOG LOCAL STORAGE ---
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

// Tombol Pembersih Log Admin
document.getElementById('btn-clear-log').addEventListener('click', () => {
    if(confirm("Hapus seluruh catatan riwayat kecurangan?")) {
        localStorage.removeItem('exambro_logs');
        renderLogs();
    }
});

// --- 6. LOGOUT SISTEM ---
function resetAppState() {
    isExamActive = false;
    stopWebcam();
    window.removeEventListener('blur', reportViolation);
    document.removeEventListener('visibilitychange', handleVisibility);
    usernameInput.value = "";
    switchPage('login-page');
}

document.getElementById('btn-logout').addEventListener('click', resetAppState);
document.getElementById('btn-admin-logout').addEventListener('click', resetAppState);

// Sinkronisasi data saat pertama kali aplikasi dibuka
renderLogs();

