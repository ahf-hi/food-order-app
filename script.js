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
    
    setupSalesReportFilters(); // Now defined below
    await fetchData();
    
    // Real-time listener
    supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
    showSection('orderFormSection');
});

// --- CORE FUNCTIONS ---
async function fetchData() {
    const { data: o } = await supabase.from('orders').select('*').order('date', { ascending: false });
    const { data: m } = await supabase.from('menus').select('*').order('name');
    orders = o || [];
    menuItems = m || [];
    renderAll();
    generateSalesReport();
}

function showNotification(message) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function showSection(id) {
    ['orderFormSection', 'ordersListSection', 'orderSummarySection', 'manageMenuSection', 'salesReportSection'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
    updateNavButtons(id);
    if(id === 'orderSummarySection') renderOrderSummary(window.currentSummaryType);
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

// --- RENDERING ---
function formatItemName(item) {
    if (item.name === 'Groceries') return item.remarks; 
    let name = item.name;
    if (item.category === 'Add On') name += ' (Add On)';
    else if (item.category === 'Student Menu') name += ' (Student)';
    return name;
}

function renderAll() {
    const menuItemsEl = document.getElementById('menuItems');
    if (menuItemsEl) {
        const activeMenus = menuItems.filter(m => m.status === 'Active');
        const renderGroup = (cat) => activeMenus.filter(m => m.category === cat).map(m => `
            <div class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm">
                <label class="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" class="menu-item-checkbox w-5 h-5 accent-pink-500" data-price="${m.price}" data-name="${m.name}" data-category="${m.category}" onchange="calculateTotalPrice()">
                    <span class="font-bold text-gray-700 text-sm">${m.name}</span>
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
            </div>`;
    }
    renderOrdersTable();
    renderMenuManagement();
}

function renderMenuManagement() {
    const categories = {'Main Menu': 'list-main', 'Add On': 'list-addon', 'Student Menu': 'list-student'};
    Object.values(categories).forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = ''; });

    menuItems.forEach(item => {
        const isInactive = item.status === 'Inactive';
        const html = `
            <div class="p-4 rounded-2xl border flex items-center justify-between ${isInactive ? 'grayscale-card' : 'bg-white border-pink-100 shadow-sm'}">
                <div><p class="font-bold">${item.name}</p><p class="text-xs font-medium text-pink-500">RM ${Number(item.price).toFixed(2)}</p></div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleStatus('${item.id}', '${item.status}')" class="px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isInactive ? 'bg-gray-300' : 'bg-green-500 text-white'}">${item.status}</button>
                    <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price}, '${item.category}')" class="text-blue-500 text-[10px] font-bold p-1">Edit</button>
                    <button onclick="deleteMenuItem('${item.id}')" class="text-red-300 hover:text-red-500 text-[10px] font-bold p-1">Del</button>
                </div>
            </div>`;
        const listEl = document.getElementById(categories[item.category]);
        if(listEl) listEl.innerHTML += html;
    });
}

function renderOrdersTable() {
    const tableBody = document.getElementById('ordersTableBody');
    if (!tableBody) return;
    const searchQuery = document.getElementById('orderSearch')?.value.toLowerCase() || '';
    const filterDate = document.getElementById('orderViewDate')?.value || '';
    
    const filtered = orders.filter(o => {
        const itemsText = o.items ? o.items.map(i => formatItemName(i)).join(' ').toLowerCase() : '';
        const matchesSearch = o.customerName.toLowerCase().includes(searchQuery) || itemsText.includes(searchQuery);
        return searchQuery.length > 0 ? matchesSearch : o.date === filterDate;
    });

    tableBody.innerHTML = filtered.map(o => `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-[10px] text-gray-400 font-bold">${o.date}</td>
            <td class="p-4 font-bold text-gray-800">${o.customerName} <span class="text-[9px] text-gray-400 block">${o.deliveryType || 'Lunch'}</span></td>
            <td class="p-4">${(o.items||[]).map(i => `<div class="text-[11px] font-bold">${i.quantity}x ${formatItemName(i)}</div>`).join('')}</td>
            <td class="p-4 font-bold text-gray-400">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="p-4 font-black ${o.customerName === 'Groceries' ? 'text-red-500' : 'text-pink-600'}">RM ${Math.abs(o.totalPrice).toFixed(2)}</td>
            <td class="p-4 text-center"><button onclick="deleteOrder('${o.id}')" class="text-gray-300 hover:text-red-500 font-bold text-[10px]">DELETE</button></td>
        </tr>`).join('') || '<tr><td colspan="6" class="p-10 text-center text-gray-400">No records found.</td></tr>';
}

// --- FORM HANDLERS ---
function calculateTotalPrice() {
    let subtotal = 0;
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(cb => {
        const qty = parseInt(cb.closest('div').querySelector('.qty-input').value) || 1;
        subtotal += parseFloat(cb.dataset.price) * qty;
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
    
    await supabase.from('orders').insert([{ 
        customerName: document.getElementById('customerName').value, 
        date: document.getElementById('orderDate').value, 
        items: selected, 
        deliveryFee: del, 
        totalPrice: sub + del, 
        user_id: userId,
        remarks: document.getElementById('orderRemarks')?.value || '',
        deliveryType: document.getElementById('deliveryType')?.value || 'Lunch'
    }]);

    showNotification("Order added!");
    e.target.reset();
    calculateTotalPrice();
    fetchData();
};

// --- SETTINGS & REPORTS ---
function setupSalesReportFilters() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const monthSelect = document.getElementById('reportMonth');
    if(monthSelect) {
        monthSelect.innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    }
    const yearSelect = document.getElementById('reportYear');
    if(yearSelect) {
        const yr = new Date().getFullYear();
        yearSelect.innerHTML = [yr, yr-1].map(y => `<option value="${y}">${y}</option>`).join('');
    }
}

function generateSalesReport() {
    const m = parseInt(document.getElementById('reportMonth').value);
    const y = parseInt(document.getElementById('reportYear').value);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    let totalRev = 0, totalGroc = 0;
    const weeklyData = [];
    const menuStats = {}; 
    const lastDate = new Date(y, m + 1, 0).getDate();
    
    let currentDay = 1;
    while (currentDay <= lastDate) {
        let startDate = currentDay;
        let dateObj = new Date(y, m, currentDay);
        let dayOfWeek = dateObj.getDay(); 
        let daysUntilSaturday = 6 - dayOfWeek;
        let endDate = Math.min(currentDay + daysUntilSaturday, lastDate);
        weeklyData.push({ start: startDate, end: endDate, rev: 0 });
        currentDay = endDate + 1;
    }

    orders.forEach(o => {
        const d = new Date(o.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            const day = d.getDate();
            const amt = Number(o.totalPrice);
            if (o.customerName === 'Groceries') {
                totalGroc += Math.abs(amt);
            } else {
                totalRev += amt;
                const weekIdx = weeklyData.findIndex(w => day >= w.start && day <= w.end);
                if (weekIdx !== -1) weeklyData[weekIdx].rev += amt;
                if (o.items) {
                    o.items.forEach(item => {
                        const name = formatItemName(item);
                        if (!menuStats[name]) menuStats[name] = { qty: 0, revenue: 0 };
                        menuStats[name].qty += item.quantity;
                        menuStats[name].revenue += (item.quantity * item.price);
                    });
                }
            }
        }
    });

    document.getElementById('totalSalesDisplay').innerText = `RM ${totalRev.toFixed(2)}`;
    document.getElementById('totalGroceriesDisplay').innerText = `RM ${totalGroc.toFixed(2)}`;
    document.getElementById('totalProfitDisplay').innerText = `RM ${(totalRev - totalGroc).toFixed(2)}`;

    const weeklyContainer = document.getElementById('weeklyReportContainer');
    if(weeklyContainer) {
        weeklyContainer.innerHTML = weeklyData.map((w, idx) => `
            <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
                <p class="text-[10px] font-bold text-gray-400 uppercase mb-1">Week ${idx + 1}</p>
                <p class="text-[11px] font-semibold text-pink-500 mb-3">${w.start} ${monthNames[m]} - ${w.end} ${monthNames[m]}</p>
                <p class="text-xl font-black text-gray-800">RM ${w.rev.toFixed(2)}</p>
            </div>`).join('');
    }
}

window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date && o.customerName !== 'Groceries');
    const container = document.getElementById('summaryDisplay');
    
    if (type === 'customer') {
        const groups = { Lunch: filtered.filter(o => (o.deliveryType || 'Lunch') === 'Lunch'), Dinner: filtered.filter(o => o.deliveryType === 'Dinner') };
        container.innerHTML = Object.entries(groups).map(([title, list]) => {
            if (list.length === 0) return '';
            return `
            <div class="bg-pink-600 p-6 rounded-[2rem] shadow-xl col-span-1 md:col-span-2 mb-6">
                <h2 class="text-white text-xl font-extrabold mb-6 uppercase tracking-widest">${title} SESSION</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${list.map(o => `
                        <div class="bg-white p-5 rounded-2xl shadow-sm">
                            <h3 class="font-black text-gray-800 uppercase text-sm mb-1">${o.customerName}</h3>
                            ${o.remarks ? `<p class="bg-pink-50 text-pink-600 text-[10px] p-2 rounded-lg font-bold mb-2">"${o.remarks}"</p>` : ''}
                            <div class="space-y-1">
                                ${o.items.map(i => `<div class="text-[11px] text-gray-500 font-medium"><span>• ${i.quantity}x ${formatItemName(i)}</span></div>`).join('')}
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
        }).join('') || '<p class="text-center text-gray-400 py-10">No orders.</p>';
    } else {
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => { const n = formatItemName(i); counts[n] = (counts[n] || 0) + i.quantity; }));
        container.innerHTML = Object.entries(counts).map(([n, q]) => `
            <div class="bg-white p-5 rounded-2xl border flex justify-between">
                <b class="text-gray-700 text-sm">${n}</b>
                <span class="text-pink-600 font-black text-xl">${q}</span>
            </div>`).join('');
    }
};

