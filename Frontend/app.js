//
//  zipX.App  FULLY BACKEND INTEGRATED
//

const API_URL = "https://zipx-app.onrender.com/api";

let credits = [];
let agents = [];
let orderRequests = [];
let stockistOrders = [];
let chemistLogs = [];
let selectedRole = 'admin';
let currentUser = null;

let chemistsList  = [];
let stockistsList = [];

const _SL_STEPS  = ['pending','purchased','outfordelivery','delivered','collected'];
const _SL_ICONS  = { pending:'⏳', purchased:'🛒', outfordelivery:'🛵', delivered:'✅', collected:'💰' };
const _SL_LABELS = { pending:'Pending', purchased:'Purchased', outfordelivery:'Out for Delivery', delivered:'Delivered', collected:'Collected' };

const getHeaders = () => ({
  "Content-Type": "application/json",
  "x-auth-token": localStorage.getItem("token")
});

//  ROLE SELECT
function selectRole(role) {
  selectedRole = role;
  document.getElementById('roleAdmin').classList.toggle('selected', role === 'admin');
  document.getElementById('roleAgent').classList.toggle('selected', role === 'agent');
  document.getElementById('agentRegisterLink').style.display = role === 'agent' ? 'block' : 'none';
}

//  LOGIN
async function doLogin() {
  const u = document.getElementById('loginUsername').value.trim();
  const p = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.style.display = 'none';
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem("token", data.token);
      currentUser = data.user;
      document.getElementById('loginScreen').style.display = 'none';
      initApp();
    } else {
      errorEl.style.display = 'block';
      errorEl.textContent = data.msg || "Login Failed";
    }
  } catch (err) {
    showToast("Error", "Backend Server Offline");
  }
}

//  REGISTER
function showRegisterPanel() {
  document.getElementById('loginPanel').style.display = 'none';
  document.getElementById('registerPanel').style.display = 'block';
}
function showLoginPanel() {
  document.getElementById('registerPanel').style.display = 'none';
  document.getElementById('loginPanel').style.display = 'block';
}

async function submitRegistration() {
  const name     = document.getElementById('regName').value.trim();
  const phone    = document.getElementById('regPhone').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const errEl    = document.getElementById('regError');
  const okEl     = document.getElementById('regSuccess');
  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!name || !username || !password) {
    errEl.style.cssText = 'display:block;background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);color:var(--accent3);border-radius:8px;padding:9px 13px;font-size:12px;margin-bottom:10px;';
    errEl.textContent = 'Please fill all required fields.';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.toUpperCase(), phone, username, password, role: "agent" })
    });
    const data = await res.json();
    if (res.ok) {
      okEl.style.cssText = 'display:block;background:rgba(61,207,194,0.1);border:1px solid rgba(61,207,194,0.3);color:var(--accent);border-radius:8px;padding:9px 13px;font-size:12px;margin-bottom:10px;';
      okEl.textContent = data.msg || "Request sent! Awaiting admin approval.";
    } else {
      errEl.style.cssText = 'display:block;background:rgba(255,107,107,0.1);border:1px solid rgba(255,107,107,0.3);color:var(--accent3);border-radius:8px;padding:9px 13px;font-size:12px;margin-bottom:10px;';
      errEl.textContent = data.msg || "Registration failed.";
    }
  } catch (err) { showToast("Error", "Backend Server Offline"); }
}

//  LOGOUT
function doLogout() { localStorage.removeItem("token"); location.reload(); }

//  INIT
async function initApp() {
  applyRoleUI();
  await fetchAllData();
  const now = new Date();
  document.getElementById('liveDate').textContent = now.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  }) + ', ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isAdmin     = currentUser.role === 'admin';
  const isSemiAdmin = currentUser.role === 'semiadmin';
  document.getElementById('pageTitle').textContent = isAdmin ? 'Admin Dashboard' : isSemiAdmin ? 'Send Requests' : 'My Dashboard';

  // Topbar: show Credit Entry only for admin
  const creditBtn = document.getElementById('topbarCreditBtn');
  if (creditBtn) creditBtn.style.display = isAdmin ? '' : 'none';

  // User badge label
  document.getElementById('userBadgeLabel').textContent = currentUser.name;
  const roleSpan = document.getElementById('userRoleSpan');
  if (roleSpan) roleSpan.textContent = isAdmin ? ' Admin  Logout' : isSemiAdmin ? ' Semi-Admin  Logout' : ' Agent  Logout';

  // Activate the correct first tab
  if (isSemiAdmin) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    const saTab = document.getElementById('tab-semiadmin');
    if (saTab) saTab.classList.add('active');
  }

  // Poll for new WA messages every 10 seconds
  setInterval(async () => {
    await fetchWaMessages();

    // If currently on whatsapp tab, update seen count so no badge accumulates
    const waTabActive = document.getElementById('tab-whatsapp')?.classList.contains('active');
    if (waTabActive) {
      const waRelevant = (waMessages || []).filter(m => {
        if (currentUser.role === 'admin') return m.dir === 'in';
        return m.dir === 'in' && m.to === currentUser.name;
      });
      _tabSeenCounts.whatsapp = waRelevant.length;
    }

    _updateNewItemBadges(); // update WA badge on each poll
    // Preserve any text being typed in either WA textarea
    const adminPreview = document.getElementById('waMsgPreview');
    const agentMsg     = document.getElementById('waAgentMsg');
    const adminText    = adminPreview?.value || '';
    const agentText    = agentMsg?.value     || '';
    const adminType    = document.getElementById('waMsgType')?.value || '';
    const adminFocused = adminPreview && document.activeElement === adminPreview;
    const agentFocused = agentMsg     && document.activeElement === agentMsg;

    // Don't re-render if user is actively typing
    if (!adminFocused && !agentFocused) {
      renderWhatsAppTab();
      // Restore typed text after re-render
      const newAdminPreview = document.getElementById('waMsgPreview');
      const newAgentMsg     = document.getElementById('waAgentMsg');
      if (newAdminPreview && adminType === 'custom' && adminText) newAdminPreview.value = adminText;
      if (newAgentMsg && agentText) newAgentMsg.value = agentText;
    }
  }, 10000);

  // Poll for all data updates every 5 seconds for real-time sync
  setInterval(async () => {
    try {
      // Store current active tab and scroll position
      const activeTab = document.querySelector('.tab-pane.active')?.id;
      const scrollPositions = {};
      document.querySelectorAll('.tab-pane').forEach(tab => {
        const scrollable = tab.querySelector('[style*="overflow"]') || tab;
        scrollPositions[tab.id] = scrollable.scrollTop || 0;
      });

      // Fetch fresh data from server
      await Promise.all([
        loadStockistOrders(),
        loadChemistLogs(),
        loadOrderRequests(),
        loadMonthlySheets(),
        // Fetch credits for both admin and agents (agents need to see their credit updates)
        (async () => {
          const credRes = await fetch(`${API_URL}/credits`, { headers: getHeaders() });
          if (credRes.ok) credits = await credRes.json();
        })(),
        // Fetch agents list for real-time updates (admin sees pending approvals, agents see list for transfers)
        (async () => {
          const agRes = await fetch(`${API_URL}/auth/agents`, { headers: getHeaders() });
          if (agRes.ok) agents = await agRes.json();
        })(),
        // Fetch semi-admins list if admin
        currentUser.role === 'admin' ? loadSemiAdmins() : Promise.resolve()
      ]);

      // Re-render only the currently active tab to avoid performance issues
      if (activeTab === 'tab-dashboard') {
        if (currentUser.role === 'admin') renderDashboard();
        else renderAgentDashboard();
      } else if (activeTab === 'tab-stockistlog') {
        renderStockistLogTab();
      } else if (activeTab === 'tab-chemistlog') {
        // Check if any chemist log input field is currently focused
        const activeElement = document.activeElement;
        const isChemistLogInput = activeElement && (
          activeElement.id?.startsWith('cl-dcharge-') ||
          activeElement.id?.startsWith('cl-cash-') ||
          activeElement.id?.startsWith('cl-online-') ||
          activeElement.id?.startsWith('cl-credit-')
        );
        
        // Don't re-render if user is typing in any chemist log input
        if (!isChemistLogInput) {
          renderChemistLogTab();
        }
      } else if (activeTab === 'tab-tracking') {
        renderTrackingTab();
      } else if (activeTab === 'tab-credits') {
        // Check if any credit recovered input field is currently focused
        const activeElement = document.activeElement;
        const isCreditInput = activeElement && 
          activeElement.type === 'number' && 
          activeElement.closest('#tab-credits') &&
          activeElement.getAttribute('onchange')?.includes('updateRecovered');
        
        // Don't re-render if user is typing in any credit input
        if (!isCreditInput) {
          renderCreditsTab();
        }
      } else if (activeTab === 'tab-orderrequests') {
        renderOrderRequestsTab();
      } else if (activeTab === 'tab-myorderrequests') {
        renderMyOrderRequestsTab();
      } else if (activeTab === 'tab-monthlysheets') {
        // Preserve Month Label input value before re-rendering
        const msLabelInput = document.getElementById('msLabel');
        const msLabelValue = msLabelInput?.value || '';
        const msLabelFocused = msLabelInput && document.activeElement === msLabelInput;
        
        // Don't re-render if user is typing in the input
        if (!msLabelFocused) {
          renderMonthlySheetsTab();
          // Restore typed text after re-render
          const newMsLabelInput = document.getElementById('msLabel');
          if (newMsLabelInput && msLabelValue) newMsLabelInput.value = msLabelValue;
        }
      } else if (activeTab === 'tab-agents') {
        renderAgentsTab();
      } else if (activeTab === 'tab-semiadmins') {
        // Preserve Semi-Admin form input values before re-rendering
        const saNameInput = document.getElementById('saName');
        const saUsernameInput = document.getElementById('saUsername');
        const saPasswordInput = document.getElementById('saPassword');
        const saNameValue = saNameInput?.value || '';
        const saUsernameValue = saUsernameInput?.value || '';
        const saPasswordValue = saPasswordInput?.value || '';
        const anyInputFocused = (saNameInput && document.activeElement === saNameInput) ||
                                (saUsernameInput && document.activeElement === saUsernameInput) ||
                                (saPasswordInput && document.activeElement === saPasswordInput);
        
        // Don't re-render if user is typing in any input
        if (!anyInputFocused) {
          renderSemiAdminsTab();
          // Restore typed text after re-render
          const newSaNameInput = document.getElementById('saName');
          const newSaUsernameInput = document.getElementById('saUsername');
          const newSaPasswordInput = document.getElementById('saPassword');
          if (newSaNameInput && saNameValue) newSaNameInput.value = saNameValue;
          if (newSaUsernameInput && saUsernameValue) newSaUsernameInput.value = saUsernameValue;
          if (newSaPasswordInput && saPasswordValue) newSaPasswordInput.value = saPasswordValue;
        }
      }

      // Restore scroll position
      if (activeTab && scrollPositions[activeTab]) {
        const tab = document.getElementById(activeTab);
        const scrollable = tab?.querySelector('[style*="overflow"]') || tab;
        if (scrollable) scrollable.scrollTop = scrollPositions[activeTab];
      }

      // Update tracking badge (needs to be updated regardless of active tab)
      if (currentUser.role === 'admin') {
        const inTransitOrders = stockistOrders.filter(o => o.status !== 'collected' && !o.trackingDeleted);
        _setBadge('navBadgeTracking', inTransitOrders.length);
      } else {
        const myOrders = stockistOrders.filter(o => 
          o.agentName === currentUser.name || 
          o.originalAgentName === currentUser.name ||
          (o.transferStatus === 'pending' && o.transferredTo === currentUser.name)
        );
        const myTransit = myOrders.filter(o => o.status !== 'collected' && !o.trackingDeleted &&
          !(o.transferStatus === 'accepted' && o.originalAgentName === currentUser.name));
        const pendingTransfersToMe = stockistOrders.filter(o =>
          o.transferStatus === 'pending' && o.transferredTo === currentUser.name
        ).length;
        _setBadge('navBadgeTracking', myTransit.length + pendingTransfersToMe);
      }

      // Update credits badge
      if (currentUser.role === 'admin') {
        const pendingCreds = credits.filter(c => c.status !== 'recovered');
        _setBadge('navBadgeCredits', pendingCreds.length);
      } else {
        const myOrders = stockistOrders.filter(o => 
          o.agentName === currentUser.name || 
          o.originalAgentName === currentUser.name
        );
        const myCredits = credits.filter(c => myOrders.some(o => o.chemist === c.chemist));
        _setBadge('navBadgeCredits', myCredits.filter(c => Math.max((c.amount||0)-(c.recovered||0),0) > 0).length);
      }

      // Update agents badge for pending approvals (admin only)
      if (currentUser.role === 'admin') {
        const pendingAgents = agents.filter(a => !a.approved);
        _setBadge('navBadgeAgents', pendingAgents.length);
      }

      // Update badges
      _updateNewItemBadges();
      _updateBellBadge();
    } catch (err) {
      console.error('Real-time sync error:', err);
    }
  }, 5000);
}


//  FETCH ALL DATA
async function fetchAllData() {
  try {
    if (currentUser.role === 'semiadmin') {
      // semiadmin only needs agents list and order requests
      const agRes = await fetch(`${API_URL}/auth/agents`, { headers: getHeaders() });
      if (agRes.ok) agents = await agRes.json();
      await loadOrderRequests();
      await loadChemistsAndStockists();
      renderAll();
      return;
    }

    const credRes = await fetch(`${API_URL}/credits`, { headers: getHeaders() });
    if (credRes.ok) credits = await credRes.json();

    if (currentUser.role === 'admin') {
      const agRes = await fetch(`${API_URL}/auth/agents`, { headers: getHeaders() });
      if (agRes.ok) agents = await agRes.json();
      await loadSemiAdmins();
    } else {
      // Agents also need the agents list for order transfer
      const agRes = await fetch(`${API_URL}/auth/agents`, { headers: getHeaders() });
      if (agRes.ok) agents = await agRes.json();
    }
    await fetchWaMessages();
    await loadStockistOrders();
    await loadChemistLogs();
    await loadOrderRequests();
    await loadChemistsAndStockists();
    await loadMonthlySheets();
    renderAll();
  } catch (err) { console.error("Sync failed", err); }
}

async function loadStockistOrders() {
  try {
    const res = await fetch(`${API_URL}/stockist-orders`, { headers: getHeaders() });
    if (res.ok) stockistOrders = await res.json();
  } catch (err) { console.error("Failed to load stockist orders", err); }
}

async function loadChemistsAndStockists() {
  try {
    const [cRes, sRes] = await Promise.all([
      fetch(`${API_URL}/chemists`,  { headers: getHeaders() }),
      fetch(`${API_URL}/stockists`, { headers: getHeaders() })
    ]);
    if (cRes.ok) {
      const data = await cRes.json();
      // Support both old format (string[]) and new format (object[])
      chemistsData = data.map(c => typeof c === 'string' ? { name: c, phone: '' } : c);
      chemistsList = chemistsData.map(c => c.name);
    }
    if (sRes.ok) {
      const data = await sRes.json();
      stockistsData = data.map(s => typeof s === 'string' ? { name: s, phone: '' } : s);
      stockistsList = stockistsData.map(s => s.name);
    }
  } catch (err) { console.error("Failed to load chemists/stockists", err); }
}

async function loadOrderRequests() {
  try {
    const res = await fetch(`${API_URL}/orderrequests`, { headers: getHeaders() });
    if (res.ok) orderRequests = await res.json();
  } catch (err) { console.error("Failed to load order requests", err); }
}

async function loadChemistLogs() {
  try {
    const res = await fetch(`${API_URL}/chemist-logs`, { headers: getHeaders() });
    if (res.ok) {
      chemistLogs = await res.json();
    } else {
      showToast("Error", "Failed to load chemist logs");
    }
  } catch (err) {
    console.error("Failed to load chemist logs", err);
    showToast("Error", "Failed to load chemist logs");
  }
}

async function deleteStockistOrder(id) {
  if (!confirm('Delete this stockist log? Tracking record will be preserved.')) return;
  try {
    const res = await fetch(`${API_URL}/stockist-orders/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) {
      // Soft delete — mark locally so it hides from stockist log but stays in tracking
      const order = stockistOrders.find(o => o._id === id);
      if (order) { order.stockistLogDeleted = true; order.orderId = null; }
      const inTransit = stockistOrders.filter(o => o.status !== 'collected' && !o.trackingDeleted);
      _setBadge('navBadgeTracking', inTransit.length);
      const pendingCreds = credits.filter(c => c.status !== 'recovered');
      _setBadge('navBadgeCredits', pendingCreds.length);
      _updateBellBadge();
      renderStockistLogTab();
      renderTrackingTab();
      showToast('🗑️ Deleted', 'Stockist log removed, tracking preserved');
    } else {
      const err = await res.json();
      showToast('❌ Error', err.error || 'Failed to delete');
    }
  } catch (e) {
    showToast('❌ Error', 'Server offline');
  }
}

// ── ORDER TRANSFER ──
function openTransferModal(orderId) {
  const approvedAgents = agents.filter(a => a.approved && a.name !== currentUser.name);
  if (!approvedAgents.length) { showToast('⚠️ No Agents', 'No other agents available'); return; }

  const modal = document.createElement('div');
  modal.id = 'transferModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:380px;position:relative">
      <button onclick="document.getElementById('transferModal').remove()" style="position:absolute;top:14px;right:14px;background:var(--surface2);border:none;color:var(--text);width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px">✕</button>
      <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;margin-bottom:16px">🔄 Transfer Order</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Select the agent to transfer this order to:</div>
      <select class="form-control" id="transferAgentSelect" style="margin-bottom:16px">
        ${approvedAgents.map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
      </select>
      <button class="btn btn-primary" style="width:100%" onclick="submitTransfer('${orderId}')">🔄 Transfer Order</button>
    </div>`;
  document.body.appendChild(modal);
}

async function submitTransfer(orderId) {
  const toAgentName = document.getElementById('transferAgentSelect')?.value;
  if (!toAgentName) return;

  const res = await fetch(`${API_URL}/stockist-orders/${orderId}/transfer`, {
    method: 'PATCH', headers: getHeaders(),
    body: JSON.stringify({ toAgentName })
  });

  if (res.ok) {
    const updated = await res.json();
    const idx = stockistOrders.findIndex(o => o._id === orderId);
    if (idx !== -1) stockistOrders[idx] = updated;
    document.getElementById('transferModal')?.remove();
    renderTrackingTab();
    showToast('🔄 Transfer Sent', `Order transfer request sent to ${toAgentName}`);
  } else {
    const err = await res.json();
    showToast('❌ Error', err.error || 'Transfer failed');
  }
}

async function acceptTransfer(orderId) {
  if (!confirm('Accept this order transfer?')) return;
  const res = await fetch(`${API_URL}/stockist-orders/${orderId}/accept-transfer`, {
    method: 'PATCH', headers: getHeaders()
  });

  if (res.ok) {
    const updated = await res.json();
    const idx = stockistOrders.findIndex(o => o._id === orderId);
    if (idx !== -1) stockistOrders[idx] = updated;
    renderTrackingTab();
    showToast('✅ Transfer Accepted', 'Order is now assigned to you');
  } else {
    const err = await res.json();
    showToast('❌ Error', err.error || 'Failed to accept transfer');
  }
}

async function rejectTransfer(orderId) {
  if (!confirm('Reject this transfer? The order will be returned to the original agent.')) return;
  const res = await fetch(`${API_URL}/stockist-orders/${orderId}/reject-transfer`, {
    method: 'PATCH', headers: getHeaders()
  });

  if (res.ok) {
    const updated = await res.json();
    const idx = stockistOrders.findIndex(o => o._id === orderId);
    if (idx !== -1) stockistOrders[idx] = updated;
    renderTrackingTab();
    showToast('↩️ Transfer Rejected', 'Order returned to original agent');
  } else {
    const err = await res.json();
    showToast('❌ Error', err.error || 'Failed to reject transfer');
  }
}

async function deleteTrackingOrder(id) {
  if (!confirm('Delete this tracking log? The stockist log will be preserved.')) return;
  try {
    const res = await fetch(`${API_URL}/stockist-orders/${id}/tracking`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) {
      const order = stockistOrders.find(o => o._id === id);
      if (order) order.trackingDeleted = true;
      // Recalculate badges immediately
      const inTransit = stockistOrders.filter(o => o.status !== 'collected' && !o.trackingDeleted);
      _setBadge('navBadgeTracking', inTransit.length);
      _updateBellBadge();
      renderTrackingTab();
      showToast('🗑️ Deleted', 'Tracking log removed, stockist log preserved');
    } else {
      const err = await res.json();
      showToast('❌ Error', err.error || 'Failed to delete');
    }
  } catch (e) {
    showToast('❌ Error', 'Server offline');
  }
}

async function advanceOrderStatus(id, newStatus, remark) {
  try {
    const res = await fetch(`${API_URL}/stockist-orders/${id}/status`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ status: newStatus, remark })
    });
    if (res.ok) {
      await fetchAllData();
      renderTrackingTab();
      // When collected, a new chemist log is created — update badge immediately
      if (newStatus === 'collected') {
        // chemistLogs is now refreshed by fetchAllData — update seen count to trigger badge
        if (_tabSeenCounts.chemistlog !== null) {
          // Don't update seen count — let the new log show as unread
          const newCL = Math.max(0, (chemistLogs || []).length - _tabSeenCounts.chemistlog);
          _setBadge('navBadgeChemistLog', newCL);
          _updateBellBadge();
        }
      }
    } else {
      const data = await res.json();
      showToast("Error", data.error || "Failed to advance status");
    }
  } catch (err) { showToast("Error", "Server error"); }
}

// Validates payment breakdown before order submission.
// Returns { valid: true, message: '' } when sum equals total and no negatives.
// Returns { valid: false, message: '...' } otherwise.
// Called in the new order form submit handler (Task 9).
function validatePaymentFields(cash, online, credit, dues, total) {
  if (cash < 0 || online < 0 || credit < 0 || dues < 0) {
    return { valid: false, message: 'Payment fields cannot be negative' };
  }
  const computed = cash + online + credit + dues;
  if (computed !== total) {
    return { valid: false, message: `Payment breakdown (${computed}) does not match total (${total})` };
  }
  return { valid: true, message: '' };
}

//  APPLY ROLE UI
function applyRoleUI() {
  const isAdmin     = currentUser.role === 'admin';
  const isSemiAdmin = currentUser.role === 'semiadmin';
  document.getElementById('userBadgeLabel').textContent = currentUser.name;
  document.getElementById('userRoleDot').style.background = isAdmin ? 'var(--accent)' : isSemiAdmin ? 'var(--accent4)' : 'var(--accent2)';

  const nav = document.getElementById('sidebarNav');

  if (isAdmin) {
    nav.innerHTML = `
      <div class="nav-section">
        <div class="nav-label">OVERVIEW</div>
        <div class="nav-item active" data-tab="dashboard" onclick="switchTab('dashboard',this)"><span class="nav-icon">🏠</span>Dashboard</div>
        <div class="nav-item" data-tab="stockistlog" onclick="switchTab('stockistlog',this)"><span class="nav-icon">🏭</span>Stockist Log <span class="nav-badge" id="navBadgeStockistLog" style="display:none;background:var(--accent4);color:#fff">0</span></div>
        <div class="nav-item" data-tab="chemistlog" onclick="switchTab('chemistlog',this)"><span class="nav-icon">🏥</span>Chemist Log <span class="nav-badge" id="navBadgeChemistLog" style="display:none;background:var(--accent4);color:#fff">0</span></div>
        <div class="nav-item" data-tab="orderrequests" onclick="switchTab('orderrequests',this)"><span class="nav-icon">📋</span>Order Requests <span class="nav-badge" id="navBadgeOrderReq" style="display:none">0</span></div>
        <div class="nav-item" data-tab="tracking" onclick="switchTab('tracking',this)"><span class="nav-icon">🚚</span>Tracking <span class="nav-badge" id="navBadgeTracking">0</span></div>
        <div class="nav-item" data-tab="credits" onclick="switchTab('credits',this)"><span class="nav-icon">💳</span>Credits <span class="nav-badge" id="navBadgeCredits">0</span></div>
        <div class="nav-item" data-tab="whatsapp" onclick="switchTab('whatsapp',this)"><span class="nav-icon">💬</span>WhatsApp <span class="nav-badge" id="navBadgeWA">0</span></div>
      </div>
      <div class="nav-section">
        <div class="nav-label">FINANCE</div>
        <div class="nav-item" data-tab="bills" onclick="switchTab('bills',this)"><span class="nav-icon">🧾</span>Bill Generator</div>
        <div class="nav-item" data-tab="settlements" onclick="switchTab('settlements',this)"><span class="nav-icon">💰</span>Settlements</div>
        <div class="nav-item" data-tab="agents" onclick="switchTab('agents',this)"><span class="nav-icon">👤</span>Agents <span class="nav-badge" id="navBadgeAgents" style="display:none;background:var(--accent4);color:#fff">0</span></div>
        <div class="nav-item" data-tab="semiadmins" onclick="switchTab('semiadmins',this)"><span class="nav-icon">🔑</span>Semi-Admins</div>
      </div>
      <div class="nav-section">
        <div class="nav-label">RECORDS</div>
        <div class="nav-item" data-tab="chemists" onclick="switchTab('chemists',this)"><span class="nav-icon">💊</span>Chemists</div>
        <div class="nav-item" data-tab="stockists" onclick="switchTab('stockists',this)"><span class="nav-icon">🏪</span>Stockists</div>
        <div class="nav-item" data-tab="monthlysheets" onclick="switchTab('monthlysheets',this)"><span class="nav-icon">📅</span>Monthly Sheets</div>
      </div>`;
  } else if (isSemiAdmin) {
    nav.innerHTML = `
      <div class="nav-section">
        <div class="nav-label">REQUESTS</div>
        <div class="nav-item active" data-tab="semiadmin" onclick="switchTab('semiadmin',this)"><span class="nav-icon">📋</span>Send Requests <span class="nav-badge" id="navBadgeSAReq" style="display:none">0</span></div>
      </div>`;
  } else {
    nav.innerHTML = `
      <div class="nav-section">
        <div class="nav-label">OVERVIEW</div>
        <div class="nav-item active" data-tab="dashboard" onclick="switchTab('dashboard',this)"><span class="nav-icon">🏠</span>My Dashboard</div>
        <div class="nav-item" data-tab="stockistlog" onclick="switchTab('stockistlog',this)"><span class="nav-icon">🏭</span>Stockist Log <span class="nav-badge" id="navBadgeStockistLog" style="display:none;background:var(--accent4);color:#fff">0</span></div>
        <div class="nav-item" data-tab="chemistlog" onclick="switchTab('chemistlog',this)"><span class="nav-icon">🏥</span>Chemist Log <span class="nav-badge" id="navBadgeChemistLog" style="display:none;background:var(--accent4);color:#fff">0</span></div>
        <div class="nav-item" data-tab="myorderrequests" onclick="switchTab('myorderrequests',this)"><span class="nav-icon">📋</span>My Order Requests <span class="nav-badge" id="navBadgeMyOrderReq" style="display:none">0</span></div>
        <div class="nav-item" data-tab="tracking" onclick="switchTab('tracking',this)"><span class="nav-icon">🚚</span>Tracking <span class="nav-badge" id="navBadgeTracking">0</span></div>
        <div class="nav-item" data-tab="credits" onclick="switchTab('credits',this)"><span class="nav-icon">💳</span>Credits <span class="nav-badge" id="navBadgeCredits">0</span></div>
        <div class="nav-item" data-tab="whatsapp" onclick="switchTab('whatsapp',this)"><span class="nav-icon">💬</span>WhatsApp <span class="nav-badge" id="navBadgeWA" style="background:var(--accent4);color:#fff">0</span></div>
      </div>
      <div class="nav-section">
        <div class="nav-label">RECORDS</div>
        <div class="nav-item" data-tab="monthlysheets" onclick="switchTab('monthlysheets',this)"><span class="nav-icon">📅</span>Monthly Sheets</div>
      </div>`;
  }

  // Ensure dynamic tab panes exist
  ['credits','agents','whatsapp','bills','settlements','chemists','stockists','stockistlog','chemistlog','monthlysheets','orderrequests','myorderrequests','semiadmin','semiadmins'].forEach(id => {
    if (!document.getElementById('tab-' + id)) {
      const el = document.createElement('div');
      el.className = 'tab-pane'; el.id = 'tab-' + id;
      document.querySelector('.content').appendChild(el);
    }
  });

  // Populate order form selects — used by chemist/stockist add functions
  const newChemistSel = document.getElementById('newChemist');
  if (newChemistSel) newChemistSel.innerHTML = chemistsList.map(c => `<option>${c}</option>`).join('');
  const newStockistSel = document.getElementById('newStockist');
  if (newStockistSel) newStockistSel.innerHTML = stockistsList.map(s => `<option>${s}</option>`).join('');

  // Populate agent dropdown  admin can pick any approved agent, agent sees only themselves
  const agentSel = document.getElementById('newAgent');
  if (agentSel) {
    if (isAdmin) {
      const approvedAgents = agents.filter(a => a.approved);
      agentSel.innerHTML = approvedAgents.length
        ? approvedAgents.map(a => `<option value="${a.name}">${a.name}</option>`).join('')
        : `<option value="">No agents available</option>`;
      agentSel.disabled = false;
    } else {
      agentSel.innerHTML = `<option value="${currentUser.name}">${currentUser.name}</option>`;
      agentSel.disabled = true;
    }
  }

  // Populate credit modal chemist select
  const cc = document.getElementById('creditChemist');
  if (cc) cc.innerHTML = chemistsList.map(c => `<option>${c}</option>`).join('');
}

//  RENDER ALL
function renderAll() {
  if (currentUser.role === 'admin') {
    renderDashboard();
    renderAgentsTab();
    renderSemiAdminsTab();
    renderBillTab();
    renderSettlementsTab();
    renderChemistsTab();
    renderStockistsTab();
    renderMonthlySheetsTab();
    renderOrderRequestsTab();
    renderStockistLogTab();
    renderChemistLogTab();
    renderTrackingTab();
    renderCreditsTab();
    renderAgentPills();
    renderWhatsAppTab();
  } else if (currentUser.role === 'semiadmin') {
    renderSemiAdminTab();
  } else {
    renderAgentDashboard();
    renderMonthlySheetsTab();
    renderMyOrderRequestsTab();
    renderStockistLogTab();
    renderChemistLogTab();
    renderTrackingTab();
    renderCreditsTab();
    renderAgentPills();
    renderWhatsAppTab();
  }
}

