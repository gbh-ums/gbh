/**
 * G.A.B.A.H - Dashboard Core Logic
 * Mendukung Petani, Pabrik, dan Distributor
 */
// Gembok Keamanan: Cek sesi secara instan
if (!sessionStorage.getItem("uid")) {
    window.location.replace("../login_sign/login_sign.html");
}

// Anti-Back Cache: Paksa reload jika browser mencoba memuat dari memori
window.addEventListener('pageshow', function (event) {
    if (event.persisted || (performance.getEntriesByType("navigation")[0].type === 'back_forward')) {
        window.location.reload();
    }
});
// 1. FIREBASE INIT
const firebaseConfig = {
    apiKey: "AIzaSyB6HETQvxf6jZ4d48BxvOFtFU0fuTXZN_I",
    authDomain: "gabah-cc201.firebaseapp.com",
    projectId: "gabah-cc201",
    storageBucket: "gabah-cc201.firebasestorage.app",
    messagingSenderId: "497754423789",
    appId: "1:497754423789:web:64b22"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

// --- 3. CONFIG & CONSTANTS ---
const API_KEY = "2ad071e74e241677b8300e1d47e5e914";
const LAT = "-7.5755"; // Koordinat Surakarta
const LON = "110.8243"; 
const CITY_NAME = "Surakarta, ID";
const PUMP_WATT = 250;
const KWH_PRICE = 1500;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cek Sesi (Security Gate)
    const user_uid = sessionStorage.getItem("uid");
    
    // Jika tidak ada UID, paksa pindah ke login dan hapus history back
    if (!user_uid) {
        window.location.replace("../login_sign/login_sign.html"); 
        return;
    }

    // 2. Cegah Cache (Opsional tapi ampuh)
    // Memastikan halaman selalu refresh saat di-back
    window.onpageshow = function(event) {
        if (event.persisted) {
            window.location.reload();
        }
};

    // AMBIL DATA DARI SESSION
    const nama = sessionStorage.getItem("nama");
    const username = sessionStorage.getItem("username");
    const alamat = sessionStorage.getItem("alamat");
    const provinsi = sessionStorage.getItem("provinsi");

    // PASANG KE HTML (Menghilangkan tanda ...)
    if(document.getElementById('displayName')) 
        document.getElementById('displayName').innerText = nama || "Pabrik G.A.B.A.H";
    
    if(document.getElementById('displayID')) 
        document.getElementById('displayID').innerText = username || "ID-USER";

    if(document.getElementById('displayAlamat')) 
        document.getElementById('displayAlamat').innerText = alamat || "Lokasi tidak diset";

    // Bagian yang memperbaiki gambar Anda (Bulatan Merah)
    if(document.getElementById('displayProvinsi')) 
        document.getElementById('displayProvinsi').innerText = provinsi || "NASIONAL";

    initTheme();
    listenToInventory(user_uid);
    setupRupiahListeners();
    fetchWeather();
});

// 2. REALTIME LISTENER
function listenToInventory(uid) {
    db.collection("users").doc(uid).collection("inventory")
    .orderBy("timestamp", "desc")
    .onSnapshot((snapshot) => {
        const items = [];
        snapshot.forEach((doc) => { items.push({ id: doc.id, ...doc.data() }); });
        renderTables(items);
    }, (error) => console.error("Firestore Error:", error));
}

