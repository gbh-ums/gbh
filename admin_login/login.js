document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    initThemeControl();
    startRealtimeSync();
});

// Proteksi Dashboard
async function checkAdminAuth() {
    const email = localStorage.getItem('adminEmail');
    const pass = localStorage.getItem('adminPass'); 
    
    if (!email || !pass) {
        window.location.href = "../admin_login/login.html";
        return;
    }

    const { collection, query, where, getDocs } = window.fb_ops;
    try {
        const q = query(collection(window.gabahDB, "admins"), where("email", "==", email), where("password", "==", pass));
        const snap = await getDocs(q);
        if (snap.empty) {
            forceLogout();
        } else {
            document.getElementById('auth-overlay').style.display = 'none';
        }
    } catch (e) { forceLogout(); }
}

function forceLogout() {
    localStorage.removeItem('adminEmail');
    localStorage.removeItem('adminPass');
    window.location.href = "../admin_login/login.html";
}

window.logout = () => forceLogout();

// Rendering Tabel (Non-Kapital)
function renderTables(groups) {
    const container = document.getElementById('tables-container');
    container.innerHTML = '';

    Object.keys(groups).forEach(peran => {
        if (groups[peran].length === 0) return;

        // "petani" -> "Petani"
        const labelPeran = peran.charAt(0).toUpperCase() + peran.slice(1);

        let html = `
        <div class="glass-card rounded-[2rem] overflow-hidden mb-10 border border-emerald-500/10 shadow-lg">
            <div class="px-8 py-5 bg-emerald-500/5 border-b border-emerald-500/10">
                <h2 class="font-bold text-slate-800 dark:text-white">Kelola Mitra: ${labelPeran}</h2>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <tbody class="divide-y divide-emerald-500/5">
                        ${groups[peran].map(m => `
                            <tr class="hover:bg-emerald-500/5 transition">
                                <td class="px-8 py-5">
                                    <div class="font-bold text-slate-800 dark:text-white">${m.nama}</div>
                                    <div class="text-[11px] text-emerald-500">${m.email}</div>
                                </td>
                                <td class="px-8 py-5">
                                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        ${m.alamat?.kota || 'Wilayah Luar'}
                                    </span>
                                </td>
                                <td class="px-8 py-5 text-right flex justify-end gap-3">
                                    <button onclick="changeStatus('${m.id}', '${m.verifikasi === 'VERIFIED' ? 'PENDING' : 'VERIFIED'}')" 
                                        class="px-4 py-2 rounded-xl text-[10px] font-bold transition-all
                                        ${m.verifikasi === 'VERIFIED' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-600 text-white shadow-md'}">
                                        ${m.verifikasi === 'VERIFIED' ? 'Tangguhkan' : 'Verifikasi'}
                                    </button>
                                    <button onclick="deleteUser('${m.id}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        container.innerHTML += html;
    });
}
// ... sisa fungsi stats & theme tetap sama ...
function renderStats(groups) {
    const container = document.getElementById('stats');
    container.innerHTML = Object.keys(groups).map(k => `
        <div class="glass-card p-6 rounded-[1.5rem] border border-emerald-500/10 text-center">
            <div class="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">${k}</div>
            <div class="text-2xl font-black text-slate-800 dark:text-white">${groups[k].length}</div>
        </div>
    `).join('');
}

// Aksi Database (changeStatus & deleteUser tetap sama fungsinya)
window.changeStatus = async (id, status) => {
    try {
        await window.fb_ops.updateDoc(window.fb_ops.doc(window.gabahDB, "users", id), { verifikasi: status });
        Swal.fire({ icon: 'success', title: 'Berhasil diperbarui', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    } catch (e) { console.error(e); }
};

window.deleteUser = async (id) => {
    const res = await Swal.fire({
        title: 'Hapus data?', text: 'Tindakan ini permanen.', icon: 'warning',
        showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal',
        customClass: { popup: 'swal2-popup-custom', confirmButton: 'swal2-confirm-custom', cancelButton: 'swal2-cancel-custom' },
        buttonsStyling: false
    });
    if (res.isConfirmed) await window.fb_ops.deleteDoc(window.fb_ops.doc(window.gabahDB, "users", id));
};

function initThemeControl() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'theme-light';
    body.className = `moving-bg min-h-screen pb-20 ${savedTheme}`;
    themeToggle.onclick = () => {
        const isLight = body.classList.contains('theme-light');
        const nextTheme = isLight ? 'theme-dark' : 'theme-light';
        body.className = `moving-bg min-h-screen pb-20 ${nextTheme}`;
        themeIcon.className = nextTheme === 'theme-dark' ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', nextTheme);
    };
}