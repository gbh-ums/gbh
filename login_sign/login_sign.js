/**
 * G.A.B.A.H - Login System (Firebase Sync)
 */

document.addEventListener('DOMContentLoaded', () => {
    const auth = window.auth;
    const db = window.db;

    const loginForm = document.getElementById('loginForm');
    const btnLogin = document.getElementById('btnLogin');
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const body = document.body;

    // --- 1. LOGIKA TEMA (TIDAK BERUBAH) ---
    const savedTheme = localStorage.getItem('theme') || 'theme-light';
    body.classList.add(savedTheme);
    updateThemeIcon(savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const isLight = body.classList.contains('theme-light');
        const newTheme = isLight ? 'theme-dark' : 'theme-light';
        
        body.classList.remove('theme-light', 'theme-dark');
        body.classList.add(newTheme);
        
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        if (theme === 'theme-dark') {
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    // --- 2. FUNGSI TAMPIL MODAL UMUM ---
    function showModal(title, message, type, redirect = null) {
        const customModal = document.getElementById('customModal');
        const modalIcon = document.getElementById('modalIcon');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalBtn = document.getElementById('modalBtn');

        modalTitle.innerText = title;
        modalMessage.innerText = message;
        
        modalIcon.innerHTML = type === 'success' 
            ? '<i class="fas fa-check-circle text-emerald-500"></i>' 
            : '<i class="fas fa-exclamation-circle text-red-500"></i>';

        // Reset style tombol ke default emerald jika sebelumnya berubah
        modalBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px]";
        modalBtn.innerHTML = "MENGERTI";

        customModal.classList.remove('hidden');
        modalBtn.onclick = () => {
            customModal.classList.add('hidden');
            if (redirect) window.location.href = redirect;
        };
    }

    // --- 3. FUNGSI MODAL KHUSUS STATUS NON-VERIFIED ---
function showModalStatusBlocked(nama, status) {
    const customModal = document.getElementById('customModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalBtn = document.getElementById('modalBtn'); // Ini untuk tombol Hubungi Admin
    const btnOke = document.getElementById('btnOke');    // Ini tombol tambahan baru

    modalTitle.innerText = "Akses Terbatasi";
    const currentStatus = status ? status.toLowerCase() : "pending";
    
    let pesan = `Halo <b>${nama}</b>, akun Anda saat ini berstatus <b>${currentStatus.toUpperCase()}</b>.`;
    
    if (currentStatus === "pending") {
        pesan += "<br>Mohon tunggu verifikasi admin untuk masuk ke sistem G.A.B.A.H.";
        // Tampilkan tombol OKE jika status pending
        if(btnOke) btnOke.classList.remove('hidden');
    } else {
        pesan += "<br>Silakan hubungi admin untuk informasi lebih lanjut mengenai akun Anda.";
        if(btnOke) btnOke.classList.add('hidden');
    }
    
    modalMessage.innerHTML = pesan;
    modalIcon.innerHTML = '<i class="fas fa-user-shield text-orange-500 animate-pulse"></i>';

    // Atur Tombol Hubungi Admin (modalBtn)
    modalBtn.innerHTML = '<i class="fab fa-whatsapp mr-2"></i> HUBUNGI ADMIN';
    modalBtn.className = "w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3.5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px]";

    customModal.classList.remove('hidden');
    
    // Logika Tombol OKE (Hanya menutup modal)
    if(btnOke) {
        btnOke.onclick = () => {
            customModal.classList.add('hidden');
            btnOke.classList.add('hidden');
        };
    }

    // Logika Tombol Hubungi Admin (Buka WA)
    modalBtn.onclick = () => {
        const textWA = `Halo Admin G.A.B.A.H, saya ${nama}. Akun saya masih berstatus ${currentStatus.toUpperCase()}, mohon bantuannya untuk verifikasi.`;
        window.open(`https://wa.me/6281244858962?text=${encodeURIComponent(textWA)}`, '_blank');
        customModal.classList.add('hidden');
        if(btnOke) btnOke.classList.add('hidden');
    };
}

    // --- 4. LOGIKA LOGIN FIREBASE ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            btnLogin.disabled = true;
            btnLogin.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Verifikasi...';

            const email = document.getElementById('loginUser').value;
            const pass = document.getElementById('loginPass').value;

            try {
                const userCredential = await window.signInWithEmailAndPassword(window.auth, email, pass);
                const user = userCredential.user;
                const userDoc = await window.getDoc(window.doc(window.db, "users", user.uid));

                if (userDoc.exists()) {
                    const userData = userDoc.data();

                    // --- VALIDASI STATUS (Sesuai field 'verifikasi' di database Anda) ---
                    // Menggunakan .toUpperCase() agar sinkron dengan "VERIFIED" di Firestore
                    const statusVerif = userData.verifikasi ? userData.verifikasi.toUpperCase() : "PENDING";

                    if (statusVerif !== "VERIFIED") {
                        showModalStatusBlocked(userData.nama, statusVerif);
                        resetLoginButton();
                        return; 
                    }

                    // --- SIMPAN SESSION JIKA STATUS VERIFIED ---
                    sessionStorage.setItem("uid", user.uid); // Diperbaiki dari 'users.uid' menjadi 'user.uid'
                    sessionStorage.setItem("email", email);
                    sessionStorage.setItem("nama", userData.nama);
                    sessionStorage.setItem("peran", userData.peran);
                    sessionStorage.setItem("username", userData.username || "USER-" + user.uid.substring(0,5));

                    const kota = userData.alamat?.kota || "Kota Tidak Ada";
                    const provinsi = userData.alamat?.provinsi || "Provinsi Tidak Ada";
                    sessionStorage.setItem("alamat", `${kota}, ${provinsi}`);
                    sessionStorage.setItem("provinsi", provinsi); 

                    const folderPeran = userData.peran.toLowerCase();
                    showModal('Berhasil!', `Selamat datang kembali, ${userData.nama}`, 'success', `../${folderPeran}/${folderPeran}.html`);
                } else {
                    showModal('Error Profil', 'Data profil tidak ditemukan.', 'error');
                    resetLoginButton();
                }
            } catch (error) {
                console.error(error);
                showModal('Login Gagal', "Email atau Password salah!", 'error');
                resetLoginButton();
            }
        });
    }

    function resetLoginButton() {
        btnLogin.disabled = false;
        btnLogin.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i> Masuk Sekarang';
    }
});

