/* --- G.A.B.A.H CORE LOGIC --- */

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

let allProducts = []; // Tempat menyimpan data sementara untuk filtering




// Membaca ID toko dari session browser (jika ada)
let activeDistId = sessionStorage.getItem('active_shop_id') || null;


















document.addEventListener('DOMContentLoaded', () => {
    const user_uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    const btnLogin = document.getElementById('btnLoginMain');
    const btnLogout = document.getElementById('btnLogout');

    if (user_uid && user_uid !== "undefined") {
        // Jika sudah login
        if(btnLogin) btnLogin.style.display = 'none'; 
        if(btnLogout) btnLogout.classList.remove('hidden'); // Tampilkan tombol logout
        
        loadUserProfile(user_uid);
        updateCartCount(); 
    } else {
        // Jika belum login (tamu)
        if(btnLogin) btnLogin.style.display = 'block';
        if(btnLogout) btnLogout.classList.add('hidden');
        
        console.log("User masuk sebagai tamu.");
        showGuestWelcome();
    }

    fetchConsumerMarket();
    
    // Fitur Search Aktif
    const searchInput = document.getElementById('searchInput');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => searchProduct(e.target.value.toLowerCase()));
    }
});















// Notifikasi Selamat Datang yang Menarik
function showGuestWelcome() {
    Swal.fire({
        title: 'Selamat Datang di G.A.B.A.H!',
        text: "Anda masuk sebagai tamu. Anda bisa melihat produk, tapi perlu login untuk bertransaksi.",
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Login Sekarang',
        cancelButtonText: 'Lihat-lihat Dulu',
        confirmButtonColor: '#00AA5B'
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = '../login_sign/login_sign.html'; 
        }
    });
}

