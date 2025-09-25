// Waifu Gallery - app.js (final)
// Features: fetch via /api/proxy or /api/proxy?cache=1&pages=N, pagination, popup, prev/next, ads-first download flow, NSFW switch, keyboard nav, localStorage cache.

const API_PROXY = "/api/proxy"; // Vercel function endpoint
const DIRECT_AD_URL = "https://www.revenuecpmgate.com/yi59046hjd?key=38c26dc552e10ee4babe41f597d26a40";
const MAX_PAGES_GUESS = 26764; // used for pagination display fallback

// state
let page = 1;
let currentTags = ""; // empty => show main listing
let galleryData = []; // array of posts for current page
let cachedPages = {}; // local in-memory cache for pages {tag|page : [posts]}
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
  if (timeout) setTimeout(()=>messageEl.classList.add("hidden"), timeout);
};

const setLoading = (on) => {
  if (on) galleryEl.style.filter = "grayscale(30%) blur(1px)";
  else galleryEl.style.filter = "";
};

const safeJSON = async (res) => {
  try { return await res.json(); } catch(e){ return null; }
};

// pick the best direct file URL hosted on files.yande.re with image extension
function getDirectImageUrl(post) {
  const candidates = [post?.jpeg_url, post?.file_url, post?.sample_url, post?.preview_url];
  for (const url of candidates) {
    if (typeof url !== "string") continue;
    const isFilesHost = url.includes("files.yande.re");
    const isImageExt = /\.(jpe?g|png|gif|webp)(?:$|[?#])/i.test(url);
    if (isFilesHost && isImageExt) return url;
  }
  return "";
}

// persist NSFW choice
nsfwAllowed = localStorage.getItem("waifu_nsfw") === "true";
nsfwCheckbox.checked = nsfwAllowed;

// theme persisted
if (localStorage.getItem("waifu_theme") === "light") document.body.classList.add("light");
toggleMode.textContent = document.body.classList.contains("light") ? "Dark" : "Light";

// title click reload
siteTitle.addEventListener("click", () => { location.reload(); });

// ---------- Fetch helpers ----------
async function fetchPage(tags="", pageNum=1, useCacheFirst=true) {
  const cacheKey = `${tags}|${pageNum}`;
  if (useCacheFirst && cachedPages[cacheKey]) {
    return cachedPages[cacheKey];
  }

  // try localStorage cached DB
  const localDbKey = `waifu_db_${tags || "default"}`;
  const localDbJSON = localStorage.getItem(localDbKey);
  if (useCacheFirst && localDbJSON) {
    try {
      const local = JSON.parse(localDbJSON);
      if (local[pageNum]) {
        cachedPages[cacheKey] = local[pageNum];
        return local[pageNum];
      }
    } catch(e){}
  }

  // build url
  const url = `${API_PROXY}?tags=${encodeURIComponent(tags)}&page=${pageNum}`;

  try {
    setLoading(true);
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server error ${res.status}: ${txt}`);
    }
    const data = await safeJSON(res) || [];
    // store memory cache
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
    tags.forEach(tag => {
      const option = document.createElement("option");
      option.value = tag;
      tagDatalist.appendChild(option);
    });
  } catch (e) {
    // ignore silently
  }
}

// bulk cache (server-side combined cache): used to build initial local DB
async function bulkCacheInit(tags="", pages=3) {
  try {
    const url = `${API_PROXY}?cache=1&pages=${pages}&tags=${encodeURIComponent(tags)}`;
    const res = await fetch(url);
    const data = await safeJSON(res) || {};
    // data is { pages: {1:[..],2:[..],...} }
    const localDbKey = `waifu_db_${tags || "default"}`;
    localStorage.setItem(localDbKey, JSON.stringify(data.pages || {}));
    // prime in-memory cache
    Object.keys(data.pages || {}).forEach(p => {
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
  return posts.filter(p => p.rating !== "e");
}

function renderGallery(posts) {
  clearGallery();
  const filtered = applyNSFWFilter(posts || []);
  if (!filtered.length) {
    showMessage(`No results${currentTags ? ` for "${currentTags}"` : ""}`, 6000);
    return;
  }
  filtered.forEach((post, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const img = document.createElement("img");
    // preview fallback order: preview_url -> sample_url -> file_url -> derive
    img.src = getDirectImageUrl({ preview_url: post.preview_url, sample_url: post.sample_url, file_url: post.file_url, jpeg_url: post.jpeg_url }) || deriveFallback(post);
    img.loading = "lazy";
    img.alt = post.tags || `post-${post.id}`;
    card.appendChild(img);

    // badge for rating
    const badge = document.createElement("div");
    badge.className = "badge";
    badge.textContent = mapRatingText(post.rating);
    card.appendChild(badge);

    img.addEventListener("click", () => {
      // when user clicks, we should open preview using best available (preview)
      galleryData = filtered; // set list used by popup navigation
      currentIndex = filtered.indexOf(post);
      adClicked = false;
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

  // Prev
  const prev = createBtn("← Previous", null, () => {
    if (page > 1) {
      page--;
      loadPage(currentTags, page);
      window.scrollTo({top:0, behavior:'smooth'});
    }
  });
  prev.disabled = page === 1;
  paginationEl.appendChild(prev);

  // page numbers window: show around current page
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize/2));
  let end = start + windowSize - 1;
  if (end > largeTotal) { end = largeTotal; start = Math.max(1, end - windowSize + 1); }

  // if start > 1 show first + ellipsis
  if (start > 1) {
    paginationEl.appendChild(createBtn("1", null, ()=>{ page=1; loadPage(currentTags,1)}));
    if (start > 2) {
      const ell = document.createElement("span"); ell.textContent = " … "; ell.style.color = "var(--muted)"; paginationEl.appendChild(ell);
    }
  }

  for (let i = start; i <= end; i++) {
    const isActive = (i === page);
    const b = createBtn(String(i), isActive ? "active" : null, ()=>{ page = i; loadPage(currentTags,page); window.scrollTo({top:0,behavior:'smooth'}); });
    if (isActive) b.classList.add("active");
    paginationEl.appendChild(b);
  }

  // if end < last show ellipsis + last
  if (end < largeTotal) {
    if (end < largeTotal -1) {
      const ell = document.createElement("span"); ell.textContent = " … "; ell.style.color = "var(--muted)"; paginationEl.appendChild(ell);
    }
    paginationEl.appendChild(createBtn(String(largeTotal), null, ()=>{ page = largeTotal; loadPage(currentTags, page); window.scrollTo({top:0,behavior:'smooth'}); }));
  }

  // Next
  const next = createBtn("Next →", null, () => {
    page++;
    loadPage(currentTags, page);
    window.scrollTo({top:0,behavior:'smooth'});
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
  // Attempt to derive a likely image path from sample_url or id
  // If post has 'sample_url' we can replace '/sample/' -> '/image/' as fallback
  if (post.sample_url) {
    return post.sample_url.replace("/sample/", "/image/");
  }
  if (post.file_url) return post.file_url;
  // last resort: try sample path pattern
  if (post.preview_url) return post.preview_url.replace("/preview/", "/image/").replace("/preview/", "/jpeg/");
  return "";
}

function openPopupForIndex(idx) {
  const post = galleryData[idx];
  if (!post) return;
  // preview image show (prefer preview or sample)
  const previewSrc = getDirectImageUrl({ preview_url: post.preview_url, sample_url: post.sample_url }) || deriveFallback(post);
  popupImage.src = previewSrc;
  popupImage.loading = "eager";
  popupTags.textContent = "Tags: " + (post.tags || "");
  popupRating.textContent = "Rating: " + mapRatingText(post.rating);
  popup.classList.remove("hidden");
  document.body.classList.add("modal-open");

  // Dua langkah berulang: 1) Ads, 2) Buka link download, lalu reset ke 1
  const jpeg = getDirectImageUrl(post) || deriveFallback(post);
  let downloadStep = 1;
  downloadBtn.classList.remove("hidden");
  downloadBtn.textContent = "Download HD step 1";
  downloadBtn.onclick = () => {
    if (downloadStep === 1) {
      // klik pertama: buka iklan
      window.open(DIRECT_AD_URL, "_blank");
      downloadBtn.textContent = "Open Download HD";
      downloadStep = 2;
    } else {
      // klik kedua: buka link download di tab baru, lalu reset ke langkah 1
      if (jpeg) window.open(jpeg, "_blank");
      downloadBtn.textContent = "Download HD step 1";
      downloadStep = 1;
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
closePopup.onclick = () => { popup.classList.add("hidden"); document.body.classList.remove("modal-open"); };

// close by backdrop click
popupBackdrop.addEventListener("click", ()=>{ popup.classList.add("hidden"); document.body.classList.remove("modal-open"); });

// keyboard nav
document.addEventListener("keydown", (ev) => {
  if (popup.classList.contains("hidden")) return;
  if (ev.key === "ArrowLeft") prevBtn.click();
  if (ev.key === "ArrowRight") nextBtn.click();
  if (ev.key === "Escape") closePopup.click();
});

// ---------- Main loader ----------
async function loadPage(tags="", pageNum=1) {
  // Reset
  messageEl.classList.add("hidden");
  // For initial load (page 1 and no tags) try bulk cache init to speed up
  if (!tags && pageNum === 1) {
    await bulkCacheInit("", 3).catch(()=>{});
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
  // re-render current page with filter
  loadPage(currentTags, page);
});

toggleMode.addEventListener("click", () => {
  const isLight = document.body.classList.toggle("light");
  localStorage.setItem("waifu_theme", isLight ? "light" : "dark");
  toggleMode.textContent = isLight ? "Dark" : "Light";
});

// initial
(async function init(){
  // default initial: show main listing from homepage of yande.re -> if client doesn't pass tags show blank => proxy will fetch default list
  currentTags = "";
  page = 1;
  loadTagSuggestions();
  await loadPage(currentTags, page);
})();
