// Waifu Gallery - app.js (final)

// Features: fetch via /api/proxy, pagination, popup, prev/next, ads-first download flow,
// NSFW switch, keyboard nav, localStorage cache.

const API_PROXY = "/api/proxy"; // Vercel function endpoint
const DIRECT_AD_URL = "https://www.revenuecpmgate.com/yi59046hjd?key=38c26dc552e10ee4babe41f597d26a40";
const MAX_PAGES_GUESS = 26764; // fallback total pages

// state
let page = 1;
let currentTags = "";
let galleryData = [];
let cachedPages = {};
let currentIndex = 0;
let adClicked = false;
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
  if (timeout) setTimeout(() => messageEl.classList.add("hidden"), timeout);
};

const setLoading = (on) => {
  galleryEl.style.filter = on ? "grayscale(30%) blur(1px)" : "";
};

const safeJSON = async (res) => {
  try {
    return await res.json();
  } catch (e) {
    return null;
  }
};

// persist NSFW choice
nsfwAllowed = localStorage.getItem("waifu_nsfw") === "true";
nsfwCheckbox.checked = nsfwAllowed;

// theme persisted
if (localStorage.getItem("waifu_theme") === "light") {
  document.body.classList.add("light");
}
toggleMode.textContent = document.body.classList.contains("light") ? "Dark" : "Light";

// title click reload
siteTitle.addEventListener("click", () => {
  location.reload();
});

