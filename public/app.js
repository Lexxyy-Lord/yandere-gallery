// Waifu Gallery - app.js (final, simplified download flow)

const API_PROXY = "/api/proxy"; 
const MAX_PAGES_GUESS = 26764;

// state
let page = 1;
let currentTags = "";
let galleryData = [];
let cachedPages = {};
let currentIndex = 0;
let nsfwAllowed = false;

// dom
const siteTitle = document.getElementById("siteTitle");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const nsfwCheckbox = document.getElementById("nsfwCheckbox");
const toggleMode = document.getElementById("toggleMode");
const galleryEl = document.getElementById("gallery");
const paginationEl = document.getElementById("pagination");
const messageEl = document.getElementById("message");
const tagDatalist = document.getElementById("tagSuggestions");

// popup
const popup = document.getElementById("popup");
const popupBackdrop = document.getElementById("popupBackdrop");
const popupImage = document.getElementById("popupImage");
const popupTags = document.getElementById("popupTags");
const popupRating = document.getElementById("popupRating");
const closePopup = document.getElementById("closePopup");
const downloadBtn = document.getElementById("downloadBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// ---------- Utilities ----------
const showMessage = (text, timeout = 4000) => {
  messageEl.textContent = text;
  messageEl.classList.remove("hidden");
  if (timeout) setTimeout(()=>messageEl.classList.add("hidden"), timeout);
};

const setLoading = (on) => {
  if (on) galleryEl.style.filter = "grayscale(30%) blur(1px)";
  else galleryEl.style.filter = "";
};

const safeJSON = async (res) => {
  try { return await res.json(); } catch(e){ return null; }
};

// persist NSFW choice
nsfwAllowed = localStorage.getItem("waifu_nsfw") === "true";
nsfwCheckbox.checked = nsfwAllowed;

// theme persisted
if (localStorage.getItem("waifu_theme") === "light") document.body.classList.add("light");
toggleMode.textContent = document.body.classList.contains("light") ? "Dark" : "Light";

// title click reload
siteTitle.addEventListener("click", () => { location.reload(); });

// ---------- Fetch helpers ----------
async function fetchPage(tags="", pageNum=1) {
  const cacheKey = `${tags}|${pageNum}`;
  if (cachedPages[cacheKey]) return cachedPages[cacheKey];

  const url = `${API_PROXY}?tags=${encodeURIComponent(tags)}&page=${pageNum}`;
  try {
    setLoading(true);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await safeJSON(res) || [];
    cachedPages[cacheKey] = data;
    setLoading(false);
    return data;
  } catch (err) {
    setLoading(false);
    console.error("fetchPage error", err);
    showMessage("Failed to load data.", 6000);
    return [];
  }
}

// ---------- Tag suggestions ----------
async function loadTagSuggestions() {
  try {
    const res = await fetch("/tags.json");
    if (!res.ok) return;
    const tags = await res.json();
    if (!Array.isArray(tags)) return;
    tagDatalist.innerHTML = "";
    tags.forEach(tag => {
      const option = document.createElement("option");
      option.value = tag;
      tagDatalist.appendChild(option);
    });
  } catch {}
}

// ---------- Render gallery ----------
function clearGallery() {
  galleryEl.innerHTML = "";
  galleryData = [];
}

function applyNSFWFilter(posts) {
  return nsfwAllowed ? posts : posts.filter(p => p.rating !== "e");
}

function mapRatingText(r) {
  if (r === "s") return "SFW";
  if (r === "q") return "Q";
  if (r === "e") return "NSFW";
  return r || "";
}

function renderGallery(posts) {
  clearGallery();
  const filtered = applyNSFWFilter(posts);
  if (!filtered.length) {
    showMessage(`No results${currentTags ? ` for "${currentTags}"` : ""}`, 6000);
    return;
  }
  galleryData = filtered;
  filtered.forEach(post => {
    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.src = post.preview_url; // always preview for speed
    img.loading = "lazy";
    img.alt = post.tags || `post-${post.id}`;
    card.appendChild(img);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = mapRatingText(post.rating);
    card.appendChild(badge);

    img.addEventListener("click", () => {
      currentIndex = filtered.indexOf(post);
      openPopupForIndex(currentIndex);
    });

    galleryEl.appendChild(card);
  });
}

// ---------- Pagination ----------
function renderPagination(currentPage, largeTotal=MAX_PAGES_GUESS) {
  paginationEl.innerHTML = "";
  const createBtn = (label, cls, onClick) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (cls) b.classList.add(cls);
    b.addEventListener("click", onClick);
    return b;
  };

  const prev = createBtn("← Previous", null, () => {
    if (page > 1) { page--; loadPage(currentTags, page); window.scrollTo({top:0,behavior:'smooth'}); }
  });
  prev.disabled = page === 1;
  paginationEl.appendChild(prev);

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize/2));
  let end = start + windowSize - 1;
  if (end > largeTotal) { end = largeTotal; start = Math.max(1, end - windowSize + 1); }

  if (start > 1) {
    paginationEl.appendChild(createBtn("1", null, ()=>{ page=1; loadPage(currentTags,1)}));
    if (start > 2) paginationEl.appendChild(document.createTextNode(" … "));
  }

  for (let i = start; i <= end; i++) {
    const b = createBtn(String(i), i===page ? "active" : null, ()=>{ page=i; loadPage(currentTags,page); window.scrollTo({top:0,behavior:'smooth'}); });
    paginationEl.appendChild(b);
  }

  if (end < largeTotal) {
    if (end < largeTotal -1) paginationEl.appendChild(document.createTextNode(" … "));
    paginationEl.appendChild(createBtn(String(largeTotal), null, ()=>{ page=largeTotal; loadPage(currentTags,page); window.scrollTo({top:0,behavior:'smooth'}); }));
  }

  const next = createBtn("Next →", null, () => {
    page++; loadPage(currentTags,page); window.scrollTo({top:0,behavior:'smooth'});
  });
  paginationEl.appendChild(next);
}

