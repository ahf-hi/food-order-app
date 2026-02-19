// --- DATABASE CONFIGURATION ---
var DB_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
var DB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8'; 
var supabase = window.supabase.createClient(DB_URL, DB_KEY);

let userId = 'Ashikin';
let orders = [];
let menuItems = [];
window.currentSummaryType = 'customer';

// --- NOTIFICATION HANDLER ---
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
    let name = item.name;
    if (item.category === 'Add On') name += ' (Add On)';
    else if (item.category === 'Student Menu') name += ' (Student Menu)';
    return name;
}

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

function renderAll() {
    const menuItemsEl = document.getElementById('menuItems');
    if (menuItemsEl) {
        const activeMenus = menuItems.filter(m => m.status === 'Active').sort((a,b) => a.name.localeCompare(b.name));
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

    const categories = {'Main Menu': 'list-main', 'Add On': 'list-addon', 'Student Menu': 'list-student'};
    Object.values(categories).forEach(id => { if(document.getElementById(id)) document.getElementById(id).innerHTML = ''; });

    menuItems.sort((a,b) => a.name.localeCompare(b.name)).forEach(item => {
        const isInactive = item.status === 'Inactive';
        const html = `
            <div class="p-4 rounded-2xl border flex items-center justify-between ${isInactive ? 'grayscale-card' : 'bg-white border-pink-100 shadow-sm'}">
                <div><p class="font-bold">${item.name}</p><p class="text-xs font-medium text-pink-500">RM ${Number(item.price).toFixed(2)}</p></div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleStatus('${item.id}', '${item.status}')" class="px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isInactive ? 'bg-gray-300' : 'bg-green-500 text-white'}">${item.status}</button>
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
        const itemsText = o.items ? o.items.map(i => formatItemName(i)).join(' ').toLowerCase() : '';
        const matchesSearch = o.customerName.toLowerCase().includes(searchQuery) || itemsText.includes(searchQuery);
        return searchQuery.length > 0 ? matchesSearch : o.date === filterDate;
    });

    tableBody.innerHTML = filtered.map(o => {
        const isExpense = o.customerName === 'Groceries';
        const itemsDisplay = o.items ? o.items.map(i => `<div class="text-[11px] font-bold text-gray-700">${i.quantity}x ${formatItemName(i)}</div>`).join('') : '';
        return `<tr class="border-b hover:bg-gray-50">
            <td class="p-4 text-[10px] text-gray-400 font-bold">${o.date}</td>
            <td class="p-4 font-bold text-gray-800">${o.customerName}</td>
            <td class="p-4">${itemsDisplay}</td>
            <td class="p-4 font-bold text-gray-400">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="p-4 font-black ${isExpense ? 'text-red-500' : 'text-pink-600'}">RM ${Math.abs(o.totalPrice).toFixed(2)}</td>
            <td class="p-4 text-center"><button onclick="deleteOrder('${o.id}')" class="text-gray-300 hover:text-red-500 font-bold text-[10px] uppercase">Delete</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" class="p-10 text-center text-gray-400">No records found.</td></tr>';
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
    if(!selected.length) return alert("Select an item");
    
    const del = parseFloat(document.getElementById('deliveryFee').value || 0);
    const delType = document.getElementById('deliveryType').value;
    const remarks = document.getElementById('orderRemarks').value;
    const sub = selected.reduce((a, i) => a + (i.price * i.quantity), 0);
    
    await supabase.from('orders').insert([{ 
        customerName: document.getElementById('customerName').value, 
        date: document.getElementById('orderDate').value, 
        items: selected, 
        deliveryFee: del, 
        deliveryType: delType,
        remarks: remarks,
        totalPrice: sub + del, 
        user_id: userId 
    }]);
    
    showNotification("Order added successfully!");
    e.target.reset();
    calculateTotalPrice();
    fetchData();
};

document.getElementById('groceryForm').onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('groceryAmount').value);
    await supabase.from('orders').insert([{ 
        customerName: 'Groceries', 
        date: document.getElementById('groceryDate').value, 
        items: [{ name: 'Groceries', remarks: document.getElementById('groceryRemarks').value, price: -amount, quantity: 1, category: 'Main Menu' }], 
        deliveryFee: 0, 
        totalPrice: -amount, 
        user_id: userId 
    }]);
    showNotification("Expense saved!");
    e.target.reset();
    fetchData();
};

document.getElementById('menuForm').onsubmit = async (e) => {
    e.preventDefault();
    await supabase.from('menus').insert([{ name: document.getElementById('menuName').value, price: parseFloat(document.getElementById('menuPrice').value), category: document.getElementById('menuCategory').value, status: 'Active', user_id: userId }]);
    showNotification("Menu item added!");
    e.target.reset();
    fetchData();
};

async function toggleStatus(id, current) {
    const nextStatus = (current === 'Active') ? 'Inactive' : 'Active';
    await supabase.from('menus').update({ status: nextStatus }).eq('id', id);
    showNotification("Status updated!");
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
        showNotification("Menu updated!");
        fetchData();
    };
};

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

async function deleteMenuItem(id) { 
    if(confirm("Delete menu item?")) {
        await supabase.from('menus').delete().eq('id', id); 
        showNotification("Item deleted!");
        fetchData();
    }
}

async function deleteOrder(id) { 
    if(confirm("Delete this record?")) {
        await supabase.from('orders').delete().eq('id', id); 
        showNotification("Record deleted!");
        fetchData();
    }
}

