let currentUser = JSON.parse(localStorage.getItem("signAppUser")) || null;
let uploadedImage = null;
let isDrawing = false;

const canvas = document.getElementById("signCanvas");
const ctx = canvas.getContext("2d");

// Toast Notification
function showToast(msg) {
  const t = document.getElementById("toast");
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 3000);
}

// Auto Login Check
window.onload = () => {
  if (currentUser) openMainApp();
};

function openMainApp() {
  document.getElementById("authSection").classList.remove("active");
  document.getElementById("appSection").classList.add("active");
  document.getElementById("drawerUserName").innerText = currentUser.name;
  document.getElementById("drawerUserEmail").innerText = currentUser.email;
  document.getElementById("userAvatar").innerText =
    currentUser.name[0].toUpperCase();
}

function logout() {
  localStorage.removeItem("signAppUser");
  location.reload();
}

// Auth Tabs
function switchAuthTab(tab) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".auth-form")
    .forEach((f) => f.classList.remove("active"));
  event.target.classList.add("active");
  document.getElementById(tab + "Form").classList.add("active");
}

// Google Login Decode & POST API
window.handleGoogleLogin = async (response) => {
  const payload = JSON.parse(atob(response.credential.split(".")[1]));
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email,
      name: payload.name,
      isGoogle: true,
    }),
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    localStorage.setItem("signAppUser", JSON.stringify(currentUser));
    openMainApp();
  }
};

// Send Gmail OTP (POST API + 30s Timer)
async function sendOtp(emailInputId, btn) {
  const email = document.getElementById(emailInputId).value;
  if (!email) return showToast("Pehle Gmail daalein!");

  btn.disabled = true;
  const res = await fetch("/api/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  showToast(data.message);

  let sec = 30;
  const timer = setInterval(() => {
    btn.innerText = `${sec}s`;
    sec--;
    if (sec < 0) {
      clearInterval(timer);
      btn.disabled = false;
      btn.innerText = "Send OTP";
    }
  }, 1000);
}

// Email Signup (POST API)
async function submitSignup(e) {
  e.preventDefault();
  const body = {
    name: document.getElementById("signName").value,
    email: document.getElementById("signEmail").value,
    otp: document.getElementById("signOtp").value,
    password: document.getElementById("signPass").value,
  };
  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    localStorage.setItem("signAppUser", JSON.stringify(currentUser));
    openMainApp();
  } else showToast(data.message);
}

// Email Login (POST API)
async function submitLogin(e) {
  e.preventDefault();
  const body = {
    email: document.getElementById("loginEmail").value,
    password: document.getElementById("loginPass").value,
  };
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.success) {
    currentUser = data.user;
    localStorage.setItem("signAppUser", JSON.stringify(currentUser));
    openMainApp();
  } else showToast(data.message);
}

// Reset Password (PUT API)
async function submitReset(e) {
  e.preventDefault();
  const body = {
    email: document.getElementById("forgotEmail").value,
    otp: document.getElementById("forgotOtp").value,
    newPassword: document.getElementById("forgotNewPass").value,
  };
  const res = await fetch("/api/reset-password", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  showToast(data.message);
  if (data.success) switchAuthTab("login");
}

// Hamburger Drawer & Views
function toggleDrawer(open) {
  document.getElementById("sideDrawer").classList.toggle("open", open);
  document.getElementById("drawerOverlay").classList.toggle("open", open);
}

function showView(viewId) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
}

// ================= GALLERY IMAGE UPLOAD & BLUE BALL-PEN =================
document.getElementById("imageInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      uploadedImage = img;
      // Resize image safely for fast MongoDB storage
      const maxWidth = 800;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      document.getElementById("placeholderText").style.display = "none";
      canvas.style.display = "block";
      showView("canvasView");
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

// Royal Blue Ball-Pen Style Setup
function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function startDraw(e) {
  if (!uploadedImage) return;
  isDrawing = true;
  const pos = getPos(e);
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  // Real Blue Ball-Pen Ink (#0033cc)
  ctx.strokeStyle = "#0033cc";
  ctx.lineWidth = Math.max(2.5, canvas.width / 220);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getPos(e);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function endDraw() {
  isDrawing = false;
}

// Touch (Mobile) & Mouse Events
canvas.addEventListener("touchstart", startDraw, { passive: false });
canvas.addEventListener("touchmove", draw, { passive: false });
canvas.addEventListener("touchend", endDraw);
canvas.addEventListener("mousedown", startDraw);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("mouseup", endDraw);

function clearSignature() {
  if (!uploadedImage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);
  showToast("Signature saaf ho gaya!");
}

// SAVE TO MONGODB (POST) & DOWNLOAD IN PHONE
async function saveAndDownload() {
  if (!uploadedImage) return showToast("Pehle gallery se image upload karein!");

  const finalImage = canvas.toDataURL("image/jpeg", 0.85);

  // 1. Download in Mobile
  const link = document.createElement("a");
  link.download = `Signed_${Date.now()}.jpg`;
  link.href = finalImage;
  link.click();

  // 2. Save in MongoDB via POST API
  const res = await fetch("/api/signatures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: currentUser.email,
      title: `Doc_${new Date().toLocaleDateString("en-IN")}`,
      imageData: finalImage,
    }),
  });
  const data = await res.json();
  if (data.success) showToast("✅ Image Download & MongoDB mein Save ho gayi!");
}

// LOAD SAVED SIGNATURES (GET API)
async function loadSignatures() {
  const listDiv = document.getElementById("historyList");
  listDiv.innerHTML = "<p>Loading...</p>";

  const res = await fetch(
    `/api/signatures?email=${encodeURIComponent(currentUser.email)}`
  );
  const data = await res.json();

  if (!data.signatures.length) {
    listDiv.innerHTML = "<p>Abhi koi saved signature nahi hai.</p>";
    return;
  }

  listDiv.innerHTML = data.signatures
    .map(
      (item) => `
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <div class="history-card">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          <strong>${item.title}</strong>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                <small>${item.createdAt}</small>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      <img src="${item.imageData}" />
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <div class="card-actions">
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <button class="btn-dl" onclick="downloadOld('${item.imageData}', '${item.title}')">⬇️ Download</button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            <button class="btn-edit" onclick="renameSignature('${item._id}', '${item.title}')">✏️ Rename</button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    <button class="btn-del" onclick="deleteSignature('${item._id}')">🗑️ Delete</button>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                `
    )
    .join("");
}
function downloadOld(dataUrl, title) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${title}.jpg`;
  a.click();
}

// RENAME SIGNATURE (PUT API)
async function renameSignature(id, oldTitle) {
  const newTitle = prompt("Naya naam likhein:", oldTitle);
  if (!newTitle) return;
  await fetch("/api/signatures", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, title: newTitle }),
  });
  showToast("Naam update ho gaya!");
  loadSignatures();
}

// DELETE FROM MONGODB (DELETE API)
async function deleteSignature(id) {
  if (!confirm("Kya aap isko MongoDB se permanently delete karna chahte hain?"))
    return;
  await fetch(`/api/signatures?id=${id}`, { method: "DELETE" });
  showToast("🗑️ MongoDB se delete ho gaya!");
  loadSignatures();
}
