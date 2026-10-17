// ===============================
// SHARED HELPERS (used by every page)
// ===============================

// Works whether you open the page via http://localhost:3000 or by double-clicking the file
const API_BASE = location.port === "3000" ? "" : "https://smart-complaint-management-system-fmnj.onrender.com";

const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Prevents user-entered text from being run as HTML (XSS)
function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function statusClass(status) {
    if (status === "In Progress") return "progress";
    if (status === "Resolved") return "resolved";
    return "pending";
}

// "5 minutes ago" style time
function timeAgo(value) {
    const then = new Date(value).getTime();
    if (isNaN(then)) return "";
    const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 45) return "just now";
    const units = [["day", 86400], ["hour", 3600], ["minute", 60]];
    for (const [name, size] of units) {
        if (seconds >= size) {
            const n = Math.round(seconds / size);
            return n + " " + name + (n === 1 ? "" : "s") + " ago";
        }
    }
    return "just now";
}


// ===============================
// THEME (dark / light, remembered)
// ===============================

function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
        btn.setAttribute("aria-label", theme === "light" ? "Switch to dark theme" : "Switch to light theme");
    });
    window.dispatchEvent(new CustomEvent("themechange", { detail: theme }));
}

(function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem("theme"); } catch (e) { /* storage blocked */ }
    applyTheme(saved || document.documentElement.getAttribute("data-theme") || "dark");

    document.addEventListener("click", function (event) {
        if (!event.target.closest("[data-theme-toggle]")) return;
        const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
        try { localStorage.setItem("theme", next); } catch (e) { /* ignore */ }
        applyTheme(next);
    });
})();


// ===============================
// TOASTS
// ===============================

function toast(message, type) {
    let stack = document.getElementById("toastStack");
    if (!stack) {
        stack = document.createElement("div");
        stack.id = "toastStack";
        stack.className = "toast-stack";
        stack.setAttribute("role", "status");
        stack.setAttribute("aria-live", "polite");
        document.body.appendChild(stack);
    }

    const el = document.createElement("div");
    el.className = "toast " + (type || "info");
    el.textContent = message;
    stack.appendChild(el);

    requestAnimationFrame(function () { el.classList.add("show"); });

    setTimeout(function () {
        el.classList.remove("show");
        setTimeout(function () { el.remove(); }, 300);
    }, 3800);
}


// ===============================
// ANIMATED COUNTERS
// ===============================

function countUp(el, to, options) {
    if (!el) return;
    const opts = options || {};
    const suffix = opts.suffix || "";
    const duration = REDUCED_MOTION ? 0 : (opts.duration || 1100);
    const from = Number(el.dataset.value || 0);

    el.dataset.value = String(to);

    if (!duration || from === to) {
        el.textContent = to + suffix;
        return;
    }

    const start = performance.now();

    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from + (to - from) * eased) + suffix;
        if (t < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}


// ===============================
// SCROLL PROGRESS BAR
// ===============================

(function initScrollProgress() {
    const bar = document.getElementById("scrollBar");
    if (!bar) return;

    function update() {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        bar.style.width = pct + "%";
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
})();


// ===============================
// CONFETTI (success moments)
// ===============================

function confetti() {
    if (REDUCED_MOTION) return;

    const canvas = document.createElement("canvas");
    canvas.className = "confetti-canvas";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const colors = ["#4C7DFF", "#34D3A5", "#FFB84D", "#FF6B5E", "#FFFFFF"];
    const pieces = [];

    for (let i = 0; i < 140; i++) {
        pieces.push({
            x: canvas.width / 2 + (Math.random() - 0.5) * 160,
            y: canvas.height * 0.62,
            vx: (Math.random() - 0.5) * 16,
            vy: -Math.random() * 15 - 4,
            size: 5 + Math.random() * 6,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.4,
            color: colors[i % colors.length]
        });
    }

    const startTime = performance.now();

    function frame(now) {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        pieces.forEach(function (p) {
            p.vy += 0.38;
            p.vx *= 0.99;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;

            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - elapsed / 2600);
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            ctx.restore();
        });

        if (elapsed < 2600) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    }

    requestAnimationFrame(frame);
}


// ===============================
// ANIMATED BACKDROP (drifting dots that link up near the cursor)
// ===============================

function startBackdrop(canvas) {
    if (!canvas || REDUCED_MOTION) return;

    const ctx = canvas.getContext("2d");
    const mouse = { x: -9999, y: -9999 };
    let dots = [];
    let width = 0;
    let height = 0;
    let running = true;

    function colorVar(name, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }

    let dotColor = colorVar("--brand-rgb", "76,125,255");

    function resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        width = canvas.clientWidth;
        height = canvas.clientHeight;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

        const count = Math.min(90, Math.round((width * height) / 16000));
        dots = [];
        for (let i = 0; i < count; i++) {
            dots.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35
            });
        }
    }

    function frame() {
        if (!running) return;
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < dots.length; i++) {
            const d = dots[i];
            d.x += d.vx;
            d.y += d.vy;
            if (d.x < 0 || d.x > width) d.vx *= -1;
            if (d.y < 0 || d.y > height) d.vy *= -1;

            ctx.fillStyle = "rgba(" + dotColor + ",0.55)";
            ctx.beginPath();
            ctx.arc(d.x, d.y, 1.6, 0, Math.PI * 2);
            ctx.fill();

            const mdx = d.x - mouse.x;
            const mdy = d.y - mouse.y;
            const md = Math.sqrt(mdx * mdx + mdy * mdy);
            if (md < 170) {
                ctx.strokeStyle = "rgba(" + dotColor + "," + (1 - md / 170) * 0.7 + ")";
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(mouse.x, mouse.y);
                ctx.stroke();
            }

            for (let j = i + 1; j < dots.length; j++) {
                const o = dots[j];
                const dx = d.x - o.x;
                const dy = d.y - o.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 110) {
                    ctx.strokeStyle = "rgba(" + dotColor + "," + (1 - dist / 110) * 0.25 + ")";
                    ctx.beginPath();
                    ctx.moveTo(d.x, d.y);
                    ctx.lineTo(o.x, o.y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", function (e) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
    }, { passive: true });
    window.addEventListener("themechange", function () {
        dotColor = colorVar("--brand-rgb", "76,125,255");
    });

    // Pause when the tab is hidden to save battery
    document.addEventListener("visibilitychange", function () {
        running = !document.hidden;
        if (running) requestAnimationFrame(frame);
    });

    resize();
    requestAnimationFrame(frame);
}