// --- MENU & ORDER HELPERS ---
async function toggleStatus(id, current) {
    const nextStatus = (current === 'Active') ? 'Inactive' : 'Active';
    await supabase.from('menus').update({ status: nextStatus }).eq('id', id);
    fetchData();
}

async function deleteOrder(id) { 
    if(confirm("Delete record?")) { await supabase.from('orders').delete().eq('id', id); fetchData(); }
}

async function deleteMenuItem(id) { 
    if(confirm("Delete menu?")) { await supabase.from('menus').delete().eq('id', id); fetchData(); }
}

window.openEditMenu = (id, name, price, cat) => {
    document.getElementById('modal').classList.remove('hidden');
    document.getElementById('editNameInput').value = name;
    document.getElementById('editPriceInput').value = price;
    document.getElementById('editCategoryInput').value = cat;
    document.getElementById('modalConfirmBtn').onclick = async () => {
        await supabase.from('menus').update({ 
            name: document.getElementById('editNameInput').value, 
            price: parseFloat(document.getElementById('editPriceInput').value), 
            category: document.getElementById('editCategoryInput').value 
        }).eq('id', id);
        document.getElementById('modal').classList.add('hidden');
        fetchData();
    };
};

function closeModal() { document.getElementById('modal').classList.add('hidden'); }
