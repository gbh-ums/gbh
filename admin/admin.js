document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    initThemeControl();
    startRealtimeSync();
    setupImagePreview();
});

// --- SISTEM LOGIN & PROFIL ---
async function checkAdminAuth() {
    const email = localStorage.getItem('adminEmail');
    const pass = localStorage.getItem('adminPass'); 
    if (!email || !pass) { forceLogout(); return; }

    const { collection, query, where, getDocs } = window.fb_ops;
    try {
        const q = query(collection(window.gabahDB, "admins"), where("email", "==", email), where("password", "==", pass));
        const snap = await getDocs(q);
        if (snap.empty) { forceLogout(); } 
        else {
            const data = snap.docs[0].data();
            document.getElementById('current-admin-name').innerText = data.nama || email;
            document.getElementById('admin-profile').classList.remove('hidden');
            document.getElementById('auth-overlay').style.display = 'none';
        }
    } catch (e) { forceLogout(); }
}

function forceLogout() { localStorage.clear(); window.location.href = "../admin_login/login.html"; }
window.logout = () => forceLogout();

// --- UPLOAD KE IMGBB ---
window.uploadToImgBB = async () => {
    const fileInput = document.getElementById('ad-file');
    const btn = document.getElementById('btn-upload-ad');
    const file = fileInput.files[0];
    const apiKey = '73e6c98cbd7e73c5e7b7a5d69383bf9d';

    if (!file) {
        Swal.fire({ icon: 'warning', title: 'Pilih Gambar', text: 'Kamu belum memilih foto iklan.', background: '#0f172a', color: '#fff' });
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Memproses...';

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success) {
            const imageUrl = result.data.url;
            const { collection, addDoc } = window.fb_ops;
            await addDoc(collection(window.gabahDB, "ads_data"), {
                url: imageUrl,
                thumb: result.data.thumb.url,
                uploadedAt: new Date(),
                active: true
            });

            Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Iklan sudah tayang di platform.', background: '#0f172a', color: '#fff' });
            fileInput.value = '';
            document.getElementById('ad-preview').classList.add('hidden');
        } else {
            throw new Error('Gagal upload ke ImgBB');
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Terjadi Kesalahan', text: err.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publikasikan Iklan';
    }
};

function setupImagePreview() {
    document.getElementById('ad-file').onchange = function() {
        const [file] = this.files;
        if (file) {
            document.getElementById('ad-preview').classList.remove('hidden');
            document.getElementById('img-preview').src = URL.createObjectURL(file);
        }
    };
}

function startRealtimeSync() {
    const { collection, onSnapshot, query, orderBy } = window.fb_ops;

    // 1. Sync Users & Individual Inventories
    onSnapshot(collection(window.gabahDB, "users"), (snapshot) => {
        const groups = { 'petani': [], 'pabrik': [], 'distributor': [], 'konsumen': [] };
        
        snapshot.forEach((userDoc) => {
            const data = userDoc.data();
            const p = data.peran || 'konsumen';
            const userId = userDoc.id;
            const userName = data.nama || "User";

            if (groups[p]) groups[p].push({ id: userId, ...data });

            // Otomatis pantau sub-koleksi inventory milik tiap user
            onSnapshot(collection(window.gabahDB, `users/${userId}/inventory`), (invSnapshot) => {
                renderUserInventory(userId, userName, invSnapshot);
            });
        });

        renderStats(groups);
        renderTables(groups);
        
        const loader = document.getElementById('loader');
        const container = document.getElementById('tables-container');
        if(loader) loader.classList.add('hidden');
        if(container) container.classList.remove('hidden');
    });

    // 2. Sync Iklan (Manajemen Iklan)
    const adsQuery = query(collection(window.gabahDB, "ads_data"), orderBy("uploadedAt", "desc"));
    onSnapshot(adsQuery, (snapshot) => { 
        renderAdsTable(snapshot); 
    });

    // 3. Sync Transaksi (Riwayat Global)
    const ordersQuery = query(collection(window.gabahDB, "orders"), orderBy("timestamp", "desc"));
    onSnapshot(ordersQuery, (snapshot) => {
        const statTx = document.getElementById('stat-transaksi');
        if (statTx) statTx.innerText = snapshot.size;
        renderTransactionsGlobal(snapshot);
    });

    // 4. Sync Data Inventory Global
    onSnapshot(collection(window.gabahDB, "inventory"), (snapshot) => {
        renderInventoryGlobal(snapshot);
    });
}

