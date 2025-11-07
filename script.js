// =========================
// Operation Apartments - Static frontend + Google Sheets connector
// =========================

// ========== CONFIG =========
// Replace this with your deployed Google Apps Script Web App URL (Apps Script must be deployed as "Web app" and "Anyone, even anonymous" can access)
const API_URL = ""; // <--- PASTE YOUR APPS SCRIPT WEB APP URL HERE (string)
// Example: const API_URL = "https://script.google.com/macros/s/AKfycb.../exec";

// If API_URL is empty, the app will use local fallback sample data so you can test offline.
const USE_FALLBACK = (API_URL.trim().length === 0);

// Rent values
const TOTAL_HOUSES = 21;
const RENT_PER_HOUSE = 30000; // Ksh

// DOM refs
const content = document.getElementById("content");
document.getElementById("year").textContent = new Date().getFullYear();

// navigation buttons
const dashboardBtn = document.getElementById("dashboardBtn");
const tenantsBtn = document.getElementById("tenantsBtn");
const complaintsBtn = document.getElementById("complaintsBtn");

dashboardBtn.addEventListener("click", () => { setActive(dashboardBtn); showDashboard(); });
tenantsBtn.addEventListener("click", () => { setActive(tenantsBtn); showTenants(); });
complaintsBtn.addEventListener("click", () => { setActive(complaintsBtn); showComplaints(); });

function setActive(btn){
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ========== SAMPLE / FALLBACK DATA ==========
const SAMPLE_TENANTS = [
  { "House No": "1", "Tenant Name": "John Doe", "Rent Paid": "YES", "Month": "Nov" },
  { "House No": "2", "Tenant Name": "Mary Wanjiku", "Rent Paid": "NO", "Month": "Nov" },
  { "House No": "3", "Tenant Name": "Alex Otieno", "Rent Paid": "YES", "Month": "Nov" },
  // (you can paste more sample rows here)
];

// ========== UI VIEWS ==========

function showDashboard(){
  content.innerHTML = `<div class="cards">
    <div class="card">
      <h3>Total Houses</h3>
      <div class="value">${TOTAL_HOUSES}</div>
    </div>
    <div class="card">
      <h3>Expected Monthly Rent</h3>
      <div class="value">Ksh ${numberWithCommas(TOTAL_HOUSES * RENT_PER_HOUSE)}</div>
    </div>
    <div class="card" id="collectedCard">
      <h3>Total Collected (this month)</h3>
      <div class="value" id="collectedValue">Loading...</div>
    </div>
  </div>
  <div style="height:16px;"></div>
  <div class="table-wrap" id="dashboardList">
    <h3 style="margin-top:0">Recent tenants (preview)</h3>
    <div id="recentTable">Loading...</div>
  </div>`;

  loadTenantsAndRenderSummary();
}

async function showTenants(){
  content.innerHTML = `<h2>Tenants</h2>
  <div class="table-wrap" id="tenantsTableWrap">
    <p>Loading tenants...</p>
  </div>`;

  try {
    const tenants = await fetchTenants();
    renderTenantsTable(tenants, document.getElementById("tenantsTableWrap"));
  } catch (err) {
    document.getElementById("tenantsTableWrap").innerHTML = `<p style="color:red">Error loading tenants: ${err}</p>`;
  }
}

function showComplaints(){
  content.innerHTML = `<h2>Submit a Complaint</h2>
  <div class="table-wrap">
    <form id="complaintForm">
      <div class="form-row">
        <label>House No</label><br>
        <input type="text" id="houseNo" placeholder="e.g. 5" required>
      </div>
      <div class="form-row">
        <label>Name (optional)</label><br>
        <input type="text" id="complainantName" placeholder="Tenant name">
      </div>
      <div class="form-row">
        <label>Complaint</label><br>
        <textarea id="complaintText" rows="5" placeholder="Describe the issue" required></textarea>
      </div>
      <button type="submit" class="primary">Send Complaint</button>
    </form>
    <div class="resp" id="complaintResp"></div>
  </div>`;

  document.getElementById("complaintForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const houseNo = document.getElementById("houseNo").value.trim();
    const name = document.getElementById("complainantName").value.trim();
    const text = document.getElementById("complaintText").value.trim();
    if(!houseNo || !text){ document.getElementById("complaintResp").innerHTML = '<span style="color:red">House No and complaint are required.</span>'; return; }

    const payload = {
      houseNo,
      tenantName: name,
      complaint: text,
      date: new Date().toISOString()
    };

    try {
      const resText = await postComplaint(payload);
      document.getElementById("complaintResp").innerHTML = `<span style="color:green">${escapeHtml(resText || 'Complaint submitted!')}</span>`;
      document.getElementById("complaintForm").reset();
    } catch (err) {
      document.getElementById("complaintResp").innerHTML = `<span style="color:red">Error: ${escapeHtml(err)}</span>`;
    }
  });
}

// ========== DATA LAYER ==========

async function fetchTenants(){
  if(USE_FALLBACK) return SAMPLE_TENANTS;

  const res = await fetch(API_URL, { method: 'GET' });
  if(!res.ok) throw new Error(`API GET failed (${res.status})`);
  const json = await res.json();
  // Expected: array of objects with headers as keys
  return json;
}

async function postComplaint(body){
  if(USE_FALLBACK) {
    // mimic network delay
    await new Promise(r=>setTimeout(r,500));
    return "Running in fallback mode — complaint saved to local test only.";
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error(`API POST failed (${res.status})`);
  return await res.text();
}

// ========== RENDER HELPERS ==========

async function loadTenantsAndRenderSummary(){
  try {
    const tenants = await fetchTenants();
    // compute collected
    let collectedCount = 0;
    tenants.forEach(t => {
      const paid = String(t['Rent Paid'] || t['RentPaid'] || t['Rent'] || '').toUpperCase();
      if(paid.startsWith('Y') || paid === 'YES' || paid === 'PAID') collectedCount++;
    });
    const collected = collectedCount * RENT_PER_HOUSE;
    document.getElementById("collectedValue").textContent = `Ksh ${numberWithCommas(collected)}`;

    // recent table preview
    const rows = tenants.slice(0, 8);
    const html = buildTableHTML(rows, ['House No','Tenant Name','Rent Paid','Month']);
    document.getElementById("recentTable").innerHTML = html;
  } catch (err) {
    document.getElementById("collectedValue").textContent = '—';
    document.getElementById("recentTable").innerHTML = `<p style="color:red">${escapeHtml(err)}</p>`;
  }
}

function renderTenantsTable(tenants, container){
  const html = `
    <h3 style="margin-top:0">All Tenants</h3>
    ${buildTableHTML(tenants, ['House No','Tenant Name','Rent Paid','Month'])}
  `;
  container.innerHTML = html;
}

function buildTableHTML(rows, cols){
  if(!rows || rows.length===0) return '<p>No data</p>';
  let h = '<table><thead><tr>';
  cols.forEach(c => h += `<th>${escapeHtml(c)}</th>`);
  h += '</tr></thead><tbody>';
  rows.forEach(r => {
    h += '<tr>';
    cols.forEach(c => {
      h += `<td>${escapeHtml(r[c] !== undefined ? r[c] : '')}</td>`;
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  return h;
}

// ========== UTILITIES ==========
function numberWithCommas(x){ return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function escapeHtml(s){ if(s==null) return ''; return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ========== Start on load ==========
showDashboard();
