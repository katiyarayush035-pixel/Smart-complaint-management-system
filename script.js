// ===============================
// PUBLIC PAGE LOGIC
// (shared helpers like API_BASE, escapeHtml, toast live in fx.js)
// ===============================

const $ = function (id) { return document.getElementById(id); };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_ORDER = { "Pending": 0, "In Progress": 1, "Resolved": 2 };
const STATUS_COLOR = { "Pending": "var(--pending)", "In Progress": "var(--progress)", "Resolved": "var(--resolved)" };

function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage blocked */ }
}

function safeStorageRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* storage blocked */ }
}

startBackdrop($("backdrop"));


// ===============================
// NAVBAR (mobile menu + active section)
// ===============================

(function initNav() {
    const nav = $("mainNav");
    const burger = $("navBurger");

    function setOpen(open) {
        nav.classList.toggle("open", open);
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    }

    burger.addEventListener("click", function () {
        setOpen(!nav.classList.contains("open"));
    });

    nav.addEventListener("click", function (event) {
        if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") setOpen(false);
    });

    if (!("IntersectionObserver" in window)) return;

    const links = {};
    nav.querySelectorAll("a[data-section]").forEach(function (a) {
        links[a.dataset.section] = a;
    });

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            Object.keys(links).forEach(function (key) {
                links[key].classList.toggle("active", key === entry.target.id);
            });
        });
    }, { rootMargin: "-40% 0px -55% 0px" });

    Object.keys(links).forEach(function (id) {
        const section = $(id);
        if (section) observer.observe(section);
    });
})();


// ===============================
// SCROLL REVEAL (below-the-fold sections only)
// ===============================

(function initReveal() {
    const items = document.querySelectorAll(".reveal");

    if (!("IntersectionObserver" in window) || REDUCED_MOTION) {
        items.forEach(function (el) { el.classList.add("in"); });
        return;
    }

    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("in");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });

    items.forEach(function (el) { observer.observe(el); });
})();


// ===============================
// HERO: TYPED EXAMPLES
// ===============================

(function initTyped() {
    const target = $("typed");
    const phrases = [
        "Wi-Fi keeps dropping in the library",
        "No hot water in Block C, floor 2",
        "Lab projector has been broken for a week",
        "Mess food is served cold every night",
        "Marks are missing from the internal results sheet"
    ];

    if (REDUCED_MOTION) {
        target.textContent = phrases[0];
        return;
    }

    let phrase = 0;
    let chars = 0;
    let deleting = false;

    function tick() {
        const text = phrases[phrase];

        if (!deleting) {
            chars++;
            target.textContent = text.slice(0, chars);
            if (chars === text.length) {
                deleting = true;
                return setTimeout(tick, 1800);
            }
            return setTimeout(tick, 42);
        }

        chars--;
        target.textContent = text.slice(0, chars);
        if (chars === 0) {
            deleting = false;
            phrase = (phrase + 1) % phrases.length;
            return setTimeout(tick, 350);
        }
        setTimeout(tick, 20);
    }

    tick();
})();


// ===============================
// HERO: TICKET BOARD (sample tickets slide across the lanes)
// ===============================