// --- RENDER MANAJEMEN IKLAN ---
function renderAdsTable(snapshot) {
    const container = document.getElementById('ads-management-container');
    const tbody = document.getElementById('ads-table-body');
    
    if (snapshot.empty) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    tbody.innerHTML = '';

    snapshot.forEach((doc) => {
        const ad = doc.data();
        const id = doc.id;
        const date = ad.uploadedAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

        tbody.innerHTML += `
            <tr class="hover:bg-emerald-500/5 transition">
                <td class="px-8 py-4">
                    <img src="${ad.url}" class="h-10 w-16 object-cover rounded-lg border border-emerald-500/20 shadow-sm" onclick="window.open('${ad.url}', '_blank')" style="cursor:zoom-in">
                </td>
                <td class="px-8 py-4">
                    <span class="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-tighter ${ad.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500'}">
                        ${ad.active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                </td>
                <td class="px-8 py-4 text-right flex justify-end gap-2">
                    <button onclick="toggleAdStatus('${id}', ${ad.active})" class="p-2 ${ad.active ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'} rounded-xl transition">
                        <i class="fas ${ad.active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    </button>
                    <button onclick="deleteAd('${id}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>`;
    });
}

// --- AKSI IKLAN ---
window.toggleAdStatus = async (id, currentStatus) => {
    try {
        await window.fb_ops.updateDoc(window.fb_ops.doc(window.gabahDB, "ads_data", id), { active: !currentStatus });
        Swal.fire({ icon: 'success', title: 'Status Diperbarui', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500, background: '#0f172a', color: '#fff' });
    } catch (e) { console.error(e); }
};

window.deleteAd = async (id) => {
    const res = await Swal.fire({ title: 'Hapus Iklan?', text: 'Gambar akan hilang dari aplikasi.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', customClass: { popup: 'swal-custom', confirmButton: 'swal-confirm', cancelButton: 'swal-cancel' }, buttonsStyling: false });
    if (res.isConfirmed) await window.fb_ops.deleteDoc(window.fb_ops.doc(window.gabahDB, "ads_data", id));
};

// --- RENDER MITRA & STATS (Fitur Lama Tetap Ada) ---
function renderTables(groups) {
    const container = document.getElementById('tables-container');
    container.innerHTML = '';
    Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) return;
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        let tableHtml = `
        <div class="glass-card rounded-[2rem] overflow-hidden border border-emerald-500/10 mb-10">
            <div class="px-8 py-5 bg-emerald-500/5 border-b border-emerald-500/10 font-bold text-slate-800 dark:text-white">Daftar Mitra: ${label}</div>
            <div class="overflow-x-auto"><table class="w-full text-left"><tbody class="divide-y divide-emerald-500/5">
                ${groups[key].map(m => `
                    <tr class="hover:bg-emerald-500/5 transition">

                        <td class="px-8 py-5">
                            <div class="font-bold text-slate-800 dark:text-white">${m.nama}</div>
                            <div class="text-[11px] text-emerald-500">${m.email}</div>
                        </td>
                        <td class="px-8 py-5 text-[11px] font-semibold text-slate-500 uppercase tracking-widest">${m.alamat?.kota || 'Luar Wilayah'}</td>