// ---------- Fetch helpers ----------
async function fetchPage(tags = "", pageNum = 1, useCacheFirst = true) {
  const cacheKey = `${tags}|${pageNum}`;
  if (useCacheFirst && cachedPages[cacheKey]) {
    return cachedPages[cacheKey];
  }

  const localDbKey = `waifu_db_${tags || "default"}`;
  const localDbJSON = localStorage.getItem(localDbKey);
  if (useCacheFirst && localDbJSON) {
    try {
      const local = JSON.parse(localDbJSON);
      if (local[pageNum]) {
        cachedPages[cacheKey] = local[pageNum];
        return local[pageNum];
      }
    } catch (e) {}
  }

  const url = `${API_PROXY}?tags=${encodeURIComponent(tags)}&page=${pageNum}`;

  try {
    setLoading(true);
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server error ${res.status}: ${txt}`);
    }
    const data = (await safeJSON(res)) || [];
    cachedPages[cacheKey] = data;
    setLoading(false);
    return data;
  } catch (err) {
    setLoading(false);
    console.error("fetchPage error", err);
    showMessage("Failed to load data. Try again or check your connection.", 6000);
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
    if (!tagDatalist) return;
    tagDatalist.innerHTML = "";
    tags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      tagDatalist.appendChild(option);
    });
  } catch (e) {}
}

// bulk cache
async function bulkCacheInit(tags = "", pages = 3) {
  try {
    const url = `${API_PROXY}?cache=1&pages=${pages}&tags=${encodeURIComponent(tags)}`;
    const res = await fetch(url);
    const data = (await safeJSON(res)) || {};
    const localDbKey = `waifu_db_${tags || "default"}`;
    localStorage.setItem(localDbKey, JSON.stringify(data.pages || {}));
    Object.keys(data.pages || {}).forEach((p) => {
      cachedPages[`${tags}|${p}`] = data.pages[p];
    });
    return true;
  } catch (e) {
    console.warn("bulkCacheInit failed", e);
    return false;
  }
}

// ---------- Render gallery ----------
function clearGallery() {
  galleryEl.innerHTML = "";
  galleryData = [];
}

function applyNSFWFilter(posts) {
  if (nsfwAllowed) return posts;
  return posts.filter((p) => p.rating !== "e");
}

function renderGallery(posts) {
  clearGallery();
  const filtered = applyNSFWFilter(posts || []);
  if (!filtered.length) {
    showMessage(`No results${currentTags ? ` for "${currentTags}"` : ""}`, 6000);
    return;
  }

  filtered.forEach((post) => {
    const card = document.createElement("div");
    card.className = "card";
    const img = document.createElement("img");
    img.src = post.preview_url || post.sample_url || post.file_url || deriveFallback(post);
    img.loading = "lazy";
    img.alt = post.tags || `post-${post.id}`;
    card.appendChild(img);

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = mapRatingText(post.rating);
    card.appendChild(badge);

    img.addEventListener("click", () => {
      galleryData = filtered;
      currentIndex = filtered.indexOf(post);
      adClicked = false;
      openPopupForIndex(currentIndex);
    });

    galleryEl.appendChild(card);
  });
}

// ---------- Pagination ----------
function renderPagination(currentPage, largeTotal = MAX_PAGES_GUESS) {
  paginationEl.innerHTML = "";

  const createBtn = (label, cls, onClick) => {
    const b = document.createElement("button");
    b.textContent = label;
    if (cls) b.classList.add(cls);
    b.addEventListener("click", onClick);
    return b;
  };

  const prev = createBtn("← Previous", null, () => {
    if (page > 1) {
      page--;
      loadPage(currentTags, page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
  prev.disabled = page === 1;
  paginationEl.appendChild(prev);

  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  let end = start + windowSize - 1;
  if (end > largeTotal) {
    end = largeTotal;
    start = Math.max(1, end - windowSize + 1);
  }

  if (start > 1) {
    paginationEl.appendChild(createBtn("1", null, () => {
      page = 1;
      loadPage(currentTags, 1);
    }));
    if (start > 2) {
      const ell = document.createElement("span");
      ell.textContent = " … ";
      ell.style.color = "var(--muted)";
      paginationEl.appendChild(ell);
    }
  }

  for (let i = start; i <= end; i++) {
    const isActive = i === page;
    const b = createBtn(String(i), isActive ? "active" : null, () => {
      page = i;
      loadPage(currentTags, page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    if (isActive) b.classList.add("active");
    paginationEl.appendChild(b);
  }

  if (end < largeTotal) {
    if (end < largeTotal - 1) {
      const ell = document.createElement("span");
      ell.textContent = " … ";
      ell.style.color = "var(--muted)";
      paginationEl.appendChild(ell);
    }
    paginationEl.appendChild(createBtn(String(largeTotal), null, () => {
      page = largeTotal;
      loadPage(currentTags, page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
  }

  const next = createBtn("Next →", null, () => {
    page++;
    loadPage(currentTags, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  paginationEl.appendChild(next);
}

// ---------- Popup behavior ----------
function mapRatingText(r) {
  if (!r) return "";
  if (r === "s") return "SFW";
  if (r === "q") return "Q";
  if (r === "e") return "NSFW";
  return r.toUpperCase();
}

function deriveFallback(post) {
  if (post.sample_url) {
    return post.sample_url.replace("/sample/", "/image/");
  }
  if (post.file_url) return post.file_url;
  if (post.preview_url) {
    return post.preview_url.replace("/preview/", "/image/").replace("/preview/", "/jpeg/");
  }
  return "";
}

function openPopupForIndex(idx) {
  const post = galleryData[idx];
  if (!post) return;

  const previewSrc = post.sample_url || post.jpeg_url || post.preview_url || deriveFallback(post);
  popupImage.src = previewSrc;
  popupImage.loading = "eager";
  popupTags.textContent = "Tags: " + (post.tags || "");
  popupRating.textContent = "Rating: " + mapRatingText(post.rating);
  popup.classList.remove("hidden");
  document.body.classList.add("modal-open");

  adClicked = false;
  downloadBtn.textContent = "Download (Ad → HD)";
  downloadBtn.onclick = () => {
    if (!adClicked) {
      window.open(DIRECT_AD_URL, "_blank");
      adClicked = true;
      downloadBtn.textContent = "Click again for HD";
    } else {
      const hd = post.file_url || post.jpeg_url || post.sample_url || deriveFallback(post);
      if (!hd) {
        showMessage("No downloadable file found for this post.", 4000);
        return;
      }
      window.open(hd, "_blank"); // buka langsung files.yande.re/jpeg atau /image
      adClicked = false;
      downloadBtn.textContent = "Download (Ad → HD)";
    }
  };
}

// popup nav
prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    openPopupForIndex(currentIndex);
  }
};
nextBtn.onclick = () => {
  if (currentIndex < galleryData.length - 1) {
    currentIndex++;
    openPopupForIndex(currentIndex);
  }
};
closePopup.onclick = () => {
  popup.classList.add("hidden");
  document.body.classList.remove("modal-open");
};
popupBackdrop.addEventListener("click", () => {
  popup.classList.add("hidden");
  document.body.classList.remove("modal-open");
});
document.addEventListener("keydown", (ev) => {
  if (popup.classList.contains("hidden")) return;
  if (ev.key === "ArrowLeft") prevBtn.click();
  if (ev.key === "ArrowRight") nextBtn.click();
  if (ev.key === "Escape") closePopup.click();
});

// ---------- Main loader ----------
async function loadPage(tags = "", pageNum = 1) {
  messageEl.classList.add("hidden");
  if (!tags && pageNum === 1) {
    await bulkCacheInit("", 3).catch(() => {});
  }

  const posts = await fetchPage(tags, pageNum, true);
  if (!Array.isArray(posts) || posts.length === 0) {
    renderGallery([]);
    renderPagination(pageNum);
    return;
  }

  renderGallery(posts);
  renderPagination(pageNum);
}

// ---------- UI events ----------
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
(async function init() {
  currentTags = "";
  page = 1;
  loadTagSuggestions();
  await loadPage(currentTags, page);
})();
