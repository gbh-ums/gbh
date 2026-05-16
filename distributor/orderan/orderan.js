// Konfigurasi Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyB6HETQvxf6jZ4d48BxvOFtFU0fuTXZN_I",
    authDomain: "gabah-cc201.firebaseapp.com",
    projectId: "gabah-cc201",
    storageBucket: "gabah-cc201.firebasestorage.app",
    messagingSenderId: "497754423789",
    appId: "1:497754423789:web:64b22"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let allOrders = []; // Simpan data untuk ekspor

document.addEventListener('DOMContentLoaded', () => {
    const uid = sessionStorage.getItem("uid");
    if(uid) listenToOrders(uid);
});

function listenToOrders(uid) {
    db.collection("orders").where("distId", "==", uid)
    .onSnapshot((snapshot) => {
        allOrders = [];
        snapshot.forEach(doc => allOrders.push({ id: doc.id, ...doc.data() }));
        renderUI(allOrders);
    });
}

function renderUI(orders) {
    const table = document.getElementById('tableOrderan');
    let income = 0;
    let counts = { pending: 0, process: 0, done: 0, cancel: 0 };

    table.innerHTML = orders.map(order => {
        const total = Number(order.produk?.total_bayar || 0);
        const status = order.status || 'menunggu_konfirmasi';
        
        // Hitung Statistik
        if(status === 'selesai') {
            income += total;
            counts.done++;
        } else if(status === 'proses') counts.process++;
        else if(status === 'batal') counts.cancel++;
        else counts.pending++;

        return `
            <tr class="border-b border-slate-50 hover:bg-blue-50/30 transition-all">
                <td class="p-4">
                    <div class="font-black text-blue-600 uppercase">${order.pembeli?.nama || 'N/A'}</div>
                    <div class="opacity-40 text-[10px]">${order.pembeli?.telepon || '-'}</div>
                </td>
                <td class="p-4 uppercase font-bold">${order.produk?.nama || 'Produk'}</td>
                <td class="p-4 text-center font-mono">${order.produk?.jumlah_beli || 0}</td>
                <td class="p-4 text-right font-black text-emerald-600">Rp ${total.toLocaleString('id-ID')}</td>
                <td class="p-4 text-center">
                    <span class="px-3 py-1 rounded-full text-[8px] font-black ${getStatusClass(status)}">
                        ${status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                </td>
                <td class="p-4 flex justify-center gap-2">
                    ${getActionButtons(order.id, status, order.pembeli?.telepon)}
                </td>
            </tr>
        `;
    }).join('');

    // Update Counter & Income
    document.getElementById('count-pending').innerText = counts.pending;
    document.getElementById('count-process').innerText = counts.process;
    document.getElementById('count-done').innerText = counts.done;
    document.getElementById('count-cancel').innerText = counts.cancel;
    document.getElementById('total-income').innerText = `Rp ${income.toLocaleString('id-ID')}`;
    
    document.getElementById('empty-state').classList.toggle('hidden', orders.length > 0);
}

function getStatusClass(status) {
    const classes = {
        'selesai': 'bg-emerald-100 text-emerald-600',
        'proses': 'bg-orange-100 text-orange-600',
        'batal': 'bg-red-100 text-red-600',
        'menunggu_konfirmasi': 'bg-blue-100 text-blue-600'
    };
    return classes[status] || 'bg-slate-100 text-slate-600';
}

function getActionButtons(id, status, phone) {
    let btns = '';
    if(status === 'menunggu_konfirmasi') {
        btns += `<button onclick="updateStatus('${id}', 'proses')" class="w-7 h-7 bg-orange-500 text-white rounded-md text-[10px]"><i class="fas fa-box"></i></button>`;
    } else if(status === 'proses') {
        btns += `<button onclick="updateStatus('${id}', 'selesai')" class="w-7 h-7 bg-emerald-500 text-white rounded-md text-[10px]"><i class="fas fa-check"></i></button>`;
    }
    btns += `<button onclick="window.open('https://wa.me/${phone}')" class="w-7 h-7 bg-blue-600 text-white rounded-md text-[10px]"><i class="fab fa-whatsapp"></i></button>`;
    return btns;
}