<td class="px-8 py-5 text-right flex justify-end gap-3">
    <!-- Tombol Baru: Cek Inventaris -->
    <button onclick="openInventoryModal('${m.id}', '${m.nama}')" 
        class="px-4 py-2 rounded-xl text-[10px] font-bold bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white transition-all">
        <i class="fas fa-boxes mr-1"></i> Cek Stok
    </button>

    <button onclick="changeStatus('${m.id}', '${m.verifikasi === 'VERIFIED' ? 'PENDING' : 'VERIFIED'}', '${m.email}', '${m.nama}', '${m.peran}')" 
        class="px-4 py-2 rounded-xl text-[10px] font-bold transition-all ${m.verifikasi === 'VERIFIED' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-600 text-white'}">
        ${m.verifikasi === 'VERIFIED' ? 'Tangguhkan' : 'Verifikasi'}
    </button>
    <button onclick="deleteUser('${m.id}')" class="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition"><i class="fas fa-trash-alt"></i></button>
</td>
                    </tr>`).join('')}
            </tbody></table></div>
        </div>`;
        container.innerHTML += tableHtml;
    });
}

















window.openInventoryModal = async (userId, userName) => {
    const modal = document.getElementById('modal-inventory');
    const content = document.getElementById('inv-modal-content');
    const title = document.getElementById('inv-modal-title');
    const subtitle = document.getElementById('inv-modal-subtitle');

    title.innerText = `Inventaris ${userName}`;
    subtitle.innerText = "Menghubungkan ke gudang...";
    content.innerHTML = `<div class="text-center py-10"><i class="fas fa-spinner animate-spin text-3xl text-emerald-500"></i></div>`;
    modal.classList.remove('hidden');

    const { collection, getDocs } = window.fb_ops;
    
    try {
        const querySnapshot = await getDocs(collection(window.gabahDB, `users/${userId}/inventory`));
        
        if (querySnapshot.empty) {
            subtitle.innerText = "Data Selesai Dimuat";
            content.innerHTML = `
                <div class="text-center py-12">
                    <div class="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-box-open text-3xl text-slate-300"></i>
                    </div>
                    <h4 class="font-bold text-slate-400">Inventory Kosong</h4>
                </div>`;
            return;
        }

        // 1. Inisialisasi Grouping
        const groups = {
            'produk': [],
            'modal': [],
            'aset': []
        };

        // 2. Kelompokkan data berdasarkan field 'jenis'
        querySnapshot.forEach((docSnap) => {
            const item = docSnap.data();
            const type = (item.jenis || 'produk').toLowerCase(); // default ke produk jika kosong
            if (groups[type]) {
                groups[type].push({ id: docSnap.id, ...item });
            } else {
                // Jika ada jenis lain di luar 3 itu, masukkan ke produk atau buat kategori lain
                groups['produk'].push({ id: docSnap.id, ...item });
            }
        });

        subtitle.innerText = `${querySnapshot.size} Item Ditemukan`;
        
        // 3. Render HTML berdasarkan kategori
        let finalHtml = '';
        
        Object.keys(groups).forEach(category => {
            if (groups[category].length === 0) return;

            const label = category.toUpperCase();
            const colorClass = category === 'aset' ? 'blue' : category === 'modal' ? 'amber' : 'emerald';

            finalHtml += `
                <div class="mb-8">
                    <div class="flex items-center gap-2 mb-4">
                        <span class="w-2 h-2 rounded-full bg-${colorClass}-500"></span>
                        <h3 class="font-black text-xs tracking-widest text-slate-500">${label}</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="text-[9px] uppercase text-slate-400 border-b border-emerald-500/10">
                                <tr>
                                    <th class="pb-3">Item</th>
                                    <th class="pb-3">Stok</th>
                                    <th class="pb-3 text-right">Harga</th>
                                    <th class="pb-3 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-emerald-500/5">
                                ${groups[category].map(item => `
                                    <tr class="hover:bg-emerald-500/5 transition">
                                        <td class="py-3">
                                            <div class="flex items-center gap-3">
                                                <img src="${item.foto || 'https://via.placeholder.com/150'}" class="w-10 h-10 rounded-lg object-cover border border-emerald-500/10">
                                                <div>
                                                    <div class="font-bold text-slate-800 dark:text-white text-xs">${item.nama}</div>
                                                    <div class="text-[8px] font-bold text-emerald-500 uppercase">${item.grade ? 'Grade ' + item.grade : ''}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="py-3">
                                            <span class="font-bold text-slate-700 dark:text-slate-300 text-xs">${item.stok}</span>
                                            <span class="text-[9px] text-slate-400">${item.satuan || ''}</span>
                                        </td>
                                        <td class="py-3 text-right font-bold text-emerald-600 text-xs">
                                            Rp ${Number(item.harga || 0).toLocaleString()}
                                        </td>
                                        <td class="py-3 text-right">
                                            <button onclick="deleteProduct('${userId}', '${item.id}', '${item.nama}')" 
                                                class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                                <i class="fas fa-trash-alt text-[10px]"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        content.innerHTML = finalHtml;

    } catch (error) {
        console.error(error);
        content.innerHTML = `<p class="text-red-500 text-center font-bold">Gagal memuat data inventaris.</p>`;
    }
};















window.closeInventoryModal = () => {
    document.getElementById('modal-inventory').classList.add('hidden');
};





























function renderStats(groups) {
    const container = document.getElementById('stats');
    container.innerHTML = Object.keys(groups).map(k => `
        <div class="glass-card p-6 rounded-[1.5rem] border border-emerald-500/10 text-center">
            <div class="text-[10px] font-bold text-emerald-500 uppercase mb-1">${k}</div>
            <div class="text-2xl font-black text-slate-800 dark:text-white">${groups[k].length}</div>
        </div>`).join('');
}

window.changeStatus = async (id, status, userEmail, userName, userPeran) => {
    // Tampilkan loading agar admin tahu proses sedang berjalan
    Swal.fire({
        title: 'Memproses...',
        text: 'Memperbarui database dan mengirim email notifikasi...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        // 1. Update status di Firestore
        await window.fb_ops.updateDoc(window.fb_ops.doc(window.gabahDB, "users", id), { 
            verifikasi: status 
        });

        // 2. Logika Pemilihan Template & Label
        let templateId = "";
        let statusLabel = "";

        if (status === 'VERIFIED') {
            templateId = "template_hcjvm7s"; // Pastikan ini ID template Aktivasi (Hijau)
            statusLabel = "DIAKTIFKAN";
        } else if (status === 'PENDING') {
            templateId = "template_helbual"; // Pastikan ini ID template Penangguhan (Merah)
            statusLabel = "DITANGGUHKAN";
        }

        // 3. Kirim Email Otomatis via EmailJS
        if (templateId && userEmail) {
            await emailjs.send("service_i66am5t", templateId, {
                name: userName,
                email: userEmail,
                peran: userPeran,
                status: statusLabel
            });
            console.log(`Notifikasi ${statusLabel} terkirim ke: ${userEmail}`);
        }

        // 4. Notifikasi Sukses
        Swal.fire({
            title: 'Berhasil!',
            text: `Akun ${userName} telah ${statusLabel}`,
            icon: status === 'VERIFIED' ? 'success' : 'warning',
            timer: 2000,
            showConfirmButton: false
        });

    } catch (e) {
        console.error("Gagal memproses status:", e);
        Swal.fire({
            title: 'Gagal!',
            text: 'Terjadi kesalahan sistem atau koneksi EmailJS.',
            icon: 'error'
        });
    }
};
window.deleteUser = async (id) => {
    const res = await Swal.fire({ title: 'Hapus data?', text: 'Data akan hilang permanen.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Hapus', cancelButtonText: 'Batal', customClass: { popup: 'swal-custom', confirmButton: 'swal-confirm', cancelButton: 'swal-cancel' }, buttonsStyling: false });
    if (res.isConfirmed) await window.fb_ops.deleteDoc(window.fb_ops.doc(window.gabahDB, "users", id));
};

function initThemeControl() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const themeToggle = document.getElementById('theme-toggle');
    const saved = localStorage.getItem('theme') || 'theme-light';
    body.className = `moving-bg min-h-screen pb-20 ${saved}`;
    themeToggle.onclick = () => {
        const isLight = body.classList.contains('theme-light');
        const next = isLight ? 'theme-dark' : 'theme-light';
        body.className = `moving-bg min-h-screen pb-20 ${next}`;
        themeIcon.className = next === 'theme-dark' ? 'fas fa-sun' : 'fas fa-moon';
        localStorage.setItem('theme', next);
    };
}




// Pastikan emailjs sudah ter-init di admin.html
async function aktifkanMitra(uid, userData) {
    try {
        // 1. Update status di Firestore
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
            status: "active"
        });

        // 2. Kirim Email Aktivasi
        await emailjs.send("service_i66am5t", "template_hcjvm7s", {
            name: userData.nama,
            email: userData.email, // Email tujuan
            peran: userData.peran,
            status: "AKTIF"
        });

        showModal("BERHASIL!", "Akun telah diaktifkan dan email notifikasi terkirim.", "success");
        renderUserTable(); // Refresh tabel
    } catch (error) {
        console.error("Gagal aktivasi:", error);
        showModal("GAGAL!", "Terjadi kesalahan saat aktivasi.", "error");
    }
}

