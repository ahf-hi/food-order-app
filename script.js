// --- SUPABASE CONFIG ---
// IMPORTANT: Replace these with your Supabase Project URL and Public API Key
const SUPABASE_URL = 'https://jkzqplyvqeqegqhejppo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprenFwbHl2cWVxZWdxaGVqcHBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3OTIzMzEsImV4cCI6MjA4NDM2ODMzMX0.LCEJ4JR2-ZhR_iKnrgnzhnVVznbDknKR73_mR5kCQt8';

// Globals
let supabase;
let userId;
let orders = [];
let menuItems = [];

// Modal helpers
function showModal(title, message, onConfirm = () => {}) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const inputField = document.getElementById('modalInput');
    inputField.classList.add('hidden');
    confirmBtn.onclick = () => {
        modal.classList.add('hidden');
        onConfirm();
    };
    modal.classList.remove('hidden');
}

function promptWithModal(title, message, initialValue = '', onConfirm = () => {}) {
    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMessage').innerText = message;
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const inputField = document.getElementById('modalInput');
    inputField.value = initialValue;
    inputField.classList.remove('hidden');
    confirmBtn.onclick = () => {
        modal.classList.add('hidden');
        onConfirm(inputField.value);
    };
    modal.classList.remove('hidden');
}

// DOM refs (script at end of body so elements exist)
const orderFormSection = document.getElementById('orderFormSection');
const ordersListSection = document.getElementById('ordersListSection');
const manageMenuSection = document.getElementById('manageMenuSection');
const salesReportSection = document.getElementById('salesReportSection');

const showOrderFormBtn = document.getElementById('showOrderFormBtn');
const showOrdersBtn = document.getElementById('showOrdersBtn');
const showMenusBtn = document.getElementById('showMenusBtn');
const showSalesReportBtn = document.getElementById('showSalesReportBtn');

const orderForm = document.getElementById('orderForm');
const menuItemsContainer = document.getElementById('menuItems');
const menuLoadingText = document.getElementById('menu-loading-text');
const totalPriceEl = document.getElementById('totalPrice');

const ordersTableBody = document.querySelector('#ordersTable tbody');
const ordersLoadingText = document.getElementById('orders-loading-text');
const menuForm = document.getElementById('menuForm');
const menuListContainer = document.getElementById('menuList');
const menuManageLoadingText = document.getElementById('menu-manage-loading-text');
const totalSalesEl = document.getElementById('totalSales');
const topSellingItemsList = document.getElementById('topSellingItemsList');
const reportPeriodSelect = document.getElementById('reportPeriodSelect');
const userIdDisplay = document.getElementById('user-id-display');

// Render & utility functions
function renderMenuItems() {
    menuItemsContainer.innerHTML = '';
    if (!menuItems || menuItems.length === 0) {
        menuItemsContainer.innerHTML = `<p class="text-gray-500 text-center">No menu items found. Add some in the "Manage Menus" section.</p>`;
    } else {
        menuItems.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('flex', 'items-center', 'justify-between', 'bg-gray-100', 'p-3', 'rounded-lg');
            itemDiv.innerHTML = `
                <div class="flex items-center space-x-3">
                    <input type="checkbox" id="menuItem-${item.id}" data-price="${item.price}" class="menu-item-checkbox form-checkbox h-5 w-5 text-orange-600 rounded focus:ring-0">
                    <label for="menuItem-${item.id}" class="text-gray-800 font-medium">${item.name}</label>
                </div>
                <span class="text-gray-600">RM ${Number(item.price).toFixed(2)}</span>
            `;
            menuItemsContainer.appendChild(itemDiv);
        });
    }
    document.querySelectorAll('.menu-item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', calculateTotalPrice);
    });
    menuLoadingText.classList.add('hidden');
}

function calculateTotalPrice() {
    let total = 0;
    document.querySelectorAll('.menu-item-checkbox:checked').forEach(checkbox => {
        total += parseFloat(checkbox.dataset.price || 0);
    });
    totalPriceEl.textContent = `RM ${total.toFixed(2)}`;
}

