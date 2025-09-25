let page = 1;
let currentTags = "dress";
let galleryImages = [];
let currentIndex = 0;

const gallery = document.getElementById("gallery");
const loadMore = document.getElementById("loadMore");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const toggleMode = document.getElementById("toggleMode");

// Popup
const popup = document.getElementById("popup");
const popupImage = document.getElementById("popupImage");
const popupTags = document.getElementById("popupTags");
const popupRating = document.getElementById("popupRating");
const closePopup = document.getElementById("closePopup");
const downloadBtn = document.getElementById("downloadBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

// Fetch Yande.re API
async function fetchImages(tags, pageNum = 1) {
  const url = `/proxy?tags=${encodeURIComponent(tags)}&page=${pageNum}`;
  const res = await fetch(url);
  const data = await res.json();

  data.forEach(post => {
    const img = document.createElement("img");
    img.src = post.preview_url;
    img.alt = post.tags;
    img.dataset.full = post.sample_url || post.file_url;
    img.dataset.rating = post.rating;
    img.dataset.tags = post.tags;
    img.addEventListener("click", () => openPopup(img));
    gallery.appendChild(img);

    galleryImages.push(img);

    // Animasi fade-in
    img.classList.add("fade-in");
  });
}

function openPopup(img) {
  currentIndex = galleryImages.indexOf(img);
  showImage(currentIndex);
  popup.classList.remove("hidden");
}

function showImage(index) {
  const img = galleryImages[index];
  if (!img) return;

  popupImage.src = img.dataset.full;
  popupTags.textContent = img.dataset.tags;
  popupRating.textContent = img.dataset.rating.toUpperCase();

  downloadBtn.onclick = () => {
    if (!downloadBtn.dataset.clicked) {
      window.open("https://your-ads-link.com", "_blank");
      downloadBtn.dataset.clicked = true;
    } else {
      window.open(img.dataset.full, "_blank");
      downloadBtn.dataset.clicked = false;
    }
  };
}

// Navigation
prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    showImage(currentIndex);
  }
};

nextBtn.onclick = () => {
  if (currentIndex < galleryImages.length - 1) {
    currentIndex++;
    showImage(currentIndex);
  }
};

closePopup.onclick = () => popup.classList.add("hidden");

// Search
searchBtn.onclick = () => {
  gallery.innerHTML = "";
  galleryImages = [];
  page = 1;
  currentTags = searchInput.value || "dress";
  fetchImages(currentTags, page);
};

// Load More
loadMore.onclick = () => {
  page++;
  fetchImages(currentTags, page);
};

// Toggle Dark/Light
toggleMode.onclick = () => {
  document.body.classList.toggle("dark");
  toggleMode.textContent = document.body.classList.contains("dark") ? "☀️ Light" : "🌙 Dark";
};

// Initial load
fetchImages(currentTags, page);