function renderInventoryGlobal(snapshot) {
    const container = document.getElementById('tables-container');
    const existing = document.getElementById('inventory-section');
    if (existing) existing.remove();

    // Ganti baris di dalam snapshot.forEach pada fungsi renderTransactionsGlobal:
html += `
    <tr class="hover:bg-amber-500/5 transition">
        <td class="px-8 py-4 font-bold text-slate-800 dark:text-white">${pmb.nama || 'Pembeli'}</td>
        <td class="px-8 py-4 font-black text-emerald-600">Rp ${(prd.total_bayar || 0).toLocaleString()}</td>
        <td class="px-8 py-4 text-right">
            <button onclick="openDetail('${doc.id}')" class="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl text-[10px] font-bold hover:bg-emerald-500 hover:text-white transition">
                <i class="fas fa-expand-alt mr-1"></i> Lihat Detail
            </button>
        </td>
    </tr>`;
    
    snapshot.forEach(doc => {
        const inv = doc.data();
        html += `
            <tr class="hover:bg-blue-500/5 transition">
                <td class="px-8 py-4 font-bold text-slate-800 dark:text-white">${inv.nama_produk || 'Produk'}</td>
                <td class="px-8 py-4 text-blue-500 font-semibold">${inv.owner_name || 'Mitra'}</td>
                <td class="px-8 py-4 font-mono text-emerald-500">${inv.stok || 0} ${inv.satuan || ''}</td>
            </tr>`;
    });
    html += `</tbody></table></div></div>`;
    container.insertAdjacentHTML('afterbegin', html);
}
