function renderOrdersList() {
    ordersTableBody.innerHTML = '';
    if (!orders || orders.length === 0) {
        ordersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500">No orders found.</td></tr>`;
    } else {
        const sortedOrders = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));
        sortedOrders.forEach((order) => {
            // Correctly handle both old (string) and new (object) data
            const itemsArr = Array.isArray(order.items) 
                ? order.items 
                : (typeof order.items === 'string' ? JSON.parse(order.items) : []);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="whitespace-nowrap">${order.date}</td>
                <td>${order.customerName}</td>
                <td>${itemsArr.map(i => i.name).join(', ')}</td>
                <td class="font-bold">RM ${Number(order.totalPrice || 0).toFixed(2)}</td>
                <td class="whitespace-nowrap">
                    <button data-id="${order.id}" class="delete-order-btn text-red-500 hover:text-red-700 font-medium transition-colors duration-200">Delete</button>
                </td>
            `;
            ordersTableBody.appendChild(row);
        });

        // Wire up delete buttons
        document.querySelectorAll('.delete-order-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteOrder(btn.getAttribute('data-id')));
        });
    }
    ordersLoadingText.classList.add('hidden');
}

function renderManageMenu() {
    menuListContainer.innerHTML = '';
    if (!menuItems || menuItems.length === 0) {
        menuListContainer.innerHTML = `<p class="text-gray-500 text-center">No menu items found.</p>`;
    } else {
        menuItems.forEach((item) => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('bg-gray-100', 'p-4', 'rounded-lg', 'flex', 'flex-col', 'sm:flex-row', 'items-center', 'justify-between', 'space-y-2', 'sm:space-y-0');
            itemDiv.innerHTML = `
                <span class="font-medium text-gray-800">${item.name}</span>
                <span class="text-gray-600">RM ${Number(item.price).toFixed(2)}</span>
                <div class="flex space-x-2">
                    <button data-id="${item.id}" data-name="${item.name}" class="edit-menu-btn px-3 py-1 bg-orange-200 text-orange-700 rounded-full text-sm hover:bg-orange-300">Edit</button>
                    <button data-id="${item.id}" class="delete-menu-btn px-3 py-1 bg-red-200 text-red-700 rounded-full text-sm hover:bg-red-300">Delete</button>
                </div>
            `;
            menuListContainer.appendChild(itemDiv);
        });
        // wire up edit/delete buttons
        document.querySelectorAll('.edit-menu-btn').forEach(btn => {
            btn.addEventListener('click', () => editMenuItem(btn.getAttribute('data-id'), btn.getAttribute('data-name')));
        });
        document.querySelectorAll('.delete-menu-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteMenuItem(btn.getAttribute('data-id')));
        });
    }
    menuManageLoadingText.classList.add('hidden');
}

function generateSalesReport(period) {
    const today = new Date();
    const startOfPeriod = new Date();
    
    if (period === 'thisWeek') {
        startOfPeriod.setDate(today.getDate() - today.getDay());
    } else if (period === 'thisMonth') {
        startOfPeriod.setDate(1);
    } else { // today
        startOfPeriod.setHours(0,0,0,0);
    }
    startOfPeriod.setHours(0,0,0,0);

    let totalSales = 0;
    const itemSales = {};

    orders.forEach(order => {
        const orderDate = new Date(order.date);
        if (orderDate >= startOfPeriod) {
            totalSales += Number(order.totalPrice || 0);
            
            // Logic must be INSIDE the loop to access individual 'order' data
            const itemsArr = Array.isArray(order.items) 
                ? order.items 
                : (typeof order.items === 'string' ? JSON.parse(order.items) : []);

            itemsArr.forEach(item => {
                itemSales[item.name] = (itemSales[item.name] || 0) + 1;
            });
        }
    });

    totalSalesEl.textContent = `RM ${totalSales.toFixed(2)}`;
    
    const sortedItems = Object.entries(itemSales).sort(([,a],[,b]) => b - a);
    topSellingItemsList.innerHTML = '';
    
    if (sortedItems.length === 0) {
        topSellingItemsList.innerHTML = '<li class="text-gray-500">No sales for this period.</li>';
    } else {
        sortedItems.forEach(([name, count]) => {
            const li = document.createElement('li');
            li.classList.add('bg-gray-100','p-2','rounded-lg');
            li.innerHTML = `<span class="font-medium">${name}</span> - ${count} sold`;
            topSellingItemsList.appendChild(li);
        });
    }
}

function sortTable(column) {
    const isAscending = ordersTableBody.getAttribute('data-sort-order') !== 'asc';
    ordersTableBody.setAttribute('data-sort-order', isAscending ? 'asc' : 'desc');
    const sortedOrders = [...orders].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        if (column === 'date') {
            valA = new Date(a.date);
            valB = new Date(b.date);
        }
        if (valA < valB) return isAscending ? -1 : 1;
        if (valA > valB) return isAscending ? 1 : -1;
        return 0;
    });
    orders = sortedOrders;
    renderOrdersList();
}

// Form handlers
orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    const orderDate = document.getElementById('orderDate').value;
    
    // Direct extraction from HTML to ensure data matches the UI
    const selectedItems = Array.from(document.querySelectorAll('.menu-item-checkbox:checked')).map(checkbox => {
        // Find the label associated with this checkbox for the name
        const label = document.querySelector(`label[for="${checkbox.id}"]`).innerText;
        return { 
            name: label, 
            price: Number(checkbox.dataset.price || 0) 
        };
    });

    // Calculate total from the extracted prices
    const totalPrice = selectedItems.reduce((sum, item) => sum + item.price, 0);

    if (selectedItems.length === 0) {
        showModal('Error', 'Please select at least one menu item.');
        return;
    }

    const newOrder = {
        customerName: customerName,
        date: orderDate,
        items: selectedItems, // Send as Array (your column is jsonb)
        totalPrice: totalPrice,
        user_id: userId
    };

    try {
        const { error } = await supabase.from('orders').insert([newOrder]);
        if (error) throw error;
        showModal('Order Placed!', 'Your order has been successfully placed.');
        orderForm.reset();
        calculateTotalPrice();
    } catch (err) {
        showModal('Error', 'Error adding order: ' + (err.message || err));
        console.error('Error adding order:', err);
    }
});

menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const menuName = document.getElementById('menuName').value;
    const menuPrice = parseFloat(document.getElementById('menuPrice').value || 0);
    const newItem = { name: menuName, price: menuPrice, user_id: userId };
    try {
        const { error } = await supabase.from('menus').insert([newItem]);
        if (error) throw error;
        showModal('Menu Item Added!', `${newItem.name} has been added to the menu.`);
        menuForm.reset();
    } catch (err) {
        showModal('Error', 'Error adding menu item: ' + (err.message || err));
        console.error('Error adding menu item:', err);
    }
});

// CRUD helpers
async function deleteOrder(id) {
    showModal('Confirm Delete', 'Are you sure you want to delete this order?', async () => {
        try {
            const { error } = await supabase.from('orders').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            showModal('Error', 'Error deleting order: ' + (err.message || err));
            console.error('Error deleting order:', err);
        }
    });
}

function editMenuItem(id, currentName) {
    promptWithModal('Edit Menu Item', `Enter new name for "${currentName}":`, currentName, async (newName) => {
        if (!newName) return;
        try {
            const { error } = await supabase.from('menus').update({ name: newName }).eq('id', id);
            if (error) throw error;
        } catch (err) {
            showModal('Error', 'Error updating menu item: ' + (err.message || err));
            console.error('Error updating menu item:', err);
        }
    });
}

async function deleteMenuItem(id) {
    showModal('Confirm Delete', 'Are you sure you want to delete this menu item?', async () => {
        try {
            const { error } = await supabase.from('menus').delete().eq('id', id);
            if (error) throw error;
        } catch (err) {
            showModal('Error', 'Error deleting menu item: ' + (err.message || err));
            console.error('Error deleting menu item:', err);
        }
    });
}

// Active button helper
function setActiveButton(activeBtn) {
    const buttons = [showOrderFormBtn, showOrdersBtn, showMenusBtn, showSalesReportBtn];
    buttons.forEach(btn => {
        btn.classList.remove('btn-active');
        btn.classList.add('btn-secondary');
    });
    if (activeBtn) {
        activeBtn.classList.remove('btn-secondary');
        activeBtn.classList.add('btn-active');
    }
}

// Navigation wiring
showOrderFormBtn.addEventListener('click', () => {
    ordersListSection.classList.add('hidden');
    manageMenuSection.classList.add('hidden');
    salesReportSection.classList.add('hidden');
    orderFormSection.classList.remove('hidden');
    setActiveButton(showOrderFormBtn);
});

showMenusBtn.addEventListener('click', () => {
    ordersListSection.classList.add('hidden');
    orderFormSection.classList.add('hidden');
    salesReportSection.classList.add('hidden');
    manageMenuSection.classList.remove('hidden');
    setActiveButton(showMenusBtn);
});

showOrdersBtn.addEventListener('click', () => {
    orderFormSection.classList.add('hidden');
    manageMenuSection.classList.add('hidden');
    salesReportSection.classList.add('hidden');
    ordersListSection.classList.remove('hidden');
    setActiveButton(showOrdersBtn);
});

showSalesReportBtn.addEventListener('click', () => {
    orderFormSection.classList.add('hidden');
    manageMenuSection.classList.add('hidden');
    ordersListSection.classList.add('hidden');
    salesReportSection.classList.remove('hidden');
    generateSalesReport(reportPeriodSelect.value);
    setActiveButton(showSalesReportBtn);
});

reportPeriodSelect.addEventListener('change', (e) => generateSalesReport(e.target.value));

// --- INITIALIZATION FUNCTION (must be defined before window.onload) ---
const initializeSupabase = async () => {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('Supabase client created successfully.');

        // Use a random user ID for demo
        // userId = crypto.randomUUID();
        userId = 'Ashikin';
        userIdDisplay.textContent = `User ID: ${userId}`;

        // Realtime: orders
        supabase.channel('orders-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
                // payload.eventType may be 'INSERT'|'UPDATE'|'DELETE'
                if (payload.eventType === 'INSERT' || payload.event === 'INSERT') {
                    orders.push(payload.new);
                } else if (payload.eventType === 'UPDATE' || payload.event === 'UPDATE') {
                    const idx = orders.findIndex(o => o.id === payload.new.id);
                    if (idx !== -1) orders[idx] = payload.new;
                } else if (payload.eventType === 'DELETE' || payload.event === 'DELETE') {
                    orders = orders.filter(o => o.id !== payload.old.id);
                }
                renderOrdersList();
                generateSalesReport(reportPeriodSelect.value);
            })
            .subscribe();

        // Realtime: menus
        supabase.channel('menus-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menus' }, payload => {
                if (payload.eventType === 'INSERT' || payload.event === 'INSERT') {
                    menuItems.push(payload.new);
                } else if (payload.eventType === 'UPDATE' || payload.event === 'UPDATE') {
                    const index = menuItems.findIndex(m => m.id === payload.new.id);
                    if (index !== -1) menuItems[index] = payload.new;
                } else if (payload.eventType === 'DELETE' || payload.event === 'DELETE') {
                    menuItems = menuItems.filter(m => m.id !== payload.old.id);
                }
                renderMenuItems();
                renderManageMenu();
            })
            .subscribe();

        // Initial fetch orders
        const { data: initialOrders, error: ordersError } = await supabase.from('orders').select('*').order('date', { ascending: false });
        if (ordersError) throw ordersError;
        orders = initialOrders || [];
        renderOrdersList();

        // Initial fetch menus
        const { data: initialMenus, error: menusError } = await supabase.from('menus').select('*');
        if (menusError) throw menusError;
        menuItems = initialMenus || [];
        renderMenuItems();
        renderManageMenu();

        // Generate initial sales report
        generateSalesReport(reportPeriodSelect.value);

    } catch (error) {
        console.error('Supabase Initialization Error:', error);
        showModal('Initialization Error', `Failed to initialize Supabase: ${error.message || error}`);
    }
};

// Safe public exports for inline handlers (some code used inline onclicks)
window.sortTable = sortTable;
window.deleteOrder = deleteOrder;
window.editMenuItem = editMenuItem;
window.deleteMenuItem = deleteMenuItem;

// Run on load
window.addEventListener('load', () => {
    initializeSupabase();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('orderDate').value = today;
    calculateTotalPrice();
    setActiveButton(showOrderFormBtn); // default active

});