// PROTEKSI FITUR DATABASE (Add to Cart)
async function addToCart(name, price, distId, foto, grade) { 
    const uid = sessionStorage.getItem("uid");

    if (!uid) {
        Swal.fire({
            title: 'Akses Terbatas!',
            text: "Silahkan login untuk memasukkan produk ke keranjang.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ke Halaman Login',
            confirmButtonColor: '#00AA5B'
        }).then((result) => {
            if (result.isConfirmed) window.location.href = '../login_sign/login_sign.html';
        });
        return; 
    }

    try {
        // 1. CEK APAKAH PRODUK SUDAH ADA DI KERANJANG
        const cartRef = db.collection("users").doc(uid).collection("inventory");
        const snapshot = await cartRef
            .where("nama", "==", name)
            .where("distId", "==", distId)
            .where("jenis", "==", "produk")
            .get();

        if (!snapshot.empty) {
            // JIKA ADA: Update stoknya saja agar tidak dobel
            const existingDoc = snapshot.docs[0];
            const newStok = (existingDoc.data().stok || 1) + 1;
            
            await cartRef.doc(existingDoc.id).update({
                stok: newStok
            });
        } else {
            // JIKA BELUM ADA: Tambahkan sebagai produk baru
            await cartRef.add({
                nama: name,
                harga: price,
                distId: distId,
                foto: foto,
                grade: grade,
                stok: 1, // Default awal 1
                jenis: "produk",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        Swal.fire({
            icon: 'success',
            title: 'Berhasil!',
            text: `${name} telah masuk ke keranjang.`,
            timer: 1500,
            showConfirmButton: false
        });

    } catch (error) {
        console.error("Gagal tambah keranjang:", error);
        Swal.fire('Error', 'Gagal memasukkan produk', 'error');
    }
}

























// 1. Load Profile User ke Header
async function loadUserProfile(uid) {
    try {
        const doc = await db.collection("users").doc(uid).get();
        
        if (doc.exists) {
            const data = doc.data();
            
            // 1. Update elemen di Top Bar (yang sudah ada)
            document.getElementById('headerName').innerHTML = `<i class="fas fa-user-circle text-[#00AA5B] mr-1"></i> ${data.nama || 'User'}`;
            
            // 2. TAMBAHKAN INI: Update elemen yang ada di gambar (Header Utama)
            const userNameElem = document.getElementById('userName');
            const userLocationElem = document.getElementById('userLocation');
            
            if(userNameElem) userNameElem.innerText = data.nama || 'User';
            if(userLocationElem && data.alamat) {
                userLocationElem.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${data.alamat.kota || 'Lokasi tidak set'}, ${data.alamat.provinsi || ''}`;
            }
        } else {
            console.warn("Dokumen user tidak ditemukan di Firestore untuk UID:", uid);
            document.getElementById('headerName').innerText = "Akun Tidak Terdaftar";
}
    } catch (e) {
        console.error("Gagal mengambil data profil:", e);
    }
}

// 2. Fetch Data Market & Distributor
async function fetchConsumerMarket() {
    const container = document.getElementById('radarContainer');
    const userProv = sessionStorage.getItem('provinsi') || "";
    container.innerHTML = `<div class="col-span-full text-center py-10"><i class="fas fa-sync fa-spin text-emerald-500 text-2xl"></i></div>`;

    try {
        const snapshot = await db.collection("users").where("peran", "==", "distributor").get();
        allProducts = []; // Reset

        for (const doc of snapshot.docs) {
            const distData = doc.data();
            const distId = doc.id;

            const invSnapshot = await db.collection("users").doc(distId)
                .collection("inventory").where("jenis", "==", "produk").get();

            invSnapshot.forEach(itemDoc => {
                allProducts.push({
                    id: itemDoc.id,
                    ...itemDoc.data(),
                    distributor: distData,
                    distId: distId
                });
            });
        }

        // --- LOGIKA "STAY DI TOKO" SAAT REFRESH ---
        const savedId = sessionStorage.getItem('active_shop_id');
        const savedName = sessionStorage.getItem('active_shop_name');

        if (savedId && savedName) {
            // Jika ada toko yang tersimpan di session, filter datanya
            activeDistId = savedId;
            const filtered = allProducts.filter(p => p.distId === savedId);
            
            renderDisplay(filtered);
            
            // Tambahkan kembali header toko (Panggil fungsi addShopHeader)
            addShopHeader(savedName);
        } else {
            // Jika tidak ada filter toko, tampilkan semua seperti biasa
            renderDisplay(allProducts);
        }

    } catch (error) { 
        console.error("Gagal memuat pasar:", error); 
    }
}

function addShopHeader(distNama) {
    const container = document.getElementById('radarContainer');
    const existingHeader = document.getElementById('shopIndicator');
    if (existingHeader) existingHeader.remove();

    const headerStatus = `
        <div id="shopIndicator" class="col-span-full bg-emerald-50 dark-shop-bg p-4 rounded-xl border border-emerald-100 dark-shop-border mb-4 flex flex-wrap justify-between items-center animate-popup">
            <div class="flex items-center gap-3">
                <div>
                    <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Produk Dari:</p>
                    <h3 class="font-bold text-gray-800 dark-shop-text">${distNama}</h3>
                </div>
                <!-- Tombol Merah di Samping Nama -->
                <button onclick="resetShopFilter()" class="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-1">
                    <i class="fas fa-times-circle"></i> KEMBALI
                </button>
            </div>
            
            <div class="hidden md:block">
                 <p class="text-[9px] text-gray-400 italic">Filter pencarian hanya berlaku di toko ini</p>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('afterbegin', headerStatus);
}


























// 3. Render Kartu Produk
function renderDisplay(data) {
    const container = document.getElementById('radarContainer');
    container.innerHTML = "";
    
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = "product-card p-3 cursor-pointer flex flex-col h-full"; 
        
        // Klik kartu tetap buka detail distributor atau detail produk
        div.onclick = (e) => {
            if(!e.target.closest('button')) showProductDetail(item);
        };

        div.innerHTML = `
            <div class="w-full aspect-square mb-3 rounded-xl overflow-hidden border border-slate-100/10">
                <img src="${item.foto || 'https://via.placeholder.com/200'}" class="w-full h-full object-cover">
            </div>

            <div class="flex-1 mb-4">
                <h4 class="text-[11px] font-bold text-gray-800 line-clamp-2 uppercase mb-1 leading-tight">
                    ${item.nama}
                </h4>
                <p class="text-[#00AA5B] font-black text-sm mb-1">
                    Rp ${Number(item.harga).toLocaleString('id-ID')}
                </p>
                <div class="flex items-center gap-1 text-[9px] text-gray-400 italic">
                    <i class="fas fa-store text-[8px]"></i> 
                    <span class="truncate">${item.distributor.nama}</span>
                </div>
            </div>
            
            <!-- SEKARANG HANYA ADA SATU TOMBOL UTAMA -->
            <button onclick='showProductDetail(${JSON.stringify(item)})' 
                class="w-full py-2.5 rounded-xl border-2 border-[#00AA5B] text-[#00AA5B] font-black text-[10px] uppercase hover:bg-[#00AA5B] hover:text-white transition-all tracking-wider flex items-center justify-center gap-2">
                <i class="fas fa-eye"></i> Lihat Detail
            </button>
        `;
        container.appendChild(div);
    });
}


















// 4. Modal Detail Distributor
function showDistroDetail(dist) {
    const modal = document.getElementById('distroModal');
    const details = document.getElementById('distroDetails');
    const btnChat = document.getElementById('btnChat');

    details.innerHTML = `
        <div class="flex flex-col gap-2">
            <div class="border-b pb-2">
                <p class="text-[10px] text-gray-400 uppercase font-bold">Nama Lengkap</p>
                <p class="font-bold text-gray-800">${dist.nama}</p>
            </div>
            <div class="border-b pb-2">
                <p class="text-[10px] text-gray-400 uppercase font-bold">Email</p>
                <p class="font-medium text-gray-700">${dist.email || '-'}</p>
            </div>
            <div class="border-b pb-2">
                <p class="text-[10px] text-gray-400 uppercase font-bold">Nomor Telepon</p>
                <p class="font-medium text-gray-700">${dist.telepon}</p>
            </div>
            <div>
                <p class="text-[10px] text-gray-400 uppercase font-bold">Alamat Lengkap</p>
                <p class="font-medium text-gray-700 leading-relaxed">${dist.alamat.detail}, ${dist.alamat.kecamatan}, ${dist.alamat.kota}, ${dist.alamat.provinsi}</p>
            </div>
        </div>
    `;

    btnChat.href = `https://wa.me/${dist.telepon.replace(/\D/g,'')}`;
    modal.classList.remove('hidden');
}

function closeDistroModal() {
    document.getElementById('distroModal').classList.add('hidden');
}

// 5. Fungsi Filtering
function filterAction(type) {
    // Update UI tombol filter agar terlihat aktif
    document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
    if (event) event.target.classList.add('active');

    // Tentukan sumber data: 
    // Jika sedang melihat toko tertentu (activeDistId ada), ambil produk toko itu saja.
    // Jika tidak, ambil semua produk dari semua toko.
    let sourceData = activeDistId 
        ? allProducts.filter(p => p.distId === activeDistId) 
        : [...allProducts];

    let filtered = [...sourceData];
    const userProv = sessionStorage.getItem('provinsi') || "";

    // Logika penyaringan tetap sama, tapi menggunakan sourceData yang sudah dikondisikan
    if (type === 'near') {
        filtered = filtered.filter(p => p.distributor.alamat.provinsi.toUpperCase() === userProv.toUpperCase());
    } else if (type === 'grade') {
        filtered = filtered.filter(p => p.grade.toLowerCase() === 'premium' || p.grade === 'A');
    } else if (type === 'cheap') {
        filtered.sort((a, b) => a.harga - b.harga);
    } else if (type === 'newest') {
        filtered.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    // Render hasil filter
    renderDisplay(filtered);

    // Jika sedang dalam mode toko, pastikan header "Menampilkan Produk Dari..." tetap muncul
    if (activeDistId && filtered.length > 0) {
        const distNama = filtered[0].distributor.nama;
        const container = document.getElementById('radarContainer');
        const headerStatus = `
<div id="shopIndicator" class="col-span-full bg-emerald-50 dark-shop-bg p-4 rounded-xl border border-emerald-100 dark-shop-border mb-4 flex flex-wrap justify-between items-center animate-popup">
            <div class="flex items-center gap-3">
                <div>
                    <p class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase">Produk Dari:</p>
                    <h3 class="font-bold text-gray-800 dark-shop-text">${distNama}</h3>
                </div>
                <!-- Tombol Merah di Samping Nama -->
                <button onclick="resetShopFilter()" class="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-red-600 hover:text-white transition-all flex items-center gap-1">
                    <i class="fas fa-times-circle"></i> Tutup Toko
                </button>
            </div>
            
            <div class="hidden md:block">
                 <p class="text-[9px] text-gray-400 italic">Filter pencarian hanya berlaku di toko ini</p>
            </div>
        </div>
    `;
        container.insertAdjacentHTML('afterbegin', headerStatus);
    }
}

// 6. Fungsi Tambah ke Keranjang (Firebase)


// Utility UI
function openInventoryCart() { document.getElementById('inventoryPanel').classList.remove('translate-x-full'); }
function closeInventoryCart() { document.getElementById('inventoryPanel').classList.add('translate-x-full'); }




// Tambahkan ini di dalam document.addEventListener('DOMContentLoaded', ...)
document.getElementById('searchInput').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    searchProduct(keyword);
});

function searchProduct(keyword) {
    // 1. Tentukan dataset mana yang akan dicari
    let sourceData = activeDistId 
        ? allProducts.filter(item => item.distId === activeDistId) 
        : allProducts;

    // 2. Lakukan filter berdasarkan keyword
    const filteredResults = sourceData.filter(item => {
        const namaProduk = item.nama.toLowerCase();
        const namaDistro = item.distributor.nama.toLowerCase();
        return namaProduk.includes(keyword) || namaDistro.includes(keyword);
    });

    renderDisplay(filteredResults);

    // 3. Jika sedang di dalam toko, tambahkan kembali header informasinya
    if (activeDistId && filteredResults.length > 0) {
        const distName = filteredResults[0].distributor.nama;
        const container = document.getElementById('radarContainer');
        const headerStatus = `
            <div class="col-span-full bg-emerald-50 p-4 rounded-xl border border-emerald-100 mb-4 flex justify-between items-center">
                <p class="text-[11px] font-bold text-gray-800">
                    <i class="fas fa-search mr-1"></i> Hasil pencarian di toko <b>${distName}</b>
                </p>
                <button onclick="resetShopFilter()" class="text-[10px] font-bold text-emerald-600">Lihat Semua Toko</button>
            </div>
        `;
        container.insertAdjacentHTML('afterbegin', headerStatus);
    }
}











// 1. Membaca Data Keranjang secara Real-Time
function updateCartCount() {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    if (!uid) return;

    // Listen data dari inventory user yang jenisnya 'produk'
    db.collection("users").doc(uid).collection("inventory")
      .where("jenis", "==", "produk")
      .onSnapshot(snapshot => {
          // Update angka di icon keranjang
          const badge = document.getElementById('cartCount');
          if(badge) badge.innerText = snapshot.size;

          renderCartItems(snapshot);
      });
}




function renderCartItems(snapshot) {
    const cartList = document.getElementById('cartList');
    if(!cartList) return;
    cartList.innerHTML = "";

    if (snapshot.empty) {
        cartList.innerHTML = "<p class='text-center text-xs text-gray-400 py-10'>Keranjang kosong</p>";
        return;
    }

    snapshot.forEach(doc => {
        const item = doc.data();
        // Hanya tampilkan yang belum di-checkout
        if (item.status === "menunggu_verifikasi") return;

        const div = document.createElement('div');
        div.className = "flex items-center gap-3 p-3 bg-gray-50 rounded-lg mb-2 border border-gray-100";
        div.innerHTML = `
            <input type="checkbox" class="checkout-checkbox w-4 h-4 accent-emerald-500" data-id="${doc.id}">
            <div class="flex-1">
                <p class="text-[10px] font-bold text-gray-800 uppercase">${item.nama}</p>
                <p class="text-[10px] text-emerald-600 font-black">Rp ${Number(item.harga).toLocaleString('id-ID')}</p>
            </div>
            <button onclick="deleteCartItem('${doc.id}')" class="text-gray-300 hover:text-red-500">
                <i class="fas fa-trash-alt text-[10px]"></i>
            </button>
        `;
        cartList.appendChild(div);
    });
}















// 3. Fungsi Hapus Item dari Keranjang
async function removeItem(itemId) {
    const uid = sessionStorage.getItem("uid");
    await db.collection("users").doc(uid).collection("inventory").doc(itemId).delete();
}

// 4. LOGIKA CHECKOUT (Proses Transaksi)
async function processCheckout() {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    const selected = document.querySelectorAll('.checkout-checkbox:checked');

    if (selected.length === 0) {
        return Swal.fire('Opps!', 'Pilih produk di keranjang untuk checkout', 'warning');
    }

    // Ambil ID dokumen yang dicentang
const selectedIds = Array.from(selected).map(cb => cb.getAttribute('data-id'));
    sessionStorage.setItem("pending_checkout_ids", JSON.stringify(selectedIds));

    window.location.href = "checkout.html";
}
// D. Hapus Item Keranjang
async function deleteCartItem(id) {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    await db.collection("users").doc(uid).collection("inventory").doc(id).delete();
}
// Panggil updateCartCount() di dalam DOMContentLoaded










function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    
    const isDark = body.classList.toggle('theme-dark');
    
    if (isDark) {
        icon.className = 'fas fa-sun text-sm md:text-base';
        text.innerText = 'Mode Terang';
        localStorage.setItem('theme', 'theme-dark');
    } else {
        icon.className = 'fas fa-moon text-sm md:text-base';
        text.innerText = 'Mode Gelap';
        localStorage.setItem('theme', 'theme-light');
    }
}
// Jalankan Otomatis saat Halaman di-load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'theme-dark') {
        document.body.classList.add('theme-dark');
        const icon = document.getElementById('themeIcon');
        const text = document.getElementById('themeText');
        if(icon) icon.className = 'fas fa-sun';
        if(text) text.innerText = 'Mode Terang';
    }
});




