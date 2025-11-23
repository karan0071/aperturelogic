// ---------------------------------------------------------
// Aperturelogic — Enhanced Interactive Script
// ---------------------------------------------------------

const mdCache = {};
function $(sel) { return document.querySelector(sel); }

// Parse YAML (Standard)
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

// Markdown Render
function renderMarkdown(md) {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/```([\s\S]*?)```/g, (m, c) => `<pre><code>${c}</code></pre>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, a, u) => `<img src="${u}" alt="${a}">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${u}" target="_blank">${t}</a>`)
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .split(/\n\s*\n/).map(p => p.match(/^<(h|ul|pre|img)/) ? p : `<p>${p.replace(/\n/g, " ")}</p>`).join("\n");
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

// --- NEW: Scroll Observer for Animation ---
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal'); // Adds CSS class to trigger fade-up
      observer.unobserve(entry.target); // Only animate once
    }
  });
}, { threshold: 0.1 });

function createCard(post) {
  const el = document.createElement("article");
  const catRaw = post.meta.category || "other";
  const catClass = "cat-" + catRaw.toLowerCase().replace(/[^a-z]/g, ""); 
  
  el.className = `post-card ${catClass}`; // Removed 'reveal' here, handled by observer

  const title = post.meta.title || post.slug;
  el.innerHTML = `
    <div class="card-top">
        <span>${catRaw}</span>
        <span>${formatDate(post.meta.date)}</span>
    </div>
    <h3><a href="?post=${post.slug}" data-slug="${post.slug}">${title}</a></h3>
    <div class="post-summary">${post.meta.summary || ""}</div>
  `;
  
  // Attach observer to this new card
  observer.observe(el);
  
  return el;
}

async function renderPosts(filterCat = "all") {
  const list = await loadPostList();
  const container = $("#posts-list");
  container.innerHTML = "";

  const filtered = list.filter(p =>
    filterCat === "all" ? true : (p.meta.category || "").toLowerCase().includes(filterCat.toLowerCase())
  );
  
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === filterCat);
  });

  // Sort and Render
  filtered.sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));
  filtered.forEach((p, index) => {
    const card = createCard(p);
    // Add staggering delay so they don't all pop at once
    card.style.transitionDelay = `${index * 50}ms`; 
    container.appendChild(card);
  });
}

async function openPost(slug) {
  const POSTS_PATH = getPostsPath();
  let cached = mdCache[slug];

  if (!cached || !cached.body) {
    const txt = await fetch(POSTS_PATH + slug + ".md").then(r => r.text());
    const parsed = parseFrontmatter(txt);
    cached = { meta: parsed.meta, body: parsed.body };
    mdCache[slug] = cached;
  }

  const html = renderMarkdown(cached.body);
  
  // Clean existing overlays
  const existing = document.querySelector(".reader-overlay");
  if(existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.className = "reader-overlay";
  overlay.innerHTML = `
    <button class="close-btn">Close ✕</button>
    <div class="reader">
      <h1>${cached.meta.title || slug}</h1>
      <div style="margin-bottom:30px; color:var(--text-muted)">${formatDate(cached.meta.date)} • <strong>${cached.meta.category}</strong></div>
      <div class="post-body">${html}</div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Small delay to allow CSS transition
  setTimeout(() => overlay.classList.add("active"), 10);
  document.body.style.overflow = "hidden";

  const close = () => {
    overlay.classList.remove("active");
    setTimeout(() => overlay.remove(), 300);
    document.body.style.overflow = "";
  };

  overlay.querySelector(".close-btn").addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if(e.target === overlay) close();
  });
}

// Init
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
  
  if(localStorage.getItem("ap-theme")) {
      document.documentElement.setAttribute("data-theme", localStorage.getItem("ap-theme"));
  }

  document.querySelectorAll(".filter-pill").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      renderPosts(a.dataset.cat);
    });
  });

  document.body.addEventListener("click", e => {
    const a = e.target.closest("a[data-slug]");
    if (a) {
      e.preventDefault();
      openPost(a.dataset.slug);
    }
  });

  await renderPosts("all");
  
  const params = new URLSearchParams(location.search);
  const post = params.get("post");
  if (post) openPost(post);
});