/**
 * G.A.B.A.H ADS LOADER (FITUR LAMA TETAP ADA)
 */
async function loadAdsSystem() {
    const adSidebar = document.getElementById('ad-sidebar-container');
    const adPopup = document.getElementById('ad-popup');
    const popupContent = document.getElementById('popup-content');
    const closeBtn = document.getElementById('close-ad-popup');

    try {
        const { collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = query(collection(window.db, "ads_data"), where("active", "==", true));
        const snap = await getDocs(q);

        if (!snap.empty) {
            const allAds = snap.docs.map(d => d.data());

            if (adSidebar) {
                adSidebar.innerHTML = allAds.map(ad => `
                    <div class="ad-card-mini group" onclick="if('${ad.link}') window.open('${ad.link}', '_blank')">
                        <div class="ad-tag">Partner</div>
                        <img src="${ad.url}" alt="Ads">
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                            <span class="text-white text-[9px] font-bold uppercase">Kunjungi Website <i class="fas fa-external-link-alt ml-1"></i></span>
                        </div>
                    </div>
                `).join('');
                adSidebar.classList.remove('hidden');
            }

            // Pop-up otomatis jika ada iklan
            if (adPopup && popupContent && !sessionStorage.getItem('ad_shown')) {
                popupContent.innerHTML = `<img src="${allAds[0].url}" class="w-full cursor-pointer" onclick="window.open('${allAds[0].link}', '_blank')">`;
                setTimeout(() => {
                    adPopup.classList.replace('hidden', 'flex');
                    sessionStorage.setItem('ad_shown', 'true');
                }, 2000);
            }
        }
    } catch (e) {
        console.error("Ads Error:", e);
    }

    if (closeBtn) {
        closeBtn.onclick = () => adPopup.classList.replace('flex', 'hidden');
    }
}

// Inisialisasi sistem iklan saat konten dimuat
document.addEventListener('DOMContentLoaded', loadAdsSystem);