// --- DATABASE CONFIGURATION ---
var DB_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
var DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8'; 

var supabase = window.supabase.createClient(DB_URL, DB_KEY);

let userId = 'Ashikin';
let orders = [];
let menuItems = [];
window.currentSummaryType = 'customer';

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    ['orderDate', 'summaryDate', 'groceryDate', 'orderViewDate'].forEach(id => {
        if(document.getElementById(id)) document.getElementById(id).value = today;
    });
    setupSalesReportFilters();
    await fetchData();
    
    // Real-time listener
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
    renderOverallPerformance();
}

// --- NAVIGATION ---
function showSection(id) {
    ['orderFormSection', 'ordersListSection', 'orderSummarySection', 'manageMenuSection', 'salesReportSection'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    updateNavButtons(id);
}

function updateNavButtons(activeId) {
    const navMap = {
        'orderFormSection': 'navOrder', 
        'ordersListSection': 'navView', 
        'orderSummarySection': 'navSummary', 
        'manageMenuSection': 'navMenu', 
        'salesReportSection': 'navSales'
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

// --- RENDER LOGIC ---
function renderAll() {
    const menuItemsEl = document.getElementById('menuItems');
    if (menuItemsEl) {
        const activeMenus = menuItems.filter(m => m.status === 'Active').sort((a,b) => a.name.localeCompare(b.name));
        
        const renderGroup = (cat) => activeMenus.filter(m => m.category === cat).map(m => `
            <div class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" class="menu-item-checkbox w-5 h-5 accent-pink-500" data-price="${m.price}" data-name="${m.name}" data-category="${m.category}" onchange="calculateTotalPrice()">
                    <span class="font-bold text-gray-700">${m.name}</span>
                </label>
                <input type="number" value="1" min="1" class="qty-input w-12 text-center font-black text-pink-600 bg-gray-100 rounded-lg p-1" oninput="calculateTotalPrice()">
            </div>`).join('');

        menuItemsEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><h4 class="font-bold text-xs text-pink-400 uppercase mb-2">Main Menu</h4><div class="space-y-2">${renderGroup('Main Menu')}</div></div>
                <div><h4 class="font-bold text-xs text-blue-400 uppercase mb-2">Add On</h4><div class="space-y-2">${renderGroup('Add On')}</div></div>
            </div>
            <div class="mt-6">
                <h4 class="font-bold text-xs text-orange-400 uppercase mb-2">Student Menu</h4>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2">${renderGroup('Student Menu')}</div>
            </div>
        `;
    }

    const sortedMenu = [...menuItems].sort((a,b) => a.name.localeCompare(b.name));
    const categories = {'Main Menu': 'list-main', 'Add On': 'list-addon', 'Student Menu': 'list-student'};
    
    Object.values(categories).forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = '';
    });

    sortedMenu.forEach(item => {
        const isInactive = item.status === 'Inactive';
        const html = `
            <div class="p-4 rounded-2xl border flex items-center justify-between ${isInactive ? 'grayscale-card' : 'bg-white border-pink-100 shadow-sm'}">
                <div>
                    <p class="font-bold">${item.name}</p>
                    <p class="text-xs font-medium text-pink-500">RM ${Number(item.price).toFixed(2)}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleStatus('${item.id}', '${item.status}')" class="px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isInactive ? 'bg-gray-300' : 'bg-green-500 text-white'}">
                        ${item.status}
                    </button>
                    <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price}, '${item.category}')" class="text-blue-500 text-[10px] font-bold uppercase p-1">Edit</button>
                    <button onclick="deleteMenuItem('${item.id}')" class="text-red-300 hover:text-red-500 text-[10px] font-bold uppercase p-1">Del</button>
                </div>
            </div>`;
        const listEl = document.getElementById(categories[item.category]);
        if(listEl) listEl.innerHTML += html;
    });

    renderOrdersTable();
}

function renderOrdersTable() {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;

    const searchQuery = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const filterDate = document.getElementById('orderViewDate')?.value || '';
    
    const filtered = orders.filter(o => {
        const matchesSearch = o.customerName.toLowerCase().includes(searchQuery);
        return searchQuery.length > 0 ? matchesSearch : o.date === filterDate;
    });

    tableBody.innerHTML = filtered.map(o => {
        const isExpense = o.customerName === 'Admin';
        const itemsDisplay = o.items ? o.items.map(i => `<div class="text-[11px] font-bold text-gray-700">${i.quantity}x ${i.name}</div>`).join('') : '';

        return `<tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-[10px] text-gray-400 font-bold">${o.date}</td>
            <td class="p-4 font-bold text-gray-800">${o.customerName}</td>
            <td class="p-4">${itemsDisplay}</td>
            <td class="p-4 font-bold text-gray-400">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="p-4 font-black ${isExpense ? 'text-red-500' : 'text-pink-600'}">RM ${Math.abs(o.totalPrice).toFixed(2)}</td>
            <td class="p-4 text-center">
                <button onclick="deleteOrder('${o.id}')" class="text-gray-300 hover:text-red-500 font-bold text-[10px] uppercase">Delete</button>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="p-10 text-center text-gray-400">No records found.</td></tr>';
}

function calculateTotalPrice() {
    let subtotal = 0;
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(cb => {
        const qty = cb.closest('div').querySelector('.qty-input').value;
        subtotal += parseFloat(cb.dataset.price) * (parseInt(qty) || 1);
    });
    const del = parseFloat(document.getElementById('deliveryFee').value || 0);
    document.getElementById('totalPriceDisplay').innerText = `RM ${(subtotal + del).toFixed(2)}`;
}

document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    const selected = [];
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(cb => {
        const qty = cb.closest('div').querySelector('.qty-input').value;
        selected.push({ name: cb.dataset.name, price: parseFloat(cb.dataset.price), quantity: parseInt(qty) || 1, category: cb.dataset.category });
    });
    if(!selected.length) return alert("Select an item");
    const del = parseFloat(document.getElementById('deliveryFee').value || 0);
    const sub = selected.reduce((a, i) => a + (i.price * i.quantity), 0);
    await supabase.from('orders').insert([{ customerName: document.getElementById('customerName').value, date: document.getElementById('orderDate').value, items: selected, deliveryFee: del, totalPrice: sub + del, user_id: userId }]);
    e.target.reset();
    calculateTotalPrice();
};