function showProductDetail(item) {
  const dist = item.distributor;
    
    Swal.fire({
        // Gunakan title tanpa pembungkus div tambahan agar tidak menambah margin
        title: `<span class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 block -mt-2">Detail Produk</span>`,
        html: `
            <div class="text-left space-y-2.5">
                <!-- Isi HTML Anda tetap sama -->
                <div class="relative p-0.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-300 shadow-sm">
                    <img src="${item.foto || 'https://via.placeholder.com/200'}" class="w-full aspect-square object-cover rounded-lg border border-white dark:border-slate-900">
                </div>
                
                <!-- Judul & Harga: Dibuat satu baris agar hemat ruang -->
                <div class="flex justify-between items-start gap-2">
                    <h2 class="text-[13px] font-black text-slate-800 dark:text-white leading-tight uppercase flex-1">${item.nama}</h2>
                    <p class="text-[14px] font-black text-emerald-600 whitespace-nowrap">Rp ${Number(item.harga).toLocaleString('id-ID')}</p>
                </div>

                <!-- Info Stok & Grade: Dibuat lebih tipis -->
                <div class="flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/20 px-2.5 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800/50">
                    <span class="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">Stok: ${item.stok} ${item.satuan}</span>
                    <span class="text-[8px] px-2 py-0.5 bg-amber-400 text-white rounded-md font-black uppercase">Grade ${item.grade}</span>
                </div>

                <!-- INFO PENJUAL: Lebih tipis & minimalis -->
                <div class="bg-slate-800 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-700 shadow-inner">
                    <div class="flex justify-between items-center">
                        <div class="overflow-hidden">
                            <p class="text-[11px] font-bold text-white truncate">${dist.nama}</p>
                            <p class="text-[9px] text-slate-400 truncate"><i class="fas fa-map-marker-alt text-red-400 mr-1"></i> ${dist.alamat.kota}</p>
                        </div>
                        <button onclick="filterByDistributor('${item.distId}', '${dist.nama}')" 
                            class="ml-2 px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-[8px] font-bold uppercase transition-all border border-slate-600 whitespace-nowrap">
                            Toko
                        </button>
                    </div>
                </div>

                <!-- INPUT JUMLAH & TOMBOL: Dibuat sebaris dan compact -->
                <div class="flex items-center gap-2 pt-1">
                    <div class="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
                        <button onclick="updateQty(-1, ${item.stok})" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-500 transition-colors">
                            <i class="fas fa-minus text-[10px]"></i>
                        </button>
                        <input type="number" id="qtyInput" value="1" readonly
                            class="w-7 text-center font-black text-xs text-slate-800 dark:text-white bg-transparent border-none focus:ring-0 p-0 pointer-events-none">
                        <button onclick="updateQty(1, ${item.stok})" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-500 transition-colors">
                            <i class="fas fa-plus text-[10px]"></i>
                        </button>
                    </div>

                    <button onclick='confirmQuantity(${JSON.stringify(item)})' 
                        class="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 rounded-lg font-black text-[9px] uppercase shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2">
                        <i class="fas fa-cart-plus"></i> Ke Keranjang
                    </button>
                </div>
            </div>
        `,
showConfirmButton: false,
        showCloseButton: true,
        width: '340px',
        padding: '1rem',
        background: 'transparent',
        // TAMBAHKAN INI:
        customClass: {
            title: 'p-0 m-0 pt-2', // Menghilangkan padding bawaan judul
            htmlContainer: 'm-0 pt-2' // Menyesuaikan jarak antara judul dan gambar
        }
    });
}



