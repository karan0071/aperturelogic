// ---------------------------------------------------------
// Aperturelogic — Complete Logic (Search + Motion + Reader)
// ---------------------------------------------------------

const mdCache = {};
let currentCat = 'all';
let currentSearch = '';

// Helper
function $(sel) { return document.querySelector(sel); }

// --- 1. UTILITIES ---

// Scroll Observer for "Fade Up" Animation
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal'); // Triggers CSS animation
      observer.unobserve(entry.target);     // Only animate once
    }
  });
}, { threshold: 0.1 });

// Parse YAML Frontmatter
function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { meta: {}, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: text };
  
  const fm = text.slice(3, end).trim();
  const body = text.slice(end + 4).trim();
  const meta = {};
  
  fm.split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    meta[key] = val;
  });
  return { meta, body };
}

// Markdown Renderer
function renderMarkdown(md) {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```([\s\S]*?)```/g, (m, c) => `<pre><code>${c}</code></pre>`)
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, a, u) => `<img src="${u}" alt="${a}">`)
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank">${t}</a>`)
    // Headers
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    // Bold/Italic
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    // Paragraphs
    .split(/\n\s*\n/)
    .map(p => p.match(/^<(h|ul|pre|img)/) ? p : `<p>${p.replace(/\n/g, " ")}</p>`)
    .join("\n");
}

function formatDate(dstr) {
  if (!dstr) return "";
  return new Date(dstr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPostsPath() {
  let base = window.location.pathname;
  if (!base.endsWith("/")) base = base.replace(/index\.html$/, "");
  return base + "posts/";
}

async function loadPostList() {
  try {
    const resp = await fetch(getPostsPath() + "index.json", { cache: "no-store" });
    if (resp.ok) return await resp.json();
  } catch (err) { console.error(err); }
  return [];
}

// --- 2. RENDERING SYSTEM ---

function createCard(post) {
  const el = document.createElement("article");
  
  // Clean category for CSS class (tech, cars, travel)
  const catRaw = post.meta.category || "other";
  const catClass = "cat-" + catRaw.toLowerCase().replace(/[^a-z]/g, ""); 
  
  el.className = `post-card ${catClass}`; // Note: 'reveal' is added by observer later

  const title = post.meta.title || post.slug;
  const date = formatDate(post.meta.date);
  const summary = post.meta.summary || "";

  el.innerHTML = `
    <div class="card-top">
        <span>${catRaw}</span>
        <span>${date}</span>
    </div>
    <h3><a href="?post=${post.slug}" data-slug="${post.slug}">${title}</a></h3>
    <div class="post-summary">${summary}</div>
  `;
  
  // Attach scroll observer
  observer.observe(el);
  
  return el;
}

// The Master Render Function (Handles Search + Filter)
async function renderPosts() {
  const list = await loadPostList();
  const container = $("#posts-list");
  
  // Clear current grid
  container.innerHTML = "";

  // Filter Logic: Must match Category AND Search text
  const filtered = list.filter(p => {
    const postCat = (p.meta.category || "").toLowerCase();
    const postContent = (p.meta.title + " " + (p.meta.summary || "")).toLowerCase();
    
    const matchesCat = currentCat === "all" || postCat.includes(currentCat);
    const matchesSearch = postContent.includes(currentSearch);
    
    return matchesCat && matchesSearch;
  });

  // Update UI Pills
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === currentCat);
  });

  // Empty State
  if (!filtered.length) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--text-muted)">
        <p style="font-size:1.2rem;">No posts found.</p>
        <p style="font-size:0.9rem;">Try adjusting your search or category.</p>
      </div>`;
    return;
  }
  
  // Sort: Newest First
  filtered.sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));
  
  // Render with Staggered Delay
  filtered.forEach((p, index) => {
    const card = createCard(p);
    // Stagger animation: 1st card 0ms, 2nd 50ms, 3rd 100ms...
    card.style.transitionDelay = `${index * 50}ms`; 
    container.appendChild(card);
  });
}

// --- 3. READER OVERLAY ---

async function openPost(slug) {
  const POSTS_PATH = getPostsPath();
  let cached = mdCache[slug];

  // Fetch if not in cache
  if (!cached || !cached.body) {
    try {
      const txt = await fetch(POSTS_PATH + slug + ".md").then(r => r.text());
      const parsed = parseFrontmatter(txt);
      cached = { meta: parsed.meta, body: parsed.body };
      mdCache[slug] = cached;
    } catch(e) {
      alert("Could not load post.");
      return;
    }
  }

  const html = renderMarkdown(cached.body);
  
  // Clean old overlays
  const existing = document.querySelector(".reader-overlay");
  if(existing) existing.remove();

  // Create Overlay
  const overlay = document.createElement("div");
  overlay.className = "reader-overlay";
  overlay.innerHTML = `
    <button class="close-btn" aria-label="Close">Close ✕</button>
    <div class="reader">
      <h1>${cached.meta.title || slug}</h1>
      <div style="margin-bottom:30px; color:var(--text-muted); border-bottom:1px solid var(--border); padding-bottom:20px;">
        ${formatDate(cached.meta.date)} • <strong>${cached.meta.category}</strong>
      </div>
      <div class="post-body">${html}</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Animation & Scroll Lock
  setTimeout(() => overlay.classList.add("active"), 10);
  document.body.style.overflow = "hidden";

  // Close Logic
  const close = () => {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 300); // Wait for fade out
    document.body.style.overflow = "";
    
    // Optional: Clear URL param
    const url = new URL(window.location);
    url.searchParams.delete('post');
    window.history.replaceState({}, '', url);
  };

  overlay.querySelector(".close-btn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) close(); // Click outside to close
  });
}

// --- 4. INITIALIZATION ---

window.addEventListener("load", async () => {
  $("#year").textContent = new Date().getFullYear();
  
  // Theme Toggle
  const themeBtn = $("#theme-toggle");
  if(themeBtn) {
    themeBtn.addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("ap-theme", next);
    });
  }
  
  // Restore Theme
  if(localStorage.getItem("ap-theme")) {
    document.documentElement.setAttribute("data-theme", localStorage.getItem("ap-theme"));
  }

  // Category Filter Click
  document.querySelectorAll(".filter-pill").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      currentCat = a.dataset.cat;
      renderPosts();
    });
  });

  // Search Input Listener
  const searchInput = $("#search-input");
  if(searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.toLowerCase();
      renderPosts();
    });
  }

  // Global Click Delegation (for post links)
  document.body.addEventListener("click", e => {
    const a = e.target.closest("a[data-slug]");
    if (a) {
      e.preventDefault();
      openPost(a.dataset.slug);
      
      // Update URL without reload
      const url = new URL(window.location);
      url.searchParams.set('post', a.dataset.slug);
      window.history.pushState({}, '', url);
    }
  });

  // Initial Render
  await renderPosts();
  
  // Handle Direct Link to Post (e.g. ?post=sample-tech)
  const params = new URLSearchParams(location.search);
  const postParam = params.get("post");
  if (postParam) openPost(postParam);
});
