import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { google } from "googleapis";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// Google OAuth Setup
const getOAuth2Client = (redirectUri?: string) => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || `${process.env.APP_URL}/api/auth/google/callback`
  );
};

// API route for Namecrawl domain check
app.get("/api/domain-check", async (req, res) => {
  const { domains } = req.query;
  const apiKey = process.env.NAMECRAWL_API_KEY || "nc_live_AdMPNvfI7LNoCFA2M3QqBU4MSHJkOLj396sBC4LZA4Y";
  const apiEndpoint = "https://api.namecrawl.dev/v1/domains/search";

  if (!domains || typeof domains !== 'string') {
    return res.status(400).json({ error: "Domains are required" });
  }

  try {
    console.log(`Checking domains with Namecrawl: ${domains}`);
    
    const response = await axios.get(apiEndpoint, {
      params: {
        domains: domains,
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 15000
    });

    const data = response.data;

    // Map Namecrawl response to our standard format
    if (data.domains && Array.isArray(data.domains)) {
      const formattedResults = data.domains.map((item: any) => ({
        domain: item.domain,
        available: item.available,
        price: item.price || "N/A",
        isPremium: item.is_premium || false
      }));
      res.json(formattedResults);
    } else if (data.domain && data.available !== undefined) {
      res.json([{
        domain: data.domain,
        available: data.available,
        price: data.price || "N/A",
        isPremium: data.is_premium || false
      }]);
    } else {
      console.warn("Unexpected response format from Namecrawl API:", data);
      res.status(500).json({
        error: "Unexpected response format from Namecrawl API",
        details: JSON.stringify(data)
      });
    }
  } catch (error: any) {
    console.error(`Error checking Namecrawl for ${domains}:`, error.message);
    let errorMessage = error.message;
    if (error.response) {
      errorMessage = `Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`;
    }
    res.status(error.response?.status || 500).json({
      error: `Failed to check Namecrawl for ${domains}`,
      details: errorMessage
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

// Google OAuth Routes
app.get("/api/auth/google/url", (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
    prompt: "consent"
  });
  res.json({ url });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send("No code provided");
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Store tokens in a secure cookie
    res.cookie("google_tokens", JSON.stringify(tokens), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/google/status", (req, res) => {
  const tokens = req.cookies.google_tokens;
  res.json({ isAuthenticated: !!tokens });
});

app.post("/api/auth/google/logout", (req, res) => {
  res.clearCookie("google_tokens", {
    httpOnly: true,
    secure: true,
    sameSite: "none"
  });
  res.json({ success: true });
});

app.post("/api/sheets/create", async (req, res) => {
  const tokensStr = req.cookies.google_tokens;
  if (!tokensStr) {
    return res.status(401).json({ error: "Not authenticated with Google" });
  }

  const { title } = req.body;
  
  try {
    const tokens = JSON.parse(tokensStr);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: title || `SPF Search Results - ${new Date().toISOString().split('T')[0]}`
        }
      }
    });

    const spreadsheetId = spreadsheet.data.spreadsheetId;

    // Add headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: "A1:C1",
      valueInputOption: "RAW",
      requestBody: {
        values: [["domaine PROD", "mechanism", "Domaine racine"]]
      }
    });

    res.json({ spreadsheetId, spreadsheetUrl: spreadsheet.data.spreadsheetUrl });
  } catch (error: any) {
    console.error("Error creating sheet:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/sheets/append", async (req, res) => {
  const tokensStr = req.cookies.google_tokens;
  if (!tokensStr) {
    return res.status(401).json({ error: "Not authenticated with Google" });
  }

  const { spreadsheetId, values } = req.body;
  if (!spreadsheetId || !values || !Array.isArray(values)) {
    return res.status(400).json({ error: "Spreadsheet ID and values array are required" });
  }
  
  try {
    const tokens = JSON.parse(tokensStr);
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials(tokens);

    const sheets = google.sheets({ version: "v4", auth: oauth2Client });
    
    // Append to the first sheet (Sheet1 or similar)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:C", 
      valueInputOption: "RAW",
      requestBody: {
        values
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error appending to sheet:", error);
    res.status(500).json({ error: error.message });
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

// RDAP Bootstrap Cache
let rdapBootstrap: any = null;
let lastBootstrapFetch = 0;

async function getRdapServer(tld: string): Promise<string | null> {
  try {
    const now = Date.now();
    // Refresh bootstrap every 24 hours
    if (!rdapBootstrap || now - lastBootstrapFetch > 24 * 60 * 60 * 1000) {
      console.log("Fetching IANA RDAP bootstrap...");
      const response = await axios.get("https://data.iana.org/rdap/dns.json");
      rdapBootstrap = response.data;
      lastBootstrapFetch = now;
    }

    if (!rdapBootstrap || !rdapBootstrap.services) return null;

    for (const service of rdapBootstrap.services) {
      const tlds = service[0];
      const servers = service[1];
      if (tlds.includes(tld)) {
        return servers[0]; // Return the first available RDAP server
      }
    }
  } catch (error) {
    console.error("Error fetching RDAP bootstrap:", error);
  }
  return null;
}

// API route for WHOIS/RDAP lookup
app.get("/api/whois", async (req, res) => {
  const { domain } = req.query;

  if (!domain || typeof domain !== 'string') {
    return res.status(400).json({ error: "Domain is required" });
  }

  try {
    const domainParts = domain.toLowerCase().split('.');
    if (domainParts.length < 2) {
      return res.status(400).json({ error: "Invalid domain format" });
    }
    const tld = domainParts[domainParts.length - 1];

    console.log(`Performing WHOIS/RDAP lookup for: ${domain} (TLD: ${tld})`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rdap+json, application/json',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // Try to get direct RDAP server from IANA bootstrap
    const directServer = await getRdapServer(tld);
    let response;

    // Special case for .us if bootstrap fails
    let serversToTry = [];
    if (directServer) serversToTry.push(directServer);
    if (tld === 'us') serversToTry.push('https://rdap.nic.us/');
    serversToTry.push('https://rdap.org/');

    for (const serverBase of serversToTry) {
      try {
        console.log(`Trying RDAP server: ${serverBase}`);
        const url = `${serverBase}${serverBase.endsWith('/') ? '' : '/'}domain/${domain}`;
        response = await axios.get(url, {
          headers,
          timeout: 8000,
          validateStatus: (status) => status < 500
        });
        
        // If we got a 200 or 404, we're good
        if (response.status === 200 || response.status === 404) break;
        
        // If we got a 403 or something else, try the next one
        console.warn(`RDAP server ${serverBase} returned status ${response.status}`);
      } catch (e: any) {
        console.warn(`RDAP lookup failed for ${serverBase}: ${e.message}`);
      }
    }

    if (!response) {
      return res.status(503).json({ error: "All RDAP services are currently unavailable or blocking the request." });
    }

    if (response.status === 404) {
      return res.json({
        domain,
        available: true,
        message: "Domain not found in RDAP database (likely available)"
      });
    }

    if (response.status !== 200) {
      return res.status(response.status).json({
        error: `RDAP lookup failed with status ${response.status}`,
        details: typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>') 
          ? "Access blocked by provider (Cloudflare/Security)" 
          : "Unexpected response from RDAP server"
      });
    }

    const data = response.data;
    
    if (typeof data !== 'object' || data === null) {
      return res.status(500).json({ error: "Invalid response format from RDAP server" });
    }
    
    // Extract info
    const events = data.events || [];
    const regActions = ['registration', 'created', 'creation'];
    const expActions = ['expiration', 'expiry', 'expires'];
    
    const registration = events.find((e: any) => regActions.includes(e.eventAction));
    const expiration = events.find((e: any) => expActions.includes(e.eventAction));
    
    const entities = data.entities || [];
    
    const getNameFromVcard = (vcard: any[]) => {
      if (!Array.isArray(vcard)) return null;
      const fn = vcard[1]?.find((item: any) => item[0] === 'fn');
      return fn ? fn[3] : null;
    };

    const registrarEntity = entities.find((e: any) => e.roles?.includes('registrar'));
    const registrarName = registrarEntity ? (getNameFromVcard(registrarEntity.vcardArray) || registrarEntity.handle) : null;
    const allEntities = entities.map((e: any) => getNameFromVcard(e.vcardArray) || e.handle).filter(Boolean).join(', ');

    res.json({
      domain,
      available: false,
      details: {
        handle: data.handle || 'N/A',
        status: Array.isArray(data.status) ? data.status : (data.status ? [data.status] : []),
        entities: registrarName || allEntities || 'N/A',
        registrationDate: registration?.eventDate,
        expirationDate: expiration?.eventDate,
        nameservers: data.nameservers?.map((ns: any) => ns.ldhName).join(', ') || 'N/A'
      },
      raw: data // Include raw data for debugging if needed
    });
  } catch (error: any) {
    console.error(`Error performing WHOIS lookup for ${domain}:`, error.message);
    res.status(500).json({
      error: `Failed to perform WHOIS lookup for ${domain}`,
      details: error.message
    });
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
