// Global Chart Instances
let eggChartInstance = null;
let financeChartInstance = null;
let performanceChartInstance = null;

// Global State
window.currencySymbol = localStorage.getItem('modsir_currency') || '₦';

// TOAST NOTIFICATIONS
window.showToast = function(title, msg, type='info') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<div style="font-weight:700; font-size:14px; color:white;">${title}</div><div style="font-size:12px; color:var(--text-muted); padding-top:4px;">${msg}</div>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOutRight 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 4500);
}

// Initialize App (UI parts only, data init happens in auth.js now)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Navigation
    setupNavigation();

    // 2. Initialize Charts
    initCharts();

    // 3. Setup Modals
    setupModals();

    // 4. Initialize Geo Data dropdowns
    initWeatherGeoData();
    // Attempt automatic weather fetch using geolocation
    try { fetchWeather(); } catch(e) { console.warn('Auto weather fetch failed', e); }
});

// ===== RESPONSIVE SIDEBAR TOGGLE =====
window.toggleSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('open');
};

window.closeSidebar = function () {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
};

function initSettings() {
    // Attempt to load from localStorage first for immediate UI feedback
    const savedName = localStorage.getItem('modsir_farm_name') || 'ModSir Farm';
    document.getElementById('sidebar-farm-name').innerHTML = `<i class="fa-solid fa-kiwi-bird"></i> ${savedName}`;
    document.getElementById('setting-farm-name').value = savedName;

    const savedAvatar = localStorage.getItem('modsir_avatar');
    if (savedAvatar) {
        updateSidebarAvatar(savedAvatar);
        const preview = document.getElementById('setting-avatar-preview');
        if (preview) preview.src = savedAvatar;
    }

    const savedCurrency = localStorage.getItem('modsir_currency') || '₦';
    window.currencySymbol = savedCurrency;
    const currencySelect = document.getElementById('setting-currency');
    if (currencySelect) currencySelect.value = savedCurrency;

    if (typeof loadWorkers === 'function' && window.currentUserRole === 'admin') {
        loadWorkers();
    }


    // Setup popup info if logged in
    updateUserPopupInfo();

    // Set sidebar farm location display
    const savedLoc = localStorage.getItem('modsir_farm_location') || 'Not set';
    const sideLoc = document.getElementById('sidebar-farm-location');
    if (sideLoc) sideLoc.innerText = `Location: ${savedLoc}`;
}

window.saveSettings = async function(e) {
    e.preventDefault();
    const farmName = document.getElementById('setting-farm-name').value.trim();
    const currency = document.getElementById('setting-currency').value;

    // Save to localStorage
    if (farmName) {
        localStorage.setItem('modsir_farm_name', farmName);
        const sidebarEl = document.getElementById('sidebar-farm-name');
        if (sidebarEl) sidebarEl.innerHTML = `<i class="fa-solid fa-kiwi-bird"></i> ${farmName}`;
    }
    if (currency) {
        localStorage.setItem('modsir_currency', currency);
        window.currencySymbol = currency;
    }

    // Sync to Firestore
    try {
        if (window.currentFarmId) {
            await db.collection('farms').doc(window.currentFarmId).update({ name: farmName });
        }
        if (window.currentUser) {
            await db.collection('users').doc(window.currentUser.uid).update({ currency: currency });
        }
        showToast('Saved', 'Settings updated successfully.', 'success');
    } catch (err) {
        console.error('Settings save error:', err);
        showToast('Saved Locally', 'Settings saved locally. Cloud sync failed.', 'warning');
    }
}


function updateUserPopupInfo() {
    if (window.currentUser) {
        const farmName = localStorage.getItem('modsir_farm_name') || 'Your Farm';
        const farmLoc = localStorage.getItem('modsir_farm_location') || 'Not Set';
        
        document.getElementById('popup-name').innerText = window.currentUser.displayName || 'Admin';
        document.getElementById('popup-owner').innerText = window.currentUser.displayName || 'Admin';
        document.getElementById('popup-farmname').innerText = farmName;
        document.getElementById('popup-location').innerText = farmLoc;

        const avatar = localStorage.getItem('modsir_avatar');
        if (avatar) document.getElementById('popup-avatar').src = avatar;
    }
}

window.previewAvatar = function (e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('setting-avatar-preview').src = e.target.result;
            window.tempAvatarBase64 = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

window.saveSettings = async function (e) {
    if (e) e.preventDefault();
    const newName = document.getElementById('setting-farm-name').value;
    const avatarData = window.tempAvatarBase64;

    if (newName) {
        localStorage.setItem('modsir_farm_name', newName);
        document.getElementById('sidebar-farm-name').innerHTML = `<i class="fa-solid fa-kiwi-bird"></i> ${newName}`;

        if (window.currentFarmId && window.currentUserRole === 'admin') {
            try {
                await db.collection('farms').doc(window.currentFarmId).update({ name: newName });
            } catch (e) { console.error("Could not sync Farm Name to cloud:", e); }
        }
    }

    const newCurrency = document.getElementById('setting-currency').value;
    if (newCurrency) {
        window.currencySymbol = newCurrency;
        localStorage.setItem('modsir_currency', newCurrency);
        setupModals(); // Refresh all modal internal strings
        updateDashboardStats(); // Refresh icons/symbols
    }

    if (avatarData && window.currentUser) {
        localStorage.setItem('modsir_avatar', avatarData);
        updateSidebarAvatar(avatarData);
        try {
            await db.collection('users').doc(window.currentUser.uid).update({ avatarBase64: avatarData });
        } catch (e) { console.error("Could not sync Avatar to cloud:", e); }
    }

    showToast("Success", "Settings saved successfully!", "success");
}

function updateSidebarAvatar(src) {
    const avatarIcon = document.querySelector('.user-profile i.fa-user-circle');
    if (avatarIcon) {
        const img = document.createElement('img');
        img.src = src;
        img.style.width = '24px';
        img.style.height = '24px';
        img.style.borderRadius = '50%';
        img.style.objectFit = 'cover';
        img.id = 'sidebar-avatar-img';
        avatarIcon.parentNode.replaceChild(img, avatarIcon);
    } else {
        const existingImg = document.getElementById('sidebar-avatar-img');
        if (existingImg) existingImg.src = src;
    }
}

window.switchPage = function(targetId) {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.main-content .page');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const item = Array.from(navItems).find(n => n.getAttribute('data-page') === targetId);

    if (!item) return;

    // Remove active classes
    navItems.forEach(nav => nav.classList.remove('active'));
    pages.forEach(page => {
        page.classList.remove('active');
        page.classList.add('hidden');
    });

    // Add active to nav
    item.classList.add('active');

    // Show target page
    document.getElementById(`page-${targetId}`).classList.remove('hidden');
    document.getElementById(`page-${targetId}`).classList.add('active');

    // Update Header
    pageTitle.innerText = item.innerText.trim();
    if (targetId === 'dashboard') {
        pageSubtitle.innerText = "Farm management overview";
    } else if (targetId === 'settings') {
        pageSubtitle.innerText = "Configure your application";
    } else if (targetId === 'finance') {
        pageSubtitle.innerText = "Manage your financial operations";
        renderMoneyFlowDashboard(); // Render custom UI
    } else if (targetId === 'operations') {
        pageSubtitle.innerText = "Manage equipment, staff logistics, and daily logs";
        renderOperationsDashboard();
    } else {
        pageSubtitle.innerText = `Manage your ${item.innerText.trim().toLowerCase()}`;
        if (targetId !== 'planner') renderPageTable(targetId);
    }

    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-page');
            window.switchPage(targetId);
        });
    });
}

// Intercept 'operations' page rendering
window.renderOperationsDashboard = async function() {
    try {
        const [equipment, workers, logs] = await Promise.all([
            FarmDB.getAll('equipment'),
            FarmDB.getAll('workers'),
            FarmDB.getAll('farmLogs')
        ]);

        // Evoke basic generic generator functions to spit out quick tables for these arrays
        const genTable = (arr, keys) => {
            if(arr.length===0) return '<p style="color:var(--text-muted); padding:10px;">No records found.</p>';
            let t = '<table class="data-grid"><thead><tr>';
            keys.forEach(k => t+=`<th>${k}</th>`);
            t += '</tr></thead><tbody>';
            arr.forEach(a => {
                t += '<tr>';
                keys.forEach(k => t+=`<td>${a[k]||'-'}</td>`);
                t += '</tr>';
            });
            t += '</tbody></table>';
            return t;
        };

        document.getElementById('equipment-grid-container').innerHTML = genTable(equipment, ['name', 'qty', 'condition', 'purchaseDate', 'cost']);
        document.getElementById('worker-grid-container').innerHTML = genTable(workers, ['name', 'role', 'salary', 'status']);
        document.getElementById('farmlogs-grid-container').innerHTML = genTable(logs, ['date', 'weather', 'notes', 'incidents']);

    } catch (e) {
        console.error("Operations Grid error:", e);
    }
}

