/**
 * G.A.B.A.H - Registration System (Firebase Sync)
 */

const selects = {
    provinsi: document.getElementById('provinsi'),
    kota: document.getElementById('kota'),
    kecamatan: document.getElementById('kecamatan'),
    desa: document.getElementById('desa')
};
const btnSubmit = document.getElementById('btnSubmit');
const mitraForm = document.getElementById('mitraForm');

// --- 1. LOGIKA TEMA ---
const applyTheme = () => {
    const current = localStorage.getItem('theme') || 'theme-light';
    document.body.className = `moving-bg min-h-screen flex items-center justify-center p-6 ${current}`;
    document.getElementById('theme-icon').className = current === 'theme-dark' ? 'fas fa-sun text-yellow-400' : 'fas fa-moon text-emerald-600';
};

document.getElementById('theme-toggle').onclick = () => {
    const isDark = document.body.classList.contains('theme-dark');
    localStorage.setItem('theme', isDark ? 'theme-light' : 'theme-dark');
    applyTheme();
};
applyTheme();

// --- 2. MODAL IDENTIK LOGIN ---
function showModal(title, msg, iconType, reload = false) {
    const modal = document.getElementById('customModal');
    const modalIcon = document.getElementById('modalIcon');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMsg').innerText = msg;
    
    modalIcon.innerHTML = iconType === 'success' 
        ? '<i class="fas fa-check-circle text-emerald-500"></i>' 
        : '<i class="fas fa-exclamation-circle text-red-500"></i>';
    
    modal.classList.remove('hidden');
    document.getElementById('closeModal').onclick = () => {
        if (reload) window.location.href = "../login_sign/login_sign.html";
        else modal.classList.add('hidden');
    };
}

// --- 3. API WILAYAH ---
async function fetchWilayah(type, id = '') {
    const urls = {
        provinsi: 'https://www.emsifa.com/api-wilayah-indonesia/api/provinces.json',
        kota: `https://www.emsifa.com/api-wilayah-indonesia/api/regencies/${id}.json`,
        kecamatan: `https://www.emsifa.com/api-wilayah-indonesia/api/districts/${id}.json`,
        desa: `https://www.emsifa.com/api-wilayah-indonesia/api/villages/${id}.json`
    };
    try {
        const res = await fetch(urls[type]);
        return await res.json();
    } catch (e) { return []; }
}