(function initBoard() {
    const board = $("board");
    const layer = $("boardTickets");
    if (!board || !layer) return;

    const SAMPLES = [
        ["Hostel", "Water cooler on floor 3 is not working"],
        ["Technical", "Wi-Fi drops every evening in the library"],
        ["Infrastructure", "Ceiling fan in Room 204 is making noise"],
        ["Academic", "Lab timetable clashes with the lecture slot"],
        ["Hostel", "Mess menu has not changed in two weeks"],
        ["Technical", "Student portal login fails on mobile"],
        ["Infrastructure", "Lift in the main block stops on floor 2"],
        ["Academic", "Assignment marks missing from the portal"],
        ["Infrastructure", "Streetlight near the south gate is out"],
        ["Technical", "Projector in Seminar Hall has no display"]
    ];

    const SLOT_HEIGHT = 66;
    const SLOT_GAP = 8;
    const lanes = [[], [], []];
    let nextSample = 0;

    function makeTicket(lane, entering) {
        const sample = SAMPLES[nextSample % SAMPLES.length];
        nextSample++;

        const el = document.createElement("div");
        el.className = "ticket" + (entering ? " enter" : "");
        el.dataset.lane = String(lane);
        el.innerHTML =
            "<b>CMP-" + (100000 + Math.floor(Math.random() * 899999)) + " · " + escapeHtml(sample[0]) + "</b>" +
            "<span>" + escapeHtml(sample[1]) + "</span>";
        layer.appendChild(el);

        const ticket = { el: el };
        lanes[lane].push(ticket);
        return ticket;
    }

    function layout() {
        const bodies = board.querySelectorAll(".lane-body");
        if (!bodies.length) return;

        const first = bodies[0];
        layer.style.left = first.offsetLeft + "px";
        layer.style.top = first.offsetTop + "px";
        layer.style.width = (bodies[2].offsetLeft + bodies[2].offsetWidth - first.offsetLeft) + "px";
        layer.style.height = first.offsetHeight + "px";

        lanes.forEach(function (list, laneIndex) {
            const x = bodies[laneIndex].offsetLeft - first.offsetLeft + 8;
            const width = bodies[laneIndex].offsetWidth - 16;

            list.forEach(function (ticket, slot) {
                const y = SLOT_GAP + slot * (SLOT_HEIGHT + SLOT_GAP);
                ticket.el.style.width = width + "px";
                ticket.el.style.height = SLOT_HEIGHT + "px";
                ticket.el.style.transform = "translate(" + x + "px," + y + "px)";
                ticket.el.dataset.lane = String(laneIndex);
            });
        });
    }

    function move(from, to) {
        const ticket = lanes[from].shift();
        if (ticket) lanes[to].push(ticket);
    }

    function step() {
        if (document.hidden) return;

        if (lanes[2].length >= 2) {
            const gone = lanes[2].shift();
            gone.el.classList.add("leave");
            setTimeout(function () { gone.el.remove(); }, 700);
        }

        if (lanes[1].length >= 2 || (lanes[1].length && Math.random() < 0.5)) move(1, 2);
        if (lanes[0].length >= 2 && lanes[1].length < 3) move(0, 1);

        if (lanes[0].length < 3) {
            const fresh = makeTicket(0, true);
            layout();
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { fresh.el.classList.remove("enter"); });
            });
        }

        layout();
    }

    // Starting picture
    makeTicket(0); makeTicket(0);
    makeTicket(1); makeTicket(1);
    makeTicket(2);
    layout();

    window.addEventListener("resize", layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

    if (REDUCED_MOTION) return;

    setInterval(step, 2600);

    // Gentle 3D tilt that follows the pointer (mouse only)
    const wrap = board.parentElement;

    wrap.addEventListener("pointermove", function (event) {
        if (event.pointerType !== "mouse") return;
        const rect = wrap.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width - 0.5;
        const py = (event.clientY - rect.top) / rect.height - 0.5;
        board.style.transform = "rotateY(" + (px * 8).toFixed(2) + "deg) rotateX(" + (-py * 8).toFixed(2) + "deg)";
    });

    wrap.addEventListener("pointerleave", function () {
        board.style.transform = "";
    });
})();


// ===============================
// LIVE STATS
// ===============================

async function loadStats() {
    const note = $("numbersNote");

    try {
        const response = await fetch(API_BASE + "/api/stats");
        const data = await response.json();

        if (!data.success) throw new Error("no stats");

        const s = data.stats;

        countUp($("statTotal"), s.total);
        countUp($("statPending"), s.pending);
        countUp($("statProgress"), s.inProgress);
        countUp($("statRate"), s.resolutionRate, { suffix: "%" });

        countUp($("laneCount0"), s.pending, { duration: 700 });
        countUp($("laneCount1"), s.inProgress, { duration: 700 });
        countUp($("laneCount2"), s.resolved, { duration: 700 });

        $("rateFill").style.strokeDashoffset = String(169.6 * (1 - s.resolutionRate / 100));

        note.textContent = s.total === 0
            ? "No complaints have been filed yet."
            : "Live numbers. Refreshed " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + ".";
    } catch (error) {
        note.textContent = "Live numbers are unavailable right now.";
    }
}

loadStats();
setInterval(function () { if (!document.hidden) loadStats(); }, 30000);


// ===============================
// COMPLAINT FORM
// ===============================

const complaintForm = $("complaintForm");
const successMessage = $("successMessage");
const DRAFT_KEY = "complaintDraft";

