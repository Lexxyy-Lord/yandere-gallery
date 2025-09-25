export default async function handler(req, res) {
    const { tags = "dress", page = 1 } = req.query;
  
    const url = `https://yande.re/post.json?tags=${encodeURIComponent(tags)}&page=${page}&limit=20`;
  
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; YandeReFetcher/1.0)",
        },
      });
  
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: `Yande.re API error: ${response.statusText}` });
      }
  
      const data = await response.json();
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
  