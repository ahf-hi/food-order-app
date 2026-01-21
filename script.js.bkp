// --- DATABASE CONFIGURATION ---
// Using var to prevent "already declared" errors if the script reloads
var DB_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
var DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8'; 

// Initialize Supabase
var supabase = window.supabase.createClient(DB_URL, DB_KEY);

let userId = 'Ashikin';
let orders = [];
let menuItems = [];
window.currentSummaryType = 'customer';

document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    ['orderDate', 'summaryDate', 'groceryDate', 'orderViewDate'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = today;
    });

    setupSalesReportFilters();
    await fetchData();
    
    supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
    showSection('orderFormSection');
});

async function fetchData() {
    const { data: o } = await supabase.from('orders').select('*').order('date', { ascending: false });
    const { data: m } = await supabase.from('menus').select('*').order('name');
    orders = o || [];
    menuItems = m || [];
    renderAll();
    generateSalesReport();
}

window.showSection = (id) => {
    ['orderFormSection', 'ordersListSection', 'orderSummarySection', 'manageMenuSection', 'salesReportSection'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    updateNavButtons(id);
};

function updateNavButtons(activeId) {
    const navMap = {
        'orderFormSection': 'navOrder', 'ordersListSection': 'navView',
        'orderSummarySection': 'navSummary', 'manageMenuSection': 'navMenu', 'salesReportSection': 'navSales'
    };
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('btn-active');
        btn.classList.add('btn-secondary');
    });
    const activeBtn = document.getElementById(navMap[activeId]);
    if (activeBtn) {
        activeBtn.classList.add('btn-active');
        activeBtn.classList.remove('btn-secondary');
    }
}

function renderAll() {
    // 1. New Order Menu Selection
    const menuItemsEl = document.getElementById('menuItems');
    if (menuItemsEl) {
        menuItemsEl.innerHTML = menuItems.map(item => `
            <div class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" class="menu-item-checkbox w-5 h-5 accent-pink-500" data-price="${item.price}" data-name="${item.name}" onchange="calculateTotalPrice()">
                    <span class="font-bold text-gray-700">${item.name}</span>
                </label>
                <input type="number" value="1" min="1" class="qty-input w-12 text-center font-black text-pink-600 bg-gray-100 rounded-lg p-1" oninput="calculateTotalPrice()">
            </div>`).join('');
    }

    // 2. VIEW ORDERS (Logic updated: Search ignores Date)
    const tableBody = document.getElementById('ordersTableBody');
    const searchQuery = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const filterDate = document.getElementById('orderViewDate')?.value || '';

    if (tableBody) {
        const filtered = orders.filter(o => {
            const itemsStr = o.items ? o.items.map(i => i.name + (i.remarks || '')).join(' ').toLowerCase() : '';
            const matchesSearch = o.customerName.toLowerCase().includes(searchQuery) || itemsStr.includes(searchQuery);
            
            // If user is searching, ignore the date. If search is empty, show today's date only.
            if (searchQuery.length > 0) {
                return matchesSearch;
            } else {
                return o.date === filterDate;
            }
        });

        tableBody.innerHTML = filtered.map(o => {
            const isAdmin = o.customerName === 'Admin';
            const itemsDisplay = o.items ? o.items.map(i => {
                const label = (isAdmin && i.name === 'Groceries') ? `Groceries` : i.name;
                const remarks = i.remarks ? `<span class="remark-text">${i.remarks}</span>` : '';
                return `<div class="mb-1 font-bold text-gray-700 text-xs">${i.quantity}x ${label} ${remarks}</div>`
            }).join('') : '';

            const pricePrefix = o.totalPrice < 0 ? '-' : '';
            const priceColor = o.totalPrice < 0 ? 'text-red-600' : 'text-pink-600';

            return `<tr class="border-b">
                <td class="p-4 text-[10px] text-gray-400 font-bold">${o.date}</td>
                <td class="p-4 font-black text-gray-800">${o.customerName}</td>
                <td class="p-4">${itemsDisplay}</td>
                <td class="p-4 text-gray-400 font-bold">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
                <td class="p-4 font-black ${priceColor}">${pricePrefix} RM ${Math.abs(o.totalPrice).toFixed(2)}</td>
                <td class="p-4 text-center"><button onclick="deleteOrder('${o.id}')" class="text-gray-300 hover:text-red-500 font-bold text-[10px] uppercase">Del</button></td>
            </tr>`;
        }).join('') || '<tr><td colspan="6" class="p-10 text-center text-gray-400">No records found.</td></tr>';
    }

    // 3. Manage Menu List
    const menuListEl = document.getElementById('menuList');
    if (menuListEl) {
        menuListEl.innerHTML = menuItems.map(item => `
            <div class="bg-white p-5 rounded-3xl border shadow-sm flex flex-col gap-1">
                <p class="font-black text-gray-800">${item.name}</p>
                <p class="text-pink-600 font-bold text-sm">RM ${Number(item.price).toFixed(2)}</p>
                <div class="flex gap-4 mt-3 pt-3 border-t">
                    <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price})" class="text-[10px] text-blue-500 font-black uppercase">Edit</button>
                    <button onclick="deleteMenuItem('${item.id}')" class="text-[10px] text-red-400 font-black uppercase">Delete</button>
                </div>
            </div>`).join('');
    }
}

