// ---------------------------------------------------------
// Aperturelogic — Updated Logic for New UI
// ---------------------------------------------------------

const mdCache = {};

function $(sel) { return document.querySelector(sel); }

// Parse YAML frontmatter (Same as before)
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

// Markdown Renderer (Same as before)
function renderMarkdown(md) {
  let html = md
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
  return html;
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
  const POSTS_PATH = getPostsPath();
  try {
    const resp = await fetch(POSTS_PATH + "index.json", { cache: "no-store" });
    if (resp.ok) {
      const list = await resp.json();
      list.forEach(item => { mdCache[item.slug] = { meta: item.meta, body: null }; });
      return list;
    }
  } catch (err) { console.error(err); }
  return [];
}

// --- UPDATED CARD CREATION FOR NEW UI ---
function createCard(post) {
  const el = document.createElement("article");
  
  // Clean category for CSS class (tech, cars, travel)
  const catRaw = post.meta.category || "other";
  const catClass = "cat-" + catRaw.toLowerCase().replace(/[^a-z]/g, ""); 
  
  el.className = `post-card ${catClass}`;

  const title = post.meta.title || post.slug;

  el.innerHTML = `
    <div class="card-top">
        <span>${catRaw}</span>
        <span>${formatDate(post.meta.date)}</span>
    </div>
    <h3><a href="?post=${post.slug}" data-slug="${post.slug}">${title}</a></h3>
    <div class="post-summary">${post.meta.summary || "No summary available."}</div>
  `;
  return el;
}

async function renderPosts(filterCat = "all") {
  const list = await loadPostList();
  const container = $("#posts-list");
  container.innerHTML = "";

  const filtered = list.filter(p =>
    filterCat === "all" ? true : (p.meta.category || "").toLowerCase().includes(filterCat.toLowerCase())
  );
  
  // Update active state on buttons
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === filterCat);
  });

  if (!filtered.length) container.innerHTML = `<p style="color:var(--text-muted)">No posts found.</p>`;
  
  // Sort by date new to old
  filtered.sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));
  
  filtered.forEach(p => container.appendChild(createCard(p)));
}

async function openPost(slug) {
  const POSTS_PATH = getPostsPath();
  let cached = mdCache[slug];

  if (!cached.body) {
    const txt = await fetch(POSTS_PATH + slug + ".md").then(r => r.text());
    const parsed = parseFrontmatter(txt);
    cached.body = parsed.body;
    cached.meta = parsed.meta;
  }

  const html = renderMarkdown(cached.body);
  const overlay = document.createElement("div");
  overlay.className = "reader-overlay";
  overlay.innerHTML = `
    <div class="reader">
      <button class="close-btn" onclick="this.closest('.reader-overlay').remove()">Close ✕</button>
      <h1>${cached.meta.title || slug}</h1>
      <div class="post-meta">${formatDate(cached.meta.date)} • <strong>${cached.meta.category}</strong></div>
      <div class="post-body">${html}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Prevent background scrolling
  document.body.style.overflow = "hidden";
  // Re-enable scrolling when closed
  overlay.querySelector(".close-btn").addEventListener("click", () => {
      document.body.style.overflow = "";
  });
}

// Initial Load
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
  
  // Check local storage for theme
  if(localStorage.getItem("ap-theme")) {
      document.documentElement.setAttribute("data-theme", localStorage.getItem("ap-theme"));
  }

  // Filter clicks
  document.querySelectorAll(".filter-pill").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      renderPosts(a.dataset.cat);
    });
  });

  // Post clicks
  document.body.addEventListener("click", e => {
    const a = e.target.closest("a[data-slug]");
    if (a) {
      e.preventDefault();
      openPost(a.dataset.slug);
    }
  });

  await renderPosts("all");
  
  // URL Param handler
  const params = new URLSearchParams(location.search);
  const post = params.get("post");
  if (post) openPost(post);
});
