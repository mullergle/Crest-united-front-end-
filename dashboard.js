/* =========================================================
   CAPITAL CREST BACKEND
========================================================= */
const API_BASE = "https://capital-crest.onrender.com";

const ACTIVE_PAGE_KEY = "capitalCrestActivePage";
const RETURN_MENU_KEY = "capitalCrestReturnMenu";

let allTransactions = []; // <-- Added to store transactions for modal
let globalSavingsBalance = 0; // <-- Store savings for the modal

function saveActivePage(page){
    if(!page) return;
    localStorage.setItem(ACTIVE_PAGE_KEY, page);
}
function getSavedActivePage(){
    return localStorage.getItem(ACTIVE_PAGE_KEY) || "dashboard";
}
function setActivePage(page){
    if(!page) return;
    document.querySelectorAll(".bottom-nav a[data-page]").forEach(item => {
        item.classList.toggle("active", item.dataset.page === page);
    });
    saveActivePage(page);
}
function restoreActivePage(){
    const savedPage = getSavedActivePage();
    const links = document.querySelectorAll(".bottom-nav a[data-page]");
    let found = false;
    links.forEach(link => {
        const isActive = link.dataset.page === savedPage;
        link.classList.toggle("active", isActive);
        if(isActive) found = true;
    });
    if(!found) setActivePage("dashboard");
}

/* =========================================================
   AUTH STORAGE
========================================================= */
function getAccessToken(){
    const keys = ["access_token", "accessToken", "supabase_access_token", "supabaseAccessToken", "token", "session", "capitalCrestToken"];
    for(const key of keys){
        const value = localStorage.getItem(key);
        if(!value) continue;
        try{
            const parsed = JSON.parse(value);
            if(parsed?.access_token) return parsed.access_token;
            if(parsed?.session?.access_token) return parsed.session.access_token;
            if(parsed?.data?.session?.access_token) return parsed.data.session.access_token;
        }catch(error){ return value; }
    }
    return null;
}

function clearAuth(){
    ["access_token", "accessToken", "supabase_access_token", "supabaseAccessToken", "token", "session", "capitalCrestToken", "capitalCrestRefreshToken"].forEach(key => localStorage.removeItem(key));
    localStorage.removeItem(ACTIVE_PAGE_KEY);
    localStorage.removeItem(RETURN_MENU_KEY);
}

