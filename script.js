// ===============================
// SETTINGS + HELPERS
// ===============================

// Works whether you open the page via https://smart-complaint-management-system-fmnj.onrender.com/ or by double-clicking the file
const API_BASE = location.port === "3000" ? "" : "https://smart-complaint-management-system-fmnj.onrender.com/";

// Prevents user-entered text from being run as HTML (XSS)
function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ===============================
// SUBMIT COMPLAINT
// ===============================

const complaintForm = document.getElementById("complaintForm");
const successMessage = document.getElementById("successMessage");

if (complaintForm) {

    complaintForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const submitButton = complaintForm.querySelector("button[type='submit']");

        const payload = {
            name: document.getElementById("name").value.trim(),
            email: document.getElementById("email").value.trim(),
            category: document.getElementById("category").value,
            description: document.getElementById("description").value.trim()
        };

        submitButton.disabled = true;

        try {

            const response = await fetch(API_BASE + "/complaints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {

                document.getElementById("complaintIdText").innerHTML =
                    "Your Complaint ID is: <strong>" +
                    escapeHtml(data.complaintId) +
                    "</strong><br>Save it to track your complaint.";

                complaintForm.reset();
                complaintForm.style.display = "none";
                successMessage.style.display = "block";

            } else {

                alert(data.message || "Something went wrong.");

            }

        } catch (error) {

            console.error("Error:", error);

            alert("Unable to connect to the server.");

        } finally {

            submitButton.disabled = false;

        }

    });
}

// Called by the "Submit Another Complaint" button
function closeMessage() {
    successMessage.style.display = "none";
    complaintForm.style.display = "block";
}


// ===============================
// TRACK COMPLAINT
// ===============================

const trackForm = document.getElementById("trackForm");

if (trackForm) {

    trackForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const complaintId =
            document.getElementById("trackId").value.trim();

        const result = document.getElementById("trackResult");

        if (!complaintId) {
            return;
        }

        result.style.display = "block";
        result.innerHTML = "<p>Searching...</p>";

        try {

            const response = await fetch(
                API_BASE + "/complaints/" + encodeURIComponent(complaintId)
            );

            const data = await response.json();

            if (data.success) {

                const complaint = data.complaint;

                let statusClass = "pending";
                if (complaint.status === "In Progress") statusClass = "progress";
                if (complaint.status === "Resolved") statusClass = "resolved";

                const submitted = new Date(complaint.created_at).toLocaleString();

                result.innerHTML = `
                    <div class="complaint-result">

                        <h3>Complaint Details</h3>

                        <p><strong>Complaint ID:</strong> ${escapeHtml(complaint.complaint_id)}</p>

                        <p><strong>Category:</strong> ${escapeHtml(complaint.category)}</p>

                        <p><strong>Description:</strong> ${escapeHtml(complaint.description)}</p>

                        <p><strong>Status:</strong>
                            <span class="status ${statusClass}">${escapeHtml(complaint.status)}</span>
                        </p>

                        <p><strong>Submitted:</strong> ${escapeHtml(submitted)}</p>

                    </div>
                `;

            } else {

                result.innerHTML =
                    "<p>" + escapeHtml(data.message || "Complaint not found.") + "</p>";

            }

        } catch (error) {

            console.error("Error:", error);

            result.innerHTML = "<p>Unable to connect to the server.</p>";

        }

    });
}