function setupSalesReportFilters() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    if(document.getElementById('reportMonth')) document.getElementById('reportMonth').innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
    const yr = new Date().getFullYear();
    if(document.getElementById('reportYear')) document.getElementById('reportYear').innerHTML = [yr, yr-1].map(y => `<option value="${y}">${y}</option>`).join('');
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
    weeklyContainer.innerHTML = weeklyData.map((w, idx) => `
        <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <p class="text-[10px] font-bold text-gray-400 uppercase mb-1">Week ${idx + 1}</p>
            <p class="text-[11px] font-semibold text-pink-500 mb-3">${w.start} ${monthNames[m]} - ${w.end} ${monthNames[m]}</p>
            <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Revenue</p>
                <p class="text-xl font-black text-gray-800">RM ${w.rev.toFixed(2)}</p>
            </div>
        </div>
    `).join('');

    const perfBody = document.getElementById('menuPerformanceBody');
    if (perfBody) {
        const sorted = Object.entries(menuStats).sort((a, b) => b[1].qty - a[1].qty);
        perfBody.innerHTML = sorted.map(([name, data], idx) => `
            <tr class="border-b hover:bg-gray-50 transition">
                <td class="p-4 text-xs font-bold text-gray-300">#${idx + 1}</td>
                <td class="p-4 text-sm font-bold text-gray-700">${name}</td>
                <td class="p-4 text-sm text-center font-medium text-gray-500">${data.qty} Sold</td>
                <td class="p-4 text-sm font-black text-pink-600 text-right">RM ${data.revenue.toFixed(2)}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" class="p-10 text-center text-gray-400">No menu sales data available for this month.</td></tr>';
    }
}

window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date && o.customerName !== 'Groceries');
    const container = document.getElementById('summaryDisplay');
    const btnCust = document.getElementById('btnSumCust');
    const btnItem = document.getElementById('btnSumItem');

    if (type === 'customer') {
        btnCust.className = 'btn btn-active text-xs px-4';
        btnItem.className = 'btn btn-secondary text-xs px-4';
        
        // --- GROUPING BY LUNCH/DINNER ---
        const groupedByType = filtered.reduce((acc, o) => {
            const type = o.deliveryType || 'Lunch'; // Default to Lunch if not set
            if (!acc[type]) acc[type] = {};
            if (!acc[type][o.customerName]) acc[type][o.customerName] = [];
            acc[type][o.customerName].push(o);
            return acc;
        }, {});

        let html = '';
        ['Lunch', 'Dinner'].forEach(delType => {
            if (groupedByType[delType]) {
                html += `<div class="mb-10">
                    <h2 class="text-xl font-black text-gray-800 border-l-4 border-pink-500 pl-4 mb-6 uppercase tracking-widest">${delType} Orders</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">`;
                
                Object.entries(groupedByType[delType]).forEach(([name, custOrders]) => {
                    const deliveryTotal = custOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
                    const grandTotal = custOrders.reduce((sum, o) => sum + o.totalPrice, 0);
                    
                    const itemsHtml = custOrders.map(o => {
                        const menuHtml = o.items.map(i => {
                            const itemTotal = (i.quantity * i.price).toFixed(2);
                            return `<div class="text-xs font-bold text-gray-600 mb-1 flex justify-between">
                                <span>• ${i.quantity}x ${formatItemName(i)}</span>
                                <span class="text-gray-400">RM ${itemTotal}</span>
                            </div>`;
                        }).join('');
                        
                        // Show Remarks if available
                        const remarkHtml = o.remarks ? `<div class="mt-2 p-2 bg-yellow-50 rounded text-[10px] text-yellow-700 italic border-l-2 border-yellow-200">Note: ${o.remarks}</div>` : '';
                        
                        return `<div>${menuHtml}${remarkHtml}</div>`;
                    }).join('<div class="my-3 border-t border-dashed border-gray-100"></div>');

                    html += `
                    <div class="p-6 bg-white rounded-3xl border shadow-sm border-l-8 border-pink-500">
                        <h3 class="font-black text-gray-800 mb-3 uppercase tracking-tighter text-sm">${name}</h3>
                        <div class="space-y-1">${itemsHtml}</div>
                        <div class="mt-3 pt-2 border-t flex justify-between items-center">
                            <span class="text-[10px] font-bold text-gray-400 italic">Delivery Fee: RM ${deliveryTotal.toFixed(2)}</span>
                            <span class="font-black text-pink-600 text-lg">RM ${grandTotal.toFixed(2)}</span>
                        </div>
                    </div>`;
                });
                html += `</div></div>`;
            }
        });

        container.innerHTML = html || '<p class="text-center text-gray-400 py-10">No orders for this date.</p>';

    } else {
        btnItem.className = 'btn btn-active text-xs px-4';
        btnCust.className = 'btn btn-secondary text-xs px-4';
        const counts = {};
        let totalDelivs = 0;
        filtered.forEach(o => {
            if(o.deliveryFee > 0) totalDelivs++;
            o.items.forEach(i => {
                const label = formatItemName(i);
                counts[label] = (counts[label] || 0) + i.quantity;
            });
        });
        let html = `<div class="grid grid-cols-1 md:grid-cols-2 gap-6">` + Object.entries(counts).map(([n, q]) => `
            <div class="bg-white p-5 rounded-2xl border flex justify-between shadow-sm">
                <b class="text-gray-700 text-sm">${n}</b>
                <span class="text-pink-600 font-black text-xl">${q}</span>
            </div>`).join('') + `</div>`;
        if (totalDelivs > 0) {
            html += `
            <div class="mt-6 bg-gray-100 p-5 rounded-2xl border flex justify-between shadow-sm border-dashed">
                <b class="text-gray-500 italic text-sm">Total Deliveries Today</b>
                <span class="text-gray-700 font-black text-xl">${totalDelivs}</span>
            </div>`;
        }
        container.innerHTML = html || '<p class="text-center text-gray-400 py-10">No items sold today.</p>';
    }
};