async function apiRequest(endpoint, options = {}){
    const token = getAccessToken();
    if(!token){
        const error = new Error("Authentication required");
        error.status = 401;
        throw error;
    }
    const headers = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
    };
    headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

    const contentType = response.headers.get("content-type") || "";
    let data = null;
    if(contentType.includes("application/json")){
        try { data = await response.json(); } catch(error) { data = null; }
    }else{
        try {
            const text = await response.text();
            data = text ? {message:text} : null;
        } catch(error) { data = null; }
    }
    if(!response.ok){
        const error = new Error(data?.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

/* =========================================================
   HELPERS
========================================================= */
function formatMoney(amount, currency = "USD"){
    const numeric = Number(amount);
    const safeAmount = Number.isFinite(numeric) ? numeric : 0;
    try{
        return new Intl.NumberFormat("en-US", { style:"currency", currency, minimumFractionDigits:2, maximumFractionDigits:2 }).format(safeAmount);
    }catch(error){
        return `$${safeAmount.toFixed(2)}`;
    }
}

function getInitials(firstName = "", surname = ""){
    const first = String(firstName).trim().charAt(0);
    const last = String(surname).trim().charAt(0);
    return (`${first}${last}`.toUpperCase() || "--");
}

function getGreeting(){
    const h = new Date().getHours();
    if(h < 12) return "Good morning";
    if(h < 17) return "Good afternoon";
    return "Good evening";
}

function escapeHTML(v){
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

/* =========================================================
   PROFILE PHOTO (SERVER IS THE SOURCE OF TRUTH)
========================================================= */
const PROFILE_PHOTO_PREFIX = "capitalCrestProfilePhoto";
const PROFILE_PHOTO_FALLBACK_KEY = "capitalCrestProfilePhoto_current";
let currentProfilePhotoCacheKey = PROFILE_PHOTO_FALLBACK_KEY;

function getProfilePhotoCacheKey(identity){
    const value = identity?.id || identity?.user_id || identity?.userId || identity?.email || "";
    const clean = String(value).trim().toLowerCase();
    return clean ? `${PROFILE_PHOTO_PREFIX}_${clean}` : PROFILE_PHOTO_FALLBACK_KEY;
}
function readProfilePhotoCache(key){
    if(!key) return null;
    try{
        const raw = localStorage.getItem(key);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === "object") ? parsed : null;
    }catch(error){ return null; }
}
function writeProfilePhotoCache(key, payload){
    if(!key || !payload) return;
    const record = { url: payload.url || null, updatedAt: Date.now() };
    try{ localStorage.setItem(key, JSON.stringify(record)); }catch(error){}
}
function clearProfilePhotoCache(key){
    try{
        if(key) localStorage.removeItem(key);
        localStorage.removeItem(PROFILE_PHOTO_FALLBACK_KEY);
    }catch(error){}
}
function getCachedProfilePhoto(key){
    const record = readProfilePhotoCache(key);
    return record ? (record.url || null) : null;
}
function resolveAvatarUrl(url){
    if(!url) return null;
    const value = String(url).trim();
    if(!value) return null;
    if(value.startsWith("data:") || value.startsWith("blob:") || /^https?:\/\//i.test(value)) return value;
    if(value.startsWith("/")) return `${API_BASE}${value}`;
    return value;
}

function updateUserName(firstName, surname, avatarUrl = null){
    const first = String(firstName || "").trim();
    const last = String(surname || "").trim();
    const fullName = `${first} ${last}`.trim();
    if(!fullName) return;

    const initials = getInitials(first, last);
    const resolvedAvatar = resolveAvatarUrl(avatarUrl);

    const welcomeName = document.getElementById("welcomeName");
    const sidebarName = document.getElementById("sidebarName");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    const topAvatar = document.getElementById("topAvatar");

    if(welcomeName) welcomeName.textContent = `${getGreeting()}, ${first || fullName}.`;
    if(sidebarName) sidebarName.textContent = fullName;

    function renderAvatar(element){
        if(!element) return;
        element.innerHTML = "";
        if(resolvedAvatar){
            const image = document.createElement("img");
            image.src = resolvedAvatar;
            image.alt = "Profile photo";
            image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;";
            image.onerror = function(){
                element.innerHTML = "";
                element.textContent = initials;
            };
            element.appendChild(image);
        }else{
            element.textContent = initials;
        }
    }
    renderAvatar(sidebarAvatar);
    renderAvatar(topAvatar);
}

/* =========================================================
   UI UPDATES
========================================================= */
function updateAccountStatus(status){
    const text = document.getElementById("accountStatusText");
    const dot = document.querySelector("#accountStatus .status-dot");
    const normalized = String(status || "active").toLowerCase();
    if(normalized === "suspended"){
        if(text) text.textContent = "Suspended";
        if(dot) { dot.style.background = "var(--danger)"; dot.style.boxShadow = "0 0 10px rgba(217,139,139,.7)"; }
        return;
    }
    if(text) text.textContent = normalized === "pending" ? "Pending" : "Active";
    if(dot) { dot.style.background = "var(--mint)"; dot.style.boxShadow = "0 0 10px rgba(184,224,202,.7)"; }
}

function updateBalance(balance){
    const element = document.getElementById("balance");
    if(element) element.textContent = formatMoney(balance);
}

function updateSavings(savings){
    globalSavingsBalance = Number(savings) || 0; // Store it globally for the modal
    const element = document.getElementById("savingsBalance");
    if(element) element.textContent = formatMoney(globalSavingsBalance);
    
    // Also update it in the modal so it's ready
    const modalEl = document.getElementById("modalSavingsBalance");
    if(modalEl) modalEl.textContent = formatMoney(globalSavingsBalance);
}

function updateSpending(spending){
    const monthly = document.getElementById("monthlySpending");
    const budget = document.getElementById("budgetSpending");
    if(monthly) monthly.textContent = formatMoney(spending);
    if(budget) budget.textContent = formatMoney(spending);
}

function updateBudget(spending, limit){
    const numericSpending = Number(spending) || 0;
    const numericLimit = Number(limit) || 0;
    if(numericLimit <= 0) return;

    const percent = Math.min(100, Math.max(0, (numericSpending / numericLimit) * 100));
    const progress = document.getElementById("budgetProgress");
    const percentText = document.getElementById("budgetPercent");
    const limitText = document.getElementById("budgetLimit");

    if(progress) progress.style.width = `${percent}%`;
    if(percentText) percentText.textContent = `${percent.toFixed(1)}%`;
    if(limitText) limitText.textContent = formatMoney(numericLimit);
}

function updateNetFlow(transactions){
    const now = new Date();
    let income = 0, spent = 0;
    (transactions || []).forEach(t => {
        const d = new Date(t.created_at || t.createdAt || t.date || Date.now());
        if(Number.isNaN(d.getTime())) return;
        if(d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return;
        const amt = Number(t.amount) || 0;
        const direction = String(t.direction || "").toLowerCase();
        const type = String(t.type || "").toLowerCase();
        if(direction === "in" || type.includes("in") || type.includes("deposit")) income += Math.abs(amt);
        else spent += Math.abs(amt);
    });
    const net = income - spent;
    const el = document.getElementById("balanceChange");
    if(el){
        el.textContent = (net >= 0 ? "+" : "-") + formatMoney(Math.abs(net));
        el.style.color = net >= 0 ? "var(--mint)" : "var(--danger)";
        const label = el.nextElementSibling;
        if(label) label.textContent = "net this month";
    }
    const sc = document.getElementById("savingsChange");
    if(sc) sc.textContent = "Savings account";
}

/* =========================================================
   TRANSACTIONS RENDER & RECEIPT
========================================================= */
function getTransactionDate(t){ return t?.created_at || t?.createdAt || t?.date || null; }

function transactionIcon(type){
    const normalized = String(type || "").toLowerCase();
    if(normalized.includes("deposit") || normalized.includes("credit") || normalized.includes("in")){
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`;
    }
    if(normalized.includes("card") || normalized.includes("purchase")){
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/></svg>`;
    }
    if(normalized.includes("transfer") || normalized.includes("withdraw") || normalized.includes("out")){
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18"/><path d="M5 8l7-5 7 5"/><path d="M5 16l7 5 7-5"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12h16"/><path d="M13 6l6 6-6 6"/></svg>`;
}

function renderTransactions(transactions){
    const container = document.getElementById("transactionsList");
    if(!container) return;
    if(!Array.isArray(transactions) || transactions.length === 0){
        container.innerHTML = `<div class="transaction"><div class="transaction-main"><strong>No transactions yet</strong><span>Your recent transactions will appear here.</span></div></div>`;
        return;
    }
    const sorted = [...transactions].sort((a,b) => new Date(getTransactionDate(b) || 0).getTime() - new Date(getTransactionDate(a) || 0).getTime());

    container.innerHTML = sorted.slice(0, 5).map(t => {
        const amount = Number(t.amount) || 0;
        const direction = String(t.direction || "").toLowerCase();
        const type = String(t.type || "").toLowerCase();
        const income = direction === "in" || type.includes("in") || type.includes("deposit") || amount > 0 && !type.includes("out");

        const title = t.description || t.merchant || t.name || "Bank transaction";
        const date = getTransactionDate(t) ? new Date(getTransactionDate(t)).toLocaleDateString("en-US", { month:"short", day:"2-digit", year:"numeric" }) : "";

        const encodedTx = encodeURIComponent(JSON.stringify(t));

        return `
            <div class="transaction" onclick="openDashboardReceipt('${encodedTx}')">
                <div class="transaction-icon">${transactionIcon(t.type)}</div>
                <div class="transaction-main">
                    <strong>${escapeHTML(title)}</strong>
                    <span>${escapeHTML(date)} ${date ? "·" : ""} ${escapeHTML(t.type || "Bank transaction")}</span>
                </div>
                <div class="transaction-amount">
                    <strong class="${income ? "income" : "expense"}">${income ? "+" : "-"}${formatMoney(Math.abs(amount))}</strong>
                    <span>${escapeHTML(t.status || "Completed")}</span>
                </div>
            </div>
        `;
    }).join("");
}

/* =========================================================
   TRANSACTIONS MODAL LIST RENDERER
========================================================= */
function renderTransactionsModal() {
    const container = document.getElementById("transactionsModalList");
    if (!container) return;

    if (!Array.isArray(allTransactions) || allTransactions.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#81958f;font-size:12px;">No transactions yet.</div>`;
        return;
    }

    const sorted = [...allTransactions].sort((a,b) => new Date(getTransactionDate(b) || 0).getTime() - new Date(getTransactionDate(a) || 0).getTime());

    container.innerHTML = sorted.map((t, i) => {
        const amount = Number(t.amount) || 0;
        const direction = String(t.direction || "").toLowerCase();
        const type = String(t.type || "").toLowerCase();
        const income = direction === "in" || type.includes("in") || type.includes("deposit") || amount > 0 && !type.includes("out");
        const title = t.description || t.merchant || t.name || "Bank transaction";
        const date = getTransactionDate(t) ? new Date(getTransactionDate(t)).toLocaleDateString("en-US", { month:"short", day:"2-digit", year:"numeric" }) : "";

        return `
            <div class="tx-modal-item" data-tx-index="${i}">
                <div class="tx-modal-icon">${transactionIcon(t.type)}</div>
                <div class="tx-modal-info">
                    <div class="tx-modal-title">${escapeHTML(title)}</div>
                    <div class="tx-modal-desc">${escapeHTML(date)} · ${escapeHTML(t.type || "Transfer")}</div>
                </div>
                <div class="tx-modal-amt">
                    <strong style="color:${income ? '#b8e0ca' : '#fff'};">${income ? "+" : "-"}${formatMoney(Math.abs(amount))}</strong>
                    <span>${escapeHTML(t.status || "Completed")}</span>
                </div>
            </div>
        `;
    }).join("");

    // Attach click handlers to open the receipt
    container.querySelectorAll(".tx-modal-item").forEach(item => {
        item.addEventListener("click", function() {
            const index = Number(this.dataset.txIndex);
            // Sort again to match the order displayed
            const sortedList = [...allTransactions].sort((a,b) => new Date(getTransactionDate(b) || 0).getTime() - new Date(getTransactionDate(a) || 0).getTime());
            const tx = sortedList[index];
            if (tx) {
                window.openTransactionInModal(tx);
            }
        });
    });
}

// Listen to "View all" button to populate the modal
document.getElementById("openTransactionsBtn")?.addEventListener("click", () => {
    renderTransactionsModal();
});

/* =========================================================
   NEW: SAVINGS PIN & MODAL LOGIC
========================================================= */
const SAVINGS_PIN = "1234"; // <-- Change this to your desired PIN

function setupSavingsModal() {
    const savingsCard = document.getElementById("savingsCard");
    const pinBackdrop = document.getElementById("savingsPinBackdrop");
    const pinModal = document.getElementById("savingsPinModal");
    const closePinBtn = document.getElementById("closeSavingsPinBtn");
    const verifyPinBtn = document.getElementById("verifyPinBtn");
    const pinInputs = document.querySelectorAll(".pin-input");
    const pinError = document.getElementById("pinError");

    const detailsModal = document.getElementById("savingsDetailsModal");
    const closeDetailsBtn = document.getElementById("closeSavingsDetailsBtn");

    // Open PIN Modal
    if(savingsCard) {
        savingsCard.addEventListener("click", () => {
            pinModal.classList.add("show");
            pinBackdrop.classList.add("show");
            document.body.style.overflow = "hidden";
            
            // Clear previous inputs & errors
            pinInputs.forEach(input => {
                input.value = "";
                input.style.borderColor = "rgba(184,224,202,.2)";
            });
            pinError.textContent = "";
            
            // Focus first input
            setTimeout(() => pinInputs[0].focus(), 300);
        });
    }

    // Close PIN Modal
    function closePinModal() {
        pinModal.classList.remove("show");
        pinBackdrop.classList.remove("show");
        document.body.style.overflow = "";
    }
    if(closePinBtn) closePinBtn.addEventListener("click", closePinModal);
    if(pinBackdrop) pinBackdrop.addEventListener("click", closePinModal);

    // Auto-advance PIN inputs
    pinInputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            // Only allow numbers
            input.value = input.value.replace(/[^0-9]/g, "");
            
            if (input.value !== "" && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }

            // Check if all inputs are filled to auto-verify
            const pinString = Array.from(pinInputs).map(i => i.value).join("");
            if(pinString.length === 4) {
                verifyPinBtn.click();
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && input.value === "" && index > 0) {
                pinInputs[index - 1].focus();
            }
        });
    });

    // Verify PIN
    if(verifyPinBtn) {
        verifyPinBtn.addEventListener("click", () => {
            const enteredPin = Array.from(pinInputs).map(i => i.value).join("");
            
            if(enteredPin.length < 4) {
                pinError.textContent = "Please enter all 4 digits.";
                return;
            }

            if(enteredPin === SAVINGS_PIN) {
                // Success! Close Pin modal, open Details modal
                closePinModal();
                
                setTimeout(() => {
                    detailsModal.classList.add("show");
                    document.body.style.overflow = "hidden";
                }, 300);
            } else {
                // Error
                pinError.textContent = "Incorrect PIN. Please try again.";
                pinInputs.forEach(input => {
                    input.value = "";
                    input.style.borderColor = "#d98b8b"; // Red border
                });
                setTimeout(() => {
                    pinInputs.forEach(input => input.style.borderColor = "rgba(184,224,202,.2)");
                    pinInputs[0].focus();
                }, 500);
            }
        });
    }

    // Close Details Modal
    if(closeDetailsBtn) {
        closeDetailsBtn.addEventListener("click", () => {
            detailsModal.classList.remove("show");
            document.body.style.overflow = "";
        });
    }
}

