// --- CONFIG ---
const SUPABASE_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let userId = 'Ashikin';
let orders = [];
let menuItems = [];

// --- DOM REFS ---
const sections = ['orderFormSection', 'ordersListSection', 'manageMenuSection', 'salesReportSection', 'orderSummarySection'];
const totalPriceEl = document.getElementById('totalPrice');
const deliveryFeeInput = document.getElementById('deliveryFee');
const summaryDateInput = document.getElementById('summaryDate');

// --- INITIALIZE ---
window.onload = async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    summaryDateInput.value = today;
    
    setupSalesReportFilters();
    await fetchData();
    setupRealtime();
};

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

// --- NAVIGATION ---
function showSection(id) {
    sections.forEach(s => document.getElementById(s).classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    // Update nav colors
    document.querySelectorAll('nav button').forEach(btn => btn.className = 'px-4 py-2 rounded-lg bg-gray-200');
}

document.getElementById('showOrderFormBtn').onclick = () => showSection('orderFormSection');
document.getElementById('showOrdersBtn').onclick = () => showSection('ordersListSection');
document.getElementById('showMenusBtn').onclick = () => showSection('manageMenuSection');
document.getElementById('showSalesReportBtn').onclick = () => { showSection('salesReportSection'); generateSalesReport(); };
document.getElementById('showSummaryBtn').onclick = () => { showSection('orderSummarySection'); renderOrderSummary('customer'); };

// --- MENU MANAGEMENT (EDIT NAME & PRICE) ---
function renderManageMenu() {
    const container = document.getElementById('menuList');
    container.innerHTML = menuItems.map(item => `
        <div class="bg-gray-50 p-4 rounded-lg flex justify-between items-center border">
            <div>
                <p class="font-bold">${item.name}</p>
                <p class="text-sm text-gray-500">RM ${Number(item.price).toFixed(2)}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="openEditMenu('${item.id}', '${item.name}', ${item.price})" class="text-blue-600 font-medium">Edit</button>
                <button onclick="deleteMenuItem('${item.id}')" class="text-red-500">Delete</button>
            </div>
        </div>
    `).join('');
}

window.openEditMenu = (id, name, price) => {
    const modal = document.getElementById('modal');
    const container = document.getElementById('modalInputContainer');
    document.getElementById('modalTitle').innerText = "Edit Menu Item";
    document.getElementById('modalMessage').innerText = "Update details for " + name;
    container.classList.remove('hidden');
    document.getElementById('modalInput1').value = name;
    document.getElementById('modalInput2').value = price;
    
    document.getElementById('modalConfirmBtn').onclick = async () => {
        const newName = document.getElementById('modalInput1').value;
        const newPrice = parseFloat(document.getElementById('modalInput2').value);
        await supabase.from('menus').update({ name: newName, price: newPrice }).eq('id', id);
        modal.classList.add('hidden');
        container.classList.add('hidden');
    };
    modal.classList.remove('hidden');
};

// --- ORDER LOGIC ---
deliveryFeeInput.oninput = calculateTotalPrice;

function calculateTotalPrice() {
    let subtotal = 0;
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(cb => subtotal += parseFloat(cb.dataset.price));
    const delivery = parseFloat(deliveryFeeInput.value || 0);
    totalPriceEl.innerText = `RM ${(subtotal + delivery).toFixed(2)}`;
}

document.getElementById('orderForm').onsubmit = async (e) => {
    e.preventDefault();
    const selected = Array.from(document.querySelectorAll('.menu-item-checkbox:checked')).map(cb => ({
        name: cb.dataset.name,
        price: parseFloat(cb.dataset.price)
    }));
    
    const delivery = parseFloat(deliveryFeeInput.value || 0);
    const subtotal = selected.reduce((s, i) => s + i.price, 0);

    const { error } = await supabase.from('orders').insert([{
        customerName: document.getElementById('customerName').value,
        date: document.getElementById('orderDate').value,
        items: selected,
        deliveryFee: delivery,
        totalPrice: subtotal + delivery,
        user_id: userId
    }]);

    if (!error) {
        alert("Order Placed!");
        e.target.reset();
        calculateTotalPrice();
    }
};

// --- ORDER SUMMARY ---
document.getElementById('sumByCustomerBtn').onclick = () => renderOrderSummary('customer');
document.getElementById('sumByMenuBtn').onclick = () => renderOrderSummary('menu');
summaryDateInput.onchange = () => renderOrderSummary(window.currentSummaryType || 'customer');

function renderOrderSummary(type) {
    window.currentSummaryType = type;
    const date = summaryDateInput.value;
    const filtered = orders.filter(o => o.date === date);
    const display = document.getElementById('summaryDisplay');
    
    if (type === 'customer') {
        display.innerHTML = filtered.length ? filtered.map(o => `
            <div class="border-b py-2">
                <p class="font-bold">${o.customerName}</p>
                <p class="text-sm text-gray-600">${o.items.map(i => i.name).join(', ')}</p>
            </div>
        `).join('') : "No orders for this date.";
    } else {
        const counts = {};
        filtered.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name] || 0) + 1));
        display.innerHTML = Object.keys(counts).length ? Object.entries(counts).map(([name, qty]) => `
            <div class="flex justify-between border-b py-2">
                <span>${name}</span>
                <span class="font-bold">x ${qty}</span>
            </div>
        `).join('') : "No prep needed for this date.";
    }
}