//  DASHBOARD
function renderDashboard() {
  // ── Stockist Log data — exclude soft-deleted entries ──
  const activeOrders   = stockistOrders.filter(o => !o.stockistLogDeleted);
  const totalPurchase  = activeOrders.reduce((s, o) => s + (o.purchaseAmount || 0), 0);
  const totalCash      = activeOrders.reduce((s, o) => s + (o.cash           || 0), 0);
  const totalOnline    = activeOrders.reduce((s, o) => s + (o.online         || 0), 0);
  const totalDues      = activeOrders.reduce((s, o) => s + (o.dues           || 0), 0);
  const totalCred      = activeOrders.reduce((s, o) => s + (o.credit         || 0), 0);
  const totalCashback  = activeOrders.reduce((s, o) => s + (o.cashback       || 0), 0);
  const netTotal       = activeOrders.reduce((s, o) => s + ((o.totalAmount||0) - (o.cashback||0)), 0);
  const pendingDuesCount  = activeOrders.filter(o => (o.dues || 0) > 0).length;
  const creditAccounts    = credits.filter(c => c.status !== 'recovered').length;
  // ── Chemist Log data ──
  const clTotalBill    = chemistLogs.reduce((s,l) => s+(l.totalBillAmount||0), 0);
  const clPurchase     = chemistLogs.reduce((s,l) => s+(l.purchaseCost||0), 0);
  const clCash         = chemistLogs.reduce((s,l) => s+(l.cashReceived||0), 0);
  const clOnline       = chemistLogs.reduce((s,l) => s+(l.onlineReceived||0), 0);
  const clCredit       = chemistLogs.reduce((s,l) => s+(l.creditGiven||0), 0);
  const clOutstanding  = chemistLogs.reduce((s,l) => s+(l.outstandingAmount||0), 0);
  const clPending      = chemistLogs.filter(l => l.paymentCollectionStatus !== 'collected').length;

  // ── Stockist Log panel ──
  document.getElementById('dsPurchase').textContent    = '₹' + totalPurchase.toLocaleString('en-IN');
  document.getElementById('dsPurchaseSub').textContent = activeOrders.length + ' orders';
  document.getElementById('dsCash').textContent        = '₹' + totalCash.toLocaleString('en-IN');
  document.getElementById('dsOnline').textContent      = '₹' + totalOnline.toLocaleString('en-IN');
  document.getElementById('dsTotalCredit').textContent = '₹' + totalCred.toLocaleString('en-IN');
  document.getElementById('dsCreditSub').textContent   = creditAccounts + ' accounts';
  document.getElementById('dsDues').textContent        = '₹' + totalDues.toLocaleString('en-IN');
  document.getElementById('dsDuesSub').textContent     = pendingDuesCount + ' pending';
  // ── NET TOTAL card — always visible ──
  const netTotalEl = document.getElementById('dsNetTotalVal');
  if (netTotalEl) netTotalEl.textContent = '₹' + netTotal.toLocaleString('en-IN');
  // ── Chemist Log panel ──
  document.getElementById('clDsTotalOrders').textContent    = '₹' + clTotalBill.toLocaleString('en-IN');
  document.getElementById('clDsTotalOrdersSub').textContent = chemistLogs.length + ' logs';
  document.getElementById('clDsPurchase').textContent       = '₹' + clPurchase.toLocaleString('en-IN');
  document.getElementById('clDsCash').textContent           = '₹' + clCash.toLocaleString('en-IN');
  document.getElementById('clDsOnline').textContent         = '₹' + clOnline.toLocaleString('en-IN');
  document.getElementById('clDsCredit').textContent         = '₹' + clCredit.toLocaleString('en-IN');
  document.getElementById('clDsCreditSub').textContent      = clPending + ' pending';
  document.getElementById('clDsOutstanding').textContent    = '₹' + clOutstanding.toLocaleString('en-IN');

  // Update nav badges
  const inTransitOrders = stockistOrders.filter(o => o.status !== 'collected' && !o.trackingDeleted);
  const pendingCreds    = credits.filter(c => c.status !== 'recovered');
  // Include pending transfers to this agent in tracking badge
  const pendingTransfersToMe = currentUser.role !== 'admin'
    ? stockistOrders.filter(o => o.transferStatus === 'pending' && o.transferredTo === currentUser.name).length
    : 0;
  _setBadge('navBadgeTracking', inTransitOrders.length + pendingTransfersToMe);
  _setBadge('navBadgeCredits',  pendingCreds.length);
  
  // Update agents badge for pending approvals
  if (currentUser.role === 'admin') {
    const pendingAgents = agents.filter(a => !a.approved);
    _setBadge('navBadgeAgents', pendingAgents.length);
  }
  
  _updateNewItemBadges();
  _updateBellBadge();

  // Pending agent approval requests on dashboard
  const pendingAgents  = agents.filter(a => !a.approved);
  const pendingAgPanel = document.getElementById('pendingAgentsPanel');
  if (pendingAgPanel) {
    if (pendingAgents.length) {
      pendingAgPanel.style.display = '';
      pendingAgPanel.innerHTML = `
        <div class="panel" style="border:2px solid var(--accent4);background:rgba(255,209,102,0.04)">
          <div class="panel-header" style="background:rgba(255,209,102,0.08);border-bottom:1px solid rgba(255,209,102,0.25)">
            <div class="panel-title" style="color:var(--accent4)">🔔 New Agent Requests (${pendingAgents.length})</div>
            <button class="btn btn-ghost" style="font-size:11px" onclick="switchTab('agents',document.querySelector('[data-tab=agents]'))">View All →</button>
          </div>
          <div class="panel-body" style="display:flex;flex-direction:column;gap:8px">
            ${pendingAgents.map(a => `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:var(--surface2);border:1px solid rgba(255,209,102,0.3)">
                <div style="width:8px;height:8px;border-radius:50%;background:var(--accent4);flex-shrink:0;animation:pulse 1.5s infinite"></div>
                <div style="flex:1">
                  <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:13px">${a.name}</div>
                  <div style="font-size:11px;color:var(--text2);margin-top:2px">@${a.username} &nbsp;·&nbsp; ${a.phone || 'No phone'}</div>
                </div>
                <button class="btn btn-primary" style="font-size:11px;padding:6px 14px;flex-shrink:0" onclick="approveAgent('${a._id}')">✅ Approve</button>
                <button class="btn-delete" onclick="deleteAgent('${a._id}')"></button>
              </div>`).join('')}
          </div>
        </div>`;
    } else {
      pendingAgPanel.style.display = 'none';
    }
  }

  //  DONUT CHART
  const circ = 2 * Math.PI * 40; // 251.2
  const total4 = totalCash + totalOnline + totalCred + totalDues || 1;
  const pcts = [totalCash, totalOnline, totalCred, totalDues].map(v => v / total4);
  const ids  = ['donutCash','donutOnline','donutCredit','donutDues'];
  const lbls = ['donutLblCash','donutLblOnline','donutLblCredit','donutLblDues'];
  let offset = 0;
  ids.forEach((id, i) => {
    const arc = pcts[i] * circ;
    const el  = document.getElementById(id);
    if (el) {
      el.setAttribute('stroke-dasharray', `${arc} ${circ - arc}`);
      el.setAttribute('stroke-dashoffset', -offset);
    }
    const lbl = document.getElementById(lbls[i]);
    if (lbl) lbl.textContent = (pcts[i] * 100).toFixed(1) + '%';
    offset += arc;
  });

  //  AGENT PERFORMANCE CHART (last 7 days)
  const perfChart  = document.getElementById('agentPerfChart');
  const perfLegend = document.getElementById('agentPerfLegend');
  const agentColors = ['#3dcfc2','#f5a623','#7b6cf6','#ff6b6b','#2ab8aa'];
  const now = new Date();
  const days7 = Array.from({length:7}, (_,i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const activeAgents = agents.filter(a => a.approved).slice(0, 4);

  if (!stockistOrders.length) {
    perfChart.innerHTML  = `<div style="color:var(--text2);font-size:12px;padding:20px 0">No orders yet</div>`;
    perfLegend.innerHTML = '';
  } else {
    const maxVal = Math.max(...days7.map(d => stockistOrders.filter(o => o.date === d).reduce((s,o) => s+(o.totalAmount||0),0)), 1);
    perfChart.innerHTML = days7.map(d => {
      const dayTotal = stockistOrders.filter(o => o.date === d).reduce((s,o) => s+(o.totalAmount||0),0);
      const h = Math.max((dayTotal / maxVal) * 90, 4);
      const label = new Date(d).toLocaleDateString('en-IN',{weekday:'short'}).slice(0,2);
      return `<div class="chart-bar-wrap">
        <div class="chart-bar" style="height:${h}px;background:linear-gradient(180deg,var(--accent),var(--accent2))" title="${dayTotal.toLocaleString('en-IN')}"></div>
        <div class="chart-bar-label">${label}</div>
      </div>`;
    }).join('');
    perfLegend.innerHTML = activeAgents.map((a,i) => {
      const agTotal = stockistOrders.filter(o => o.agentName===a.name).reduce((s,o)=>s+(o.totalAmount||0),0);
      return `<div class="legend-item"><div class="legend-dot" style="background:${agentColors[i%agentColors.length]}"></div>${a.name}  ${agTotal.toLocaleString('en-IN')}</div>`;
    }).join('');
  }

  //  IN TRANSIT
  const transitPanel = document.getElementById('inTransitPanel');
  if (!inTransitOrders.length) {
    transitPanel.innerHTML = `<div style="text-align:center;color:var(--text2);font-size:12px;padding:16px 0">All delivered </div>`;
  } else {
    transitPanel.innerHTML = inTransitOrders.slice(0,4).map(o => {
      return `
      <div class="delivery-item" onclick="switchTab('stockistlog', document.querySelector('[data-tab=stockistlog]'))" style="cursor:pointer">
        <div class="delivery-icon" style="background:rgba(61,207,194,0.12)"></div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.chemist || ''}</div>
          <div style="font-size:10px;color:var(--text2)">${o.stockist || ''}  ${(o.totalAmount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:10px;color:var(--accent);margin-top:2px"> ${o.agentName || ''}  ${o.orderId || ''}</div>
        </div>
        <span class="track-status-badge ts-${o.status||'pending'}" style="font-size:9px">${_SL_LABELS[o.status]||o.status}</span>
      </div>`;
    }).join('');
  }

  //  PENDING CREDITS
  const credPanel = document.getElementById('pendingCreditsPanel');
  if (!pendingCreds.length) {
    credPanel.innerHTML = `<div style="text-align:center;color:var(--text2);font-size:12px;padding:16px 0">No pending credits </div>`;
  } else {
    credPanel.innerHTML = pendingCreds.slice(0,4).map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer"
        onclick="switchTab('credits',document.querySelector('[data-tab=credits]'));setTimeout(()=>{const el=document.getElementById('credit-${c._id}');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid var(--accent5)';setTimeout(()=>el.style.outline='',1500);}},200)">
        <div style="flex:1">
          <div style="font-weight:700;font-size:12px">${c.chemist}</div>
          <div style="font-size:10px;color:var(--text2)">${c.dueDate || 'No due date'}</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--accent5)">${(c.amount||0).toLocaleString('en-IN')}</div>
      </div>`).join('');
  }

  //  AGENT SCORECARD
  const scorePanel = document.getElementById('agentScorecardPanel');
  const approvedAgents = agents.filter(a => a.approved);
  if (!approvedAgents.length) {
    scorePanel.innerHTML = `
      ${[1,2,3].map(i => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:var(--text2);width:20px">${i}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:12px;color:var(--text2)">—</div>
          <div style="font-size:10px;color:var(--text2)">No agent</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--text2)">₹0</div>
      </div>`).join('')}`;
  } else {
    const scored = approvedAgents.map(a => ({
      name: a.name,
      total: stockistOrders.filter(o => o.agentName === a.name).reduce((s,o)=>s+(o.totalAmount||0),0),
      count: stockistOrders.filter(o => o.agentName === a.name).length
    })).sort((a,b) => b.total - a.total);

    // Show up to 3, but always render at least 3 rows (pad with placeholders if needed)
    const display = scored.slice(0, 3);
    const placeholderCount = Math.max(0, 3 - display.length);
    const placeholders = Array.from({ length: placeholderCount }, (_, i) => ({
      name: '—', total: 0, count: 0, placeholder: true, rank: display.length + i + 1
    }));

    scorePanel.innerHTML = [
      ...display.map((a, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:var(--text2);width:20px">${i+1}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:12px">${a.name}</div>
          <div style="font-size:10px;color:var(--text2)">${a.count} orders</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--accent)">${a.total.toLocaleString('en-IN')}</div>
      </div>`),
      ...placeholders.map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:16px;color:var(--text2);width:20px">${p.rank}</div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:12px;color:var(--text2)">—</div>
          <div style="font-size:10px;color:var(--text2)">No agent</div>
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--text2)">₹0</div>
      </div>`)
    ].join('');
  }

  //  RECENT STOCKIST ORDERS
  const tbody = document.getElementById('orderTableBody');
  if (!activeOrders.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text2);padding:24px">No stockist orders yet</td></tr>`;
    return;
  }
  tbody.innerHTML = activeOrders.slice(0, 5).map(o => {
    return `
    <tr>
      <td style="font-family:'DM Mono',monospace;color:var(--accent);font-size:11px">${o.orderId || ''}</td>
      <td>${o.date || ''}</td>
      <td><b>${o.chemist || ''}</b></td>
      <td>${o.stockist || ''}</td>
      <td style="font-family:'DM Mono',monospace">${(o.totalAmount || 0).toLocaleString('en-IN')}</td>
      <td style="font-family:'DM Mono',monospace">${(o.cash || 0).toLocaleString('en-IN')}</td>
      <td style="font-family:'DM Mono',monospace">${(o.online || 0).toLocaleString('en-IN')}</td>
      <td style="font-family:'DM Mono',monospace">${(o.credit || 0).toLocaleString('en-IN')}</td>
      <td><span class="track-status-badge ts-${o.status || 'pending'}">${_SL_LABELS[o.status] || o.status || 'pending'}</span></td>
      <td>${o.agentName || ''}</td>
    </tr>`;
  }).join('');
}

function _setBadge(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = val;
  if (id === 'bellBadge') {
    el.style.display = val > 0 ? 'flex' : 'none';
  } else {
    el.style.display = val > 0 ? '' : 'none';
  }
}

// ── NEW ITEM BADGE TRACKING ──
// Tracks how many items were seen last time each tab was visited
const _tabSeenCounts = { stockistlog: null, chemistlog: null, whatsapp: null };

function _updateNewItemBadges() {
  // Stockist Log
  const slCount = (stockistOrders || []).length;
  if (_tabSeenCounts.stockistlog === null) {
    _tabSeenCounts.stockistlog = slCount;
  } else {
    const newSL = Math.max(0, slCount - _tabSeenCounts.stockistlog);
    _setBadge('navBadgeStockistLog', newSL);
  }

  // Chemist Log
  const clCount = (chemistLogs || []).length;
  if (_tabSeenCounts.chemistlog === null) {
    _tabSeenCounts.chemistlog = clCount;
  } else {
    const newCL = Math.max(0, clCount - _tabSeenCounts.chemistlog);
    _setBadge('navBadgeChemistLog', newCL);
  }

  // Tracking — pending transfers are already included in navBadgeTracking via renderDashboard/renderAgentDashboard

  // WhatsApp — count messages relevant to current user
  const waRelevant = (waMessages || []).filter(m => {
    if (currentUser.role === 'admin') return m.dir === 'in';
    return m.dir === 'in' && m.to === currentUser.name;
  });
  const waCount = waRelevant.length;
  if (_tabSeenCounts.whatsapp === null) {
    // On first load: check isNew flag to catch messages sent before login
    const unreadOnLogin = waRelevant.filter(m => m.isNew).length;
    if (unreadOnLogin > 0) {
      _tabSeenCounts.whatsapp = waCount - unreadOnLogin;
      _setBadge('navBadgeWA', unreadOnLogin);
    } else {
      _tabSeenCounts.whatsapp = waCount;
    }
  } else {
    const newWA = Math.max(0, waCount - _tabSeenCounts.whatsapp);
    _setBadge('navBadgeWA', newWA);
  }
  _updateBellBadge();
}

function _updateBellBadge() {
  const ids = ['navBadgeTracking','navBadgeCredits','navBadgeStockistLog','navBadgeChemistLog','navBadgeWA','navBadgeOrderReq','navBadgeMyOrderReq','navBadgeAgents'];
  const total = ids.reduce((sum, id) => {
    const el = document.getElementById(id);
    return sum + (el && el.style.display !== 'none' ? (parseInt(el.textContent) || 0) : 0);
  }, 0);
  _setBadge('bellBadge', total);
}

//  AGENT DASHBOARD
function renderAgentDashboard() {
  const myOrders  = stockistOrders.filter(o => !o.stockistLogDeleted && (
    o.agentName === currentUser.name ||
    o.agentId === currentUser.id ||
    o.originalAgentName === currentUser.name ||
    String(o.originalAgentId) === String(currentUser.id)
  ));
  const myCredits = credits.filter(c => myOrders.some(o => o.chemist === c.chemist));
  const myTransit = myOrders.filter(o => o.status !== 'collected' && !o.trackingDeleted &&
    // For transferred orders, only count if Agent 1 (original) — tracking is frozen but still active
    !(o.transferStatus === 'accepted' && o.originalAgentName === currentUser.name));

  const myPurchase = myOrders.reduce((s,o) => s+(o.purchaseAmount ||0),0);
  const myTotal  = myOrders.reduce((s,o) => s+(o.totalAmount    ||0),0);
  const myCash   = myOrders.reduce((s,o) => s+(o.cash           ||0),0);
  const myOnline = myOrders.reduce((s,o) => s+(o.online         ||0),0);
  const myCredit = myOrders.reduce((s,o) => s+(o.credit         ||0),0);
  const myDues   = myOrders.reduce((s,o) => s+(o.dues           ||0),0);
  const myCashback    = myOrders.reduce((s,o) => s+(o.cashback  ||0),0);
  const myNetTotal    = myOrders.reduce((s,o) => s+((o.totalAmount||0)-(o.cashback||0)),0);
  const myDuesBills   = myOrders.filter(o => (o.dues||0) > 0).length;
  const myLogs        = chemistLogs.filter(l => l.agentId === currentUser.id || l.agentName === currentUser.name);
  const myCharge      = myLogs.reduce((s,l) => s+(l.deliveryCharges||0), 0);
  const myChargeCount = myLogs.filter(l=>(l.deliveryCharges||0)>0).length;
  const myLogBill     = myLogs.reduce((s,l) => s+(l.totalBillAmount||0), 0);
  const myLogPurchase = myLogs.reduce((s,l) => s+(l.purchaseCost||0), 0);
  const myLogGst      = myLogs.reduce((s,l) => s+(l.gstAmount||0), 0);
  const myLogCash     = myLogs.reduce((s,l) => s+(l.cashReceived||0), 0);
  const myLogOnline   = myLogs.reduce((s,l) => s+(l.onlineReceived||0), 0);
  const myLogCredit   = myLogs.reduce((s,l) => s+(l.creditGiven||0), 0);
  const myLogOutstanding = myLogs.reduce((s,l) => s+(l.outstandingAmount||0), 0);
  const myLogPending  = myLogs.filter(l=>l.paymentCollectionStatus!=='collected').length;
  const myCreditAccounts = myCredits.filter(c=>c.status!=='recovered').length;

  // update nav badges
  const pendingTransfersToMe = stockistOrders.filter(o =>
    o.transferStatus === 'pending' && o.transferredTo === currentUser.name
  ).length;
  _setBadge('navBadgeTracking', myTransit.length + pendingTransfersToMe);
  _setBadge('navBadgeCredits',  myCredits.filter(c => Math.max((c.amount||0)-(c.recovered||0),0) > 0).length);

  // Show pending order requests badge on My Order Requests nav item
  const myPendingReqs = orderRequests.filter(r => r.agent === currentUser.name && r.status === 'pending');
  _setBadge('navBadgeMyOrderReq', myPendingReqs.length);

  // today's date string
  const now = new Date();
  const dayStr = now.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long'});

  const tab = document.getElementById('tab-dashboard');
  tab.innerHTML = `
    <div class="agent-dash-greeting">Welcome back, ${currentUser.name} </div>
    <div class="agent-dash-sub">Here's your activity overview for today  ${dayStr}</div>

    <!-- Stockist Log Summary -->
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-header"><div class="panel-title">🏭 Stockist Log</div></div>
      <div class="panel-body" style="padding:14px 18px">
        <div class="stats-grid" style="margin-bottom:0;grid-template-columns:repeat(6,1fr)">
          <div class="stat-card c1"><div class="stat-label">NET TOTAL</div><div class="stat-value" style="font-size:20px;color:var(--accent)">₹${myNetTotal.toLocaleString('en-IN')}</div><div class="stat-sub">after cashback</div><div class="stat-icon">💰</div></div>
          <div class="stat-card c1"><div class="stat-label">PURCHASE</div><div class="stat-value" style="font-size:20px">₹${myPurchase.toLocaleString('en-IN')}</div><div class="stat-sub">${myOrders.length} orders</div><div class="stat-icon">🛒</div></div>
          <div class="stat-card c2"><div class="stat-label">CASH</div><div class="stat-value" style="font-size:20px">₹${myCash.toLocaleString('en-IN')}</div><div class="stat-sub">My cash total</div><div class="stat-icon">💵</div></div>
          <div class="stat-card c2"><div class="stat-label">ONLINE</div><div class="stat-value" style="font-size:20px">₹${myOnline.toLocaleString('en-IN')}</div><div class="stat-sub">UPI / bank transfer</div><div class="stat-icon">📲</div></div>
          <div class="stat-card c5"><div class="stat-label">CREDIT</div><div class="stat-value" style="font-size:20px">₹${myCredit.toLocaleString('en-IN')}</div><div class="stat-sub">${myCreditAccounts} accounts</div><div class="stat-icon">💜</div></div>
          <div class="stat-card c3"><div class="stat-label">DUES</div><div class="stat-value" style="font-size:20px">₹${myDues.toLocaleString('en-IN')}</div><div class="stat-sub">${myDuesBills} pending</div><div class="stat-icon">⚠️</div></div>
        </div>
      </div>
    </div>
    <!-- Chemist Log Summary -->
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-header"><div class="panel-title">🏥 Chemist Log</div></div>
      <div class="panel-body" style="padding:14px 18px">
        <div class="stats-grid" style="margin-bottom:0;grid-template-columns:repeat(6,1fr)">
          <div class="stat-card c1"><div class="stat-label">TOTAL BILL</div><div class="stat-value" style="font-size:20px">₹${myLogBill.toLocaleString('en-IN')}</div><div class="stat-sub">${myLogs.length} logs</div><div class="stat-icon">🧾</div></div>
          <div class="stat-card c1"><div class="stat-label">PURCHASE</div><div class="stat-value" style="font-size:20px">₹${myLogPurchase.toLocaleString('en-IN')}</div><div class="stat-sub">from stockist</div><div class="stat-icon">🏥</div></div>
          <div class="stat-card c2"><div class="stat-label">CASH</div><div class="stat-value" style="font-size:20px">₹${myLogCash.toLocaleString('en-IN')}</div><div class="stat-sub">Cash received</div><div class="stat-icon">💵</div></div>
          <div class="stat-card c2"><div class="stat-label">ONLINE</div><div class="stat-value" style="font-size:20px">₹${myLogOnline.toLocaleString('en-IN')}</div><div class="stat-sub">UPI / bank transfer</div><div class="stat-icon">📲</div></div>
          <div class="stat-card c5"><div class="stat-label">CREDIT</div><div class="stat-value" style="font-size:20px">₹${myLogCredit.toLocaleString('en-IN')}</div><div class="stat-sub">${myLogPending} pending</div><div class="stat-icon">💜</div></div>
          <div class="stat-card c3"><div class="stat-label">OUTSTANDING</div><div class="stat-value" style="font-size:20px">₹${myLogOutstanding.toLocaleString('en-IN')}</div><div class="stat-sub">unpaid</div><div class="stat-icon">⚠️</div></div>
        </div>
      </div>
    </div>

    <div class="quick-actions" style="margin-bottom:20px">
      <div class="quick-btn" onclick="openNewStockistOrderForm()">
        <div class="quick-btn-icon"></div>
        <div class="quick-btn-label">New Stockist Order</div>
        <div class="quick-btn-sub">Record a purchase</div>
      </div>
      <div class="quick-btn" onclick="switchTab('tracking', document.querySelector('[data-tab=tracking]'))">
        <div class="quick-btn-icon"></div>
        <div class="quick-btn-label">Tracking</div>
        <div class="quick-btn-sub">${myTransit.length} active parcels</div>
      </div>
      <div class="quick-btn" onclick="switchTab('stockistlog', document.querySelector('[data-tab=stockistlog]'))">
        <div class="quick-btn-icon"></div>
        <div class="quick-btn-label">Stockist Log</div>
        <div class="quick-btn-sub">${myOrders.length} total orders</div>
      </div>
    </div>

    ${(() => {
      const myPending = orderRequests.filter(r => r.agent === currentUser.name && r.status === 'pending');
      if (!myPending.length) return '';
      return `<div class="panel" style="margin-bottom:18px;border:2px solid var(--accent4);background:rgba(255,209,102,0.04)">
        <div class="panel-header" style="background:rgba(255,209,102,0.08);border-bottom:1px solid rgba(255,209,102,0.25)">
          <div class="panel-title" style="color:var(--accent4)">🔔 New Order Requests (${myPending.length})</div>
          <button class="btn btn-ghost" style="font-size:11px" onclick="switchTab('myorderrequests',document.querySelector('[data-tab=myorderrequests]'))">View All →</button>
        </div>
        <div class="panel-body" style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
          ${myPending.map(r => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:var(--surface2);border:1px solid rgba(255,209,102,0.3)">
              <div style="width:8px;height:8px;border-radius:50%;background:var(--accent4);flex-shrink:0;animation:pulse 1.5s infinite"></div>
              <div style="flex:1;min-width:0">
                <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:13px">${r.chemist||'—'}</div>
                <div style="font-size:11px;color:var(--text2);margin-top:2px">
                  🏭 ${(r.stockists||[]).join(', ')||'—'} &nbsp;·&nbsp; 📅 ${r.date||'—'}
                  ${r.notes ? `&nbsp;·&nbsp; 📝 ${r.notes}` : ''}
                </div>
              </div>
              <button class="btn btn-primary" style="font-size:11px;padding:6px 14px;flex-shrink:0" onclick="openAcceptOrderRequest('${r._id}')">✅ Accept</button>
            </div>`).join('')}
        </div>
      </div>`;
    })()}

    <div class="grid-2" style="margin-bottom:18px">
      <div class="panel">
        <div class="panel-header"><div class="panel-title"> Active Deliveries</div><button class="btn btn-ghost" style="font-size:11px" onclick="switchTab('tracking',document.querySelector('[data-tab=tracking]'))">View All </button></div>
        <div class="panel-body">
          ${myTransit.length ? myTransit.slice(0,4).map(o => {
              return `
            <div class="delivery-item" onclick="switchTab('stockistlog', document.querySelector('[data-tab=stockistlog]'))" style="cursor:pointer">
              <div class="delivery-icon" style="background:rgba(61,207,194,0.12)"></div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.chemist || ''}</div>
                <div style="font-size:10px;color:var(--text2)">${o.stockist || ''}  ${(o.totalAmount||0).toLocaleString('en-IN')}</div>
                <div style="font-size:10px;color:var(--accent);margin-top:2px">${o.orderId || ''}</div>
              </div>
              <span class="track-status-badge ts-${o.status||'pending'}" style="font-size:9px">${_SL_LABELS[o.status]||o.status}</span>
            </div>`;
            }).join('')
          : `<div style="text-align:center;color:var(--text2);font-size:12px;padding:20px 0"> All deliveries complete!</div>`}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header"><div class="panel-title"> My Credit Accounts</div><button class="btn btn-ghost" style="font-size:11px" onclick="switchTab('credits',document.querySelector('[data-tab=credits]'))">View All </button></div>
        <div class="panel-body">
          ${myCredits.filter(c=>c.status!=='recovered').length ? myCredits.filter(c=>c.status!=='recovered').slice(0,4).map(c => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer"
              onclick="switchTab('credits',document.querySelector('[data-tab=credits]'));setTimeout(()=>{const el=document.getElementById('credit-${c._id}');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.style.outline='2px solid var(--accent5)';setTimeout(()=>el.style.outline='',1500);}},200)">
              <div style="flex:1">
                <div style="font-weight:700;font-size:12px">${c.chemist}</div>
                <div style="font-size:10px;color:var(--text2)">${c.dueDate||'No due date'}</div>
              </div>
              <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--accent5)">${(c.amount||0).toLocaleString('en-IN')}</div>
            </div>`).join('')
          : `<div style="text-align:center;color:var(--text2);font-size:12px;padding:20px 0">No credit accounts</div>`}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"> My Recent Stockist Orders</div>
        <button class="btn btn-ghost" style="font-size:11px" onclick="switchTab('stockistlog',document.querySelector('[data-tab=stockistlog]'))">View All </button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ORDER ID</th><th>DATE</th><th>CHEMIST</th><th>STOCKIST</th><th>TOTAL</th><th>CASH</th><th>ONLINE</th><th>CREDIT</th><th>STATUS</th></tr></thead>
          <tbody>
            ${myOrders.length ? myOrders.slice(0,5).map(o => `
              <tr>
                <td style="font-family:'DM Mono',monospace;color:var(--accent);font-size:11px">${o.orderId||''}</td>
                <td>${o.date||''}</td>
                <td><b>${o.chemist||''}</b></td>
                <td>${o.stockist||''}</td>
                <td style="font-family:'DM Mono',monospace">${(o.totalAmount||0).toLocaleString('en-IN')}</td>
                <td style="font-family:'DM Mono',monospace">${(o.cash||0).toLocaleString('en-IN')}</td>
                <td style="font-family:'DM Mono',monospace">${(o.online||0).toLocaleString('en-IN')}</td>
                <td style="font-family:'DM Mono',monospace">${(o.credit||0).toLocaleString('en-IN')}</td>
                <td><span class="track-status-badge ts-${o.status||'pending'}">${_SL_LABELS[o.status]||o.status||'pending'}</span></td>
              </tr>`).join('')
            : `<tr><td colspan="9" style="text-align:center;color:var(--text2);padding:24px">No orders yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

//  WHATSAPP TAB

// In-memory message store  synced from backend
let waMessages = [];

// Persist last selected WA form state across re-renders
let waFormState = JSON.parse(localStorage.getItem('waFormState') || '{}');

async function fetchWaMessages() {
  try {
    const res = await fetch(`${API_URL}/messages`, { headers: getHeaders() });
    if (res.ok) waMessages = await res.json();
  } catch (err) { console.error("WA fetch failed", err); }
}

function saveWaMessages() {}

function renderWhatsAppTab() {
  const tab = document.getElementById('tab-whatsapp');
  if (!tab) return;

  const isAdmin = currentUser.role === 'admin';
  if (isAdmin) renderWhatsAppAdmin(tab);
  else         renderWhatsAppAgent(tab);
}

//  ADMIN WA VIEW
function renderWhatsAppAdmin(tab) {
  const agentNames = agents.filter(a => a.approved).map(a => a.name);
  const incoming   = waMessages.filter(m => m.dir === 'in');

  tab.innerHTML = `
    <div class="grid-2" style="margin-bottom:18px;align-items:start">

      <!-- LEFT: Incoming -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"> Incoming WA Messages</div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost" style="font-size:11px" onclick="waSyncIncoming()"> Sync</button>
            <button class="btn btn-ghost" style="font-size:11px" onclick="waClearIncoming()">Clear</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="wa-feed" id="waFeed">
            ${incoming.length ? incoming.slice().reverse().map(m => `
              <div class="wa-msg ${(m.from||'').toLowerCase().split(' ')[0]}">
                <div class="wa-meta">
                  <span class="wa-sender">${m.from || 'Unknown'}</span>
                  <span class="wa-time">${m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}) : ''}</span>
                </div>
                <div class="wa-text">${m.text}</div>
                ${m.amount ? `<div class="wa-amount">${Number(m.amount).toLocaleString('en-IN')}</div>` : ''}
                ${m.isNew ? `<div class="wa-new"></div>` : ''}
              </div>`).join('')
            : `<div style="text-align:center;color:var(--text2);font-size:12px;padding:24px">No messages yet</div>`}
          </div>
        </div>
      </div>

      <!-- RIGHT: Send to Agent -->
        <div class="panel-body">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>To Agent</label>
              <select class="form-control" id="waSendToAgent" onchange="waUpdatePreview()">
                ${agentNames.map(n => `<option>${n}</option>`).join('')}
              </select>
            </div>
            <div class="form-group form-full">
              <label>Message Type</label>
              <select class="form-control" id="waMsgType" onchange="if(this.value==='custom'){document.getElementById('waMsgPreview').value='';}waUpdatePreview()">
                <option value="dispatch">Order Dispatch</option>
                <option value="payment">Payment Request</option>
                <option value="bill">Bill Summary</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div class="form-group">
              <label>Chemist</label>
              <select class="form-control" id="waMsgChemist" onchange="waUpdatePreview()">
                ${chemistsList.map(c => `<option>${c}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Stockist</label>
              <select class="form-control" id="waMsgStockist" onchange="waUpdatePreview()">
                ${stockistsList.map(s => `<option>${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-group form-full">
              <label>Message Preview</label>
              <textarea class="form-control" id="waMsgPreview" rows="3" style="font-family:'DM Mono',monospace;font-size:12px"></textarea>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
            <button class="btn btn-primary" style="font-size:12px;flex:1" onclick="waSendToAgent()"> Send to Agent (In-App)</button>
            <button class="btn btn-ghost"   style="font-size:12px" onclick="waOpenWhatsApp()"> WhatsApp</button>
            <button class="btn btn-ghost"   style="font-size:12px" onclick="waCopyMsg()"> Copy</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-Parsed Orders -->
    <div class="panel">
      <div class="panel-header"><div class="panel-title"> Auto-Parsed Orders from WA</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>TIME</th><th>FROM</th><th>PARSED TEXT</th><th>AMOUNT</th><th>STOCKIST</th><th>CHEMIST</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody id="waParsedTable">
            ${incoming.filter(m => m.amount).length
              ? incoming.filter(m => m.amount).map(m => `
                  <tr>
                    <td>${m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}) : ''}</td>
                    <td>${m.from||''}</td>
                    <td style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.text}</td>
                    <td>${Number(m.amount).toLocaleString('en-IN')}</td>
                    <td>${m.stockist||''}</td>
                    <td>${m.chemist||''}</td>
                    <td><span class="tag tag-${m.parsed?'done':'pending'}">${m.parsed?'Imported':'Pending'}</span></td>
                    <td><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="waImportOrder('${m._id}')">Import</button></td>
                  </tr>`).join('')
              : `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:20px">No parsed orders</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;

  // Restore last saved selections
  const s = waFormState;
  if (s.agent)    { const el = document.getElementById('waSendToAgent');  if (el) el.value = s.agent; }
  if (s.type)     { const el = document.getElementById('waMsgType');      if (el) el.value = s.type; }
  if (s.chemist)  { const el = document.getElementById('waMsgChemist');   if (el) el.value = s.chemist; }
  if (s.stockist) { const el = document.getElementById('waMsgStockist');  if (el) el.value = s.stockist; }

  waUpdatePreview();
}