/* =========================================================
   DASHBOARD RECEIPT LOGIC
========================================================= */
function openDashboardReceipt(encodedTx) {
    const tx = JSON.parse(decodeURIComponent(encodedTx));

    const amt = Math.abs(Number(tx.amount) || 0);
    const dateStr = new Date(tx.created_at || tx.createdAt || tx.date || Date.now()).toLocaleString("en-US", { month:"long", day:"numeric", year:"numeric", hour:"2-digit", minute:"2-digit" });

    document.getElementById("receiptAmount").textContent = formatMoney(amt);
    document.getElementById("receiptDate").textContent = dateStr;
    document.getElementById("receiptRef").textContent = tx.reference || tx.id || "—";

    document.getElementById("receiptAccountName").textContent = tx.recipient_name || "External Account";
    document.getElementById("receiptBank").textContent = tx.recipient_bank_name || "Crest United Bank";
    document.getElementById("receiptTo").textContent = tx.recipient_account_number || tx.account_number || "—";
    document.getElementById("receiptSwift").textContent = tx.recipient_swift_code || "—";
    document.getElementById("receiptRouting").textContent = tx.recipient_routing_number || "—";
    document.getElementById("receiptDesc").textContent = tx.description || "Bank Transfer";

    if(tx.status === "pending" || tx.status === "failed") {
        document.getElementById("receiptStatus").textContent = tx.status.toUpperCase();
        document.getElementById("receiptStatus").style.background = tx.status === "failed" ? "#ffebee" : "#fff8e1";
        document.getElementById("receiptStatus").style.color = tx.status === "failed" ? "#c62828" : "#f57f17";
    } else {
        document.getElementById("receiptStatus").textContent = "SUCCESSFUL";
        document.getElementById("receiptStatus").style.background = "#e8f5e9";
        document.getElementById("receiptStatus").style.color = "#2e7d32";
    }

    document.getElementById("receiptBackdrop").classList.add("show");
    document.getElementById("receiptModal").classList.add("show");
}

