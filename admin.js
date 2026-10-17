// ===============================
// ADMIN DASHBOARD
// (shared helpers like API_BASE, escapeHtml, toast live in fx.js)
// ===============================

const $ = function (id) { return document.getElementById(id); };

const STATUSES = ["Pending", "In Progress", "Resolved"];
const STATUS_VAR = { "Pending": "var(--pending)", "In Progress": "var(--progress)", "Resolved": "var(--resolved)" };
const CATEGORIES = ["Technical", "Academic", "Infrastructure", "Hostel", "Other"];
const PAGE_SIZE = 10;
const REFRESH_MS = 30000;

const state = {
    complaints: [],
    status: "all",
    category: "all",
    search: "",
    sortKey: "created",
    sortDir: "desc",
    page: 1,
    openId: null,
    auto: true,
    loadedOnce: false,
    lastUpdated: null,
    lastFocus: null,
    freshIds: new Set()
};

let chartsAnimated = false;

// ---------- auth ----------

function getToken() {
    let token = null;
    try { token = localStorage.getItem("adminToken"); } catch (e) { /* storage blocked */ }

    if (!token) {
        window.location.href = "admin-login.html";
        return null;
    }

    return token;
}

function sessionExpired() {
    try { localStorage.removeItem("adminToken"); } catch (e) { /* ignore */ }
    toast("Your session expired. Sign in again.", "error");
    setTimeout(function () { window.location.href = "admin-login.html"; }, 1400);
}

$("logoutBtn").addEventListener("click", function () {
    try { localStorage.removeItem("adminToken"); } catch (e) { /* ignore */ }
    window.location.href = "admin-login.html";
});


// ===============================
// LOAD COMPLAINTS
// ===============================

async function loadComplaints(manual) {

    const token = getToken();
    if (!token) return;

    const refreshBtn = $("refreshBtn");
    if (manual) refreshBtn.disabled = true;

    try {

        const response = await fetch(
            API_BASE + "/complaints",
            { headers: { "Authorization": "Bearer " + token } }
        );

        if (response.status === 401) {
            sessionExpired();
            return;
        }

        const data = await response.json();

        if (!data.success) {
            setSync("error", data.message || "Failed to load");
            if (!state.loadedOnce) showTableMessage(data.message || "Failed to load complaints.");
            return;
        }

        // Spot complaints that arrived since the last load
        if (state.loadedOnce) {
            const known = new Set(state.complaints.map(function (c) { return c.complaint_id; }));
            const arrived = data.complaints.filter(function (c) { return !known.has(c.complaint_id); });

            if (arrived.length) {
                state.freshIds = new Set(arrived.map(function (c) { return c.complaint_id; }));
                toast(arrived.length === 1 ? "1 new complaint arrived." : arrived.length + " new complaints arrived.", "info");
                setTimeout(function () { state.freshIds.clear(); }, 4000);
            }
        }

        state.complaints = data.complaints;
        state.loadedOnce = true;
        state.lastUpdated = new Date();

        setSync(state.auto ? "on" : "off");
        renderAll();

        if (manual) toast("Up to date.", "success");

    } catch (error) {

        console.error("Error loading complaints:", error);

        setSync("error", "Can't reach server");
        if (!state.loadedOnce) showTableMessage("Can't reach the server. Check your connection and refresh.");
        if (manual) toast("Can't reach the server.", "error");

    } finally {

        refreshBtn.disabled = false;

    }
}

function setSync(mode, text) {
    const el = $("sync");
    el.className = "sync " + mode;

    const time = state.lastUpdated
        ? state.lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

    if (mode === "error") $("syncText").textContent = text || "Offline";
    else if (mode === "on") $("syncText").textContent = "Live · updated " + time;
    else $("syncText").textContent = "Paused · updated " + time;
}


// ===============================
// FILTER + SORT
// ===============================