const CATEGORY_WORDS = {
    Technical: ["wifi", "wi-fi", "internet", "network", "portal", "website", "login", "password", "computer", "lab", "software", "projector", "server", "laptop", "printer", "email", "app", "otp"],
    Academic: ["exam", "exams", "marks", "grade", "grades", "result", "results", "faculty", "teacher", "professor", "class", "lecture", "attendance", "syllabus", "assignment", "timetable", "course", "fees", "fee", "semester"],
    Infrastructure: ["fan", "light", "lights", "water", "toilet", "washroom", "classroom", "bench", "door", "window", "ceiling", "lift", "elevator", "road", "parking", "canteen", "library", "leak", "leaking", "building", "power", "electricity", "ac", "broken"],
    Hostel: ["hostel", "mess", "warden", "room", "roommate", "laundry", "curfew", "bed", "mattress", "dorm", "food"]
};

function getCategory() {
    const checked = complaintForm.querySelector("input[name='category']:checked");
    return checked ? checked.value : "";
}

function setCategory(value) {
    const radio = complaintForm.querySelector("input[name='category'][value='" + value + "']");
    if (radio) radio.checked = true;
}

function fieldValue(name) {
    if (name === "category") return getCategory();
    return $(name).value.trim();
}

function fieldIsValid(name) {
    const value = fieldValue(name);
    if (name === "email") return EMAIL_REGEX.test(value);
    if (name === "description") return value.length >= 10;
    return value.length > 0;
}

function showFieldState(name) {
    const group = complaintForm.querySelector("[data-field='" + name + "']");
    group.classList.toggle("has-error", !fieldIsValid(name));
}

function updateProgress() {
    const fields = ["name", "email", "category", "description"];
    const done = fields.filter(fieldIsValid).length;
    $("formProgress").style.width = (done / fields.length) * 100 + "%";
}

function updateCharCount() {
    $("charCount").textContent = $("description").value.length + " / 5000";
}

// ----- Draft autosave -----

let draftTimer = null;

function saveDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
        const draft = {
            name: $("name").value,
            email: $("email").value,
            category: getCategory(),
            description: $("description").value
        };

        if (!draft.name && !draft.email && !draft.category && !draft.description) {
            safeStorageRemove(DRAFT_KEY);
            $("draftNote").textContent = "";
            return;
        }

        safeStorageSet(DRAFT_KEY, JSON.stringify(draft));
        $("draftNote").textContent = "Draft saved on this device.";
    }, 500);
}

function restoreDraft() {
    const raw = safeStorageGet(DRAFT_KEY);
    if (!raw) return;

    try {
        const draft = JSON.parse(raw);
        $("name").value = draft.name || "";
        $("email").value = draft.email || "";
        $("description").value = draft.description || "";
        if (draft.category) setCategory(draft.category);

        if (draft.name || draft.email || draft.description || draft.category) {
            $("draftNote").textContent = "Restored your unsent draft.";
        }
    } catch (e) {
        safeStorageRemove(DRAFT_KEY);
    }
}

// ----- Category suggestion from the description -----

let suggestTimer = null;
let suggestedCategory = "";

function updateSuggestion() {
    const text = $("description").value.toLowerCase();
    const box = $("suggest");

    if (text.length < 15) {
        box.classList.remove("show");
        return;
    }

    const words = text.match(/[a-z][a-z-]*/g) || [];
    let best = "";
    let bestScore = 0;

    Object.keys(CATEGORY_WORDS).forEach(function (category) {
        const score = words.filter(function (w) { return CATEGORY_WORDS[category].indexOf(w) !== -1; }).length;
        if (score > bestScore) {
            best = category;
            bestScore = score;
        }
    });

    if (!best || best === getCategory()) {
        box.classList.remove("show");
        return;
    }

    suggestedCategory = best;
    $("suggestText").textContent = "This sounds like a " + best + " complaint.";
    $("suggestBtn").textContent = "Use " + best;
    box.classList.add("show");
}

$("suggestBtn").addEventListener("click", function () {
    setCategory(suggestedCategory);
    $("suggest").classList.remove("show");
    showFieldState("category");
    updateProgress();
    saveDraft();
});

// ----- Field events -----

["name", "email", "description"].forEach(function (name) {
    const el = $(name);

    el.addEventListener("input", function () {
        if (complaintForm.querySelector("[data-field='" + name + "']").classList.contains("has-error")) {
            showFieldState(name);
        }
        if (name === "description") {
            updateCharCount();
            clearTimeout(suggestTimer);
            suggestTimer = setTimeout(updateSuggestion, 350);
        }
        updateProgress();
        saveDraft();
    });

    el.addEventListener("blur", function () {
        if (el.value.trim()) showFieldState(name);
    });
});

complaintForm.addEventListener("change", function (event) {
    if (event.target.name === "category") {
        showFieldState("category");
        $("suggest").classList.remove("show");
        updateProgress();
        saveDraft();
    }
});

// ----- Submit -----

complaintForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const names = ["name", "email", "category", "description"];
    let firstInvalid = null;

    names.forEach(function (name) {
        showFieldState(name);
        if (!fieldIsValid(name) && !firstInvalid) firstInvalid = name;
    });

    if (firstInvalid) {
        toast("Fix the highlighted fields and try again.", "error");
        const focusTarget = firstInvalid === "category"
            ? complaintForm.querySelector("input[name='category']")
            : $(firstInvalid);
        focusTarget.focus();
        return;
    }

    const payload = {
        name: fieldValue("name"),
        email: fieldValue("email"),
        category: fieldValue("category"),
        description: fieldValue("description")
    };

    const button = $("submitBtn");
    button.disabled = true;
    button.classList.add("loading");
    $("submitLabel").textContent = "Submitting…";

    try {

        const response = await fetch(API_BASE + "/complaints", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {

            $("newComplaintId").textContent = data.complaintId;

            addRecent(data.complaintId, payload.category);

            safeStorageRemove(DRAFT_KEY);
            complaintForm.reset();
            $("draftNote").textContent = "";
            $("suggest").classList.remove("show");
            updateCharCount();
            updateProgress();

            complaintForm.style.display = "none";
            successMessage.style.display = "block";

            confetti();
            loadStats();
            renderRecent();

        } else {

            toast(data.message || "Something went wrong. Try again.", "error");

        }

    } catch (error) {

        console.error("Error:", error);

        toast("Can't reach the server. Check your connection and try again.", "error");

    } finally {

        button.disabled = false;
        button.classList.remove("loading");
        $("submitLabel").textContent = "Submit complaint";

    }

});

// Called by the "Submit another" button
function closeMessage() {
    successMessage.style.display = "none";
    complaintForm.style.display = "block";
    $("name").focus();
}

$("copyIdBtn").addEventListener("click", async function () {
    const id = $("newComplaintId").textContent;
    try {
        await navigator.clipboard.writeText(id);
        toast("Copied " + id, "success");
    } catch (e) {
        toast("Couldn't copy. Select the ID and copy it manually.", "error");
    }
});

$("trackNewBtn").addEventListener("click", function () {
    const id = $("newComplaintId").textContent;
    $("trackId").value = id;
    $("track").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth" });
    trackComplaint(id);
});


// ===============================
// RECENT COMPLAINTS (stored on this device)
// ===============================

const RECENT_KEY = "recentComplaints";

function readRecent() {
    try {
        const list = JSON.parse(safeStorageGet(RECENT_KEY) || "[]");
        return Array.isArray(list) ? list : [];
    } catch (e) {
        return [];
    }
}

function addRecent(id, category) {
    const list = readRecent().filter(function (item) { return item.id !== id; });
    list.unshift({ id: id, category: category, ts: Date.now() });
    safeStorageSet(RECENT_KEY, JSON.stringify(list.slice(0, 8)));
}

async function fetchComplaint(id) {
    const response = await fetch(API_BASE + "/complaints/" + encodeURIComponent(id));
    return response.json();
}

async function renderRecent() {
    const list = readRecent().slice(0, 5);
    const ul = $("recentList");

    $("recentEmpty").style.display = list.length ? "none" : "block";

    ul.innerHTML = list.map(function (item) {
        return '<li><button type="button" data-id="' + escapeHtml(item.id) + '">' +
            "<span><strong>" + escapeHtml(item.id) + "</strong>" +
            "<small>" + escapeHtml(item.category) + " · " + escapeHtml(timeAgo(item.ts)) + "</small></span>" +
            '<span class="status pending" data-status-for="' + escapeHtml(item.id) + '" hidden></span>' +
            "</button></li>";
    }).join("");

    // Fill in the live status of each one
    list.forEach(async function (item) {
        try {
            const data = await fetchComplaint(item.id);
            if (!data.success) return;

            const pill = ul.querySelector('[data-status-for="' + item.id + '"]');
            if (!pill) return;

            pill.className = "status " + statusClass(data.complaint.status);
            pill.textContent = data.complaint.status;
            pill.hidden = false;
        } catch (e) { /* offline: leave the pill hidden */ }
    });
}

$("recentList").addEventListener("click", function (event) {
    const button = event.target.closest("button[data-id]");
    if (!button) return;

    $("trackId").value = button.dataset.id;
    $("track").scrollIntoView({ behavior: REDUCED_MOTION ? "auto" : "smooth" });
    trackComplaint(button.dataset.id);
});

setInterval(function () { if (!document.hidden) renderRecent(); }, 45000);