function renderWhatsAppAgent(tab) {
  const agentName = currentUser.name;
  // Messages from admin to this agent + messages this agent sent to admin
  const thread = waMessages.filter(m =>
    (m.dir === 'in' && m.to === agentName) ||
    (m.from === agentName && m.to === 'admin')
  ).sort((a, b) => a.id - b.id);

  tab.innerHTML = `
    <div class="grid-2" style="margin-bottom:18px;align-items:start">

      <!-- LEFT: Conversation thread -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title"> Messages</div>
          <button class="btn btn-ghost" style="font-size:11px" onclick="waSyncIncoming()"> Sync</button>
        </div>
        <div class="panel-body">
          <div class="wa-feed" id="waFeed">
            ${thread.length ? thread.map(m => {
              const isMine = m.from === agentName;
              return `
              <div class="wa-msg" style="${isMine ? 'align-self:flex-end;background:rgba(61,207,194,0.1);border-left:none;border-right:2px solid var(--accent)' : ''}">
                <div class="wa-meta">
                  <span class="wa-sender">${isMine ? 'You' : 'Admin'}</span>
                  <span class="wa-time">${m.createdAt ? new Date(m.createdAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}) : ''}</span>
                </div>
                <div class="wa-text">${m.text}</div>
                ${m.amount ? `<div class="wa-amount">${Number(m.amount).toLocaleString('en-IN')}</div>` : ''}
                ${m.isNew && !isMine ? `<div class="wa-new"></div>` : ''}
              </div>`;
            }).join('')
            : `<div style="text-align:center;color:var(--text2);font-size:12px;padding:24px">No messages yet</div>`}
          </div>
        </div>
      </div>

      <!-- RIGHT: Send to Admin -->
      <div class="panel">
        <div class="panel-header"><div class="panel-title"> Send Message to Admin</div></div>
        <div class="panel-body">
          <div class="form-grid">
            <div class="form-group form-full">
              <label>To</label>
              <input class="form-control" value="Admin" disabled>
            </div>
            <div class="form-group form-full">
              <label>Message</label>
              <textarea class="form-control" id="waAgentMsg" rows="4" placeholder="Type your message to admin..."></textarea>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-primary" style="font-size:12px;flex:1" onclick="waAgentSendToAdmin()"> Send to Admin (In-App)</button>
            <button class="btn btn-ghost"   style="font-size:12px" onclick="waAgentOpenWhatsApp()"> WhatsApp</button>
          </div>
        </div>
      </div>
    </div>`;
}

//  WA HELPERS
function waUpdatePreview() {
  const type     = document.getElementById('waMsgType')?.value;
  const chemist  = document.getElementById('waMsgChemist')?.value  || '';
  const stockist = document.getElementById('waMsgStockist')?.value || '';
  const agent    = document.getElementById('waSendToAgent')?.value || '';
  const preview  = document.getElementById('waMsgPreview');
  if (!preview) return;

  // Persist selections
  waFormState = { type, chemist, stockist, agent };
  localStorage.setItem('waFormState', JSON.stringify(waFormState));

  if (type === 'custom') {
    // Don't wipe user's typed message  only clear if field is empty
    return;
  }

  const templates = {
    dispatch: `Hi ${agent}, order for *${chemist}* via *${stockist}* has been dispatched. Please collect payment on delivery.`,
    payment:  `Hi ${agent}, please collect payment from *${chemist}* (${stockist}) at the earliest.`,
    bill:     `Hi ${agent}, bill summary for *${chemist}* via *${stockist}* is ready. Please confirm receipt.`,
  };
  preview.value = templates[type] || '';
}

function waSendToAgent() {
  const to   = document.getElementById('waSendToAgent')?.value;
  const text = document.getElementById('waMsgPreview')?.value?.trim();
  if (!text) { showToast(" Empty", "Write a message first"); return; }
  const msg = {
    dir: 'in', to, from: 'Admin', text, isNew: true
  };
  fetch(`${API_URL}/messages`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(msg) })
    .then(r => r.json()).then(async () => {
      await fetchWaMessages();
      renderWhatsAppTab();
      showToast(" Sent", `Message sent to ${to}`);
    });
}

function waOpenWhatsApp() {
  const agentName = document.getElementById('waSendToAgent')?.value || '';
  const text = encodeURIComponent(document.getElementById('waMsgPreview')?.value || '');
  const agentObj = agents.find(a => a.name === agentName);
  const phone = agentObj?.phone ? agentObj.phone.replace(/\D/g, '') : '';
  const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  window.open(url, '_blank');
}

function waCopyMsg() {
  const text = document.getElementById('waMsgPreview')?.value || '';
  navigator.clipboard.writeText(text).then(() => showToast(" Copied", "Message copied"));
}

async function waSyncIncoming() {
  await fetch(`${API_URL}/messages/read`, { method: 'PUT', headers: getHeaders() });
  await fetchWaMessages();
  renderWhatsAppTab();
  showToast(" Synced", "Messages up to date");
}

async function waClearIncoming() {
  if (!confirm("Clear all messages?")) return;
  const res = await fetch(`${API_URL}/messages/clear`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) {
    await fetchWaMessages();
    renderWhatsAppTab();
    showToast(" Cleared", "All messages removed");
  }
}

async function waImportOrder(id) {
  const msg = waMessages.find(m => m._id === id);
  if (!msg) return;
  await fetch(`${API_URL}/messages/${id}/parsed`, { method: 'PUT', headers: getHeaders() });
  await fetchWaMessages();
  openNewStockistOrderForm();
  renderWhatsAppTab();
}

function waAgentSendToAdmin() {
  const text = document.getElementById('waAgentMsg')?.value?.trim();
  if (!text) { showToast(" Empty", "Write a message first"); return; }
  const msg = {
    dir: 'in', from: currentUser.name, to: 'admin', text, isNew: true
  };
  fetch(`${API_URL}/messages`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(msg) })
    .then(r => r.json()).then(async () => {
      document.getElementById('waAgentMsg').value = '';
      await fetchWaMessages();
      renderWhatsAppTab();
      showToast(" Sent", "Message sent to Admin");
    });
}