function updateQty(change, maxStok) {
    const input = document.getElementById('qtyInput');
    if (!input) return; // Mencegah error jika input tidak ditemukan

    let currentVal = parseInt(input.value) || 1;
    let newVal = currentVal + change;

    // Validasi: Minimal 1, Maksimal stok distributor
    if (newVal >= 1 && newVal <= maxStok) {
        input.value = newVal;
    }
}













function handleAddToCart(name, price, distId, foto, grade) {
    const qty = document.getElementById('qtyInput').value;
    
    if (qty < 1) {
        Swal.fire('Opps!', 'Jumlah minimal adalah 1', 'error');
        return;
    }
    
    // Jalankan fungsi utama dengan tambahan parameter qty
    addToCart(name, price, distId, foto, grade, parseInt(qty));
}







function filterByDistributor(distId, distNama) {
    Swal.close();
    
    // 1. Simpan ke variabel global dan sessionStorage agar persisten saat refresh
    activeDistId = distId; 
    sessionStorage.setItem('active_shop_id', distId);
    sessionStorage.setItem('active_shop_name', distNama);

    // 2. Lakukan filter data
    const filtered = allProducts.filter(item => item.distId === distId);

    // 3. Render ke layar
    renderDisplay(filtered);
    
    // 4. Munculkan header indikator toko
    addShopHeader(distNama);

    window.scrollTo({ top: 0, behavior: 'smooth' });
}