window.calculateTotalPrice = () => {
    let subtotal = 0;
    document.querySelectorAll('#menuItems > div').forEach(row => {
        const checkbox = row.querySelector('.menu-item-checkbox');
        const qtyInput = row.querySelector('.qty-input');
        if (checkbox?.checked) subtotal += parseFloat(checkbox.dataset.price) * (parseInt(qtyInput.value) || 1);
    });
    const delivery = parseFloat(document.getElementById('deliveryFee').value || 0);
    document.getElementById('totalPriceDisplay').innerText = `RM ${(subtotal + delivery).toFixed(2)}`;
};

document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    const selected = [];
    document.querySelectorAll('#menuItems > div').forEach(row => {
        const checkbox = row.querySelector('.menu-item-checkbox');
        const qtyInput = row.querySelector('.qty-input');
        if (checkbox?.checked) selected.push({ name: checkbox.dataset.name, price: parseFloat(checkbox.dataset.price), quantity: parseInt(qtyInput.value) || 1 });
    });
    if(!selected.length) return alert("Select an item");
    const delivery = parseFloat(document.getElementById('deliveryFee').value || 0);
    const subtotal = selected.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    await supabase.from('orders').insert([{ customerName: document.getElementById('customerName').value, date: document.getElementById('orderDate').value, items: selected, deliveryFee: delivery, totalPrice: subtotal + delivery, user_id: userId }]);
    e.target.reset(); calculateTotalPrice();
};

document.getElementById('groceryForm').onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('groceryAmount').value);
    await supabase.from('orders').insert([{
        customerName: 'Admin',
        date: document.getElementById('groceryDate').value,
        items: [{ name: 'Groceries', remarks: document.getElementById('groceryRemarks').value, price: -amount, quantity: 1 }],
        deliveryFee: 0, totalPrice: -amount, user_id: userId
    }]);
    e.target.reset();
    document.getElementById('groceryDate').value = new Date().toISOString().split('T')[0];
    fetchData();
};

window.generateSalesReport = () => {
    const m = parseInt(document.getElementById('reportMonth').value);
    const y = parseInt(document.getElementById('reportYear').value);
    let totalRev = 0, totalGroc = 0;
    const itemSales = {};

    orders.forEach(o => {
        const d = new Date(o.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            if(o.customerName === 'Admin') {
                totalGroc += Math.abs(o.totalPrice);
            } else {
                totalRev += Number(o.totalPrice);
                o.items.forEach(i => itemSales[i.name] = (itemSales[i.name] || 0) + (i.quantity || 1));
            }
        }
    });

    document.getElementById('totalSalesDisplay').innerText = `RM ${totalRev.toFixed(2)}`;
    document.getElementById('totalGroceriesDisplay').innerText = `RM ${totalGroc.toFixed(2)}`;
    document.getElementById('totalProfitDisplay').innerText = `RM ${(totalRev - totalGroc).toFixed(2)}`;

    const weeks = getWeeksInMonth(y, m);
    document.getElementById('weeklyBreakdown').innerHTML = weeks.map((week, idx) => {
        let wr = 0;
        orders.forEach(o => {
            if(o.customerName === 'Admin') return;
            const od = new Date(o.date);
            if (od >= week.start && od <= week.end) wr += Number(o.totalPrice);
        });
        return `<div class="bg-white p-4 rounded-2xl border text-center shadow-sm">
            <p class="text-pink-600 font-black text-[10px] uppercase">Week ${idx + 1}</p>
            <p class="text-xl font-black text-gray-800">RM ${wr.toFixed(2)}</p>
        </div>`;
    }).join('');

    document.getElementById('topSellingItemsList').innerHTML = Object.entries(itemSales).sort((a,b) => b[1]-a[1]).map(([n, q]) => `
        <li class="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm">
            <span class="font-bold text-gray-700">${n}</span>
            <span class="text-pink-600 font-black text-xs">${q} Sold</span>
        </li>`).join('');
};

