export function requireCompanyApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Missing API key" });
    }
    const apiKey = authHeader.substring(7);
    if (apiKey !== process.env.COMPANY_API_KEY) {
        return res.status(403).json({ error: "Invalid API key" });
    }
    next();
}