function closeDashboardReceipt() {
    document.getElementById("receiptBackdrop").classList.remove("show");
    document.getElementById("receiptModal").classList.remove("show");
}

document.getElementById("closeReceiptBtn")?.addEventListener("click", closeDashboardReceipt);
document.getElementById("receiptBackdrop")?.addEventListener("click", closeDashboardReceipt);

document.getElementById("downloadReceiptBtn")?.addEventListener("click", () => {
    const btn = document.getElementById("downloadReceiptBtn");
    const originalText = btn.textContent;
    btn.textContent = "Downloading...";
    btn.disabled = true;

    const receiptEl = document.getElementById("receiptContent");

    html2canvas(receiptEl, { scale: 2, backgroundColor: "#ffffff", useCORS: true }).then(canvas => {
        const link = document.createElement("a");
        link.download = `CrestUnited_Receipt_${Date.now()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();

        btn.textContent = "Downloaded ✓";
        setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
        }, 2000);
    }).catch(err => {
        alert("Failed to download receipt. Please try again.");
        btn.textContent = originalText;
        btn.disabled = false;
    });
});

/* =========================================================
   NOTIFICATIONS LOGIC (MODAL)
========================================================= */
const READ_NOTIFS_KEY = "capitalCrestReadNotifications";

function getReadNotifications(){
    try {
        const saved = localStorage.getItem(READ_NOTIFS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

function markNotificationAsRead(id) {
    const read = getReadNotifications();
    if(!read.includes(String(id))) {
        read.push(String(id));
        localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify(read));
    }
}

function formatNotifTime(dateString) {
    if(!dateString) return "";
    const date = new Date(dateString);
    if(isNaN(date.getTime())) return "";
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if(isToday) return `Today · ${time}`;
    if(isYesterday) return `Yesterday · ${time}`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function getNotifIcon(type) {
    const t = String(type || "").toLowerCase();
    if(t.includes("login") || t.includes("security") || t.includes("password")) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/></svg>`;
    }
    if(t.includes("transfer") || t.includes("deposit") || t.includes("received")) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 9a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>`;
}

function renderNotifications(notifications) {
    const container = document.getElementById("notificationList");
    if(!container) return;

    if(!notifications || notifications.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#81958f;">
            <p style="font-size:14px;">You're all caught up!</p>
            <p style="font-size:11px;margin-top:5px;">No new notifications.</p>
        </div>`;
        return;
    }

    const readIds = getReadNotifications();

    container.innerHTML = notifications.map(n => {
        const isUnread = !readIds.includes(String(n.id));
        const isSecurity = String(n.type || "").toLowerCase().includes("security");
        
        return `
            <div class="notification-item" onclick="handleNotifClick(${n.id}, this)">
                <div class="notification-icon" style="${isSecurity ? 'color:#c9a96b;background:rgba(201,169,107,.06);' : ''}">
                    ${getNotifIcon(n.type)}
                </div>
                <div class="notification-content">
                    <div class="notification-top">
                        <strong class="notification-title">${escapeHTML(n.title || "Notification")}</strong>
                        <span class="notification-time">${formatNotifTime(n.created_at)}</span>
                    </div>
                    <p class="notification-message">${escapeHTML(n.message || n.body || "")}</p>
                </div>
                ${isUnread ? '<span class="unread-dot" style="width:6px;height:6px;border-radius:50%;background:var(--mint);flex-shrink:0;margin-top:5px;box-shadow:0 0 10px rgba(184,224,202,.65);"></span>' : ''}
            </div>
        `;
    }).join("");
}

window.handleNotifClick = function(id, element) {
    markNotificationAsRead(id);
    const dot = element.querySelector('.unread-dot');
    if(dot) dot.remove();
};

async function loadNotifications() {
    try {
        const res = await apiRequest("/api/notifications");
        let list = [];
        if(Array.isArray(res)) list = res;
        else if(res?.notifications) list = res.notifications;
        else if(res?.data) list = res.data;

        list.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        renderNotifications(list);
    } catch (err) {
        console.warn("Could not load notifications", err);
        renderNotifications([]);
    }
}

/* =========================================================
   LOAD DATA
========================================================= */
function getAccountBalance(account){
    if(!account) return 0;
    const direct = account.available_balance ?? account.balance;
    if(direct !== undefined) return Number(direct) || 0;
    const balObj = Array.isArray(account.account_balances) ? account.account_balances[0] : account.account_balances;
    if(balObj) return Number(balObj.available_balance ?? balObj.balance ?? 0) || 0;
    return 0;
}

function findAccount(accounts, type){
    if(!Array.isArray(accounts)) return null;
    return accounts.find(a => String(a.account_type || a.type || "").toLowerCase().includes(String(type).toLowerCase())) || null;
}

function updateCard(card, profile){
    if(!card) return;
    const holder = card.cardholder || card.holder_name || `${profile?.first_name || ""} ${profile?.surname || ""}`.trim();
    const rawNumber = card.card_number || "";
    let last4 = card.last4 || card.last_four || (rawNumber ? String(rawNumber).replace(/\D/g,"").slice(-4) : "");
    const expiry = card.expiry || (card.expiry_month && card.expiry_year ? `${String(card.expiry_month).padStart(2,"0")}/${String(card.expiry_year).slice(-2)}` : "—");
    const type = card.card_type || card.brand || "CARD";

    const setText = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };

    setText("cardholderName", String(holder || "—").toUpperCase());
    setText("signatureName", String(holder || "—").toUpperCase());
    setText("backCardholder", String(holder || "—").toUpperCase());
    setText("cardNumber", `•••• •••• •••• ${last4}`);
    setText("backCardNumber", `•••• ${last4}`);
    setText("cardExpiry", expiry);
    setText("backCardExpiry", expiry);
    setText("cardType", String(type).toUpperCase());
    setText("backCardType", `${String(type).toUpperCase()} DEBIT`);
    setText("cardCVV", "•••");
}