function getWeeksInMonth(year, month) {
    const weeks = [];
    let d = new Date(year, month, 1);
    while (d.getMonth() === month) {
        let start = new Date(d);
        let end = new Date(d);
        end.setDate(end.getDate() + (6 - end.getDay()));
        if (end.getMonth() !== month) end = new Date(year, month + 1, 0);
        weeks.push({ start, end });
        d.setDate(end.getDate() + 1);
    }
    return weeks;
}

function setupSalesReportFilters() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const mSel = document.getElementById('reportMonth'), ySel = document.getElementById('reportYear');
    if(mSel) mSel.innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    if(ySel) {
        const yr = new Date().getFullYear();
        ySel.innerHTML = [yr, yr-1].map(y => `<option value="${y}">${y}</option>`).join('');
    }
}

window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date && o.customerName !== 'Admin');
    const container = document.getElementById('summaryDisplay');
    if (type === 'customer') {
        const grouped = filtered.reduce((acc, o) => { if (!acc[o.customerName]) acc[o.customerName] = []; acc[o.customerName].push(o); return acc; }, {});
        container.innerHTML = Object.entries(grouped).map(([name, custOrders]) => `
            <div class="p-6 bg-white rounded-3xl border-l-8 border-pink-500 shadow-sm">
                <h3 class="font-black text-gray-800 uppercase mb-3">${name}</h3>
                ${custOrders.map(o => `<div class="text-xs mb-1">${o.items.map(i => `• ${i.quantity}x ${i.name}`).join('<br>')}</div>`).join('')}
                <p class="text-pink-600 font-black text-right mt-3">RM ${custOrders.reduce((a, b) => a + b.totalPrice, 0).toFixed(2)}</p>
            </div>`).join('') || '<p class="col-span-2 text-center text-gray-400 py-10">No orders for this date.</p>';
    } else {
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + (i.quantity || 1)));
        container.innerHTML = Object.entries(counts).map(([n, q]) => `<div class="flex justify-between items-center bg-white p-5 rounded-2xl border font-black text-gray-700"><span>${n}</span><span class="text-pink-600 text-xl">${q}</span></div>`).join('') || '<p class="col-span-2 text-center text-gray-400 py-10">No prep needed.</p>';
    }
};

document.getElementById('menuForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('menus').insert([{ name: document.getElementById('menuName').value, price: parseFloat(document.getElementById('menuPrice').value), user_id: userId }]);
    e.target.reset();
};
window.openEditMenu = (id, name, price) => {
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('editNameInput').value = name;
    document.getElementById('editPriceInput').value = price;
    document.getElementById('modalConfirmBtn').onclick = async () => {
        await supabase.from('menus').update({ name: document.getElementById('editNameInput').value, price: parseFloat(document.getElementById('editPriceInput').value) }).eq('id', id);
        closeModal();
    };
};
window.closeModal = () => document.getElementById('modal').classList.add('hidden');
window.deleteMenuItem = async (id) => { if(confirm("Delete?")) await supabase.from('menus').delete().eq('id', id); };
window.deleteOrder = async (id) => { if(confirm("Delete?")) await supabase.from('orders').delete().eq('id', id); };
