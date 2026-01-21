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

// --- INITIALIZE APP ---
document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('user-id-display');
    if (statusEl) statusEl.textContent = `User ID: ${userId} | System Online`;
    
    const today = new Date().toISOString().split('T')[0];
    if(document.getElementById('orderDate')) document.getElementById('orderDate').value = today;
    if(document.getElementById('summaryDate')) document.getElementById('summaryDate').value = today;
    if(document.getElementById('groceryDate')) document.getElementById('groceryDate').value = today;

    setupSalesReportFilters();
    await fetchData();
    
    supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public' }, fetchData).subscribe();
    showSection('orderFormSection');
});

async function fetchData() {
    try {
        const { data: o } = await supabase.from('orders').select('*').order('date', { ascending: false });
        const { data: m } = await supabase.from('menus').select('*').order('name');
        orders = o || [];
        menuItems = m || [];
        renderAll();
        // Always refresh sales report data
        generateSalesReport();
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

// --- NAVIGATION ---
window.showSection = (id) => {
    const sections = ['orderFormSection', 'ordersListSection', 'orderSummarySection', 'manageMenuSection', 'salesReportSection'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
    
    updateNavButtons(id);

    if(id === 'salesReportSection') generateSalesReport();
    if(id === 'orderSummarySection') renderOrderSummary(window.currentSummaryType);
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

// --- RENDERING ---
function renderAll() {
    // Menu selection in New Order
    const menuItemsEl = document.getElementById('menuItems');
    if (menuItemsEl) {
        menuItemsEl.innerHTML = menuItems.map(item => `
            <div class="flex items-center justify-between p-3 bg-white border rounded-lg shadow-sm hover:border-pink-300 transition-all">
                <label class="flex items-center gap-3 cursor-pointer flex-grow">
                    <input type="checkbox" class="menu-item-checkbox w-6 h-6 accent-pink-500" 
                            data-price="${item.price}" data-name="${item.name}" onchange="calculateTotalPrice()">
                    <div class="flex flex-col">
                        <span class="font-bold text-gray-800">${item.name}</span>
                        <span class="text-xs text-pink-600 font-bold">RM ${Number(item.price).toFixed(2)}</span>
                    </div>
                </label>
                <div class="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border">
                    <span class="text-[10px] font-black text-gray-400 uppercase">Qty</span>
                    <input type="number" value="1" min="1" 
                           class="qty-input w-12 text-center font-black text-pink-600 bg-transparent outline-none" 
                           oninput="calculateTotalPrice()">
                </div>
            </div>
        `).join('') || '<p class="text-gray-400 italic py-4">No menu items found.</p>';
    }

    // Orders History Table
    const tableBody = document.getElementById('ordersTableBody');
    if (tableBody) {
        tableBody.innerHTML = orders.map(o => {
            const isGrocery = o.customerName === 'Admin' && o.totalPrice < 0;
            const itemsDisplay = o.items ? o.items.map(i => `
                <span class="inline-block bg-pink-50 text-pink-700 px-2 py-0.5 rounded text-[11px] font-bold border border-pink-100 mr-1 mb-1">
                    ${i.quantity || 1}x ${i.name}
                </span>`).join('') : '';

            // Handle styling for groceries
            const totalDisplay = isGrocery 
                ? `<span class="text-red-600">- RM ${Math.abs(o.totalPrice).toFixed(2)}</span>` 
                : `<span class="text-pink-600">RM ${Number(o.totalPrice).toFixed(2)}</span>`;

            return `<tr class="hover:bg-gray-50 border-b">
                <td class="p-4 text-xs">${o.date}</td>
                <td class="p-4 font-bold text-gray-800">${o.customerName}</td>
                <td class="p-4">${itemsDisplay}</td>
                <td class="p-4 text-gray-500">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
                <td class="p-4 font-black">${totalDisplay}</td>
                <td class="p-4 text-center"><button onclick="deleteOrder('${o.id}')" class="text-red-400 font-bold text-xs uppercase">Delete</button></td>
            </tr>`;
        }).join('');
    }

    // Manage Menu grid
    const menuListEl = document.getElementById('menuList');
    if (menuListEl) {
        menuListEl.innerHTML = menuItems.map(item => `
            <div class="bg-white p-5 rounded-2xl border shadow-sm flex flex-col gap-2">
                <p class="font-black text-gray-800">${item.name}</p>
                <p class="text-pink-600 font-bold">RM ${Number(item.price).toFixed(2)}</p>
                <div class="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                    <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price})" class="text-xs text-blue-500 font-bold uppercase">Edit</button>
                    <button onclick="deleteMenuItem('${item.id}')" class="text-xs text-red-400 font-bold uppercase">Delete</button>
                </div>
            </div>`).join('');
    }
}

// --- CALCULATION LOGIC ---
window.calculateTotalPrice = () => {
    let subtotal = 0;
    document.querySelectorAll('#menuItems > div').forEach(row => {
        const checkbox = row.querySelector('.menu-item-checkbox');
        const qtyInput = row.querySelector('.qty-input');
        if (checkbox && checkbox.checked) {
            subtotal += parseFloat(checkbox.dataset.price) * (parseInt(qtyInput.value) || 1);
        }
    });
    const delivery = parseFloat(document.getElementById('deliveryFee').value || 0);
    const display = document.getElementById('totalPriceDisplay');
    if (display) display.innerText = `RM ${(subtotal + delivery).toFixed(2)}`;
};

// --- FORM SUBMISSIONS ---
document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    const selected = [];
    document.querySelectorAll('#menuItems > div').forEach(row => {
        const checkbox = row.querySelector('.menu-item-checkbox');
        const qtyInput = row.querySelector('.qty-input');
        if (checkbox && checkbox.checked) {
            selected.push({ name: checkbox.dataset.name, price: parseFloat(checkbox.dataset.price), quantity: parseInt(qtyInput.value) || 1 });
        }
    });
    if(!selected.length) return alert("Select at least one item");
    const delivery = parseFloat(document.getElementById('deliveryFee').value || 0);
    const subtotal = selected.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const { error } = await supabase.from('orders').insert([{
        customerName: document.getElementById('customerName').value,
        date: document.getElementById('orderDate').value,
        items: selected, deliveryFee: delivery, totalPrice: subtotal + delivery, user_id: userId
    }]);
    if(!error) { alert("Order Placed!"); e.target.reset(); calculateTotalPrice(); }
};

// GROCERY SUBMISSION
document.getElementById('groceryForm').onsubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('groceryAmount').value);
    const date = document.getElementById('groceryDate').value;
    
    const { error } = await supabase.from('orders').insert([{
        customerName: 'Admin',
        date: date,
        items: [{ name: 'Groceries', price: -amount, quantity: 1 }],
        deliveryFee: 0,
        totalPrice: -amount,
        user_id: userId
    }]);

    if(!error) {
        alert("Grocery Purchase Added!");
        e.target.reset();
        document.getElementById('groceryDate').value = new Date().toISOString().split('T')[0];
        fetchData();
    }
};

// --- SALES REPORT LOGIC ---
function setupSalesReportFilters() {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const mSel = document.getElementById('reportMonth');
    const ySel = document.getElementById('reportYear');
    if(mSel && ySel) {
        mSel.innerHTML = months.map((m, i) => `<option value="${i}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('');
        const yr = new Date().getFullYear();
        ySel.innerHTML = [yr, yr-1].map(y => `<option value="${y}">${y}</option>`).join('');
    }
}

window.generateSalesReport = () => {
    const m = parseInt(document.getElementById('reportMonth').value);
    const y = parseInt(document.getElementById('reportYear').value);
    
    let totalRevenue = 0;
    let totalGroceries = 0;
    const itemSales = {};

    orders.forEach(o => {
        const d = new Date(o.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            if (o.customerName === 'Admin') {
                totalGroceries += Math.abs(o.totalPrice);
            } else {
                totalRevenue += Number(o.totalPrice);
                o.items.forEach(i => itemSales[i.name] = (itemSales[i.name] || 0) + (i.quantity || 1));
            }
        }
    });

    // Update Header Displays
    document.getElementById('totalSalesDisplay').innerText = `RM ${totalRevenue.toFixed(2)}`;
    document.getElementById('totalGroceriesDisplay').innerText = `RM ${totalGroceries.toFixed(2)}`;
    document.getElementById('totalProfitDisplay').innerText = `RM ${(totalRevenue - totalGroceries).toFixed(2)}`;

    // Weekly Sales Breakdown (Excludes Groceries)
    const weeks = getWeeksInMonth(y, m);
    const weeklyDiv = document.getElementById('weeklyBreakdown');
    if (weeklyDiv) {
        weeklyDiv.innerHTML = weeks.map((week, idx) => {
            let weekRev = 0;
            orders.forEach(o => {
                if (o.customerName === 'Admin') return;
                const od = new Date(o.date);
                const ot = new Date(od.getFullYear(), od.getMonth(), od.getDate()).getTime();
                if (ot >= week.start.getTime() && ot <= week.end.getTime()) weekRev += Number(o.totalPrice);
            });
            return `
                <div class="bg-white p-5 rounded-2xl border border-pink-100 shadow-sm">
                    <p class="text-pink-600 font-black text-xs uppercase">Week ${idx + 1}</p>
                    <p class="text-gray-400 text-[10px] mb-2 font-bold">${week.start.toLocaleDateString('en-GB')} - ${week.end.toLocaleDateString('en-GB')}</p>
                    <p class="text-2xl font-black text-gray-800">RM ${weekRev.toFixed(2)}</p>
                </div>`;
        }).join('');
    }

    // Performance List (At bottom of Manage Menus)
    const topList = document.getElementById('topSellingItemsList');
    if(topList) {
        topList.innerHTML = Object.entries(itemSales).sort((a,b) => b[1]-a[1]).map(([n, q]) => `
            <li class="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                <span class="font-bold text-gray-700">${n}</span>
                <span class="bg-pink-100 text-pink-600 px-3 py-1 rounded-full font-black text-sm">${q} units sold</span>
            </li>`).join('') || '<p class="text-gray-400 text-xs italic">No sales recorded yet.</p>';
    }
};

// Helper: Weekly Calculation
function getWeeksInMonth(year, month) {
    const weeks = [];
    let firstDate = new Date(year, month, 1);
    let lastDate = new Date(year, month + 1, 0);
    let start = new Date(firstDate);
    let day = start.getDay(); 
    let diff = (day === 0 ? -6 : 1 - day); 
    start.setDate(start.getDate() + diff); 

    while (start <= lastDate) {
        let end = new Date(start);
        end.setDate(end.getDate() + 6); 
        weeks.push({ start: new Date(start), end: new Date(end) });
        start.setDate(start.getDate() + 7);
    }
    return weeks;
}

// --- SUMMARIES ---
window.renderOrderSummary = (type) => {
    window.currentSummaryType = type;
    const date = document.getElementById('summaryDate').value;
    const filtered = orders.filter(o => o.date === date && o.customerName !== 'Admin');
    const container = document.getElementById('summaryDisplay');
    if (type === 'customer') {
        const grouped = filtered.reduce((acc, o) => { if (!acc[o.customerName]) acc[o.customerName] = []; acc[o.customerName].push(o); return acc; }, {});
        container.innerHTML = Object.entries(grouped).map(([name, custOrders]) => `
            <div class="p-6 bg-white rounded-2xl border-l-[12px] border-pink-500 shadow-md">
                <h3 class="text-2xl font-black text-gray-800 uppercase mb-4 tracking-tight">${name}</h3>
                <div class="space-y-4">
                    ${custOrders.map(o => `
                        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <ul class="space-y-1 mb-3">${o.items.map(i => `<li class="text-gray-700 font-medium">• ${i.quantity}x ${i.name}</li>`).join('')}</ul>
                            <div class="flex justify-between items-center border-t border-gray-200 pt-3 text-sm font-bold">
                                <span class="text-gray-500 italic">Fee: RM ${Number(o.deliveryFee).toFixed(2)}</span>
                                <span class="text-pink-600 text-lg">Total: RM ${Number(o.totalPrice).toFixed(2)}</span>
                            </div>
                        </div>`).join('')}
                </div>
            </div>`).join('') || '<p class="text-center text-gray-400 py-10">No orders for this date.</p>';
    } else {
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + (i.quantity || 1)));
        container.innerHTML = Object.entries(counts).map(([n, q]) => `<div class="flex justify-between items-center bg-white p-5 rounded-xl border mb-2 font-black text-gray-700"><span class="text-lg">${n}</span><span class="text-pink-600 text-2xl">${q} units</span></div>`).join('') || '<p class="text-center text-gray-400 py-10">No preparation needed.</p>';
    }
};

// --- MENU HELPERS ---
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
