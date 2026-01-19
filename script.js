// --- DATABASE INITIALIZATION ---
// We don't use 'const' here because Supabase script tag may already define it globally
supabase = window.supabase.createClient('https://jkzqplyvqeqegqhejppo.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8');

let userId = 'Ashikin';
let orders = [];
let menuItems = [];
window.currentSummaryType = 'customer';

// --- START APP ---
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('user-id-display').textContent = `User ID: ${userId}`;
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    document.getElementById('summaryDate').value = today;

    setupSalesReportFilters();
    await fetchData();
    
    // Realtime update
    supabase.channel('room1').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
});

async function fetchData() {
    const { data: o } = await supabase.from('orders').select('*').order('date', { ascending: false });
    const { data: m } = await supabase.from('menus').select('*').order('name');
    orders = o || [];
    menuItems = m || [];
    renderAll();
}

// --- TAB CONTROL ---
window.showSection = (id) => {
    // Hide all sections
    ['orderFormSection', 'ordersListSection', 'orderSummarySection', 'manageMenuSection', 'salesReportSection'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    // Show active section
    document.getElementById(id).classList.remove('hidden');

    // Update Nav Button Styles
    const navButtons = {
        'orderFormSection': 'navOrder', 'ordersListSection': 'navView',
        'orderSummarySection': 'navSummary', 'manageMenuSection': 'navMenu', 'salesReportSection': 'navSales'
    };

    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('btn-active');
        btn.classList.add('btn-secondary');
    });
    document.getElementById(navButtons[id]).classList.add('btn-active');
    document.getElementById(navButtons[id]).classList.remove('btn-secondary');

    if(id === 'salesReportSection') generateSalesReport();
    if(id === 'orderSummarySection') renderOrderSummary(window.currentSummaryType);
};

// --- RENDERING ---
function renderAll() {
    // 1. Order Form Checkboxes
    const menuItemsEl = document.getElementById('menuItems');
    menuItemsEl.innerHTML = menuItems.map(item => `
        <label class="flex items-center justify-between p-2 border-b last:border-0 cursor-pointer hover:bg-white transition">
            <span class="flex items-center gap-3">
                <input type="checkbox" class="menu-item-checkbox w-5 h-5 accent-pink-600" data-price="${item.price}" data-name="${item.name}" onchange="calculateTotalPrice()">
                <span class="font-medium">${item.name}</span>
            </span>
            <span class="text-pink-600 font-bold">RM ${Number(item.price).toFixed(2)}</span>
        </label>
    `).join('');

    // 2. Manage Menu Grid
    const menuListEl = document.getElementById('menuList');
    menuListEl.innerHTML = menuItems.map(item => `
        <div class="bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center">
            <div><p class="font-bold">${item.name}</p><p class="text-pink-600">RM ${Number(item.price).toFixed(2)}</p></div>
            <div class="flex flex-col gap-1">
                <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price})" class="text-xs text-blue-500 font-bold">Edit</button>
                <button onclick="deleteMenuItem('${item.id}')" class="text-xs text-red-400 font-bold">Delete</button>
            </div>
        </div>
    `).join('');

    // 3. History Table
    const tableBody = document.getElementById('ordersTableBody');
    tableBody.innerHTML = orders.map(o => `
        <tr>
            <td>${o.date}</td>
            <td class="font-bold">${o.customerName}</td>
            <td class="text-xs text-gray-500">${o.items ? o.items.map(i => i.name).join(', ') : ''}</td>
            <td>RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="font-bold text-pink-600">RM ${Number(o.totalPrice).toFixed(2)}</td>
            <td><button onclick="deleteOrder('${o.id}')" class="text-red-400 font-bold text-xs">Delete</button></td>
        </tr>
    `).join('');
}

// --- LOGIC FUNCTIONS ---
window.calculateTotalPrice = () => {
    let subtotal = 0;
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(cb => subtotal += parseFloat(cb.dataset.price));
    const delivery = parseFloat(document.getElementById('deliveryFee').value || 0);
    document.getElementById('totalPriceDisplay').innerText = `RM ${(subtotal + delivery).toFixed(2)}`;
};

document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    const items = Array.from(document.querySelectorAll('.menu-item-checkbox:checked')).map(cb => ({ name: cb.dataset.name, price: parseFloat(cb.dataset.price) }));
    if(!items.length) return alert("Select an item");
    const delivery = parseFloat(document.getElementById('deliveryFee').value || 0);
    const total = items.reduce((s, i) => s + i.price, 0) + delivery;

    await supabase.from('orders').insert([{
        customerName: document.getElementById('customerName').value,
        date: document.getElementById('orderDate').value,
        items, deliveryFee: delivery, totalPrice: total, user_id: userId
    }]);
    e.target.reset();
    calculateTotalPrice();
    alert("Order Submitted!");
};

document.getElementById('menuForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('menuName').value;
    const price = parseFloat(document.getElementById('menuPrice').value);
    await supabase.from('menus').insert([{ name, price, user_id: userId }]);
    e.target.reset();
};

window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date);
    const container = document.getElementById('summaryDisplay');
    
    if (type === 'customer') {
        container.innerHTML = filtered.length ? filtered.map(o => `
            <div class="p-4 bg-gray-50 rounded-lg border-l-4 border-pink-500">
                <p class="font-bold text-lg">${o.customerName}</p>
                <p class="text-gray-600">${o.items.map(i => i.name).join(', ')}</p>
                <p class="text-sm font-bold mt-1">Total: RM ${Number(o.totalPrice).toFixed(2)} (Incl. RM ${o.deliveryFee} delivery)</p>
            </div>
        `).join('') : "No orders for this date.";
    } else {
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + 1));
        container.innerHTML = Object.keys(counts).length ? Object.entries(counts).map(([n, q]) => `
            <div class="flex justify-between border-b py-2">
                <span>${n}</span><span class="font-black text-pink-600">${q} QTY</span>
            </div>
        `).join('') : "No prep items.";
    }
};

function setupSalesReportFilters() {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const mSel = document.getElementById('reportMonth');
    const ySel = document.getElementById('reportYear');
    mSel.innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    const yr = new Date().getFullYear();
    ySel.innerHTML = [yr, yr-1].map(y => `<option value="${y}">${y}</option>`).join('');
}

window.generateSalesReport = () => {
    const m = parseInt(document.getElementById('reportMonth').value);
    const y = parseInt(document.getElementById('reportYear').value);
    let total = 0;
    const counts = {};

    orders.forEach(o => {
        const d = new Date(o.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            total += Number(o.totalPrice);
            o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + 1);
        }
    });

    document.getElementById('totalSalesDisplay').innerText = `RM ${total.toFixed(2)}`;
    document.getElementById('topSellingItemsList').innerHTML = Object.entries(counts).map(([n, q]) => `
        <li class="flex justify-between"><span>${n}</span><b>${q} units</b></li>
    `).join('');
};

window.openEditMenu = (id, name, price) => {
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('editNameInput').value = name;
    document.getElementById('editPriceInput').value = price;
    document.getElementById('modalConfirmBtn').onclick = async () => {
        await supabase.from('menus').update({ 
            name: document.getElementById('editNameInput').value, 
            price: parseFloat(document.getElementById('editPriceInput').value) 
        }).eq('id', id);
        closeModal();
    };
};

window.closeModal = () => document.getElementById('modal').classList.add('hidden');
window.deleteMenuItem = async (id) => { if(confirm("Delete menu item?")) await supabase.from('menus').delete().eq('id', id); };
window.deleteOrder = async (id) => { if(confirm("Delete order?")) await supabase.from('orders').delete().eq('id', id); };