async function loadCards(me){
    try{
        const response = await apiRequest("/api/cards");
        const cards = Array.isArray(response) ? response : (response?.cards || []);
        if(cards.length) updateCard(cards[0], me?.profile || {});
        return cards;
    }catch(error){
        const cards = Array.isArray(me?.cards) ? me.cards : [];
        if(cards.length) updateCard(cards[0], me?.profile || {});
        return cards;
    }
}

async function loadTransactions(){
    const loadingEl = document.getElementById("transactionsLoading");
    const listEl    = document.getElementById("transactionsList");

    if(loadingEl) loadingEl.classList.add("show");
    if(listEl)    listEl.style.display = "none";

    try{
        const response = await apiRequest("/api/transactions");
        allTransactions = Array.isArray(response) ? response : (response?.transactions || []);
        renderTransactions(allTransactions);
        updateNetFlow(allTransactions);
        return allTransactions;
    }catch(error){
        allTransactions = [];
        renderTransactions([]);
        return [];
    }finally{
        if(loadingEl) loadingEl.classList.remove("show");
        if(listEl)    listEl.style.display = "";
    }
}

async function loadDashboardSummary(){
    try{
        const summary = await apiRequest("/api/dashboard/summary");
        const spending = Number(summary?.spending?.this_month) || 0;
        updateSpending(spending);

        const spendingChange = document.getElementById("spendingChange");
        if(spendingChange){
            const pct = Number(summary?.spending?.change_percent) || 0;
            const dir = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
            const abs = Math.abs(pct).toFixed(1);
            spendingChange.textContent = dir === "flat" ? "No change from last month" : `${abs}% ${dir} from last month`;
            spendingChange.classList.toggle("positive", pct < 0);
        }

        const limit = Number(summary?.budget?.monthly_limit) || 0;
        updateBudget(spending, limit);

        const monthEl = document.getElementById("budgetMonth");
        if(monthEl && summary?.period?.month_label) monthEl.textContent = summary.period.month_label;
    }catch(error){
        console.warn("Summary error:", error);
    }
}

async function loadDashboard(){
    await new Promise(r => requestAnimationFrame(r));
    const token = getAccessToken();
    if(!token){ window.location.replace("login.html"); return; }

    try{
        const me = await apiRequest("/api/auth/me");
        if(!me?.success) throw new Error(me?.message || "Unable to load account");

        const profile = me.profile || {};
        const user = me.user || {};
        const accounts = Array.isArray(me.accounts) ? me.accounts : [];
        const balances = me.balances || {};

        const firstName = profile.first_name || user.first_name || "";
        const surname = profile.surname || user.last_name || "";

        currentProfilePhotoCacheKey = getProfilePhotoCacheKey(user && Object.keys(user).length ? user : profile);

        const serverAvatar = profile.avatar_url || profile.photo_url || null;
        if(serverAvatar){
            writeProfilePhotoCache(currentProfilePhotoCacheKey, { url: serverAvatar });
        }else{
            clearProfilePhotoCache(currentProfilePhotoCacheKey);
        }

        updateUserName(firstName, surname, serverAvatar);

        const checkingAccount = findAccount(accounts, "checking");
        const savingsAccount = findAccount(accounts, "savings");

        let checkingBalance = Number(balances.checking);
        if(!Number.isFinite(checkingBalance)) checkingBalance = getAccountBalance(checkingAccount);

        let savingsBalance = Number(balances.savings);
        if(!Number.isFinite(savingsBalance)) savingsBalance = getAccountBalance(savingsAccount);

        updateBalance(checkingBalance);
        updateSavings(savingsBalance);
        updateAccountStatus(checkingAccount?.status || profile.status || "active");

        await Promise.allSettled([ loadTransactions(), loadCards(me), loadDashboardSummary(), loadNotifications() ]);

    }catch(error){
        if(error.status === 401 || error.status === 403){ clearAuth(); window.location.replace("login.html"); return; }
        
        const container = document.getElementById("transactionsList");
        if(container) {
            container.innerHTML = `<div class="transaction"><div class="transaction-main"><strong>Unable to load account</strong><span>Please refresh and try again.</span></div></div>`;
            container.style.display = ""; 
        }
        
        const loadingEl = document.getElementById("transactionsLoading");
        if(loadingEl) loadingEl.classList.remove("show");
    }
}

/* =========================================================
   PROFILE PHOTO MODAL
========================================================= */
let profilePhotoModal = null;
let profilePhotoInput = null;
let profileCameraInput = null;