function waAgentOpenWhatsApp() {
  const text = encodeURIComponent(document.getElementById('waAgentMsg')?.value || '');
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function renderTrackingTab() {
  const list    = document.getElementById('trackingList');
  const filters = document.getElementById('trackingFilters');
  if (!list) return;
  const isAdmin = currentUser.role === 'admin';

  const visibleOrders = isAdmin
    ? stockistOrders.filter(o => !o.trackingDeleted)
    : stockistOrders.filter(o => {
        if (o.trackingDeleted) return false;
        // Agent 1 (original): sees their tracking log even after transfer (shows as frozen/transferred)
        const isOriginal = o.originalAgentName
          ? o.originalAgentName === currentUser.name
          : (o.transferredFrom === currentUser.name);
        // Agent 2 (new): sees it after accepted transfer
        const isNewAgent = o.agentName === currentUser.name || String(o.agentId) === String(currentUser.id);
        // Pending transfer: show to receiving agent
        const isPendingForMe = o.transferStatus === 'pending' && o.transferredTo === currentUser.name;
        return isNewAgent || isOriginal || isPendingForMe;
      });

  const fAgent    = list._fAgent    || '';
  const fStatus   = list._fStatus   || '';
  const fChemist  = list._fChemist  || '';
  const fStockist = list._fStockist || '';
  const fOrderId  = list._fOrderId  || '';
  
  // Build dropdown options from visible (non-deleted) orders only
  // For tracking tab, use trOrderId (tracking IDs) not orderId (stockist log IDs)
  const uniqueAgents    = [...new Set(visibleOrders.map(o => o.agentName).filter(Boolean))].sort();
  const uniqueChemists  = [...new Set(visibleOrders.map(o => o.chemist).filter(Boolean))].sort();
  const uniqueStockists = [...new Set(visibleOrders.map(o => o.stockist).filter(Boolean))].sort();
  const uniqueOrderIds  = [...new Set(visibleOrders.map(o => o.trOrderId).filter(Boolean))].sort();
  const opt = (v, l, sel) => `<option value="${v}"${sel === v ? ' selected' : ''}>${l}</option>`;

  if (filters) {
    filters.innerHTML = `
      <select class="form-control" style="width:175px;font-size:12px"
        onchange="document.getElementById('trackingList')._fOrderId=this.value;renderTrackingTab()">
        ${opt('', 'All Order IDs', fOrderId)}${uniqueOrderIds.map(id => opt(id, id, fOrderId)).join('')}
      </select>
      <select class="form-control" style="width:160px;font-size:12px"
        onchange="document.getElementById('trackingList')._fChemist=this.value;renderTrackingTab()">
        ${opt('', 'All Chemists', fChemist)}${uniqueChemists.map(c => opt(c, c, fChemist)).join('')}
      </select>
      <select class="form-control" style="width:160px;font-size:12px"
        onchange="document.getElementById('trackingList')._fStockist=this.value;renderTrackingTab()">
        ${opt('', 'All Stockists', fStockist)}${uniqueStockists.map(s => opt(s, s, fStockist)).join('')}
      </select>
      ${isAdmin ? `<select class="form-control" style="width:150px;font-size:12px"
        onchange="document.getElementById('trackingList')._fAgent=this.value;renderTrackingTab()">
        ${opt('', 'All Agents', fAgent)}${uniqueAgents.map(a => opt(a, a, fAgent)).join('')}
      </select>` : ''}
      <select class="form-control" style="width:175px;font-size:12px"
        onchange="document.getElementById('trackingList')._fStatus=this.value;renderTrackingTab()">
        ${opt('', 'All Orders', fStatus)}
        ${_SL_STEPS.map(s => opt(s, _SL_LABELS[s], fStatus)).join('')}
      </select>
      <button class="btn btn-ghost" style="font-size:11px"
        onclick="var l=document.getElementById('trackingList');l._fOrderId='';l._fChemist='';l._fStockist='';l._fAgent='';l._fStatus='';renderTrackingTab()">Clear</button>`;
  }

  let filtered = visibleOrders;
  if (fAgent)    filtered = filtered.filter(o => o.agentName === fAgent);
  if (fStatus)   filtered = filtered.filter(o => o.status    === fStatus);
  if (fChemist)  filtered = filtered.filter(o => o.chemist   === fChemist);
  if (fStockist) filtered = filtered.filter(o => o.stockist  === fStockist);
  if (fOrderId)  filtered = filtered.filter(o => o.trOrderId === fOrderId);

  // Sort: active orders first, collected last; within each group newest first
  filtered = filtered.slice().sort((a, b) => {
    const aCollected = a.status === 'collected' ? 1 : 0;
    const bCollected = b.status === 'collected' ? 1 : 0;
    if (aCollected !== bCollected) return aCollected - bCollected;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="month-empty">${visibleOrders.length ? 'No orders match filters' : 'No orders to track'}</div>`;
    return;
  }

  list.innerHTML = filtered.map(o => {
    const curIdx      = _SL_STEPS.indexOf(o.status || 'pending');
    const nextStatus  = curIdx >= 0 && curIdx < _SL_STEPS.length - 1 ? _SL_STEPS[curIdx + 1] : null;
    const isCollected = o.status === 'collected';
    const isTransferPending  = o.transferStatus === 'pending';
    const isTransferAccepted = o.transferStatus === 'accepted';
    // Original agent can't advance after transfer; new agent (agentName updated) can
    const isOriginalAgent = o.originalAgentName === currentUser.name ||
                            String(o.originalAgentId) === String(currentUser.id);
    // Agent 2 (new agent after transfer) can advance freely
    // Agent 1 (original) is frozen after transfer
    const canAdvance = !isTransferPending &&
                       !(isTransferAccepted && isOriginalAgent) &&
                       (isAdmin || o.agentName === currentUser.name);

    // For Agent 1 (original), freeze timeline at the status when transfer was made
    const frozenStatus = (isOriginalAgent && isTransferAccepted && o.transferredAtStatus)
      ? o.transferredAtStatus
      : o.status;
    const frozenIdx = _SL_STEPS.indexOf(frozenStatus || 'pending');

    const steps = _SL_STEPS.map((s, i) => `
      <div class="track-step ${i < frozenIdx ? 'done' : i === frozenIdx ? 'active' : ''}">
        <div class="track-dot">${_SL_ICONS[s]}</div>
        <div class="track-label">${_SL_LABELS[s]}</div>
      </div>`).join('');

    const advanceBtn = (canAdvance && nextStatus && !isCollected) ? `
      <div style="margin-top:12px">
        <button class="btn btn-primary" style="font-size:11px"
          onclick="advanceOrderStatus('${o._id}','${nextStatus}','')">
          ${_SL_ICONS[nextStatus]} Advance to ${_SL_LABELS[nextStatus]}
        </button>
      </div>`
    : isTransferPending ? `
      <div style="margin-top:12px;padding:8px 12px;background:rgba(245,166,35,0.08);border-radius:8px;font-size:11px;color:var(--accent4)">
        ⏸ Status frozen — transfer pending acceptance by <b>${o.transferredTo}</b>
      </div>`
    : isTransferAccepted && isOriginalAgent ? `
      <div style="margin-top:12px;padding:8px 12px;background:rgba(61,207,194,0.08);border-radius:8px;font-size:11px;color:var(--accent)">
        ✅ Order transferred to <b>${o.agentName}</b> — no further action required
      </div>`
    : '';

    // Full status history rows
    const historyRows = (o.statusHistory && o.statusHistory.length)
      ? o.statusHistory.map(h => `
          <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid rgba(61,207,194,0.08);font-size:11px">
            <span style="width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0;display:inline-block"></span>
            <span class="track-status-badge ts-${h.status||'pending'}" style="font-size:9px;flex-shrink:0">${_SL_LABELS[h.status]||h.status}</span>
            <span style="font-weight:600;color:var(--text);flex-shrink:0">${h.changedBy||'—'}</span>
            <span style="color:var(--text2);font-family:'DM Mono',monospace;font-size:10px;flex-shrink:0">${h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>
            ${h.remark ? `<span style="color:var(--accent);font-size:10px;margin-left:auto">"${h.remark}"</span>` : ''}
          </div>`).join('')
      : `<div style="font-size:11px;color:var(--text2);padding:6px 0">No history recorded</div>`;

    // Green collected banner
    const collectedBanner = isCollected ? `
      <div style="background:rgba(61,207,194,0.1);border:1px solid rgba(61,207,194,0.3);border-radius:8px;padding:8px 14px;margin-top:10px;display:flex;align-items:center;gap:8px">
        <span style="font-size:16px">✅</span>
        <div>
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:12px;color:var(--accent)">Order Collected</div>
          <div style="font-size:10px;color:var(--text2);font-family:'DM Mono',monospace">${o.collectedAt ? new Date(o.collectedAt).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : o.date || ''}</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:var(--accent)">₹${(o.totalAmount||0).toLocaleString('en-IN')}</div>
          <div style="font-size:10px;color:var(--text2)">Cash: ₹${(o.cash||0).toLocaleString('en-IN')} · Credit: ₹${(o.credit||0).toLocaleString('en-IN')}</div>
        </div>
      </div>` : '';

    return `
      <div class="track-card" id="track-${o._id}" style="${isCollected ? 'opacity:0.85;border-color:rgba(61,207,194,0.3)' : ''}">

        <!-- Header -->
        <div class="track-card-header">
          <div style="display:flex;flex-direction:column;gap:2px">
            <span class="track-id" style="font-family:'DM Mono',monospace;color:var(--accent)">${o.trOrderId || o.orderId || ''} &nbsp; ${o.chemist || ''}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${isAdmin ? `<span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">👤 ${o.agentName || ''}</span>` : ''}
            <span class="track-status-badge ts-${o.status || 'pending'}">${_SL_LABELS[o.status || 'pending']}</span>
            ${o.transferStatus === 'pending' && o.transferredTo === currentUser.name ? `
              <button class="btn btn-primary" style="font-size:10px;padding:4px 10px" onclick="acceptTransfer('${o._id}')">✅ Accept</button>
              <button class="btn btn-danger" style="font-size:10px;padding:4px 10px" onclick="rejectTransfer('${o._id}')">❌ Reject</button>
            ` : ''}
            ${o.transferStatus === 'none' && o.status !== 'collected' && !isAdmin && o.agentName === currentUser.name ? `<button class="btn btn-ghost" style="font-size:10px;padding:4px 8px;display:inline-flex;align-items:center;gap:4px" onclick="openTransferModal('${o._id}')" title="Transfer order"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" style="display:none"/><path d="M14 3l7 7-7 7V13c-5 0-8.5 1.5-11 5 1-5 4-10 11-11V3z"/></svg> Transfer</button>` : ''}
            ${isAdmin ? `<button class="btn-delete" onclick="deleteTrackingOrder('${o._id}')" title="Delete tracking record"></button>` : ''}
          </div>
        </div>

        <!-- Transfer status banner -->
        ${o.transferStatus === 'pending' && o.transferredFrom ? `
          <div style="background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);border-radius:8px;padding:8px 12px;margin:8px 0;font-size:11px;color:var(--accent4)">
            🔄 Transfer pending to <b>${o.transferredTo}</b> — awaiting acceptance
          </div>` : ''}
        ${o.transferStatus === 'accepted' && o.transferredFrom ? `
          <div style="background:rgba(61,207,194,0.08);border:1px solid rgba(61,207,194,0.2);border-radius:8px;padding:8px 12px;margin:8px 0;font-size:11px;color:var(--accent)">
            ✅ Order transferred to <b>${o.agentName}</b> (from ${o.transferredFrom})
          </div>` : ''}

        <!-- Info row -->
        <div style="font-size:11px;color:var(--text2);margin-bottom:10px">
          ${o.date || ''} &nbsp;🏭 ${o.stockist || ''} &nbsp;₹${(o.totalAmount || 0).toLocaleString('en-IN')}
          ${(o.dues||0) > 0 ? `<span style="color:var(--accent3);margin-left:6px">⚠ Dues: ₹${o.dues.toLocaleString('en-IN')}</span>` : ''}
        </div>

        <!-- Status timeline -->
        <div class="track-timeline">${steps}</div>

        ${collectedBanner}
        ${advanceBtn}

        <!-- Collapsible status history -->
        <div style="margin-top:12px">
          <div onclick="var el=this.nextElementSibling;el.style.display=el.style.display==='block'?'none':'block'"
            style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--text2);font-family:'DM Mono',monospace;user-select:none;padding:4px 0">
            <span>📋</span>
            <span>Status History (${(o.statusHistory||[]).length} entries)</span>
            <span style="margin-left:auto;font-size:10px">▼</span>
          </div>
          <div style="display:none;margin-top:6px;background:var(--surface2);border-radius:8px;padding:10px 12px">
            ${historyRows}
          </div>
        </div>

      </div>`;
  }).join('');
}

//  CREDITS TAB
function renderCreditsTab() {
  const tab = document.getElementById('tab-credits');
  if (!tab) return;

  // Agents only see their own credits (backend scopes this, but filter locally too)
  const visibleCredits = (currentUser.role === 'admin'
    ? credits
    : credits.filter(c => c.agentName === currentUser.name))
    .slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // A credit is recovered only when fully paid, otherwise overdue
  const effectiveStatus = c => {
    const remaining = Math.max((c.amount || 0) - (c.recovered || 0), 0);
    return remaining === 0 ? 'recovered' : 'overdue';
  };

  const overdue   = visibleCredits.filter(c => effectiveStatus(c) === 'overdue');
  const recovered = visibleCredits.filter(c => effectiveStatus(c) === 'recovered');
  const totalOut  = visibleCredits.reduce((s, c) => s + Math.max((c.amount || 0) - (c.recovered || 0), 0), 0);

  const rows = visibleCredits.length
    ? visibleCredits.map(c => {
        const status    = effectiveStatus(c);
        const agentName = c.agentName || '';
        const orderId   = (c.orderId && typeof c.orderId === 'object') ? (c.orderId.orderId || '') : (c.orderId || '');
        const remaining = Math.max((c.amount || 0) - (c.recovered || 0), 0);
        const statusClass = status === 'recovered' ? 'done' : 'overdue';

        const recoveredCell = `<td>
               <div style="display:flex;align-items:center;gap:6px">
                 <input type="number" value="${c.recovered || 0}" min="0" max="${c.amount || 0}"
                   style="width:90px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:11px"
                   onchange="updateRecovered('${c._id}', this.value, ${c.amount || 0})">
                 <span style="font-size:10px;color:var(--text2)">/ ${(c.amount||0).toLocaleString('en-IN')}</span>
               </div>
             </td>`;

        return `<tr id="credit-${c._id}">
          <td><b>${c.chemist}</b></td>
          ${currentUser.role === 'admin' ? `<td>${agentName}</td>` : ''}
          <td style="font-family:'DM Mono',monospace;color:var(--accent)">${orderId}</td>
          <td>${(c.amount || 0).toLocaleString('en-IN')}</td>
          ${recoveredCell}
          <td>${remaining.toLocaleString('en-IN')}</td>
          <td><span class="tag tag-${statusClass}">${status}</span></td>
          ${currentUser.role === 'admin' ? `<td><button class="btn-delete" onclick="deleteCredit('${c._id}')" title="Delete credit"></button></td>` : '<td></td>'}
        </tr>`;
      }).join('')
    : `<tr><td colspan="${currentUser.role === 'admin' ? 8 : 7}" style="text-align:center;color:var(--text2);padding:24px">No credits recorded</td></tr>`;

  tab.innerHTML = `
    <div class="stats-grid-3" style="margin-bottom:18px">
      <div class="stat-card c5"><div class="stat-label">Outstanding</div><div class="stat-value">${totalOut.toLocaleString('en-IN')}</div><div class="stat-icon"></div></div>
      <div class="stat-card c3"><div class="stat-label">Overdue</div><div class="stat-value">${overdue.length}</div><div class="stat-icon"></div></div>
      <div class="stat-card c1"><div class="stat-label">Recovered</div><div class="stat-value">${recovered.length}</div><div class="stat-icon"></div></div>
    </div>
    <div class="panel">
      <div class="panel-header"><div class="panel-title">💳 Credit Ledger</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>CHEMIST</th>
            ${currentUser.role === 'admin' ? '<th>AGENT</th>' : ''}
            <th>ORDER #</th><th>AMOUNT</th><th>RECOVERED</th><th>REMAINING</th><th>STATUS</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

async function updateRecovered(id, value, maxAmount) {
  let recovered = parseFloat(value) || 0;
  if (recovered > maxAmount) recovered = maxAmount;
  if (recovered < 0) recovered = 0;
  const status = recovered >= maxAmount ? 'recovered' : 'pending';
  const res = await fetch(`${API_URL}/credits/${id}`, {
    method: "PUT", headers: getHeaders(),
    body: JSON.stringify({ recovered, status })
  });
  if (res.ok) {
    const idx = credits.findIndex(c => c._id === id);
    if (idx !== -1) { credits[idx].recovered = recovered; credits[idx].status = status; }
    // Update credits badge — only count non-recovered credits
    const pendingCreds = credits.filter(c => c.status !== 'recovered');
    _setBadge('navBadgeCredits', pendingCreds.length);
    _updateBellBadge();
    renderCreditsTab();
    showToast("✅ Updated", status === 'recovered' ? "Credit fully recovered" : "Recovery updated");
  }
}

async function deleteCredit(id) {
  if (!confirm('Delete this credit entry permanently?')) return;
  try {
    const res = await fetch(`${API_URL}/credits/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) {
      credits = credits.filter(c => c._id !== id);
      renderCreditsTab();
      showToast('🗑️ Deleted', 'Credit entry removed');
    } else {
      showToast('❌ Error', 'Failed to delete credit');
    }
  } catch (e) {
    showToast('❌ Error', 'Server offline');
  }
}

//  BILL GENERATOR

let billItems = [];

// Company details
const COMPANY = {
  name:    'ZIPX.APP LOGISTICS PVT LTD',
  pan:     'AACCZ2067K',
  gstin:   '10AACCZ2067K1ZE',
  phone:   '9308996386',
  email:   'info@zipx.app',
  address: 'B-HUB 49,51 - 5TH FLOOR, BLOCK-A MAURYA LOK COMPLEX PATNA, Bihar, 800001',
  web:     'www.zipx.app',
  bank:    { name:'IDFC FIRST Bank', ifsc:'IDFB0060284', acc:'50106202315', branch:'PATNA-ASHIANA DIGHA ROAD BRANCH' },
  upi:     'ZIPX7787@IDFCBANK'
};

function renderBillTab() {
  const tab = document.getElementById('tab-bills');
  if (!tab) return;

  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;height:calc(100vh - 140px)">
      <!-- LEFT PANEL: FORM -->
      <div class="panel" style="overflow-y:auto">
        <div class="panel-header">
          <div class="panel-title">🧾 Generate Multi-Stockist Bill</div>
        </div>
        <div class="panel-body">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:11px;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Invoice Details</div>
          <div class="form-grid" style="margin-bottom:14px">
            <div class="form-group"><label>Invoice No</label><input class="form-control" id="billInvNo" placeholder="INV-0001" onchange="billUpdateMultiPreview()" oninput="billUpdateMultiPreview()"></div>
            <div class="form-group"><label>Invoice Date</label><input class="form-control" type="date" id="billDate" onchange="billUpdateMultiPreview()" oninput="billUpdateMultiPreview()"></div>
          </div>
          
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:11px;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Bill Details</div>
          <div class="form-grid" style="margin-bottom:14px">
            <div class="form-group"><label>Chemist</label><select class="form-control" id="billChemist" onchange="window.billChemistSelected = this.value; billUpdateMultiPreview()"><option value="">— Select Chemist —</option></select></div>
            <div class="form-group"><label>Agent</label><select class="form-control" id="billAgent" onchange="window.billAgentSelected = this.value; billUpdateMultiPreview()"><option value="">— Select Agent —</option></select></div>
            <div class="form-group form-full"><label>Order Date</label><input class="form-control" type="date" id="billOrderDate" onchange="billUpdateMultiPreview()" oninput="billUpdateMultiPreview()"></div>
          </div>

          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:11px;color:var(--text2);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Stockist Details</div>
          <div id="billStockistContainer" style="display:flex;flex-direction:column;gap:12px;margin-bottom:14px;max-height:300px;overflow-y:auto"></div>
          <button class="btn btn-ghost" style="width:100%;font-size:12px;margin-bottom:14px" onclick="billAddStockist()">+ Add Stockist</button>

          <div class="form-group" style="margin-bottom:16px">
            <label>Notes (optional)</label>
            <textarea class="form-control" id="billNotes" rows="2" placeholder="Any remarks..." onchange="billUpdateMultiPreview()" oninput="billUpdateMultiPreview()"></textarea>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" style="flex:1;font-size:12px" onclick="billGenerateMulti()">🖨 Generate Bill</button>
            <button class="btn btn-ghost" style="font-size:12px" onclick="billPrint()">🖨 Print</button>
            <button class="btn btn-ghost" style="font-size:12px" onclick="billSendWA()">💬 WhatsApp</button>
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL: PREVIEW -->
      <div class="panel" style="overflow-y:auto;background:#fff">
        <div class="panel-header">
          <div class="panel-title">📋 Bill Preview</div>
        </div>
        <div class="panel-body" id="billPreviewArea" style="font-family:Arial,sans-serif;font-size:11px;color:#222;padding:0">
          <div style="text-align:center;color:#aaa;font-size:12px;padding:30px 0">Loading preview...</div>
        </div>
      </div>
    </div>`;

  const today = new Date().toISOString().split('T')[0];
  const billDateEl = document.getElementById('billDate');
  const billInvNoEl = document.getElementById('billInvNo');

  // Populate Chemist dropdown
  const chemistSel = document.getElementById('billChemist');
  if (chemistSel && chemistsList && chemistsList.length > 0) {
    chemistSel.innerHTML = '<option value="">— Select Chemist —</option>' + 
      chemistsList.map(c => `<option value="${c}">${c}</option>`).join('');
    // Restore previous selection if it exists
    if (window.billChemistSelected) chemistSel.value = window.billChemistSelected;
  }

  // Populate Agent dropdown
  const agentSel = document.getElementById('billAgent');
  if (agentSel && agents && agents.length > 0) {
    const approvedAgents = agents.filter(a => a.approved);
    agentSel.innerHTML = '<option value="">— Select Agent —</option>' + 
      approvedAgents.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
    // Restore previous selection if it exists
    if (window.billAgentSelected) agentSel.value = window.billAgentSelected;
  }

  // Initialize with NO stockist rows - user must click "+ Add Stockist"
  if (!window.billStockists) window.billStockists = [];

  // Set default values only if not already set
  if (!billDateEl.value) billDateEl.value = today;
  if (!billInvNoEl.value) billInvNoEl.value = 'INV-' + String((stockistOrders?.length || 0) + 1).padStart(4,'0');

  // Render existing stockists if any
  if (window.billStockists.length > 0) {
    billRenderStockistRows();
  }

  // Show preview immediately
  setTimeout(() => billUpdateMultiPreview(), 100);
}

function billAddStockist() {
  if (!window.billStockists) window.billStockists = [];
  const id = Date.now();
  window.billStockists.push({ id, stockist: '', purchase: 0, delivery: 0 });
  billRenderStockistRows();
  billUpdateMultiPreview();
}

function billRemoveStockist(id) {
  if (!window.billStockists) return;
  if (!confirm('Remove this stockist from the bill?')) return;
  window.billStockists = window.billStockists.filter(s => s.id !== id);
  billRenderStockistRows();
  billUpdateMultiPreview();
}

function billRenderStockistRows() {
  const container = document.getElementById('billStockistContainer');
  if (!container || !window.billStockists) return;

  container.innerHTML = window.billStockists.map((s, idx) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1px">Stockist ${idx + 1}</div>
        ${window.billStockists.length > 1 ? `<button class="btn-delete" onclick="billRemoveStockist(${s.id})" style="font-size:10px;padding:4px 8px"></button>` : ''}
      </div>
      <div class="form-grid" style="gap:8px">
        <div class="form-group">
          <label style="font-size:10px">Stockist Name</label>
          <select class="form-control" style="font-size:12px" onchange="billUpdateStockist(${s.id}, 'stockist', this.value)">
            <option value="">— Select —</option>
            ${(stockistsList || []).map(st => `<option value="${st}" ${s.stockist === st ? 'selected' : ''}>${st}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label style="font-size:10px">Purchase (₹)</label>
          <input class="form-control" type="number" style="font-size:12px" value="${s.purchase}" onchange="billUpdateStockist(${s.id}, 'purchase', this.value)" oninput="billUpdateStockist(${s.id}, 'purchase', this.value)">
        </div>
        <div class="form-group">
          <label style="font-size:10px">Delivery (₹)</label>
          <input class="form-control" type="number" style="font-size:12px" value="${s.delivery}" onchange="billUpdateStockist(${s.id}, 'delivery', this.value); billUpdateGstDisplay(${s.id})" oninput="billUpdateStockist(${s.id}, 'delivery', this.value); billUpdateGstDisplay(${s.id})">
        </div>
        <div class="form-group">
          <label style="font-size:10px">GST (18%)</label>
          <input class="form-control gst-display-${s.id}" type="text" style="font-size:12px;background:rgba(245,166,35,0.06);border-color:rgba(245,166,35,0.3);color:var(--accent4);font-weight:700;cursor:default" readonly value="₹${(Math.round(s.delivery * 0.18 * 100) / 100).toLocaleString('en-IN', {minimumFractionDigits: 2})}">
        </div>
      </div>
    </div>
  `).join('');
}

function billUpdateGstDisplay(id) {
  if (!window.billStockists) return;
  const stockist = window.billStockists.find(s => s.id === id);
  if (!stockist) return;
  
  const gstElement = document.querySelector(`.gst-display-${id}`);
  if (gstElement) {
    const gstAmount = Math.round(stockist.delivery * 0.18 * 100) / 100;
    gstElement.value = '₹' + gstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2});
  }
}

function billUpdateStockist(id, field, value) {
  if (!window.billStockists) return;
  const stockist = window.billStockists.find(s => s.id === id);
  if (!stockist) return;
  
  if (field === 'purchase') stockist.purchase = parseFloat(value) || 0;
  else if (field === 'delivery') stockist.delivery = parseFloat(value) || 0;
  else if (field === 'stockist') stockist.stockist = value;
  
  // Update preview in real-time
  billUpdateMultiPreview();
}

function billUpdatePreview() {
  billUpdateMultiPreview();
}

function billUpdateMultiPreview() {
  // Simplified preview - just show a message
  const preview = document.getElementById('billPreviewArea');
  if (!preview) return;
  
  const chemist = document.getElementById('billChemist')?.value || '';
  const agent = document.getElementById('billAgent')?.value || '';
  const invNo = document.getElementById('billInvNo')?.value || '';
  const invDate = document.getElementById('billDate')?.value || '';
  const orderDate = document.getElementById('billOrderDate')?.value || '';
  const notes = document.getElementById('billNotes')?.value || '';

  // Show preview even if stockists are empty
  if (!window.billStockists) window.billStockists = [];
  
  const fmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const fmtDate = d => { if (!d) return '—'; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };
  
  let totalPurchase = 0, totalDelivery = 0, totalGst = 0;
  
  window.billStockists.forEach(s => {
    totalPurchase += s.purchase || 0;
    totalDelivery += s.delivery || 0;
    totalGst += Math.round((s.delivery || 0) * 0.18 * 100) / 100;
  });
  
  const totalAmount = totalPurchase + totalDelivery + totalGst;

  const inWords = n => {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const t = x => x < 20 ? a[x] : b[Math.floor(x/10)] + (x%10 ? ' '+a[x%10] : '');
    const h = x => x > 99 ? a[Math.floor(x/100)]+' Hundred'+(x%100?' '+t(x%100):'') : t(x);
    let s = '', num = Math.floor(n);
    if (!num) return 'Zero Rupees Only';
    if (num >= 10000000) { s += h(Math.floor(num/10000000))+' Crore '; num %= 10000000; }
    if (num >= 100000)   { s += h(Math.floor(num/100000))+' Lakh ';   num %= 100000; }
    if (num >= 1000)     { s += h(Math.floor(num/1000))+' Thousand '; num %= 1000; }
    if (num > 0) s += h(num);
    return s.trim() + ' Rupees Only';
  };
  
  preview.innerHTML = `
    <div style="border:3px solid #c8a84b;padding:24px;font-family:Arial,sans-serif;font-size:11px;color:#222;position:relative;background:#fff">
      <!-- Decorative Corners -->
      <svg style="position:absolute;top:8px;left:8px;width:28px;height:28px" viewBox="0 0 40 40"><path d="M2,2 L16,2 M2,2 L2,16" stroke="#c8a84b" stroke-width="2.5" fill="none"/><circle cx="2" cy="2" r="2.5" fill="#c8a84b"/></svg>
      <svg style="position:absolute;top:8px;right:8px;width:28px;height:28px" viewBox="0 0 40 40"><path d="M38,2 L24,2 M38,2 L38,16" stroke="#c8a84b" stroke-width="2.5" fill="none"/><circle cx="38" cy="2" r="2.5" fill="#c8a84b"/></svg>
      <svg style="position:absolute;bottom:8px;left:8px;width:28px;height:28px" viewBox="0 0 40 40"><path d="M2,38 L16,38 M2,38 L2,24" stroke="#c8a84b" stroke-width="2.5" fill="none"/><circle cx="2" cy="38" r="2.5" fill="#c8a84b"/></svg>
      <svg style="position:absolute;bottom:8px;right:8px;width:28px;height:28px" viewBox="0 0 40 40"><path d="M38,38 L24,38 M38,38 L38,24" stroke="#c8a84b" stroke-width="2.5" fill="none"/><circle cx="38" cy="38" r="2.5" fill="#c8a84b"/></svg>

      <!-- Header with Logo and Title -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #c8a84b;padding-bottom:14px;margin-bottom:16px">
        <div style="display:flex;align-items:flex-start;gap:16px;flex:1">
          <img src="logo.png" alt="zipX" style="width:70px;height:auto">
          <div>
            <div style="font-size:14px;font-weight:900;color:#222">${COMPANY.name}</div>
            <div style="color:#666;margin-top:3px;font-size:9px;line-height:1.5">
              GSTIN: ${COMPANY.gstin} | PAN: ${COMPANY.pan}<br>
              📞 ${COMPANY.phone} | ✉ ${COMPANY.email}<br>
              📍 ${COMPANY.address}
            </div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:900;color:#c8a84b;letter-spacing:2px">ORDER</div>
          <div style="font-size:18px;font-weight:900;color:#c8a84b;letter-spacing:2px">RECEIPT</div>
          <div style="margin-top:8px;font-size:10px;color:#666">Invoice No: <b>${invNo || '—'}</b></div>
          <div style="font-size:10px;color:#666">Date: <b>${fmtDate(invDate)}</b></div>
        </div>
      </div>

      <!-- Bill To and Order Info -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px">
        <div>
          <div style="font-weight:900;color:#c8a84b;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:1px">Bill To (Chemist)</div>
          <div style="font-weight:900;font-size:14px;color:#222">${chemist || '—'}</div>
        </div>
        <div>
          <div style="font-weight:900;color:#c8a84b;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:1px">Order Info</div>
          <div style="line-height:1.8;color:#444;font-size:10px">
            <div>🏭 <b>Stockist:</b> ${window.billStockists.map(s => s.stockist || '—').join(', ') || '—'}</div>
            <div>👤 <b>Agent:</b> ${agent || '—'}</div>
            <div>📅 <b>Order Date:</b> ${fmtDate(orderDate)}</div>
            <div>🔖 <b>Invoice No:</b> ${invNo || '—'}</div>
          </div>
        </div>
      </div>

      <!-- Amount Table -->
      <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px">
        <thead>
          <tr style="background:#f5f0e8;border-bottom:2px solid #c8a84b">
            <th style="padding:10px 12px;text-align:center;font-weight:900">S.No</th>
            <th style="padding:10px 12px;text-align:left;font-weight:900">Stockist Name</th>
            <th style="padding:10px 12px;text-align:right;font-weight:900">Purchase (₹)</th>
            <th style="padding:10px 12px;text-align:right;font-weight:900">Delivery (₹)</th>
            <th style="padding:10px 12px;text-align:right;font-weight:900">GST 18% (₹)</th>
            <th style="padding:10px 12px;text-align:right;font-weight:900">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${window.billStockists.length === 0 ? `<tr><td colspan="6" style="padding:12px;text-align:center;color:#aaa;font-size:10px">No stockists added yet</td></tr>` : window.billStockists.map((s, idx) => {
            const gst = Math.round((s.delivery || 0) * 0.18 * 100) / 100;
            const total = (s.purchase || 0) + (s.delivery || 0) + gst;
            return `<tr style="border-bottom:1px solid #ddd">
              <td style="padding:10px 12px;text-align:center;font-weight:600">${idx + 1}</td>
              <td style="padding:10px 12px;text-align:left">${s.stockist || '—'}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600">${fmt(s.purchase || 0)}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600">${fmt(s.delivery || 0)}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:600;color:#c8a84b">${fmt(gst)}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700">${fmt(total)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:#f9f9f9;border-top:2px solid #c8a84b;border-bottom:2px solid #c8a84b">
            <td colspan="2" style="padding:12px;font-weight:900;font-size:12px">GRAND TOTAL</td>
            <td style="padding:12px;text-align:right;font-weight:900;font-size:12px">₹ ${fmt(totalPurchase)}</td>
            <td style="padding:12px;text-align:right;font-weight:900;font-size:12px">₹ ${fmt(totalDelivery)}</td>
            <td style="padding:12px;text-align:right;font-weight:900;font-size:12px;color:#c8a84b">₹ ${fmt(totalGst)}</td>
            <td style="padding:12px;text-align:right;font-weight:900;font-size:12px">₹ ${fmt(totalAmount)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Amount in Words -->
      <div style="background:#f5f0e8;border-radius:8px;padding:12px 14px;margin-bottom:16px;border-left:4px solid #c8a84b">
        <span style="font-weight:900;color:#c8a84b;font-size:10px">Amount in Words: </span>
        <span style="color:#333;font-size:10px">${inWords(Math.round(totalAmount))}</span>
      </div>

      ${notes ? `<div style="background:#f9f9f9;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:10px;color:#555;border-left:4px solid #c8a84b"><b>Notes:</b> ${notes}</div>` : ''}

      <!-- Bank Details, Terms & Conditions, and QR Code -->
      <div style="border-top:2px solid #c8a84b;padding-top:16px;margin-top:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:16px">
          <!-- Bank Details -->
          <div>
            <div style="font-weight:900;margin-bottom:12px;font-size:12px;color:#222">Bank Details</div>
            <div style="color:#555;line-height:1.9;font-size:10px">
              <div><b>Name:</b> MRITYUNJAY MISHRA</div>
              <div><b>IFSC:</b> ${COMPANY.bank.ifsc}</div>
              <div><b>Account:</b> ${COMPANY.bank.acc}</div>
              <div><b>Bank:</b> ${COMPANY.bank.name}</div>
              <div><b>Branch:</b> ${COMPANY.bank.branch}</div>
              <div><b>UPI:</b> ${COMPANY.upi}</div>
            </div>
          </div>
          <!-- Terms & Conditions -->
          <div>
            <div style="font-weight:900;margin-bottom:12px;font-size:12px;color:#222">Terms & Conditions</div>
            <div style="color:#555;line-height:1.8;font-size:10px">
              <div>• Goods once sold will not be taken back</div>
              <div>• All disputes subject to PATNA jurisdiction</div>
              <div>• Credit charges: 2% per day on pending amount</div>
            </div>
          </div>
        </div>
        
        <!-- QR Code Section -->
        <div style="display:flex;align-items:center;gap:16px;border:1px solid #c8a84b;border-radius:8px;padding:14px;background:#f9f9f9">
          <div id="billQrCode" style="width:90px;height:90px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-weight:900;margin-bottom:4px;font-size:11px;color:#222">Scan to Pay</div>
            <div style="color:#666;font-size:9px;margin-bottom:6px">PhonePe · GPay · Paytm · UPI</div>
            <div style="font-weight:700;color:#c8a84b;font-size:10px;margin-bottom:4px">${COMPANY.upi}</div>
            <div style="font-weight:700;color:#2ab8aa;font-size:10px">✅ Fully Paid</div>
          </div>
        </div>
      </div>
    </div>`;

  // Generate QR code after DOM update
  setTimeout(() => {
    const qrContainer = document.getElementById('billQrCode');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';
    const upiAmount = totalAmount;
    const upiString = `upi://pay?pa=${COMPANY.upi}&pn=MRITYUNJAY+MISHRA&am=${upiAmount}&cu=INR&tn=Order+${invNo}`;
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: upiString,
        width: 100, height: 100,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
      // QRCode lib creates both canvas and img — keep only img
      setTimeout(() => {
        const canvas = qrContainer.querySelector('canvas');
        const img = qrContainer.querySelector('img');
        if (canvas && img) { img.src = canvas.toDataURL('image/png'); canvas.remove(); }
      }, 150);
    } else {
      qrContainer.style.cssText = 'width:100px;height:100px;display:flex;align-items:center;justify-content:center;background:#f5f0e8;border-radius:6px;font-size:8px;color:#c8a84b;text-align:center;padding:4px;word-break:break-all';
      qrContainer.textContent = COMPANY.upi;
    }
  }, 100);
}

function billGenerateMulti() {
  const chemist = document.getElementById('billChemist')?.value;
  const agent = document.getElementById('billAgent')?.value;
  const invNo = document.getElementById('billInvNo')?.value;
  const invDate = document.getElementById('billDate')?.value;
  const orderDate = document.getElementById('billOrderDate')?.value;
  const notes = document.getElementById('billNotes')?.value;

  if (!chemist || !window.billStockists || window.billStockists.length === 0) {
    showToast('⚠️ Error', 'Select chemist and add at least one stockist');
    return;
  }
  const validStockists = window.billStockists.filter(s => s.stockist && (s.purchase > 0 || s.delivery > 0));
  if (validStockists.length === 0) {
    showToast('⚠️ Error', 'Fill in stockist details (name and amounts)');
    return;
  }

  // Generate the bill preview in a modal
  billRenderPreview(chemist, agent, invNo, invDate, orderDate, notes, validStockists);
}

function billRenderPreview(chemist, agent, invNo, invDate, orderDate, notes, stockists) {
  const fmtDate = d => { if (!d) return '—'; const p = d.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };
  const fmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  const inWords = n => {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const t = x => x < 20 ? a[x] : b[Math.floor(x/10)] + (x%10 ? ' '+a[x%10] : '');
    const h = x => x > 99 ? a[Math.floor(x/100)]+' Hundred'+(x%100?' '+t(x%100):'') : t(x);
    let s = '', num = Math.floor(n);
    if (!num) return 'Zero Rupees Only';
    if (num >= 10000000) { s += h(Math.floor(num/10000000))+' Crore '; num %= 10000000; }
    if (num >= 100000)   { s += h(Math.floor(num/100000))+' Lakh ';   num %= 100000; }
    if (num >= 1000)     { s += h(Math.floor(num/1000))+' Thousand '; num %= 1000; }
    if (num > 0) s += h(num);
    return s.trim() + ' Rupees Only';
  };

  // Calculate totals
  let totalPurchase = 0, totalDelivery = 0, totalGst = 0;
  stockists.forEach(s => {
    totalPurchase += s.purchase || 0;
    totalDelivery += s.delivery || 0;
    totalGst += Math.round((s.delivery || 0) * 0.18 * 100) / 100;
  });
  const totalAmount = totalPurchase + totalDelivery + totalGst;

  // Create modal with bill preview
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.innerHTML = `
    <div class="modal" style="width:720px;max-height:90vh;overflow-y:auto">
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      <div id="billPreviewArea" style="border:2px solid #c8a84b;padding:20px;font-family:Arial,sans-serif;font-size:11px;color:#222;position:relative;background:#fff">
        <svg style="position:absolute;top:4px;left:4px;width:32px;height:32px" viewBox="0 0 40 40"><path d="M2,2 L18,2 M2,2 L2,18" stroke="#c8a84b" stroke-width="2" fill="none"/><circle cx="2" cy="2" r="3" fill="#c8a84b"/></svg>
        <svg style="position:absolute;top:4px;right:4px;width:32px;height:32px" viewBox="0 0 40 40"><path d="M38,2 L22,2 M38,2 L38,18" stroke="#c8a84b" stroke-width="2" fill="none"/><circle cx="38" cy="2" r="3" fill="#c8a84b"/></svg>
        <svg style="position:absolute;bottom:4px;left:4px;width:32px;height:32px" viewBox="0 0 40 40"><path d="M2,38 L18,38 M2,38 L2,22" stroke="#c8a84b" stroke-width="2" fill="none"/><circle cx="2" cy="38" r="3" fill="#c8a84b"/></svg>
        <svg style="position:absolute;bottom:4px;right:4px;width:32px;height:32px" viewBox="0 0 40 40"><path d="M38,38 L22,38 M38,38 L38,22" stroke="#c8a84b" stroke-width="2" fill="none"/><circle cx="38" cy="38" r="3" fill="#c8a84b"/></svg>

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #c8a84b;padding-bottom:12px;margin-bottom:12px">
          <div style="display:flex;align-items:flex-start;gap:14px">
            <img src="logo.png" alt="zipX" style="width:80px;height:auto">
            <div>
              <div style="font-size:15px;font-weight:800">${COMPANY.name}</div>
              <div style="color:#555;margin-top:2px">GSTIN: ${COMPANY.gstin} &nbsp;|&nbsp; PAN: ${COMPANY.pan}</div>
              <div style="color:#555;margin-top:2px">📞 ${COMPANY.phone} &nbsp;|&nbsp; ✉ ${COMPANY.email}</div>
              <div style="color:#555;margin-top:2px">📍 ${COMPANY.address}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:800;color:#c8a84b;letter-spacing:1px">ORDER RECEIPT</div>
            <div style="margin-top:6px;font-size:10px;color:#555">Invoice No: <b>${invNo}</b></div>
            <div style="font-size:10px;color:#555">Date: <b>${fmtDate(invDate)}</b></div>
          </div>
        </div>

        <!-- Bill To / Order Info -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;border:1px solid #eee;border-radius:6px;padding:12px;margin-bottom:14px">
          <div>
            <div style="font-weight:700;color:#c8a84b;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:1px">Bill To (Chemist)</div>
            <div style="font-weight:700;font-size:13px">${chemist || '—'}</div>
          </div>
          <div>
            <div style="font-weight:700;color:#c8a84b;margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:1px">Order Info</div>
            <div style="line-height:1.9;color:#444;font-size:11px">
              <div>👤 <b>Agent:</b> ${agent || '—'}</div>
              <div>📅 <b>Order Date:</b> ${fmtDate(orderDate)}</div>
              <div>🔖 <b>Invoice No:</b> ${invNo || '—'}</div>
            </div>
          </div>
        </div>

        <!-- Stockist-wise Breakdown Table -->
        <div style="margin-bottom:14px">
          <div style="font-weight:700;color:#c8a84b;margin-bottom:8px;font-size:11px">STOCKIST-WISE BREAKDOWN</div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #eee">
            <thead>
              <tr style="background:#f5f0e8;border-bottom:1px solid #c8a84b">
                <th style="padding:8px 10px;text-align:left">Stockist</th>
                <th style="padding:8px 10px;text-align:right">Purchase (₹)</th>
                <th style="padding:8px 10px;text-align:right">Delivery (₹)</th>
                <th style="padding:8px 10px;text-align:right">GST 18% (₹)</th>
                <th style="padding:8px 10px;text-align:right">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${stockists.map(s => {
                const gst = Math.round((s.delivery || 0) * 0.18 * 100) / 100;
                const total = (s.purchase || 0) + (s.delivery || 0) + gst;
                return `<tr style="border-bottom:1px solid #eee">
                  <td style="padding:8px 10px">${s.stockist || '—'}</td>
                  <td style="padding:8px 10px;text-align:right">${fmt(s.purchase || 0)}</td>
                  <td style="padding:8px 10px;text-align:right">${fmt(s.delivery || 0)}</td>
                  <td style="padding:8px 10px;text-align:right;color:#c8a84b;font-weight:600">${fmt(gst)}</td>
                  <td style="padding:8px 10px;text-align:right;font-weight:700">${fmt(total)}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background:#f9f9f9;border-top:2px solid #c8a84b">
                <td style="padding:8px 10px;font-weight:800">TOTAL</td>
                <td style="padding:8px 10px;text-align:right;font-weight:800">${fmt(totalPurchase)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:800">${fmt(totalDelivery)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:800;color:#c8a84b">${fmt(totalGst)}</td>
                <td style="padding:8px 10px;text-align:right;font-weight:800;font-size:12px">${fmt(totalAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Amount in Words -->
        <div style="background:#f5f0e8;border-radius:6px;padding:10px 14px;margin-bottom:14px;border-left:3px solid #c8a84b">
          <span style="font-weight:700;color:#c8a84b">Amount in Words: </span>
          <span style="color:#333">${inWords(Math.round(totalAmount))}</span>
        </div>

        ${notes ? `<div style="background:#f9f9f9;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:10px;color:#555"><b>Notes:</b> ${notes}</div>` : ''}

        <!-- Bank + Footer -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid #eee;padding-top:12px;font-size:10px">
          <div>
            <div style="font-weight:700;margin-bottom:8px;font-size:11px">Bank Details</div>
            <div style="color:#555;line-height:1.9">
              <div><b>Name:</b> MRITYUNJAY MISHRA</div>
              <div><b>IFSC:</b> ${COMPANY.bank.ifsc}</div>
              <div><b>Account:</b> ${COMPANY.bank.acc}</div>
              <div><b>Bank:</b> ${COMPANY.bank.name}</div>
              <div><b>Branch:</b> ${COMPANY.bank.branch}</div>
              <div><b>UPI:</b> ${COMPANY.upi}</div>
            </div>
          </div>
          <div>
            <div style="font-weight:700;margin-bottom:8px;font-size:11px">Terms &amp; Conditions</div>
            <div style="color:#555;line-height:1.8">
              <div>• Goods once sold will not be taken back</div>
              <div>• All disputes subject to PATNA jurisdiction</div>
              <div>• Credit charges: 2% per day on pending amount</div>
            </div>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Close</button>
        <button class="btn btn-primary" onclick="billPrintFromModal()">🖨 Print</button>
      </div>
    </div>`;

  document.body.appendChild(modal);
}

function billPrintFromModal() {
  const src = document.getElementById('billPreviewArea');
  if (!src) return;
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`<!DOCTYPE html><html><head><title>Order Receipt</title>
    <style>
      body { margin: 10mm; font-family: Arial, sans-serif; }
      @page { margin: 10mm; size: A4; }
      img { max-width: 100%; }
      table { border-collapse: collapse; width: 100%; }
    </style>
    </head><body onload="window.print();window.close()">${src.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
}

function billLoadOrder(orderId) {
  if (!orderId) return;
  const o = stockistOrders.find(x => x._id === orderId);
  if (!o) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('billChemist',   o.chemist    || '');
  set('billAgent',     o.agentName  || '');
  set('billOrderDate', o.date       || '');
  
  // Load single stockist
  window.billStockists = [{
    id: Date.now(),
    stockist: o.stockist || '',
    purchase: o.purchaseAmount || 0,
    delivery: o.deliveryCharge || 0
  }];
  billRenderStockistRows();
}

function printBill() {
  // This function is now replaced by billPrintFromModal()
  // which is called from within the bill preview modal
  showToast('ℹ️ Info', 'Please generate bill first, then use Print button');
}

function billResetForm() {
  // Clear all form fields
  document.getElementById('billInvNo').value = '';
  document.getElementById('billDate').value = '';
  document.getElementById('billChemist').value = '';
  document.getElementById('billAgent').value = '';
  document.getElementById('billOrderDate').value = '';
  document.getElementById('billNotes').value = '';
  
  // Clear memory variables
  window.billStockists = [];
  window.billChemistSelected = '';
  window.billAgentSelected = '';
  
  // Re-render
  billRenderStockistRows();
  billUpdateMultiPreview();
  
  showToast('✅ Success', 'Bill form reset');
}

function billPrint() {
  const chemist = document.getElementById('billChemist')?.value;
  if (!chemist || !window.billStockists || window.billStockists.length === 0) {
    showToast('⚠️ Error', 'Select chemist and add at least one stockist');
    return;
  }
  const validStockists = window.billStockists.filter(s => s.stockist && (s.purchase > 0 || s.delivery > 0));
  if (validStockists.length === 0) {
    showToast('⚠️ Error', 'Fill in stockist details');
    return;
  }
  const billContent = document.getElementById('billPreviewArea')?.innerHTML;
  if (!billContent) {
    showToast('⚠️ Error', 'Generate bill preview first');
    return;
  }
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bill Print</title>
      <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      ${billContent}
      <script>
        window.print();
        window.onafterprint = () => {
          window.close();
          // Signal parent window to reset form
          if (window.opener) {
            window.opener.billResetForm();
          }
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function billSendWA() {
  const chemist = document.getElementById('billChemist')?.value;
  const agent = document.getElementById('billAgent')?.value;
  const invNo = document.getElementById('billInvNo')?.value;

  if (!chemist || !window.billStockists || window.billStockists.length === 0) {
    showToast('⚠️ Error', 'Select chemist and add at least one stockist');
    return;
  }

  const validStockists = window.billStockists.filter(s => s.stockist && (s.purchase > 0 || s.delivery > 0));
  if (validStockists.length === 0) {
    showToast('⚠️ Error', 'Fill in stockist details');
    return;
  }

  // Calculate totals
  let totalPurchase = 0, totalDelivery = 0, totalGst = 0;
  validStockists.forEach(s => {
    totalPurchase += s.purchase || 0;
    totalDelivery += s.delivery || 0;
    totalGst += Math.round((s.delivery || 0) * 0.18 * 100) / 100;
  });
  const totalAmount = totalPurchase + totalDelivery + totalGst;

  // Build stockist list for message
  const stockistList = validStockists.map(s => `• ${s.stockist}: ₹${(s.purchase || 0).toLocaleString('en-IN')}`).join('\n');

  const text = encodeURIComponent(
    `*${COMPANY.name}*\n*ORDER RECEIPT*\n\nInvoice: ${invNo}\nChemist: ${chemist}\nAgent: ${agent}\n\n*Stockists:*\n${stockistList}\n\nPurchase: ₹${totalPurchase.toLocaleString('en-IN')}\nDelivery: ₹${totalDelivery.toLocaleString('en-IN')}\n18% GST: ₹${totalGst.toLocaleString('en-IN')}\n*Total: ₹${totalAmount.toLocaleString('en-IN')}*\n\nUPI: ${COMPANY.upi}`
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}


//  SETTLEMENTS

function renderSettlementsTab() {
  const tab = document.getElementById('tab-settlements');
  if (!tab) return;

  const approvedAgents = agents.filter(a => a.approved);
  const agentOptions   = ['All Agents', ...approvedAgents.map(a => a.name)];
  const filterAgent    = tab._filterAgent || 'All Agents';

  // Build per-agent ledger rows using stockistOrders — exclude soft-deleted
  const activeSettlOrders = stockistOrders.filter(o => !o.stockistLogDeleted);

  const rows = approvedAgents.map(a => {
    const agOrders    = activeSettlOrders.filter(o => o.agentName === a.name);
    const purchases   = agOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
    const collections = agOrders.reduce((s,o) => s+(o.cash||0), 0);
    const balance     = purchases - collections;
    return { name: a.name, purchases, collections, balance, orders: agOrders.length };
  }).filter(r => filterAgent === 'All Agents' || r.name === filterAgent);

  // Settlement transactions — exclude soft-deleted
  const txOrders = (filterAgent === 'All Agents'
    ? activeSettlOrders
    : activeSettlOrders.filter(o => o.agentName === filterAgent || o.originalAgentName === filterAgent)
  ).slice().sort((a,b) => new Date(b.date||b.createdAt||0) - new Date(a.date||a.createdAt||0));

  // Chemist logs from transferred orders (Agent 2 accepted and filled chemist log)
  // These are logs where agentName !== originalAgentName (transferred)
  const transferredChemistLogs = chemistLogs.filter(cl => {
    const order = stockistOrders.find(o =>
      (o._id && cl.stockistOrderId && String(o._id) === String(cl.stockistOrderId)) ||
      o.orderId === cl.chemistOrderId
    );
    if (!order || !order.transferStatus || order.transferStatus !== 'accepted') return false;
    if (filterAgent === 'All Agents') return true;
    return cl.agentName === filterAgent || order.originalAgentName === filterAgent;
  });

  tab.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:20px;display:flex;align-items:center;gap:8px">
        📒 ${filterAgent === 'All Agents' ? 'All Agents Ledger' : filterAgent + ' Ledger'}
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select class="form-control" style="width:170px;font-size:12px" id="settlFilterAgent" onchange="settlSetFilter(this.value)">
          ${agentOptions.map(n => `<option ${n===filterAgent?'selected':''}>${n}</option>`).join('')}
        </select>
        <button class="btn btn-ghost" style="font-size:11px;padding:7px 14px" onclick="settlSetFilter('All Agents')">Clear Filter</button>
      </div>
    </div>

    <!-- Agent Cards -->
    <div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:22px">
      ${rows.length ? rows.map(r => `
        <div onclick="settlSetFilter('${r.name}')" style="
          background:var(--surface);
          border:1px solid var(--border);
          border-radius:14px;
          padding:18px 20px;
          min-width:200px;
          cursor:pointer;
          transition:all 0.2s;
          position:relative;
          overflow:hidden;
        " onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--surface2)'"
           onmouseout="this.style.borderColor='var(--border)';this.style.background='var(--surface)'">
          <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;margin-bottom:10px;color:var(--text)">
            ${r.name}
          </div>
          <div style="font-size:22px;margin-bottom:6px">₹</div>
          <div style="font-size:12px;color:var(--text2);margin-bottom:8px">
            Cash: ${r.collections.toLocaleString('en-IN')} &nbsp;·&nbsp; ${r.orders} orders
          </div>
          <div style="font-size:12px;font-weight:700;color:${r.balance > 0 ? 'var(--accent3)' : 'var(--accent)'}">
            Balance: ${r.balance.toLocaleString('en-IN')}
          </div>
          <div style="position:absolute;bottom:0;left:0;right:0;height:3px;background:${r.balance > 0 ? 'linear-gradient(90deg,var(--accent3),transparent)' : 'linear-gradient(90deg,var(--accent),transparent)'}"></div>
        </div>`).join('')
      : `<div style="color:var(--text2);font-size:13px;padding:20px 0">No agents found</div>`}
    </div>

    <!-- Settlement Transactions Table -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">💳 Settlement Transactions</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DATE</th>
              <th>AGENT</th>
              <th>ORDER ID</th>
              <th>CHEMIST</th>
              <th>STOCKIST</th>
              <th style="text-align:right">GIVEN TO STOCKIST (₹)</th>
              <th style="text-align:right">TAKEN FROM CHEMIST (₹)</th>
              <th style="text-align:right">DELIVERY CHARGE (₹)</th>
              <th style="text-align:right">CASHBACK (₹)</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${txOrders.length || transferredChemistLogs.length ? [
              ...txOrders.map(o => {
                const cl = chemistLogs.find(l =>
                  (l.stockistOrderId && String(l.stockistOrderId) === String(o._id)) ||
                  l.chemistOrderId === o.orderId
                );
                const givenToStockist  = o.purchaseAmount || 0;
                const takenFromChemist = cl ? (cl.cashReceived || 0) + (cl.onlineReceived || 0) + (cl.creditGiven || 0) : 0;
                const deliveryCharge   = cl ? (cl.deliveryCharges || 0) : 0;
                const isTransferred    = o.transferStatus === 'accepted';
                const status           = isTransferred ? 'transferred' : (cl ? cl.paymentCollectionStatus : 'pending');
                const statusColor      = { pending:'var(--accent4)', partial:'var(--accent5)', collected:'var(--accent)', transferred:'var(--accent2)' };
                const statusBg         = { pending:'rgba(255,209,102,0.12)', partial:'rgba(123,108,246,0.12)', collected:'rgba(61,207,194,0.12)', transferred:'rgba(42,184,170,0.12)' };
                const displayDate      = o.date || (o.createdAt ? new Date(o.createdAt).toLocaleDateString('en-IN') : '—');
                const agentKey         = o.originalAgentName || o.agentName || '';
                return `<tr>
                  <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text2)">${displayDate}</td>
                  <td><b>${agentKey||'—'}</b></td>
                  <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent);font-weight:700">${o.orderId||'—'}</td>
                  <td><b>${o.chemist||'—'}</b></td>
                  <td style="color:var(--text2)">${o.stockist||'—'}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--accent3)">${givenToStockist.toLocaleString('en-IN')}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--accent2)">${isTransferred ? '—' : takenFromChemist.toLocaleString('en-IN')}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--accent4)">${deliveryCharge.toLocaleString('en-IN')}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--accent)">${(o.cashback||0).toLocaleString('en-IN')}</td>
                  <td><span style="font-size:10px;padding:3px 10px;border-radius:99px;font-weight:700;font-family:'DM Mono',monospace;background:${statusBg[status]||statusBg.pending};color:${statusColor[status]||statusColor.pending}">${status}</span></td>
                </tr>`;
              }),
              // Transferred chemist log rows — Agent 2 accepted and filled
              ...transferredChemistLogs.map(cl => {
                const takenFromChemist = (cl.cashReceived || 0) + (cl.onlineReceived || 0) + (cl.creditGiven || 0);
                const displayDate      = cl.date || '—';
                return `<tr style="background:rgba(61,207,194,0.03)">
                  <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text2)">${displayDate}</td>
                  <td><b>${cl.agentName||'—'}</b> <span style="font-size:9px;color:var(--accent);font-family:'DM Mono',monospace">(transferred)</span></td>
                  <td style="font-family:'DM Mono',monospace;font-size:11px;color:var(--accent2);font-weight:700">${cl.chOrderId||cl.chemistOrderId||'—'}</td>
                  <td><b>${cl.chemistName||'—'}</b></td>
                  <td style="color:var(--text2)">${cl.stockist||'—'}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--text2)">0</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--accent2)">${takenFromChemist.toLocaleString('en-IN')}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--accent4)">${(cl.deliveryCharges||0).toLocaleString('en-IN')}</td>
                  <td style="font-family:'DM Mono',monospace;font-size:12px;text-align:right;color:var(--text2)">—</td>
                  <td><span style="font-size:10px;padding:3px 10px;border-radius:99px;font-weight:700;font-family:'DM Mono',monospace;background:rgba(61,207,194,0.12);color:var(--accent)">${cl.paymentCollectionStatus||'pending'}</span></td>
                </tr>`;
              })
            ].join('')
            : `<tr><td colspan="10" style="text-align:center;color:var(--text2);padding:32px 0;font-size:13px">No transactions yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function settlSetFilter(agent) {
  const tab = document.getElementById('tab-settlements');
  if (tab) tab._filterAgent = agent;
  renderSettlementsTab();
}

//  CHEMISTS TAB

let chemistsData = [];

function renderChemistsTab() {
  const tab = document.getElementById('tab-chemists');
  if (!tab) return;

  const rows = chemistsData.map(c => {
    const cOrders     = stockistOrders.filter(o => o.chemist === c.name);
    const totalVal    = cOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
    const creditGiven = cOrders.reduce((s,o) => s+(o.credit||0), 0);
    const dues        = cOrders.reduce((s,o) => s+(o.dues||0), 0);
    const lastOrder   = cOrders.length ? cOrders.slice().sort((a,b)=>b.date>a.date?1:-1)[0].date : '';
    return { ...c, orders: cOrders.length, totalVal, creditGiven, dues, lastOrder };
  });

  tab.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">💊 Chemist List</div>
        <button class="btn btn-primary" style="font-size:11px" onclick="openModal('addChemistModal')">+ Add Chemist</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>CHEMIST</th><th>PHONE</th><th>ORDERS</th><th>TOTAL VALUE</th><th>CREDIT GIVEN</th><th>DUES</th><th>LAST ORDER</th><th>ACTION</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(c => `
              <tr>
                <td><b>${c.name}</b></td>
                <td style="font-family:'DM Mono',monospace;color:var(--text2)">${c.phone||'—'}</td>
                <td>${c.orders}</td>
                <td style="font-family:'DM Mono',monospace">₹${c.totalVal.toLocaleString('en-IN')}</td>
                <td style="font-family:'DM Mono',monospace">₹${c.creditGiven.toLocaleString('en-IN')}</td>
                <td style="font-family:'DM Mono',monospace;color:${c.dues>0?'var(--accent3)':'var(--text)'}">₹${c.dues.toLocaleString('en-IN')}</td>
                <td>${c.lastOrder}</td>
                <td><button class="btn-delete" onclick="removeChemist('${c.name}')"></button></td>
              </tr>`).join('')
            : `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:24px">No chemists yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function addChemist() {
  const name  = document.getElementById('newChemistName').value.trim().toUpperCase();
  const phone = document.getElementById('newChemistPhone').value.trim();
  if (!name) { showToast("⚠️ Missing", "Enter chemist name"); return; }
  const res = await fetch(`${API_URL}/chemists`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify({ name, phone })
  });
  if (res.ok) {
    const data = await res.json();
    chemistsList.push(data.name);
    chemistsData.push({ name: data.name, phone: data.phone || '' });
    closeModal('addChemistModal');
    document.getElementById('newChemistName').value = '';
    document.getElementById('newChemistPhone').value = '';
    renderChemistsTab();
    const nc = document.getElementById('newChemist');
    if (nc) nc.innerHTML = chemistsList.map(c=>`<option>${c}</option>`).join('');
    const cc = document.getElementById('creditChemist');
    if (cc) cc.innerHTML = chemistsList.map(c=>`<option>${c}</option>`).join('');
    showToast("✅ Added", `${name} added`);
  } else {
    const err = await res.json();
    showToast("❌ Error", err.error || "Failed to add chemist");
  }
}

async function removeChemist(name) {
  if (!confirm(`Remove ${name}?`)) return;
  const res = await fetch(`${API_URL}/chemists/${encodeURIComponent(name)}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) {
    chemistsData = chemistsData.filter(c => c.name !== name);
    const idx = chemistsList.indexOf(name);
    if (idx > -1) chemistsList.splice(idx, 1);
    renderChemistsTab();
    showToast("🗑️ Removed", `${name} removed`);
  }
}

//  STOCKISTS TAB

let stockistsData = [];

function renderStockistsTab() {
  const tab = document.getElementById('tab-stockists');
  if (!tab) return;

  const rows = stockistsData.map(s => {
    const sOrders    = stockistOrders.filter(o => o.stockist === s.name);
    const supplied   = sOrders.length;
    const value      = sOrders.reduce((sum,o) => sum+(o.totalAmount||0), 0);
    const chemCount  = {};
    sOrders.forEach(o => { chemCount[o.chemist] = (chemCount[o.chemist]||0)+1; });
    const topChemist = Object.keys(chemCount).sort((a,b)=>chemCount[b]-chemCount[a])[0] || '';
    const lastSupply = sOrders.length ? sOrders.slice().sort((a,b)=>b.date>a.date?1:-1)[0].date : '';
    return { ...s, supplied, value, topChemist, lastSupply };
  });

  tab.innerHTML = `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">🏪 Stockist List</div>
        <button class="btn btn-primary" style="font-size:11px" onclick="openModal('addStockistModal')">+ Add Stockist</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>STOCKIST</th><th>PHONE</th><th>SUPPLIED</th><th>VALUE</th><th>TOP CHEMIST</th><th>LAST SUPPLY</th><th>ACTION</th></tr></thead>
          <tbody>
            ${rows.length ? rows.map(s => `
              <tr>
                <td><b>${s.name}</b></td>
                <td style="font-family:'DM Mono',monospace;color:var(--text2)">${s.phone||'—'}</td>
                <td>${s.supplied}</td>
                <td style="font-family:'DM Mono',monospace">₹${s.value.toLocaleString('en-IN')}</td>
                <td>${s.topChemist}</td>
                <td>${s.lastSupply}</td>
                <td><button class="btn-delete" onclick="removeStockist('${s.name}')"></button></td>
              </tr>`).join('')
            : `<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:24px">No stockists yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function addStockist() {
  const name  = document.getElementById('newStockistName').value.trim().toUpperCase();
  const phone = document.getElementById('newStockistPhone').value.trim();
  if (!name) { showToast("⚠️ Missing", "Enter stockist name"); return; }
  const res = await fetch(`${API_URL}/stockists`, {
    method: 'POST', headers: getHeaders(), body: JSON.stringify({ name, phone })
  });
  if (res.ok) {
    const data = await res.json();
    stockistsList.push(data.name);
    stockistsData.push({ name: data.name, phone: data.phone || '' });
    closeModal('addStockistModal');
    document.getElementById('newStockistName').value = '';
    document.getElementById('newStockistPhone').value = '';
    renderStockistsTab();
    const ns = document.getElementById('newStockist');
    if (ns) ns.innerHTML = stockistsList.map(s=>`<option>${s}</option>`).join('');
    showToast("✅ Added", `${name} added`);
  } else {
    const err = await res.json();
    showToast("❌ Error", err.error || "Failed to add stockist");
  }
}

async function removeStockist(name) {
  if (!confirm(`Remove ${name}?`)) return;
  const res = await fetch(`${API_URL}/stockists/${encodeURIComponent(name)}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) {
    stockistsData = stockistsData.filter(s => s.name !== name);
    const idx = stockistsList.indexOf(name);
    if (idx > -1) stockistsList.splice(idx, 1);
    renderStockistsTab();
    showToast("🗑️ Removed", `${name} removed`);
  }
}

//  CHEMIST LOG TAB
function renderChemistLogTab() {
  const tab = document.getElementById('tab-chemistlog');
  if (!tab) return;

  const isAdmin = currentUser.role === 'admin';

  // Persist filter state on the DOM element
  const fChemist  = tab._fChemist  || '';
  const fAgent    = tab._fAgent    || '';
  const fStatus   = tab._fStatus   || '';
  const fDateFrom = tab._fDateFrom || '';
  const fDateTo   = tab._fDateTo   || '';

  // Build filter options from full dataset
  const uniqueChemists = [...new Set(chemistLogs.map(l => l.chemistName).filter(Boolean))].sort();
  const uniqueAgents   = [...new Set(chemistLogs.map(l => l.agentName).filter(Boolean))].sort();

  // Apply filters
  let filtered = chemistLogs.slice().sort((a, b) => {
    // Primary: createdAt descending (newest first)
    const tA = new Date(b.createdAt || b.dateTime || 0);
    const tB = new Date(a.createdAt || a.dateTime || 0);
    return tA - tB;
  });
  if (fChemist)  filtered = filtered.filter(l => l.chemistName === fChemist);
  if (fAgent)    filtered = filtered.filter(l => l.agentName   === fAgent);
  if (fStatus)   filtered = filtered.filter(l => l.paymentCollectionStatus === fStatus);
  if (fDateFrom) filtered = filtered.filter(l => (l.date || '') >= fDateFrom);
  if (fDateTo)   filtered = filtered.filter(l => (l.date || '') <= fDateTo);

  // Summary stats
  const totalBill        = filtered.reduce((s, l) => s + (l.totalBillAmount  || 0), 0);
  const totalPurchase    = filtered.reduce((s, l) => s + (l.purchaseCost     || 0), 0);
  const totalDelivery    = filtered.reduce((s, l) => s + (l.deliveryCharges  || 0), 0);
  const totalGst         = filtered.reduce((s, l) => s + (l.gstAmount        || 0), 0);
  const totalCash        = filtered.reduce((s, l) => s + (l.cashReceived     || 0), 0);
  const totalOnline      = filtered.reduce((s, l) => s + (l.onlineReceived   || 0), 0);
  const totalCredit      = filtered.reduce((s, l) => s + (l.creditGiven      || 0), 0);
  const totalOutstanding = filtered.reduce((s, l) => s + (l.outstandingAmount|| 0), 0);

  const opt = (v, label, sel) => `<option value="${v}"${sel === v ? ' selected' : ''}>${label}</option>`;

  tab.innerHTML = `
    <!-- Summary Stats -->
    <div id="clStatsGrid" class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin-bottom:18px">
      <div class="stat-card c1"><div class="stat-label">TOTAL BILL</div><div class="stat-value" style="font-size:16px">&#8377;${totalBill.toLocaleString('en-IN')}</div><div class="stat-icon">&#x1F9FE;</div></div>
      <div class="stat-card c1"><div class="stat-label">PURCHASE</div><div class="stat-value" style="font-size:16px">&#8377;${totalPurchase.toLocaleString('en-IN')}</div><div class="stat-icon">&#x1F3E5;</div></div>
      <div class="stat-card c4"><div class="stat-label">DELIVERY</div><div class="stat-value" style="font-size:16px">&#8377;${totalDelivery.toLocaleString('en-IN')}</div><div class="stat-icon">&#x1F69A;</div></div>
      <div class="stat-card c4"><div class="stat-label">18% GST</div><div class="stat-value" style="font-size:16px">&#8377;${totalGst.toLocaleString('en-IN')}</div><div class="stat-icon">🧾</div></div>
      <div class="stat-card c2"><div class="stat-label">CASH</div><div class="stat-value" style="font-size:16px">&#8377;${totalCash.toLocaleString('en-IN')}</div><div class="stat-icon">&#x1F4B5;</div></div>
      <div class="stat-card c2"><div class="stat-label">ONLINE</div><div class="stat-value" style="font-size:16px">&#8377;${totalOnline.toLocaleString('en-IN')}</div><div class="stat-icon">&#x1F4F2;</div></div>
      <div class="stat-card c5"><div class="stat-label">CREDIT</div><div class="stat-value" style="font-size:16px">&#8377;${totalCredit.toLocaleString('en-IN')}</div><div class="stat-icon">&#x1F49C;</div></div>
      <div class="stat-card c3"><div class="stat-label">OUTSTANDING</div><div class="stat-value" style="font-size:16px">&#8377;${totalOutstanding.toLocaleString('en-IN')}</div><div class="stat-icon">&#x26A0;&#xFE0F;</div></div>
    </div>

    <!-- Filter Controls -->
    <div class="panel" style="margin-bottom:14px">
      <div class="panel-header" style="flex-wrap:wrap;gap:8px">
        <div class="panel-title">Chemist Delivery Log</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select class="form-control" style="width:150px;font-size:12px"
            onchange="document.getElementById('tab-chemistlog')._fChemist=this.value;renderChemistLogTab()">
            ${opt('', 'All Chemists', fChemist)}${uniqueChemists.map(c => opt(c, c, fChemist)).join('')}
          </select>
          ${isAdmin ? '<select class="form-control" style="width:140px;font-size:12px" onchange="document.getElementById(\'tab-chemistlog\')._fAgent=this.value;renderChemistLogTab()">' + opt('', 'All Agents', fAgent) + uniqueAgents.map(a => opt(a, a, fAgent)).join('') + '</select>' : ''}
          <select class="form-control" style="width:150px;font-size:12px"
            onchange="document.getElementById('tab-chemistlog')._fStatus=this.value;renderChemistLogTab()">
            ${opt('', 'All Status', fStatus)}
            ${opt('pending',   'Pending',   fStatus)}
            ${opt('partial',   'Partial',   fStatus)}
            ${opt('collected', 'Collected', fStatus)}
          </select>
          <input type="date" class="form-control" style="width:130px;font-size:12px" value="${fDateFrom}"
            onchange="document.getElementById('tab-chemistlog')._fDateFrom=this.value;renderChemistLogTab()">
          <input type="date" class="form-control" style="width:130px;font-size:12px" value="${fDateTo}"
            onchange="document.getElementById('tab-chemistlog')._fDateTo=this.value;renderChemistLogTab()">
          <button class="btn btn-ghost" style="font-size:11px" onclick="var t=document.getElementById('tab-chemistlog');t._fChemist='';t._fAgent='';t._fStatus='';t._fDateFrom='';t._fDateTo='';renderChemistLogTab()">Clear</button>
          <span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${filtered.length} entries</span>
        </div>
      </div>
    </div>

    <!-- Log Cards -->
    <div style="padding:0 4px">
      ${filtered.length
        ? filtered.map(log => renderChemistLogCard(log)).join('')
        : '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px">No entries found</div>'}
    </div>`;
}

// ── CHEMIST LOG CARD & UPDATE ──

function renderChemistLogCard(log) {
  const id = log._id;

  const statusColor = {
    pending:   'var(--accent4)',
    partial:   'var(--accent5)',
    collected: 'var(--accent)'
  };

  const collectionBadge = `<select
    style="background:${statusColor[log.paymentCollectionStatus]||'var(--text2)'};color:#fff;border:none;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;text-transform:uppercase;cursor:pointer;outline:none"
    onchange="updateChemistLog('${id}',{paymentCollectionStatus:this.value});this.style.background=({'pending':'var(--accent4)','partial':'var(--accent5)','collected':'var(--accent)'})[this.value]||'var(--text2)'">
    <option value="pending"   ${log.paymentCollectionStatus==='pending'   ?'selected':''} style="background:#333;color:#fff">PENDING</option>
    <option value="partial"   ${log.paymentCollectionStatus==='partial'   ?'selected':''} style="background:#333;color:#fff">PARTIAL</option>
    <option value="collected" ${log.paymentCollectionStatus==='collected' ?'selected':''} style="background:#333;color:#fff">COLLECTED</option>
  </select>`;

  const productsTable = (log.products && log.products.length)
    ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">
        <thead>
          <tr style="background:var(--surface3)">
            <th style="padding:4px 6px;text-align:left;font-weight:600">Product</th>
            <th style="padding:4px 6px;text-align:center;font-weight:600">Qty</th>
            <th style="padding:4px 6px;text-align:left;font-weight:600">Batch</th>
            <th style="padding:4px 6px;text-align:left;font-weight:600">Expiry</th>
            <th style="padding:4px 6px;text-align:right;font-weight:600">Unit</th>
            <th style="padding:4px 6px;text-align:right;font-weight:600">Total</th>
          </tr>
        </thead>
        <tbody>
          ${log.products.map(p => `
            <tr style="border-bottom:1px solid var(--border)">
              <td style="padding:4px 6px">${p.name||'—'}</td>
              <td style="padding:4px 6px;text-align:center">${p.quantity||0}</td>
              <td style="padding:4px 6px">${p.batch||'—'}</td>
              <td style="padding:4px 6px">${p.expiry||'—'}</td>
              <td style="padding:4px 6px;text-align:right;font-family:'DM Mono',monospace">&#8377;${(p.unitPrice||0).toLocaleString('en-IN')}</td>
              <td style="padding:4px 6px;text-align:right;font-family:'DM Mono',monospace">&#8377;${(p.lineTotal||0).toLocaleString('en-IN')}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : `<div style="font-size:11px;color:var(--text2);padding:6px 0">No products</div>`;

  const deliveryTime = log.deliveryTime
    ? new Date(log.deliveryTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  return `
  <div id="chemist-log-card-${id}" style="border:1px solid var(--border);border-radius:12px;margin:10px 0;overflow:hidden;background:var(--surface)">
    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:var(--accent)">${log.chOrderId||log.chemistOrderId||'—'}</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:14px;flex:1">${log.chemistName||'—'}</div>
      ${log.chemistLocation ? `<div style="font-size:11px;color:var(--text2)">&#128205; ${log.chemistLocation}</div>` : ''}
      <div style="font-size:12px;color:var(--text2)">&#128197; ${log.date||'—'}</div>
      ${deliveryTime !== '—' ? `<div style="font-size:11px;color:var(--text2)">🚚 ${deliveryTime}</div>` : ''}
      <div style="font-size:12px;font-weight:600">&#128757; ${log.agentName||'—'}</div>
      ${collectionBadge}
      ${currentUser.role === 'admin' ? `<button class="btn-delete" onclick="deleteChemistLog('${id}')" title="Delete log"></button>` : ''}
    </div>
    <div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:10px;color:var(--text2);font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Financials</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:var(--surface2);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">PURCHASE COST</div><div class="cl-purchase-cost" data-val="${log.purchaseCost||0}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace">&#8377;${(log.purchaseCost||0).toLocaleString('en-IN')}</div></div>
          <div style="background:var(--surface2);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">DELIVERY CHG</div><div id="cl-disp-dcharge-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace">&#8377;${(log.deliveryCharges||0).toLocaleString('en-IN')}</div></div>
          <div style="background:var(--surface2);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">TOTAL BILL</div><div id="cl-disp-total-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace">&#8377;${(log.totalBillAmount||0).toLocaleString('en-IN')}</div></div>
          <div style="background:var(--surface2);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">STOCKIST</div><div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${log.stockist||'—'}">${log.stockist||'—'}</div></div>
          <div style="background:rgba(61,207,194,0.08);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">CASH</div><div id="cl-disp-cash-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent)">&#8377;${(log.cashReceived||0).toLocaleString('en-IN')}</div></div>
          <div style="background:rgba(42,184,170,0.08);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">ONLINE</div><div id="cl-disp-online-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent2)">&#8377;${(log.onlineReceived||0).toLocaleString('en-IN')}</div></div>
          <div style="background:rgba(181,123,238,0.08);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--text2)">CREDIT</div><div id="cl-disp-credit-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent5)">&#8377;${(log.creditGiven||0).toLocaleString('en-IN')}</div></div>
          <div style="background:rgba(245,166,35,0.08);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--accent4)">18% GST</div><div id="cl-disp-gst-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent4)">&#8377;${(log.gstAmount||0).toLocaleString('en-IN')}</div></div>
          <div id="cl-disp-outstanding-wrap-${id}" style="background:${(log.outstandingAmount||0)>0?'rgba(255,107,107,0.08)':'rgba(61,207,194,0.08)'};border-radius:8px;padding:8px 10px;grid-column:span 2"><div style="font-size:10px;color:var(--text2)">OUTSTANDING</div><div id="cl-disp-outstanding-${id}" style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:${(log.outstandingAmount||0)>0?'var(--accent3)':'var(--accent)'}">&#8377;${(log.outstandingAmount||0).toLocaleString('en-IN')}</div></div>
        </div>
      </div>
      <div>
        <div style="font-size:10px;color:var(--text2);font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px">Edit</div>
        <div style="margin-bottom:8px">
          <label style="font-size:10px;color:var(--text2);display:block;margin-bottom:3px">DELIVERY CHARGES</label>
          <input type="number" min="0" id="cl-dcharge-${id}" value="${log.deliveryCharges||0}" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text1);font-size:12px"
            oninput="clLiveCalc('${id}')" onblur="updateChemistLog('${id}',{deliveryCharges:+this.value})" onkeydown="if(event.key==='Enter'){this.blur();}" onfocus="if(this.value==='0')this.value=''">
        </div>
        <div style="margin-bottom:8px">
          <label style="font-size:10px;color:var(--text2);display:block;margin-bottom:3px">CASH RECEIVED</label>
          <input type="number" min="0" id="cl-cash-${id}" value="${log.cashReceived||0}" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text1);font-size:12px"
            oninput="clLiveCalc('${id}')" onblur="updateChemistLog('${id}',{cashReceived:+this.value})" onkeydown="if(event.key==='Enter'){this.blur();}" onfocus="if(this.value==='0')this.value=''">
        </div>
        <div style="margin-bottom:8px">
          <label style="font-size:10px;color:var(--text2);display:block;margin-bottom:3px">ONLINE RECEIVED</label>
          <input type="number" min="0" id="cl-online-${id}" value="${log.onlineReceived||0}" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text1);font-size:12px"
            oninput="clLiveCalc('${id}')" onblur="updateChemistLog('${id}',{onlineReceived:+this.value})" onkeydown="if(event.key==='Enter'){this.blur();}" onfocus="if(this.value==='0')this.value=''">
        </div>
        <div style="margin-bottom:8px">
          <label style="font-size:10px;color:var(--text2);display:block;margin-bottom:3px">CREDIT GIVEN</label>
          <input type="number" min="0" id="cl-credit-${id}" value="${log.creditGiven||0}" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text1);font-size:12px"
            oninput="clLiveCalc('${id}')" onblur="updateChemistLog('${id}',{creditGiven:+this.value})" onkeydown="if(event.key==='Enter'){this.blur();}" onfocus="if(this.value==='0')this.value=''">
        </div>
        <div style="margin-bottom:8px">
          <label style="font-size:10px;color:var(--accent4);display:block;margin-bottom:3px;font-weight:600">18% GST (on delivery charges)</label>
          <input type="text" readonly id="cl-gst-${id}" value="₹${(log.gstAmount||0).toLocaleString('en-IN')}" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(245,166,35,0.3);background:rgba(245,166,35,0.06);color:var(--accent4);font-size:12px;font-weight:700;cursor:default">
        </div>
      </div>
    </div>
  </div>`;
}

function clLiveCalc(id) {
  const purchaseEl = document.querySelector(`#chemist-log-card-${id} .cl-purchase-cost`);
  const purchase   = purchaseEl ? parseFloat(purchaseEl.dataset.val || 0) : 0;
  const dcharge    = +(document.getElementById(`cl-dcharge-${id}`)?.value  || 0);
  const cash       = +(document.getElementById(`cl-cash-${id}`)?.value     || 0);
  const online     = +(document.getElementById(`cl-online-${id}`)?.value   || 0);
  const credit     = +(document.getElementById(`cl-credit-${id}`)?.value   || 0);

  const gst         = Math.round(dcharge * 0.18 * 100) / 100;
  const totalBill   = purchase + dcharge + gst;
  const outstanding = purchase - cash - online - credit;

  const fmt = v => '₹' + v.toLocaleString('en-IN');

  const dchargeDisp     = document.getElementById(`cl-disp-dcharge-${id}`);
  const gstDisp         = document.getElementById(`cl-disp-gst-${id}`);
  const gstInput        = document.getElementById(`cl-gst-${id}`);
  const totalDisp       = document.getElementById(`cl-disp-total-${id}`);
  const cashDisp        = document.getElementById(`cl-disp-cash-${id}`);
  const onlineDisp      = document.getElementById(`cl-disp-online-${id}`);
  const creditDisp      = document.getElementById(`cl-disp-credit-${id}`);
  const outstandingDisp = document.getElementById(`cl-disp-outstanding-${id}`);
  const outstandingWrap = document.getElementById(`cl-disp-outstanding-wrap-${id}`);

  if (dchargeDisp)     dchargeDisp.textContent     = fmt(dcharge);
  if (gstDisp)         gstDisp.textContent          = fmt(gst);
  if (gstInput)        gstInput.value               = fmt(gst);
  if (totalDisp)       totalDisp.textContent        = fmt(totalBill);
  if (cashDisp)        cashDisp.textContent         = fmt(cash);
  if (onlineDisp)      onlineDisp.textContent       = fmt(online);
  if (creditDisp)      creditDisp.textContent       = fmt(credit);
  if (outstandingDisp) {
    outstandingDisp.textContent = fmt(outstanding);
    outstandingDisp.style.color = outstanding > 0 ? 'var(--accent3)' : 'var(--accent)';
  }
  if (outstandingWrap) {
    outstandingWrap.style.background = outstanding > 0 ? 'rgba(255,107,107,0.08)' : 'rgba(61,207,194,0.08)';
  }
}

function refreshClStats() {
  const grid = document.getElementById('clStatsGrid');
  if (!grid) return;

  const tab       = document.getElementById('tab-chemistlog');
  const fChemist  = tab?._fChemist  || '';
  const fAgent    = tab?._fAgent    || '';
  const fStatus   = tab?._fStatus   || '';
  const fDateFrom = tab?._fDateFrom || '';
  const fDateTo   = tab?._fDateTo   || '';

  let filtered = chemistLogs.slice();
  if (fChemist)  filtered = filtered.filter(l => l.chemistName === fChemist);
  if (fAgent)    filtered = filtered.filter(l => l.agentName   === fAgent);
  if (fStatus)   filtered = filtered.filter(l => l.paymentCollectionStatus === fStatus);
  if (fDateFrom) filtered = filtered.filter(l => (l.date || '') >= fDateFrom);
  if (fDateTo)   filtered = filtered.filter(l => (l.date || '') <= fDateTo);

  const totalBill        = filtered.reduce((s, l) => s + (l.totalBillAmount   || 0), 0);
  const totalPurchase    = filtered.reduce((s, l) => s + (l.purchaseCost      || 0), 0);
  const totalDelivery    = filtered.reduce((s, l) => s + (l.deliveryCharges   || 0), 0);
  const totalGst         = filtered.reduce((s, l) => s + (l.gstAmount         || 0), 0);
  const totalCash        = filtered.reduce((s, l) => s + (l.cashReceived      || 0), 0);
  const totalOnline      = filtered.reduce((s, l) => s + (l.onlineReceived    || 0), 0);
  const totalCredit      = filtered.reduce((s, l) => s + (l.creditGiven       || 0), 0);
  const totalOutstanding = filtered.reduce((s, l) => s + (l.outstandingAmount || 0), 0);

  const fmt = v => '&#8377;' + v.toLocaleString('en-IN');
  const vals = [totalBill, totalPurchase, totalDelivery, totalGst, totalCash, totalOnline, totalCredit, totalOutstanding];
  grid.querySelectorAll('.stat-value').forEach((el, i) => { el.innerHTML = fmt(vals[i]); });
}

async function updateChemistLog(id, payload) {
  try {
    const res = await fetch(`${API_URL}/chemist-logs/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const updated = await res.json();
      const idx = chemistLogs.findIndex(l => l._id === id);
      if (idx !== -1) chemistLogs[idx] = updated;
      const cardEl = document.getElementById(`chemist-log-card-${id}`);
      if (cardEl) {
        cardEl.outerHTML = renderChemistLogCard(updated);
      } else {
        renderChemistLogTab();
      }
      refreshClStats();
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("Error", data.error || "Failed to update chemist log");
    }
  } catch (err) {
    console.error("updateChemistLog error", err);
    showToast("Error", "Failed to update chemist log");
  }
}

async function deleteChemistLog(id) {
  if (!confirm('Delete this chemist log permanently?')) return;
  try {
    const res = await fetch(`${API_URL}/chemist-logs/${id}`, { method: 'DELETE', headers: getHeaders() });
    if (res.ok) {
      chemistLogs = chemistLogs.filter(l => l._id !== id);
      renderChemistLogTab();
      showToast('🗑️ Deleted', 'Chemist log removed');
    } else {
      showToast('❌ Error', 'Failed to delete');
    }
  } catch (e) {
    showToast('❌ Error', 'Server offline');
  }
}

// ── STOCKIST LOG TAB ──
// ── PHOTO HANDLING ──
function togglePhotoMenu(orderId) {
  const menu = document.getElementById(`photoMenu-${orderId}`);
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }
}

function handlePhotoUpload(orderId, input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const photoData = e.target.result;
    try {
      const res = await fetch(`${API_URL}/stockist-orders/${orderId}/photo`, {
        method: 'PATCH',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: photoData })
      });
      if (res.ok) {
        const order = stockistOrders.find(o => o._id === orderId);
        if (order) order.photo = photoData;
        renderStockistLogTab();
        showToast('✅ Photo Saved', 'Photo uploaded successfully');
      } else {
        showToast('❌ Error', 'Failed to save photo');
      }
    } catch (err) {
      showToast('❌ Error', 'Failed to upload photo');
    }
  };
  reader.readAsDataURL(file);
}

function openPhotoCapture(orderId) {
  const modal = document.createElement('div');
  modal.id = `photoCaptureModal-${orderId}`;
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:18px;padding:26px;width:420px;max-height:88vh;overflow-y:auto;position:relative">
      <div style="font-family:'Syne',sans-serif;font-size:19px;font-weight:800;margin-bottom:18px">📷 Capture Photo</div>
      <video id="cameraStream-${orderId}" style="width:100%;border-radius:12px;background:#000;margin-bottom:14px" autoplay playsinline></video>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" style="flex:1;font-size:12px" onclick="capturePhoto('${orderId}')">📸 Capture</button>
        <button class="btn btn-ghost" style="flex:1;font-size:12px" onclick="closeCameraModal('${orderId}')">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      const video = document.getElementById(`cameraStream-${orderId}`);
      if (video) video.srcObject = stream;
    })
    .catch(() => {
      showToast('⚠️ Error', 'Camera access denied');
      closeCameraModal(orderId);
    });
}

async function capturePhoto(orderId) {
  const video = document.getElementById(`cameraStream-${orderId}`);
  if (!video) return;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const photoData = canvas.toDataURL('image/jpeg');

  try {
    const res = await fetch(`${API_URL}/stockist-orders/${orderId}/photo`, {
      method: 'PATCH',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: photoData })
    });
    if (res.ok) {
      const order = stockistOrders.find(o => o._id === orderId);
      if (order) order.photo = photoData;
      closeCameraModal(orderId);
      renderStockistLogTab();
      showToast('✅ Photo Captured', 'Photo saved successfully');
    } else {
      showToast('❌ Error', 'Failed to save photo');
    }
  } catch (err) {
    showToast('❌ Error', 'Failed to upload photo');
  }
}

function closeCameraModal(orderId) {
  const video = document.getElementById(`cameraStream-${orderId}`);
  if (video && video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
  const modal = document.getElementById(`photoCaptureModal-${orderId}`);
  if (modal) modal.remove();
}

async function removeOrderPhoto(orderId) {
  try {
    const res = await fetch(`${API_URL}/stockist-orders/${orderId}/photo`, {
      method: 'PATCH',
      headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: null })
    });
    if (res.ok) {
      const order = stockistOrders.find(o => o._id === orderId);
      if (order) order.photo = null;
      renderStockistLogTab();
      showToast('🗑️ Removed', 'Photo deleted');
    }
  } catch (err) {
    showToast('❌ Error', 'Failed to remove photo');
  }
}

function viewOrderPhoto(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 0 60px rgba(0,0,0,0.5)">`;
  document.body.appendChild(overlay);
}

function buildJourneyBar(order) {
  const curIdx = _SL_STEPS.indexOf(order.status || 'pending');
  const tsMap = {
    pending: null,
    purchased: order.purchasedAt,
    outfordelivery: order.dispatchedAt,
    delivered: order.deliveredAt,
    collected: order.collectedAt
  };
  return _SL_STEPS.map((s, i) => {
    const done   = i < curIdx;
    const active = i === curIdx;
    const cls    = done ? 'done' : active ? 'active' : '';
    const ts     = tsMap[s] ? `<div style="font-size:9px;color:var(--text2);margin-top:2px;font-family:'DM Mono',monospace">${new Date(tsMap[s]).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>` : '';
    const line   = i < _SL_STEPS.length - 1 ? `<div style="position:absolute;top:14px;left:50%;width:100%;height:2px;background:${done?'var(--accent)':'var(--surface3)'};z-index:0"></div>` : '';
    return `<div class="track-step ${cls}" style="flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;position:relative">${line}<div class="track-dot" style="z-index:1">${_SL_ICONS[s]}</div><div class="track-label" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;text-align:center">${_SL_LABELS[s]}</div>${ts}</div>`;
  }).join('');
}

function buildStatusHistory(history) {
  if (!history || !history.length) return `<div style="font-size:11px;color:var(--text2);padding:4px 0">No history recorded</div>`;
  return history.map(h => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:11px">
      <span class="track-status-badge ts-${h.status||'pending'}" style="font-size:9px;flex-shrink:0">${_SL_LABELS[h.status]||h.status}</span>
      <span style="font-weight:700;font-size:11px;flex-shrink:0">${h.changedBy||''}</span>
      <span style="color:var(--text2);font-family:'DM Mono',monospace;flex-shrink:0">${h.timestamp ? new Date(h.timestamp).toLocaleString('en-IN') : ''}</span>
      ${h.remark ? `<span style="color:var(--accent);flex:1;text-align:right;font-size:10px">${h.remark}</span>` : ''}
    </div>`).join('');
}

function renderOrderCard(order) {
  const isAdmin   = currentUser.role === 'admin';
  const canAdvance = isAdmin || order.agentId === currentUser.id;
  const curIdx    = _SL_STEPS.indexOf(order.status || 'pending');
  const nextStatus = curIdx >= 0 && curIdx < _SL_STEPS.length - 1 ? _SL_STEPS[curIdx + 1] : null;
  // In stockist log, show the original agent name (who created the order)
  // If transferred, originalAgentName is the creator; agentName is the receiver
  const displayAgentName = order.originalAgentName || order.agentName || '';
  const agentColors = ['#3dcfc2','#f5a623','#7b6cf6','#ff6b6b','#2ab8aa'];
  const agentIdx  = agents.findIndex(a => a.name === displayAgentName);
  const agentColor = agentColors[agentIdx >= 0 ? agentIdx % agentColors.length : 0];
  const dues      = order.dues || 0;
  const cashback  = order.cashback || 0;
  const netTotal  = (order.totalAmount || 0) - cashback;

  const advanceBtn = (canAdvance && nextStatus) ? `
    <button class="btn btn-primary" style="font-size:11px;margin-top:8px"
      onclick="(function(){const r=prompt('Remark (optional):','');advanceOrderStatus('${order._id}','${nextStatus}',r||'')})()">
      ${_SL_ICONS[nextStatus]} Advance to ${_SL_LABELS[nextStatus]}
    </button>` : '';

  return `
  <div style="border:1px solid var(--border);border-radius:14px;margin:12px 0;overflow:hidden;background:var(--surface)">

    <!-- PHOTO SECTION AT TOP -->
    <div style="padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between">
      <div style="position:relative;display:inline-block">
        <button class="btn btn-primary" style="font-size:14px;padding:12px 18px" onclick="togglePhotoMenu('${order._id}')">📸 Upload Photo</button>
        <div id="photoMenu-${order._id}" style="display:none;position:absolute;top:100%;left:0;background:var(--surface);border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:100;min-width:160px;margin-top:6px">
          <button style="width:100%;padding:12px 14px;border:none;background:none;text-align:left;cursor:pointer;font-size:13px;color:var(--text);border-bottom:1px solid var(--border);transition:background 0.2s;font-weight:600" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'" onclick="document.getElementById('photoInput-${order._id}').click();togglePhotoMenu('${order._id}')">📤 Upload</button>
          <button style="width:100%;padding:12px 14px;border:none;background:none;text-align:left;cursor:pointer;font-size:13px;color:var(--text);transition:background 0.2s;font-weight:600" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'" onclick="openPhotoCapture('${order._id}');togglePhotoMenu('${order._id}')">📷 Add Photo</button>
        </div>
      </div>
      <input type="file" id="photoInput-${order._id}" accept="image/*" style="display:none" onchange="handlePhotoUpload('${order._id}', this)">
      ${order.photo ? `<div style="display:flex;align-items:center;gap:8px"><img src="${order.photo}" onclick="viewOrderPhoto('${order.photo}')" style="width:70px;height:70px;border-radius:8px;object-fit:cover;border:2px solid var(--accent);cursor:zoom-in" title="Click to view"><button class="btn-delete" onclick="removeOrderPhoto('${order._id}')" style="font-size:11px">Remove</button></div>` : ''}
    </div>

    <!-- HEADER -->
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:var(--surface2);border-bottom:1px solid var(--border);flex-wrap:wrap">
      <div style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:var(--accent)">${order.orderId||''}</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px;flex:1"> ${order.stockist||''}${order.stockistLocation?` <span style="font-size:11px;font-weight:400;color:var(--text2)">(${order.stockistLocation})</span>`:''}</div>
      <div style="font-size:11px;color:var(--text2)"> ${order.date||''}</div>
      <div style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.05);border-radius:8px;padding:4px 10px">
        <div style="width:8px;height:8px;border-radius:50%;background:${agentColor};flex-shrink:0"></div>
        <span style="font-size:12px;font-weight:700"> ${displayAgentName}</span>
      </div>
      <span class="track-status-badge ts-${order.status||'pending'}">${_SL_LABELS[order.status||'pending']}</span>
      ${isAdmin ? `<button class="btn-delete" onclick="deleteStockistOrder('${order._id}')" title="Delete order"></button>` : ''}
    </div>

    <!-- BODY: details + payment -->
    <div style="padding:14px 16px;display:grid;grid-template-columns:1fr 1fr;gap:16px;border-bottom:1px solid var(--border)">

      <!-- LEFT: order details -->
      <div>
        <div style="font-size:10px;color:var(--text2);font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Order Details</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:var(--surface2);border-radius:8px;padding:8px 10px">
            <div style="font-size:10px;color:var(--text2)">CHEMIST</div>
            <div style="font-weight:700;font-size:13px">${order.chemist||''}</div>
          </div>
          <div style="background:var(--surface2);border-radius:8px;padding:8px 10px">
            <div style="font-size:10px;color:var(--text2)">PURCHASE</div>
            <div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace">${(order.purchaseAmount||0).toLocaleString('en-IN')}</div>
          </div>
          <div style="background:${cashback>0?'rgba(61,207,194,0.1)':'var(--surface2)'};border-radius:8px;padding:8px 10px;${cashback>0?'border:1px solid rgba(61,207,194,0.25)':''}">
            <div style="font-size:10px;color:var(--text2)">TOTAL</div>
            <div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:${cashback>0?'var(--accent)':'inherit'}">₹${netTotal.toLocaleString('en-IN')}</div>
          </div>
          ${cashback>0?`<div style="background:rgba(61,207,194,0.08);border-radius:8px;padding:8px 10px;border:1px solid rgba(61,207,194,0.2)"><div style="font-size:10px;color:var(--accent);font-weight:600">💰 CASHBACK</div><div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent)">₹${cashback.toLocaleString('en-IN')}</div></div>`:''}
        </div>
        ${order.deliverTo ? `<div style="background:var(--surface2);border-radius:8px;padding:8px 10px;margin-top:6px"><div style="font-size:10px;color:var(--text2);margin-bottom:2px"> DELIVER TO</div><div style="font-size:12px">${order.deliverTo}</div></div>` : ''}
        ${order.remarks ? `<div style="background:rgba(245,166,35,0.06);border:1px solid rgba(245,166,35,0.2);border-radius:8px;padding:8px 10px;margin-top:6px"><div style="font-size:10px;color:var(--accent4);margin-bottom:2px"> REMARKS</div><div style="font-size:12px">${order.remarks}</div></div>` : ''}
      </div>

      <!-- RIGHT: payment breakdown -->
      <div>
        <div style="font-size:10px;color:var(--text2);font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Payment Breakdown</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:rgba(61,207,194,0.08);border-radius:8px;padding:8px 10px">
            <div style="font-size:10px;color:var(--text2)">CASH</div>
            <div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent)">${(order.cash||0).toLocaleString('en-IN')}</div>
          </div>
          <div style="background:rgba(42,184,170,0.08);border-radius:8px;padding:8px 10px">
            <div style="font-size:10px;color:var(--text2)">ONLINE</div>
            <div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent2)">${(order.online||0).toLocaleString('en-IN')}</div>
          </div>
          <div style="background:rgba(181,123,238,0.08);border-radius:8px;padding:8px 10px">
            <div style="font-size:10px;color:var(--text2)">CREDIT</div>
            <div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:var(--accent5)">${(order.credit||0).toLocaleString('en-IN')}</div>
          </div>
          <div style="background:${dues>0?'rgba(255,107,107,0.08)':'rgba(61,207,194,0.08)'};border-radius:8px;padding:8px 10px">
            <div style="font-size:10px;color:var(--text2)">DUES</div>
            <div style="font-weight:700;font-size:13px;font-family:'DM Mono',monospace;color:${dues>0?'var(--accent3)':'var(--accent)'}">${dues.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>
    </div>



  </div>`;
}

// ── QUICK LOG ORDER (simple add order for Stockist Log) ──

function openQuickLogOrder() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('qloDate').value   = today;
  document.getElementById('qloCash').value   = '';
  document.getElementById('qloOnline').value = '';
  document.getElementById('qloCredit').value = '';
  document.getElementById('qloDues').value   = '';
  document.getElementById('qloCashback').value = '';
  document.getElementById('qloDelivery').value = '';
  document.getElementById('qloTotal').textContent = '₹0';
  document.getElementById('qloWarn').style.display = 'none';

  // Populate agent dropdown
  const agentSel = document.getElementById('qloAgent');
  if (currentUser.role === 'admin') {
    const approved = agents.filter(a => a.approved);
    agentSel.innerHTML = approved.length
      ? approved.map(a => `<option value="${a.name}">${a.name}</option>`).join('')
      : `<option value="">No agents</option>`;
    agentSel.disabled = false;
  } else {
    agentSel.innerHTML = `<option value="${currentUser.name}">${currentUser.name}</option>`;
    agentSel.disabled = true;
  }

  // Populate stockist dropdown
  document.getElementById('qloStockist').innerHTML =
    stockistsList.map(s => `<option value="${s}">${s}</option>`).join('');

  // Populate chemist dropdown
  document.getElementById('qloChemist').innerHTML =
    chemistsList.map(c => `<option value="${c}">${c}</option>`).join('');

  document.getElementById('quickLogOrderModal').classList.add('open');
}

function qloCalc() {
  const cash   = parseFloat(document.getElementById('qloCash').value)   || 0;
  const online = parseFloat(document.getElementById('qloOnline').value) || 0;
  const credit = parseFloat(document.getElementById('qloCredit').value) || 0;
  const dues   = parseFloat(document.getElementById('qloDues').value)   || 0;
  const total  = cash + online + credit + dues;
  document.getElementById('qloTotal').textContent = '₹' + total.toLocaleString('en-IN');
  document.getElementById('qloWarn').style.display = total === 0 ? 'block' : 'none';
}

async function saveQuickLogOrder() {
  const date     = document.getElementById('qloDate').value;
  const agentName= document.getElementById('qloAgent').value;
  const stockist = document.getElementById('qloStockist').value;
  const chemist  = document.getElementById('qloChemist').value;
  const cash     = parseFloat(document.getElementById('qloCash').value)   || 0;
  const online   = parseFloat(document.getElementById('qloOnline').value) || 0;
  const credit   = parseFloat(document.getElementById('qloCredit').value) || 0;
  const dues     = parseFloat(document.getElementById('qloDues').value)   || 0;
  const cashback = parseFloat(document.getElementById('qloCashback').value) || 0;
  const deliveryCharge = parseFloat(document.getElementById('qloDelivery').value) || 0;
  const total    = cash + online + credit + dues;

  if (!date)      { showToast('❌ Error', 'Please select a date'); return; }
  if (!agentName) { showToast('❌ Error', 'Please select an agent'); return; }
  if (!stockist)  { showToast('❌ Error', 'Please select a stockist'); return; }
  if (total === 0){ showToast('❌ Error', 'Enter at least one payment amount'); return; }

  // Compute per-agent sequential ID (count existing orders for this agent + 1)
  const agentOrders = stockistOrders.filter(o => o.agentName === agentName);
  const seqNum      = agentOrders.length + 1;
  const orderId     = `${agentName.slice(0,3).toUpperCase()}-${String(seqNum).padStart(4, '0')}`;

  const payload = {
    date,
    agentName,
    stockist,
    chemist,
    products: [],
    totalAmount:    total,
    purchaseAmount: total,
    cash,
    online,
    credit,
    dues,
    cashback,
    deliveryCharge,
    orderId,
    status: 'pending'
  };

  try {
    const res = await fetch(`${API_URL}/stockist-orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal('quickLogOrderModal');
      await loadStockistOrders();
      renderStockistLogTab();
      showToast('✅ Order Added', `${orderId} · ${stockist} · ₹${total.toLocaleString('en-IN')}`);
    } else {
      const err = await res.json();
      showToast('❌ Error', err.error || err.msg || 'Failed to save order');
    }
  } catch (e) {
    showToast('❌ Error', 'Server offline');
  }
}

// Build chemist log HTML string (used as inner tab content inside stockistlog tab)
function _buildChemistLogHTML() {
  const isAdmin = currentUser.role === 'admin';
  const tab     = document.getElementById('tab-stockistlog');

  const fChemist  = tab._clChemist  || '';
  const fAgent    = tab._clAgent    || '';
  const fStatus   = tab._clStatus   || '';
  const fDateFrom = tab._clDateFrom || '';
  const fDateTo   = tab._clDateTo   || '';

  const uniqueChemists = [...new Set(chemistLogs.map(l => l.chemistName).filter(Boolean))].sort();
  const uniqueAgents   = [...new Set(chemistLogs.map(l => l.agentName).filter(Boolean))].sort();

  let filtered = chemistLogs.slice();
  if (fChemist)  filtered = filtered.filter(l => l.chemistName === fChemist);
  if (fAgent)    filtered = filtered.filter(l => l.agentName   === fAgent);
  if (fStatus)   filtered = filtered.filter(l => l.paymentCollectionStatus === fStatus);
  if (fDateFrom) filtered = filtered.filter(l => (l.date || '') >= fDateFrom);
  if (fDateTo)   filtered = filtered.filter(l => (l.date || '') <= fDateTo);

  const totalBill     = filtered.reduce((s, l) => s + (l.totalBillAmount  || 0), 0);
  const totalCash     = filtered.reduce((s, l) => s + (l.cashReceived     || 0), 0);
  const totalOnline   = filtered.reduce((s, l) => s + (l.onlineReceived   || 0), 0);
  const totalCredit   = filtered.reduce((s, l) => s + (l.creditGiven      || 0), 0);
  const totalOutstand = filtered.reduce((s, l) => s + (l.outstandingAmount|| 0), 0);

  const opt = (v, label, sel) => `<option value="${v}"${sel === v ? ' selected' : ''}>${label}</option>`;

  return `
    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:18px">
      <div class="stat-card c1"><div class="stat-label">TOTAL BILL</div><div class="stat-value" style="font-size:18px">₹${totalBill.toLocaleString('en-IN')}</div><div class="stat-icon">🧾</div></div>
      <div class="stat-card c2"><div class="stat-label">CASH</div><div class="stat-value" style="font-size:18px">₹${totalCash.toLocaleString('en-IN')}</div><div class="stat-icon">💵</div></div>
      <div class="stat-card c2"><div class="stat-label">ONLINE</div><div class="stat-value" style="font-size:18px">₹${totalOnline.toLocaleString('en-IN')}</div><div class="stat-icon">📲</div></div>
      <div class="stat-card c5"><div class="stat-label">CREDIT</div><div class="stat-value" style="font-size:18px">₹${totalCredit.toLocaleString('en-IN')}</div><div class="stat-icon">💜</div></div>
      <div class="stat-card c3"><div class="stat-label">OUTSTANDING</div><div class="stat-value" style="font-size:18px">₹${totalOutstand.toLocaleString('en-IN')}</div><div class="stat-icon">⚠️</div></div>
    </div>

    <div class="panel">
      <div class="panel-header" style="flex-wrap:wrap;gap:8px">
        <div class="panel-title">🏥 Chemist Delivery Log</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <select class="form-control" style="width:150px;font-size:12px"
            onchange="document.getElementById('tab-stockistlog')._clChemist=this.value;document.getElementById('tab-stockistlog')._innerTab='chemist';renderStockistLogTab()">
            ${opt('', 'All Chemists', fChemist)}${uniqueChemists.map(c => opt(c, c, fChemist)).join('')}
          </select>
          ${isAdmin ? `<select class="form-control" style="width:140px;font-size:12px"
            onchange="document.getElementById('tab-stockistlog')._clAgent=this.value;document.getElementById('tab-stockistlog')._innerTab='chemist';renderStockistLogTab()">
            ${opt('', 'All Agents', fAgent)}${uniqueAgents.map(a => opt(a, a, fAgent)).join('')}
          </select>` : ''}
          <select class="form-control" style="width:150px;font-size:12px"
            onchange="document.getElementById('tab-stockistlog')._clStatus=this.value;document.getElementById('tab-stockistlog')._innerTab='chemist';renderStockistLogTab()">
            ${opt('', 'All Status', fStatus)}
            ${opt('pending',   'Pending',   fStatus)}
            ${opt('partial',   'Partial',   fStatus)}
            ${opt('collected', 'Collected', fStatus)}
          </select>
          <input type="date" class="form-control" style="width:130px;font-size:12px" value="${fDateFrom}"
            onchange="document.getElementById('tab-stockistlog')._clDateFrom=this.value;document.getElementById('tab-stockistlog')._innerTab='chemist';renderStockistLogTab()">
          <input type="date" class="form-control" style="width:130px;font-size:12px" value="${fDateTo}"
            onchange="document.getElementById('tab-stockistlog')._clDateTo=this.value;document.getElementById('tab-stockistlog')._innerTab='chemist';renderStockistLogTab()">
          <button class="btn btn-ghost" style="font-size:11px"
            onclick="var t=document.getElementById('tab-stockistlog');t._clChemist='';t._clAgent='';t._clStatus='';t._clDateFrom='';t._clDateTo='';t._innerTab='chemist';renderStockistLogTab()">Clear</button>
          <span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${filtered.length} entries</span>
        </div>
      </div>
      <div style="padding:4px 8px">
        ${filtered.length
          ? filtered.map(log => renderChemistLogCard(log)).join('')
          : '<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px">No entries found</div>'}
      </div>
    </div>`;
}

function renderStockistLogTab() {
  const tab = document.getElementById('tab-stockistlog');
  if (!tab) return;

  const isAdmin = currentUser.role === 'admin';
  // For agents: show orders where they are the original agent (stockist log owner)
  // Exclude orders transferred to this agent (those only appear in tracking)
  const base = (stockistOrders || []).filter(o => {
    if (o.stockistLogDeleted) return false;
    if (!isAdmin) {
      if (o.transferStatus === 'accepted') {
        return o.originalAgentName === currentUser.name ||
               String(o.originalAgentId) === String(currentUser.id);
      }
      return o.agentName === currentUser.name ||
             String(o.agentId) === String(currentUser.id) ||
             o.originalAgentName === currentUser.name ||
             String(o.originalAgentId) === String(currentUser.id);
    }
    return true;
  }).slice().sort((a, b) => {
    const dateA = b.date > a.date ? 1 : b.date < a.date ? -1 : 0;
    if (dateA !== 0) return dateA;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const fStockist = tab._fStockist || '';
  const fAgent    = tab._fAgent    || '';
  const fStatus   = tab._fStatus   || '';
  const fFrom     = tab._fFrom     || '';
  const fTo       = tab._fTo       || '';

  const uniqueStockists = [...new Set(base.map(o => o.stockist).filter(Boolean))].sort();
  const uniqueAgents    = [...new Set(base.map(o => o.agentName).filter(Boolean))].sort();

  let filtered = base;
  if (fStockist) filtered = filtered.filter(o => o.stockist === fStockist);
  if (fAgent)    filtered = filtered.filter(o => o.agentName === fAgent);
  if (fStatus)   filtered = filtered.filter(o => o.status === fStatus);
  if (fFrom)     filtered = filtered.filter(o => (o.date || '') >= fFrom);
  if (fTo)       filtered = filtered.filter(o => (o.date || '') <= fTo);

  const totalAmount   = filtered.reduce((s, o) => s + (o.totalAmount    || 0), 0);
  const totalCashback = filtered.reduce((s, o) => s + (o.cashback       || 0), 0);
  const netTotal      = totalAmount - totalCashback;
  const totalPurchase = filtered.reduce((s, o) => s + (o.purchaseAmount  || 0), 0);
  const totalCash     = filtered.reduce((s, o) => s + (o.cash           || 0), 0);
  const totalOnline   = filtered.reduce((s, o) => s + (o.online         || 0), 0);
  const totalCharge   = filtered.reduce((s, o) => s + (o.deliveryCharge || 0), 0);
  const totalCredit   = filtered.reduce((s, o) => s + (o.credit         || 0), 0);
  const totalDues     = filtered.reduce((s, o) => s + (o.dues           || 0), 0);

  const opt = (v, l, sel) => `<option value="${v}"${sel === v ? ' selected' : ''}>${l}</option>`;

  // Build stockist log content
  const stockistContent = `

    <div class="stats-grid" style="grid-template-columns:repeat(6,1fr);margin-bottom:18px">
      <div class="stat-card c1"><div class="stat-label">NET TOTAL</div><div class="stat-value" style="font-size:18px;color:var(--accent)">₹${netTotal.toLocaleString('en-IN')}</div><div class="stat-sub">after cashback</div><div class="stat-icon">💰</div></div>
      <div class="stat-card c1"><div class="stat-label">PURCHASE</div><div class="stat-value" style="font-size:18px">₹${totalPurchase.toLocaleString('en-IN')}</div><div class="stat-sub">from stockist</div><div class="stat-icon">🛒</div></div>
      <div class="stat-card c2"><div class="stat-label">CASH</div><div class="stat-value" style="font-size:18px">₹${totalCash.toLocaleString('en-IN')}</div><div class="stat-icon">💵</div></div>
      <div class="stat-card c2"><div class="stat-label">ONLINE</div><div class="stat-value" style="font-size:18px">₹${totalOnline.toLocaleString('en-IN')}</div><div class="stat-icon">📲</div></div>
      <div class="stat-card c5"><div class="stat-label">CREDIT</div><div class="stat-value" style="font-size:18px">₹${totalCredit.toLocaleString('en-IN')}</div><div class="stat-icon">💜</div></div>
      <div class="stat-card c3"><div class="stat-label">DUES</div><div class="stat-value" style="font-size:18px">₹${totalDues.toLocaleString('en-IN')}</div><div class="stat-icon">⚠️</div></div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"></div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" style="font-size:12px" onclick="openNewStockistOrderForm()">➕ New Order</button>
          ${isAdmin ? `<button class="btn btn-purple" style="font-size:12px" onclick="openOrderRequestModal()">📋 Send Request</button>` : ''}
          <select class="form-control" style="width:150px;font-size:12px" onchange="document.getElementById('tab-stockistlog')._fStockist=this.value;renderStockistLogTab()">
            ${opt('', 'All Stockists', fStockist)}${uniqueStockists.map(s => opt(s, s, fStockist)).join('')}
          </select>
          ${isAdmin ? `<select class="form-control" style="width:140px;font-size:12px" onchange="document.getElementById('tab-stockistlog')._fAgent=this.value;renderStockistLogTab()">
            ${opt('', 'All Agents', fAgent)}${uniqueAgents.map(a => opt(a, a, fAgent)).join('')}
          </select>` : ''}
          <select class="form-control" style="width:155px;font-size:12px" onchange="document.getElementById('tab-stockistlog')._fStatus=this.value;renderStockistLogTab()">
            ${opt('', 'All Status', fStatus)}${_SL_STEPS.map(s => opt(s, _SL_LABELS[s], fStatus)).join('')}
          </select>
          <input type="text" class="form-control" placeholder="From (YYYY-MM-DD)" value="${fFrom}" style="width:130px;font-size:12px" oninput="document.getElementById('tab-stockistlog')._fFrom=this.value;renderStockistLogTab()">
          <input type="text" class="form-control" placeholder="To (YYYY-MM-DD)" value="${fTo}" style="width:130px;font-size:12px" oninput="document.getElementById('tab-stockistlog')._fTo=this.value;renderStockistLogTab()">
          <button class="btn btn-ghost" style="font-size:11px" onclick="const t=document.getElementById('tab-stockistlog');t._fStockist='';t._fAgent='';t._fStatus='';t._fFrom='';t._fTo='';renderStockistLogTab()">Clear</button>
          <span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${filtered.length} entries</span>
        </div>
      </div>
      <div style="padding:4px 8px">
        ${filtered.length ? filtered.map(o => renderOrderCard(o)).join('') : `<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px">No entries found</div>`}
      </div>
    </div>`;

  tab.innerHTML = stockistContent;
}

//  MONTHLY SHEETS

let monthlySheets = [];

async function loadMonthlySheets() {
  try {
    const res = await fetch(`${API_URL}/monthly-sheets`, { headers: getHeaders() });
    if (res.ok) monthlySheets = await res.json();
  } catch (err) { console.error("Failed to load monthly sheets", err); }
}

function renderMonthlySheetsTab() {
  const tab = document.getElementById('tab-monthlysheets');
  if (!tab) return;
  const isAdmin = currentUser.role === 'admin';

  const sheetCards = monthlySheets.length ? monthlySheets.map(sheet => {
    const totalAmount = sheet.totalAmount || 0;
    const totalCash   = sheet.totalCash   || 0;
    const totalCredit = sheet.totalCredit || 0;
    const totalDues   = sheet.totalDues   || 0;
    const orderCount  = (sheet.orders || []).length;
    return `
      <div class="month-card" style="cursor:pointer" onclick="openMonthSheet('${sheet._id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;padding-left:10px;margin-bottom:4px">
          <div class="month-card-label" style="margin-bottom:0">${sheet.label}</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:10px;color:var(--text2);font-family:'DM Mono',monospace">${sheet.archivedAt ? new Date(sheet.archivedAt).toLocaleDateString('en-IN') : ''}</span>
            ${isAdmin ? `<button class="btn-delete" onclick="event.stopPropagation();deleteMonthSheet('${sheet._id}')"></button>` : ''}
          </div>
        </div>
        <div class="month-card-stats">
          <div class="month-stat"><div class="month-stat-val">₹${totalAmount.toLocaleString('en-IN')}</div><div class="month-stat-lbl">Business</div></div>
          <div class="month-stat"><div class="month-stat-val">₹${totalCash.toLocaleString('en-IN')}</div><div class="month-stat-lbl">Cash</div></div>
          <div class="month-stat"><div class="month-stat-val">₹${totalCredit.toLocaleString('en-IN')}</div><div class="month-stat-lbl">Credit</div></div>
          <div class="month-stat"><div class="month-stat-val">₹${totalDues.toLocaleString('en-IN')}</div><div class="month-stat-lbl">Dues</div></div>
          <div class="month-stat"><div class="month-stat-val">${orderCount}</div><div class="month-stat-lbl">Orders</div></div>
        </div>
      </div>`;
  }).join('') : `<div class="month-empty">No monthly sheets yet.</div>`;

  tab.innerHTML = isAdmin ? `
    <div class="panel" style="margin-bottom:18px">
      <div class="panel-header"><div class="panel-title">📅 Close Current Month</div></div>
      <div class="panel-body">
        <div style="background:rgba(61,207,194,0.06);border:1px solid rgba(61,207,194,0.2);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--text2)">
          Archives current stockist orders into a monthly snapshot saved to the database.
        </div>
        <div class="form-grid" style="margin-bottom:14px">
          <div class="form-group"><label>Month Label</label><input class="form-control" id="msLabel" placeholder="e.g. April 2026"></div>
        </div>
        <button class="btn btn-primary" style="font-size:12px" onclick="closeMonth()">📦 Archive & Close Month</button>
      </div>
    </div>
    <div class="panel"><div class="panel-header"><div class="panel-title">📋 Past Sheets</div></div><div class="panel-body">${sheetCards}</div></div>`
  : `<div class="panel"><div class="panel-header"><div class="panel-title">📋 Monthly Sheets</div></div><div class="panel-body">${sheetCards}</div></div>`;
}

function openMonthSheet(id) {
  const sheet = monthlySheets.find(s => s._id === id);
  if (!sheet) return;

  const totalAmount = sheet.totalAmount || 0;
  const totalCash   = sheet.totalCash   || 0;
  const totalOnline = sheet.totalOnline || 0;
  const totalCredit = sheet.totalCredit || 0;
  const totalDues   = sheet.totalDues   || 0;
  const orders      = sheet.orders || [];
  const chemistLogs = sheet.chemistLogs || [];

  // Per-agent breakdown
  const agentMap = {};
  orders.forEach(o => {
    const a = o.agentName || 'Unknown';
    if (!agentMap[a]) agentMap[a] = { total:0, cash:0, credit:0, dues:0, count:0 };
    agentMap[a].total  += o.totalAmount || 0;
    agentMap[a].cash   += o.cash        || 0;
    agentMap[a].credit += o.credit      || 0;
    agentMap[a].dues   += o.dues        || 0;
    agentMap[a].count  += 1;
  });

  const agentCards = Object.entries(agentMap).map(([name, d]) => `
    <div class="stat-card c1" style="min-width:160px">
      <div class="stat-label">${name}</div>
      <div class="stat-value" style="font-size:18px">₹${d.total.toLocaleString('en-IN')}</div>
      <div class="stat-sub">${d.count} orders · Cash ₹${d.cash.toLocaleString('en-IN')}</div>
      ${d.credit > 0 ? `<div style="font-size:10px;color:var(--accent5);margin-top:2px">Credit ₹${d.credit.toLocaleString('en-IN')}</div>` : ''}
      ${d.dues   > 0 ? `<div style="font-size:10px;color:var(--accent3);margin-top:2px">Dues ₹${d.dues.toLocaleString('en-IN')}</div>` : ''}
    </div>`).join('');

  // STOCKIST LOG TABLE
  const stockistRows = orders.length
    ? orders.map(o => `
        <tr>
          <td style="font-family:'DM Mono',monospace;font-size:10px;color:var(--accent)">${o.orderId||'—'}</td>
          <td>${o.date||'—'}</td>
          <td><b>${o.chemist||'—'}</b></td>
          <td>${o.stockist||'—'}</td>
          <td><span class="agent-badge ab-${(o.agentName||'').toLowerCase()}">${o.agentName||'—'}</span></td>
          <td style="font-family:'DM Mono',monospace;text-align:right">₹${(o.totalAmount||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent2)">₹${(o.cash||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent)">₹${(o.online||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent5)">₹${(o.credit||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent3)">₹${(o.dues||0).toLocaleString('en-IN')}</td>
          <td><span class="track-status-badge ts-${o.status||'pending'}" style="font-size:9px">${_SL_LABELS[o.status]||o.status||'—'}</span></td>
        </tr>`).join('')
    : `<tr><td colspan="11" style="text-align:center;color:var(--text2);padding:24px">No stockist orders in this sheet</td></tr>`;

  // CHEMIST LOG TABLE
  // CHEMIST LOG TABLE — build a lookup map from orderId → stockist using the archived orders
  const orderStockistMap = {};
  orders.forEach(o => { if (o.orderId) orderStockistMap[o.orderId] = o.stockist || '—'; });

  const chemistRows = chemistLogs.length
    ? chemistLogs.map(l => {
        const logOrderId = l.chemistOrderId || l.orderId || '';
        const stockistName = l.stockist || orderStockistMap[logOrderId] || '—';
        return `
        <tr>
          <td style="font-family:'DM Mono',monospace;font-size:10px;color:var(--accent)">${logOrderId||'—'}</td>
          <td>${l.date||'—'}</td>
          <td><span class="agent-badge ab-${(l.agentName||'').toLowerCase()}">${l.agentName||'—'}</span></td>
          <td><b>${l.chemistName||l.chemist||'—'}</b></td>
          <td>${stockistName}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right">₹${(l.purchaseCost||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right">₹${(l.deliveryCharges||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right">₹${(l.gstAmount||Math.round((l.deliveryCharges||0)*0.18*100)/100).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;font-weight:700">₹${(l.totalBillAmount||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent2)">₹${(l.cashReceived||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent)">₹${(l.onlineReceived||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent5)">₹${(l.creditGiven||0).toLocaleString('en-IN')}</td>
          <td style="font-family:'DM Mono',monospace;text-align:right;color:var(--accent3)">₹${(l.outstandingAmount||0).toLocaleString('en-IN')}</td>
          <td><span style="font-size:10px;font-weight:600;color:${l.paymentCollectionStatus==='collected'?'var(--accent)':'var(--accent3)'}">${l.paymentCollectionStatus||'—'}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="14" style="text-align:center;color:var(--text2);padding:24px">No chemist logs in this sheet</td></tr>`;

  // Full-screen overlay
  const overlay = document.createElement('div');
  overlay.id = 'monthSheetOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;background:var(--bg);z-index:500;
    overflow-y:auto;padding:24px 28px;
    animation:slideIn 0.25s ease;
  `;
  overlay.innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:22px">
      <button onclick="document.getElementById('monthSheetOverlay').remove()" class="btn btn-ghost" style="font-size:13px;padding:8px 14px">← Back</button>
      <div>
        <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:22px">${sheet.label}</div>
        <div style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">
          Archived ${sheet.archivedAt ? new Date(sheet.archivedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'}) : '—'}
          &nbsp;·&nbsp; ${orders.length} stockist orders · ${chemistLogs.length} chemist logs
        </div>
      </div>
      <div style="margin-left:auto">
        ${currentUser.role === 'admin' ? `<button class="btn btn-ghost" style="font-size:12px" onclick="exportMonthSheetCSV('${id}')">⬇️ Export to CSV</button>` : ''}
      </div>
    </div>

    <!-- Summary stats -->
    <div class="stats-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:20px">
      <div class="stat-card c1"><div class="stat-label">TOTAL BUSINESS</div><div class="stat-value">₹${totalAmount.toLocaleString('en-IN')}</div><div class="stat-icon">📦</div></div>
      <div class="stat-card c2"><div class="stat-label">CASH</div><div class="stat-value">₹${totalCash.toLocaleString('en-IN')}</div><div class="stat-icon">💵</div></div>
      <div class="stat-card c2"><div class="stat-label">ONLINE</div><div class="stat-value">₹${totalOnline.toLocaleString('en-IN')}</div><div class="stat-icon">📲</div></div>
      <div class="stat-card c5"><div class="stat-label">CREDIT</div><div class="stat-value">₹${totalCredit.toLocaleString('en-IN')}</div><div class="stat-icon">💳</div></div>
      <div class="stat-card c3"><div class="stat-label">DUES</div><div class="stat-value">₹${totalDues.toLocaleString('en-IN')}</div><div class="stat-icon">⚠️</div></div>
    </div>

    <!-- Per-agent breakdown -->
    ${Object.keys(agentMap).length ? `
    <div style="margin-bottom:20px">
      <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:13px;margin-bottom:10px;color:var(--text2)">AGENT BREAKDOWN</div>
      <div style="display:flex;flex-wrap:wrap;gap:12px">${agentCards}</div>
    </div>` : ''}

    <!-- STOCKIST LOG TABLE -->
    <div class="panel" style="margin-bottom:20px">
      <div class="panel-header">
        <div class="panel-title">🏭 Stockist Log (${orders.length})</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ORDER ID</th><th>DATE</th><th>CHEMIST</th><th>STOCKIST</th><th>AGENT</th>
              <th style="text-align:right">TOTAL</th><th style="text-align:right">CASH</th>
              <th style="text-align:right">ONLINE</th><th style="text-align:right">CREDIT</th>
              <th style="text-align:right">DUES</th><th>STATUS</th>
            </tr>
          </thead>
          <tbody>${stockistRows}</tbody>
        </table>
      </div>
    </div>

    <!-- CHEMIST LOG TABLE -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">🏥 Chemist Log (${chemistLogs.length})</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ORDER ID</th><th>DATE</th><th>AGENT</th><th>CHEMIST</th><th>STOCKIST</th>
              <th style="text-align:right">PURCHASE COST</th><th style="text-align:right">DELIVERY</th>
              <th style="text-align:right">18% GST</th><th style="text-align:right">TOTAL BILL</th>
              <th style="text-align:right">CASH</th><th style="text-align:right">ONLINE</th>
              <th style="text-align:right">CREDIT</th><th style="text-align:right">OUTSTANDING</th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>${chemistRows}</tbody>
        </table>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function exportMonthSheetCSV(id) {
  const sheet = monthlySheets.find(s => s._id === id);
  if (!sheet) return;

  const orders     = sheet.orders     || [];
  const clogs      = sheet.chemistLogs || [];
  const esc        = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const row        = arr => arr.map(esc).join(',');

  // ── STOCKIST LOG SECTION ──
  const slHeaders = ['Order ID','Date','Chemist','Stockist','Agent','Total','Cash','Online','Credit','Dues','Status'];
  const slRows    = orders.map(o => row([
    o.orderId, o.date, o.chemist, o.stockist, o.agentName,
    o.totalAmount||0, o.cash||0, o.online||0, o.credit||0, o.dues||0, o.status
  ]));
  const slSum = key => orders.reduce((s,o) => s+(o[key]||0), 0);
  const slTotal = row(['TOTAL','','','','', slSum('totalAmount'), slSum('cash'), slSum('online'), slSum('credit'), slSum('dues'), '']);

  // ── CHEMIST LOG SECTION ──
  const clHeaders = ['Order ID','Date','Agent','Chemist','Purchase Cost','Delivery Charges','18% GST','Total Bill','Cash Received','Online Received','Credit Given','Outstanding','Payment Status'];
  const clRows    = clogs.map(l => row([
    l.chemistOrderId, l.date, l.agentName, l.chemistName,
    l.purchaseCost||0, l.deliveryCharges||0, l.gstAmount||0, l.totalBillAmount||0,
    l.cashReceived||0, l.onlineReceived||0, l.creditGiven||0, l.outstandingAmount||0,
    l.paymentCollectionStatus
  ]));
  const clSum = key => clogs.reduce((s,l) => s+(l[key]||0), 0);
  const clTotal = row(['TOTAL','','','',
    clSum('purchaseCost'), clSum('deliveryCharges'), clSum('gstAmount'), clSum('totalBillAmount'),
    clSum('cashReceived'), clSum('onlineReceived'), clSum('creditGiven'), clSum('outstandingAmount'), ''
  ]);

  const lines = [
    // Stockist Log
    `"=== STOCKIST LOG ==="`,
    slHeaders.join(','),
    ...slRows,
    slTotal,
    '',
    // Chemist Log
    `"=== CHEMIST LOG ==="`,
    clHeaders.join(','),
    ...clRows,
    clTotal
  ];

  const csv  = lines.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${sheet.label.replace(/\s+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ Exported', `${sheet.label}.csv downloaded`);
}

async function closeMonth() {
  const label = document.getElementById('msLabel')?.value.trim();
  if (!label) { showToast("⚠️ Missing", "Enter a month label"); return; }
  if (!stockistOrders.length) { showToast("⚠️ Empty", "No orders to archive"); return; }

  if (!confirm(`Archive "${label}" and reset ALL orders, chemist logs and credits to zero? This cannot be undone.`)) return;

  // Filter out soft-deleted stockist orders (stockistLogDeleted: true)
  const activeStockistOrders = stockistOrders.filter(o => !o.stockistLogDeleted);
  
  // Filter out soft-deleted chemist logs (trackingLogDeleted: true)
  const activeChemistLogs = chemistLogs.filter(l => !l.trackingLogDeleted);

  const totalAmount = activeStockistOrders.reduce((s,o) => s+(o.totalAmount||0), 0);
  const totalCash   = activeStockistOrders.reduce((s,o) => s+(o.cash||0), 0);
  const totalOnline = activeStockistOrders.reduce((s,o) => s+(o.online||0), 0);
  const totalCredit = activeStockistOrders.reduce((s,o) => s+(o.credit||0), 0);
  const totalDues   = activeStockistOrders.reduce((s,o) => s+(o.dues||0), 0);

  // 1. Archive the sheet — strip photos to keep snapshot size small, only archive active orders
  const ordersToArchive = activeStockistOrders.map(o => { const {photo, ...rest} = o; return rest; });

  const res = await fetch(`${API_URL}/monthly-sheets`, {
    method: 'POST', headers: getHeaders(),
    body: JSON.stringify({
      label, totalAmount, totalCash, totalOnline, totalCredit, totalDues,
      orders:      ordersToArchive,
      chemistLogs: activeChemistLogs,
      credits:     credits,
      archivedAt:  new Date()
    })
  });

  if (!res.ok) { showToast("❌ Error", "Failed to archive"); return; }

  const sheet = await res.json();
  monthlySheets.unshift(sheet);

  // 2. Reset all orders, chemist logs, credits, order requests
  const resetRes = await fetch(`${API_URL}/admin/reset-month`, {
    method: 'DELETE', headers: getHeaders()
  });

  if (!resetRes.ok) { showToast("⚠️ Warning", "Archived but reset failed"); return; }

  // 3. Clear local state and re-render everything fresh
  stockistOrders = [];
  chemistLogs    = [];
  credits        = [];
  orderRequests  = [];

  document.getElementById('msLabel').value = '';
  await fetchAllData();
  showToast("✅ Month Closed", `${label} archived — all logs reset to zero`);
}

async function deleteMonthSheet(id) {
  if (!confirm("Delete this monthly sheet?")) return;
  const res = await fetch(`${API_URL}/monthly-sheets/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) {
    monthlySheets = monthlySheets.filter(s => s._id !== id);
    renderMonthlySheetsTab();
    showToast("🗑️ Deleted", "Monthly sheet removed");
  }
}


//  AGENTS TAB (admin only)
function renderAgentsTab() {
  const tab = document.getElementById('tab-agents');
  if (!tab) return;

  const pending  = agents.filter(a => !a.approved);
  const approved = agents.filter(a =>  a.approved);

  const pendingSection = pending.length ? `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header">
        <div class="panel-title">⏳ Pending Approvals <span class="nav-badge">${pending.length}</span></div>
      </div>
      <div class="panel-body">
        ${pending.map(a => `
          <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1">
              <div style="font-weight:700;font-size:13px">${a.name}</div>
              <div style="font-size:11px;color:var(--text2)">@${a.username}  ${a.phone || ''}</div>
            </div>
            <button class="btn btn-primary" style="font-size:11px;padding:5px 12px" onclick="approveAgent('${a._id}')"> Approve</button>
            <button class="btn-delete" onclick="deleteAgent('${a._id}')"></button>
          </div>`).join('')}
      </div>
    </div>` : '';

  const agentRows = approved.length
    ? approved.map(a => `
        <tr>
          <td><b>${a.name}</b></td>
          <td>@${a.username}</td>
          <td>${a.phone || ''}</td>
          <td><span class="tag tag-done">Active</span></td>
          <td><button class="btn-delete" onclick="deleteAgent('${a._id}')"></button></td>
        </tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:var(--text2);padding:24px">No active agents</td></tr>`;

  tab.innerHTML = `
    ${pendingSection}
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">👤 Active Agents</div>
        <button class="btn btn-primary" style="font-size:11px" onclick="openAddAgentModal()">+ Add Agent</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>NAME</th><th>USERNAME</th><th>PHONE</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody>${agentRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── SEMI-ADMINS TAB (admin only) ──
function renderSemiAdminsTab() {
  const tab = document.getElementById('tab-semiadmins');
  if (!tab) return;

  const existing = semiadmins[0] || null;

  // Only show requests sent by semi-admin, not by admin
  const saRequests = orderRequests
    .filter(r => r.sentBy === 'semiadmin')
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const statusTag = s => {
    const map = { pending: 'tag-pending', accepted: 'tag-done', rejected: 'tag-overdue' };
    return `<span class="tag ${map[s]||'tag-pending'}">${s}</span>`;
  };

  const requestRows = saRequests.length
    ? saRequests.map(r => `
        <tr>
          <td style="font-family:'DM Mono',monospace;font-size:11px">${r.date||'—'}</td>
          <td><b>${r.chemist||'—'}</b></td>
          <td style="font-size:11px;color:var(--text2)">${(r.stockists||[]).join(', ')||'—'}</td>
          <td><span class="agent-badge">${r.agent||'—'}</span></td>
          <td>${statusTag(r.status||'pending')}</td>
          <td style="font-size:11px;color:var(--text2)">${r.notes||'—'}</td>
          <td><button class="btn-delete" onclick="deleteSemiAdminRequest('${r._id}')" title="Delete"></button></td>
        </tr>`).join('')
    : `<tr><td colspan="7" style="text-align:center;color:var(--text2);padding:24px">No requests sent yet</td></tr>`;

  tab.innerHTML = `
    ${!existing ? `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header"><div class="panel-title">🔑 Create Semi-Admin</div></div>
      <div class="panel-body">
        <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Only one semi-admin account is allowed. It can only send order requests to agents.</div>
        <div class="form-grid" style="margin-bottom:10px">
          <div class="form-group"><label>Name</label><input class="form-control" id="saName" placeholder="FULL NAME"></div>
          <div class="form-group"><label>Username</label><input class="form-control" id="saUsername" placeholder="username"></div>
          <div class="form-group"><label>Password</label><input class="form-control" type="password" id="saPassword" placeholder="password"></div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-primary" style="width:100%" onclick="createSemiAdmin()">➕ Create</button>
          </div>
        </div>
        <div id="saError" style="display:none;color:var(--accent3);font-size:12px;margin-top:6px"></div>
      </div>
    </div>` : `
    <div class="panel" style="margin-bottom:16px">
      <div class="panel-header"><div class="panel-title">🔑 Semi-Admin Account</div></div>
      <div class="panel-body">
        <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:10px;background:var(--surface2);border:1px solid var(--border)">
          <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,var(--accent4),#e09000);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🔑</div>
          <div style="flex:1">
            <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:15px">${existing.name}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:2px">@${existing.username} &nbsp;·&nbsp; Can only send order requests to agents</div>
          </div>
          <span class="tag tag-done">Active</span>
          <button class="btn-delete" onclick="deleteSemiAdmin('${existing._id}')"></button>
        </div>
        <div style="font-size:11px;color:var(--text2);margin-top:10px;padding:8px 12px;background:rgba(245,166,35,0.06);border-radius:8px;border:1px solid rgba(245,166,35,0.2)">
          ⚠️ Delete this account to create a new one. Only one semi-admin is allowed at a time.
        </div>
      </div>
    </div>`}

    <!-- Order Request Log -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">📜 Order Request Log</div>
        <span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${saRequests.length} total</span>
      </div>
      <div class="panel-body" style="padding:0">
        <div class="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>CHEMIST</th><th>STOCKISTS</th><th>AGENT</th><th>STATUS</th><th>NOTES</th><th></th></tr></thead>
            <tbody>${requestRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

async function approveAgent(id) {
  const res = await fetch(`${API_URL}/auth/approve/${id}`, { method: "PUT", headers: getHeaders() });
  if (res.ok) { await fetchAllData(); showToast(" Approved", "Agent can now login"); }
}

function openAddAgentModal() {
  ['newAgentName','newAgentUsername','newAgentPhone','newAgentPassword'].forEach(id => {
    document.getElementById(id).value = '';
  });
  openModal('addAgentModal');
}

async function addAgentByAdmin() {
  const name     = document.getElementById('newAgentName').value.trim();
  const username = document.getElementById('newAgentUsername').value.trim();
  const phone    = document.getElementById('newAgentPhone').value.trim();
  const password = document.getElementById('newAgentPassword').value;

  if (!name || !username || !password) { showToast(" Missing", "Fill name, username and password"); return; }

  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, username, password, phone, role: 'agent' })
  });
  if (res.ok) {
    // Auto-approve since admin is adding directly
    const data = await res.json();
    // Find the new agent and approve
    await fetchAllData();
    const newAgent = agents.find(a => a.username === username);
    if (newAgent) {
      await fetch(`${API_URL}/auth/approve/${newAgent._id}`, { method: 'PUT', headers: getHeaders() });
      await fetchAllData();
    }
    closeModal('addAgentModal');
    showToast(" Agent Added", `${name} added and approved`);
  } else {
    const err = await res.json();
    showToast(" Error", err.msg || "Failed to add agent");
  }
}

async function deleteAgent(id) {
  if (!confirm("Remove this agent?")) return;
  const res = await fetch(`${API_URL}/auth/agents/${id}`, { method: "DELETE", headers: getHeaders() });
  if (res.ok) { await fetchAllData(); showToast(" Removed", "Agent deleted"); }
}

// ── SEMIADMIN TAB ──
function renderSemiAdminTab() {
  const tab = document.getElementById('tab-semiadmin');
  if (!tab) return;

  const pending  = orderRequests.filter(r => r.status === 'pending').length;
  _setBadge('navBadgeSAReq', pending);

  tab.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px">Welcome, ${currentUser.name} 👋</div>
      <div style="font-size:13px;color:var(--text2)">Send order requests to agents below.</div>
    </div>

    <div class="panel" style="margin-bottom:18px">
      <div class="panel-header">
        <div class="panel-title">📋 Send Order Request</div>
        <button class="btn btn-primary" style="font-size:12px" onclick="openOrderRequestModal()">➕ New Request</button>
      </div>
      <div class="panel-body">
        <div style="font-size:12px;color:var(--text2);margin-bottom:14px">Select an agent, chemist and stockists to send a purchase request.</div>
        <button class="btn btn-primary" style="padding:12px 28px;font-size:14px" onclick="openOrderRequestModal()">📋 Send Request to Agent</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">📜 My Sent Requests</div>
        <span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${orderRequests.filter(r=>r.sentBy==='semiadmin').length} total</span>
      </div>
      <div class="panel-body" style="padding:0">
        ${orderRequests.filter(r=>r.sentBy==='semiadmin').length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>CHEMIST</th><th>STOCKISTS</th><th>AGENT</th><th>STATUS</th><th>NOTES</th><th></th></tr></thead>
            <tbody>
              ${orderRequests.filter(r=>r.sentBy==='semiadmin').map(r => `
                <tr>
                  <td style="font-family:'DM Mono',monospace;font-size:11px">${r.date||'—'}</td>
                  <td><b>${r.chemist||'—'}</b></td>
                  <td style="font-size:11px;color:var(--text2)">${(r.stockists||[]).join(', ')||'—'}</td>
                  <td><span class="agent-badge">${r.agent||'—'}</span></td>
                  <td><span class="tag ${r.status==='accepted'?'tag-done':r.status==='rejected'?'tag-overdue':'tag-pending'}">${r.status}</span></td>
                  <td style="font-size:11px;color:var(--text2)">${r.notes||'—'}</td>
                  <td><button class="btn-delete" onclick="deleteSemiAdminRequest('${r._id}')" title="Delete request"></button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : `<div style="text-align:center;color:var(--text2);font-size:13px;padding:32px">No requests sent yet</div>`}
      </div>
    </div>`;
}

// ── SEMIADMIN MANAGEMENT (admin Agents tab) ──

async function deleteSemiAdminRequest(id) {
  if (!confirm('Delete this request?')) return;
  const res = await fetch(`${API_URL}/orderrequests/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) {
    orderRequests = orderRequests.filter(r => r._id !== id);
    renderSemiAdminTab();
    renderSemiAdminsTab();
    showToast('🗑️ Deleted', 'Request removed');
  }
}
let semiadmins = [];

async function loadSemiAdmins() {
  try {
    const res = await fetch(`${API_URL}/auth/semiadmins`, { headers: getHeaders() });
    if (res.ok) semiadmins = await res.json();
  } catch (e) { console.error('Failed to load semiadmins', e); }
}

async function createSemiAdmin() {
  const name     = document.getElementById('saName').value.trim().toUpperCase();
  const username = document.getElementById('saUsername').value.trim();
  const password = document.getElementById('saPassword').value;
  const errEl    = document.getElementById('saError');
  errEl.style.display = 'none';
  if (!name || !username || !password) {
    errEl.textContent = 'All fields required'; errEl.style.display = 'block'; return;
  }
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: getHeaders(),
      body: JSON.stringify({ name, username, password, role: 'semiadmin', approved: true })
    });
    const data = await res.json();
    if (res.ok) {
      // Auto-approve
      const allRes = await fetch(`${API_URL}/auth/semiadmins`, { headers: getHeaders() });
      if (allRes.ok) {
        const list = await allRes.json();
        const created = list.find(u => u.username === username);
        if (created) await fetch(`${API_URL}/auth/approve/${created._id}`, { method: 'PUT', headers: getHeaders() });
      }
      document.getElementById('saName').value = '';
      document.getElementById('saUsername').value = '';
      document.getElementById('saPassword').value = '';
      await loadSemiAdmins();
      renderSemiAdminsTab();
      showToast('✅ Created', `${name} can now login as semiadmin`);
    } else {
      errEl.textContent = data.msg || 'Failed'; errEl.style.display = 'block';
    }
  } catch (e) { showToast('❌ Error', 'Server offline'); }
}

async function deleteSemiAdmin(id) {
  if (!confirm('Remove this semiadmin?')) return;
  const res = await fetch(`${API_URL}/auth/agents/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) { await loadSemiAdmins(); renderSemiAdminsTab(); showToast('🗑️ Removed', 'Semiadmin deleted'); }
}

//  AGENT PILLS (sidebar)
function renderAgentPills() {
  const container = document.getElementById('agentPillsContainer');
  const agentColors = ['#3dcfc2','#2ab8aa','#f5a623','#7b6cf6','#ff6b6b'];

  if (currentUser.role === 'agent') {
    // Show only this agent's own balance
    const myOrders = orders.filter(o => o.by === currentUser.name || o.agent === currentUser.name);
    const bal = myOrders.reduce((s,o) => s+(o.cash||0), 0);
    container.innerHTML = `
      <div class="agent-pill">
        <div class="agent-dot" style="background:var(--accent)"></div>
        <span class="agent-name">${currentUser.name}</span>
        <span class="agent-bal">${bal.toLocaleString('en-IN')}</span>
      </div>`;
    return;
  }

  if (!agents.length) {
    container.innerHTML = `<div style="font-size:11px;color:var(--text2);padding:4px 6px">No agents yet</div>`;
    return;
  }
  container.innerHTML = agents.filter(a => a.approved).map((a, i) => {
    const bal = orders
      .filter(o => o.by === a.name || o.agent === a.name)
      .reduce((s, o) => s + (o.cash || 0), 0);
    return `
      <div class="agent-pill">
        <div class="agent-dot" style="background:${a.color || agentColors[i % agentColors.length]}"></div>
        <span class="agent-name">${a.name}</span>
        <span class="agent-bal">${bal.toLocaleString('en-IN')}</span>
      </div>`;
  }).join('');
}

//  ADD ORDER
//  ORDER REQUESTS (Admin  Agent)

let _currentOrderRequestId = null;

function openOrderRequestModal() {
  const agentSel = document.getElementById('orAgent');
  const chemistSel = document.getElementById('orChemist');
  const checkboxContainer = document.getElementById('orStockistsCheckboxes');

  agentSel.innerHTML = agents.filter(a => a.approved).map(a => `<option>${a.name}</option>`).join('');
  chemistSel.innerHTML = chemistsList.map(c => `<option>${c}</option>`).join('');

  checkboxContainer.innerHTML = stockistsList.map(s => `
    <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:4px 10px;border:1px solid var(--border);border-radius:20px;background:var(--surface2)">
      <input type="checkbox" value="${s}" style="accent-color:var(--accent)"> ${s}
    </label>`).join('');

  document.getElementById('orDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('orNotes').value = '';
  openModal('orderRequestModal');
}

async function sendOrderRequest() {
  const agent    = document.getElementById('orAgent').value;
  const chemist  = document.getElementById('orChemist').value;
  const date     = document.getElementById('orDate').value;
  const notes    = document.getElementById('orNotes').value;
  const stockists = Array.from(document.querySelectorAll('#orStockistsCheckboxes input:checked')).map(cb => cb.value);

  if (!agent || !chemist || !date) { showToast(" Missing", "Fill all required fields"); return; }

  const res = await fetch(`${API_URL}/orderrequests`, {
    method: 'POST', headers: getHeaders(),
    body: JSON.stringify({ agent, chemist, stockists, date, notes, status: 'pending' })
  });
  if (res.ok) {
    const newReq = await res.json();
    orderRequests.unshift(newReq);
    closeModal('orderRequestModal');
    // Re-render the correct tab based on role
    if (currentUser.role === 'semiadmin') {
      renderSemiAdminTab();
    } else {
      renderOrderRequestsTab();
    }
    showToast("✅ Sent", `Order request sent to ${agent}`);
  }
}

function openAcceptOrderRequest(id) {
  const req = orderRequests.find(r => r._id === id);
  if (!req) return;
  _currentOrderRequestId = id;

  document.getElementById('acceptOrderRequestInfo').innerHTML = `
    <div style="font-weight:700;margin-bottom:6px"> Request Details</div>
    <div>Chemist: <b>${req.chemist}</b></div>
    <div>Date: <b>${req.date}</b></div>
    ${req.notes ? `<div>Notes: <b>${req.notes}</b></div>` : ''}`;

  const stockists = (req.stockists && req.stockists.length) ? req.stockists : [''];
  const formsContainer = document.getElementById('acceptOrderStockistForms');

  formsContainer.innerHTML = stockists.map((s, i) => `
    <div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px">
      <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--accent)">🏭 Stockist: ${s || ''}</div>
      <div class="form-grid">
        <div class="form-group"><label>Purchase (₹)</label><input class="form-control" type="number" id="aorPurchase_${i}" placeholder="0" oninput="calcAorDues(${i})"></div>
        <div class="form-group"><label>Cash Paid (₹)</label><input class="form-control" type="number" id="aorCash_${i}" placeholder="0" oninput="calcAorDues(${i})"></div>
        <div class="form-group"><label>Online Paid (₹)</label><input class="form-control" type="number" id="aorOnline_${i}" placeholder="0" oninput="calcAorDues(${i})"></div>
        <div class="form-group"><label>Credit (₹)</label><input class="form-control" type="number" id="aorCredit_${i}" placeholder="0" oninput="calcAorDues(${i})"></div>
        <div class="form-group">
          <label style="color:var(--accent)">💰 Cashback (₹)</label>
          <input class="form-control" type="number" id="aorCashback_${i}" placeholder="0" style="border-color:rgba(61,207,194,0.4)">
        </div>
        <div class="form-group form-full">
          <label>Dues (₹) — auto calculated</label>
          <div class="form-control" id="aorDues_${i}" style="background:rgba(255,107,107,0.06);color:var(--accent3);font-weight:700;font-family:'DM Mono',monospace">0</div>
        </div>
      </div>
    </div>`).join('');

  openModal('acceptOrderRequestModal');
}

function calcAorDues(i) {
  const purchase = parseFloat(document.getElementById(`aorPurchase_${i}`)?.value) || 0;
  const cash     = parseFloat(document.getElementById(`aorCash_${i}`)?.value)     || 0;
  const online   = parseFloat(document.getElementById(`aorOnline_${i}`)?.value)   || 0;
  const credit   = parseFloat(document.getElementById(`aorCredit_${i}`)?.value)   || 0;
  const dues     = Math.max(purchase - cash - online - credit, 0);
  const el = document.getElementById(`aorDues_${i}`);
  if (el) el.textContent = '₹' + dues.toLocaleString('en-IN');
}

function calcAllAorDues() {
  const req = orderRequests.find(r => r._id === _currentOrderRequestId);
  if (!req) return;
  const count = (req.stockists && req.stockists.length) ? req.stockists.length : 1;
  for (let i = 0; i < count; i++) calcAorDues(i);
}

async function submitAcceptedOrder() {
  const req = orderRequests.find(r => r._id === _currentOrderRequestId);
  if (!req) return;

  const stockists     = (req.stockists && req.stockists.length) ? req.stockists : [''];

  for (let i = 0; i < stockists.length; i++) {
    const purchase = parseFloat(document.getElementById(`aorPurchase_${i}`)?.value) || 0;
    const cash     = parseFloat(document.getElementById(`aorCash_${i}`)?.value)     || 0;
    const online   = parseFloat(document.getElementById(`aorOnline_${i}`)?.value)   || 0;
    const credit   = parseFloat(document.getElementById(`aorCredit_${i}`)?.value)   || 0;
    const cashback = parseFloat(document.getElementById(`aorCashback_${i}`)?.value) || 0;

    if (!purchase) { showToast('⚠️ Missing', `Enter purchase for ${stockists[i] || 'stockist ' + (i + 1)}`); return; }

    const dues  = Math.max(purchase - cash - online - credit, 0);
    const total = cash + online + credit + dues;

    const body = {
      orderRequestId: req._id,
      agentName:      currentUser.name,
      stockist:       stockists[i],
      chemist:        req.chemist,
      date:           req.date,
      purchaseAmount: purchase,
      deliveryCharge: 0,
      totalAmount:    total,
      cash, online, credit, dues, cashback,
      products:       [],
      status:         'pending'
    };

    const res = await fetch(`${API_URL}/stockist-orders`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json();
      showToast('❌ Error', err.error || 'Failed to create order');
      return;
    }
  }

  await fetch(`${API_URL}/orderrequests/${_currentOrderRequestId}`, {
    method: 'PUT', headers: getHeaders(), body: JSON.stringify({ status: 'accepted' })
  });

  closeModal('acceptOrderRequestModal');
  await fetchAllData();
  showToast('✅ Accepted', `${stockists.length} order${stockists.length > 1 ? 's' : ''} created`);
  if (currentUser.role === 'admin') {
    switchTab('stockistlog', document.querySelector('[data-tab=stockistlog]'));
  } else {
    switchTab('myorderrequests', document.querySelector('[data-tab=myorderrequests]'));
  }
  renderSemiAdminTab();
}

async function rejectOrderRequest() {
  if (!_currentOrderRequestId) return;
  await fetch(`${API_URL}/orderrequests/${_currentOrderRequestId}`, {
    method: 'PUT', headers: getHeaders(), body: JSON.stringify({ status: 'rejected' })
  });
  const idx = orderRequests.findIndex(r => r._id === _currentOrderRequestId);
  if (idx !== -1) orderRequests[idx].status = 'rejected';
  closeModal('acceptOrderRequestModal');
  renderOrderRequestsTab();
  renderMyOrderRequestsTab();
  renderSemiAdminTab();
  showToast("❌ Rejected", "Request rejected");
}

function renderMyOrderRequestsTab() {
  const tab = document.getElementById('tab-myorderrequests');
  if (!tab) return;

  const myRequests = orderRequests.filter(r => r.agent === currentUser.name);
  const pending    = myRequests.filter(r => r.status === 'pending');
  const accepted   = myRequests.filter(r => r.status === 'accepted');
  const rejected   = myRequests.filter(r => r.status === 'rejected');

  const statusColor = { pending: 'var(--accent4)', accepted: 'var(--accent)', rejected: 'var(--accent3)' };
  const statusBg    = { pending: 'rgba(255,209,102,0.15)', accepted: 'rgba(61,207,194,0.12)', rejected: 'rgba(255,107,107,0.12)' };
  const borderColor = { pending: 'rgba(255,209,102,0.35)', accepted: 'rgba(61,207,194,0.3)', rejected: 'rgba(255,107,107,0.25)' };

  const rows = myRequests.length
    ? myRequests.slice().sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0)).map(r => `
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px;background:var(--surface2);border:1px solid ${borderColor[r.status]||'var(--border)'};margin-bottom:10px">
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:14px">${r.chemist||'—'}</span>
              <span style="font-size:10px;padding:2px 10px;border-radius:99px;font-weight:700;font-family:'DM Mono',monospace;background:${statusBg[r.status]};color:${statusColor[r.status]}">${r.status.toUpperCase()}</span>
            </div>
            <div style="font-size:11px;color:var(--text2)">
              🏭 ${(r.stockists||[]).join(', ')||'—'} &nbsp;·&nbsp; 📅 ${r.date||'—'}
              ${r.notes ? `&nbsp;·&nbsp; 📝 ${r.notes}` : ''}
            </div>
          </div>
          ${r.status === 'pending' ? `
            <button class="btn btn-primary" style="font-size:11px;padding:6px 14px;flex-shrink:0" onclick="openAcceptOrderRequest('${r._id}')">✅ Accept</button>` : ''}
        </div>`)
      .join('')
    : `<div style="text-align:center;color:var(--text2);font-size:13px;padding:40px">No order requests yet</div>`;

  tab.innerHTML = `
    <div class="stats-grid-3" style="margin-bottom:18px">
      <div class="stat-card c4"><div class="stat-label">PENDING</div><div class="stat-value">${pending.length}</div><div class="stat-icon">⏳</div></div>
      <div class="stat-card c1"><div class="stat-label">ACCEPTED</div><div class="stat-value">${accepted.length}</div><div class="stat-icon">✅</div></div>
      <div class="stat-card c3"><div class="stat-label">REJECTED</div><div class="stat-value">${rejected.length}</div><div class="stat-icon">❌</div></div>
    </div>
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">📋 My Order Requests</div>
        <span style="font-size:11px;color:var(--text2);font-family:'DM Mono',monospace">${myRequests.length} total</span>
      </div>
      <div style="padding:14px 16px">${rows}</div>
    </div>`;
}

function renderOrderRequestsTab() {
  const tab = document.getElementById('tab-orderrequests');
  if (!tab) return;

  // Save current filter values before re-render
  const fChemist  = document.getElementById('orFilterChemist')?.value  || '';
  const fStockist = document.getElementById('orFilterStockist')?.value || '';
  const fAgent    = document.getElementById('orFilterAgent')?.value    || '';
  const fDate     = document.getElementById('orFilterDate')?.value     || '';
  const fStatus   = document.getElementById('orStatusFilter')?.value   || '';

  const pending  = orderRequests.filter(r => r.status === 'pending');
  const accepted = orderRequests.filter(r => r.status === 'accepted');
  const rejected = orderRequests.filter(r => r.status === 'rejected');

  _setBadge('navBadgeOrderReq', pending.length);

  const filtered = orderRequests.filter(r => {
    if (fChemist  && r.chemist !== fChemist) return false;
    if (fStockist && !(r.stockists||[]).includes(fStockist)) return false;
    if (fAgent    && r.agent !== fAgent) return false;
    if (fDate     && r.date !== fDate) return false;
    if (fStatus   && r.status !== fStatus) return false;
    return true;
  });

  // Build unique options from all requests
  const uniqueChemists  = [...new Set(orderRequests.map(r => r.chemist).filter(Boolean))];
  const uniqueStockists = [...new Set(orderRequests.flatMap(r => r.stockists||[]).filter(Boolean))];
  const uniqueAgents    = [...new Set(orderRequests.map(r => r.agent).filter(Boolean))];
  const uniqueDates     = [...new Set(orderRequests.map(r => r.date).filter(Boolean))].sort().reverse();

  const opt = (val, label, selected) => `<option value="${val}"${selected===val?' selected':''}>${label}</option>`;

  const statusTag = s => {
    const map = { pending:'#f5a623', accepted:'#3dcfc2', rejected:'#ff6b6b' };
    return `<span style="font-size:10px;padding:3px 10px;border-radius:99px;background:${map[s]}22;color:${map[s]};font-weight:700">${s}</span>`;
  };

  const rows = filtered.length ? filtered.map(r => `
    <tr>
      <td>${r.date||''}</td>
      <td><b>${r.chemist}</b></td>
      <td>${(r.stockists||[]).join(', ')||''}</td>
      <td style="color:var(--accent);font-weight:600">${r.agent}</td>
      <td>${r.notes||''}</td>
      <td><span style="font-size:10px;padding:2px 8px;border-radius:99px;font-weight:700;background:${r.sentBy==='semiadmin'?'rgba(245,166,35,0.15)':'rgba(61,207,194,0.12)'};color:${r.sentBy==='semiadmin'?'var(--accent4)':'var(--accent)'}">${r.sentBy==='semiadmin'?'Semi-Admin':'Admin'}</span></td>
      <td>${statusTag(r.status)}</td>
      <td><button class="btn-delete" onclick="deleteOrderRequest('${r._id}')"></button></td>
    </tr>`).join('')
  : `<tr><td colspan="8" style="text-align:center;color:var(--text2);padding:24px">No results found</td></tr>`;

  tab.innerHTML = `
    <div class="stats-grid-3" style="margin-bottom:18px">
      <div class="stat-card c4"><div class="stat-label">Pending</div><div class="stat-value">${pending.length}</div><div class="stat-icon">⏳</div></div>
      <div class="stat-card c1"><div class="stat-label">Accepted</div><div class="stat-value">${accepted.length}</div><div class="stat-icon"></div></div>
      <div class="stat-card c3"><div class="stat-label">Rejected</div><div class="stat-value">${rejected.length}</div><div class="stat-icon"></div></div>
    </div>
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title"> All Order Requests</div>
        <button class="btn btn-primary" style="font-size:11px" onclick="openOrderRequestModal()">+ New Request</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border)">
        <select class="form-control" id="orFilterChemist" style="width:140px;font-size:12px" onchange="renderOrderRequestsTab()">
          <option value="">All Chemists</option>
          ${uniqueChemists.map(c => opt(c, c, fChemist)).join('')}
        </select>
        <select class="form-control" id="orFilterStockist" style="width:140px;font-size:12px" onchange="renderOrderRequestsTab()">
          <option value="">All Stockists</option>
          ${uniqueStockists.map(s => opt(s, s, fStockist)).join('')}
        </select>
        <select class="form-control" id="orFilterAgent" style="width:140px;font-size:12px" onchange="renderOrderRequestsTab()">
          <option value="">All Agents</option>
          ${uniqueAgents.map(a => opt(a, a, fAgent)).join('')}
        </select>
        <select class="form-control" id="orFilterDate" style="width:140px;font-size:12px" onchange="renderOrderRequestsTab()">
          <option value="">All Dates</option>
          ${uniqueDates.map(d => opt(d, d, fDate)).join('')}
        </select>
        <select class="form-control" id="orStatusFilter" style="width:140px;font-size:12px" onchange="renderOrderRequestsTab()">
          <option value="">All Status</option>
          <option value="pending"${fStatus==='pending'?' selected':''}>⏳ Pending</option>
          <option value="accepted"${fStatus==='accepted'?' selected':''}> Accepted</option>
          <option value="rejected"${fStatus==='rejected'?' selected':''}> Rejected</option>
        </select>
        <button class="btn btn-ghost" style="font-size:12px" onclick="clearOrderRequestFilters()"> Clear</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>DATE</th><th>CHEMIST</th><th>STOCKISTS</th><th>AGENT</th><th>NOTES</th><th>SENT BY</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function clearOrderRequestFilters() {
  ['orFilterChemist','orFilterStockist','orFilterAgent','orFilterDate','orStatusFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderOrderRequestsTab();
}

async function deleteOrderRequest(id) {
  if (!confirm("Delete this request?")) return;
  const res = await fetch(`${API_URL}/orderrequests/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (res.ok) {
    orderRequests = orderRequests.filter(r => r._id !== id);
    renderOrderRequestsTab();
    showToast("🗑️ Deleted", "Request removed");
  } else {
    showToast("❌ Error", "Failed to delete request");
  }
}

//  CREDIT ENTRY MODAL
function openCreditEntry() {
  const cc = document.getElementById('creditChemist');
  if (cc) cc.innerHTML = chemistsList.map(c => `<option>${c}</option>`).join('');
  document.getElementById('creditAmount').value   = '';
  document.getElementById('creditDueDate').value  = '';
  document.getElementById('creditOrderId').value  = '';
  document.getElementById('creditModal').classList.add('open');
}

async function saveCreditEntry() {
  const chemist  = document.getElementById('creditChemist').value;
  const amount   = parseFloat(document.getElementById('creditAmount').value) || 0;
  const dueDate  = document.getElementById('creditDueDate').value;
  const orderId  = document.getElementById('creditOrderId').value.trim();
  if (!amount) { showToast(" Missing", "Enter an amount"); return; }
  const body = { chemist, amount, dueDate, status: 'pending', recovered: 0 };
  if (orderId) body.orderId = orderId;
  const res = await fetch(`${API_URL}/credits`, {
    method: "POST", headers: getHeaders(), body: JSON.stringify(body)
  });
  if (res.ok) { closeModal('creditModal'); await fetchAllData(); showToast(" Saved", "Credit entry added"); }
  else showToast(" Error", "Failed to save credit");
}

//  SWITCH TAB
function switchTab(name, el) {

  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  const navEl = el || document.querySelector(`[data-tab="${name}"]`);
  if (navEl) navEl.classList.add('active');
  const titles = {
    dashboard: currentUser.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard',
    semiadmin: 'Send Requests',
    semiadmins: 'Semi-Admins',
    tracking: 'Tracking',
    credits:'Credits', agents:'Agents', whatsapp:'WhatsApp',
    bills:'Bill Generator', settlements:'Settlements',
    chemists:'Chemists', chemistlog:'Chemist Log',
    stockists:'Stockists', stockistlog:'Stockist Log', monthlysheets:'Monthly Sheets',
    orderrequests:'Order Requests'
  };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  // Re-render on switch so data is always fresh
  if (name === 'dashboard')      currentUser.role === 'admin' ? renderDashboard() : renderAgentDashboard();
  if (name === 'semiadmin')      renderSemiAdminTab();
  if (name === 'tracking')       renderTrackingTab();
  if (name === 'credits')        renderCreditsTab();
  if (name === 'whatsapp')       renderWhatsAppTab();
  if (name === 'agents')         { loadSemiAdmins().then(renderAgentsTab); }
  if (name === 'semiadmins')     { loadSemiAdmins().then(renderSemiAdminsTab); }
  if (name === 'bills')          renderBillTab();
  if (name === 'settlements')    renderSettlementsTab();
  if (name === 'chemists')       renderChemistsTab();
  if (name === 'chemistlog')     renderChemistLogTab();
  if (name === 'stockists')      renderStockistsTab();
  if (name === 'stockistlog')    renderStockistLogTab();
  if (name === 'orderrequests')    renderOrderRequestsTab();
  if (name === 'myorderrequests')  renderMyOrderRequestsTab();
  if (name === 'monthlysheets')  { loadMonthlySheets().then(renderMonthlySheetsTab); }

  // Clear badge when tab is visited
  if (name === 'stockistlog') {
    _tabSeenCounts.stockistlog = (stockistOrders || []).length;
    _setBadge('navBadgeStockistLog', 0);
    _updateBellBadge();
  }
  if (name === 'chemistlog') {
    _tabSeenCounts.chemistlog = (chemistLogs || []).length;
    _setBadge('navBadgeChemistLog', 0);
    _updateBellBadge();
  }
  if (name === 'whatsapp') {
    const waRelevant = (waMessages || []).filter(m => {
      if (currentUser.role === 'admin') return m.dir === 'in';
      return m.dir === 'in' && m.to === currentUser.name;
    });
    _tabSeenCounts.whatsapp = waRelevant.length;
    _setBadge('navBadgeWA', 0);
    _updateBellBadge();
    // Mark all messages as read on the backend
    fetch(`${API_URL}/messages/read`, { method: 'PUT', headers: getHeaders() }).catch(() => {});
    waMessages.forEach(m => { m.isNew = false; });
  }
}

//  MODAL
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

//  TOAST
function showToast(title, body) {
  document.getElementById('toastTitle').textContent = title;
  document.getElementById('toastBody').textContent  = body;
  const t = document.getElementById('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

//  NEW STOCKIST ORDER FORM
function openNewStockistOrderForm() {
  const isAdmin = currentUser.role === 'admin';

  // Set today's date
  document.getElementById('soDate').value = new Date().toISOString().split('T')[0];

  // Agent dropdown (admin only)
  const agentGroup = document.getElementById('soAgentGroup');
  const agentSel = document.getElementById('soAgent');
  if (isAdmin) {
    agentGroup.style.display = '';
    const approved = agents.filter(a => a.approved);
    agentSel.innerHTML = approved.length
      ? approved.map(a => `<option value="${a.name}">${a.name}</option>`).join('')
      : `<option value="">No agents</option>`;
  } else {
    agentGroup.style.display = 'none';
  }

  // Stockist dropdown
  const stockistSel = document.getElementById('soStockist');
  stockistSel.innerHTML = stockistsList.map(s => `<option>${s}</option>`).join('');

  // Chemist dropdown
  const chemistSel = document.getElementById('soChemist');
  chemistSel.innerHTML = chemistsList.map(c => `<option>${c}</option>`).join('');

  // Reset fields
  document.getElementById('soCash').value = '';
  document.getElementById('soOnline').value = '';
  document.getElementById('soCredit').value = '';
  document.getElementById('soDues').value = '';
  document.getElementById('soCashback').value = '';
  document.getElementById('soPurchaseAmount').value = '';
  document.getElementById('soTotalAmount').value = '0';
  document.getElementById('soBalance').textContent = '0';
  document.getElementById('soBalance').style.color = '';
  document.getElementById('soPaymentError').style.display = 'none';

  openModal('newStockistOrderModal');
}

function soAddProductRow() {
  const container = document.getElementById('soProductRows');
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 1fr auto;gap:6px;margin-bottom:6px;align-items:center';
  row.innerHTML = `
    <input class="form-control" type="text" placeholder="Product name" style="font-size:12px" oninput="soUpdatePayment()">
    <input class="form-control" type="number" placeholder="Qty" style="font-size:12px" oninput="soCalcLineTotal(this)">
    <input class="form-control" type="text" placeholder="Batch" style="font-size:12px">
    <input class="form-control" type="text" placeholder="Expiry" style="font-size:12px">
    <input class="form-control" type="number" placeholder="Unit " style="font-size:12px" oninput="soCalcLineTotal(this)">
    <input class="form-control" type="number" placeholder="Total" style="font-size:12px;background:var(--surface3)" readonly>
    <button class="btn-delete" onclick="this.parentElement.remove();soUpdatePayment()"></button>
  `;
  container.appendChild(row);
}

function soCalcLineTotal(input) {
  const row = input.parentElement;
  const inputs = row.querySelectorAll('input[type="number"]');
  const qty = parseFloat(inputs[0].value) || 0;
  const unit = parseFloat(inputs[1].value) || 0;
  inputs[2].value = (qty * unit).toFixed(2);
  soUpdatePayment();
}

function soUpdatePayment() {
  const purchase = parseFloat(document.getElementById('soPurchaseAmount').value) || 0;
  const total    = purchase;

  document.getElementById('soTotalAmount').value = total.toFixed(2);

  const cash   = parseFloat(document.getElementById('soCash').value)   || 0;
  const online = parseFloat(document.getElementById('soOnline').value) || 0;
  const credit = parseFloat(document.getElementById('soCredit').value) || 0;
  const dues   = parseFloat(document.getElementById('soDues').value)   || 0;
  const allocated = cash + online + credit + dues;
  const remaining = total - allocated;

  const balEl = document.getElementById('soBalance');
  balEl.textContent = `${remaining.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  balEl.style.color = remaining === 0 ? 'var(--accent)' : 'var(--accent3)';

  // Clear error on input
  document.getElementById('soPaymentError').style.display = 'none';
  // Reset border colors
  ['soCash','soOnline','soCredit','soDues'].forEach(id => {
    document.getElementById(id).style.borderColor = '';
  });
}

async function submitNewStockistOrder() {
  const isAdmin = currentUser.role === 'admin';
  const date     = document.getElementById('soDate').value;
  const agentName = isAdmin
    ? document.getElementById('soAgent').value
    : currentUser.name;
  const stockist  = document.getElementById('soStockist').value;
  const chemist   = document.getElementById('soChemist').value;

  if (!date || !agentName || !stockist || !chemist) {
    showToast(' Missing', 'Fill all required fields');
    return;
  }

  const purchaseAmount  = parseFloat(document.getElementById('soPurchaseAmount').value) || 0;
  const totalAmount     = parseFloat(document.getElementById('soTotalAmount').value) || 0;
  const cash   = parseFloat(document.getElementById('soCash').value)   || 0;
  const online = parseFloat(document.getElementById('soOnline').value) || 0;
  const credit = parseFloat(document.getElementById('soCredit').value) || 0;
  const dues   = parseFloat(document.getElementById('soDues').value)   || 0;
  const cashback = parseFloat(document.getElementById('soCashback').value) || 0;

  // Client-side payment validation
  const validation = validatePaymentFields(cash, online, credit, dues, totalAmount);
  if (!validation.valid) {
    const errEl = document.getElementById('soPaymentError');
    errEl.textContent = validation.message;
    errEl.style.display = 'block';
    ['soCash','soOnline','soCredit','soDues'].forEach(id => {
      document.getElementById(id).style.borderColor = 'var(--accent3)';
    });
    return;
  }

  const body = {
    date, agentName, stockist, chemist,
    products: [], purchaseAmount, deliveryCharge: 0, totalAmount, cash, online, credit, dues, cashback
  };

  try {
    const res = await fetch(`${API_URL}/stockist-orders`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body)
    });
    if (res.ok) {
      closeModal('newStockistOrderModal');
      await fetchAllData();
      showToast(' Saved', 'Stockist order created');
    } else {
      const data = await res.json();
      showToast(' Error', data.error || 'Failed to save order');
    }
  } catch (err) {
    showToast(' Error', 'Server error');
  }
}

//  BOOT
window.onload = async () => {
  // Splash screen  always hide after 1.5s and show login
  setTimeout(() => {
    document.getElementById('splashScreen').classList.add('hiding');
    setTimeout(() => {
      document.getElementById('splashScreen').style.display = 'none';
      // Always ensure login screen is visible unless app already started
      if (!currentUser) {
        document.getElementById('loginScreen').style.display = 'flex';
      }
    }, 600);
  }, 1500);

  // Session restore
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { headers: getHeaders() });
      if (res.ok) {
        currentUser = await res.json();
        document.getElementById('loginScreen').style.display = 'none';
        initApp();
      } else {
        // Token invalid  clear it
        localStorage.removeItem("token");
      }
    } catch (e) {
      // Server offline  show login
      localStorage.removeItem("token");
    }
  }
};

// ── GLOBAL ENTER KEY HANDLER ──
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  // Don't trigger on textarea
  if (e.target.tagName === 'TEXTAREA') return;

  // Find the open modal and click its primary button
  const openModal = document.querySelector('.modal-overlay.open');
  if (openModal) {
    const primary = openModal.querySelector('.btn-primary');
    if (primary) { e.preventDefault(); primary.click(); }
    return;
  }

  // Login screen
  const loginScreen = document.getElementById('loginScreen');
  if (loginScreen && loginScreen.style.display !== 'none') {
    e.preventDefault();
    doLogin();
  }
});