// ---------- Popup ----------
function openPopupForIndex(idx) {
  const post = galleryData[idx];
  if (!post) return;

  const previewSrc = post.sample_url || post.jpeg_url || post.file_url || post.preview_url;
  popupImage.src = previewSrc;
  popupTags.textContent = "Tags: " + (post.tags || "");
  popupRating.textContent = "Rating: " + mapRatingText(post.rating);
  popup.classList.remove("hidden");
  document.body.classList.add("modal-open");

  // Direct download flow
  downloadBtn.textContent = "DOWNLOAD HD";
  downloadBtn.onclick = () => {
    const hd = post.file_url || post.jpeg_url || post.sample_url;
    if (!hd) {
      showMessage("No downloadable file found.", 4000);
      return;
    }
    const a = document.createElement("a");
    a.href = hd;
    a.setAttribute("download", `waifu_${post.id || Date.now()}.jpg`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
}

// popup nav
prevBtn.onclick = () => { if (currentIndex > 0) openPopupForIndex(--currentIndex); };
nextBtn.onclick = () => { if (currentIndex < galleryData.length - 1) openPopupForIndex(++currentIndex); };
closePopup.onclick = () => { popup.classList.add("hidden"); document.body.classList.remove("modal-open"); };
popupBackdrop.addEventListener("click", ()=>{ closePopup.click(); });

document.addEventListener("keydown", (ev) => {
  if (popup.classList.contains("hidden")) return;
  if (ev.key === "ArrowLeft") prevBtn.click();
  if (ev.key === "ArrowRight") nextBtn.click();
  if (ev.key === "Escape") closePopup.click();
});

// ---------- Main ----------
async function loadPage(tags="", pageNum=1) {
  messageEl.classList.add("hidden");
  const posts = await fetchPage(tags, pageNum);
  renderGallery(posts);
  renderPagination(pageNum);
}

// UI events
searchBtn.addEventListener("click", () => {
  currentTags = (searchInput.value || "").trim();
  page = 1;
  loadPage(currentTags, page);
});
nsfwCheckbox.addEventListener("change", () => {
  nsfwAllowed = nsfwCheckbox.checked;
  localStorage.setItem("waifu_nsfw", nsfwAllowed ? "true" : "false");
  loadPage(currentTags, page);
});
toggleMode.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem("waifu_theme", isLight ? "light" : "dark");
  toggleMode.textContent = isLight ? "Dark" : "Light";
});

// init
(async function init(){
  currentTags = "";
  page = 1;
  loadTagSuggestions();
  await loadPage(currentTags, page);
})();