// Intercept 'finance' page rendering to build custom grids
window.renderMoneyFlowDashboard = async function() {
    try {
        const [planned, expenses, sales] = await Promise.all([
            FarmDB.getAll('plannedExpenses'),
            FarmDB.getAll('expenses'), // generic expenses, wait maybe we should push purchased items to expenses?
            FarmDB.getAll('sales')
        ]);

        let totalPlanned = 0;
        let totalPurchased = 0;
        let totalIncome = 0;

        let tbody = '';
        const cats = ['Chicks', 'Feed', 'Medicine', 'Equipment', 'Brooding Heat', 'Utilities', 'Bedding & Hygiene', 'Operations', 'Other'];

        if (planned.length === 0) {
            tbody = `<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">No items planned yet. Click Add Row to start.</td></tr>`;
        } else {
            planned.forEach(item => {
                let cost = (parseFloat(item.qty) || 0) * (parseFloat(item.unitCost) || 0);
                totalPlanned += cost;
                let isPurchased = item.purchased === true;
                if (isPurchased) totalPurchased += cost;

                tbody += `
                    <tr data-id="${item.id}" style="${isPurchased ? 'background:rgba(30,189,93,0.05);' : ''}">
                        <td>
                            <select class="grid-input" onchange="gridSave(this, 'category')" ${isPurchased ? 'disabled' : ''}>
                                ${cats.map(c => `<option value="${c}" ${item.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                            </select>
                        </td>
                        <td><input type="text" class="grid-input" value="${item.title || ''}" onchange="gridSave(this, 'title')" ${isPurchased ? 'disabled' : ''}></td>
                        <td><input type="number" class="grid-input" value="${item.qty || 1}" oninput="updateGridRowCost(this)" onchange="gridSave(this, 'qty')" ${isPurchased ? 'disabled' : ''}></td>
                        <td><input type="number" class="grid-input" value="${item.unitCost || 0}" oninput="updateGridRowCost(this)" onchange="gridSave(this, 'unitCost')" ${isPurchased ? 'disabled' : ''}></td>
                        <td class="row-total">${window.currencySymbol}${cost.toLocaleString()}</td>
                        <td><input type="text" class="grid-input" value="${item.supplier || ''}" onchange="gridSave(this, 'supplier')" ${isPurchased ? 'disabled' : ''}></td>
                        <td style="text-align:center;"><input type="checkbox" class="grid-checkbox" ${isPurchased ? 'checked' : ''} onchange="markGridPurchased(this, '${item.id}')"></td>
                        <td><button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; color:var(--danger); border-color:var(--danger);" onclick="deleteGridRow('${item.id}')"><i class="fa-solid fa-trash"></i></button></td>
                    </tr>
                `;
            });
        }
        
        document.getElementById('expense-grid-body').innerHTML = tbody;
        document.getElementById('expense-grid-total').innerHTML = `${window.currencySymbol}${totalPlanned.toLocaleString()}`;

        // Compute Income grid from Sales
        sales.forEach(s => totalIncome += (parseFloat(s.totalPrice) || 0));
        let variance = totalPlanned - totalPurchased;

        document.getElementById('mf-planned').innerText = `${window.currencySymbol}${totalPlanned.toLocaleString()}`;
        document.getElementById('mf-actual').innerText = `${window.currencySymbol}${totalPurchased.toLocaleString()}`;
        document.getElementById('mf-income').innerText = `${window.currencySymbol}${totalIncome.toLocaleString()}`;
        
        document.getElementById('mf-variance').innerText = `Variance (Remaining): ${window.currencySymbol}${variance.toLocaleString()}`;
        document.getElementById('mf-net').innerText = `Net Balance: ${window.currencySymbol}${(totalIncome - totalPurchased).toLocaleString()}`;

        // Render Income Grid snippet
        let incomeHtml = '';
        if(sales.length === 0){
            incomeHtml = '<p style="color:var(--text-muted)">No income records.</p>';
        } else {
            incomeHtml = `<table class="data-grid"><thead><tr><th>Item</th><th>Qty</th><th>Customer</th><th>Paid / Debt</th><th>Total Income</th></tr></thead><tbody>`;
            sales.forEach(s => {
                incomeHtml += `<tr>
                    <td>${s.itemType || '-'}</td>
                    <td>${s.quantity || '-'}</td>
                    <td>${s.customerName || '-'}</td>
                    <td><span class="text-${s.paymentStatus==='Pending'?'danger':'success'}">${s.paymentStatus}</span></td>
                    <td style="color:var(--success); font-weight:600;">${window.currencySymbol}${s.totalPrice}</td>
                </tr>`;
            });
            incomeHtml += `</tbody></table>`;
        }
        document.getElementById('income-grid-container').innerHTML = incomeHtml;

    } catch(e) { console.error("MoneyFlow Grid error:", e); }
}

window.addPlannerRow = async function() {
    try {
        await FarmDB.addRecord('plannedExpenses', {
            category: 'Feed', title: 'New Item', qty: 1, unitCost: 0, supplier: '', purchased: false
        });
        renderMoneyFlowDashboard();
    } catch(e) { alert("Error adding row: " + e.message); }
}

window.deleteGridRow = async function(docId) {
    if(confirm("Delete this planned expense?")) {
        await FarmDB.deleteRecord('plannedExpenses', docId);
        renderMoneyFlowDashboard();
    }
}

window.updateGridRowCost = function(el) {
    const tr = el.closest('tr');
    const qty = parseFloat(tr.querySelectorAll('input[type="number"]')[0].value) || 0;
    const cost = parseFloat(tr.querySelectorAll('input[type="number"]')[1].value) || 0;
    tr.querySelector('.row-total').innerText = `${window.currencySymbol}${(qty * cost).toLocaleString()}`;
}

window.gridSave = async function(el, field) {
    const tr = el.closest('tr');
    const docId = tr.getAttribute('data-id');
    const val = el.value;
    try {
        let updateObj = {};
        updateObj[field] = (field === 'qty' || field === 'unitCost') ? Number(val) : val;
        await FarmDB.updateRecord('plannedExpenses', docId, updateObj);
        // Refresh silently not strictly needed unless totals change, but let's do it for accuracy
        if(field === 'qty' || field === 'unitCost') renderMoneyFlowDashboard(); 
    } catch(e) { console.error("Auto-save failed", e); }
}

window.markGridPurchased = async function(checkbox, docId) {
    const isPurchased = checkbox.checked;
    
    // Attempt saving
    try {
        await FarmDB.updateRecord('plannedExpenses', docId, { purchased: isPurchased });
        
        // If marked purchased, also log it to standard expenses (bonus feature the user wanted: "Expense automatically")
        if (isPurchased) {
            const tr = checkbox.closest('tr');
            const cat = tr.querySelector('select').value;
            const title = tr.querySelectorAll('input[type="text"]')[0].value;
            const qty = parseFloat(tr.querySelectorAll('input[type="number"]')[0].value) || 0;
            const cost = parseFloat(tr.querySelectorAll('input[type="number"]')[1].value) || 0;
            
            await FarmDB.addRecord('expenses', {
                category: cat,
                description: `${title} (x${qty}) from Planner`,
                amount: qty * cost
            });
            alert(`Moved ${title} to Actual Expenses!`);
        }
        
        renderMoneyFlowDashboard();
        updateDashboardStats();
        showToast("Success", `Moved ${title} to Actual Expenses!`, "success");
    } catch(e) { 
        showToast("Error", "Failed to mark purchased.", "error");
        checkbox.checked = !isPurchased; 
    }
}

async function renderPageTable(pageId) {
    const pageEl = document.getElementById(`page-${pageId}`);
    // Show Loading Skeleton
    let skeletonHtml = `<div style="background:var(--bg-panel); border:1px solid var(--bg-panel-border); border-radius:var(--border-radius-md); padding:20px;">
        <div class="skeleton" style="height:30px; width:40%; margin-bottom:20px;"></div>
        <div class="skeleton" style="height:200px; width:100%;"></div>
    </div>`;
    pageEl.innerHTML = `<h2>${document.getElementById('page-title').innerText}</h2><p style="color:var(--text-muted); margin-bottom: 24px;">Fetching data...</p>` + skeletonHtml;

    let html = `<div style="background:var(--bg-panel); border:1px solid var(--bg-panel-border); border-radius:var(--border-radius-md); padding:20px; overflow-x:auto;">`;

    try {
        let title = '';
        let records = [];

        if (pageId === 'batches') {
            title = 'Recent Batches & Flocks (Broilers)';
            records = await FarmDB.getAll('batches');
        } else if (pageId === 'feed') {
            title = 'Feed Usage Records';
            records = await FarmDB.getAll('feedUsage');
        } else if (pageId === 'eggs') {
            title = 'Egg Production Logs';
            records = await FarmDB.getAll('eggProduction');
        } else if (pageId === 'health') {
            title = 'Mortality & Health Logs';
            records = await FarmDB.getAll('mortality');
        } else if (pageId === 'finance') {
            title = 'Expense Logs';
            records = await FarmDB.getAll('expenses');
        } else if (pageId === 'sales') {
            title = 'Sales Records';
            records = await FarmDB.getAll('sales');
        }

        html += `<h3 style="margin-bottom:16px; font-weight:600;">${title}</h3>`;

        if (records.length === 0) {
            html += `<p style="color:var(--text-muted)">No records found. Use Quick Actions on the Dashboard to add data.</p>`;
        } else {
            // Build generic table structure based on keys of the first record (ignore generic fields for header if desired)
            const keys = Object.keys(records[0]).filter(k => !['id', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy'].includes(k));
            html += `<table style="width:100%; text-align:left; border-collapse:collapse;">
                <thead>
                    <tr style="border-bottom:1px solid var(--bg-panel-border);">
                        ${keys.map(k => `<th style="padding:12px; color:var(--text-muted); font-weight:500; text-transform:capitalize;">${k}</th>`).join('')}
                        <th style="padding:12px; color:var(--text-muted); font-weight:500; text-align:right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${records.map(r => `
                        <tr style="border-bottom:1px solid var(--bg-panel-border); transition: background 0.2s;" onmouseover="this.style.background='var(--bg-panel-hover)'" onmouseout="this.style.background='transparent'">
                            ${keys.map(k => `<td style="padding:12px;">${r[k] !== undefined ? r[k] : '-'}</td>`).join('')}
                            <td style="padding:12px; text-align:right;">
                                ${pageId === 'batches' ? `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; margin-right:4px; color:var(--primary); border-color:var(--primary);" onclick='viewBatchDetails(${JSON.stringify(r).replace(/'/g, "&#39;")})'><i class="fa-solid fa-eye"></i></button>` : ''}
                                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; margin-right:4px;" onclick='editRecord("${pageId}", ${JSON.stringify(r).replace(/'/g, "&#39;")})'><i class="fa-solid fa-pen"></i></button>
                                <button class="btn btn-outline" style="padding:4px 8px; font-size:0.8rem; color:var(--danger); border-color:var(--danger);" onclick="deleteRecord('${pageId}', '${r.id}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>`;
        }

    } catch (e) {
        html += `<p class="text-danger">Error loading data: ${e.message}</p>`;
    }

    html += `</div>`;

    // Replace the content after the header
    const headerHtml = `<h2>${document.getElementById('page-title').innerText}</h2><p style="color:var(--text-muted); margin-bottom: 24px;">View all logged entries</p>`;
    pageEl.innerHTML = headerHtml + html;
}

const pageStoreMap = {
    'batches': 'batches',
    'feed': 'feedUsage', // Or feedPurchases, maybe separate out soon
    'eggs': 'eggProduction',
    'health': 'mortality',
    'finance': 'expenses',
    'sales': 'sales',
    'customers': 'customers'
};

window.editRecord = function(pageId, recordData) {
    // Determine which modal and store mapping corresponds
    const storeName = pageStoreMap[pageId];
    if(!storeName) return alert("Not editable from here.");
    // We will build an auto-generated edit modal or populate an existing one
    buildDynamicEditModal(storeName, recordData, pageId);
}

window.deleteRecord = async function(pageId, docId) {
    const storeName = pageStoreMap[pageId];
    if(!storeName) return;
    if(confirm("Are you sure you want to delete this record? This action cannot be undone.")) {
        try {
            await FarmDB.deleteRecord(storeName, docId);
            renderPageTable(pageId);
            updateDashboardStats(); // update charts/totals
            showToast("Success", "Record deleted successfully.", "success");
        } catch (e) {
            showToast("Error", "Failed to delete record.", "error");
        }
    }
}

window.buildDynamicEditModal = function(storeName, existingData, pageId) {
    const modalId = 'dynamic-edit-modal';
    let overlay = document.getElementById('modal-overlay');
    let modalEl = document.getElementById(modalId);
    
    if(!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = modalId;
        modalEl.className = 'modal-content';
        overlay.appendChild(modalEl);
    }

    const formFields = Object.keys(existingData).filter(k => 
        !['id', 'createdBy', 'createdAt', 'updatedAt', 'updatedBy', 'createdDate'].includes(k)
    );

    let formHTML = `
        <div class="modal-header">
            <h2 style="color:var(--primary);"><i class="fa-solid fa-pen-to-square"></i> Edit Record</h2>
            <button class="close-btn" onclick="closeModal('${modalId}')"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
            <form onsubmit="submitDynamicEdit(event, '${storeName}', '${existingData.id}', '${pageId}')">
    `;

    formFields.forEach(k => {
        let val = existingData[k] || '';
        formHTML += `
            <div class="form-group">
                <label style="text-transform:capitalize;">${k}</label>
                <input type="text" name="${k}" value="${val}" required>
            </div>
        `;
    });

    formHTML += `
                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Changes</button>
            </form>
        </div>
    `;

    modalEl.innerHTML = formHTML;
    openModal(modalId);
}

window.submitDynamicEdit = async function(e, storeName, docId, pageId) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Attempt numeric casting for standard fields to maintain math integrity
    Object.keys(data).forEach(k => {
        if(!isNaN(data[k]) && data[k].trim() !== '') {
            data[k] = Number(data[k]);
        }
    });

    try {
        await FarmDB.updateRecord(storeName, docId, data);
        closeModal('dynamic-edit-modal');
        renderPageTable(pageId);
        updateDashboardStats();
        alert("Record updated successfully!");
    } catch(err) {
        alert("Failed to update record: " + err.message);
    }
}

window.viewBatchDetails = async function(batch) {
    // Hide all pages, show batch details
    document.querySelectorAll('.main-content .page').forEach(p => {
        p.classList.remove('active');
        p.classList.add('hidden');
    });
    const detailsPage = document.getElementById('page-batch-details');
    detailsPage.classList.remove('hidden');
    detailsPage.classList.add('active');

    // Set title
    document.getElementById('detail-batch-id').innerText = batch.batchId || batch.id;
    document.getElementById('detail-batch-desc').innerText = `Breed: ${batch.breed || 'Unknown'} | Supplier: ${batch.supplier || 'Unknown'}`;

    // 1. Calculate Age & Harvest
    let ageDays = 0;
    let harvestDateStr = "Unknown";
    if (batch.startDate) {
        const start = new Date(batch.startDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + (parseInt(batch.ageWeeks || 0) * 7);
        // Assuming 6 weeks (42 days) typical broiler harvest
        const harvest = new Date(start);
        harvest.setDate(harvest.getDate() + 42 - (parseInt(batch.ageWeeks || 0) * 7));
        harvestDateStr = harvest.toLocaleDateString();
    }
    const ageWeeks = Math.floor(ageDays / 7);
    document.getElementById('detail-age').innerText = `${ageDays} Days (${ageWeeks} Wks)`;
    document.getElementById('detail-harvest-date').innerText = `Expected Harvest: ${harvestDateStr}`;

    try {
        // Fetch related data
        const [feed, mortality] = await Promise.all([
            FarmDB.getAll('feedUsage'),
            FarmDB.getAll('mortality')
        ]);
        
        // Feed calculation
        // Filter feed used that might belong to this batch (Note: this prototype doesn't perfectly link feed to batch yet, so we assume a unified feed or a simple placeholder if no batch filter exists. We'll simulate if no batchId in feed)
        // In a real app, feedUsage should record which flock/batch it went to. 
        let consumedBags = 0;
        let consumedGrams = 0;
        document.getElementById('detail-feed').innerText = `${consumedBags} Bags`;

        // Mortality calculation
        let dead = 0;
        document.getElementById('detail-mortality').innerText = `0%`;
        const initial = parseInt(batch.numBirds || batch.numChicks || 0);
        document.getElementById('detail-surviving').innerText = `Surviving: ${initial}`;

        // Profit estimation placeholder
        const cost = initial * parseFloat(batch.costPerBird || batch.costPerChick || 0);
        document.getElementById('detail-profit').innerText = `-${window.currencySymbol}${cost.toLocaleString()}`;
        document.getElementById('detail-profit').className = 'stat-value text-danger';
        document.getElementById('detail-score').innerText = `Performance: Pending`;

    } catch (e) {
        console.error(e);
    }
}

function initCharts() {
    // Styling constants from CSS
    const gridColor = '#222225';
    const textColor = '#88888e';

    Chart.defaults.color = textColor;
    Chart.defaults.font.family = "'Inter', sans-serif";

    // Egg Production Chart
    const eggCtx = document.getElementById('eggChart');
    if (eggCtx) {
        eggChartInstance = new Chart(eggCtx, {
            type: 'line',
            data: {
                labels: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'],
                datasets: [{
                    label: 'Eggs Collected',
                    data: [0, 0, 0, 0, 0, 0, 0],
                    borderColor: '#1ebd5d',
                    backgroundColor: 'rgba(30, 189, 93, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: gridColor }, beginAtZero: true },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // Financial Chart
    const finCtx = document.getElementById('financeChart');
    if (finCtx) {
        financeChartInstance = new Chart(finCtx, {
            type: 'bar',
            data: {
                labels: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'],
                datasets: [
                    {
                        label: 'Income (₦)',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: '#1ebd5d',
                        borderRadius: 4
                    },
                    {
                        label: 'Expenses (₦)',
                        data: [0, 0, 0, 0, 0, 0, 0],
                        backgroundColor: '#ef4444',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: gridColor }, beginAtZero: true },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { position: 'top', labels: { color: textColor } } }
            }
        });
    }

    // Performance Chart (Feed vs Mortality)
    const perfCtx = document.getElementById('performanceChart');
    if (perfCtx) {
        performanceChartInstance = new Chart(perfCtx, {
            type: 'line',
            data: {
                labels: ['Wk1', 'Wk2', 'Wk3', 'Wk4', 'Wk5'],
                datasets: [
                    {
                        label: 'Feed Usage (Bags)',
                        data: [0, 0, 0, 0, 0],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Mortality (Count)',
                        data: [0, 0, 0, 0, 0],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderDash: [5, 5],
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { type: 'linear', display: true, position: 'left', grid: { color: gridColor } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { position: 'top', labels: { color: textColor } } }
            }
        });
    }
}

// UPDATE CHARTS LOGIC
window.updateDashboardCharts = function(stats) {
    // We mock realistic trends if actual weekly history matrix is unavailable at top level yet
    if(financeChartInstance) {
        financeChartInstance.data.datasets[0].data = [
            stats.isolatedCount * 12, stats.isolatedCount * 15, stats.isolatedProfit / 2, stats.isolatedProfit
        ];
        financeChartInstance.data.datasets[1].data = [
            stats.isolatedFeed * 15000, stats.isolatedFeed * 10000, stats.isolatedCount * 50, stats.isolatedCount * 50
        ];
        financeChartInstance.data.labels = ['Week 1', 'Week 2', 'Week 3', 'Current'];
        financeChartInstance.update();
    }
    if(performanceChartInstance) {
        performanceChartInstance.data.datasets[0].data = [
            stats.isolatedFeed * 0.2, stats.isolatedFeed * 0.5, stats.isolatedFeed * 0.8, stats.isolatedFeed
        ];
        performanceChartInstance.data.datasets[1].data = [
            0, 1, 1, stats.isolatedMortalityCount || 0
        ];
        performanceChartInstance.data.labels = ['Week 1', 'Week 2', 'Week 3', 'Current'];
        performanceChartInstance.update();
    }
}

// Global Dashboard State
window.dashboardView = 'broiler'; // 'broiler' or 'layer'

window.switchDashboardView = function (view) {
    window.dashboardView = view;

    const eggActionBtn = document.getElementById('egg-action-btn');
    const layerChart = document.getElementById('layer-chart-container');

    // Update Toggle Buttons UI
    if (view === 'broiler') {
        document.getElementById('tab-broiler').className = 'btn btn-primary';
        document.getElementById('tab-layer').className = 'btn btn-outline';
        if (layerChart) layerChart.style.display = 'none';   // Hide egg production chart
        if (eggActionBtn) eggActionBtn.style.display = 'none'; // Hide Record Eggs quick action
    } else {
        document.getElementById('tab-broiler').className = 'btn btn-outline';
        document.getElementById('tab-layer').className = 'btn btn-primary';
        if (layerChart) layerChart.style.display = 'block';  // Show egg production chart
        if (eggActionBtn) eggActionBtn.style.display = 'flex'; // Show Record Eggs quick action
    }

    // Refresh stats based on new view
    updateDashboardStats();
};

async function updateDashboardStats() {
    // Determine the view mode
    const view = window.dashboardView;

    // Get full stats
    const stats = await FarmDB.getDashboardStats();

    // Isolate Broilers vs Layers
    const birdCount = view === 'broiler' ? stats.broilers : stats.layers;
    const birdDesc = view === 'broiler' ? `${stats.broilers} active broilers` : `${stats.layers} active layers`;
    const mortalityRate = view === 'broiler' ? stats.broilerMortalityRate : stats.layerMortalityRate;
    const feedStock = view === 'broiler' ? stats.broilerFeedStock : stats.layerFeedStock;
    const profit = view === 'broiler' ? stats.broilerProfit : stats.layerProfit;
    const income = view === 'broiler' ? stats.broilerIncomeStr : stats.layerIncomeStr;

    // Update DOM elements
    document.getElementById('stat-total-birds').innerText = birdCount.toLocaleString();
    document.querySelector('#stat-total-birds + .stat-desc').innerText = birdDesc;

    const feedStockEl = document.getElementById('stat-feed-stock');
    feedStockEl.innerText = `${feedStock} bags`;
    if (feedStock <= 5) {
        feedStockEl.className = 'stat-value text-danger';
        feedStockEl.parentElement.classList.add('danger-card');
        document.querySelector('#stat-feed-stock + .stat-desc').innerText = "Low stock warning";
    } else {
        feedStockEl.className = 'stat-value text-success';
        feedStockEl.parentElement.classList.remove('danger-card');
        document.querySelector('#stat-feed-stock + .stat-desc').innerText = "Adequate stock";
    }

    const mortalityEl = document.getElementById('stat-mortality');
    if (mortalityEl) mortalityEl.innerText = `${mortalityRate}%`;

    const profitEl = document.getElementById('stat-profit');
    if (profitEl) profitEl.innerText = `${window.currencySymbol}${profit.toLocaleString()}`;

    const incomeDesc = document.querySelector('#stat-profit + .stat-desc');
    if (incomeDesc) incomeDesc.innerHTML = `<i class="fa-solid fa-arrow-trend-up text-success"></i> Income: ${window.currencySymbol}${income.toLocaleString()}`;

    // Calendar logic: fetch latest batch
    let batches = await FarmDB.getAll('batches');
    if (batches && batches.length > 0) {
        // Find most recent start date
        let latestDate = new Date(0);
        batches.forEach(b => {
            if (b.startDate) {
                let sD = new Date(b.startDate);
                if (sD > latestDate) latestDate = sD;
            }
        });
        if (latestDate.getTime() > 0) {
            let diff = Math.abs(new Date() - latestDate);
            let days = Math.floor(diff / (1000 * 60 * 60 * 24));
            document.getElementById('stat-calendar-days').innerText = `${days} Days`;
            document.getElementById('stat-calendar-date').innerText = latestDate.toLocaleDateString();
        } else {
            document.getElementById('stat-calendar-days').innerText = `N/A`;
            document.getElementById('stat-calendar-date').innerText = `No valid date`;
        }
    } else {
        document.getElementById('stat-calendar-days').innerText = `0 Days`;
        document.getElementById('stat-calendar-date').innerText = `No batches created`;
    }

    // Attempt to load weather if not already loaded
    if (!window.weatherLoaded) {
        fetchWeather();
    }

    // Pass view and isolated stats to charts and insights engine
    generateInsights({ ...stats, isolatedView: view, isolatedFeed: feedStock, isolatedMortality: mortalityRate, isolatedProfit: profit, isolatedCount: birdCount });
    updateDashboardCharts({ isolatedFeed: feedStock, isolatedMortalityCount: (view==='broiler'?stats.broilerDead:stats.layerDead), isolatedMortality: mortalityRate, isolatedProfit: profit, isolatedCount: birdCount });
}

async function fetchWeatherByLocation() {
    const city = document.getElementById('weather-city').value;
    if (!city || city.trim() === "") {
        return fetchWeather(); // Fallback to geolocation
    }
    
    document.getElementById('stat-weather-desc').innerText = "Fetching for " + city + "...";
    
    try {
        // First get lat/lon from city name using Nominatim (free geocoding)
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
        const geoData = await geoRes.json();
        
        if (geoData && geoData.length > 0) {
            const lat = geoData[0].lat;
            const lon = geoData[0].lon;
            await updateWeatherUI(lat, lon, city);
            showToast('Weather Updated', `Showing weather for ${city}`, 'success');
        } else {
            document.getElementById('stat-weather-desc').innerText = "City not found";
            showToast('Weather Error', 'Could not find that location', 'error');
        }
    } catch (e) {
        console.error("Weather fetch error:", e);
        document.getElementById('stat-weather-desc').innerText = "Fetch failed";
    }
}

async function fetchWeather() {
    window.weatherLoaded = true;
    
    // Check if we have a saved location in localStorage
    const savedLat = localStorage.getItem('modsir_weather_lat');
    const savedLon = localStorage.getItem('modsir_weather_lon');
    const savedLoc = localStorage.getItem('modsir_weather_name');

    if (savedLat && savedLon) {
        return updateWeatherUI(savedLat, savedLon, savedLoc || "Your Farm");
    }

    try {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;
                // Save it for next time to speed up load
                localStorage.setItem('modsir_weather_lat', lat);
                localStorage.setItem('modsir_weather_lon', lon);
                localStorage.setItem('modsir_weather_name', "Detecting...");
                await updateWeatherUI(lat, lon, "Your Location");
            }, (err) => {
                document.getElementById('stat-weather-desc').innerText = "Location denied. Enter city manually.";
                document.getElementById('stat-weather-temp').innerText = "N/A";
            });
        }
    } catch(e) {
        document.getElementById('stat-weather-desc').innerText = "Weather unavailable";
    }
}

// --- African Weather Geo-Selection Logic ---
window.initWeatherGeoData = function() {
    const countrySelect = document.getElementById('weather-country');
    if (!countrySelect) return;
    
    // Check if data is loaded, if not, try window
    const geoData = window.AFRICA_GEO_DATA;
    if (!geoData) {
        console.warn("Weather data not loaded yet.");
        return;
    }

    if (countrySelect.options.length > 1) return; // Already populated

    countrySelect.innerHTML = '<option value="">Select Country</option>';
    Object.keys(geoData).sort().forEach(country => {
        const opt = document.createElement('option');
        opt.value = country;
        opt.textContent = country;
        countrySelect.appendChild(opt);
    });
};

window.updateWeatherDistricts = function() {
    const country = document.getElementById('weather-country').value;
    const districtSelect = document.getElementById('weather-district');
    const citySelect = document.getElementById('weather-city-select');
    
    districtSelect.innerHTML = '<option value="">Select District</option>';
    citySelect.innerHTML = '<option value="">Select City</option>';

    if (country && AFRICA_GEO_DATA[country]) {
        Object.keys(AFRICA_GEO_DATA[country]).sort().forEach(district => {
            const opt = document.createElement('option');
            opt.value = district;
            opt.textContent = district;
            districtSelect.appendChild(opt);
        });
    }
};

window.updateWeatherCities = function() {
    const country = document.getElementById('weather-country').value;
    const district = document.getElementById('weather-district').value;
    const citySelect = document.getElementById('weather-city-select');
    
    citySelect.innerHTML = '<option value="">Select City</option>';

    if (country && district && AFRICA_GEO_DATA[country][district]) {
        Object.keys(AFRICA_GEO_DATA[country][district]).sort().forEach(city => {
            const opt = document.createElement('option');
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
        });
    }
};

window.applyWeatherLocation = function() {
    const country = document.getElementById('weather-country').value;
    const district = document.getElementById('weather-district').value;
    const city = document.getElementById('weather-city-select').value;

    if (!country || !district || !city) {
        return showToast("Required", "Please select all location fields.", "info");
    }

    const coords = AFRICA_GEO_DATA[country][district][city];
    if (coords) {
        localStorage.setItem('modsir_weather_lat', coords[0]);
        localStorage.setItem('modsir_weather_lon', coords[1]);
        localStorage.setItem('modsir_weather_name', city);
        localStorage.setItem('modsir_farm_location', `${city}, ${country}`);
        
        // Update user popup location display too
        const locDisplay = document.getElementById('popup-location');
        if (locDisplay) locDisplay.innerText = `${city}, ${country}`;

            // Update sidebar farm location display as well
            const sideLoc = document.getElementById('sidebar-farm-location');
            if (sideLoc) sideLoc.innerText = `Location: ${city}, ${country}`;

        updateWeatherUI(coords[0], coords[1], city);

        // --- SYNC TO FIRESTORE ---
        if (window.currentUser) {
            db.collection('users').doc(window.currentUser.uid).update({
                location: `${city}, ${country}`
            }).catch(e => console.warn("Firestore location sync failed", e));
        }

        closeModal('weather-location-modal');
        showToast("Success", `Location updated to ${city}, ${country}`, "success");
    }
};

window.showManualWeatherInput = function() {
    const manualDiv = document.getElementById('manual-weather-input');
    if (manualDiv) {
        manualDiv.style.display = manualDiv.style.display === 'none' ? 'flex' : 'none';
    }
};

async function updateWeatherUI(lat, lon, locationName) {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        if(res.ok) {
            const data = await res.json();
            let t = data.current_weather.temperature;
            let desc = "Clear";
            let code = data.current_weather.weathercode;
            let iconHtml = '<i class="fa-solid fa-sun icon-muted" style="color:#f59e0b;"></i>';
            
            if (code >= 1 && code <= 3) { desc = "Partly Cloudy"; iconHtml = '<i class="fa-solid fa-cloud-sun icon-muted"></i>'; }
            else if (code >= 51 && code <= 67) { desc = "Raining"; iconHtml = '<i class="fa-solid fa-cloud-rain text-primary icon-muted"></i>'; }
            else if (code >= 71) { desc = "Snow/Extreme"; iconHtml = '<i class="fa-solid fa-snowflake text-primary icon-muted"></i>'; }
            
            if (t < 18) { desc += " (Cold)"; }
            else if (t > 30) { desc += " (Hot - Watch Birds)"; }

            const tempEl = document.getElementById('stat-weather-temp');
            if (tempEl) tempEl.innerText = `${t}°C`;

            const descEl = document.getElementById('stat-weather-desc');
            if (descEl) descEl.innerText = `${desc} at ${locationName}`;

            const iconEl = document.getElementById('weather-icon');
            if (iconEl) {
                try { iconEl.outerHTML = iconHtml; } catch(e) { /* ignore */ }
            }
        }
    } catch(e) {
        console.error("Weather UI update error:", e);
    }
}

function generateInsights(stats) {
    // Find the dashboard container to inject insights
    const statsGrid = document.querySelector('.stats-grid');
    let insightsContainer = document.getElementById('smart-insights-container');

    if (!insightsContainer) {
        // Create it if it doesn't exist
        insightsContainer = document.createElement('div');
        insightsContainer.id = 'smart-insights-container';
        insightsContainer.style.cssText = 'background:var(--bg-panel); border:1px solid var(--primary); border-radius:var(--border-radius-md); padding:16px; margin-bottom:24px; animation: fadeIn 0.5s ease;';
        statsGrid.parentNode.insertBefore(insightsContainer, statsGrid.nextSibling);
    }

    let alertsHtml = `<h3 style="color:var(--primary); margin-bottom:12px; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-robot"></i> ${stats.isolatedView === 'broiler' ? 'Broiler' : 'Layer'} Insights</h3><div style="display:flex; flex-direction:column; gap:8px;">`;
    let hasAlerts = false;

    // Traffic Light DOM
    const healthLight = document.getElementById('health-light');
    const healthText = document.getElementById('health-text');
    let hState = 'green';
    let hLabel = 'Optimal';

    // Rule 1: Mortality Alert
    if (parseFloat(stats.isolatedMortality) > 5.0) {
        hasAlerts = true;
        hState = 'red'; hLabel = 'Critical Danger';
        alertsHtml += `<div style="padding:10px; background:rgba(239, 68, 68, 0.1); border-left:4px solid var(--danger); border-radius:4px;"><i class="fa-solid fa-triangle-exclamation text-danger"></i> <strong>High Mortality:</strong> Your mortality rate is at ${stats.isolatedMortality}%. Consider reviewing flock health immediately.</div>`;
        showToast('Health Danger', `Mortality at ${stats.isolatedMortality}%!`, 'error');
    }

    // Rule 2: Feed Alert
    if (stats.isolatedFeed <= 5 && stats.isolatedCount > 0) {
        hasAlerts = true;
        if(hState !== 'red') { hState = 'yellow'; hLabel = 'Low Resources'; }
        alertsHtml += `<div style="padding:10px; background:rgba(239, 68, 68, 0.1); border-left:4px solid var(--danger); border-radius:4px;"><i class="fa-solid fa-wheat-awn text-danger"></i> <strong>Critical Feed Levels:</strong> You have only ${stats.isolatedFeed} bags left for ${stats.isolatedCount} birds. Purchase more feed quickly.</div>`;
        showToast('Feed Alert', `Only ${stats.isolatedFeed} bags of feed left!`, 'warning');
    }

    // Rule 3: General positive reinforcement
    if (!hasAlerts && stats.isolatedProfit > 0) {
        alertsHtml += `<div style="padding:10px; background:rgba(30, 189, 93, 0.1); border-left:4px solid var(--success); border-radius:4px;"><i class="fa-solid fa-check text-success"></i> <strong>Operations Excellent:</strong> Feed stock is stable, mortality is low, and you are operating at a profit.</div>`;
        hasAlerts = true;
    }

    // Rule 4: Vaccine Alarms
    if (stats.vaccineData && stats.vaccineData.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let dueCount = 0;
        let nextDueStr = "";

        stats.vaccineData.forEach(v => {
            if (v.dueDate) {
                const vDate = new Date(v.dueDate);
                if (vDate <= today) {
                    dueCount++;
                    nextDueStr = v.vaccineName || "Medication";
                }
            }
        });

        if (dueCount > 0) {
            hasAlerts = true;
            alertsHtml += `<div style="padding:10px; background:rgba(245, 158, 11, 0.1); border-left:4px solid #f59e0b; border-radius:4px; margin-top:8px;"><i class="fa-solid fa-bell" style="color:#f59e0b;"></i> <strong style="color:#f59e0b;">Vaccine Due:</strong> You have ${dueCount} vaccine(s) scheduled for today or overdue (including ${nextDueStr}).</div>`;
        }
    }

    // Rule 5: Profitability & FCR warnings
    if (stats.isolatedProfit < 0) {
        hasAlerts = true;
        alertsHtml += `<div style="padding:10px; background:rgba(239, 68, 68, 0.1); border-left:4px solid var(--danger); border-radius:4px; margin-top:8px;"><i class="fa-solid fa-chart-line text-danger"></i> <strong>Negative Cash Flow:</strong> Your current view is running at a net loss of ${window.currencySymbol}${Math.abs(stats.isolatedProfit).toLocaleString()}. Review your expense planner to cut costs.</div>`;
    } else if (stats.isolatedProfit > 0 && stats.isolatedProfit > (stats.isolatedCount * 1500)) {
        // Just a heuristic example: assuming highly profitable boundary
        hasAlerts = true;
        alertsHtml += `<div style="padding:10px; background:rgba(30, 189, 93, 0.1); border-left:4px solid var(--success); border-radius:4px; margin-top:8px;"><i class="fa-solid fa-coins text-success"></i> <strong>High Profitability Margin:</strong> Your revenue per bird is excellent! Maintain current feeding and health protocols.</div>`;
    }

    if (!hasAlerts) {
        alertsHtml += `<div style="padding:10px; color:var(--text-muted);"><i class="fa-solid fa-circle-info"></i> Collect more data to generate insights.</div>`;
    }

    alertsHtml += '</div>';
    insightsContainer.innerHTML = alertsHtml;

    if (healthLight && healthText) {
        healthLight.className = `status-light status-${hState}`;
        healthText.innerText = hLabel;
        if(hState === 'green') healthText.style.color = 'var(--success)';
        else if (hState === 'yellow') healthText.style.color = '#f59e0b';
        else if (hState === 'red') healthText.style.color = 'var(--danger)';
    }
}

// Modal System
function setupModals() {
    // Define base modal HTML structure
    const modalHTML = `
        <!-- SALES MODAL -->
        <div id="sale-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2 style="color:var(--success);"><i class="fa-solid fa-tags"></i> Record Sale</h2>
                <button class="close-btn" onclick="closeModal('sale-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-sale" onsubmit="handleFormSubmit(event, 'sales')">
                    <div class="form-group">
                        <label>Item Sold</label>
                        <select name="itemType">
                            <option value="Broilers">Broiler Birds</option>
                            <option value="Layers">Layer Birds (Spent Hens)</option>
                            <option value="Eggs">Eggs (Trays/Crates)</option>
                            <option value="Manure">Manure (Bags)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Quantity Sold</label>
                        <input type="number" name="quantity" required placeholder="e.g. 50">
                    </div>
                    <div class="form-group">
                        <label>Total Price Received (${window.currencySymbol})</label>
                        <input type="number" name="totalPrice" required placeholder="100000">
                    </div>
                    <div class="form-group">
                        <label>Customer Name</label>
                        <input type="text" name="customerName" required placeholder="John Doe">
                    </div>
                    <div class="form-group">
                        <label>Payment Status</label>
                        <select name="paymentStatus" id="sale-payment-status" onchange="document.getElementById('sale-amount-paid-group').style.display = this.value === 'Partial' ? 'block' : 'none'">
                            <option value="Paid">Fully Paid</option>
                            <option value="Pending">Pending (Credit)</option>
                            <option value="Partial">Partial Payment</option>
                        </select>
                    </div>
                    <div class="form-group" id="sale-amount-paid-group" style="display:none;">
                        <label>Amount Paid Now (${window.currencySymbol})</label>
                        <input type="number" name="amountPaid" placeholder="50000">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Complete Sale</button>
                </form>
            </div>
        </div>
        <!-- CUSTOMER MODAL -->
        <div id="customer-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2 style="color:#a855f7;"><i class="fa-solid fa-users"></i> Add Customer</h2>
                <button class="close-btn" onclick="closeModal('customer-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-customer" onsubmit="handleFormSubmit(event, 'customers')">
                    <div class="form-group">
                        <label>Customer Name</label>
                        <input type="text" name="name" required placeholder="Jane Doe">
                    </div>
                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="text" name="phone" placeholder="08012345678">
                    </div>
                    <div class="form-group">
                        <label>Location / Address</label>
                        <input type="text" name="location" placeholder="Market Road">
                    </div>
                    <div class="form-group">
                        <label>Initial Debt (${window.currencySymbol})</label>
                        <input type="number" name="debtAmount" placeholder="0" value="0">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Customer</button>
                </form>
            </div>
        </div>
        <!-- BATCH MODAL -->
        <div id="batch-modal" class="modal-content" style="display:none; max-height:90vh; overflow-y:auto;">
            <div class="modal-header">
                <h2>Start New Batch / Flock</h2>
                <button class="close-btn" onclick="closeModal('batch-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-batch" onsubmit="handleFormSubmit(event, 'batches')">
                    <div class="form-group">
                        <label>Batch / Flock ID</label>
                        <input type="text" name="batchId" required placeholder="e.g. Broiler-Batch-01">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1;">
                            <label>Start Date</label>
                            <input type="date" name="startDate" required>
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Arrival Age (Weeks)</label>
                            <input type="number" name="ageWeeks" required placeholder="e.g. 0" value="0">
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1;">
                            <label>Number of Birds</label>
                            <input type="number" name="numBirds" required placeholder="500">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Cost per Bird (${window.currencySymbol})</label>
                            <input type="number" name="costPerBird" required placeholder="800">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Supplier / Hatchery</label>
                        <input type="text" name="supplier" placeholder="e.g. Zartech Farms">
                    </div>
                    <div class="form-group">
                        <label>Breed</label>
                        <input type="text" name="breed" placeholder="e.g. Ross 308 / Isa Brown">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Batch</button>
                </form>
            </div>
        </div>
        
        <!-- EGG MODAL -->
        <div id="egg-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2>Record Egg Production</h2>
                <button class="close-btn" onclick="closeModal('egg-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-egg" onsubmit="handleFormSubmit(event, 'eggProduction')">
                    <div class="form-group">
                        <label>Flock ID</label>
                        <input type="text" name="flockId" required placeholder="e.g. Layer-Flock-01">
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1;">
                            <label>Total Collected</label>
                            <input type="number" name="collected" required placeholder="120">
                        </div>
                        <div class="form-group" style="flex:1;">
                            <label>Broken Eggs</label>
                            <input type="number" name="broken" required placeholder="2" value="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Egg Size Grade</label>
                        <select name="eggSize">
                            <option value="Mixed">Mixed (Unsorted)</option>
                            <option value="Small">Small (Pullet)</option>
                            <option value="Medium">Medium</option>
                            <option value="Large">Large / Jumbo</option>
                        </select>
                    </div>
                    <!-- The auto-calculate production % will be calculated via a dynamic hook later or saved as is -->
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Record</button>
                </form>
            </div>
        </div>

        <!-- FEED MODAL -->
        <div id="feed-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2>Record Feed Usage OR Purchase</h2>
                <button class="close-btn" onclick="closeModal('feed-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <!-- Using quick JS inline hack for dual purpose form -->
                <div style="display:flex; gap:10px; margin-bottom: 16px;">
                    <button type="button" class="btn btn-outline" style="flex:1" onclick="document.getElementById('feed-form').dataset.store='feedUsage'; this.style.borderColor='var(--primary)'; this.nextElementSibling.style.borderColor='var(--bg-panel-border)'; document.getElementById('feed-cost-group').style.display='none';">Usage</button>
                    <button type="button" class="btn btn-outline" style="flex:1" onclick="document.getElementById('feed-form').dataset.store='feedPurchases'; this.style.borderColor='var(--primary)'; this.previousElementSibling.style.borderColor='var(--bg-panel-border)'; document.getElementById('feed-cost-group').style.display='block';">Purchase</button>
                </div>
                <form id="feed-form" data-store="feedUsage" onsubmit="handleFormSubmit(event, this.dataset.store)">
                    <div class="form-group">
                        <label>Feed Type</label>
                        <select name="type">
                            <option value="Starter">Starter</option>
                            <option value="Grower">Grower</option>
                            <option value="Finisher">Finisher</option>
                            <option value="Layer Mash">Layer Mash</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Number of Bags</label>
                        <input type="number" name="bags" id="feed-bags-input" required placeholder="5">
                        <script>
                            // Handle mapped names depending on store mode during submit
                            document.getElementById('feed-form').addEventListener('submit', function(e) {
                                if(this.dataset.store === 'feedUsage') {
                                    this.querySelector('#feed-bags-input').name = 'bagsUsed';
                                } else {
                                    this.querySelector('#feed-bags-input').name = 'bags';
                                }
                            });
                        </script>
                    </div>
                    <div class="form-group" id="feed-cost-group" style="display:none;">
                        <label>Cost per Bag (${window.currencySymbol})</label>
                        <input type="number" name="costPerBag" placeholder="12000">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Feed Record</button>
                </form>
            </div>
        </div>

        <!-- EQUIPMENT MODAL -->
        
        <!-- NEW FARM MODAL -->
        <div id="new-farm-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2><i class="fa-solid fa-house-chimney"></i> Add New Farm</h2>
                <button class="close-btn" onclick="closeModal('new-farm-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form onsubmit="createNewFarm(event)">
                    <div class="form-group"><label>Farm Name</label><input type="text" id="new-farm-name" required placeholder="My Awesome Farm"></div>
                    <div class="form-group"><label>Primary Focus</label>
                        <select id="new-farm-type" required>
                            <option value="Mixed">Mixed (Broilers & Layers)</option>
                            <option value="Broiler">Broilers Only (Meat)</option>
                            <option value="Layer">Layers Only (Eggs)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Create Farm</button>
                </form>
            </div>
        </div>
        <div id="equipment-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2><i class="fa-solid fa-toolbox"></i> Add Equipment</h2>
                <button class="close-btn" onclick="closeModal('equipment-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form onsubmit="handleFormSubmit(event, 'equipment')">
                    <div class="form-group"><label>Asset Type</label>
                        <input list="equip-list" name="name" required placeholder="Select or type custom name..." style="width:100%; padding:12px; background:var(--bg-main); border:1px solid var(--bg-panel-border); border-radius:8px; color:white;">
                        <datalist id="equip-list">
                            <option value="Drinkers">
                            <option value="Feeders">
                            <option value="Wheelbarrows">
                            <option value="Shovels">
                            <option value="Lights">
                            <option value="Generators">
                            <option value="Heaters">
                        </datalist>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1;"><label>Quantity</label><input type="number" name="qty" required placeholder="10"></div>
                        <div class="form-group" style="flex:1;"><label>Condition</label>
                            <select name="condition"><option value="Good">Good</option><option value="Fair">Fair</option><option value="Needs Repair">Needs Repair</option><option value="Broken">Broken</option></select>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1;"><label>Purchase Date</label><input type="date" name="purchaseDate"></div>
                        <div class="form-group" style="flex:1;"><label>Total Cost (${window.currencySymbol})</label><input type="number" name="cost" placeholder="0"></div>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Asset</button>
                </form>
            </div>
        </div>

        <!-- WORKER MODAL -->
        <div id="worker-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2><i class="fa-solid fa-users-gear"></i> Add Staff / Worker</h2>
                <button class="close-btn" onclick="closeModal('worker-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form onsubmit="handleFormSubmit(event, 'workers')">
                    <div class="form-group"><label>Full Name</label><input type="text" name="name" required></div>
                    <div class="form-group"><label>Role</label><input type="text" name="role" required placeholder="e.g. Farm Hand"></div>
                    <div class="form-group"><label>Monthly Salary (${window.currencySymbol})</label><input type="number" name="salary" required></div>
                    <div class="form-group"><label>Payment Status</label>
                        <select name="status"><option value="Paid">Paid</option><option value="Pending">Pending</option></select>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Worker</button>
                </form>
            </div>
        </div>

        <!-- LOG MODAL -->
        <div id="log-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2><i class="fa-solid fa-book-open"></i> Daily Farm Log</h2>
                <button class="close-btn" onclick="closeModal('log-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form onsubmit="handleFormSubmit(event, 'farmLogs')">
                    <div class="form-group"><label>Date</label><input type="date" name="date" required></div>
                    <div class="form-group"><label>Weather</label><input type="text" name="weather" placeholder="Sunny, Rainy, etc."></div>
                    <div class="form-group"><label>General Notes</label><textarea name="notes" rows="3" style="width:100%; padding:8px; border-radius:4px;" placeholder="Flock looking healthy..."></textarea></div>
                    <div class="form-group"><label>Incidents (Optional)</label><input type="text" name="incidents" placeholder="Power outage at 2PM"></div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Log</button>
                </form>
            </div>
        </div>

        <!-- MORTALITY MODAL -->
        <div id="mortality-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2>Record Mortality</h2>
                <button class="close-btn" onclick="closeModal('mortality-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-mortality" onsubmit="handleFormSubmit(event, 'mortality')">
                    <div class="form-group">
                        <label>Bird Type</label>
                        <select name="type">
                            <option value="broiler">Broiler</option>
                            <option value="layer">Layer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Number of Deaths</label>
                        <input type="number" name="deaths" required placeholder="5">
                    </div>
                    <div class="form-group">
                        <label>Suspected Cause (Optional)</label>
                        <input type="text" name="cause" placeholder="e.g. Heat stress">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Record</button>
                </form>
            </div>
        </div>

        <!-- EXPENSE MODAL -->
        <div id="expense-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2>Log Custom Expense</h2>
                <button class="close-btn" onclick="closeModal('expense-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-expense" onsubmit="handleFormSubmit(event, 'expenses')">
                    <div class="form-group">
                        <label>Category</label>
                        <select name="category">
                            <option value="Medicine">Medicine/Vaccine</option>
                            <option value="Operational">Operational (Electricity/Fuel)</option>
                            <option value="Labor">Labor/Salaries</option>
                            <option value="Fixed">Fixed/Equipment</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Amount (${window.currencySymbol})</label>
                        <input type="number" name="amount" required placeholder="5000">
                    </div>
                    <div class="form-group">
                        <label>Description (Optional)</label>
                        <input type="text" name="description" placeholder="e.g. Bought multivitamins">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Save Expense</button>
                </form>
            </div>
        </div>

        <!-- VACCINE SCHEDULER MODAL -->
        <div id="vaccine-modal" class="modal-content" style="display:none;">
            <div class="modal-header">
                <h2 style="color:var(--primary);"><i class="fa-solid fa-syringe"></i> Schedule Vaccine</h2>
                <button class="close-btn" onclick="closeModal('vaccine-modal')"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <form id="form-vaccine" onsubmit="handleFormSubmit(event, 'vaccines')">
                    <div class="form-group">
                        <label>Flock / Batch ID</label>
                        <input type="text" name="flockId" required placeholder="e.g. Broiler-01">
                    </div>
                    <div class="form-group">
                        <label>Vaccine / Medicine Name</label>
                        <input type="text" name="vaccineName" required placeholder="e.g. Newcastle Disease">
                    </div>
                    <div class="form-group">
                        <label>Due Date</label>
                        <input type="date" name="dueDate" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%; margin-top:16px;">Schedule Vaccine</button>
                </form>
            </div>
        </div>

        <style>
            .modal-content {
                background: var(--bg-main);
                border: 1px solid var(--bg-panel-border);
                border-radius: var(--border-radius-lg);
                width: 90%;
                max-width: 500px;
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .modal-header {
                display: flex;
                justify-content: space-between;
                padding: 20px;
                border-bottom: 1px solid var(--bg-panel-border);
            }
            .modal-header h2 { font-size: 1.25rem; }
            .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; }
            .close-btn:hover { color: var(--text-main); }
            .modal-body { padding: 20px; }
            .form-group { margin-bottom: 16px; }
            .form-group label { display: block; margin-bottom: 8px; font-size: 0.9rem; color: var(--text-muted); }
            .form-group input, .form-group select {
                width: 100%; padding: 10px;
                background: var(--bg-panel); border: 1px solid var(--bg-panel-border);
                color: var(--text-main); border-radius: var(--border-radius-sm);
            }
            .form-group input:focus, .form-group select:focus { outline: 1px solid var(--primary); }
        </style>
    `;

    document.getElementById('modal-overlay').innerHTML = modalHTML;

    // Close modal on outside click
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeAllModals();
    });
}

window.openModal = function (modalId) {
    document.getElementById('modal-overlay').style.display = 'block';

    // Hide all contents first
    const contents = document.querySelectorAll('.modal-content');
    contents.forEach(c => c.style.display = 'none');

    // Show target
    const target = document.getElementById(modalId);
    if (target) {
        target.style.display = 'block';
        // SPECIAL: Ensure weather data is initialized if this is the weather modal
        if (modalId === 'weather-location-modal' && typeof initWeatherGeoData === 'function') {
            initWeatherGeoData();
        }
    }
};

window.closeModal = function (modalId) {
    const target = document.getElementById(modalId);
    if (target) target.style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
};

window.closeAllModals = function () {
    const contents = document.querySelectorAll('.modal-content');
    contents.forEach(c => c.style.display = 'none');
    document.getElementById('modal-overlay').style.display = 'none';
};

window.handleFormSubmit = async function (e, storeName) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Intercept sales for Debt tracking
    if (storeName === 'sales') {
        let total = parseFloat(data.totalPrice) || 0;
        let pStatus = data.paymentStatus;
        let paid = 0;
        let debt = 0;
        if (pStatus === 'Paid') { paid = total; debt = 0; }
        else if (pStatus === 'Pending') { paid = 0; debt = total; }
        else if (pStatus === 'Partial') { paid = parseFloat(data.amountPaid) || 0; debt = total - paid; }

        data.amountPaid = paid;
        data.debtAdded = debt;

        if (debt > 0 && data.customerName && data.customerName.trim() !== '') {
            try {
                let custName = data.customerName.trim();
                let custSnapshot = await FarmDB._getCollectionRef('customers').where('name', '==', custName).get();
                if (custSnapshot.empty) {
                    await FarmDB.addRecord('customers', { name: custName, debtAmount: debt, phone: '', location: '' });
                } else {
                    let doc = custSnapshot.docs[0];
                    let currentDebt = parseFloat(doc.data().debtAmount || 0);
                    await FarmDB.updateRecord('customers', doc.id, { debtAmount: currentDebt + debt });
                }
            } catch(ex) { console.error("Could not update customer debt", ex); }
        }
    }

    try {
        const newRecordRef = await FarmDB.addRecord(storeName, data);
        e.target.reset();
        closeAllModals();
        await updateDashboardStats(); // Refresh dashboard
        
        if (storeName === 'sales') {
            if(confirm("Sale logged successfully! Would you like to generate a PDF receipt?")) {
                generateReceiptPDF({...data, id: newRecordRef.id});
            }
        } else {
            showToast("Success", "Record saved successfully!", "success");
        }
    } catch (err) {
        showToast("Error", "Failed to save record.", "error");
    }
}

// --- PDF Generation System ---
window.generateReceiptPDF = function(saleData) {
    if(!window.jspdf) {
        return alert("PDF Library not loaded yet.");
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const farmName = localStorage.getItem('modsir_farm_name') || 'PoultryPro Farm';
    const ownerName = window.currentUser ? window.currentUser.displayName : 'Farm Owner';

    // Header
    doc.setFontSize(22);
    doc.setTextColor(30, 189, 93); // Primary Green
    doc.text(farmName, 105, 20, null, null, "center");
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Owner: ${ownerName}`, 105, 26, null, null, "center");
    doc.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 105, 32, null, null, "center");
    
    // Receipt Info
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Receipt #: ${saleData.id.slice(0, 8).toUpperCase()}`, 14, 45);
    
    doc.setFontSize(11);
    doc.text(`Customer Name: ${saleData.customerName || 'Walk-in'}`, 14, 55);
    doc.text(`Payment Status: ${saleData.paymentStatus}`, 14, 62);
    if(saleData.paymentStatus === 'Partial' || saleData.paymentStatus === 'Pending') {
        doc.text(`Debt Remaining: ${window.currencySymbol}${saleData.debtAdded}`, 14, 69);
    }

    // Table
    const tableBody = [
        [saleData.itemType, saleData.quantity, `${window.currencySymbol}${saleData.totalPrice}`]
    ];
    
    doc.autoTable({
        startY: 75,
        head: [['Item Description', 'Quantity', 'Total Amount']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [30, 189, 93] }
    });

    // Footer
    const finalY = doc.lastAutoTable.finalY || 75;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`Grand Total: ${window.currencySymbol}${saleData.totalPrice}`, 14, finalY + 10);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text("Official Invoice generated by www.poultypro.com", 105, 280, null, null, "center");

    // Output
    doc.save(`Receipt_${saleData.customerName || 'Sale'}_${new Date().getTime()}.pdf`);
}

window.generateFullReportPDF = async function() {
    if(!window.jspdf) return alert("PDF Library not loaded yet.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    try {
        const stats = await FarmDB.getDashboardStats();
        const farmName = localStorage.getItem('modsir_farm_name') || 'PoultryPro Farm';
        
        doc.setFontSize(22);
        doc.setTextColor(30, 189, 93);
        doc.text(farmName + " - Executive Summary", 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
        
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text("Flock Demographics", 14, 40);
        
        doc.autoTable({
            startY: 45,
            head: [['Metric', 'Broilers', 'Layers', 'Total']],
            body: [
                ['Active Birds', stats.broilers, stats.layers, stats.broilers + stats.layers],
                ['Mortality Rate', `${stats.broilerMortalityRate}%`, `${stats.layerMortalityRate}%`, '-'],
                ['Remaining Feed', `${stats.broilerFeedStock} bags`, `${stats.layerFeedStock} bags`, '-']
            ],
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] }
        });

        const finalY1 = doc.lastAutoTable.finalY + 15;
        doc.text("Financial Overview", 14, finalY1);
        
        const netProfitStr = (stats.broilerProfit + stats.layerProfit) >= 0 ? 
            `${window.currencySymbol}${(stats.broilerProfit + stats.layerProfit).toLocaleString()}` : 
            `-${window.currencySymbol}${Math.abs(stats.broilerProfit + stats.layerProfit).toLocaleString()}`;
            
        doc.autoTable({
            startY: finalY1 + 5,
            head: [['Category', 'Broiler Division', 'Layer Division', 'Net Profit']],
            body: [
                ['Income', `${window.currencySymbol}${stats.broilerIncomeStr}`, `${window.currencySymbol}${stats.layerIncomeStr}`, ''],
                ['Est. Expense', `-`, `-`, ''],
                ['Profit/Loss', `${window.currencySymbol}${stats.broilerProfit.toLocaleString()}`, `${window.currencySymbol}${stats.layerProfit.toLocaleString()}`, netProfitStr]
            ],
            theme: 'grid',
            headStyles: { fillColor: [30, 189, 93] }
        });

        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text("End of automated report.", 105, 280, null, null, "center");
        // Output
        doc.save(`Farm_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch(e) {
        console.error(e);
        alert("Failed to generate report.");
    }
}

// --- Owner Profile ---
window.saveOwnerProfile = async function(e) {
    e.preventDefault();
    try {
        const uid = window.currentUser.uid;
        await db.collection('users').doc(uid).update({
            name: document.getElementById('setting-owner-name').value,
            phone: document.getElementById('setting-owner-phone').value,
            location: document.getElementById('setting-owner-location').value,
            bio: document.getElementById('setting-owner-bio').value
        });
        alert('Owner Profile updated successfully!');
    } catch(err) {
        console.error(err);
        alert('Failed to update profile.');
    }
}

window.loadOwnerProfile = async function(uid) {
    try {
        const docSnap = await db.collection('users').doc(uid).get();
        if (docSnap.exists) {
            const data = docSnap.data();
            document.getElementById('setting-owner-name').value = data.name || '';
            document.getElementById('setting-owner-phone').value = data.phone || '';
            document.getElementById('setting-owner-location').value = data.location || '';
            document.getElementById('setting-owner-bio').value = data.bio || '';
        }
    } catch(err) { console.error("Error loading profile", err); }
}

// --- Smart Planner Logic ---

window.calculateFeed = function (e) {
    e.preventDefault();
    const birds = parseInt(document.getElementById('calc-feed-birds').value) || 0;
    const days = parseInt(document.getElementById('calc-feed-days').value) || 0;
    const intake = parseInt(document.getElementById('calc-feed-intake').value) || 0;
    const bagSize = parseInt(document.getElementById('calc-feed-bagsize').value) || 25;

    const totalGrams = birds * days * intake;
    const totalKg = totalGrams / 1000;
    const bagsNeeded = Math.ceil(totalKg / bagSize);

    document.getElementById('res-feed-bags').innerText = bagsNeeded;
    document.getElementById('res-feed-kg').innerText = totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 });
    document.getElementById('calc-feed-result').style.display = 'block';
};

window.calculateProfit = function (e) {
    e.preventDefault();
    const birds = parseInt(document.getElementById('calc-profit-birds').value) || 0;
    const price = parseFloat(document.getElementById('calc-profit-price').value) || 0;
    const cost = parseFloat(document.getElementById('calc-profit-cost').value) || 0;
    const mortality = parseFloat(document.getElementById('calc-profit-mortality').value) || 0;

    const survivingBirds = Math.floor(birds * (1 - (mortality / 100)));
    const revenue = survivingBirds * price;
    const profit = revenue - cost;

    document.getElementById('res-profit-value').innerText = `${window.currencySymbol}${profit.toLocaleString()}`;
    document.getElementById('res-profit-sold').innerText = survivingBirds.toLocaleString();
    document.getElementById('res-profit-revenue').innerText = `${window.currencySymbol}${revenue.toLocaleString()}`;

    // Update planner cost label if exists
    const lblCost = document.getElementById('lbl-profit-cost');
    if (lblCost) lblCost.innerText = `Total Estimated Cost (Feed + Chick Cost) (${window.currencySymbol})`;

    const resultDiv = document.getElementById('calc-profit-result');
    resultDiv.style.display = 'block';

    if (profit >= 0) {
        resultDiv.style.borderColor = 'var(--success)';
        resultDiv.style.background = 'rgba(30, 189, 93, 0.1)';
        document.querySelector('#calc-profit-result h4').style.color = 'var(--success)';
    } else {
        resultDiv.style.borderColor = 'var(--danger)';
        resultDiv.style.background = 'rgba(239, 68, 68, 0.1)';
        document.querySelector('#calc-profit-result h4').style.color = 'var(--danger)';
    }
};

window.calculateBatch = function (e) {
    e.preventDefault();
    const arrivalDateStr = document.getElementById('calc-batch-date').value;
    const targetWeeks = parseInt(document.getElementById('calc-batch-weeks').value) || 6;

    if (!arrivalDateStr) return;

    const arrivalDate = new Date(arrivalDateStr);
    const harvestDate = new Date(arrivalDate);
    harvestDate.setDate(harvestDate.getDate() + (targetWeeks * 7));

    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('res-batch-date').innerText = harvestDate.toLocaleDateString(undefined, options);

    document.getElementById('calc-batch-result').style.display = 'block';
};

window.downloadBackupCSV = async function () {
    if (!window.currentFarmId) return alert("Must be logged in.");
    try {
        const stats = await FarmDB.getDashboardStats();

        const csvContent = "data:text/csv;charset=utf-8,"
            + "ModSir Farm Report\n\n"
            + `Metric,Value\n`
            + `Total Broilers Logged,${stats.broilers}\n`
            + `Total Layers Logged,${stats.layers}\n`
            + `Broiler Feed Stock (Bags),${stats.broilerFeedStock}\n`
            + `Layer Feed Stock (Bags),${stats.layerFeedStock}\n`
            + `Broiler Lifetime Profit (${window.currencySymbol}),${stats.broilerProfit}\n`
            + `Layer Lifetime Profit (${window.currencySymbol}),${stats.layerProfit}\n`
            + `Broiler Mortality Rate (%),${stats.broilerMortalityRate}\n`
            + `Layer Mortality Rate (%),${stats.layerMortalityRate}\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ModSir_Farm_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        alert("Backup failed: " + err.message);
    }
}

// --- SETTINGS ACCORDION ---
window.toggleAccordion = function (itemId) {
    const item = document.getElementById(itemId);
    if (!item) return;

    // Toggle current
    item.classList.toggle('open');

    // Optional: Close others
    const others = document.querySelectorAll('.accordion-item');
    others.forEach(other => {
        if (other.id !== itemId) other.classList.remove('open');
    });
};

// --- USER PROFILE POPUP ---
window.toggleUserPopup = function () {
    const popup = document.getElementById('user-popup');
    if (!popup) return;

    const isHidden = popup.style.display === 'none';
    popup.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
        updateUserPopupInfo();
        // Close on outside click
        const closePopup = (e) => {
            if (!popup.contains(e.target) && !document.querySelector('.user-profile').contains(e.target)) {
                popup.style.display = 'none';
                document.removeEventListener('click', closePopup);
            }
        };
        setTimeout(() => document.addEventListener('click', closePopup), 10);
    }
};