async function initWilayah() {
    const data = await fetchWilayah('provinsi');
    selects.provinsi.innerHTML = '<option value="">PROVINSI</option>' + data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

selects.provinsi.onchange = async () => {
    const data = await fetchWilayah('kota', selects.provinsi.value);
    selects.kota.innerHTML = '<option value="">KOTA</option>' + data.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
};
selects.kota.onchange = async () => {
    const data = await fetchWilayah('kecamatan', selects.kota.value);
    selects.kecamatan.innerHTML = '<option value="">KECAMATAN</option>' + data.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
};
selects.kecamatan.onchange = async () => {
    const data = await fetchWilayah('desa', selects.kecamatan.value);
    selects.desa.innerHTML = '<option value="">DESA</option>' + data.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
};
initWilayah();

// --- 4. SUBMIT ---
mitraForm.onsubmit = async (e) => {
    e.preventDefault();
    
    // Validasi S&K
    const termsCheck = document.getElementById('terms');
    if (!termsCheck.checked) {
        showModal("PERINGATAN", "Harap setujui Syarat & Ketentuan.", "error");
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> MEMPROSES...';

    const fd = new FormData(mitraForm);
    const getTxt = (sel) => sel.options[sel.selectedIndex]?.text || '-';

    try {
        const cred = await window.createUserWithEmailAndPassword(window.auth, fd.get('u_id'), fd.get('u_key'));
        
        // Data yang akan disimpan dan dikirim via email
        const userData = {
            uid: cred.user.uid,
            nama: fd.get('nama'),
            whatsapp: fd.get('whatsapp'),
            email: fd.get('u_id'),
            peran: fd.get('u_level'),
            alamat: {
                provinsi: getTxt(selects.provinsi),
                kota: getTxt(selects.kota),
                kecamatan: getTxt(selects.kecamatan),
                desa: getTxt(selects.desa)
            },
            status: "pending",
            joinDate: new Date().toISOString()
        };

        // 1. Simpan ke Firestore
        await window.setDoc(window.doc(window.db, "users", cred.user.uid), userData);

        // 2. Kirim Email Notifikasi menggunakan EmailJS
        // Pastikan nama variabel (kiri) sama dengan yang ada di dashboard {{ }}
// Potongan kode di register.js Anda
try {
// Bagian pengiriman email di register.js
console.log("Mengirim email ke:", userData.email); // Cek apakah email muncul di console F12

// Ganti bagian emailjs.send di register.js dengan ini:
await emailjs.send("service_i66am5t", "template_helbual", {
    name: userData.nama,        // Mengisi {{name}} di HTML
    email: userData.email,      // Mengisi {{email}} di Dashboard (To Email)
    peran: userData.peran,      // Mengisi {{peran}} di HTML
    kota: userData.alamat.kota, // Mengisi {{kota}} di HTML
    whatsapp: userData.whatsapp,// Mengisi {{whatsapp}} di HTML
    status: "PENDING VERIFIKASI" // Mengisi {{status}} di HTML
});
    console.log("SUCCESS! Email terkirim.");
} catch (emailError) {
    console.error("FAILED SEND EMAIL...", emailError);
    // Tetap lanjutkan proses atau beri peringatan
}

        showModal("BERHASIL!", "Akun Anda sedang ditinjau. Tunggu aktivasi admin.", "success", true); 
    } catch (err) {
        let customMsg = "Terjadi kesalahan saat mendaftar.";

        if (err.code === 'auth/email-already-in-use') {
            customMsg = "Email ini sudah terdaftar. Silakan gunakan email lain atau masuk ke akun Anda.";
        } else if (err.code === 'auth/invalid-email') {
            customMsg = "Format email tidak valid.";
        } else if (err.code === 'auth/weak-password') {
            customMsg = "Password terlalu lemah. Gunakan minimal 6 karakter.";
        } else if (err.code === 'auth/network-request-failed') {
            customMsg = "Koneksi internet terganggu. Periksa jaringan Anda.";
        }

        showModal("GAGAL DAFTAR", customMsg, "error", false);
        
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Daftar Sekarang';
    }
};



















// --- LOGIKA IKLAN DINAMIS G.A.B.A.H ---
async function loadDynamicAds() {
    const adSidebar = document.getElementById('ad-sidebar-container');
    const adPopup = document.getElementById('ad-popup');
    const popupContent = document.getElementById('popup-content');
    let currentAdIndex = 0;

    try {
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(window.db, "ads_data"), where("active", "==", true));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const allAds = querySnapshot.docs.map(d => d.data());

            // 1. Tampilkan Iklan Pop-up (Slideshow)
            const updatePopup = (index) => {
                popupContent.innerHTML = `
                    <img src="${allAds[index].url}" class="w-full h-auto object-cover animate-fade-in">
                    <div class="p-4 text-center">
                        <p class="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sponsored Content</p>
                    </div>
                `;
            };

            adPopup.classList.replace('hidden', 'flex');
            updatePopup(0);

            // Ganti iklan setiap 5 detik di dalam pop-up
            const adInterval = setInterval(() => {
                currentAdIndex = (currentAdIndex + 1) % allAds.length;
                updatePopup(currentAdIndex);
            }, 5000);

            document.getElementById('close-ad-popup').onclick = () => {
                clearInterval(adInterval);
                adPopup.classList.replace('flex', 'hidden');
            };

            // 2. Tampilkan Iklan Mini di Sidebar/Bawah Form
            adSidebar.innerHTML = allAds.map(ad => `
                <div class="ad-card-mini group">
                    <div class="ad-tag">ADS</div>
                    <img src="${ad.url}" alt="Promotion">
                </div>
            `).join('');
            adSidebar.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Gagal memuat iklan:", e);
    }
}

// Panggil fungsi iklan saat halaman siap
document.addEventListener('DOMContentLoaded', loadDynamicAds);