// Fungsi untuk membuka modal detail
window.openDetail = async (orderId) => {
    const { doc, getDoc } = window.fb_ops;
    const modal = document.getElementById('modal-detail');
    const content = document.getElementById('detail-content');
    
    // Tampilkan loading di dalam modal
    content.innerHTML = `<div class="text-center py-10"><i class="fas fa-spinner animate-spin text-3xl text-emerald-500"></i></div>`;
    modal.classList.remove('hidden');

    try {
        const docRef = doc(window.gabahDB, "orders", orderId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            const data = snap.data();
            const pmb = data.pembeli || {};
            const pnj = data.penjual || {};
            const prd = data.produk || {};
            
            content.innerHTML = `
                <div class="grid grid-cols-2 gap-8 mb-8">
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Informasi Pembeli</p>
                        <h4 class="font-bold text-slate-800 dark:text-white text-lg">${pmb.nama}</h4>
                        <p class="text-xs text-slate-500"><i class="fab fa-whatsapp text-emerald-500 mr-1"></i> ${pmb.telepon || '-'}</p>
                        <p class="text-xs text-slate-500"><i class="far fa-envelope text-emerald-500 mr-1"></i> ${pmb.email || '-'}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Penyedia / Toko</p>
                        <h4 class="font-bold text-emerald-600 text-lg">${pnj.nama_toko}</h4>
                        <p class="text-xs text-slate-500">${pnj.wa_penjual || '-'} <i class="fas fa-store text-emerald-500 ml-1"></i></p>
                    </div>
                </div>

                <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 border border-slate-100 dark:border-white/5 mb-8">
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Rincian Produk</p>
                    <div class="flex gap-6 items-center">
                        <img src="${prd.foto}" class="w-24 h-24 rounded-2xl object-cover shadow-lg border-2 border-white">
                        <div class="flex-1">
                            <h5 class="font-black text-slate-800 dark:text-white text-xl">${prd.nama}</h5>
                            <p class="text-xs text-emerald-500 font-bold mb-2">Grade ${prd.grade}</p>
                            <div class="flex justify-between items-end">
                                <span class="text-sm text-slate-500">${prd.jumlah_beli} x Rp ${Number(prd.harga_satuan).toLocaleString()}</span>
                                <span class="text-xl font-black text-slate-800 dark:text-white">Rp ${Number(prd.total_bayar).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-white/10">
                    <div class="text-[10px] text-slate-400">
                        <p>ID ORDER: ${data.orderId || orderId}</p>
                        <p>TIMESTAMP: ${data.timestamp?.toDate().toLocaleString()}</p>
                    </div>
                    <span class="px-6 py-2 rounded-full bg-emerald-500 text-white font-black text-xs uppercase tracking-widest">
                        ${data.status}
                    </span>
                </div>
            `;
        }
    } catch (err) {
        content.innerHTML = `<p class="text-red-500 font-bold text-center">Gagal memuat data: ${err.message}</p>`;
    }
};