function createProfilePhotoModal(){
    if(profilePhotoModal) return;
    profilePhotoModal = document.createElement("div");
    profilePhotoModal.id = "profilePhotoModal";
    profilePhotoModal.style.display = "none";
    profilePhotoModal.innerHTML = `
        <div id="profilePhotoBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:9998;opacity:0;transition:opacity .2s ease;"></div>
        <div id="profilePhotoSheet" role="dialog" aria-modal="true" style="position:fixed;left:50%;bottom:0;width:min(100%,430px);transform:translate(-50%,105%);background:#0a1c30;border:1px solid rgba(184,224,202,.16);border-radius:24px 24px 0 0;padding:22px 20px 28px;box-sizing:border-box;z-index:9999;box-shadow:0 -20px 60px rgba(0,0,0,.35);transition:transform .25s ease;color:#fff;">
            <div style="width:42px;height:4px;border-radius:20px;background:rgba(255,255,255,.18);margin:0 auto 20px;"></div>
            <div style="text-align:center;margin-bottom:20px;">
                <div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;background:linear-gradient(145deg,#b8e0ca,#75b79d);display:flex;align-items:center;justify-content:center;color:#09201d;font-size:22px;font-weight:800;">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h3 style="margin:0 0 6px;font-size:19px;font-weight:700;">Profile Photo</h3>
                <p style="margin:0;color:rgba(255,255,255,.58);font-size:13px;line-height:1.5;">Add a photo to personalize your account.</p>
            </div>
            <button type="button" id="takeProfilePhoto" style="width:100%;min-height:52px;border:1px solid rgba(184,224,202,.18);border-radius:14px;background:rgba(255,255,255,.045);color:#fff;display:flex;align-items:center;gap:13px;padding:0 16px;margin-bottom:10px;font:inherit;cursor:pointer;text-align:left;">
                <span style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(184,224,202,.1);color:#b8e0ca;flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3l-1.5-2z"/><circle cx="12" cy="12" r="3.5"/></svg></span>
                <span><strong style="display:block;font-size:14px;margin-bottom:3px;">Take a photo</strong><small style="color:rgba(255,255,255,.48);font-size:12px;">Use your camera</small></span>
            </button>
            <button type="button" id="chooseProfilePhoto" style="width:100%;min-height:52px;border:1px solid rgba(184,224,202,.18);border-radius:14px;background:rgba(255,255,255,.045);color:#fff;display:flex;align-items:center;gap:13px;padding:0 16px;margin-bottom:10px;font:inherit;cursor:pointer;text-align:left;">
                <span style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(184,224,202,.1);color:#b8e0ca;flex-shrink:0;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></span>
                <span><strong style="display:block;font-size:14px;margin-bottom:3px;">Choose from Photos</strong><small style="color:rgba(255,255,255,.48);font-size:12px;">Select an image from your device</small></span>
            </button>
            <button type="button" id="removeProfilePhoto" style="width:100%;min-height:48px;border:0;border-radius:14px;background:transparent;color:#d98b8b;font:inherit;font-size:13px;cursor:pointer;display:none;">Remove profile photo</button>
            <button type="button" id="cancelProfilePhoto" style="width:100%;min-height:48px;border:0;border-radius:14px;background:rgba(255,255,255,.055);color:rgba(255,255,255,.78);font:inherit;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px;">Cancel</button>
        </div>
    `;
    document.body.appendChild(profilePhotoModal);

    profilePhotoInput = document.createElement("input");
    profilePhotoInput.type = "file";
    profilePhotoInput.accept = "image/jpeg,image/jpg,image/png,image/webp";
    profilePhotoInput.style.display = "none";
    document.body.appendChild(profilePhotoInput);

    profileCameraInput = document.createElement("input");
    profileCameraInput.type = "file";
    profileCameraInput.accept = "image/*";
    profileCameraInput.capture = "environment";
    profileCameraInput.style.display = "none";
    document.body.appendChild(profileCameraInput);

    document.getElementById("profilePhotoBackdrop").addEventListener("click", closeProfilePhotoModal);
    document.getElementById("cancelProfilePhoto").addEventListener("click", closeProfilePhotoModal);
    document.getElementById("takeProfilePhoto").addEventListener("click", () => { profileCameraInput.value = ""; profileCameraInput.click(); });
    document.getElementById("chooseProfilePhoto").addEventListener("click", () => { profilePhotoInput.value = ""; profilePhotoInput.click(); });

    profilePhotoInput.addEventListener("change", function(){ const file = this.files?.[0]; if(file) uploadProfilePhoto(file); });
    profileCameraInput.addEventListener("change", function(){ const file = this.files?.[0]; if(file) uploadProfilePhoto(file); });
    document.getElementById("removeProfilePhoto").addEventListener("click", removeProfilePhoto);
}

function openProfilePhotoModal(){
    createProfilePhotoModal();
    const modal = document.getElementById("profilePhotoModal");
    const backdrop = document.getElementById("profilePhotoBackdrop");
    const sheet = document.getElementById("profilePhotoSheet");
    const removeButton = document.getElementById("removeProfilePhoto");

    const topAvatar = document.getElementById("topAvatar");
    const hasPhoto = !!topAvatar?.querySelector("img");
    if(removeButton) removeButton.style.display = hasPhoto ? "block" : "none";

    modal.style.display = "block";
    requestAnimationFrame(() => { backdrop.style.opacity = "1"; sheet.style.transform = "translate(-50%,0)"; });
    document.body.style.overflow = "hidden";
}

function closeProfilePhotoModal(){
    if(!profilePhotoModal) return;
    const backdrop = document.getElementById("profilePhotoBackdrop");
    const sheet = document.getElementById("profilePhotoSheet");
    if(backdrop) backdrop.style.opacity = "0";
    if(sheet) sheet.style.transform = "translate(-50%,105%)";
    setTimeout(() => { if(profilePhotoModal) profilePhotoModal.style.display = "none"; document.body.style.overflow = ""; }, 260);
}

function setupProfilePhotoButtons(){
    createProfilePhotoModal();
    const topAvatar = document.getElementById("topAvatar");
    const sidebarAvatar = document.getElementById("sidebarAvatar");
    if(topAvatar){ topAvatar.style.cursor = "pointer"; topAvatar.addEventListener("click", openProfilePhotoModal); }
    if(sidebarAvatar){
        sidebarAvatar.style.cursor = "pointer";
        sidebarAvatar.setAttribute("role", "button");
        sidebarAvatar.setAttribute("tabindex", "0");
        sidebarAvatar.addEventListener("click", openProfilePhotoModal);
        sidebarAvatar.addEventListener("keydown", e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); openProfilePhotoModal(); } });
    }
}

function resizeProfilePhoto(file){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const image = new Image();
            image.onload = () => {
                const maxSize = 640;
                let width = image.width, height = image.height;
                if(width > maxSize || height > maxSize){
                    if(width > height){ height = Math.round(height * (maxSize / width)); width = maxSize; }
                    else { width = Math.round(width * (maxSize / height)); height = maxSize; }
                }
                const canvas = document.createElement("canvas");
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                if(!ctx) return reject(new Error("Unable to process photo"));
                ctx.drawImage(image, 0, 0, width, height);
                canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Unable to process photo")), "image/jpeg", 0.82);
            };
            image.onerror = () => reject(new Error("Unable to read image"));
            image.src = event.target.result;
        };
        reader.onerror = () => reject(new Error("Unable to read photo"));
        reader.readAsDataURL(file);
    });
}

function blobToBase64(blob){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Unable to prepare photo"));
        reader.readAsDataURL(blob);
    });
}

function applyProfilePhoto(element, imageUrl){
    if(!element || !imageUrl) return;
    const primary = resolveAvatarUrl(imageUrl);
    if(!primary) return;
    element.innerHTML = "";
    const image = document.createElement("img");
    image.src = primary;
    image.alt = "Profile photo";
    image.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;";
    element.appendChild(image);
}