document.getElementById('groceryForm').onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('groceryAmount').value);
    await supabase.from('orders').insert([{ customerName: 'Admin', date: document.getElementById('groceryDate').value, items: [{ name: 'Groceries', remarks: document.getElementById('groceryRemarks').value, price: -amount, quantity: 1, category: 'Main Menu' }], deliveryFee: 0, totalPrice: -amount, user_id: userId }]);
    e.target.reset();
    fetchData();
};

document.getElementById('menuForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('menus').insert([{ name: document.getElementById('menuName').value, price: parseFloat(document.getElementById('menuPrice').value), category: document.getElementById('menuCategory').value, status: 'Active', user_id: userId }]);
    e.target.reset();
    fetchData();
};

async function toggleStatus(id, current) {
    const nextStatus = (current === 'Active') ? 'Inactive' : 'Active';
    await supabase.from('menus').update({ status: nextStatus }).eq('id', id);
    fetchData();
}

window.openEditMenu = (id, name, price, cat) => {
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('editNameInput').value = name;
    document.getElementById('editPriceInput').value = price;
    document.getElementById('editCategoryInput').value = cat;
    document.getElementById('modalConfirmBtn').onclick = async () => {
        await supabase.from('menus').update({ name: document.getElementById('editNameInput').value, price: parseFloat(document.getElementById('editPriceInput').value), category: document.getElementById('editCategoryInput').value }).eq('id', id);
        closeModal();
        fetchData();
    };
};

