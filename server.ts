import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { parseStringPromise } from "xml2js";

dotenv.config();

const app = express();
app.use(express.json());

// API route for Namecheap domain check
app.get("/api/namecheap-check", async (req, res) => {
  const { domains } = req.query;
  const apiKey = process.env.NAMECHEAP_API_KEY || "901c25726d32457f8dc315f47988ee77";
  const apiUser = process.env.NAMECHEAP_API_USER || "ram003";
  const userName = process.env.NAMECHEAP_USERNAME || "ram003";
  const clientIp = "127.0.0.1"; // Default for sandbox, but some keys might require a real IP

  if (!domains || typeof domains !== 'string') {
    return res.status(400).json({ error: "Domains are required" });
  }

  try {
    console.log(`Checking Namecheap domains: ${domains}`);
    const response = await axios.get(`https://api.sandbox.namecheap.com/xml.response`, {
      params: {
        ApiUser: apiUser,
        ApiKey: apiKey,
        UserName: userName,
        Command: "namecheap.domains.check",
        ClientIp: clientIp,
        DomainList: domains
      },
      timeout: 15000 // 15 second timeout
    });

    const result = await parseStringPromise(response.data);
    
    // Check for API errors in the XML response
    if (result.ApiResponse?.Errors?.[0]?.Error) {
      const errors = result.ApiResponse.Errors[0].Error;
      const errorMessages = errors.map((e: any) => {
        if (typeof e === 'string') return e;
        if (e._) return e._;
        return JSON.stringify(e);
      });
      console.error("Namecheap API Errors:", errorMessages.join(", "));
      return res.status(400).json({ 
        error: "Namecheap API Error", 
        details: errorMessages.join(", ") 
      });
    }

    const commandResponse = result.ApiResponse?.CommandResponse?.[0];
    const domainCheckResults = commandResponse?.DomainCheckResult;

    if (!domainCheckResults) {
      console.warn("No DomainCheckResult found in Namecheap response");
      return res.json([]);
    }

    const formattedResults = domainCheckResults.map((item: any) => ({
      domain: item.$.Domain,
      available: item.$.Available === "true",
      price: item.$.PremiumRegistrationPrice || "N/A",
      isPremium: item.$.IsPremiumName === "true"
    }));

    res.json(formattedResults);
  } catch (error: any) {
    console.error(`Error checking Namecheap for ${domains}:`, error.message);
    res.status(500).json({
      error: `Failed to check Namecheap for ${domains}`,
      details: error.message
    });
  }
});

// API route for SPF check proxying to MXToolbox
app.get("/api/spf-check", async (req, res) => {
  const { domain } = req.query;
  // Use the provided API key as the default, but allow environment override
  const apiKey = process.env.MXTOOLBOX_API_KEY || "2397bc10-fae0-44db-b4f3-eb8f818cd422";

  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  try {
    // Using the SPF command with the provided API key
    const response = await axios.get(`https://api.mxtoolbox.com/api/v1/lookup/spf/${domain}`, {
      headers: {
        Authorization: apiKey,
      },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error(`Error checking SPF for ${domain}:`, error.message);
    res.status(error.response?.status || 500).json({
      error: `Failed to check SPF for ${domain}`,
      details: error.response?.data || error.message
    });
  }
});

// New API route for DNS-based SPF check (using Google DoH for Vercel compatibility)
app.get("/api/dns-spf-check", async (req, res) => {
  const { domain } = req.query;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: "Domain is required" });
  }

  try {
    // Using Google DNS over HTTPS (DoH) for better compatibility on Vercel
    const response = await axios.get(`https://dns.google/resolve`, {
      params: { name: domain, type: 'TXT' },
      timeout: 10000
    });
    
    const data = response.data;
    if (data.Answer) {
      const spfRecord = data.Answer
        .map((ans: any) => {
          let txt = ans.data;
          if (txt.startsWith('"') && txt.endsWith('"')) {
            txt = txt.substring(1, txt.length - 1);
          }
          return txt;
        })
        .find((record: string) => record.toLowerCase().includes('v=spf1'));
      
      if (spfRecord) {
        return res.json({ domain, record: spfRecord, status: 'success' });
      }
    }
    res.json({ domain, record: 'No SPF record found', status: 'no-spf' });
  } catch (error: any) {
    console.error(`Error checking SPF for ${domain}:`, error.message);
    res.json({ domain, record: 'DNS lookup failed', status: 'error' });
  }
});

async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

// Only start server if not running on Vercel (Vercel handles the listener)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  setupVite().then(() => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;
