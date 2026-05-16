// ================= FIREBASE =================
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

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    loadCheckoutData();
    loadTheme();
});

// ================= LOAD DATA =================
async function loadCheckoutData() {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    const container = document.getElementById('checkoutGroupedItems');

    if (!uid) {
        console.error("UID tidak ditemukan");
        return;
    }

    try {
        // ===== USER =====
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists) {
            const u = userDoc.data();
            const almt = u.alamat || {};

            document.getElementById('destName').innerText =
                `${(u.nama || "KONSUMEN").toUpperCase()} | ${u.whatsapp || "-"}`;

            document.getElementById('destAddress').innerHTML = `
                ${almt.desa || ''}, ${almt.kecamatan || ''}, ${almt.kota || ''}, ${almt.provinsi || ''}
                <br><span class="text-[10px] text-[#00AA5B] font-bold">${u.email || "-"}</span>
            `;
        }

        // ===== CART =====
        const snapshot = await db.collection("users")
            .doc(uid)
            .collection("inventory")
            .where("jenis", "==", "produk")
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<div class="product-card p-10 text-center text-slate-400 text-xs">KERANJANG KOSONG</div>`;
            updateTotal();
            return;
        }

        const grouped = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const penjual = data.nama || "Distributor";

            if (!grouped[penjual]) grouped[penjual] = [];

            grouped[penjual].push({
                docId: doc.id,
                ...data
            });
        });

        renderGroupedItems(grouped);
        updateTotal();

    } catch (err) {
        console.error("ERROR LOAD:", err);
    }
}

// ================= RENDER =================
function renderGroupedItems(grouped) {
    const container = document.getElementById('checkoutGroupedItems');
    container.innerHTML = "";

    for (const penjual in grouped) {
        const section = document.createElement("div");
        section.className = "product-card p-6 mb-6";

        let html = `
        <h4 class="font-bold text-xs mb-4">${penjual}</h4>
        <div class="space-y-4">`;

        grouped[penjual].forEach(item => {
            const qty = item.stok || 1;
            const total = item.harga * qty;

            html += `
            <div class="flex items-center gap-4">

                <input type="checkbox" checked
                    class="item-checkbox"
                    data-id="${item.docId}"
                    data-price="${item.harga}"
                    data-qty="${qty}"
                    onchange="updateTotal()">

                <img src="${item.foto || 'https://via.placeholder.com/100'}"
                     class="w-14 h-14 rounded-xl">

                <div class="flex-1">
                    <h5 class="text-xs font-bold">${item.nama}</h5>

                    <div class="flex items-center gap-1 mt-1">
                        <button onclick="changeQtyCart('${item.docId}', -1)"
                            class="px-2 bg-slate-200 rounded">-</button>

                        <span class="qty-text w-6 text-center text-xs font-bold">${qty}</span>

                        <button onclick="changeQtyCart('${item.docId}', 1)"
                            class="px-2 bg-slate-200 rounded">+</button>
                    </div>
                </div>

                <div class="text-right">
                    <p class="text-xs font-bold">
                        Rp ${total.toLocaleString('id-ID')}
                    </p>

                    <button onclick="removeItem('${item.docId}')"
                        class="text-red-500 text-xs">Hapus</button>
                </div>

            </div>`;
        });

        html += `</div>`;
        section.innerHTML = html;
        container.appendChild(section);
    }
}

// ================= QTY =================
// ================= QTY DENGAN VALIDASI STOK =================
async function changeQtyCart(docId, delta) {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    if (!uid) return;

    try {
        const cartRef = db.collection("users").doc(uid).collection("inventory").doc(docId);
        const cartSnap = await cartRef.get();
        if (!cartSnap.exists) return;

        const cartData = cartSnap.data();
        let currentQty = parseInt(cartData.stok || 1);
        let newQty = currentQty + delta;

        if (newQty <= 0) {
            await removeItem(docId);
            return;
        }

        // --- VALIDASI STOK REAL-TIME ---
        // Pastikan Anda memiliki ID produk asli untuk mengecek ke koleksi produk pusat
        const produkIdAsli = cartData.productId || cartData.id_produk; 
        
        // Misalkan koleksi pusat produk Anda bernama "products"
        const productRef = db.collection("products").doc(produkIdAsli);
        const productSnap = await productRef.get();

        if (productSnap.exists) {
            const realStok = parseInt(productSnap.data().stok || 0);
            
            if (delta > 0 && newQty > realStok) {
                Swal.fire({
                    icon: 'error',
                    title: 'Stok Tidak Mencukupi',
                    text: `Maaf, stok saat ini hanya tersedia ${realStok} unit.`,
                    confirmButtonColor: '#00AA5B'
                });
                return;
            }
        }
        // -------------------------------

        await cartRef.update({ stok: newQty });

        // Update UI
        const checkbox = document.querySelector(`[data-id="${docId}"]`);
        if (checkbox) {
            checkbox.setAttribute("data-qty", newQty);
            const qtyDisplay = checkbox.closest('.flex').querySelector('.qty-text');
            if (qtyDisplay) qtyDisplay.innerText = newQty;
        }

        updateTotal();

    } catch (err) {
        console.error("Gagal update QTY:", err);
    }
}

// ================= DELETE =================
async function removeItem(docId) {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    if (!uid || !docId) return;

    try {
        const confirm = await Swal.fire({
            title: 'Hapus produk?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Hapus'
        });

        if (!confirm.isConfirmed) return;

        await db.collection("users")
            .doc(uid)
            .collection("inventory")
            .doc(docId)
            .delete();

        await loadCheckoutData();

    } catch (err) {
        console.error("ERROR DELETE:", err);
    }
}

// ================= TOTAL =================
function updateTotal() {
    let subtotal = 0;

    document.querySelectorAll('.item-checkbox:checked').forEach(el => {
        const price = parseInt(el.dataset.price) || 0;
        const qty = parseInt(el.dataset.qty) || 1;
        subtotal += price * qty;
    });

    const isPickup = document.querySelector('input[name="delivery"]:checked')?.value === 'pickup';
    const shipping = isPickup ? 0 : 15000;
    const admin = 2000;
    const total = subtotal + shipping + admin;

    document.getElementById('subtotalAmount').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('shippingAmount').innerText = `Rp ${shipping.toLocaleString('id-ID')}`;
    document.getElementById('totalFinal').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

// ================= PAYMENT =================
async function processPayment() {
    const uid = sessionStorage.getItem("uid") || sessionStorage.getItem("user_uid");
    const checkedItems = document.querySelectorAll('.item-checkbox:checked');
    
    // Data Pembeli dari Session/UI
    const namaPembeli = sessionStorage.getItem('user_nama') || document.getElementById('headerName')?.innerText || "Pembeli";
    const tlpPembeli = sessionStorage.getItem('user_telp') || document.getElementById('headerPhone')?.innerText || "-";
    const emailPembeli = sessionStorage.getItem('user_email') || "-";

    console.log("=== MEMULAI PROSES PEMBAYARAN & PENDATAAN SELLER ===");

    if (checkedItems.length === 0) return Swal.fire('Opps', 'Pilih produk dulu!', 'warning');

    try {
        const batch = db.batch();

        for (let el of checkedItems) {
            const docId = el.dataset.id;
            const snap = await db.collection("users").doc(uid).collection("inventory").doc(docId).get();
            
            if (!snap.exists) {
                console.error(`Item ${docId} tidak ditemukan di inventory.`);
                continue;
            }
            
            const item = snap.data();
            const orderRef = db.collection("orders").doc();

            // Log untuk memastikan UID Penjual terbaca
            console.log(`Memproses produk: ${item.nama} | UID Penjual: ${item.distId || item.asal_distributor}`);

            const detailOrder = {
                orderId: orderRef.id,
                status: "menunggu_konfirmasi",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                
                // UID PENJUAL (Kunci Utama Dasbor Penjual)
                distId: item.distId || item.asal_distributor || "UID_TIDAK_TERDETEKSI",

                // DATA PEMBELI
                pembeli: {
                    uid: uid,
                    nama: namaPembeli.replace(/<[^>]*>?/gm, '').trim(), // Bersihkan tag HTML jika ada
                    telepon: tlpPembeli.replace(/<[^>]*>?/gm, '').trim(),
                    email: emailPembeli
                },

                // DATA PENJUAL (Informasi Tampilan)
                penjual: {
                    nama_toko: item.nama_penjual || "Toko Berkah",
                    wa_penjual: item.wa_penjual || "0",
                    email_penjual: item.email_penjual || ""
                },

                // DETAIL PRODUK
                produk: {
                    id: item.productId || item.id_produk || docId,
                    nama: item.nama,
                    harga_satuan: item.harga,
                    jumlah_beli: parseInt(item.stok_beli || item.stok),
                    total_bayar: (item.harga * (item.stok_beli || item.stok)),
                    grade: item.grade || "-",
                    foto: item.foto || ""
                }
            };

            batch.set(orderRef, detailOrder);

            // Update status di keranjang pembeli
const cartRef = db.collection("users").doc(uid).collection("inventory").doc(docId);
            batch.delete(cartRef); 
        }

        await batch.commit();
        console.log("=== DATA BERHASIL DIKIRIM KE DASBOR PENJUAL ===");

        Swal.fire({
            icon: 'success',
            title: 'Pesanan Terkirim!',
            text: 'Penjual akan segera memverifikasi pesanan Anda.',
            confirmButtonColor: '#00AA5B'
        }).then(() => {
            window.location.href = "history.html";
        });

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        Swal.fire('Gagal', 'Sistem gagal mendata pesanan: ' + error.message, 'error');
    }
}




















// ================= ADDRESS =================
function changeAddress() {
    Swal.fire({
        title: 'Alamat Baru',
        input: 'text',
        preConfirm: val => {
            if (!val) Swal.showValidationMessage('Isi alamat');
            return val;
        }
    }).then(res => {
        if (res.isConfirmed) {
            document.getElementById('destAddress').innerText = res.value;
        }
    });
}

// ================= THEME =================
function toggleTheme() {
    document.body.classList.toggle('theme-dark');
    localStorage.setItem('theme',
        document.body.classList.contains('theme-dark') ? 'dark' : 'light');
}

function loadTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('theme-dark');
    }
}