// ===============================
// TRACK COMPLAINT
// ===============================

const trackForm = $("trackForm");
const trackResult = $("trackResult");

let trackedId = null;
let trackedStatus = null;
let trackTimer = null;

function timelineHtml(status) {
    const index = STATUS_ORDER[status] == null ? 0 : STATUS_ORDER[status];
    const labels = ["Pending", "In Progress", "Resolved"];
    const check = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';

    return labels.map(function (label, i) {
        let cls = "";
        if (i < index || (i === index && index === 2)) cls = "done";
        else if (i === index) cls = "current";
        return '<div class="tl-step ' + cls + '"><div class="tl-dot">' + check + "</div>" + label + "</div>";
    }).join("");
}

function renderTrack(complaint) {
    const status = complaint.status;
    const index = STATUS_ORDER[status] == null ? 0 : STATUS_ORDER[status];
    const submitted = new Date(complaint.created_at);
    const resolved = status === "Resolved";

    trackResult.style.display = "block";
    trackResult.innerHTML = `
        <div class="complaint-result">

            <div class="result-head">
                <h3>${escapeHtml(complaint.complaint_id)}</h3>
                <span class="status ${statusClass(status)}">${escapeHtml(status)}</span>
            </div>

            <div class="timeline" id="timeline" style="--tl-color:${STATUS_COLOR[status] || STATUS_COLOR.Pending};--fill:0">
                ${timelineHtml(status)}
            </div>

            <div class="result-grid">
                <div><small>Category</small><p>${escapeHtml(complaint.category)}</p></div>
                <div><small>Description</small><p>${escapeHtml(complaint.description)}</p></div>
                <div><small>Submitted</small><p>${escapeHtml(submitted.toLocaleString())} (${escapeHtml(timeAgo(complaint.created_at))})</p></div>
            </div>

            <p class="${resolved ? "" : "live-dot"}" id="liveNote">${resolved ? "This complaint is resolved." : "Checking for updates every 20 seconds."}</p>

        </div>
    `;

    // Let the browser paint the empty bar first, then animate it to the right length
    requestAnimationFrame(function () {
        requestAnimationFrame(function () {
            const tl = $("timeline");
            if (tl) tl.style.setProperty("--fill", String(index / 2));
        });
    });
}

async function trackComplaint(rawId, silent) {
    const complaintId = String(rawId || "").trim().toUpperCase();
    if (!complaintId) return;

    const button = $("trackBtn");

    if (!silent) {
        trackResult.style.display = "block";
        trackResult.innerHTML = '<p class="recent-empty">Searching…</p>';
        button.disabled = true;
        button.classList.add("loading");
        stopPolling();
    }

    try {

        const data = await fetchComplaint(complaintId);

        if (data.success) {

            const complaint = data.complaint;
            const changed = trackedId === complaint.complaint_id && trackedStatus !== complaint.status;

            if (!silent || changed) renderTrack(complaint);

            if (silent && changed) {
                toast(complaint.complaint_id + " is now " + complaint.status + ".", "success");
                renderRecent();
                loadStats();
            }

            trackedId = complaint.complaint_id;
            trackedStatus = complaint.status;

            if (complaint.status === "Resolved") {
                stopPolling();
            } else if (!trackTimer) {
                startPolling();
            }

        } else if (!silent) {

            trackedId = null;
            trackedStatus = null;
            trackResult.innerHTML =
                '<p class="recent-empty">' + escapeHtml(data.message || "Complaint not found.") +
                " Check the ID and try again.</p>";

        }

    } catch (error) {

        console.error("Error:", error);

        if (!silent) {
            trackResult.innerHTML = '<p class="recent-empty">Can\'t reach the server. Check your connection and try again.</p>';
        }

    } finally {

        if (!silent) {
            button.disabled = false;
            button.classList.remove("loading");
        }

    }
}

function startPolling() {
    trackTimer = setInterval(function () {
        if (!document.hidden && trackedId) trackComplaint(trackedId, true);
    }, 20000);
}

function stopPolling() {
    clearInterval(trackTimer);
    trackTimer = null;
}

trackForm.addEventListener("submit", function (event) {
    event.preventDefault();
    trackComplaint($("trackId").value);
});


// ===============================
// START UP
// ===============================

restoreDraft();
updateCharCount();
updateProgress();
renderRecent();

(function openFromLink() {
    const id = new URLSearchParams(location.search).get("id");
    if (!id) return;

    $("trackId").value = id;
    $("track").scrollIntoView();
    trackComplaint(id);
})();