async function uploadProfilePhoto(file){
    if(!file) return;
    if(!file.type || !file.type.startsWith("image/")) return alert("Please select an image.");
    if(file.size > 10 * 1024 * 1024) return alert("Please choose an image smaller than 10MB.");

    const takeButton = document.getElementById("takeProfilePhoto");
    const chooseButton = document.getElementById("chooseProfilePhoto");

    try{
        if(takeButton) { takeButton.disabled = true; takeButton.style.opacity = ".55"; }
        if(chooseButton) { chooseButton.disabled = true; chooseButton.style.opacity = ".55"; }

        const processedBlob = await resizeProfilePhoto(file);
        if(processedBlob.size > 1.5 * 1024 * 1024) throw new Error("The photo is too large. Please choose another image.");

        const base64 = await blobToBase64(processedBlob);

        const response = await apiRequest("/api/profile/photo", {
            method: "POST",
            body: JSON.stringify({ image: base64 })
        });
        if(!response?.success || !response.avatar_url){
            throw new Error(response?.message || "Photo could not be saved to your account.");
        }

        const serverAvatar = `${response.avatar_url}${response.avatar_url.includes("?") ? "&" : "?"}t=${Date.now()}`;

        writeProfilePhotoCache(currentProfilePhotoCacheKey, { url: serverAvatar });
        applyProfilePhoto(document.getElementById("topAvatar"), serverAvatar);
        applyProfilePhoto(document.getElementById("sidebarAvatar"), serverAvatar);
        closeProfilePhotoModal();
    }catch(error){
        alert(error?.message || "Unable to update profile photo.");
    }finally{
        if(takeButton) { takeButton.disabled = false; takeButton.style.opacity = "1"; }
        if(chooseButton) { chooseButton.disabled = false; chooseButton.style.opacity = "1"; }
    }
}