// Fungsi untuk kembali ke tampilan awal
function resetShopFilter() {
    activeDistId = null;
    sessionStorage.removeItem('active_shop_id');
    sessionStorage.removeItem('active_shop_name');
    renderDisplay(allProducts);
}

async function addToCart(name, price, distId, foto, grade, jumlah, sisaStokTersedia) {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    if (!uid) {
        Swal.fire({
            title: 'Akses Terbatas!',
            text: "Silahkan login untuk memasukkan produk ke keranjang.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Ke Halaman Login',
            confirmButtonColor: '#00AA5B'
        }).then((result) => {
            if (result.isConfirmed) window.location.href = '../login_sign/login_sign.html';
        });
        return;
    }

try {
        await db.collection("users").doc(uid).collection("inventory").add({
            jenis: "produk",
            nama: name,
            harga: price,
            jumlah_beli: jumlah, // Jumlah yang dimasukkan user ke keranjang
            stok_tersedia: sisaStokTersedia, // Sisa stok asli dari distributor
            total_harga: price * jumlah,
            foto: foto,
            grade: grade,
            asal_distributor: distId,
            status: "dalam_keranjang",
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        // ... (notifikasi sukses)
    } catch (e) {
        console.error("Gagal menambah data:", e);
    }
}

async function confirmQuantity(item) {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    const qtyInput = document.getElementById('qtyInput');
    const jumlahBeli = parseInt(qtyInput.value);

    if (!uid) return;

    try {
        const inventoryRef = db.collection("users").doc(uid).collection("inventory");
        const namaProduk = item.nama.trim();

        // 1. CEK DENGAN FILTER YANG LEBIH SPESIFIK (Nama + Penjual)
        const snapshot = await inventoryRef
            .where("jenis", "==", "produk")
            .where("nama", "==", namaProduk)
            .where("distId", "==", item.distId) // Pastikan distId dicek
            .get();

        if (!snapshot.empty) {
            // JIKA ADA: Update dokumen yang sudah ada
            const docRef = snapshot.docs[0].ref;
            const dataLama = snapshot.docs[0].data();
            const qtyBaru = parseInt(dataLama.stok || 0) + jumlahBeli;

            // Validasi Stok Maksimal
            if (qtyBaru > (item.stok || dataLama.stok_maksimal)) {
                Swal.fire("Gagal", `Total di keranjang (${qtyBaru}) melebihi stok tersedia`, "error");
                return;
            }

            await docRef.update({
                stok: qtyBaru,
                stok_beli: qtyBaru,
                total_harga: item.harga * qtyBaru,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

        } else {
            // JIKA BELUM ADA: Add dokumen baru
            await inventoryRef.add({
                productId: item.id,
                nama: namaProduk,
                harga: item.harga,
                foto: item.foto || "",
                grade: item.grade || "-",
                jenis: "produk",
                status: "dalam_keranjang",
                stok: jumlahBeli,
                stok_beli: jumlahBeli,
                stok_maksimal: item.stok || 0,
                total_harga: item.harga * jumlahBeli,
                
                // Data Penjual (Sesuai kebutuhan dashboard)
                distId: item.distId || "",
                nama_penjual: item.distributor?.nama || "Penjual",
                wa_penjual: item.distributor?.whatsapp || item.distributor?.telepon || "0",
                email_penjual: item.distributor?.email || "",
                
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        Swal.fire({ 
            icon: 'success', 
            title: 'Berhasil!', 
            text: 'Keranjang diperbarui',
            timer: 1500, 
            showConfirmButton: false 
        });

    } catch (error) {
        console.error("Gagal menyimpan:", error);
        Swal.fire("Error", "Gagal menyimpan data", "error");
    }
}






















function handleLogout() {
    Swal.fire({
        title: 'Keluar?',
        text: "Anda perlu login kembali untuk melakukan transaksi.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#00AA5B',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            // Hapus semua data sesi
            sessionStorage.clear();
            
            // Opsional: Jika menggunakan Firebase Auth
            // firebase.auth().signOut(); 

            Swal.fire({
                title: 'Berhasil Logout',
                icon: 'success',
                timer: 1000,
                showConfirmButton: false
            }).then(() => {
                window.location.reload(); // Refresh halaman untuk kembali ke mode tamu
            });
        }
    });
}