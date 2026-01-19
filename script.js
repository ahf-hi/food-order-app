// --- CONFIG ---
const SUPABASE_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let userId = 'Ashikin';
let orders = [];
let menuItems = [];
window.currentSummaryType = 'customer';

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    document.getElementById('summaryDate').value = today;
    document.getElementById('user-id-display').textContent = `User ID: ${userId}`;

    setupSalesReportFilters();
    await fetchData();
    setupRealtime();
});

async function fetchData() {
    const { data: o } = await supabase.from('orders').select('*').order('date', { ascending: false });
    const { data: m } = await supabase.from('menus').select('*').order('name');
    orders = o || [];
    menuItems = m || [];
    renderAll();
}

function setupRealtime() {
    supabase.channel('any').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
}

// --- NAV & TABS ---
window.showSection = (id) => {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    
    // Style buttons
    const btns = { 'orderFormSection': 'navOrder', 'ordersListSection': 'navView', 'orderSummarySection': 'navSummary', 'manageMenuSection': 'navMenu', 'salesReportSection': 'navSales' };
    document.querySelectorAll('nav button').forEach(b => { b.classList.remove('bg-orange-500', 'text-white'); b.classList.add('bg-gray-200', 'text-gray-700'); });
    document.getElementById(btns[id]).classList.add('bg-orange-500', 'text-white');

    if(id === 'salesReportSection') generateSalesReport();
    if(id === 'orderSummarySection') renderOrderSummary(window.currentSummaryType);
};

// --- RENDERERS ---
function renderAll() {
    renderMenuCheckboxes();
    renderManageMenu();
    renderOrdersTable();
}

function renderMenuCheckboxes() {
    const container = document.getElementById('menuItems');
    container.innerHTML = menuItems.map(item => `
        <div class="flex items-center justify-between p-2 border-b last:border-0">
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" class="menu-item-checkbox w-5 h-5 accent-orange-500" data-price="${item.price}" data-name="${item.name}" onchange="calculateTotalPrice()">
                <span>${item.name}</span>
            </label>
            <span class="text-gray-500">RM ${Number(item.price).toFixed(2)}</span>
        </div>
    `).join('');
}

function renderManageMenu() {
    const container = document.getElementById('menuList');
    container.innerHTML = menuItems.map(item => `
        <div class="bg-gray-50 p-4 rounded-lg flex justify-between items-center border">
            <div><p class="font-bold">${item.name}</p><p class="text-sm text-green-600">RM ${Number(item.price).toFixed(2)}</p></div>
            <div class="flex gap-2">
                <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price})" class="text-blue-600 font-bold">Edit</button>
                <button onclick="deleteMenuItem('${item.id}')" class="text-red-500 font-bold">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderOrdersTable() {
    const body = document.getElementById('ordersTableBody');
    body.innerHTML = orders.map(o => `
        <tr class="hover:bg-gray-50 border-b text-sm">
            <td class="p-3">${o.date}</td>
            <td class="p-3 font-bold">${o.customerName}</td>
            <td class="p-3 text-gray-600">${o.items.map(i => i.name).join(', ')}</td>
            <td class="p-3 text-gray-500">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="p-3 font-bold text-pink-600">RM ${Number(o.totalPrice).toFixed(2)}</td>
            <td class="p-3"><button onclick="deleteOrder('${o.id}')" class="text-red-400">Delete</button></td>
        </tr>
    `).join('');
}

// --- ORDER SUMMARY ---
window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date);
    const container = document.getElementById('summaryDisplay');
    
    if (type === 'customer') {
        container.innerHTML = filtered.length ? filtered.map(o => `
            <div class="mb-4 p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                <p class="font-bold text-lg text-blue-800">${o.customerName}</p>
                <p class="text-gray-600">Items: ${o.items.map(i => i.name).join(', ')}</p>
                <p class="text-sm font-bold mt-1">Total: RM ${Number(o.totalPrice).toFixed(2)}</p>
            </div>
        `).join('') : "No orders for this date.";
    } else {
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + 1));
        container.innerHTML = Object.keys(counts).length ? Object.entries(counts).map(([name, qty]) => `
            <div class="flex justify-between border-b py-3 px-2">
                <span class="font-medium">${name}</span>
                <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">QTY: ${qty}</span>
            </div>
        `).join('') : "Nothing to prepare.";
    }
};

// --- SALES REPORT ---
function setupSalesReportFilters() {
    const mSel = document.getElementById('reportMonth');
    const ySel = document.getElementById('reportYear');
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    mSel.innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    const yr = new Date().getFullYear();
    ySel.innerHTML = [yr, yr-1, yr-2].map(y => `<option value="${y}">${y}</option>`).join('');
}

window.generateSalesReport = () => {
    const m = parseInt(document.getElementById('reportMonth').value);
    const y = parseInt(document.getElementById('reportYear').value);
    let total = 0;
    const itemSales = {};

    orders.forEach(o => {
        const d = new Date(o.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            total += Number(o.totalPrice);
            o.items.forEach(i => itemSales[i.name] = (itemSales[i.name] || 0) + 1);
        }
    });

    document.getElementById('totalSalesDisplay').innerText = `RM ${total.toFixed(2)}`;
    document.getElementById('topSellingItemsList').innerHTML = Object.entries(itemSales)
        .sort((a,b) => b[1]-a[1]).map(([n, c]) => `<li class="flex justify-between p-2 bg-gray-50 rounded"><span>${n}</span><b>${c} sold</b></li>`).join('');
};

// --- ACTIONS & MODALS ---
window.calculateTotalPrice = () => {
    let sub = 0;
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(cb => sub += parseFloat(cb.dataset.price));
    const del = parseFloat(document.getElementById('deliveryFee').value || 0);
    document.getElementById('totalPriceDisplay').innerText = `RM ${(sub + del).toFixed(2)}`;
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
    alert("Order Saved!");
};

document.getElementById('menuForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('menuName').value;
    const price = parseFloat(document.getElementById('menuPrice').value);
    await supabase.from('menus').insert([{ name, price, user_id: userId }]);
    e.target.reset();
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
window.deleteMenuItem = async (id) => { if(confirm("Delete menu?")) await supabase.from('menus').delete().eq('id', id); };
window.deleteOrder = async (id) => { if(confirm("Delete order?")) await supabase.from('orders').delete().eq('id', id); };