async function updateStatus(id, newStatus) {
    try {
        const orderRef = db.collection("orders").doc(id);
        const orderDoc = await orderRef.get();
        
        if (!orderDoc.exists) throw "Data pesanan tidak ditemukan!";
        const orderData = orderDoc.data();

        if (newStatus === 'selesai') {
            const distributorId = orderData.distId;
            const productId = orderData.produk.id;
            const jumlahBeli = Number(orderData.produk.jumlah_beli);

            // Menunjuk ke sub-koleksi inventory
            const productRef = db.collection("users").doc(distributorId).collection("inventory").doc(productId);

            await db.runTransaction(async (transaction) => {
                const productDoc = await transaction.get(productRef);
                
                if (!productDoc.exists) {
                    throw "Produk tidak ditemukan di inventory distributor ini!";
                }

                const currentStok = Number(productDoc.data().stok || 0);
                const stokBaru = currentStok - jumlahBeli;

                if (stokBaru < 0) {
                    throw `Stok tidak mencukupi! (Sisa: ${currentStok})`;
                }

                transaction.update(orderRef, { status: newStatus });
                transaction.update(productRef, { stok: stokBaru });
            });
        } else {
            await orderRef.update({ status: newStatus });
        }

        Swal.fire({ icon: 'success', title: 'Berhasil', text: 'Status diperbarui & stok dikurangi', timer: 2000 });
    } catch(e) { 
        console.error(e);
        Swal.fire('Gagal', e.toString(), 'error'); 
    }
}
function exportToExcel() {
    if(allOrders.length === 0) return Swal.fire('Data Kosong', '', 'warning');
    
    const data = allOrders.map(o => ({
        Pembeli: o.pembeli?.nama,
        Telepon: o.pembeli?.telepon,
        Produk: o.produk?.nama,
        Qty: o.produk?.jumlah_beli,
        Total: o.produk?.total_bayar,
        Status: o.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orderan");
    XLSX.writeFile(wb, "Laporan_Orderan.xlsx");
}


































let salesChart = null; // Variable untuk menyimpan instance chart

document.addEventListener('DOMContentLoaded', () => {
    setupFilterYears();
    const uid = sessionStorage.getItem("uid");
    if(uid) listenToOrders(uid);

    // Event Listener untuk Filter
    document.getElementById('filter-month').addEventListener('change', () => renderUI(allOrders));
    document.getElementById('filter-year').addEventListener('change', () => renderUI(allOrders));
});

function setupFilterYears() {
    const yearSelect = document.getElementById('filter-year');
    const currentYear = new Date().getFullYear();
    for(let i = 0; i < 3; i++) {
        let year = currentYear - i;
        yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
    }
}
function renderUI(orders) {
    const table = document.getElementById('tableOrderan');
    const selectedMonth = document.getElementById('filter-month').value;
    const selectedYear = document.getElementById('filter-year').value;

    let income = 0; // Ini akan menampung hasil penjumlahan asli
    let counts = { pending: 0, process: 0, done: 0, cancel: 0 };
    let monthlyOrderCount = new Array(12).fill(0); // Data untuk grafik (Jumlah Orderan)

    const filteredOrders = orders.filter(order => {
        let date = order.timestamp && typeof order.timestamp.toDate === 'function' 
                   ? order.timestamp.toDate() 
                   : new Date();

        const month = date.getMonth();
        const year = date.getFullYear();

        // Data Grafik: Hitung JUMLAH (bukan uang) jika status selesai
        if(year == selectedYear && order.status === 'selesai') {
            monthlyOrderCount[month] += 1; 
        }

        const matchMonth = selectedMonth === 'all' || month == selectedMonth;
        const matchYear = year == selectedYear;
        return matchMonth && matchYear;
    });

    table.innerHTML = filteredOrders.map(order => {
        // PERBAIKAN: Paksa total_bayar jadi angka asli
        const total = Number(order.produk?.total_bayar || 0); 
        const status = order.status || 'menunggu_konfirmasi';
        
        if(status === 'selesai') {
            income += total; // Sekarang ini penjumlahan matematika: 10.000 + 10.000 = 20.000
            counts.done++;
        } 
        else if(status === 'proses') counts.process++;
        else if(status === 'batal') counts.cancel++;
        else counts.pending++;

        let dateObj = order.timestamp?.toDate ? order.timestamp.toDate() : new Date();
        let displayDate = dateObj.toLocaleDateString('id-ID', { day:'2-digit', month:'short' });

        return `
            <tr class="border-b border-slate-50 hover:bg-blue-50/30 transition-all text-[11px]">
                <td class="p-4">
                    <div class="font-black text-blue-600 uppercase">${order.pembeli?.nama || 'N/A'}</div>
                    <div class="opacity-40 text-[9px] font-bold">${displayDate}</div>
                </td>
                <td class="p-4 uppercase font-bold text-slate-600">${order.produk?.nama || 'Produk'}</td>
                <td class="p-4 text-center font-mono">${order.produk?.jumlah_beli || 0}</td>
                <td class="p-4 text-right font-black text-emerald-600">Rp ${total.toLocaleString('id-ID')}</td>
                <td class="p-4 text-center">
                    <span class="px-2 py-1 rounded-full text-[7px] font-black ${getStatusClass(status)}">
                        ${status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                </td>
                <td class="p-4 flex justify-center gap-2">
                    ${getActionButtons(order.id, status, order.pembeli?.telepon)}
                </td>
            </tr>
        `;
    }).join('');

    // Tampilkan hasil yang sudah dirapikan
    document.getElementById('total-income').innerText = `Rp ${income.toLocaleString('id-ID')}`;
    document.getElementById('count-pending').innerText = counts.pending;
    document.getElementById('count-process').innerText = counts.process;
    document.getElementById('count-done').innerText = counts.done;
    document.getElementById('count-cancel').innerText = counts.cancel;
    
    // Panggil grafik dengan data JUMLAH orderan
    updateChart(monthlyOrderCount);
    let chartLabels = [];
    let chartData = [];

    if (currentChartMode === 'year') {
        // MODE 12 BULAN
        chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        chartData = new Array(12).fill(0);
        
        orders.forEach(order => {
            if (order.status === 'selesai') {
                let date = order.timestamp?.toDate ? order.timestamp.toDate() : new Date();
                if (date.getFullYear() == document.getElementById('filter-year').value) {
                    chartData[date.getMonth()] += 1;
                }
            }
        });
    } else {
        // MODE 30 HARI TERAKHIR
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            let d = new Date();
            d.setDate(now.getDate() - i);
            chartLabels.push(d.getDate() + '/' + (d.getMonth() + 1));
            chartData.push(0);
        }

        orders.forEach(order => {
            if (order.status === 'selesai') {
                let date = order.timestamp?.toDate ? order.timestamp.toDate() : new Date();
                let timeDiff = now.getTime() - date.getTime();
                let dayDiff = Math.floor(timeDiff / (1000 * 3600 * 24));

                if (dayDiff >= 0 && dayDiff < 30) {
                    // Masukkan ke index yang sesuai di chartData (29 adalah hari ini)
                    chartData[29 - dayDiff] += 1;
                }
            }
        });
    }

    updateChart(chartLabels, chartData);
}

// Pastikan baris ini ada di paling atas file script.js (di luar fungsi manapun)


function updateChart(dataPoints) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) {
        console.error("Canvas salesChart tidak ditemukan!");
        return;
    }

    const ctx = canvas.getContext('2d');
    
    // Hancurkan chart lama jika sudah ada agar tidak bentrok
    if (salesChart) {
        salesChart.destroy();
    }

    // Buat chart baru
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Penghasilan',
                data: dataPoints, // Pastikan ini berisi array 12 angka
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { font: { size: 10 } }
                },
                x: {
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}


























