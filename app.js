/**
 * 職域代碼管理系統 - 前端邏輯 v4.0 (穩定還原+精準優化版)
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbxJF9-YIPNUHaLdlcwQb9HMwbNv4FvEhDUa3XpfQB2iUMRrsnhUgVj74nsIEyEgbPDhpw/exec';

// State
let currentUser = localStorage.getItem('user_id');
let cachedData = JSON.parse(localStorage.getItem('dashboard_data') || '{}');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showDashboard();
    } else {
        showPage('login');
    }

    setupTabSwitching();
    setupInquiryFilters();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
});

// Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${pageId}Page`).classList.add('active');
}

function showDashboard() {
    document.getElementById('displayUserId').textContent = `ID: ${currentUser}`;
    showPage('dashboard');
    refreshDashboardData();
}

function setupTabSwitching() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(`${tabId}Tab`).classList.add('active');

            if (tabId === 'history') refreshHistory();
            if (tabId === 'backfill') initBackfillForm();
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        location.reload();
    });
}

// Login
document.getElementById('loginBtn').addEventListener('click', async () => {
    const user = document.getElementById('username').value.trim();
    const key = document.getElementById('password').value.trim();
    if (!user || !key) return alert('請輸入帳號密碼');

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = '登入中...';

    try {
        const res = await fetch(`${API_URL}?action=login&user=${user}&key=${key}`);
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('user_id', currentUser);
            showDashboard();
        } else {
            alert('代碼或密碼錯誤');
        }
    } catch (err) {
        alert('連線失敗');
    } finally {
        btn.disabled = false;
        btn.textContent = '登入系統';
    }
});

// Inquiry
async function refreshDashboardData() {
    const list = document.getElementById('inquiryList');
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280;">載入中...</div>';

    try {
        const res = await fetch(`${API_URL}?action=getDashboardData&user=${currentUser}&t=${Date.now()}`);
        const data = await res.json();
        if (data.success) {
            cachedData = data;
            localStorage.setItem('dashboard_data', JSON.stringify(data));
            renderInquiryList(data.inquiryList);
            populateCategories(data.categories);
        }
    } catch (err) {
        if (cachedData.inquiryList) renderInquiryList(cachedData.inquiryList);
    }
}

function renderInquiryList(list) {
    const container = document.getElementById('inquiryList');
    if (list.length === 0) {
        container.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">查無職域資料</div>';
        return;
    }
    container.innerHTML = list.map(item => `
        <div class="card" onclick="copyToClipboard('${item.code}')" style="cursor:pointer;">
            <div class="card-row">
                <div class="col-kind-fixed"><span class="item-kind">${item.kind}</span></div>
                <div class="col-name-fixed-inq" style="font-weight:600; font-size:0.95rem;">${item.name}</div>
                <div class="col-code-fixed" style="color:var(--primary); font-weight:700;">${item.code}</div>
            </div>
        </div>
    `).join('');
}

// 點擊複製功能
function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(String(text)).then(() => {
        const toast = document.createElement('div');
        toast.textContent = '代碼已複製: ' + text;
        toast.style = 'position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:25px; z-index:9999; font-size:14px; pointer-events:none;';
        document.body.appendChild(toast);
        setTimeout(() => { 
            toast.style.opacity = '0'; 
            toast.style.transition = 'opacity 0.5s'; 
            setTimeout(() => toast.remove(), 500); 
        }, 1500);
    });
}

function populateCategories(categories) {
    const select = document.getElementById('categoryFilter');
    const cur = select.value;
    select.innerHTML = '<option value="">類別</option>' +
        categories.map(c => `<option value="${c}">${c}</option>`).join('');
    select.value = cur;
}

function setupInquiryFilters() {
    const search = document.getElementById('inquirySearch');
    const filter = document.getElementById('categoryFilter');
    if (!search || !filter) return;

    const apply = () => {
        const q = search.value.toLowerCase().trim();
        const cat = filter.value;

        // 確保有資料，若 cachedData 為空則從 localStorage 重新讀取
        if (!cachedData || !cachedData.inquiryList) {
            cachedData = JSON.parse(localStorage.getItem('dashboard_data') || '{}');
        }

        if (!cachedData.inquiryList) return;

        const filtered = cachedData.inquiryList.filter(i => {
            // 加入 String() 轉換以防止數字型別的 code 導致 toLowerCase() 崩潰
            const mQ = !q ||
                (i.name && String(i.name).toLowerCase().includes(q)) ||
                (i.code && String(i.code).toLowerCase().includes(q)) ||
                (i.kind && String(i.kind).toLowerCase().includes(q));
            const mC = !cat || i.kind === cat;
            return mQ && mC;
        });
        renderInquiryList(filtered);
    };
    search.addEventListener('input', apply);
    filter.addEventListener('change', apply);
}

// Backfill (Dropdown Logic)
function initBackfillForm() {
    const container = document.getElementById('backfillItemsContainer');
    if (container.children.length === 0) addBackfillItem();
}

function addBackfillItem() {
    const container = document.getElementById('backfillItemsContainer');
    const div = document.createElement('div');
    div.className = 'card backfill-item';
    div.style.position = 'relative';
    div.style.padding = '20px';
    div.style.marginBottom = '16px';

    const policies = cachedData.userPolicies || [];
    const myCompanies = cachedData.inquiryList || [];
    const kinds = [...new Set(myCompanies.map(c => c.kind))].sort();

    div.innerHTML = `
        <button class="remove-btn" style="position:absolute; right:10px; top:10px; background:none; border:none; font-size:1.5rem; color:#9ca3af; cursor:pointer;">&times;</button>
        <div class="form-group">
            <label>保單號碼</label>
            <select class="p-no">
                <option value="">請選擇保單號碼</option>
                ${policies.map(p => `<option value="${p}">${p}</option>`).join('')}
                <option value="manual">-- 手動輸入 --</option>
            </select>
            <input type="text" class="p-no-manual" placeholder="請手動輸入保單號碼" style="display:none; margin-top:8px;">
        </div>
        <div class="form-group">
            <label>職域類別</label>
            <select class="p-kind">
                <option value="">請選擇類別</option>
                ${kinds.map(k => `<option value="${k}">${k}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>職域名稱</label>
            <select class="p-name">
                <option value="">請先選擇類別</option>
            </select>
        </div>
    `;

    const pNo = div.querySelector('.p-no');
    const pNoManual = div.querySelector('.p-no-manual');
    const pKind = div.querySelector('.p-kind');
    const pName = div.querySelector('.p-name');

    pNo.addEventListener('change', () => {
        pNoManual.style.display = pNo.value === 'manual' ? 'block' : 'none';
    });

    pKind.addEventListener('change', () => {
        const selectedKind = pKind.value;
        const filteredNames = myCompanies.filter(c => c.kind === selectedKind).map(c => c.name);
        pName.innerHTML = '<option value="">請選擇名稱</option>' +
            [...new Set(filteredNames)].map(n => `<option value="${n}">${n}</option>`).join('');
    });

    div.querySelector('.remove-btn').addEventListener('click', () => {
        if (container.children.length > 1) div.remove();
    });

    container.appendChild(div);
}

document.getElementById('addMoreBtn').addEventListener('click', addBackfillItem);

document.getElementById('submitBtn').addEventListener('click', async () => {
    const items = [];
    let valid = true;

    document.querySelectorAll('.backfill-item').forEach(row => {
        const no = row.querySelector('.p-no').value === 'manual' ? row.querySelector('.p-no-manual').value : row.querySelector('.p-no').value;
        const kind = row.querySelector('.p-kind').value;
        const name = row.querySelector('.p-name').value;

        // 從 cachedData 找對應的 code
        const found = cachedData.inquiryList.find(c => c.kind === kind && c.name === name);
        const code = found ? found.code : "";

        if (!no || !kind || !name) {
            valid = false;
            return;
        }
        items.push({ no, kind, name, code });
    });

    if (!valid || items.length === 0) return alert('請完整填寫項目');

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = '提交中...';

    try {
        const res = await fetch(`${API_URL}?action=submitData`, {
            method: 'POST',
            body: JSON.stringify({ user: currentUser, items })
        });
        const data = await res.json();
        if (data.success) {
            alert('提交成功！');
            document.getElementById('backfillItemsContainer').innerHTML = '';
            addBackfillItem();
        }
    } catch (err) {
        alert('提交失敗');
    } finally {
        btn.disabled = false;
        btn.textContent = '確認送出補填';
    }
});

// History
async function refreshHistory() {
    const list = document.getElementById('historyList');
    list.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280;">載入中...</div>';

    try {
        const res = await fetch(`${API_URL}?action=getSubmitHistory&user=${currentUser}`);
        const data = await res.json();
        if (data.success) {
            if (data.history.length === 0) {
                list.innerHTML = '<div style="padding:40px; text-align:center; color:#6b7280;">尚無補填紀錄</div>';
            } else {
                list.innerHTML = data.history.map(h => `
                    <div class="card">
                        <div class="card-row">
                            <div class="col-no-fixed">${h.no}</div>
                            <div class="col-kind-small" style="font-size:0.8rem; color:var(--text-muted);">${h.kind}</div>
                            <div class="col-name-fixed-his" style="font-weight:600; font-size:0.9rem;">${h.name}</div>
                            <div class="col-time-fixed" style="color:var(--text-muted);">${h.time ? new Date(h.time).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        list.innerHTML = '讀取失敗';
    }
}

// PWA Install Logic
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'flex';
});

if (document.getElementById('installBtn')) {
    document.getElementById('installBtn').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                const banner = document.getElementById('installBanner');
                if (banner) banner.style.display = 'none';
            }
            deferredPrompt = null;
        }
    });
}

if (document.getElementById('closeInstallBtn')) {
    document.getElementById('closeInstallBtn').addEventListener('click', () => {
        const banner = document.getElementById('installBanner');
        if (banner) banner.style.display = 'none';
    });
}
