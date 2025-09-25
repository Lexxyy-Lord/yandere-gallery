let page = 1;
let currentTags = "dress";
let galleryImages = [];
let currentIndex = 0;
let adClicked = false;

const gallery = document.getElementById("gallery");
const pagination = document.getElementById("pagination");
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

// Fetch Yande.re API via proxy
async function fetchImages(tags, pageNum = 1) {
  const url = `/api/proxy?tags=${encodeURIComponent(tags)}&page=${pageNum}`;
  const res = await fetch(url);
  const data = await res.json();

  gallery.innerHTML = "";
  galleryImages = [];

  data.forEach(post => {
    const img = document.createElement("img");
    img.src = post.preview_url;
    img.alt = post.tags;
    img.dataset.full = post.file_url; // versi HD
    img.dataset.rating = post.rating;
    img.dataset.tags = post.tags;
    img.addEventListener("click", () => openPopup(img));
    gallery.appendChild(img);
    galleryImages.push(img);
  });

  renderPagination(pageNum);
}

// Render pagination
function renderPagination(currentPage) {
  pagination.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "← Previous";
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => {
    page--;
    fetchImages(currentTags, page);
  };
  pagination.appendChild(prevBtn);

  for (let i = currentPage; i < currentPage + 5; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    if (i === currentPage) btn.classList.add("active");
    btn.onclick = () => {
      page = i;
      fetchImages(currentTags, page);
    };
    pagination.appendChild(btn);
  }

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.onclick = () => {
    page++;
    fetchImages(currentTags, page);
  };
  pagination.appendChild(nextBtn);
}

// Open popup
function openPopup(img) {
  currentIndex = galleryImages.indexOf(img);
  showImage(currentIndex);
  popup.classList.remove("hidden");
  adClicked = false;
}

// Show popup image
function showImage(index) {
  const img = galleryImages[index];
  if (!img) return;

  popupImage.src = img.dataset.full;
  popupTags.textContent = "Tags: " + img.dataset.tags;
  popupRating.textContent = "Rating: " + img.dataset.rating.toUpperCase();

  downloadBtn.onclick = () => {
    if (!adClicked) {
      window.open("https://www.revenuecpmgate.com/yi59046hjd?key=38c26dc552e10ee4babe41f597d26a40", "_blank");
      adClicked = true;
    } else {
      const link = document.createElement("a");
      link.href = img.dataset.full;
      link.download = "yandere-image.jpg";
      link.click();
      adClicked = false;
    }
  };
}

// Navigation
prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    adClicked = false;
    showImage(currentIndex);
  }
};
nextBtn.onclick = () => {
  if (currentIndex < galleryImages.length - 1) {
    currentIndex++;
    adClicked = false;
    showImage(currentIndex);
  }
};
closePopup.onclick = () => popup.classList.add("hidden");

// Search
searchBtn.onclick = () => {
  page = 1;
  currentTags = searchInput.value || "dress";
  fetchImages(currentTags, page);
};

// Toggle Dark/Light
toggleMode.onclick = () => {
  document.body.classList.toggle("light");
  toggleMode.textContent = document.body.classList.contains("light") ? "🌙 Dark" : "☀️ Light";
};

// Initial load
fetchImages(currentTags, page);