// 3. CRUD LOGIC
async function addNewData(jenis) {
    const uid = sessionStorage.getItem("uid");
    const nama = document.getElementById(`add-nama-${jenis}`).value;
    const hargaRaw = document.getElementById(`add-harga-${jenis}`).value;
    
    if (!nama || !hargaRaw) return showModal('Gagal', 'Lengkapi Nama dan Harga!', 'danger');

    const harga = parseInt(hargaRaw.replace(/\./g, '')) || 0;
    const stok = parseFloat(document.getElementById(`add-stok-${jenis}`)?.value) || 0;
    const satuan = document.getElementById(`add-satuan-${jenis}`)?.value || "";
    const grade = document.getElementById(`add-grade-${jenis}`)?.value || "";

    try {
        let imageUrl = "";
        const fileInput = document.getElementById(`add-foto-${jenis}`);
        
        // Upload ImgBB jika ada file (Biasanya untuk Produk)
        if (fileInput && fileInput.files[0]) {
            const formData = new FormData();
            formData.append("image", fileInput.files[0]);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=73e6c98cbd7e73c5e7b7a5d69383bf9d`, {
                method: "POST", body: formData
            });
            const imgData = await res.json();
            if (imgData.success) imageUrl = imgData.data.url;
        }

        await db.collection("users").doc(uid).collection("inventory").add({
            jenis, nama, harga, stok, satuan, grade,
            foto: imageUrl,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        resetAddForm(jenis);
        showModal('Berhasil', 'Data berhasil ditambahkan!', 'success');
    } catch (e) { showModal('Error', e.message, 'danger'); }
}

async function saveLine(id) {
    const uid = sessionStorage.getItem("uid");
    const updates = {
        nama: document.getElementById(`nama-${id}`).value,
        harga: parseInt(document.getElementById(`harga-${id}`).value.replace(/\./g, '')) || 0,
    };
    if(document.getElementById(`stok-${id}`)) updates.stok = parseFloat(document.getElementById(`stok-${id}`).value);
    if(document.getElementById(`satuan-${id}`)) updates.satuan = document.getElementById(`satuan-${id}`).value;
    if(document.getElementById(`grade-${id}`)) updates.grade = document.getElementById(`grade-${id}`).value;

    try {
        await db.collection("users").doc(uid).collection("inventory").doc(id).update(updates);
        showModal('Sukses', 'Perubahan disimpan ke Cloud.', 'success');
    } catch (e) { showModal('Gagal', 'Gagal update.', 'danger'); }
}

async function deleteRow(id) {
    const uid = sessionStorage.getItem("uid");
    showModal('Hapus?', 'Data akan dihapus permanen.', 'danger', true, async () => {
        try { await db.collection("users").doc(uid).collection("inventory").doc(id).delete(); } 
        catch (e) { showModal('Error', 'Gagal hapus.', 'danger'); }
    });
}

// 4. RENDERING & STATS
function renderTables(items) {
    const tProduk = document.getElementById('tableProduk');
    const tModal = document.getElementById('tableModal');
    const tAset = document.getElementById('tableAset');
    if(!tProduk) return;

    tProduk.innerHTML = ""; tModal.innerHTML = ""; tAset.innerHTML = "";
    let sumM = 0, sumA = 0, totalQty = 0, valGudang = 0, countP = 0;

    items.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-500/10 hover:bg-red-500/5 transition-all";
        
        if (item.jenis === "produk") {
            const total = (item.harga || 0) * (item.stok || 0);
            totalQty += (item.stok || 0); valGudang += total; countP++;
            tr.innerHTML = `
                <td class="p-4"><div class="flex items-center gap-3">
                    <img src="${item.foto || 'https://via.placeholder.com/80'}" class="w-10 h-10 rounded-lg object-cover border border-red-500/20">
                    <input type="text" id="nama-${item.id}" value="${item.nama}" class="edit-input w-full">
                </div></td>
                <td class="p-4 text-center"><select id="grade-${item.id}" class="edit-input font-bold text-red-600 text-center">${['A','B','C','D'].map(g => `<option value="${g}" ${item.grade===g?'selected':''}>${g}</option>`).join('')}</select></td>
                <td class="p-4 text-center"><input type="text" id="satuan-${item.id}" value="${item.satuan}" class="edit-input w-12 text-center uppercase"></td>
                <td class="p-4 text-center"><input type="number" id="stok-${item.id}" value="${item.stok}" class="edit-input w-16 text-center"></td>
                <td class="p-4"><input type="text" id="harga-${item.id}" value="${formatRupiahInput(item.harga)}" class="edit-input w-28 text-right text-red-600 rupiah-input"></td>
                <td class="p-4 text-right text-red-600 font-black">${formatCurrency(total)}</td>
                <td class="p-4 text-center"><div class="flex gap-4 justify-center">
                    <button onclick="saveLine('${item.id}')" class="text-emerald-500 hover:scale-125 transition-all"><i class="fas fa-save"></i></button>
                    <button onclick="deleteRow('${item.id}')" class="text-red-400 hover:scale-125 transition-all"><i class="fas fa-trash-alt"></i></button>
                </div></td>`;
            tProduk.appendChild(tr);
        } else if (item.jenis === "modal") {
            const total = (item.harga || 0) * (item.stok || 0); sumM += total;
            tr.innerHTML = `<td class="p-4"><input type="text" id="nama-${item.id}" value="${item.nama}" class="edit-input w-full"></td>
                <td class="p-4 text-center"><input type="text" id="satuan-${item.id}" value="${item.satuan}" class="edit-input w-12 text-center"></td>
                <td class="p-4 text-center"><input type="number" id="stok-${item.id}" value="${item.stok}" class="edit-input w-12 text-center"></td>
                <td class="p-4"><input type="text" id="harga-${item.id}" value="${formatRupiahInput(item.harga)}" class="edit-input w-28 text-right rupiah-input"></td>
                <td class="p-4 text-right text-blue-600 font-black">${formatCurrency(total)}</td>
                <td class="p-4 text-center"><div class="flex gap-4 justify-center"><button onclick="saveLine('${item.id}')" class="text-blue-500"><i class="fas fa-save"></i></button><button onclick="deleteRow('${item.id}')" class="text-red-400"><i class="fas fa-trash-alt"></i></button></div></td>`;
            tModal.appendChild(tr);
        } else if (item.jenis === "aset") {
            sumA += (item.harga || 0);
            tr.innerHTML = `<td class="p-4"><input type="text" id="nama-${item.id}" value="${item.nama}" class="edit-input w-full"></td>
                <td class="p-4"><input type="text" id="harga-${item.id}" value="${formatRupiahInput(item.harga)}" class="edit-input w-full text-right rupiah-input"></td>
                <td class="p-4 text-center"><div class="flex gap-4 justify-center"><button onclick="saveLine('${item.id}')" class="text-orange-500"><i class="fas fa-save"></i></button><button onclick="deleteRow('${item.id}')" class="text-red-400"><i class="fas fa-trash-alt"></i></button></div></td>`;
            tAset.appendChild(tr);
        }


        if(document.getElementById('totalNilaiGudang')) {
        document.getElementById('totalNilaiGudang').innerText = formatCurrency(valGudang);
    }
    
    // TAMBAHKAN INI:
    setTimeout(kalkulasiSisaStok, 500); 
    
    });

    // Update Stats UI
    if(document.getElementById('totalStokProduk')) document.getElementById('totalStokProduk').innerText = countP;
    if(document.getElementById('totalQtyProduk')) document.getElementById('totalQtyProduk').innerText = totalQty + " Qty";
    if(document.getElementById('totalNilaiGudang')) document.getElementById('totalNilaiGudang').innerText = formatCurrency(valGudang);
    if(document.getElementById('displayTotalModal')) document.getElementById('displayTotalModal').innerText = formatCurrency(sumM);
    if(document.getElementById('subTotalModal')) document.getElementById('subTotalModal').innerText = formatCurrency(sumM);
    if(document.getElementById('displayTotalAset')) document.getElementById('displayTotalAset').innerText = formatCurrency(sumA);
    if(document.getElementById('subTotalAset')) document.getElementById('subTotalAset').innerText = formatCurrency(sumA);
    setupRupiahListeners();
}

// 5. RADAR WILAYAH (Khusus Pabrik & Distributor)
async function fetchInventoryByProvince(provinceName) {
    const formattedProv = provinceName ? provinceName.toUpperCase() : "";
    if (!formattedProv || formattedProv === "NULL" || formattedProv === "...") return;

    const container = document.getElementById('radarContainer');
    container.classList.remove('hidden'); 
    container.innerHTML = `<div class="col-span-full text-center py-10"><i class="fas fa-satellite-dish fa-spin text-3xl text-red-600"></i></div>`;

    try {
        const usersSnapshot = await db.collection("users")
            .where("alamat.provinsi", "==", formattedProv)
            .where("peran", "==", "petani")
            .get();

        if (usersSnapshot.empty) {
            container.innerHTML = `<p class="col-span-full text-center opacity-50 py-10 font-bold uppercase text-[10px]">Tidak ada petani di wilayah ini.</p>`;
            return;
        }

        // --- PROSES PENGELOMPOKKAN ---
        const groupedData = {};

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            if (userDoc.id === sessionStorage.getItem("uid")) continue;

            const kec = userData.alamat?.kecamatan || "Kecamatan Tidak Diketahui";
            const kel = userData.alamat?.desa || userData.alamat?.kelurahan || "Desa Tidak Diketahui";
            const key = `${kec} - ${kel}`; // Kunci pengelompokkan

            const invSnapshot = await db.collection("users").doc(userDoc.id)
                .collection("inventory").where("jenis", "==", "produk").get();

            invSnapshot.forEach(invDoc => {
                if (!groupedData[key]) groupedData[key] = [];
                groupedData[key].push({
                    user: userData,
                    item: invDoc.data()
                });
            });
        }

        // --- RENDER KE HTML ---
// --- PROSES RENDER KE UI ---
        container.innerHTML = ""; // Bersihkan loading

        if (Object.keys(groupedData).length === 0) {
            container.innerHTML = `<p class="col-span-full text-center opacity-50 py-10 font-bold uppercase text-[10px]">Petani ditemukan, tapi belum ada produk.</p>`;
            return;
        }

        // Atur container agar 2 kolom di HP (grid-cols-2) dan 4 kolom di Laptop (lg:grid-cols-4)
        container.className = "w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mb-20";

        for (const wilayah in groupedData) {
            // Header Wilayah (Sticky)
            const header = document.createElement('div');
            header.className = "col-span-full radar-group-header mt-6";
            header.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="w-1 h-4 bg-red-600 rounded-full"></div>
                    <h3 class="text-[9px] md:text-xs font-black uppercase tracking-widest text-slate-700">${wilayah}</h3>
                </div>
            `;
            container.appendChild(header);

            // Render Kartu Produk
            groupedData[wilayah].forEach(data => {
                const { user, item } = data;
                const card = document.createElement('div');
                
                // Card p-3 untuk HP agar hemat tempat
                card.className = "glass-card p-3 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/20 hover:scale-[1.02] transition-all shadow-xl group";
                
                card.innerHTML = `
                    <div class="flex flex-col gap-2 md:gap-4">
                        <div class="relative w-full h-32 md:h-52 rounded-[1.2rem] md:rounded-[2rem] overflow-hidden bg-slate-100 shadow-inner">
                            <img src="${item.foto || 'https://via.placeholder.com/400x300?text=No+Image'}" 
                                 class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700">
                            <div class="absolute top-2 right-2">
                                <span class="px-2 py-0.5 bg-red-600/90 text-white rounded-full text-[7px] md:text-[9px] font-black shadow-lg">
                                    GRADE ${item.grade}
                                </span>
                            </div>
                        </div>

                        <div class="px-1">
                            <h4 class="text-[10px] md:text-base font-black uppercase text-red-600 leading-tight truncate">${item.nama}</h4>
                            <p class="text-[8px] md:text-[10px] font-bold opacity-60 uppercase truncate mb-2">Petani: ${user.nama}</p>
                            
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center bg-red-500/5 p-2 md:p-4 rounded-xl md:rounded-2xl border border-red-500/10 mb-3">
                                <div>
                                    <p class="text-[7px] font-black opacity-40 uppercase">Stok</p>
                                    <p class="text-lg md:text-3xl font-black text-slate-800 leading-none">${item.stok}</p>
                                </div>
                                <div class="md:text-right mt-1 md:mt-0">
                                    <p class="text-[7px] font-black opacity-40 uppercase">Harga</p>
                                    <p class="text-[9px] md:text-sm font-black text-emerald-600">Rp ${Number(item.harga).toLocaleString('id-ID')}</p>
                                </div>
                            </div>

                            <button onclick="window.open('https://wa.me/${user.whatsapp}')" 
                                    class="w-full bg-red-600 text-white py-2 md:py-4 rounded-xl md:rounded-2xl text-[8px] md:text-[10px] font-black hover:bg-red-700 shadow-lg transition-all flex items-center justify-center gap-2 uppercase">
                                <i class="fab fa-whatsapp text-xs md:text-base"></i> <span class="hidden md:inline">Hubungi</span>
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (e) {
        console.error("Radar Error:", e);
        // showModal('Error', e.message, 'danger');
    }
}














// 6. UTILS
function formatCurrency(n) { return "Rp " + Number(n).toLocaleString('id-ID'); }
function formatRupiahInput(val) {
    if (!val && val !== 0) return "";
    let str = val.toString().replace(/[^,\d]/g, '');
    let split = str.split(','), sisa = split[0].length % 3, rp = split[0].substr(0, sisa), rb = split[0].substr(sisa).match(/\d{3}/gi);
    if (rb) { rp += (sisa ? '.' : '') + rb.join('.'); }
    return rp;
}
function setupRupiahListeners() {
    document.querySelectorAll('.rupiah-input').forEach(el => {
        el.oninput = function() { this.value = formatRupiahInput(this.value); };
    });
}
function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('image-preview-img').src = e.target.result;
            document.getElementById('image-preview-container').classList.remove('hidden');
            document.getElementById('file-name-produk').innerText = input.files[0].name;
        };
        reader.readAsDataURL(input.files[0]);
    }
}
function resetAddForm(jenis) {
    document.getElementById(`add-nama-${jenis}`).value = "";
    document.getElementById(`add-harga-${jenis}`).value = "";
    if(document.getElementById(`add-stok-${jenis}`)) document.getElementById(`add-stok-${jenis}`).value = "";
    if(jenis === 'produk') {
        document.getElementById('image-preview-container').classList.add('hidden');
        document.getElementById('file-name-produk').innerText = "No file";
        document.getElementById('add-foto-produk').value = "";
    }
}
function showModal(title, message, type = 'success', isConfirm = false, onConfirm = null) {
    const modal = document.getElementById('customModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    modal.classList.replace('hidden', 'flex');
    modalIcon.className = "w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl mb-6 mx-auto " + (type==='success'?'bg-emerald-500/10 text-emerald-500':'bg-red-500/10 text-red-500');
    modalIcon.innerHTML = type==='success'?'<i class="fas fa-check-circle"></i>':'<i class="fas fa-exclamation-triangle"></i>';
    
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalTitle').className = "text-xl font-black uppercase mb-2 " + (type==='success'?'text-emerald-600':'text-red-600');
    document.getElementById('modalMessage').innerText = message;
    
    modalConfirmBtn.className = "flex-1 py-4 rounded-2xl font-black text-[11px] uppercase text-white shadow-lg " + (type==='success'?'bg-emerald-600':'bg-red-600');
    modalConfirmBtn.onclick = () => { modal.classList.replace('flex', 'hidden'); if (onConfirm && !isConfirm) onConfirm(); };

    if (isConfirm) {
        modalCancelBtn.classList.remove('hidden');
        modalConfirmBtn.innerText = "LANJUTKAN";
        modalConfirmBtn.onclick = async () => { modal.classList.replace('flex', 'hidden'); if (onConfirm) await onConfirm(); };
        modalCancelBtn.onclick = () => modal.classList.replace('flex', 'hidden');
    } else { modalCancelBtn.classList.add('hidden'); modalConfirmBtn.innerText = "OK"; }
}
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    // Ambil tema tersimpan atau default ke light
    const currentTheme = localStorage.getItem('theme') || 'theme-light';
    document.body.classList.add(currentTheme);
    
    // Sesuaikan ikon saat awal muat
    if (themeIcon) {
        themeIcon.className = currentTheme === 'theme-dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    if (themeToggle) {
        themeToggle.onclick = () => {
            const isDark = document.body.classList.contains('theme-dark');
            const newTheme = isDark ? 'theme-light' : 'theme-dark';
            
            // Tukar class
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(newTheme);
            
            // Simpan ke storage
            localStorage.setItem('theme', newTheme);
            
            // Ganti ikon
            if (themeIcon) {
                themeIcon.className = newTheme === 'theme-dark' ? 'fas fa-sun' : 'fas fa-moon';
            }
        };
    }
}
function logout() { sessionStorage.clear(); window.location.href = "../login_sign/login_sign.html"; }
function hubungiPetani(wa) { if(wa) window.open(`https://wa.me/${wa.replace(/\D/g,'')}`, '_blank'); else alert("Nomor WA tidak tersedia."); }





// Logika otomatis di peran.js
let targetPeran = "petani"; // Default
const myPeran = sessionStorage.getItem("peran");

if (myPeran === "pabrik") targetPeran = "petani";
if (myPeran === "distributor") targetPeran = "pabrik";
if (myPeran === "konsumen") targetPeran = "distributor";

// Gunakan targetPeran dalam .where("peran", "==", targetPeran)



function logout() {
    const modal = document.getElementById('customModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn'); 
    const modalCancelBtn = document.getElementById('modalCancelBtn');   
    
    modal.classList.replace('hidden', 'flex');
    modalIcon.className = "w-20 h-20 rounded-[2rem] flex items-center justify-center text-3xl mb-6 mx-auto bg-red-500/10 text-red-500";
    modalIcon.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
    
    document.getElementById('modalTitle').innerText = "KONFIRMASI KELUAR";
    document.getElementById('modalMessage').innerText = "Pilih tujuan Anda:";

    const buttonContainer = modalConfirmBtn.parentElement;
    buttonContainer.className = "flex flex-col gap-3 w-full"; 

    // 1. Tombol Dasbor (Dibersihkan Sesi agar tidak bisa Back)
    let dashBtn = document.getElementById('modalDashBtn');
    if (!dashBtn) {
        dashBtn = document.createElement('button');
        dashBtn.id = 'modalDashBtn';
        buttonContainer.prepend(dashBtn); 
    }
    dashBtn.className = "w-full py-4 rounded-2xl font-black text-[11px] uppercase text-white shadow-lg bg-slate-800";
    dashBtn.innerText = "KE DASBOR UTAMA";
    dashBtn.onclick = () => {
        sessionStorage.clear(); // WAJIB: Hapus sesi agar tidak bisa back
        window.location.replace("../index.html"); // WAJIB: Ganti history
    };

    // 2. Tombol Login (Logout Total)
    modalConfirmBtn.className = "w-full py-4 rounded-2xl font-black text-[11px] uppercase text-white shadow-lg bg-red-600";
    modalConfirmBtn.innerText = "LOGOUT & LOGIN";
    modalConfirmBtn.onclick = () => {
        sessionStorage.clear(); //
        window.location.replace("../login_sign/login_sign.html"); //
    };

    // 3. Tombol Batal
    modalCancelBtn.classList.remove('hidden');
    modalCancelBtn.className = "w-full py-4 rounded-2xl font-black text-[11px] uppercase text-slate-500 border border-slate-200";
    modalCancelBtn.innerText = "BATAL";
    modalCancelBtn.onclick = () => modal.classList.replace('flex', 'hidden');
}

function refreshOrders() {
    const uid = sessionStorage.getItem("uid");
    if(uid) {
        // Efek putar ikon
        const icon = document.querySelector('.fa-sync-alt');
        icon.classList.add('fa-spin');
        
        // Memanggil ulang snapshot (Firestore sebenarnya otomatis, tapi ini untuk visual)
        listenToOrders(uid);
        
        setTimeout(() => icon.classList.remove('fa-spin'), 1000);
    }
}











































function listenToIoT(uid) {
    // Realtime Listener untuk Sensor Terkini
    db.collection("users").doc(uid).collection("iot_devices").doc("main_unit")
    .onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            updateIoTUI(data);
        }
    });
}

function updateIoTUI(data) {
    const moisture = data.moisture || 0;
    const pumpStatus = data.pump_active || false;
    
    // Update Moisture UI
    document.getElementById('live-moisture').innerText = moisture;
    document.getElementById('moisture-bar').style.width = `${moisture}%`;
    
    // Update Pump UI
    const btn = document.getElementById('btn-pump');
    const indicator = document.getElementById('pump-indicator');
    const statusText = document.getElementById('pump-status-text');

    if (pumpStatus) {
        btn.innerText = "Turn Off";
        btn.classList.replace('bg-slate-800', 'bg-red-600');
        indicator.classList.add('text-blue-500', 'animate-pulse');
        statusText.innerText = "Status: Running...";
    } else {
        btn.innerText = "Turn On";
        btn.classList.replace('bg-red-600', 'bg-slate-800');
        indicator.classList.remove('text-blue-500', 'animate-pulse');
        statusText.innerText = "Status: Off";
    }
}

// Fungsi menghitung biaya listrik berdasarkan durasi (menit)
function calculateElectricCost(durationMinutes) {
    const kwh = (PUMP_WATT * (durationMinutes / 60)) / 1000;
    const cost = kwh * KWH_PRICE;
    document.getElementById('pump-cost').innerText = formatCurrency(Math.round(cost));
}

















async function fetchWeather() {
    // 1. Ambil data alamat dari sesi user yang login
    const userCity = sessionStorage.getItem("alamat") || "Surakarta"; // Default ke Surakarta jika kosong
    
    try {
        // 2. Masukkan variabel userCity ke dalam query API
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${userCity}&appid=${API_KEY}&units=metric&lang=id`
        );
        
        if (!response.ok) return;

        const data = await response.json();

        const cityNameEl = document.getElementById('city-name');
        const tempEl = document.getElementById('temp');
        const descEl = document.getElementById('weather-desc');

        // 3. Update UI dengan nama kota hasil pencarian API
        if (cityNameEl) cityNameEl.innerText = `Cuaca di ${data.name}`;
        if (tempEl) tempEl.innerText = `${Math.round(data.main.temp)}°C`;
        if (descEl) descEl.innerText = data.weather[0].description;

        const rainAlert = document.getElementById('rain-alert');
        if (rainAlert) {
            const isRain = data.weather.some(w => w.main.toLowerCase().includes('rain'));
            isRain ? rainAlert.classList.remove('hidden') : rainAlert.classList.add('hidden');
        }
    } catch (error) {
        console.warn("Info: Layanan cuaca wilayah user tidak dapat dimuat.");
    }
}


// Tambahkan fungsi ini untuk menghitung penghasilan dari koleksi orders
async function fetchTotalPenghasilan(uid) {
    try {
        const ordersSnapshot = await db.collection("orders")
            .where("distId", "==", uid)
            .where("status", "==", "selesai")
            .get();

        let totalPenghasilan = 0;

        ordersSnapshot.forEach(doc => {
            const data = doc.data();
            // Mengambil total_bayar dari object produk seperti di orderan.js
            const total = Number(data.produk?.total_bayar || 0);
            totalPenghasilan += total;
        });

        // Update tampilan di dashboard
        const element = document.getElementById('displayTotalPenghasilan');
        if (element) {
            element.innerText = `Rp ${totalPenghasilan.toLocaleString('id-ID')}`;
        }
    } catch (error) {
        console.error("Gagal mengambil data penghasilan:", error);
    }
}

// Pastikan fungsi ini dipanggil saat dashboard dimuat
// Contoh pemanggilan di dalam listener auth atau DOMContentLoaded:
const uid = sessionStorage.getItem("uid");
if (uid) {
    fetchTotalPenghasilan(uid);
    // ... fungsi fetch lainnya ...
}






/**
 * Fungsi untuk menghitung total penghasilan secara real-time
 * Mengambil data dari koleksi orders yang statusnya 'selesai'
 */
function listenToIncome(uid) {
    db.collection("orders")
        .where("distId", "==", uid)
        .where("status", "==", "selesai")
        .onSnapshot((snapshot) => {
            // ... kode hitung totalIncome ...

            const element = document.getElementById('displayTotalPenghasilan');
            if (element) {
                element.innerText = `Rp ${totalIncome.toLocaleString('id-ID')}`;
                
                // TAMBAHKAN INI:
                kalkulasiSisaStok(); 
            }
        });
}

// Panggil fungsi ini saat inisialisasi dashboard
const distributorUID = sessionStorage.getItem("uid");
if (distributorUID) {
    listenToIncome(distributorUID);
}






function updateFinancialCalculations() {
    // Helper untuk membersihkan format Rupiah ke angka
    const cleanRupiah = (id) => {
        const text = document.getElementById(id)?.innerText || "0";
        return parseInt(text.replace(/[^0-9]/g, '')) || 0;
    };

    // Ambil nilai yang dibutuhkan
    const nilaiGudang = cleanRupiah('totalNilaiGudang');
    const totalPenghasilan = cleanRupiah('displayTotalPenghasilan');

    // Rumus: Nilai Gudang - Total Penghasilan
    const sisaStok = nilaiGudang - totalPenghasilan;

    // Update kartu "Estimasi Stok"
    const displaySisa = document.getElementById('displaySisaStok');
    if (displaySisa) {
        displaySisa.innerText = `Rp ${sisaStok.toLocaleString('id-ID')}`;
        
        // Opsional: Beri tanda jika nilai negatif atau nol
        displaySisa.style.color = sisaStok < 0 ? "#e11d48" : "#e11d48"; 
    }
}




function kalkulasiSisaStok() {
    const nilaiGudangText = document.getElementById('totalNilaiGudang')?.innerText || "0";
    const penghasilanText = document.getElementById('displayTotalPenghasilan')?.innerText || "0";

    // Membersihkan Rp, titik, dan koma agar menjadi angka murni
    const nilaiGudang = parseInt(nilaiGudangText.replace(/[^0-9]/g, '')) || 0;
    const totalPenghasilan = parseInt(penghasilanText.replace(/[^0-9]/g, '')) || 0;

    const sisaStok = nilaiGudang - totalPenghasilan;

    const displaySisa = document.getElementById('displaySisaStok');
    if (displaySisa) {
        displaySisa.innerText = `Rp ${sisaStok.toLocaleString('id-ID')}`;
        // Warna dinamis: Merah jika stok menipis/minus, Hijau jika aman
        displaySisa.style.color = sisaStok < 0 ? "#e11d48" : "#e11d48";
    }
}

// Tambahkan pemanggilan ini di dalam fungsi onSnapshot orders Anda
// Contoh: 
// db.collection("orders").where("distId", "==", uid).onSnapshot((snap) => {
//    ... kode render penghasilan ...
//    setTimeout(updateFinancialCalculations, 500); // Beri jeda agar DOM terisi dulu
// });
// Jalankan fungsi ini setiap kali data diperbarui (misal di dalam onSnapshot)
// Contoh penggunaan:
// db.collection("orders").onSnapshot(() => {
//    ... kode update penghasilan Anda ...
//    setTimeout(hitungSisaNilaiStok, 1000); // Tunggu angka lain terisi dulu
// });






// Contoh fungsi saat klik 'Beli' di Marketplace Distributor
async function tambahKeKeranjangStok(item) {
    const uid = sessionStorage.getItem("uid");
    await db.collection("cart_distributor").add({
        distId: uid,
        nama_produk: item.nama,
        harga_satuan: item.harga,
        jumlah: 100, // Misal minimal 100kg
        total_harga: item.harga * 100,
        nama_pabrik: item.pabrik,
        pabrikId: item.pabrikId
    });
    alert("Masuk ke keranjang stok!");
}



async function getWeather() {
    // 1. Ambil alamat dari session (data wilayah user)
    const storedAlamat = sessionStorage.getItem("alamat");
    
    // 2. Bersihkan alamat: Ambil hanya nama kota/kabupaten saja
    let targetCity = "Surakarta"; // Default jika data kosong
    if (storedAlamat && storedAlamat !== "Lokasi tidak diset") {
        const parts = storedAlamat.split(',');
        targetCity = parts[parts.length - 1].trim(); 
    }

    try {
        // 3. Panggil API menggunakan query nama kota (q=)
        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${targetCity}&appid=${API_KEY}&units=metric&lang=id`
        );
        
        const data = await response.json();

        if (data.cod !== 200) {
            throw new Error(data.message);
        }

        // 4. Update UI dengan Nama Kota yang dikembalikan API
        const cityNameEl = document.getElementById('city-name');
        const tempEl = document.getElementById('temp');
        const descEl = document.getElementById('weather-desc');

        if (cityNameEl) cityNameEl.innerText = data.name; // Ini akan menampilkan nama kota yang terbaca
        if (tempEl) tempEl.innerText = `${Math.round(data.main.temp)}°C`;
        if (descEl) descEl.innerText = data.weather[0].description;

        // Peringatan Hujan
        const rainAlert = document.getElementById('rain-alert');
        if (rainAlert) {
            const isRain = data.weather[0].main.toLowerCase().includes('rain');
            isRain ? rainAlert.classList.remove('hidden') : rainAlert.classList.add('hidden');
        }

    } catch (error) {
        console.error("Gagal membaca lokasi:", error);
        // Jika gagal, tampilkan kota default agar tidak terlihat rusak
        document.getElementById('city-name').innerText = targetCity;
    }
}

// Panggil fungsi saat halaman dimuat
document.addEventListener('DOMContentLoaded', getWeather);