async function loadPostList(){
  // Detect base path (GitHub Pages puts your site at /username/repo/)
  const basePath = window.location.pathname.replace(/index\.html$/, "");
  const POSTS_PATH = basePath + "posts/";

  try {
    const resp = await fetch(POSTS_PATH + "index.json", { cache: "no-store" });

    if (resp.ok) {
      const list = await resp.json();

      // Preload metadata
      list.forEach(item => {
        mdCache[item.slug] = { meta: item.meta, body: null };
      });

      return list;
    } else {
      console.error("Failed to load index.json:", resp.status, resp.statusText);
      return [];
    }
  } catch (err) {
    console.error("Error fetching index.json:", err);
    return [];
  }
}