async function removeProfilePhoto(){
    const confirmed = window.confirm("Remove your profile photo?");
    if(!confirmed) return;
    try{
        await apiRequest("/api/profile/photo", { method:"DELETE" });
        clearProfilePhotoCache(currentProfilePhotoCacheKey);

        const sidebarName = document.getElementById("sidebarName");
        const fullName = sidebarName?.textContent?.trim() || "";
        const nameParts = fullName.split(/\s+/);
        const initials = getInitials(nameParts[0] || "", nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");

        const topAvatar = document.getElementById("topAvatar");
        const sidebarAvatar = document.getElementById("sidebarAvatar");

        if(topAvatar){ topAvatar.innerHTML = ""; topAvatar.textContent = initials; }
        if(sidebarAvatar){ sidebarAvatar.innerHTML = ""; sidebarAvatar.textContent = initials; }
        closeProfilePhotoModal();
    }catch(error){
        alert(error?.message || "Unable to remove profile photo.");
    }
}

/* =========================================================
   NAVIGATION
========================================================= */
function restoreSidebarAfterReturn(){
    restoreActivePage();
    localStorage.removeItem(RETURN_MENU_KEY);
}

document.querySelectorAll(".bottom-nav a[data-page]").forEach(link => {
    link.addEventListener("click", function(event){
        const page = this.dataset.page;
        setActivePage(page);

        if(page === "transfer"){
            event.preventDefault();
            openTransferModal();
            return;
        }

        if(page === "dashboard"){
            event.preventDefault();
            const target = document.getElementById("dashboard");
            if(target) target.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
    });
});

document.querySelectorAll(".action-btn[data-action]").forEach(button => {
    button.addEventListener("click", function(){
        const action = this.dataset.action;
        if(action === "payments"){
            setActivePage("payments");
            localStorage.setItem(RETURN_MENU_KEY, "open");
            window.location.href = "add-money.html?from=dashboard";
            return;
        }
        if(action === "transfer"){
            setActivePage("transfer");
            openTransferModal();
        }
    });
});

document.getElementById("signOutLink")?.addEventListener("click", clearAuth);

/* =========================================================
   CARD FLIP
========================================================= */
const bankCard = document.getElementById("bankCard");
if(bankCard){
    bankCard.addEventListener("click", () => {
        bankCard.classList.toggle("flipped");
        bankCard.setAttribute("aria-label", bankCard.classList.contains("flipped") ? "Flip card to view front" : "Flip card to view back");
    });
    bankCard.addEventListener("keydown", e => {
        if(e.key === "Enter" || e.key === " "){ e.preventDefault(); bankCard.click(); }
    });
}

/* =========================================================
   SEND MONEY MODAL & OTP
========================================================= */
let transferModal = null;
let pendingTransfer = null;

const TRF_INPUT = "width:100%;height:46px;margin-top:6px;padding:0 14px;border-radius:12px;border:1px solid rgba(184,224,202,.2);background:rgba(255,255,255,.05);color:#fff;font-size:16px;outline:none;";
const TRF_LABEL = "display:block;margin-top:14px;font-size:11px;color:rgba(255,255,255,.6);letter-spacing:.5px;text-transform:uppercase;";
const TRF_PRIMARY = "width:100%;height:48px;margin-top:20px;border:0;border-radius:12px;background:linear-gradient(145deg,#b8e0ca,#75b79d);color:#09201d;font-weight:800;font-size:14px;";
const TRF_GHOST = "width:100%;height:44px;margin-top:8px;border:0;border-radius:12px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.8);font-size:13px;";
const TRF_ERR = "min-height:18px;margin-top:12px;font-size:12px;color:#d98b8b;";

function transferModalHTML(inner){
    return `
    <div id="trfBackdrop" style="position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);z-index:9998;"></div>
    <div role="dialog" aria-modal="true" style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(92%,420px);max-height:90vh;overflow:auto;background:#0a1c30;border:1px solid rgba(184,224,202,.16);border-radius:20px;padding:26px 22px;z-index:9999;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.45);">
        ${inner}
    </div>`;
}

function renderTransferModal(inner){
    if(!transferModal){
        transferModal = document.createElement("div");
        document.body.appendChild(transferModal);
    }
    transferModal.innerHTML = transferModalHTML(inner);
    document.body.style.overflow = "hidden";
    document.getElementById("trfBackdrop").addEventListener("click", closeTransferModal);
}

function closeTransferModal(){
    if(transferModal){ transferModal.remove(); transferModal = null; }
    document.body.style.overflow = "";
    pendingTransfer = null;
}

function setTrfError(msg){
    const el = document.getElementById("trfError");
    if(el) el.textContent = msg || "";
}

function openTransferModal(){
    renderTransferModal(`
        <h3 style="margin:0 0 4px;font-size:19px;">Send Money</h3>
        <p style="margin:0;font-size:12px;color:rgba(255,255,255,.55);">Transfer to any external bank account.</p>

        <label style="${TRF_LABEL}">Account Name</label>
        <input id="trfAccountName" type="text" autocomplete="off" style="${TRF_INPUT}" placeholder="Recipient full name">

        <label style="${TRF_LABEL}">Bank Name</label>
        <input id="trfBankName" type="text" autocomplete="off" style="${TRF_INPUT}" placeholder="e.g. Chase Bank">

        <label style="${TRF_LABEL}">SWIFT Code</label>
        <input id="trfSwift" type="text" autocomplete="off" style="${TRF_INPUT};text-transform:uppercase;" placeholder="e.g. CHASUS33XXX">

        <label style="${TRF_LABEL}">Routing Number</label>
        <input id="trfRouting" inputmode="numeric" autocomplete="off" style="${TRF_INPUT}" placeholder="9-digit routing number">

        <label style="${TRF_LABEL}">Account Number</label>
        <input id="trfAccount" inputmode="numeric" autocomplete="off" style="${TRF_INPUT}" placeholder="Recipient account number">

        <label style="${TRF_LABEL}">Amount (USD)</label>
        <input id="trfAmount" inputmode="decimal" autocomplete="off" style="${TRF_INPUT}" placeholder="0.00">

        <label style="${TRF_LABEL}">Description (optional)</label>
        <input id="trfDesc" maxlength="80" style="${TRF_INPUT}" placeholder="What's this for?">

        <div id="trfError" style="${TRF_ERR}"></div>
        <button id="trfContinue" type="button" style="${TRF_PRIMARY}">Continue</button>
        <button id="trfCancel" type="button" style="${TRF_GHOST}">Cancel</button>
    `);

    document.getElementById("trfCancel").addEventListener("click", closeTransferModal);
    document.getElementById("trfContinue").addEventListener("click", submitTransfer);
}

async function submitTransfer(){
    const accountName = document.getElementById("trfAccountName").value.trim();
    const bankName = document.getElementById("trfBankName").value.trim();
    const swift = document.getElementById("trfSwift").value.trim();
    const routing = document.getElementById("trfRouting").value.trim();
    const account = document.getElementById("trfAccount").value.trim();
    const amount = Number(document.getElementById("trfAmount").value);
    const description = document.getElementById("trfDesc").value.trim();
    const btn = document.getElementById("trfContinue");

    if(!accountName) return setTrfError("Enter the recipient's account name.");
    if(!bankName) return setTrfError("Enter the recipient bank name.");
    if(!swift) return setTrfError("Enter the SWIFT code.");
    if(!routing) return setTrfError("Enter the routing number.");
    if(!/^\d{6,20}$/.test(account)) return setTrfError("Enter a valid account number.");
    if(!Number.isFinite(amount) || amount <= 0) return setTrfError("Enter an amount greater than zero.");

    btn.disabled = true; btn.style.opacity = ".6"; setTrfError("");

    try{
        const res = await apiRequest("/api/transfers", {
            method: "POST",
            body: JSON.stringify({
                recipient_name: accountName,
                recipient_bank_name: bankName,
                recipient_swift_code: swift,
                recipient_routing_number: routing,
                recipient_account_number: account,
                amount,
                description
            })
        });
        pendingTransfer = res.transfer;
        openOtpStep();
    }catch(err){
        setTrfError(err.message || "Unable to start transfer.");
        btn.disabled = false; btn.style.opacity = "1";
    }
}

function openOtpStep(){
    const t = pendingTransfer;
    renderTransferModal(`
        <h3 style="margin:0 0 4px;font-size:19px;">Confirm transfer</h3>
        <p style="margin:0;font-size:13px;color:rgba(255,255,255,.7);line-height:1.5;">
            Sending <strong>${escapeHTML(formatMoney(t.amount, t.currency))}</strong> to
            <strong>${escapeHTML(t.recipient.name)}</strong> (${escapeHTML(t.recipient.bank_name)}).
            Enter the 6-digit code we emailed you.
        </p>
        <label style="${TRF_LABEL}">Verification code</label>
        <input id="trfCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" style="${TRF_INPUT};letter-spacing:8px;text-align:center;font-size:20px;" placeholder="••••••">
        <div id="trfError" style="${TRF_ERR}"></div>
        <button id="trfVerify" type="button" style="${TRF_PRIMARY}">Confirm &amp; send</button>
        <button id="trfCancel" type="button" style="${TRF_GHOST}">Cancel</button>
    `);
    document.getElementById("trfCancel").addEventListener("click", closeTransferModal);
    document.getElementById("trfVerify").addEventListener("click", verifyTransfer);
    document.getElementById("trfCode").focus();
}

async function verifyTransfer(){
    const code = document.getElementById("trfCode").value.trim();
    const btn = document.getElementById("trfVerify");
    if(!/^\d{6}$/.test(code)) return setTrfError("Enter the 6-digit code.");
    btn.disabled = true; btn.style.opacity = ".6"; setTrfError("");

    try{
        const res = await apiRequest("/api/transfers/verify", {
            method: "POST",
            body: JSON.stringify({ transfer_id: pendingTransfer.id, code })
        });
        const t = res.transfer;
        renderTransferModal(`
            <div style="text-align:center;">
                <div style="width:60px;height:60px;margin:0 auto 14px;border-radius:50%;background:rgba(184,224,202,.14);display:flex;align-items:center;justify-content:center;color:#b8e0ca;font-size:28px;">✓</div>
                <h3 style="margin:0 0 6px;font-size:19px;">Transfer complete</h3>
                <p style="margin:0;font-size:13px;color:rgba(255,255,255,.7);">
                    ${escapeHTML(formatMoney(t.amount, t.currency))} sent.<br>Reference: <strong>${escapeHTML(t.reference)}</strong>
                </p>
                <button id="trfDone" type="button" style="${TRF_PRIMARY}">Done</button>
            </div>
        `);
        document.getElementById("trfDone").addEventListener("click", closeTransferModal);
        loadDashboard();
    }catch(err){
        setTrfError(err.message || "Unable to verify transfer.");
        btn.disabled = false; btn.style.opacity = "1";
    }
}

document.addEventListener("keydown", e => { if(e.key === "Escape") closeTransferModal(); });

window.openTransactionInModal = function(tx) {
    // 1. Close the transactions sheet
    document.getElementById('transactionsModal').classList.remove('show');
    document.getElementById('transactionsBackdrop').classList.remove('show');
    
    // 2. Open the receipt modal
    setTimeout(() => {
        if(typeof openDashboardReceipt === 'function') {
            openDashboardReceipt(encodeURIComponent(JSON.stringify(tx)));
        }
    }, 300);
};

/* =========================================================
   START
========================================================= */
function startDashboard(){
    restoreSidebarAfterReturn();
    setupProfilePhotoButtons();
    setupSavingsModal(); // <--- Initialize the Savings PIN modal
    loadDashboard();
}

if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", startDashboard, { once:true });
}else{
    startDashboard();
}