function visibleComplaints() {

    const search = state.search.trim().toLowerCase();

    const list = state.complaints.filter(function (c) {

        if (state.status !== "all" && c.status !== state.status) return false;
        if (state.category !== "all" && c.category !== state.category) return false;
        if (!search) return true;

        return [c.complaint_id, c.name, c.email, c.category, c.status, c.description]
            .some(function (field) { return String(field || "").toLowerCase().includes(search); });

    });

    const dir = state.sortDir === "asc" ? 1 : -1;

    list.sort(function (a, b) {
        let result = 0;

        switch (state.sortKey) {
            case "id": result = a.complaint_id.localeCompare(b.complaint_id, undefined, { numeric: true }); break;
            case "name": result = String(a.name).localeCompare(String(b.name)); break;
            case "category": result = String(a.category).localeCompare(String(b.category)); break;
            case "status": result = STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status); break;
            default: result = new Date(a.created_at) - new Date(b.created_at);
        }

        return result * dir;
    });

    return list;
}

function counts() {
    const result = { all: state.complaints.length, "Pending": 0, "In Progress": 0, "Resolved": 0 };
    state.complaints.forEach(function (c) { if (c.status in result) result[c.status]++; });
    return result;
}


// ===============================
// RENDER
// ===============================

function renderAll() {
    updateStatistics();
    renderTabs();
    renderTable();
    renderCharts();

    if (state.openId) renderDrawer();
}

function updateStatistics() {

    const c = counts();

    countUp($("totalComplaints"), c.all, { duration: 700 });
    countUp($("pendingComplaints"), c["Pending"], { duration: 700 });
    countUp($("progressComplaints"), c["In Progress"], { duration: 700 });
    countUp($("resolvedComplaints"), c["Resolved"], { duration: 700 });

    const today = new Date().toDateString();
    const todayCount = state.complaints.filter(function (x) {
        return new Date(x.created_at).toDateString() === today;
    }).length;

    $("totalHint").textContent = todayCount + " filed today";
    $("resolvedHint").textContent = c.all ? Math.round((c["Resolved"] / c.all) * 100) + "% of all complaints" : "Closed";

    $("subtitle").textContent = c["Pending"]
        ? c["Pending"] + (c["Pending"] === 1 ? " complaint is" : " complaints are") + " waiting for a first review."
        : "Nothing is waiting for a first review.";

    document.querySelectorAll(".stat-card").forEach(function (card) {
        card.classList.toggle("active", card.dataset.filter === state.status);
    });
}

function renderTabs() {

    const c = counts();
    const tabs = [["all", "All"], ["Pending", "Pending"], ["In Progress", "In progress"], ["Resolved", "Resolved"]];

    $("tabs").innerHTML = tabs.map(function (t) {
        const active = state.status === t[0];
        return '<button type="button" role="tab" class="tab' + (active ? " active" : "") + '" data-status="' + escapeHtml(t[0]) +
            '" aria-selected="' + active + '">' + escapeHtml(t[1]) + "<span>" + c[t[0]] + "</span></button>";
    }).join("");
}

function showTableMessage(text, withReset) {
    $("complaintsTable").innerHTML =
        '<tr><td colspan="7" class="table-message">' + escapeHtml(text) +
        (withReset ? ' <button type="button" class="small-btn" id="clearFilters" style="margin-left:8px">Clear filters</button>' : "") +
        "</td></tr>";

    $("pagerInfo").textContent = "";
    $("prevBtn").disabled = true;
    $("nextBtn").disabled = true;
}