window.closeDetail = () => {
    document.getElementById('modal-detail').classList.add('hidden');
};
























// --- RENDER TRANSAKSI GLOBAL (Keranjang, Berjalan, Done) ---
function renderTransactionsGlobal(snapshot) {
    const container = document.getElementById('tables-container');
    const existing = document.getElementById('transactions-section');
    if (existing) existing.remove();

    const orders = {
        'keranjang': [],
        'berjalan': [], // Termasuk status 'diproses', 'dikirim', dll
        'selesai': []
    };

    snapshot.forEach(doc => {
        const data = doc.id ? { id: doc.id, ...doc.data() } : doc;
        const status = (data.status || data.produk?.status || '').toLowerCase();

        if (status === 'keranjang') {
            orders['keranjang'].push(data);
        } else if (status === 'selesai' || status === 'done') {
            orders['selesai'].push(data);
        } else {
            orders['berjalan'].push(data);
        }
    });

    let html = `
    <div id="transactions-section" class="space-y-10">
        ${renderTransactionTable('Riwayat Selesai', orders['selesai'], 'emerald')}
        ${renderTransactionTable('Transaksi Berjalan', orders['berjalan'], 'amber')}
        ${renderTransactionTable('Item di Keranjang', orders['keranjang'], 'blue')}
    </div>`;

    container.insertAdjacentHTML('beforeend', html);
}

