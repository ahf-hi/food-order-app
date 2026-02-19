var DB_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
var DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8'; 
var supabase = window.supabase.createClient(DB_URL, DB_KEY);

let userId = 'Ashikin';
let orders = [];
let menuItems = [];
window.currentSummaryType = 'customer';

// Notifications
function showNotification(message) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
}

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

function formatItemName(item) {
    if (item.name === 'Groceries') return item.remarks;
    return item.name + (item.category === 'Add On' ? ' (Add On)' : item.category === 'Student Menu' ? ' (Student)' : '');
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
    const navMap = {'orderFormSection':'navOrder','ordersListSection':'navView','orderSummarySection':'navSummary','manageMenuSection':'navMenu','salesReportSection':'navSales'};
    document.querySelectorAll('nav button').forEach(btn => {
        btn.classList.remove('btn-active');
        btn.classList.add('btn-secondary');
    });
    const activeBtn = document.getElementById(navMap[activeId]);
    if (activeBtn) { activeBtn.classList.add('btn-active'); activeBtn.classList.remove('btn-secondary'); }
}

function renderAll() {
    const menuItemsEl = document.getElementById('menuItems');
    if (menuItemsEl) {
        const activeMenus = menuItems.filter(m => m.status === 'Active');
        const renderGroup = (cat) => activeMenus.filter(m => m.category === cat).map(m => `
            <div class="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm mb-2">
                <label class="flex items-center gap-3 cursor-pointer flex-1">
                    <input type="checkbox" class="menu-item-checkbox w-5 h-5 accent-pink-500" data-price="${m.price}" data-name="${m.name}" data-category="${m.category}" onchange="calculateTotalPrice()">
                    <span class="font-bold text-gray-700 text-sm">${m.name}</span>
                </label>
                <input type="number" value="1" min="1" class="qty-input w-12 text-center font-black text-pink-600 bg-gray-100 rounded-lg p-1" oninput="calculateTotalPrice()">
            </div>`).join('');

        menuItemsEl.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><h4 class="font-bold text-[10px] text-pink-400 uppercase mb-2">Main Menu</h4>${renderGroup('Main Menu')}</div>
                <div><h4 class="font-bold text-[10px] text-blue-400 uppercase mb-2">Add Ons</h4>${renderGroup('Add On')}</div>
            </div>
            <div class="mt-4"><h4 class="font-bold text-[10px] text-orange-400 uppercase mb-2">Student specials</h4>
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
                <div><p class="font-bold text-sm">${item.name}</p><p class="text-xs font-medium text-pink-500">RM ${Number(item.price).toFixed(2)}</p></div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleStatus('${item.id}', '${item.status}')" class="px-2 py-1 rounded-lg text-[9px] font-black uppercase ${isInactive ? 'bg-gray-300' : 'bg-green-500 text-white'}">${item.status}</button>
                    <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price}, '${item.category}')" class="text-blue-500 text-[10px] font-bold">Edit</button>
                    <button onclick="deleteMenuItem('${item.id}')" class="text-red-300 hover:text-red-500 text-[10px] font-bold">Del</button>
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
            <td class="p-4 text-gray-400 font-bold">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="p-4 font-black ${o.customerName === 'Groceries' ? 'text-red-500' : 'text-pink-600'}">RM ${Math.abs(o.totalPrice).toFixed(2)}</td>
            <td class="p-4 text-center"><button onclick="deleteOrder('${o.id}')" class="text-gray-300 hover:text-red-500 font-bold text-[10px]">DELETE</button></td>
        </tr>`).join('') || '<tr><td colspan="6" class="p-10 text-center text-gray-400">No records found.</td></tr>';
}

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
    if(!selected.length) return alert("Please select food items.");
    const del = parseFloat(document.getElementById('deliveryFee').value || 0);
    const sub = selected.reduce((a, i) => a + (i.price * i.quantity), 0);
    
    await supabase.from('orders').insert([{ 
        customerName: document.getElementById('customerName').value, 
        date: document.getElementById('orderDate').value, 
        items: selected, 
        deliveryFee: del, 
        totalPrice: sub + del, 
        user_id: userId,
        remarks: document.getElementById('orderRemarks').value,
        deliveryType: document.getElementById('deliveryType').value
    }]);
    
    showNotification("Order Confirmed!");
    e.target.reset();
    calculateTotalPrice();
    fetchData();
};

window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date && o.customerName !== 'Groceries');
    const container = document.getElementById('summaryDisplay');
    
    document.getElementById('btnSumCust').className = type === 'customer' ? 'btn btn-active text-xs px-4' : 'btn btn-secondary text-xs px-4';
    document.getElementById('btnSumItem').className = type === 'menu' ? 'btn btn-active text-xs px-4' : 'btn btn-secondary text-xs px-4';

    if (type === 'customer') {
        const groups = { Lunch: filtered.filter(o => (o.deliveryType || 'Lunch') === 'Lunch'), Dinner: filtered.filter(o => o.deliveryType === 'Dinner') };
        
        container.innerHTML = Object.entries(groups).map(([title, list]) => {
            if (list.length === 0) return '';
            return `
            <div class="bg-pink-600 p-6 rounded-[2rem] shadow-xl">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-white text-xl font-extrabold uppercase tracking-widest">${title} SESSION</h2>
                    <span class="bg-white/20 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase">${list.length} Orders</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${list.map(o => `
                        <div class="bg-white p-5 rounded-2xl shadow-sm">
                            <div class="flex justify-between items-start mb-2">
                                <h3 class="font-black text-gray-800 uppercase text-sm">${o.customerName}</h3>
                                <span class="text-pink-600 font-black text-sm">RM ${Number(o.totalPrice).toFixed(2)}</span>
                            </div>
                            ${o.remarks ? `<p class="bg-pink-50 text-pink-600 text-[10px] p-2 rounded-lg font-bold mb-3 italic">" ${o.remarks} "</p>` : ''}
                            <div class="space-y-1">
                                ${o.items.map(i => `<div class="text-[11px] text-gray-500 font-medium flex justify-between"><span>• ${i.quantity}x ${formatItemName(i)}</span></div>`).join('')}
                            </div>
                        </div>`).join('')}
                </div>
            </div>`;
        }).join('') || '<p class="text-center text-gray-400 py-10">No orders for this date.</p>';
    } else {
        // Item Count logic
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => { const n = formatItemName(i); counts[n] = (counts[n] || 0) + i.quantity; }));
        container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">` + Object.entries(counts).map(([n, q]) => `
            <div class="bg-white p-6 rounded-2xl border-2 border-pink-50 flex justify-between items-center">
                <span class="font-bold text-gray-700">${n}</span>
                <span class="text-pink-600 font-black text-2xl">${q}</span>
            </div>`).join('') + `</div>`;
    }
};

// ... Rest of your existing functions (toggleStatus, deleteOrder, generateSalesReport, etc) ...
// Copy the rest of toggleStatus, deleteOrder, generateSalesReport, openEditMenu, etc from your previous script.js