function renderTable() {

    const list = visibleComplaints();

    if (!state.complaints.length) {
        showTableMessage("No complaints yet. New ones will appear here as soon as someone submits them.");
        return;
    }

    if (!list.length) {
        showTableMessage("No complaints match these filters.", true);
        return;
    }

    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    $("complaintsTable").innerHTML = pageItems.map(function (c) {

        const id = escapeHtml(c.complaint_id);
        const fresh = state.freshIds.has(c.complaint_id) ? " is-new" : "";

        return `
            <tr class="${fresh}" data-id="${id}" tabindex="0">
                <td data-label="ID" class="cell-id">${id}</td>
                <td data-label="Complainant" class="cell-person"><div><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.email)}</small></div></td>
                <td data-label="Category"><span class="cat-tag">${escapeHtml(c.category)}</span></td>
                <td data-label="Description"><div class="cell-desc">${escapeHtml(c.description)}</div></td>
                <td data-label="Submitted" class="cell-time" title="${escapeHtml(new Date(c.created_at).toLocaleString())}">${escapeHtml(timeAgo(c.created_at))}</td>
                <td data-label="Status"><span class="status ${statusClass(c.status)}">${escapeHtml(c.status)}</span></td>
                <td data-label="Update">
                    <select data-id="${id}" aria-label="Change status of ${id}">
                        ${STATUSES.map(function (option) {
                            return '<option value="' + option + '"' + (c.status === option ? " selected" : "") + ">" + option + "</option>";
                        }).join("")}
                    </select>
                </td>
            </tr>
        `;

    }).join("");

    $("pagerInfo").textContent =
        "Showing " + (start + 1) + "–" + (start + pageItems.length) + " of " + list.length +
        (list.length === state.complaints.length ? "" : " (filtered from " + state.complaints.length + ")");

    $("prevBtn").disabled = state.page <= 1;
    $("nextBtn").disabled = state.page >= pages;

    // Sort arrows
    document.querySelectorAll("th[data-sort]").forEach(function (th) {
        const active = th.dataset.sort === state.sortKey;
        th.setAttribute("aria-sort", active ? (state.sortDir === "asc" ? "ascending" : "descending") : "none");
        th.querySelector(".arrow").textContent = active ? (state.sortDir === "asc" ? "▲" : "▼") : "▲▼";
    });
}


// ===============================
// CHARTS (hand-drawn SVG, no libraries)
// ===============================

function renderCharts() {
    renderTrend();
    renderStatusDonut();
    renderCategoryBars();
    chartsAnimated = true;
}

function renderTrend() {

    const box = $("trendChart");

    if (!state.complaints.length) {
        box.innerHTML = '<div class="chart-empty">No data yet.</div>';
        return;
    }

    const width = Math.max(260, box.clientWidth || 600);
    const height = 190;
    const pad = { left: 28, right: 10, top: 12, bottom: 24 };

    // Count complaints per local calendar day
    const days = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        days.push({ date: d, key: d.toDateString(), count: 0 });
    }

    state.complaints.forEach(function (c) {
        const key = new Date(c.created_at).toDateString();
        const day = days.find(function (d) { return d.key === key; });
        if (day) day.count++;
    });

    const peak = Math.max.apply(null, days.map(function (d) { return d.count; }));
    const max = Math.max(4, peak % 2 ? peak + 1 : peak);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    function x(i) { return pad.left + (plotW * i) / (days.length - 1); }
    function y(v) { return pad.top + plotH - (plotH * v) / max; }

    const line = days.map(function (d, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(d.count).toFixed(1); }).join(" ");
    const area = line + " L" + x(days.length - 1).toFixed(1) + " " + (pad.top + plotH) + " L" + x(0).toFixed(1) + " " + (pad.top + plotH) + " Z";

    const grid = [0, max / 2, max].map(function (v) {
        return '<line class="trend-grid" x1="' + pad.left + '" x2="' + (width - pad.right) + '" y1="' + y(v) + '" y2="' + y(v) + '"></line>' +
            '<text x="' + (pad.left - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
    }).join("");

    const labels = days.map(function (d, i) {
        if (i % 3 !== 1) return "";
        return '<text x="' + x(i) + '" y="' + (height - 6) + '" text-anchor="middle">' +
            d.date.toLocaleDateString([], { day: "numeric", month: "short" }) + "</text>";
    }).join("");

    const points = days.map(function (d, i) {
        const label = d.date.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" }) +
            ": " + d.count + (d.count === 1 ? " complaint" : " complaints");
        return '<circle class="trend-hit" cx="' + x(i) + '" cy="' + y(d.count) + '" r="14" data-tip="' + escapeHtml(label) + '"></circle>' +
            '<circle class="trend-dot" cx="' + x(i) + '" cy="' + y(d.count) + '" r="4" pointer-events="none"></circle>';
    }).join("");

    box.innerHTML =
        '<svg class="trend-svg" viewBox="0 0 ' + width + " " + height + '" role="img" aria-label="Complaints per day over the last 14 days">' +
        '<defs><linearGradient id="trendFade" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="var(--brand)" stop-opacity="0.35"></stop>' +
        '<stop offset="1" stop-color="var(--brand)" stop-opacity="0"></stop></linearGradient></defs>' +
        grid + '<path class="trend-area" d="' + area + '"></path><path class="trend-line" d="' + line + '"></path>' +
        labels + points + "</svg>";
}