function closeModal() { document.getElementById('modal').classList.add('hidden'); }
async function deleteMenuItem(id) { if(confirm("Delete?")) await supabase.from('menus').delete().eq('id', id); }
async function deleteOrder(id) { if(confirm("Delete?")) await supabase.from('orders').delete().eq('id', id); }

function setupSalesReportFilters() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    document.getElementById('reportMonth').innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    const yr = new Date().getFullYear();
    document.getElementById('reportYear').innerHTML = [yr, yr-1].map(y => `<option value="${y}">${y}</option>`).join('');
}

function generateSalesReport() {
    const m = parseInt(document.getElementById('reportMonth').value);
    const y = parseInt(document.getElementById('reportYear').value);
    let totalRev = 0, totalGroc = 0;
    orders.forEach(o => {
        const d = new Date(o.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            if(o.customerName === 'Admin') totalGroc += Math.abs(o.totalPrice);
            else totalRev += Number(o.totalPrice);
        }
    });
    document.getElementById('totalSalesDisplay').innerText = `RM ${totalRev.toFixed(2)}`;
    document.getElementById('totalGroceriesDisplay').innerText = `RM ${totalGroc.toFixed(2)}`;
    document.getElementById('totalProfitDisplay').innerText = `RM ${(totalRev - totalGroc).toFixed(2)}`;
}

function renderOverallPerformance() {
    const counts = {};
    orders.forEach(o => { if(o.customerName !== 'Admin' && o.items) o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + i.quantity); });
    const list = document.getElementById('topSellingItemsList');
    if(list) list.innerHTML = Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([n, q]) => `<li class="flex justify-between p-3 bg-white rounded-xl shadow-sm border-l-4 border-pink-400"><span class="font-bold text-gray-700">${n}</span><span class="text-pink-600 font-black">${q} Sold</span></li>`).join('');
}

// --- SUMMARY LOGIC (FIXED) ---
window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date && o.customerName !== 'Admin');
    const container = document.getElementById('summaryDisplay');
    
    // UI: Toggle active button state
    const btnCust = document.getElementById('btnSumCust');
    const btnItem = document.getElementById('btnSumItem');

    if (type === 'customer') {
        btnCust.classList.replace('btn-secondary', 'btn-active');
        btnItem.classList.replace('btn-active', 'btn-secondary');
        
        const grouped = filtered.reduce((acc, o) => { if (!acc[o.customerName]) acc[o.customerName] = []; acc[o.customerName].push(o); return acc; }, {});
        container.innerHTML = Object.entries(grouped).map(([name, custOrders]) => `
            <div class="p-6 bg-white rounded-3xl border shadow-sm border-l-8 border-pink-500">
                <h3 class="font-black text-gray-800 mb-3 uppercase tracking-tighter">${name}</h3>
                ${custOrders.map(o => o.items.map(i => `<div class="text-xs font-bold text-gray-600 mb-1">• ${i.quantity}x ${i.name}</div>`).join('')).join('')}
                <div class="text-right mt-2 pt-2 border-t font-black text-pink-600">RM ${custOrders.reduce((a, b) => a + b.totalPrice, 0).toFixed(2)}</div>
            </div>`).join('') || '<p class="col-span-2 text-center text-gray-400 py-10">No orders.</p>';
    } else {
        btnItem.classList.replace('btn-secondary', 'btn-active');
        btnCust.classList.replace('btn-active', 'btn-secondary');

        const counts = {};
        filtered.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + i.quantity));
        container.innerHTML = Object.entries(counts).map(([n, q]) => `<div class="bg-white p-5 rounded-2xl border flex justify-between shadow-sm"><b class="text-gray-700">${n}</b><span class="text-pink-600 font-black text-xl">${q}</span></div>`).join('') || '<p class="col-span-2 text-center text-gray-400 py-10">No items.</p>';
    }
};
