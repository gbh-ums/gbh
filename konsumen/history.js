// ================= CONFIG FIREBASE =================
const firebaseConfig = {
    apiKey: "AIzaSyB6HETQvxf6jZ4d48BxvOFtFU0fuTXZN_I",
    authDomain: "gabah-cc201.firebaseapp.com",
    projectId: "gabah-cc201",
    storageBucket: "gabah-cc201.appspot.com",
    messagingSenderId: "497754423789",
    appId: "1:497754423789:web:64b22"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================= GLOBAL STATE =================
let currentStatus = "menunggu_konfirmasi"; // Status awal yang dicari

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
});

// ================= FUNGSI TAB =================
function switchTab(type) {
    const tProses = document.getElementById('tabProses');
    const tSelesai = document.getElementById('tabSelesai');
    
    if(type === 'proses') {
        currentStatus = "menunggu_konfirmasi";
        tProses.classList.add('tab-active');
        tProses.classList.remove('text-slate-400');
        tSelesai.classList.remove('tab-active');
        tSelesai.classList.add('text-slate-400');
    } else {
        currentStatus = "selesai";
        tSelesai.classList.add('tab-active');
        tSelesai.classList.remove('text-slate-400');
        tProses.classList.remove('tab-active');
        tProses.classList.add('text-slate-400');
    }
    loadHistory();
}

// ================= LOAD DATA DARI FIRESTORE =================
async function loadHistory() {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    const container = document.getElementById('historyList');

    if (!uid) {
        container.innerHTML = `<p class="text-center text-xs text-red-500">Sesi berakhir, silakan login kembali.</p>`;
        return;
    }

    try {
        // Query tanpa orderBy untuk menghindari error Index
        const snapshot = await db.collection("orders")
            .where("pembeli.uid", "==", uid)
            .where("status", "==", currentStatus)
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
                    <i class="fas fa-receipt text-slate-200 text-5xl mb-4"></i>
                    <p class="text-slate-400 text-xs font-bold uppercase tracking-widest">Belum ada transaksi</p>
                </div>`;
            return;
        }

        // Simpan ke array untuk di-sort secara manual (Hemat Index)
        let orderData = [];
        snapshot.forEach(doc => {
            orderData.push({ id: doc.id, ...doc.data() });
        });

        // Urutkan: Terbaru di atas (berdasarkan timestamp)
        orderData.sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
        });

        renderHistory(orderData);

    } catch (err) {
        console.error("Error Load History:", err);
        container.innerHTML = `<p class="text-center text-xs text-red-500">Gagal memuat data: ${err.message}</p>`;
    }
}

// ================= RENDER HTML =================
function renderHistory(orders) {
    const container = document.getElementById('historyList');
    let html = "";

    orders.forEach(data => {
        // Format Tanggal
        const dateStr = data.timestamp 
            ? data.timestamp.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) 
            : 'Baru saja';

        html += `
        <div class="card-history p-5">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 bg-[#ebffef] rounded-full flex items-center justify-center text-[#00AA5B]">
                        <i class="fas fa-shopping-bag text-[10px]"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-slate-400 uppercase leading-none">${dateStr}</p>
                        <span class="text-[9px] font-bold text-[#00AA5B] uppercase">${data.status.replace('_', ' ')}</span>
                    </div>
                </div>
                <span class="text-[8px] font-mono text-slate-300 bg-slate-50 px-2 py-1 rounded">ID: ${data.orderId.substring(0,10)}</span>
            </div>

            <div class="flex gap-4 items-center">
                <img src="${data.produk.foto || 'https://via.placeholder.com/100'}" 
                     class="w-16 h-16 rounded-2xl object-cover shadow-sm border border-slate-50">
                
                <div class="flex-1">
                    <h3 class="text-xs font-extrabold text-slate-800 uppercase tracking-tight">${data.produk.nama}</h3>
                    <p class="text-[10px] text-slate-500 font-medium">${data.produk.jumlah_beli} unit x Rp ${data.produk.harga_satuan.toLocaleString('id-ID')}</p>
                    <div class="mt-1">
                        <span class="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold">Grade ${data.produk.grade}</span>
                    </div>
                </div>

                <div class="text-right border-l border-slate-100 pl-4">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Total Bayar</p>
                    <p class="text-sm font-black text-[#00AA5B]">Rp ${data.produk.total_bayar.toLocaleString('id-ID')}</p>
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-dashed border-slate-100 flex justify-between items-center">
                <div class="flex items-center gap-2">
                    <i class="fas fa-store text-slate-300 text-[10px]"></i>
                    <span class="text-[10px] font-bold text-slate-600">${data.penjual.nama_toko}</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.location.href='https://wa.me/${data.penjual.wa_penjual}'" 
                        class="px-4 py-2 bg-white border border-[#00AA5B] text-[#00AA5B] rounded-xl text-[10px] font-black hover:bg-[#00AA5B] hover:text-white transition-all">
                        HUBUNGI PENJUAL
                    </button>
                </div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
}