function renderStatusDonut() {

    const box = $("statusChart");
    const c = counts();

    if (!c.all) {
        box.innerHTML = '<div class="chart-empty">No data yet.</div>';
        return;
    }

    let offset = 25;
    const segments = STATUSES.map(function (status) {
        const pct = (c[status] / c.all) * 100;
        const seg = '<circle class="d-seg" cx="21" cy="21" r="15.9155" stroke="' + STATUS_VAR[status] + '"' +
            ' stroke-dasharray="' + (chartsAnimated ? pct.toFixed(2) : 0) + ' ' + (chartsAnimated ? (100 - pct).toFixed(2) : 100) + '"' +
            ' stroke-dashoffset="' + offset.toFixed(2) + '" data-status="' + status + '" data-pct="' + pct.toFixed(2) + '"' +
            ' data-tip="' + escapeHtml(status + ": " + c[status]) + '"></circle>';
        offset -= pct;
        return seg;
    }).join("");

    const legend = STATUSES.map(function (status) {
        return '<li><i style="background:' + STATUS_VAR[status] + '"></i>' + (status === "In Progress" ? "In progress" : status) + "<b>" + c[status] + "</b></li>";
    }).join("");

    box.innerHTML =
        '<div class="donut-wrap">' +
        '<svg class="donut" viewBox="0 0 42 42" role="img" aria-label="Complaints by status">' +
        '<circle class="d-track" cx="21" cy="21" r="15.9155"></circle>' + segments +
        '<text x="21" y="22.5" text-anchor="middle" font-size="8">' + c.all + "</text>" +
        '<text x="21" y="28" text-anchor="middle" font-size="2.8" style="font-family:Figtree,sans-serif;font-weight:600;fill:var(--muted)">total</text>' +
        "</svg>" +
        '<ul class="legend">' + legend + "</ul></div>";

    if (!chartsAnimated) {
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                box.querySelectorAll(".d-seg").forEach(function (seg) {
                    const pct = Number(seg.dataset.pct);
                    seg.setAttribute("stroke-dasharray", pct.toFixed(2) + " " + (100 - pct).toFixed(2));
                });
            });
        });
    }
}

function renderCategoryBars() {

    const box = $("categoryChart");

    if (!state.complaints.length) {
        box.innerHTML = '<div class="chart-empty">No data yet.</div>';
        return;
    }

    const totals = {};
    CATEGORIES.forEach(function (name) { totals[name] = 0; });
    state.complaints.forEach(function (c) { if (c.category in totals) totals[c.category]++; });

    const peak = Math.max.apply(null, CATEGORIES.map(function (n) { return totals[n]; })) || 1;
    const ordered = CATEGORIES.slice().sort(function (a, b) { return totals[b] - totals[a]; });

    box.innerHTML = '<div class="bars">' + ordered.map(function (name) {
        const pct = (totals[name] / peak) * 100;
        return '<div class="bar-row"><span>' + name + '</span><div class="bar-track"><div class="bar-fill" data-w="' + pct.toFixed(1) +
            '" style="width:' + (chartsAnimated ? pct.toFixed(1) : 0) + '%"></div></div><b>' + totals[name] + "</b></div>";
    }).join("") + "</div>";

    if (!chartsAnimated) {
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                box.querySelectorAll(".bar-fill").forEach(function (bar) { bar.style.width = bar.dataset.w + "%"; });
            });
        });
    }
}

// Tooltips for chart elements
const tip = $("tip");

document.addEventListener("pointermove", function (event) {
    const target = event.target.closest ? event.target.closest("[data-tip]") : null;

    if (!target) {
        tip.classList.remove("show");
        return;
    }

    tip.textContent = target.getAttribute("data-tip");
    tip.style.left = Math.min(event.clientX + 14, window.innerWidth - tip.offsetWidth - 10) + "px";
    tip.style.top = (event.clientY + 16) + "px";
    tip.classList.add("show");
});

let resizeTimer = null;
window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (state.complaints.length) renderTrend(); }, 150);
});


// ===============================
// STATUS UPDATES (optimistic, rolls back on failure)
// ===============================

