// Live operational reads must not reuse a browser's previous order snapshot.
export const liveOrderCache = (req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    res.set("Cache-Control", "no-store");
    // Express can turn res.json into 304 for conditional requests even with no-store.
    delete req.headers["if-none-match"];
    delete req.headers["if-modified-since"];
  }
  next();
};