let currentChartMode = 'year'; // Default mode

// Fungsi untuk ganti mode dari tombol
function changeChartMode(mode) {
    currentChartMode = mode;
    
    // Update Tampilan Tombol
    const btnYear = document.getElementById('btn-year');
    const btnMonth = document.getElementById('btn-month');
    const title = document.getElementById('chart-title');

    if(mode === 'year') {
        btnYear.className = "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white shadow-sm text-blue-600";
        btnMonth.className = "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-400";
        title.innerText = "Tampilan 12 Bulan";
    } else {
        btnMonth.className = "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase bg-white shadow-sm text-blue-600";
        btnYear.className = "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-400";
        title.innerText = "Tampilan 30 Hari Terakhir";
    }

    renderUI(allOrders); // Render ulang grafik
}

function updateChart(labels, dataPoints) {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;

    if (salesChart) { salesChart.destroy(); }

    salesChart = new Chart(ctx, {
        type: currentChartMode === 'year' ? 'bar' : 'line', // Bar untuk tahun, Line untuk hari agar tren terlihat
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Orderan',
                data: dataPoints,
                borderColor: '#7c3aed',
                backgroundColor: currentChartMode === 'year' ? '#7c3aed' : 'rgba(124, 58, 237, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: currentChartMode === 'year' ? 0 : 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 8 } } },
                x: { 
                    ticks: { 
                        font: { size: 8 },
                        maxRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10 // Agar label 30 hari tidak berdempetan
                    } 
                }
            }
        }
    });
}