async function updateStatus(complaintId, status) {

    const token = getToken();
    if (!token) return;

    const complaint = state.complaints.find(function (c) { return c.complaint_id === complaintId; });
    if (!complaint || complaint.status === status) {
        renderAll(); // snap a changed dropdown back
        return;
    }

    const previous = complaint.status;
    complaint.status = status;
    renderAll();

    try {

        const response = await fetch(
            API_BASE + "/complaints/" + encodeURIComponent(complaintId) + "/status",
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + token
                },
                body: JSON.stringify({ status: status })
            }
        );

        if (response.status === 401) {
            complaint.status = previous;
            renderAll();
            sessionExpired();
            return;
        }

        const data = await response.json();

        if (!data.success) {
            complaint.status = previous;
            renderAll();
            toast(data.message || "Couldn't update the status.", "error");
            return;
        }

        toast(complaintId + " marked " + status + ".", "success");

    } catch (error) {

        console.error("Update error:", error);

        complaint.status = previous;
        renderAll();
        toast("Can't reach the server. The status was not changed.", "error");

    }
}


// ===============================
// EVENTS: table, tabs, stat cards, donut, sort, pager, filters
// ===============================

function setStatusFilter(value) {
    state.status = state.status === value && value !== "all" ? "all" : value;
    state.page = 1;
    renderAll();
}

$("complaintsTable").addEventListener("change", function (event) {
    const select = event.target.closest("select[data-id]");
    if (select) updateStatus(select.dataset.id, select.value);
});

$("complaintsTable").addEventListener("click", function (event) {

    if (event.target.closest("#clearFilters")) {
        state.status = "all";
        state.category = "all";
        state.search = "";
        state.page = 1;
        $("searchInput").value = "";
        $("categoryFilter").value = "all";
        renderAll();
        return;
    }

    if (event.target.closest("select")) return;

    const row = event.target.closest("tr[data-id]");
    if (row) openDrawer(row.dataset.id);
});

$("complaintsTable").addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || event.target.closest("select")) return;
    const row = event.target.closest("tr[data-id]");
    if (row) openDrawer(row.dataset.id);
});

$("tabs").addEventListener("click", function (event) {
    const tab = event.target.closest(".tab");
    if (!tab) return;
    state.status = tab.dataset.status;
    state.page = 1;
    renderAll();
});

document.querySelectorAll(".stat-card").forEach(function (card) {
    card.addEventListener("click", function () {
        setStatusFilter(card.dataset.filter);
        $("tabs").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth", block: "center" });
    });
});

$("statusChart").addEventListener("click", function (event) {
    const seg = event.target.closest(".d-seg");
    if (seg) setStatusFilter(seg.dataset.status);
});

document.querySelectorAll("th[data-sort]").forEach(function (th) {
    th.querySelector("button").addEventListener("click", function () {
        const key = th.dataset.sort;
        if (state.sortKey === key) {
            state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
            state.sortKey = key;
            state.sortDir = key === "created" ? "desc" : "asc";
        }
        state.page = 1;
        renderTable();
    });
});

$("prevBtn").addEventListener("click", function () { state.page--; renderTable(); });
$("nextBtn").addEventListener("click", function () { state.page++; renderTable(); });

let searchTimer = null;
$("searchInput").addEventListener("input", function (event) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
        state.search = event.target.value;
        state.page = 1;
        renderTable();
    }, 150);
});

$("categoryFilter").addEventListener("change", function (event) {
    state.category = event.target.value;
    state.page = 1;
    renderTable();
});

$("refreshBtn").addEventListener("click", function () { loadComplaints(true); });

$("autoBtn").addEventListener("click", function () {
    state.auto = !state.auto;
    this.setAttribute("aria-pressed", state.auto ? "true" : "false");
    this.textContent = "Auto-refresh: " + (state.auto ? "on" : "off");
    if (state.lastUpdated) setSync(state.auto ? "on" : "off");
});

setInterval(function () {
    if (state.auto && !document.hidden) loadComplaints();
}, REFRESH_MS);

document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state.auto && state.lastUpdated && Date.now() - state.lastUpdated > REFRESH_MS) {
        loadComplaints();
    }
});


// ===============================
// CSV EXPORT (current filters and sort, every page)
// ===============================

function csvCell(value) {
    let text = String(value == null ? "" : value);
    // Stop spreadsheet apps from running user text as a formula
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
}