// --- SALES REPORT (MONTHLY/YEARLY) ---
function setupSalesReportFilters() {
    const monthSel = document.getElementById('reportMonth');
    const yearSel = document.getElementById('reportYear');
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    monthSel.innerHTML = `<option value="all">All Months</option>` + months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
    const curYear = new Date().getFullYear();
    for(let y = curYear; y >= curYear-2; y--) yearSel.innerHTML += `<option value="${y}">${y}</option>`;
    
    monthSel.value = new Date().getMonth();
    monthSel.onchange = generateSalesReport;
    yearSel.onchange = generateSalesReport;
}

function generateSalesReport() {
    const selMonth = document.getElementById('reportMonth').value;
    const selYear = parseInt(document.getElementById('reportYear').value);
    
    let total = 0;
    const itemSales = {};

    orders.forEach(o => {
        const d = new Date(o.date);
        const matchYear = d.getFullYear() === selYear;
        const matchMonth = selMonth === "all" || d.getMonth() === parseInt(selMonth);
        
        if (matchYear && matchMonth) {
            total += Number(o.totalPrice);
            o.items.forEach(i => itemSales[i.name] = (itemSales[i.name] || 0) + 1);
        }
    });

    document.getElementById('totalSales').innerText = `RM ${total.toFixed(2)}`;
    document.getElementById('topSellingItemsList').innerHTML = Object.entries(itemSales)
        .sort((a,b) => b[1] - a[1])
        .map(([n, c]) => `<li class="flex justify-between border-b p-2"><span>${n}</span><b>${c} sold</b></li>`).join('');
}

// --- VIEW ORDERS TABLE ---
function renderOrdersList() {
    const body = document.querySelector('#ordersTable tbody');
    body.innerHTML = orders.map(o => `
        <tr class="hover:bg-gray-50 border-b">
            <td class="p-3">${o.date}</td>
            <td class="p-3">${o.customerName}</td>
            <td class="p-3 text-sm">${o.items.map(i => i.name).join(', ')}</td>
            <td class="p-3">RM ${Number(o.deliveryFee || 0).toFixed(2)}</td>
            <td class="p-3 font-bold">RM ${Number(o.totalPrice).toFixed(2)}</td>
            <td class="p-3"><button onclick="deleteOrder('${o.id}')" class="text-red-500">Delete</button></td>
        </tr>
    `).join('');
}

// --- SHARED RENDERS ---
function renderMenuItems() {
    const container = document.getElementById('menuItems');
    container.innerHTML = menuItems.map(item => `
        <div class="flex items-center justify-between p-2 hover:bg-gray-50">
            <label class="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" class="menu-item-checkbox w-5 h-5" 
                       data-price="${item.price}" data-name="${item.name}" onchange="calculateTotalPrice()">
                <span>${item.name}</span>
            </label>
            <span class="text-gray-500">RM ${Number(item.price).toFixed(2)}</span>
        </div>
    `).join('');
}

function renderAll() {
    renderMenuItems();
    renderManageMenu();
    renderOrdersList();
}

window.deleteMenuItem = async (id) => { if(confirm("Delete item?")) await supabase.from('menus').delete().eq('id', id); };
window.deleteOrder = async (id) => { if(confirm("Delete order?")) await supabase.from('orders').delete().eq('id', id); };