function renderTransactionTable(title, dataArray, color) {
    if (dataArray.length === 0) return '';

    const rows = dataArray.map(item => {
        // Mengambil data pembeli, penjual, dan produk dari objek transaksi
        const pmb = item.pembeli || {};
        const pnj = item.penjual || {}; // Data dari field 'penjual' di Firestore
        const prd = item.produk || {};
        
        const namaPembeli = pmb.nama || {};
        const namaToko = pnj.nama_toko || {}; // Sesuai field 'nama_toko' di database
        const telpTampil = pmb.telepon || {};

        return `
            <tr class="hover:bg-${color}-500/5 transition">
                <td class="px-8 py-4">
                    <div class="font-bold text-slate-800 dark:text-white text-sm">${namaPembeli}</div>
                    <div class="text-[10px] text-slate-400">${telpTampil}</div>
                </td>
                <td class="px-8 py-4">
                    <div class="text-sm font-bold text-emerald-600">${namaToko}</div>
                    <div class="text-[10px] text-slate-400">Penjual/Mitra</div>
                </td>
                <td class="px-8 py-4">
                    <div class="text-sm font-medium text-slate-700 dark:text-slate-300">${prd.nama || 'Produk'}</div>
                    <div class="text-[10px] text-slate-400">${prd.jumlah_beli || 0} Unit</div>
                </td>
                <td class="px-8 py-4 font-black text-slate-800 dark:text-white">
                    Rp ${(prd.total_bayar || 0).toLocaleString()}
                </td>
                <td class="px-8 py-4 text-right">
                    <button onclick="openDetail('${item.id}')" 
                        class="px-4 py-2 bg-${color}-500/10 text-${color}-500 rounded-xl text-[10px] font-bold hover:bg-${color}-500 hover:text-white transition">
                        <i class="fas fa-expand-alt mr-1"></i> Detail
                    </button>
                </td>
            </tr>`;
    }).join('');

    return `
    <details class="group glass-card rounded-[2rem] overflow-hidden border border-${color}-500/10 shadow-lg mb-6" ${title.includes('Selesai') ? '' : 'open'}>
        <summary class="list-none cursor-pointer px-8 py-6 bg-${color}-500/5 border-b border-${color}-500/10 flex justify-between items-center hover:bg-${color}-500/10 transition-all">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-${color}-500/20 flex items-center justify-center text-${color}-500">
                    <i class="fas fa-exchange-alt"></i>
                </div>
                <div>
                    <h2 class="text-sm font-bold text-slate-800 dark:text-white">${title}</h2>
                    <span class="text-[10px] text-slate-400 font-medium">${dataArray.length} Transaksi</span>
                </div>
            </div>
            <i class="fas fa-chevron-down text-slate-400 group-open:rotate-180 transition-transform"></i>
        </summary>
        <div class="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table class="w-full text-left">
                <thead>
                    <tr class="text-[9px] uppercase tracking-widest text-slate-400 border-b border-${color}-500/5">
                        <th class="px-8 py-3 italic">Pembeli</th>
                        <th class="px-8 py-3 italic">Toko</th>
                        <th class="px-8 py-3 italic">Produk</th>
                        <th class="px-8 py-3 italic">Total</th>
                        <th class="px-8 py-3 text-right italic">Aksi</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-500/5">${rows}</tbody>
            </table>
        </div>
    </details>`;
}


















window.deleteProduct = async (userId, productId, productName) => {
    const res = await Swal.fire({
        title: 'Hapus Produk?',
        text: `Produk "${productName}" akan dihapus permanen dari stok user.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal',
        customClass: {
            popup: 'swal-custom',
            confirmButton: 'swal-confirm',
            cancelButton: 'swal-cancel'
        },
        buttonsStyling: false
    });

    if (res.isConfirmed) {
        try {
            const { doc, deleteDoc } = window.fb_ops;
            // Akses path: users -> {userId} -> inventory -> {productId}
            await deleteDoc(doc(window.gabahDB, "users", userId, "inventory", productId));

            Swal.fire({
                icon: 'success',
                title: 'Dihapus!',
                text: 'Produk berhasil dihapus.',
                timer: 1500,
                showConfirmButton: false,
                background: '#0f172a',
                color: '#fff'
            });

            // Refresh isi modal tanpa menutupnya
            const userName = document.getElementById('inv-modal-title').innerText.replace('Inventaris ', '');
            openInventoryModal(userId, userName);

        } catch (error) {
            console.error("Gagal menghapus produk:", error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Terjadi kesalahan saat menghapus produk.'
            });
        }
    }
};