$("csvBtn").addEventListener("click", function () {

    const list = visibleComplaints();

    if (!list.length) {
        toast("Nothing to export with these filters.", "error");
        return;
    }

    const header = ["Complaint ID", "Name", "Email", "Category", "Description", "Status", "Submitted"];
    const rows = list.map(function (c) {
        return [c.complaint_id, c.name, c.email, c.category, c.description, c.status, new Date(c.created_at).toISOString()];
    });

    const csv = "﻿" + [header].concat(rows).map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "complaints-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

    toast("Exported " + list.length + (list.length === 1 ? " complaint." : " complaints."), "success");
});


// ===============================
// DETAIL DRAWER
// ===============================

const drawer = $("drawer");
const scrim = $("scrim");

function openDrawer(id) {
    state.openId = id;
    state.lastFocus = document.activeElement;

    renderDrawer();

    drawer.classList.add("show");
    scrim.classList.add("show");
    drawer.setAttribute("aria-hidden", "false");

    setTimeout(function () { $("drawerClose").focus(); }, 50);
}

function closeDrawer() {
    if (!state.openId) return;

    state.openId = null;
    drawer.classList.remove("show");
    scrim.classList.remove("show");
    drawer.setAttribute("aria-hidden", "true");

    if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function renderDrawer() {

    const c = state.complaints.find(function (x) { return x.complaint_id === state.openId; });

    if (!c) {
        closeDrawer();
        return;
    }

    $("drawerTitle").textContent = c.complaint_id;

    $("drawerBody").innerHTML = `
        <div><span class="status ${statusClass(c.status)}">${escapeHtml(c.status)}</span></div>

        <div class="field-box"><small>Name</small><p>${escapeHtml(c.name)}</p></div>
        <div class="field-box"><small>Email</small><a href="mailto:${escapeHtml(encodeURI(c.email))}?subject=${encodeURIComponent("Your complaint " + c.complaint_id)}">${escapeHtml(c.email)}</a></div>
        <div class="field-box"><small>Category</small><p>${escapeHtml(c.category)}</p></div>
        <div class="field-box"><small>Submitted</small><p>${escapeHtml(new Date(c.created_at).toLocaleString())} (${escapeHtml(timeAgo(c.created_at))})</p></div>
        <div class="field-box"><small>Description</small><p>${escapeHtml(c.description)}</p></div>

        <div>
            <p class="field-label" style="font-weight:600;margin-bottom:8px">Change status</p>
            <div class="seg">
                ${STATUSES.map(function (s) {
                    return '<button type="button" data-status="' + s + '" aria-pressed="' + (c.status === s) + '">' + s + "</button>";
                }).join("")}
            </div>
        </div>

        <div class="drawer-actions">
            <a class="btn btn-ghost" href="index.html?id=${encodeURIComponent(c.complaint_id)}" target="_blank" rel="noopener">View public page</a>
            <button type="button" class="btn btn-ghost" id="copyDrawerId">Copy ID</button>
        </div>
    `;
}

$("drawerBody").addEventListener("click", async function (event) {

    const seg = event.target.closest(".seg button");
    if (seg && state.openId) {
        updateStatus(state.openId, seg.dataset.status);
        return;
    }

    if (event.target.closest("#copyDrawerId")) {
        try {
            await navigator.clipboard.writeText(state.openId);
            toast("Copied " + state.openId, "success");
        } catch (e) {
            toast("Couldn't copy. Select the ID and copy it manually.", "error");
        }
    }
});

$("drawerClose").addEventListener("click", closeDrawer);
scrim.addEventListener("click", closeDrawer);

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        closeDrawer();
        return;
    }

    // "/" jumps to search (unless you're already typing)
    if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        event.preventDefault();
        $("searchInput").focus();
        return;
    }

    // Keep Tab inside the open drawer
    if (event.key === "Tab" && state.openId) {
        const focusable = drawer.querySelectorAll("button, a[href]");
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }
});


// Skeleton rows while the first load runs
(function showSkeleton() {
    let rows = "";
    for (let i = 0; i < 5; i++) {
        rows += '<tr>' + '<td colspan="7"><div class="skeleton"></div></td></tr>';
    }
    $("complaintsTable").innerHTML = rows;
})();

// Load when page opens
loadComplaints();
