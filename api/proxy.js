// api/proxy.js (Vercel)
export default async function handler(req, res) {
    const origin = "https://yande.re";
    const { tags = "", page = "1", cache = "0", pages = "1" } = req.query;
  
    // helper fetch single page
    async function fetchPage(p) {
      const url = `${origin}/post.json?tags=${encodeURIComponent(tags)}&page=${p}&limit=20`;
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; WaifuGallery/1.0)"
        },
      });
      if (!r.ok) {
        const txt = await r.text().catch(()=>"");
        throw new Error(`Upstream error ${r.status} ${txt}`);
      }
      return r.json();
    }
  
    try {
      res.setHeader("Access-Control-Allow-Origin", "*");
      // handle bulk cache build
      if (String(cache) === "1") {
        const pcount = Math.max(1, Math.min(10, parseInt(pages || "1", 10)));
        const pagesObj = {};
        for (let i = 1; i <= pcount; i++) {
          try {
            const data = await fetchPage(i);
            pagesObj[i] = data;
          } catch (e) {
            pagesObj[i] = [];
          }
        }
        return res.json({ pages: pagesObj });
      }
  
      // single page passthrough
      const pg = Math.max(1, parseInt(page || "1", 10));
      const data = await fetchPage(pg);
      return res.json(data);
    } catch (err) {
      console.error("proxy error:", err);
      res.status(500).json({ error: err.message || "proxy error" });
    }
  }  