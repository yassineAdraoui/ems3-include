/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import psl from 'psl';
import { Download, Copy, Trash2, Globe, FileText, CheckCircle2, AlertCircle, Upload, ShieldCheck, Search, Loader2, ExternalLink, TableProperties, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

// --- Types ---
type Page = 'extractor' | 'spf' | 'dns-spf' | 'root-extractor' | 'includes-search' | 'whois-search';

interface SPFResult {
  domain: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'no-spf' | 'not-found' | 'timeout';
  passed?: boolean;
  record?: string;
  error?: string;
}

interface NamecheapResult {
  domain: string;
  available: boolean;
  price: string;
  isPremium: boolean;
}

// --- Components ---

const RootDomainExtractor = ({ onExtract }: { onExtract: (domains: string[]) => void }) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(prev => prev ? `${prev}\n${content}` : content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const extractRootDomains = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const lines = input.split('\n');
      const uniqueDomains = new Set<string>();
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Logic: extract domain before :"v=spf1
        if (trimmed.includes(':"v=spf1')) {
          const domain = trimmed.split(':"v=spf1')[0].trim();
          if (domain) uniqueDomains.add(domain);
        } else if (trimmed.includes(':')) {
          // Fallback: if it doesn't have the exact string but has a colon, 
          // try to take the first part if it looks like a domain
          const firstPart = trimmed.split(':')[0].trim();
          if (firstPart && firstPart.includes('.')) {
            uniqueDomains.add(firstPart);
          }
        }
      });
      
      setResults(Array.from(uniqueDomains).sort());
      setIsProcessing(false);
    }, 300);
  };

  const copyResults = () => {
    navigator.clipboard.writeText(results.join('\n'));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const downloadResults = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const file = new Blob([results.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = `root_domains_${timestamp}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4" />
            SPF Record List
          </label>
          <div className="flex gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3 h-3" />
              Upload .txt
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => { setInput(''); setResults([]); }}
              className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
        <textarea
          className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm resize-none"
          placeholder='Paste records here...&#10;e.g. bitclubnetwork.com:"v=spf1 include:spf.efwd.registrar-servers.com ~all"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={extractRootDomains}
          disabled={!input.trim() || isProcessing}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isProcessing ? 'Extracting...' : 'Extract Root Domains'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Extracted Root Domains ({results.length})
            </h2>
            <div className="flex gap-3">
              <button
                onClick={copyResults}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 relative"
              >
                <Copy className="w-3 h-3" />
                {copyFeedback ? 'Copied!' : 'Copy Results'}
              </button>
              <button
                onClick={downloadResults}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download .txt
              </button>
              <button
                onClick={() => onExtract(results)}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                Send to Extractor
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {results.map((domain, i) => (
                <div key={i} className="text-xs font-mono text-gray-600 truncate py-1 border-b border-gray-100 last:border-0">
                  {domain}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IncludesSearch = ({ onExtract }: { onExtract: (domains: string[]) => void }) => {
  const [input, setInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [isGoogleAuthenticated, setIsGoogleAuthenticated] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error', message: string, url?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkGoogleAuth();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS') {
        setIsGoogleAuthenticated(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkGoogleAuth = async () => {
    try {
      const response = await axios.get('/api/auth/google/status');
      setIsGoogleAuthenticated(response.data.isAuthenticated);
    } catch (error) {
      console.error('Error checking Google auth status:', error);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await axios.get('/api/auth/google/url');
      const { url } = response.data;
      window.open(url, 'google_auth_popup', 'width=600,height=700');
    } catch (error) {
      console.error('Error getting Google auth URL:', error);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await axios.post('/api/auth/google/logout');
      setIsGoogleAuthenticated(false);
    } catch (error) {
      console.error('Error logging out from Google:', error);
    }
  };

  const exportToSheets = async () => {
    if (!isGoogleAuthenticated) {
      handleGoogleLogin();
      return;
    }

    setIsExporting(true);
    setExportFeedback(null);

    try {
      // 1. Create a new Spreadsheet
      const createResponse = await axios.post('/api/sheets/create', {
        title: `SPF Search Results - ${new Date().toLocaleString()}`
      });
      
      const { spreadsheetId, spreadsheetUrl } = createResponse.data;

      // 2. Format results for Google Sheets: [domaine PROD, mechanism, Domaine racine]
      // Current format in state: "rootDomain | mechanism | includedValue"
      const values = results.map(r => {
        const [rootDomain, mechanism, includedValue] = r.split(' | ');
        return [includedValue, mechanism, rootDomain];
      });

      // 3. Append values
      await axios.post('/api/sheets/append', {
        spreadsheetId,
        values
      });

      setExportFeedback({ 
        type: 'success', 
        message: 'Successfully created and exported to Google Sheets!',
        url: spreadsheetUrl
      });
      setTimeout(() => setExportFeedback(null), 10000);
    } catch (error: any) {
      console.error('Error exporting to Google Sheets:', error);
      setExportFeedback({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to export to Google Sheets' 
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(prev => prev ? `${prev}\n${content}` : content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const searchIncludes = () => {
    if (!searchTerm.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      const lines = input.split('\n');
      const searchDomains = searchTerm.split(/[\n,; ]+/).map(d => d.trim().toLowerCase()).filter(d => d);
      const matchingLines = new Set<string>();
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Extract root domain from line (format is usually domain:"record" or domain:record)
        let rootDomain = '';
        if (trimmed.includes(':')) {
          rootDomain = trimmed.split(':')[0].trim().replace(/^["']|["']$/g, '');
        } else {
          rootDomain = trimmed.split(' ')[0].trim();
        }

        // Regex to find mechanisms and their values
        const regex = /(include|a|mx|ptr|exists|ip4|ip6):([^\s]+)/gi;
        let match;
        while ((match = regex.exec(trimmed)) !== null) {
          const mechanism = match[1].toLowerCase();
          const includedValue = match[2].replace(/[;,"']$/, '').toLowerCase();
          
          // Check if includedValue matches any of our searchDomains
          if (searchDomains.some(sd => includedValue.includes(sd))) {
            matchingLines.add(`${rootDomain} | ${mechanism} | ${includedValue}`);
          }
        }
      });
      
      setResults(Array.from(matchingLines).sort());
      setIsProcessing(false);
    }, 300);
  };

  const copyResults = () => {
    navigator.clipboard.writeText(results.join('\n'));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const downloadResults = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const file = new Blob([results.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = `includes_search_results_${timestamp}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-teal-600" />
            Includes Search (Bulk)
          </label>
          <div className="flex gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3 h-3" />
              Upload .txt
            </button>
            <input type="file" ref={fileInputRef} accept=".txt" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => { setInput(''); setResults([]); setSearchTerm(''); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors">
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
        
        <div className="mb-4">
          <textarea
            className="w-full h-24 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all outline-none text-sm resize-none font-mono"
            placeholder="Enter domains to search for in includes (one per line)...&#10;e.g. spf.google.com&#10;spf.protection.outlook.com"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <textarea
          className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all resize-none font-mono text-sm outline-none"
          placeholder='Paste records here...&#10;example.com:"v=spf1 include:spf.google.com ~all"'
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={searchIncludes}
          disabled={!input.trim() || !searchTerm.trim() || isProcessing}
          className="w-full mt-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-teal-200 flex items-center justify-center gap-2"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isProcessing ? 'Searching...' : 'Search Includes'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Matching Results ({results.length})
            </h2>
            <div className="flex gap-3">
              <button onClick={copyResults} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 relative">
                <Copy className="w-3 h-3" />
                {copyFeedback ? 'Copied!' : 'Copy Results'}
              </button>
              <button 
                onClick={exportToSheets} 
                disabled={isExporting}
                className={`text-xs flex items-center gap-1 transition-colors ${isGoogleAuthenticated ? 'text-green-600 hover:text-green-700' : 'text-blue-600 hover:text-blue-700'}`}
              >
                {isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <TableProperties className="w-3 h-3" />}
                {isGoogleAuthenticated ? 'Export to Sheets' : 'Connect Google Sheets'}
              </button>
              {isGoogleAuthenticated && (
                <button onClick={handleGoogleLogout} className="text-xs text-gray-400 hover:text-red-500 transition-colors" title="Logout from Google">
                  <LogOut className="w-3 h-3" />
                </button>
              )}
              <button onClick={downloadResults} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Download className="w-3 h-3" />
                Download .txt
              </button>
              <button
                onClick={() => onExtract(results)}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                <Globe className="w-3 h-3" />
                Send to Extractor
              </button>
            </div>
          </div>

          {exportFeedback && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${exportFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
            >
              {exportFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {exportFeedback.message}
              {exportFeedback.url && (
                <a 
                  href={exportFeedback.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-auto underline flex items-center gap-1"
                >
                  Open Sheet <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          )}

          <div className="max-h-64 overflow-y-auto bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-3 gap-4 text-[10px] uppercase tracking-wider font-bold text-gray-400 border-b pb-2 mb-2">
                <div>Domaine Racine</div>
                <div>Mechanism</div>
                <div>Domaines Include</div>
              </div>
              {results.map((d, i) => {
                const parts = d.split(' | ');
                return (
                  <div key={i} className="grid grid-cols-3 gap-4 text-xs font-mono text-gray-600 py-1 border-b border-gray-100 last:border-0">
                    <div className="truncate">{parts[0]}</div>
                    <div className="text-teal-600 font-medium">{parts[1]}</div>
                    <div className="truncate">{parts[2]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DNSSPFChecker = ({ onExtractFromSPF }: { onExtractFromSPF: (results: SPFResult[]) => void }) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SPFResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(prev => prev ? `${prev}\n${content}` : content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const checkSPF = async () => {
    const domains = input.split(/[\n,; ]+/).map(d => d.trim().toLowerCase()).filter(d => d);
    if (domains.length === 0) return;

    setIsChecking(true);
    setProgress(0);
    const initialResults: SPFResult[] = domains.map(domain => ({ domain, status: 'pending' }));
    setResults(initialResults);

    const BATCH_SIZE = 10; // Process in small batches for browser performance
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (domain, batchIdx) => {
        const globalIdx = i + batchIdx;
        setResults(prev => prev.map((r, idx) => idx === globalIdx ? { ...r, status: 'loading' } : r));

        try {
          const response = await axios.get(`/api/dns-spf-check?domain=${domain}`);
          const data = response.data;
          
          setResults(prev => prev.map((r, idx) => idx === globalIdx ? { 
            ...r, 
            status: data.status, 
            record: data.record,
            passed: data.status === 'success'
          } : r));
        } catch (error: any) {
          setResults(prev => prev.map((r, idx) => idx === globalIdx ? { 
            ...r, 
            status: 'error', 
            error: 'DNS lookup failed' 
          } : r));
        }
      }));
      
      setProgress(Math.round(((i + batch.length) / domains.length) * 100));
      // Small pause between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setIsChecking(false);
  };

  const [copyFeedback, setCopyFeedback] = useState(false);

  const copyResults = () => {
    const content = results.map(r => `${r.domain}, ${r.record || r.status}`).join('\n');
    navigator.clipboard.writeText(content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const downloadResults = () => {
    const content = results.map(r => `${r.domain}, ${r.record || r.status}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns_spf_records_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-600" />
            DNS SPF Extractor (Python-style)
          </label>
          <div className="flex gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3 h-3" />
              Upload .txt
            </button>
            <input type="file" ref={fileInputRef} accept=".txt" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => { setInput(''); setResults([]); setProgress(0); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
        <textarea
          className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-mono text-sm resize-none"
          placeholder="Enter domains to extract SPF records from (one per line)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={checkSPF}
          disabled={!input.trim() || isChecking}
          className="w-full mt-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-200"
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
          {isChecking ? `Processing... ${progress}%` : 'Start DNS Extraction'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Extraction Results</h2>
            <div className="flex gap-4">
              <button
                onClick={copyResults}
                disabled={isChecking || results.length === 0}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50 relative"
              >
                <Copy className="w-3 h-3" />
                {copyFeedback ? 'Copied!' : 'Copy Results'}
              </button>
              <button
                onClick={() => onExtractFromSPF(results)}
                disabled={isChecking || results.length === 0}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Globe className="w-3 h-3" />
                Extract Domains from Results
              </button>
              <button
                onClick={downloadResults}
                disabled={isChecking}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                Download .txt
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">SPF Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((res, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{res.domain}</td>
                    <td className="px-4 py-3">
                      {res.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
                      {res.status === 'success' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                          FOUND
                        </span>
                      )}
                      {res.status === 'no-spf' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                          NO SPF
                        </span>
                      )}
                      {res.status === 'not-found' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">
                          NOT FOUND
                        </span>
                      )}
                      {res.status === 'error' && <span className="text-red-500 text-[10px]">Error</span>}
                      {res.status === 'pending' && <span className="text-gray-300 text-[10px]">Waiting...</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-500 truncate max-w-xs" title={res.record}>
                      {res.record || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 flex items-start gap-3">
        <FileText className="w-5 h-5 text-purple-500 mt-0.5" />
        <div className="text-xs text-purple-800 space-y-1">
          <p className="font-semibold">DNS Extraction Logic:</p>
          <p>This tool mimics the Python script by performing direct DNS TXT lookups and filtering for 'v=spf1'. It's faster for raw extraction and doesn't require an external API key.</p>
        </div>
      </div>
    </div>
  );
};

const DomainExtractor = ({ 
  input, setInput, results, setResults, isProcessing, setIsProcessing, 
  fileInputRef, handleFileUpload, extractDomains, clearAll, 
  copyToClipboard, downloadTxt, copyFeedback, copyInput, downloadInput, 
  inputCopyFeedback, checkNamecheap, isCheckingNamecheap, namecheapResults,
  namecheapError
}: any) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <section className="space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <label htmlFor="subdomains" className="text-sm font-medium flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Input List
            </label>
            <div className="flex gap-3">
              <button 
                onClick={copyInput}
                disabled={!input.trim()}
                className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 transition-colors relative"
              >
                <Copy className="w-3 h-3" />
                {inputCopyFeedback ? 'Copied!' : 'Copy'}
              </button>
              <button 
                onClick={downloadInput}
                disabled={!input.trim()}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
              >
                <Upload className="w-3 h-3" />
                Upload .txt
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button 
                onClick={clearAll}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
            </div>
          </div>
          <textarea
            id="subdomains"
            className="w-full h-64 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none font-mono text-sm outline-none"
            placeholder="Paste subdomains here...&#10;e.g. sub.example.com&#10;https://another.sub.domain.co.uk"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            onClick={extractDomains}
            disabled={!input.trim() || isProcessing}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
          >
            {isProcessing ? 'Processing...' : 'Extract Domains'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              We'll automatically clean protocols, paths, and ports. Results are always unique (no duplicates).
            </p>
          </div>
          <div className="flex items-start gap-3 border-t border-blue-100 pt-3">
            <ShieldCheck className="w-5 h-5 text-amber-500 mt-0.5" />
            <div className="text-xs text-amber-800 space-y-1">
              <p className="font-semibold">Namecrawl API Note:</p>
              <p>Domain availability check is powered by Namecrawl.dev API.</p>
            </div>
          </div>
          {results.length > 5000 && (
            <div className="flex items-start gap-3 border-t border-blue-100 pt-3">
              <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed font-medium">
                Large list detected: Results will be split into multiple .txt files (5,000 domains each) when downloading.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Results Section */}
      <section className="space-y-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Results
              {results.length > 0 && (
                <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
                  {results.length} Unique
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={checkNamecheap}
                disabled={results.length === 0 || isCheckingNamecheap}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isCheckingNamecheap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Namecrawl Check
              </button>
              <button
                onClick={copyToClipboard}
                disabled={results.length === 0}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 relative"
                title="Copy to clipboard"
              >
                <Copy className="w-4 h-4" />
                <AnimatePresence>
                  {copyFeedback && (
                    <motion.span
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] py-1 px-2 rounded whitespace-nowrap"
                    >
                      Copied!
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <button
                onClick={downloadTxt}
                disabled={results.length === 0}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                title="Download .txt"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {namecheapError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-[10px]">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="font-bold">Namecrawl Check Failed</p>
                <p>{namecheapError}</p>
              </div>
            </div>
          )}

          <div className="flex-grow bg-gray-50 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            {results.length > 0 ? (
              <div className="overflow-y-auto p-4 font-mono text-sm space-y-1 max-h-[320px]">
                {results.map((domain: string, idx: number) => {
                  const nc = namecheapResults[domain];
                  return (
                    <div key={idx} className="flex items-center justify-between group py-1 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors">
                        <span className="text-[10px] text-gray-300 w-6 text-right">{idx + 1}</span>
                        {domain}
                      </div>
                      {nc && (
                        <div className="flex items-center gap-2">
                          {nc.available ? (
                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
                              AVAILABLE {nc.price !== 'N/A' && `($${nc.price})`}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                              TAKEN
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 opacity-20" />
                </div>
                <p className="text-xs">Extracted domains will appear here.</p>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <button
              onClick={downloadTxt}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 font-medium py-3 rounded-xl transition-all active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              {results.length > 5000 
                ? `Download ${Math.ceil(results.length / 5000)} Files (5k each)` 
                : 'Download Results (.txt)'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

const SPFChecker = ({ onExtractFromSPF }: { onExtractFromSPF: (results: SPFResult[]) => void }) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SPFResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(prev => prev ? `${prev}\n${content}` : content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const checkSPF = async () => {
    const domains = input.split(/[\n,; ]+/).map(d => d.trim().toLowerCase()).filter(d => d);
    if (domains.length === 0) return;

    setIsChecking(true);
    const initialResults: SPFResult[] = domains.map(domain => ({ domain, status: 'pending' }));
    setResults(initialResults);

    // Process domains (with a bit of delay to not overwhelm the proxy/api)
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'loading' } : r));

      try {
        const response = await axios.get(`/api/spf-check?domain=${domain}`);
        const data = response.data;
        
        // MXToolbox API returns results in an Information array
        // We need to find the full SPF record string
        let spfRecord = 'No record found';
        if (data.Information && Array.isArray(data.Information)) {
          // 1. Look for any value that contains "v=spf1" (the standard prefix)
          const fullRecord = data.Information.find((info: any) => 
            info.Value && info.Value.toLowerCase().includes('v=spf1')
          );
          
          if (fullRecord) {
            spfRecord = fullRecord.Value;
          } else {
            // 2. Look for values that look like SPF components (include:, ip4:, etc.)
            const componentRecord = data.Information.find((info: any) => 
              info.Value && (
                info.Value.toLowerCase().includes('include:') || 
                info.Value.toLowerCase().includes('ip4:') ||
                info.Value.toLowerCase().includes('~all') ||
                info.Value.toLowerCase().includes('-all')
              )
            );
            
            if (componentRecord) {
              spfRecord = componentRecord.Value;
            } else {
              // 3. Fallback: Find the longest value that isn't just a short label
              const candidates = data.Information
                .map((info: any) => info.Value || '')
                .filter((val: string) => val.length > 10); // SPF records are usually long
              
              if (candidates.length > 0) {
                // Sort by length descending and pick the longest
                spfRecord = candidates.sort((a, b) => b.length - a.length)[0];
              } else if (data.Information[0]?.Value) {
                spfRecord = data.Information[0].Value;
              }
            }
          }
        }

        setResults(prev => prev.map((r, idx) => idx === i ? { 
          ...r, 
          status: 'success', 
          passed: data.Passed,
          record: spfRecord
        } : r));
      } catch (error: any) {
        setResults(prev => prev.map((r, idx) => idx === i ? { 
          ...r, 
          status: 'error', 
          error: error.response?.data?.error || 'Check failed' 
        } : r));
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    setIsChecking(false);
  };

  const [copyFeedback, setCopyFeedback] = useState(false);

  const copyResults = () => {
    const content = results.map(r => `${r.domain}, ${r.passed ? 'PASSED' : 'FAILED'}, ${r.record || ''}`).join('\n');
    navigator.clipboard.writeText(content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const downloadResults = () => {
    const csvContent = [
      ['Domain', 'SPF Passed', 'Record', 'Error'].join(','),
      ...results.map(r => [
        r.domain,
        r.passed ? 'YES' : 'NO',
        `"${(r.record || '').replace(/"/g, '""')}"`,
        `"${(r.error || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spf_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            Bulk SPF Check
          </label>
          <div className="flex gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3 h-3" />
              Upload .txt
            </button>
            <input type="file" ref={fileInputRef} accept=".txt" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => { setInput(''); setResults([]); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
        <textarea
          className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm resize-none"
          placeholder="Enter domains to check (one per line)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={checkSPF}
          disabled={!input.trim() || isChecking}
          className="w-full mt-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isChecking ? 'Checking SPF Records...' : 'Start Bulk Check'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Check Results</h2>
            <div className="flex gap-4">
              <button
                onClick={copyResults}
                disabled={isChecking || results.length === 0}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50 relative"
              >
                <Copy className="w-3 h-3" />
                {copyFeedback ? 'Copied!' : 'Copy Results'}
              </button>
              <button
                onClick={() => onExtractFromSPF(results)}
                disabled={isChecking || results.length === 0}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Globe className="w-3 h-3" />
                Extract Domains from Results
              </button>
              <button
                onClick={downloadResults}
                disabled={isChecking}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                Download CSV
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">SPF Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((res, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{res.domain}</td>
                    <td className="px-4 py-3">
                      {res.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                      {res.status === 'success' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${res.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {res.passed ? 'PASSED' : 'FAILED'}
                        </span>
                      )}
                      {res.status === 'error' && <span className="text-red-500 text-[10px]">{res.error}</span>}
                      {res.status === 'pending' && <span className="text-gray-300 text-[10px]">Waiting...</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-gray-500 truncate max-w-xs" title={res.record}>
                      {res.record || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-semibold">Important Note:</p>
          <p>This tool uses the MXToolbox API. If no API key is configured in the environment, it will return mock data for demonstration purposes.</p>
          <a href="https://mxtoolbox.com/api.aspx" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-amber-900 underline hover:no-underline">
            Get an API key here <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const WhoisSearch = () => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(prev => prev ? `${prev}\n${content}` : content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const performWhois = async () => {
    const domains = input.split(/[\n,; ]+/).map(d => d.trim().toLowerCase()).filter(d => d);
    if (domains.length === 0) return;

    setIsLoading(true);
    setError(null);
    setResults([]);
    setProgress(0);

    const newResults: any[] = [];
    
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      try {
        const response = await axios.get('/api/whois', { params: { domain } });
        newResults.push(response.data);
      } catch (err: any) {
        newResults.push({
          domain,
          error: err.response?.data?.error || err.message || 'Lookup failed',
          details: err.response?.data?.details
        });
      }
      setResults([...newResults]);
      setProgress(Math.round(((i + 1) / domains.length) * 100));
      
      // Small delay to avoid rate limiting
      if (domains.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    setIsLoading(false);
  };

  const downloadResults = () => {
    const csvContent = [
      ['Domain', 'Status', 'Registrar', 'Registration Date', 'Expiration Date', 'Nameservers'].join(','),
      ...results.map(r => [
        r.domain,
        r.available ? 'Available' : 'Registered',
        `"${(r.details?.entities || '').replace(/"/g, '""')}"`,
        r.details?.registrationDate || 'N/A',
        r.details?.expirationDate || 'N/A',
        `"${(r.details?.nameservers || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whois_results_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-indigo-600" />
            Bulk WHOIS / RDAP Lookup
          </label>
          <div className="flex gap-3">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
            >
              <Upload className="w-3 h-3" />
              Upload .txt
            </button>
            <input type="file" ref={fileInputRef} accept=".txt" className="hidden" onChange={handleFileUpload} />
            <button onClick={() => { setInput(''); setResults([]); setProgress(0); }} className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors">
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>
        <textarea
          className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none font-mono text-sm resize-none"
          placeholder="Enter domains (one per line, comma or space separated)..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={performWhois}
          disabled={isLoading || !input.trim()}
          className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {isLoading ? `Processing... ${progress}%` : 'Start Bulk Lookup'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <TableProperties className="w-4 h-4 text-indigo-600" />
              Lookup Results ({results.length})
            </h2>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowRaw(!showRaw)}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline"
              >
                {showRaw ? 'Hide Raw' : 'Show Raw'}
              </button>
              <button
                onClick={downloadResults}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50">
                <tr>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Registrar</th>
                  <th className="px-4 py-3">Expiration</th>
                  <th className="px-4 py-3">Nameservers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map((res, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-gray-700">
                      <div className="flex items-center gap-2">
                        {res.domain}
                        <a 
                          href={`https://who.is/whois/${res.domain}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400 hover:text-indigo-600"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {res.error ? (
                        <span className="text-[10px] text-red-500 flex items-center gap-1" title={res.details}>
                          <AlertCircle className="w-3 h-3" /> Error
                        </span>
                      ) : res.available ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                          AVAILABLE
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
                          TAKEN
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 truncate max-w-[150px]">
                      {res.details?.entities || '-'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500">
                      {res.details?.expirationDate ? new Date(res.details.expirationDate).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-[10px] font-mono text-gray-400 truncate max-w-[150px]">
                      {res.details?.nameservers || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showRaw && results.length > 0 && (
            <div className="mt-6 bg-gray-900 text-gray-300 p-4 rounded-xl overflow-auto max-h-96 text-[10px] font-mono">
              <pre>{JSON.stringify(results, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('extractor');
  
  // Extractor State
  const [input, setInput] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [namecheapResults, setNamecheapResults] = useState<Record<string, NamecheapResult>>({});
  const [isCheckingNamecheap, setIsCheckingNamecheap] = useState(false);
  const [namecheapError, setNamecheapError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [inputCopyFeedback, setInputCopyFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractDomainsFromSPFResults = useCallback((spfResults: SPFResult[]) => {
    const extractedLines = new Set<string>();
    
    spfResults.forEach(res => {
      if (res.record && res.record.toLowerCase().includes('v=spf1')) {
        // Regex to find include:, a:, mx:, ptr:, exists: followed by a domain
        // Capture the mechanism (include, a, mx, etc.) in the first group
        const matches = res.record.matchAll(/(include|a|mx|ptr|exists):([^ ]+)/gi);
        for (const match of matches) {
          const mechanism = match[1].toLowerCase();
          // Clean the hostname: remove CIDR prefixes and trailing punctuation
          let hostname = match[2].trim().toLowerCase().split('/')[0].replace(/[;,"']$/, '');
          
          // Basic validation: must contain a dot and not be an IP
          if (hostname.includes('.') && !/^[0-9.]+$/.test(hostname) && !hostname.includes(':')) {
            const domainParts = hostname.split('.');
            if (domainParts.length >= 2) {
              // Python logic: Join the last two parts
              const rootDomain = domainParts.slice(-2).join('.');
              // New Format: Domain | mechanism | Domain in record
              extractedLines.add(`${res.domain} | ${mechanism} | ${rootDomain}`);
            }
          }
        }
      }
    });

    if (extractedLines.size > 0) {
      const resultList = Array.from(extractedLines).join('\n');
      setInput(prev => prev ? `${prev}\n${resultList}` : resultList);
      setCurrentPage('extractor');
    }
  }, []);

  const extractDomains = useCallback(() => {
    setIsProcessing(true);
    setTimeout(() => {
      const lines = input.split('\n');
      const uniqueDomains = new Set<string>();
      lines.forEach(line => {
        let hostname = line.trim().toLowerCase();
        if (!hostname) return;

        // If it's a comma or pipe separated line (from SPF extraction), take the last part
        if (hostname.includes(',') || hostname.includes('|')) {
          const parts = hostname.split(/[|]/);
          // If pipe split resulted in only 1 part, try comma
          if (parts.length > 1) {
            hostname = parts[parts.length - 1].trim();
          } else {
            const commaParts = hostname.split(',');
            hostname = commaParts[commaParts.length - 1].trim();
          }
        }

        // Clean: remove protocol, path, port
        hostname = hostname.replace(/^(https?:\/\/)/, '').split('/')[0].split('?')[0].split(':')[0];
        
        // Python-style root domain extraction: Join the last two parts
        const domainParts = hostname.split('.');
        if (domainParts.length >= 2) {
          const rootDomain = domainParts.slice(-2).join('.');
          uniqueDomains.add(rootDomain);
        }
      });
      setResults(Array.from(uniqueDomains).sort());
      setIsProcessing(false);
    }, 100);
  }, [input]);

  const checkNamecheap = useCallback(async () => {
    if (results.length === 0) return;
    setIsCheckingNamecheap(true);
    setNamecheapError(null);
    
    // Namecheap allows up to 50 domains per request
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < results.length; i += CHUNK_SIZE) {
      chunks.push(results.slice(i, i + CHUNK_SIZE));
    }

    const newResults: Record<string, NamecheapResult> = { ...namecheapResults };

    for (const chunk of chunks) {
      try {
        const response = await axios.get('/api/domain-check', {
          params: { domains: chunk.join(',') }
        });
        
        if (Array.isArray(response.data)) {
          response.data.forEach((res: NamecheapResult) => {
            newResults[res.domain] = res;
          });
        }
        
        setNamecheapResults({ ...newResults });
      } catch (error: any) {
        console.error('Error checking Namecrawl:', error);
        const errorMsg = error.response?.data?.details || error.response?.data?.error || error.message;
        setNamecheapError(errorMsg);
        break; // Stop on first error
      }
    }
    
    setIsCheckingNamecheap(false);
  }, [results, namecheapResults]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(prev => prev ? `${prev}\n${content}` : content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTxt = () => {
    const CHUNK_SIZE = 5000;
    const timestamp = new Date().toISOString().split('T')[0];
    if (results.length <= CHUNK_SIZE) {
      const file = new Blob([results.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url; a.download = `extracted_domains_${timestamp}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
      for (let i = 0; i < results.length; i += CHUNK_SIZE) {
        const chunk = results.slice(i, i + CHUNK_SIZE);
        const part = Math.floor(i / CHUNK_SIZE) + 1;
        const total = Math.ceil(results.length / CHUNK_SIZE);
        const file = new Blob([chunk.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url; a.download = `extracted_domains_${timestamp}_part${part}_of_${total}.txt`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(results.join('\n'));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const copyInput = () => {
    navigator.clipboard.writeText(input);
    setInputCopyFeedback(true);
    setTimeout(() => setInputCopyFeedback(false), 2000);
  };

  const downloadInput = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const file = new Blob([input], { type: 'text/plain' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = `input_list_${timestamp}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const clearAll = () => { setInput(''); setResults([]); };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-light tracking-tight flex items-center gap-2">
              <Globe className="w-8 h-8 text-blue-600" />
              EMS3 MailIntel Suite
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Professional tools for EMS3 domain management.
            </p>
          </div>
          
          <nav className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <button
              onClick={() => setCurrentPage('extractor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentPage === 'extractor' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Extractor
            </button>
            <button
              onClick={() => setCurrentPage('spf')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentPage === 'spf' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              SPF Checker
            </button>
            <button
              onClick={() => setCurrentPage('dns-spf')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentPage === 'dns-spf' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              DNS SPF Extractor
            </button>
            <button
              onClick={() => setCurrentPage('root-extractor')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentPage === 'root-extractor' ? 'bg-amber-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Root Extractor
            </button>
            <button
              onClick={() => setCurrentPage('includes-search')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentPage === 'includes-search' ? 'bg-teal-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Includes Search
            </button>
            <button
              onClick={() => setCurrentPage('whois-search')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${currentPage === 'whois-search' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}
            >
              WHOIS Lookup
            </button>
          </nav>
        </header>

        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentPage === 'extractor' && (
                <DomainExtractor 
                  input={input} setInput={setInput}
                  results={results} setResults={setResults}
                  isProcessing={isProcessing} setIsProcessing={setIsProcessing}
                  fileInputRef={fileInputRef} handleFileUpload={handleFileUpload}
                  extractDomains={extractDomains} clearAll={clearAll}
                  copyToClipboard={copyToClipboard} downloadTxt={downloadTxt}
                  copyFeedback={copyFeedback}
                  copyInput={copyInput} downloadInput={downloadInput}
                  inputCopyFeedback={inputCopyFeedback}
                  checkNamecheap={checkNamecheap}
                  isCheckingNamecheap={isCheckingNamecheap}
                  namecheapResults={namecheapResults}
                  namecheapError={namecheapError}
                />
              )}
              {currentPage === 'spf' && <SPFChecker onExtractFromSPF={extractDomainsFromSPFResults} />}
              {currentPage === 'dns-spf' && <DNSSPFChecker onExtractFromSPF={extractDomainsFromSPFResults} />}
              {currentPage === 'root-extractor' && (
                <RootDomainExtractor 
                  onExtract={(domains) => {
                    setInput(prev => prev ? `${prev}\n${domains.join('\n')}` : domains.join('\n'));
                    setCurrentPage('extractor');
                  }} 
                />
              )}
              {currentPage === 'includes-search' && (
                <IncludesSearch 
                  onExtract={(domains) => {
                    setInput(prev => prev ? `${prev}\n${domains.join('\n')}` : domains.join('\n'));
                    setCurrentPage('extractor');
                  }} 
                />
              )}
              {currentPage === 'whois-search' && <WhoisSearch />}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="mt-12 pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2026 EMS3 MailIntel Suite</p>
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              System Ready
            </span>
            <span>Professional tools for EMS3 domain management.</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
