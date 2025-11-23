// ---------------------------------------------------------
// Aperturelogic — Full Working Script.js (GitHub Pages Safe)
// ---------------------------------------------------------

const mdCache = {};

// Utility
function $(sel) {
  return document.querySelector(sel);
}

// Parse YAML frontmatter
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

// Very small markdown renderer
function renderMarkdown(md) {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // code blocks ```
  html = html.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${code}</code></pre>`);

  // images ![]( )
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (m, alt, url) => {
    return `<img src="${url}" alt="${alt}">`;
  });

  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => {
    return `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;
  });

  // headers
  html = html.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // unordered lists
  html = html.replace(/^\s*[-*+] (.*)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");

  // bold & italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // paragraphs
  html = html
    .split(/\n\s*\n/)
    .map(p => {
      if (p.match(/^<(h[1-6]|ul|pre|img|blockquote)/)) return p;
      return `<p>${p.replace(/\n/g, " ")}</p>`;
    })
    .join("\n");

  return html;
}

// Format date
function formatDate(dstr) {
  if (!dstr) return "";
  try {
    const d = new Date(dstr);
    return d.toLocaleDateString();
  } catch {
    return dstr;
  }
}

// Auto-detect correct posts path
function getPostsPath() {
  let base = window.location.pathname;
  if (!base.endsWith("/")) base = base.replace(/index\.html$/, "");
  return base + "posts/";
}

// Load post list using index.json
async function loadPostList() {
  const POSTS_PATH = getPostsPath();

  try {
    const resp = await fetch(POSTS_PATH + "index.json", { cache: "no-store" });

    if (resp.ok) {
      const list = await resp.json();

      list.forEach(item => {
        mdCache[item.slug] = { meta: item.meta, body: null };
      });

      return list;
    } else {
      console.error("index.json load failed:", resp.status);
      return [];
    }
  } catch (err) {
    console.error("Could not fetch index.json:", err);
    return [];
  }
}

// Create blog card
function createCard(post) {
  const el = document.createElement("article");
  el.className = "post-card";

  const title = post.meta.title || post.slug;

  el.innerHTML = `
    <h3><a href="?post=${post.slug}" data-slug="${post.slug}">${title}</a></h3>
    <div class="post-meta">${formatDate(post.meta.date)} • <strong>${post.meta.category}</strong></div>
    <div class="post-summary">${post.meta.summary || ""}</div>
  `;
  return el;
}

// Render posts list
async function renderPosts(filterCat = "all") {
  const list = await loadPostList();
  const container = $("#posts-list");

  container.innerHTML = "";

  const filtered = list.filter(p =>
    filterCat === "all" ? true : (p.meta.category || "").toLowerCase() === filterCat.toLowerCase()
  );

  filtered.sort((a, b) => new Date(b.meta.date || 0) - new Date(a.meta.date || 0));

  if (!filtered.length)
    container.innerHTML = `<p class="muted">No posts in this category.</p>`;

  filtered.forEach(p => container.appendChild(createCard(p)));
}

// Open reader overlay
async function openPost(slug) {
  const POSTS_PATH = getPostsPath();

  let cached = mdCache[slug];

  if (!cached.body) {
    const file = slug + ".md";

    const txt = await fetch(POSTS_PATH + file).then(r => r.text());
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
}

// Handle post links
function navHandler() {
  const params = new URLSearchParams(location.search);
  const post = params.get("post");
  if (post) openPost(post);
}

// Theme toggle
function initThemeToggle() {
  const btn = $("#theme-toggle");
  btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    if (cur === "dark") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("ap-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("ap-theme", "dark");
    }
  });

  if (localStorage.getItem("ap-theme") === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

// On page load
window.addEventListener("load", async () => {
  $("#year").textContent = new Date().getFullYear();
  initThemeToggle();

  // Category filters
  document.querySelectorAll(".cat-card").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const cat = a.dataset.cat;
      renderPosts(cat);
      history.replaceState(null, "", "#" + cat);
    });
  });

  // Delegate post click
  document.body.addEventListener("click", e => {
    const a = e.target.closest("a[data-slug]");
    if (a) {
      e.preventDefault();
      openPost(a.dataset.slug);
    }
  });

  await renderPosts("all");
  navHandler();
});
