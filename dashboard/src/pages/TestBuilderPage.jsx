import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Plus, Save, ArrowLeft, Terminal, LayoutList, Download, Code, Globe, X, GitBranch, GitPullRequest, CloudUpload, Shield, BookOpen, Search, Copy, PlusCircle, FolderPlus, Folder, FolderOpen, ChevronDown, ChevronRight, Wand2 } from 'lucide-react';
import StepCard from '../components/StepCard';
import { testCaseService } from '../services/testCase';
import { gitService } from '../services/git';
import { globalTestState } from '../services/globalTestState';

const parseHeaders = (headersStr) => {
  if (!headersStr) return {};
  const trimmed = headersStr.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // JSON parsing failed, fallback to line-based parsing
    }
  }

  const headers = {};
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    // Support both Key: Value and Key = Value
    const match = cleanLine.match(/^([^:=]+)[:=](.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      headers[key] = val;
    }
  }
  return headers;
};

const parseVariables = (varsStr) => {
  if (!varsStr) return {};
  const trimmed = varsStr.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      // JSON parsing failed, fallback to line-based parsing
    }
  }

  const vars = {};
  const lines = trimmed.split('\n');
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(/^([^:=]+)[:=](.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      vars[key] = val;
    }
  }
  return vars;
};

const validateJsonByExample = (actual, expected, path = '$') => {
  const errors = [];
  const warnings = [];

  if (actual === undefined) {
    errors.push(`Target path '${path}' was not found in the response`);
    return { errors, warnings };
  }

  const walk = (act, exp, currentPath) => {
    if (exp === null || exp === undefined) return;
    if (act === null || act === undefined) return;

    const expType = Array.isArray(exp) ? 'array' : typeof exp;
    const actType = Array.isArray(act) ? 'array' : typeof act;

    if (actType !== expType) {
      errors.push(`Type mismatch at ${currentPath}: Expected '${expType}', but got '${actType}'`);
      return;
    }

    if (expType === 'object') {
      // Check for missing properties
      for (const key of Object.keys(exp)) {
        if (!(key in act)) {
          errors.push(`Missing property '${key}' at ${currentPath}`);
        } else {
          walk(act[key], exp[key], `${currentPath}.${key}`);
        }
      }

      // Check for extra properties
      for (const key of Object.keys(act)) {
        if (!(key in exp)) {
          warnings.push(`Extra property '${key}' detected at ${currentPath}`);
        }
      }
    } else if (expType === 'array') {
      if (exp.length > 0) {
        const itemTemplate = exp[0];
        act.forEach((item, idx) => {
          walk(item, itemTemplate, `${currentPath}[${idx}]`);
        });
      }
    }
  };

  walk(actual, expected, path);
  return { errors, warnings };
};

const getValueByPath = (obj, jsonPath) => {
  if (!jsonPath || jsonPath === '$' || jsonPath === 'body') return obj;
  
  let cleanPath = jsonPath.replace(/\[(\d+)\]/g, '.$1');
  cleanPath = cleanPath.replace(/^\$\.?/, '');
  if (cleanPath.startsWith('.')) {
    cleanPath = cleanPath.substring(1);
  }
  if (!cleanPath) return obj;

  const wildcardIndex = cleanPath.indexOf('[*]');
  if (wildcardIndex !== -1) {
    const leftPath = cleanPath.substring(0, wildcardIndex);
    let rightPath = cleanPath.substring(wildcardIndex + 3);
    if (rightPath.startsWith('.')) {
      rightPath = rightPath.substring(1);
    }

    const val = getValueByPath(obj, leftPath);
    if (Array.isArray(val)) {
      if (!rightPath) return val;
      return val.map(item => getValueByPath(item, rightPath));
    }
    return undefined;
  }

  return cleanPath.split('.').reduce((acc, part) => acc && acc[part], obj);
};

const stepMetadata = {
  "I am using {string} service": {
    en: { name: "Use Service", desc: "Sets the active microservice base URL." },
    tr: { name: "Servis Belirle", desc: "Aktif mikroservis adresini tanımlar." }
  },
  "I set default mobile headers": {
    en: { name: "Set Mobile Headers", desc: "Adds standard mobile device headers to the request." },
    tr: { name: "Mobil Başlıkları Tanımla", desc: "Standart mobil cihaz başlıklarını isteğe ekler." }
  },
  "I set header {string} to {string}": {
    en: { name: "Set Header", desc: "Adds a custom key-value header to the request." },
    tr: { name: "Başlık Ekle", desc: "İsteğe özel bir anahtar-değer başlığı ekler." }
  },
  "I remove header {string}": {
    en: { name: "Remove Header", desc: "Deletes a header from the request." },
    tr: { name: "Başlığı Kaldır", desc: "İstekten belirli bir başlığı siler." }
  },
  "I am authenticated with token {string}": {
    en: { name: "Auth with Raw Token", desc: "Sets the authorization header with a raw token." },
    tr: { name: "Ham Token ile Giriş", desc: "Erişim token'ını yetkilendirme başlığına ekler." }
  },
  "I am authenticated with {string}": {
    en: { name: "Auth with Method", desc: "Authenticates using a configured OAuth/Login method." },
    tr: { name: "Giriş Yöntemi ile Giriş", desc: "Tanımlı bir giriş yöntemi ile yetkilendirme yapar." }
  },
  "I have stored {string} as {string}": {
    en: { name: "Store Variable", desc: "Stores a local variable for use in steps." },
    tr: { name: "Değişken Sakla", desc: "Adımlarda kullanmak üzere yerel değişken kaydeder." }
  },
  "the response status should be {int}": {
    en: { name: "Verify Status Code", desc: "Checks if the response HTTP status code matches." },
    tr: { name: "Durum Kodunu Doğrula", desc: "Sunucudan dönen HTTP durum kodunu kontrol eder." }
  },
  "the response {string} should be {string}": {
    en: { name: "Verify String Field", desc: "Validates a string value at a JSON path in response." },
    tr: { name: "Metin Alanı Doğrula", desc: "Yanıttaki JSON yolunda bulunan metin değerini doğrular." }
  },
  "the response {string} should be {int}": {
    en: { name: "Verify Numeric Field", desc: "Validates a numeric value at a JSON path in response." },
    tr: { name: "Sayısal Alanı Doğrula", desc: "Yanıttaki JSON yolunda bulunan sayısal değeri doğrular." }
  },
  "I wait for {long} seconds": {
    en: { name: "Wait", desc: "Pauses test execution for the given seconds." },
    tr: { name: "Bekle", desc: "Testi belirtilen saniye kadar duraklatır." }
  },
  "I generate a random phone number as {string}": {
    en: { name: "Generate Random Phone", desc: "Generates a random phone number and stores it." },
    tr: { name: "Rastgele Telefon Üret", desc: "Rastgele bir telefon numarası üreterek kaydeder." }
  },
  "I generate a random email as {string}": {
    en: { name: "Generate Random Email", desc: "Generates a random email address and stores it." },
    tr: { name: "Rastgele E-posta Üret", desc: "Rastgele bir e-posta adresi üreterek kaydeder." }
  },
  "I generate a random slug as {string}": {
    en: { name: "Generate Random Slug", desc: "Generates a random slug and stores it." },
    tr: { name: "Rastgele Slug Üret", desc: "Rastgele bir slug metni üreterek kaydeder." }
  },
  "I generate a random timestamp as {string}": {
    en: { name: "Generate Random Timestamp", desc: "Generates a random timestamp and stores it." },
    tr: { name: "Rastgele Zaman Damgası Üret", desc: "Rastgele bir zaman damgası üreterek kaydeder." }
  },
  "I generate a random {int} digit number as {string}": {
    en: { name: "Generate Random Number", desc: "Generates a random digit number and stores it." },
    tr: { name: "Rastgele Sayı Üret", desc: "Belirtilen basamakta rastgele sayı üreterek kaydeder." }
  },
  "I save {string} as global variable {string}": {
    en: { name: "Save Global Variable", desc: "Saves a value to global test variables." },
    tr: { name: "Global Değişken Kaydet", desc: "Bir değeri tüm senaryolarda ortak kullanılacak şekilde kaydeder." }
  },
  "I load global variable {string} as {string}": {
    en: { name: "Load Global Variable", desc: "Loads a global variable value into a local variable." },
    tr: { name: "Global Değişken Yükle", desc: "Global bir değişkeni yerel teste yükler." }
  },
  "I store {string} as {string}": {
    en: { name: "Store Field Value", desc: "Extracts a response field and stores it locally." },
    tr: { name: "Yanıt Alanını Kaydet", desc: "Yanıttaki belirli bir alanı değişkene aktarır." }
  },
  "I store response body as {string}": {
    en: { name: "Store Whole Response", desc: "Saves the entire response body into a variable." },
    tr: { name: "Tüm Yanıtı Kaydet", desc: "Gelen tüm yanıt gövdesini değişkene aktarır." }
  },
  "I store the cookie {string} as {string}": {
    en: { name: "Store Cookie", desc: "Extracts a cookie value and stores it locally." },
    tr: { name: "Çerezi Kaydet", desc: "Yanıttaki bir çerez değerini değişkene aktarır." }
  },
  "{word} uses {string} service": {
    en: { name: "Use Service", desc: "Sets the active microservice base URL." },
    tr: { name: "Servis Belirle", desc: "Aktif mikroservis adresini tanımlar." }
  },
  "{word} sets header {string} to {string}": {
    en: { name: "Set Header", desc: "Adds a custom key-value header to the request." },
    tr: { name: "Başlık Ekle", desc: "İsteğe özel bir anahtar-değer başlığı ekler." }
  },
  "{word} sets the following headers:": {
    en: { name: "Set Multiple Headers", desc: "Adds multiple headers from a table to the request." },
    tr: { name: "Çoklu Başlık Ekle", desc: "Tablodaki birden fazla başlığı isteğe ekler." }
  },
  "{word} removes header {string}": {
    en: { name: "Remove Header", desc: "Deletes a header from the request." },
    tr: { name: "Başlığı Kaldır", desc: "İstekten belirli bir başlığı siler." }
  },
  "{word} sets default mobile headers": {
    en: { name: "Set Mobile Headers", desc: "Adds standard mobile device headers to the request." },
    tr: { name: "Mobil Başlıkları Tanımla", desc: "Standart mobil cihaz başlıklarını isteğe ekler." }
  },
  "{word} is authenticated with token {string}": {
    en: { name: "Auth with Raw Token", desc: "Sets the authorization header with a raw token." },
    tr: { name: "Ham Token ile Giriş", desc: "Erişim token'ını yetkilendirme başlığına ekler." }
  },
  "{word} is logged in as default": {
    en: { name: "Login as Default User", desc: "Logs in with the default credentials." },
    tr: { name: "Varsayılan Kullanıcı ile Giriş", desc: "Varsayılan kullanıcı bilgileriyle giriş yapar." }
  },
  "{word} is logged in with username {string} and password {string}": {
    en: { name: "Login with Credentials", desc: "Logs in with the specified username and password." },
    tr: { name: "Kullanıcı Bilgileriyle Giriş", desc: "Belirtilen kullanıcı adı ve şifreyle giriş yapar." }
  },
  "{word} has stored {string} as {string}": {
    en: { name: "Store Variable", desc: "Stores a local variable for use in steps." },
    tr: { name: "Değişken Sakla", desc: "Adımlarda kullanmak üzere yerel değişken kaydeder." }
  },
  "{word} sends {string} request to {string}": {
    en: { name: "Send Request", desc: "Sends an HTTP request to the specified endpoint." },
    tr: { name: "İstek Gönder", desc: "Belirtilen adrese HTTP isteği gönderir." }
  },
  "{word} sends {string} request to {string} with query params:": {
    en: { name: "Send Request with Query Params", desc: "Sends an HTTP request with query parameters." },
    tr: { name: "Sorgu Parametreleriyle İstek Gönder", desc: "Sorgu parametreleri içeren bir HTTP isteği gönderir." }
  },
  "{word} sends {string} request to {string} with body:": {
    en: { name: "Send Request with Body", desc: "Sends an HTTP request with a request body." },
    tr: { name: "Gövdeyle İstek Gönder", desc: "İstek gövdesi (body) içeren bir HTTP isteği gönderir." }
  },
  "response status code should be {int}": {
    en: { name: "Verify Status Code", desc: "Checks if the response HTTP status code matches." },
    tr: { name: "Durum Kodunu Doğrula", desc: "Sunucudan dönen HTTP durum kodunu kontrol eder." }
  },
  "{word} stores response {string} as {string}": {
    en: { name: "Store Field Value", desc: "Extracts a response field and stores it locally." },
    tr: { name: "Yanıt Alanını Kaydet", desc: "Yanıttaki belirli bir alanı değişkene aktarır." }
  },
  "{word} stores response body as {string}": {
    en: { name: "Store Whole Response", desc: "Saves the entire response body into a variable." },
    tr: { name: "Tüm Yanıtı Kaydet", desc: "Gelen tüm yanıt gövdesini değişkene aktarır." }
  },
  "{word} stores the cookie {string} as {string}": {
    en: { name: "Store Cookie", desc: "Extracts a cookie value and stores it locally." },
    tr: { name: "Çerezi Kaydet", desc: "Yanıttaki bir çerez değerini değişkene aktarır." }
  },
  "{word} stores response {string} as global variable {string}": {
    en: { name: "Store Global Variable", desc: "Saves a value to global test variables." },
    tr: { name: "Global Değişken Kaydet", desc: "Bir değeri tüm senaryolarda ortak kullanılacak şekilde kaydeder." }
  },
  "{word} stores value {string} as global variable {string}": {
    en: { name: "Store Value as Global", desc: "Saves a specific value to global test variables." },
    tr: { name: "Değeri Global Değişken Olarak Kaydet", desc: "Belirli bir değeri global test değişkeni olarak kaydeder." }
  },
  "{word} loads global variable {string} as {string}": {
    en: { name: "Load Global Variable", desc: "Loads a global variable value into a local variable." },
    tr: { name: "Global Değişken Yükle", desc: "Global bir değişkeni yerel teste yükler." }
  }
};

const parseCustomStepParams = (pattern, paramsStr) => {
  const patternTypes = (pattern.match(/\{[^}]+\}/g) || []).map(t => t.slice(1, -1));
  const paramsList = [];
  if (paramsStr) {
    const parts = paramsStr.split(',');
    parts.forEach(part => {
      const trimmedPart = part.trim();
      if (trimmedPart.includes(':')) {
        // Kotlin style: name: Type
        const match = trimmedPart.match(/^(\w+)\s*:\s*(\w+)/);
        if (match) {
          paramsList.push({ name: match[1], type: match[2] });
        }
      } else {
        // Java style: Type name (e.g. String actor)
        const match = trimmedPart.match(/^(\w+)\s+(\w+)/);
        if (match) {
          paramsList.push({ name: match[2], type: match[1] });
        }
      }
    });
  }

  const fields = [];
  patternTypes.forEach((type, idx) => {
    const param = paramsList[idx];
    let label = param ? param.name : `Param ${idx + 1}`;
    
    label = label
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    fields.push({
      index: idx,
      label,
      type: (type === 'string' || type === 'word') ? 'text' : 'number',
      rawType: type
    });
  });

  return fields;
};

const generateExampleUsage = (type, pattern, defaultActor) => {
  const actor = defaultActor || 'user';
  let example = pattern;
  
  example = example.replace(/\{word\}/g, actor);
  
  if (pattern.includes("uses {string} service")) {
    example = example.replace(/\{string\}/g, '"auth"');
  } else if (pattern.includes("sets header {string} to {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"Content-Type"' : '"application/json"';
    });
  } else if (pattern.includes("removes header {string}")) {
    example = example.replace(/\{string\}/g, '"Authorization"');
  } else if (pattern.includes("is authenticated with token {string}")) {
    example = example.replace(/\{string\}/g, '"token_abc_123"');
  } else if (pattern.includes("is logged in with username {string} and password {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"admin"' : '"secret123"';
    });
  } else if (pattern.includes("has stored {string} as {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"active"' : '"status"';
    });
  } else if (pattern.includes("sends {string} request to {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"GET"' : '"/api/v1/users"';
    });
  } else if (pattern.includes("stores response {string} as {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"$.data.id"' : '"userId"';
    });
  } else if (pattern.includes("stores response body as {string}")) {
    example = example.replace(/\{string\}/g, '"responseBody"');
  } else if (pattern.includes("stores the cookie {string} as {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"session_id"' : '"myCookie"';
    });
  } else if (pattern.includes("stores response {string} as global variable {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"$.token"' : '"globalToken"';
    });
  } else if (pattern.includes("stores value {string} as global variable {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"production"' : '"envName"';
    });
  } else if (pattern.includes("loads global variable {string} as {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"globalToken"' : '"authToken"';
    });
  } else if (pattern.includes("encodes {string} to base64 and stores as {string}")) {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return count === 1 ? '"mySecretText"' : '"base64Value"';
    });
  } else {
    let count = 0;
    example = example.replace(/\{string\}/g, () => {
      count++;
      return `"value${count}"`;
    });
  }
  
  example = example.replace(/\{int\}/g, '200');
  example = example.replace(/\{long\}/g, '5000');
  
  return `${type} ${example}`;
};

const generateSchemaFromObj = (obj) => {
  if (obj === null) return { type: 'null' };
  if (Array.isArray(obj)) {
    return {
      type: 'array',
      items: obj.length > 0 ? generateSchemaFromObj(obj[0]) : {}
    };
  }
  if (typeof obj === 'object') {
    const properties = {};
    const required = [];
    Object.keys(obj).forEach(key => {
      properties[key] = generateSchemaFromObj(obj[key]);
      required.push(key);
    });
    return {
      type: 'object',
      properties,
      required
    };
  }
  if (typeof obj === 'string') return { type: 'string' };
  if (typeof obj === 'number') return { type: Number.isInteger(obj) ? 'integer' : 'number' };
  if (typeof obj === 'boolean') return { type: 'boolean' };
  return {};
};

const cleanJsonExample = (obj) => {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.length > 0 ? [cleanJsonExample(obj[0])] : [];
  }
  if (typeof obj === 'object') {
    const cleaned = {};
    Object.keys(obj).forEach(key => {
      cleaned[key] = cleanJsonExample(obj[key]);
    });
    return cleaned;
  }
  if (typeof obj === 'string') return 'string';
  if (typeof obj === 'number') return 0;
  if (typeof obj === 'boolean') return false;
  return obj;
};



const TestBuilderPage = ({ onBack, project, user }) => {
  const defaultActor = user?.email ? user.email.split('@')[0] : 'user';
  const [steps, setSteps] = useState([]);
  const [testCases, setTestCases] = useState([]);
  const [currentTestCase, setCurrentTestCase] = useState(null);
  const [testName, setTestName] = useState('My First Test');
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('// Click "Generate Code" to see Playwright output');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [activeEnv, setActiveEnv] = useState(project.environments?.[0] || null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [executionLogs, setExecutionLogs] = useState([]);
  const [isPushing, setIsPushing] = useState(false);
  const [generateAuthMethodName, setGenerateAuthMethodName] = useState('');

  // Step Library states
  const [showStepLibrary, setShowStepLibrary] = useState(false);
  const [stepDefinitions, setStepDefinitions] = useState([]);
  const [stepSearch, setStepSearch] = useState('');
  const [stepDefinitionsLoading, setStepDefinitionsLoading] = useState(false);
  const [libraryLanguage, setLibraryLanguage] = useState('tr');
  const [selectedCustomSteps, setSelectedCustomSteps] = useState([]);

  // Quick Generate modal states
  const [showQuickGenerateModal, setShowQuickGenerateModal] = useState(false);
  const [generateMethod, setGenerateMethod] = useState('GET');
  const [generatePath, setGeneratePath] = useState('');
  const [generateHeaders, setGenerateHeaders] = useState('Content-Type: application/json');
  const [generateBody, setGenerateBody] = useState('');
  const [generateExpectedStatus, setGenerateExpectedStatus] = useState(200);
  const [generateAutoSchema, setGenerateAutoSchema] = useState(true);
  const [generateFolder, setGenerateFolder] = useState('');
  const [generateFeatureName, setGenerateFeatureName] = useState('');
  const [generateError, setGenerateError] = useState(null);
  const [logsCopied, setLogsCopied] = useState(false);
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState([]);
  const [showRunSelectDropdown, setShowRunSelectDropdown] = useState(false);

  // Folder tree states
  const [emptyFolders, setEmptyFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const isFolderExpanded = (folderPath) => {
    return expandedFolders[folderPath] !== false;
  };

  const getExistingFolders = () => {
    const folders = new Set();
    testCases.forEach(tc => {
      const parts = tc.name.split('/').filter(Boolean);
      if (parts.length > 1) {
        const folderParts = parts.slice(0, -1);
        let currentPath = '';
        folderParts.forEach(part => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          folders.add(currentPath);
        });
      }
    });
    emptyFolders.forEach(folder => {
      const parts = folder.split('/').filter(Boolean);
      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        folders.add(currentPath);
      });
    });
    return Array.from(folders).sort();
  };

  // Load step definitions
  useEffect(() => {
    const fetchSteps = async () => {
      setStepDefinitionsLoading(true);
      try {
        const res = await fetch('/api/step-definitions');
        if (res.ok) {
          const data = await res.json();
          setStepDefinitions(data.steps || []);
        }
      } catch (err) {
        console.error('Failed to load step definitions:', err);
      } finally {
        setStepDefinitionsLoading(false);
      }
    };
    fetchSteps();
  }, []);

  // Update selected steps details dynamically when libraryLanguage changes
  useEffect(() => {
    setSelectedCustomSteps(prev => 
      prev.map(s => {
        const meta = s.meta || stepMetadata[s.pattern] || {
          en: { name: s.name_en || s.name || s.pattern.replace(/^I\s+/, ''), desc: s.desc_en || s.desc || s.description || "" },
          tr: { name: s.name_tr || s.name || s.pattern, desc: s.desc_tr || s.desc || s.description || "" }
        };
        return {
          ...s,
          name: libraryLanguage === 'tr' ? meta.tr.name : meta.en.name,
          desc: libraryLanguage === 'tr' ? meta.tr.desc : meta.en.desc,
          meta
        };
      })
    );
  }, [libraryLanguage]);

  const addStepFromLibrary = (stepDef) => {
    let text = stepDef.pattern;
    text = text.replace(/\{string\}/g, '"[string]"');
    text = text.replace(/\{int\}/g, '[int]');
    text = text.replace(/\{long\}/g, '[long]');
    
    const cleanGherkinText = `${stepDef.type} ${text}`;
    
    const newStep = {
      id: `step-${Date.now()}`,
      action: 'custom',
      locator: { strategy: 'css', value: '' },
      value: cleanGherkinText,
      description: stepDef.desc || `Cucumber: ${stepDef.type} ${stepDef.pattern}`,
      customPattern: stepDef.pattern,
      customDesc: stepDef.desc || stepDef.description
    };
    setSteps(prev => [...prev, newStep]);
  };

  const handleToggleCustomStep = (stepDef) => {
    setSelectedCustomSteps(prev => {
      const exists = prev.some(s => s.pattern === stepDef.pattern && s.type === stepDef.type);
      if (exists) {
        return prev.filter(s => !(s.pattern === stepDef.pattern && s.type === stepDef.type));
      } else {
        const meta = stepMetadata[stepDef.pattern] || {
          en: { name: stepDef.name_en || stepDef.name || stepDef.pattern.replace(/^I\s+/, ''), desc: stepDef.desc_en || stepDef.desc || stepDef.description || "" },
          tr: { name: stepDef.name_tr || stepDef.name || stepDef.pattern, desc: stepDef.desc_tr || stepDef.desc || stepDef.description || "" }
        };
        return [...prev, {
          ...stepDef,
          name: libraryLanguage === 'tr' ? meta.tr.name : meta.en.name,
          desc: libraryLanguage === 'tr' ? meta.tr.desc : meta.en.desc,
          meta
        }];
      }
    });
  };

  // Refs for safety
  const saveTimeoutRef = useRef(null);
  const isInitializing = useRef(false);
  const terminalEndRef = useRef(null);

  // Terminal Auto-scroll Effect
  useEffect(() => {
    if (showTerminal && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs, showTerminal]);

  // Synchronize selectedTestCaseIds with testCases
  useEffect(() => {
    if (testCases && testCases.length > 0) {
      setSelectedTestCaseIds(prev => {
        const existingValid = prev.filter(id => testCases.some(c => c.id === id));
        const newCases = testCases.filter(c => !prev.includes(c.id)).map(c => c.id);
        return [...existingValid, ...newCases];
      });
    } else {
      setSelectedTestCaseIds([]);
    }
  }, [testCases]);

  // 1. Initial Load: Get or Create Test Case
  useEffect(() => {
    const initWorkspace = async () => {
      if (isInitializing.current) return;
      isInitializing.current = true;
      
      setLoading(true);
      // Get existing cases
      const { data: cases, error: caseError } = await testCaseService.getTestCases(project.id);
      
      let targetCase = null;
      if (!caseError && cases && cases.length > 0) {
        setTestCases(cases);
        targetCase = cases[0];
      } else {
        // Create default case
        const { data: newCase, error: createError } = await testCaseService.createTestCase(project.id, 'My First Test');
        if (createError) {
          console.error('Error creating initial test case:', createError);
        }
        targetCase = newCase;
        if (newCase) {
          setTestCases([newCase]);
        }
      }

      if (targetCase) {
        setCurrentTestCase(targetCase);
        setTestName(targetCase.name);
        // Load steps for this case
        const { data: loadedSteps } = await testCaseService.getSteps(targetCase.id);
        if (loadedSteps) setSteps(loadedSteps);
      }
      setLoading(false);
    };

    if (project?.id) initWorkspace();
  }, [project]);

  // Auto-save test case name
  useEffect(() => {
    if (!currentTestCase || loading) return;
    if (testName === currentTestCase.name) return;

    const timeout = setTimeout(async () => {
      const { data, error } = await testCaseService.updateTestCaseName(currentTestCase.id, testName);
      if (!error && data) {
        setCurrentTestCase(data);
        setTestCases(prev => prev.map(c => c.id === data.id ? data : c));
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [testName, currentTestCase]);

  const handleCreateTestCase = async () => {
    const name = prompt(
      libraryLanguage === 'tr' 
        ? 'Test Senaryosu Adı (örneğin: membership/banners):' 
        : 'Test Case Name (e.g. membership/banners):', 
      `Test Case ${testCases.length + 1}`
    );
    if (!name) return;
    setLoading(true);
    const { data: newCase, error } = await testCaseService.createTestCase(project.id, name.trim());
    if (!error && newCase) {
      setTestCases(prev => [...prev, newCase]);
      setCurrentTestCase(newCase);
      setTestName(newCase.name);
      setSteps([]);
    }
    setLoading(false);
  };

  const handleCreateFolder = () => {
    const folderPath = prompt(
      libraryLanguage === 'tr' 
        ? 'Yeni Klasör Yolu (örneğin: membership veya membership/banners/sub):' 
        : 'New Folder Path (e.g. membership or membership/banners/sub):'
    );
    if (!folderPath) return;
    const cleanPath = folderPath.split('/').filter(Boolean).join('/');
    if (cleanPath && !emptyFolders.includes(cleanPath)) {
      setEmptyFolders(prev => [...prev, cleanPath]);
      setExpandedFolders(prev => ({ ...prev, [cleanPath]: true }));
    }
  };

  const handleCreateTestCaseInFolder = async (folderPath) => {
    const defaultName = libraryLanguage === 'tr' ? 'Yeni Senaryo' : 'New Test Case';
    const testName = prompt(
      libraryLanguage === 'tr' ? 'Senaryo Adı:' : 'Test Case Name:', 
      defaultName
    );
    if (!testName) return;
    
    const fullName = `${folderPath}/${testName.trim()}`;
    setLoading(true);
    const { data: newCase, error } = await testCaseService.createTestCase(project.id, fullName);
    if (!error && newCase) {
      setTestCases(prev => [...prev, newCase]);
      setCurrentTestCase(newCase);
      setTestName(newCase.name);
      setSteps([]);
      // Remove from emptyFolders if it was there
      setEmptyFolders(prev => prev.filter(f => f !== folderPath));
    }
    setLoading(false);
  };

  const handleDeleteFolder = async (folderPath) => {
    const confirmMessage = libraryLanguage === 'tr'
      ? `"${folderPath}" klasörünü ve altındaki tüm test senaryolarını silmek istediğinize emin misiniz?`
      : `Are you sure you want to delete folder "${folderPath}" and all its test cases?`;
      
    if (!confirm(confirmMessage)) return;

    setLoading(true);
    // Find all test cases that belong to this folder
    const prefix = `${folderPath}/`;
    const casesToDelete = testCases.filter(c => c.name === folderPath || c.name.startsWith(prefix));
    
    // Delete each test case
    for (const tc of casesToDelete) {
      await testCaseService.deleteTestCase(tc.id);
    }

    const remainingCases = testCases.filter(c => c.name !== folderPath && !c.name.startsWith(prefix));
    setTestCases(remainingCases);
    setEmptyFolders(prev => prev.filter(f => f !== folderPath && !f.startsWith(prefix)));

    // If active test case was deleted, switch to the first remaining one
    const wasActiveDeleted = casesToDelete.some(c => c.id === currentTestCase?.id);
    if (wasActiveDeleted && remainingCases.length > 0) {
      const target = remainingCases[0];
      setCurrentTestCase(target);
      setTestName(target.name);
      const { data: loadedSteps } = await testCaseService.getSteps(target.id);
      setSteps(loadedSteps || []);
    } else if (remainingCases.length === 0) {
      setCurrentTestCase(null);
      setTestName('');
      setSteps([]);
    }
    setLoading(false);
  };

  const handleDeleteTestCase = async (testCaseId, e) => {
    e.stopPropagation();
    if (testCases.length <= 1) {
      alert(libraryLanguage === 'tr' ? 'En az bir test senaryosu olmalıdır.' : 'You must have at least one test case.');
      return;
    }
    if (!confirm(libraryLanguage === 'tr' ? 'Bu test senaryosunu silmek istediğinize emin misiniz?' : 'Are you sure you want to delete this test case?')) return;

    const { error } = await testCaseService.deleteTestCase(testCaseId);
    if (!error) {
      const updatedCases = testCases.filter(c => c.id !== testCaseId);
      setTestCases(updatedCases);
      if (currentTestCase?.id === testCaseId) {
        // Switch to the first available test case
        const target = updatedCases[0];
        setCurrentTestCase(target);
        setTestName(target.name);
        setLoading(true);
        const { data: loadedSteps } = await testCaseService.getSteps(target.id);
        setSteps(loadedSteps || []);
        setLoading(false);
      }
    }
  };

  const handleQuickGenerateSteps = async () => {
    setGenerateError(null);
    setLoading(true);
    let stepsToAdd = [];
    
    // --- 0. AUTH FLOW ---
    let authToken = null;
    let authHeaderName = 'Authorization';
    let authDefaultHeaders = {};

    const activeAuthMethod = project.auth_methods?.find(a => a.name === generateAuthMethodName) || null;

    if (activeAuthMethod) {
      try {
        let authUrl = activeAuthMethod.url;
        if (authUrl.startsWith('http')) {
          if (activeEnv?.name) {
            for (const env of project.environments || []) {
              if (env.name && env.name !== activeEnv.name) {
                const searchStr = `.${env.name}.`;
                const replaceStr = `.${activeEnv.name}.`;
                if (authUrl.includes(searchStr)) {
                  authUrl = authUrl.replaceAll(searchStr, replaceStr);
                  break;
                }
              }
            }
          }
        } else {
          authUrl = `${activeEnv?.url || ''}${activeAuthMethod.url}`;
        }
          
        let authHeaders = parseHeaders(activeAuthMethod.headers);
        const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';
        
        const authRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: authUrl,
            method: activeAuthMethod.method || 'POST',
            headers: authHeaders,
            body: (activeAuthMethod.method !== 'GET' && activeAuthMethod.body) 
              ? activeAuthMethod.body.replace(/\n/g, '&') 
              : null,
            extractCookies: true
          })
        });

        if (authRes.ok) {
          const authData = await authRes.json();
          const path = activeAuthMethod.tokenPath || 'access_token';
          const rawToken = path.split('.').reduce((obj, key) => obj?.[key], authData);

          if (rawToken) {
            if (activeAuthMethod.usageType === 'Bearer') {
              authToken = `Bearer ${rawToken}`;
              authHeaderName = 'Authorization';
            } else if (activeAuthMethod.usageType === 'Cookie') {
              authToken = `access_token=${rawToken}`;
              authHeaderName = 'Cookie';
            } else {
              authToken = rawToken;
              authHeaderName = activeAuthMethod.headerName || 'X-Auth-Token';
            }

            const parsedAuthHeaders = parseHeaders(activeAuthMethod.headers);
            Object.entries(parsedAuthHeaders).forEach(([k, v]) => {
              if (k.toLowerCase() !== 'content-type') {
                authDefaultHeaders[k] = v;
              }
            });
          }
        } else {
          const errorText = await authRes.text();
          setGenerateError(`Auth Failed: ${authRes.status} ${errorText}`);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Auth request failed during quick generate steps:', err);
        setGenerateError(`Auth Request Error: ${err.message}`);
        setLoading(false);
        return;
      }
    }

    // 1. Build request step
    const requestStep = {
      id: `step_${Date.now()}`,
      action: generateMethod.toLowerCase(),
      locator: { strategy: 'endpoint', value: generatePath, name: '' },
      value: ['post', 'put', 'patch'].includes(generateMethod.toLowerCase()) ? generateBody : '',
      headers: generateHeaders,
      authMethod: generateAuthMethodName || '',
      description: `Auto-generated ${generateMethod} request to ${generatePath}`
    };
    stepsToAdd.push(requestStep);

    // 2. Build status step
    const statusStep = {
      id: `step_${Date.now() + 1}`,
      action: 'verifyStatus',
      locator: { strategy: 'status', value: '', name: '' },
      value: String(generateExpectedStatus),
      description: `Verify response status is ${generateExpectedStatus}`
    };
    stepsToAdd.push(statusStep);

    // 3. Build schema step if requested
    if (generateAutoSchema) {
      try {
        const fullUrl = generatePath.startsWith('http') ? generatePath : `${activeEnv?.url || ''}${generatePath}`;
        const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';
        
        let headersObj = {
          ...authDefaultHeaders,
          ...parseHeaders(generateHeaders),
          ...parseHeaders(activeEnv?.headers)
        };

        if (authToken) {
          const hasCustomAuth = Object.keys(headersObj).some(
            k => k.toLowerCase() === authHeaderName.toLowerCase()
          );
          if (!hasCustomAuth) {
            headersObj[authHeaderName] = authToken;
          }
        }

        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: fullUrl,
            method: generateMethod.toUpperCase(),
            headers: headersObj,
            body: ['POST', 'PUT', 'PATCH'].includes(generateMethod.toUpperCase()) ? generateBody : null
          })
        });

        if (response.ok) {
          const resJson = await response.json();
          const responseBody = resJson.body || resJson;
          
          let parsedBody = responseBody;
          if (typeof responseBody === 'string') {
            try {
              parsedBody = JSON.parse(responseBody);
            } catch (e) {}
          }

          const cleanedExample = cleanJsonExample(parsedBody);
          
          const schemaStep = {
            id: `step_${Date.now() + 2}`,
            action: 'verifySchema',
            locator: { strategy: 'jsonpath', value: '$', name: '' },
            value: JSON.stringify(cleanedExample, null, 2),
            description: 'Verify response complies with JSON schema'
          };
          stepsToAdd.push(schemaStep);
        } else {
          const errorText = await response.text();
          let parsedError = errorText;
          try {
            const errObj = JSON.parse(errorText);
            parsedError = errObj.message || errObj.error || errorText;
          } catch(e) {}
          setGenerateError(`API Request Failed (Status ${response.status}): ${parsedError}`);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Error generating schema:', err);
        setGenerateError(`Request Error: ${err.message}`);
        setLoading(false);
        return;
      }
    }

    // 4. Determine target test case
    let targetTestCaseId = currentTestCase?.id;

    if (generateFeatureName.trim()) {
      const cleanFolder = generateFolder.trim().split('/').filter(Boolean).join('/');
      const cleanFeature = generateFeatureName.trim();
      const newTestCaseName = cleanFolder ? `${cleanFolder}/${cleanFeature}` : cleanFeature;

      const { data: newCase, error } = await testCaseService.createTestCase(project.id, newTestCaseName);
      if (!error && newCase) {
        setTestCases(prev => [...prev, newCase]);
        setCurrentTestCase(newCase);
        setTestName(newCase.name);
        targetTestCaseId = newCase.id;

        if (cleanFolder) {
          setEmptyFolders(prev => prev.filter(f => f !== cleanFolder));
        }
      } else {
        console.error('Failed to create new test case during generation:', error);
      }
    }

    if (targetTestCaseId) {
      if (generateFeatureName.trim()) {
        await testCaseService.saveSteps(targetTestCaseId, stepsToAdd);
        setSteps(stepsToAdd);
      } else {
        const combined = [...steps, ...stepsToAdd];
        await testCaseService.saveSteps(targetTestCaseId, combined);
        setSteps(combined);
      }
    }

    setLoading(false);
    setShowQuickGenerateModal(false);
    setGenerateFolder('');
    setGenerateFeatureName('');
  };

  const handleCopyLogs = () => {
    const textToCopy = executionLogs.map(log => {
      let msg = `[${log.time}] ${log.message}`;
      if (log.data) {
        msg += `\n${JSON.stringify(log.data, null, 2)}`;
      }
      return msg;
    }).join('\n');

    navigator.clipboard.writeText(textToCopy);
    setLogsCopied(true);
    setTimeout(() => setLogsCopied(false), 1500);
  };

  // 2. Auto-Save Logic (Supabase)
  useEffect(() => {
    if (!currentTestCase || loading) return;

    // Clear previous timeout
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      setSaveError(null);
      const { error } = await testCaseService.saveSteps(currentTestCase.id, steps);
      if (error) {
        setSaveError('Failed to save steps.');
        console.error('Save error details:', error);
      }
      setIsSaving(false);
    }, 1000); // Save after 1 second of inactivity

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [steps, currentTestCase]);

  const addStep = () => {
    const newStep = {
      id: `step_${Date.now()}`,
      action: project.type === 'api' ? 'get' : 'click',
      locator: { strategy: project.type === 'api' ? 'endpoint' : 'css', value: '', name: '' },
      value: '',
      description: ''
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    if (field === 'action' && typeof value === 'string' && value.startsWith('custom_step:')) {
      const parts = value.split(':');
      const type = parts[1];
      const pattern = parts.slice(2).join(':');
      
      const customStep = selectedCustomSteps.find(s => s.pattern === pattern && s.type === type);
      if (customStep) {
        const fields = parseCustomStepParams(customStep.pattern, customStep.params);
        const initialVals = Array(fields.length).fill('');
        
        let gherkinText = customStep.pattern;
        gherkinText = gherkinText.replace(/\{string\}/g, '""');
        gherkinText = gherkinText.replace(/\{int\}/g, '0');
        gherkinText = gherkinText.replace(/\{long\}/g, '0');
        
        const cleanGherkinText = `${customStep.type} ${gherkinText}`;
        
        newSteps[index].action = 'custom';
        newSteps[index].value = cleanGherkinText;
        newSteps[index].description = customStep.desc || `Cucumber: ${cleanGherkinText}`;
        newSteps[index].customPattern = customStep.pattern;
        newSteps[index].customParamValues = initialVals;
      }
    } else {
      newSteps[index][field] = value;
    }
    setSteps(newSteps);
  };

  const removeStep = (index) => {
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
  };

  const handleGenerateCode = () => {
    const isJavaCucumber = steps.some(s => s.action === 'custom' && /^(Given|When|Then|And|But)\s+/i.test(s.value?.trim()));
    
    let code = '';
    if (isJavaCucumber) {
      code += `# Cucumber Feature File Preview\n`;
      code += `@smoke\nFeature: ${project.name || 'API Test Suite'}\n  Auto-generated test scenario from UPAF\n\n`;
      code += `  @smoke\n  Scenario: ${testName}\n`;
      
      steps.forEach(step => {
        if (step.action === 'custom') {
          code += `    ${step.value.trim()}\n`;
        } else {
          if (step.authMethod) {
            code += `    Given system is authenticated with "${step.authMethod}"\n`;
          }
          if (step.action === 'get') {
            code += `    When system sends "GET" request to "${step.locator?.value || '/'}"\n`;
          } else if (step.action === 'post') {
            if (step.value) {
              code += `    When system sends "POST" request to "${step.locator?.value || '/'}" with body:\n    """\n    ${step.value}\n    """\n`;
            } else {
              code += `    When system sends "POST" request to "${step.locator?.value || '/'}"\n`;
            }
          } else if (step.action === 'put') {
            if (step.value) {
              code += `    When system sends "PUT" request to "${step.locator?.value || '/'}" with body:\n    """\n    ${step.value}\n    """\n`;
            } else {
              code += `    When system sends "PUT" request to "${step.locator?.value || '/'}"\n`;
            }
          } else if (step.action === 'delete') {
            code += `    When system sends "DELETE" request to "${step.locator?.value || '/'}"\n`;
          } else if (step.action === 'verifyStatus') {
            code += `    Then response status code should be ${step.value || 200}\n`;
          } else if (step.action === 'verifyBody') {
            const isNum = !isNaN(step.value) && step.value.trim() !== '';
            if (isNum) {
              code += `    Then response "${step.locator?.value || '$'}" should be ${parseInt(step.value)}\n`;
            } else {
              code += `    Then response "${step.locator?.value || '$'}" should be "${step.value}"\n`;
            }
          } else if (step.action === 'verifySchema') {
            code += `    Then response "${step.locator?.value || '$'}" should match schema:\n    """\n    ${step.value}\n    """\n`;
          } else if (step.action === 'extractData') {
            code += `    And system stores response "${step.locator?.value || '$'}" as "${step.value}"\n`;
          }
        }
      });
    } else {
      code += `import { test, expect } from '@playwright/test';\n\ntest('${testName}', async ({ page, request }) => {\n`;
      
      steps.forEach((step, index) => {
        if (step.description) code += `  // ${step.description}\n`;
        
        let target = 'page';
        const resolve = (val) => {
          if (!val || !activeEnv) return val;
          let resolved = val;
          try {
            const vars = parseVariables(activeEnv.variables || '{}');
            Object.entries(vars).forEach(([key, value]) => {
              resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
            });
            resolved = resolved.replace(/{{baseUrl}}/g, activeEnv.url || '');
          } catch (e) {}
          return resolved;
        };

        const isApi = ['get', 'post', 'put', 'delete', 'verifyStatus', 'verifyBody', 'extractData'].includes(step.action);
        
        let headersConfig = '';
        let combinedHeaders = {};
        
        try { combinedHeaders = parseHeaders(activeEnv?.headers || '{}'); } catch(e) {}
        
        if (step.headers) {
          const stepHeaders = parseHeaders(step.headers);
          combinedHeaders = { ...combinedHeaders, ...stepHeaders };
        }

        if (step.authMethod) {
          const methodConfig = project.auth_methods?.find(a => a.name === step.authMethod);
          if (methodConfig) {
            const parsedAuthHeaders = parseHeaders(methodConfig.headers || '');
            Object.entries(parsedAuthHeaders).forEach(([k, v]) => {
              if (k.toLowerCase() !== 'content-type') {
                combinedHeaders[k] = v;
              }
            });

            let authHeaderName = 'Authorization';
            let authToken = `Bearer <${methodConfig.name}>`;
            if (methodConfig.usageType === 'Cookie') {
              authHeaderName = 'Cookie';
              authToken = `access_token=<${methodConfig.name}>`;
            } else if (methodConfig.usageType === 'CustomHeader') {
              authHeaderName = methodConfig.headerName || 'X-Auth-Token';
              authToken = `<${methodConfig.name}>`;
            }

            const hasCustomAuth = Object.keys(combinedHeaders).some(
              k => k.toLowerCase() === authHeaderName.toLowerCase()
            );
            if (!hasCustomAuth) {
              combinedHeaders[authHeaderName] = authToken;
            }
          }
        }

        let optionsConfig = '';
        let optionsObj = {};
        
        if (Object.keys(combinedHeaders).length > 0) {
          optionsObj.headers = combinedHeaders;
        }
        if (step.params) {
          try {
            optionsObj.params = parseHeaders(step.params);
          } catch (e) {}
        }

        if (Object.keys(optionsObj).length > 0) {
          optionsConfig = `, ${JSON.stringify(optionsObj, null, 2).replace(/\n/g, '\n  ')}`;
        }

        if (!isApi && step.action !== 'navigate') {
          const strat = step.locator?.strategy;
          const val = resolve(step.locator?.value);
          if (strat === 'css' || strat === 'id' || strat === 'xpath') target = `page.locator('${val}')`;
          else if (strat === 'text') target = `page.getByText('${val}')`;
          else if (strat === 'data-testid') target = `page.getByTestId('${val}')`;
          else if (strat === 'role') target = `page.getByRole('${val}' as any)`;
        }

        const stepValue = resolve(step.value);
        const stepUrl = resolve(step.locator?.value || '/');

        const getPostOptionsConfig = () => {
          const postObj = { ...optionsObj };
          if (stepValue) {
            try {
              postObj.data = stepValue.trim().startsWith('{') ? JSON.parse(stepValue) : stepValue;
            } catch (e) {
              postObj.data = stepValue;
            }
          }
          return Object.keys(postObj).length > 0 ? `, ${JSON.stringify(postObj, null, 2).replace(/\n/g, '\n  ')}` : '';
        };

        switch (step.action) {
          case 'navigate': code += `  await page.goto('${stepValue}');\n`; break;
          case 'click': code += `  await ${target}.click();\n`; break;
          case 'fill': code += `  await ${target}.fill('${stepValue}');\n`; break;
          case 'verifyVisible': code += `  await expect(${target}).toBeVisible();\n`; break;
          case 'verifyText': code += `  await expect(${target}).toHaveText('${stepValue}');\n`; break;
          case 'get': code += `  const response_${index} = await request.get('${stepUrl}'${optionsConfig});\n`; break;
          case 'post': code += `  const response_${index} = await request.post('${stepUrl}'${getPostOptionsConfig()});\n`; break;
          case 'put': code += `  const response_${index} = await request.put('${stepUrl}'${getPostOptionsConfig()});\n`; break;
          case 'delete': code += `  const response_${index} = await request.delete('${stepUrl}'${optionsConfig});\n`; break;
          case 'verifyStatus': 
            code += `  expect(response_${index-1}.status()).toBe(${stepValue || 200});\n`; 
            break;
          case 'verifyBody': 
            code += `  const body_${index} = await response_${index-1}.json();\n`;
            code += `  expect(body_${index}${step.locator?.value ? '.' + step.locator.value : ''}).toEqual(${stepValue || '{}'});\n`;
            break;
          case 'verifySchema':
            code += `  const schema_${index} = ${stepValue || '{}'};\n`;
            code += `  await apiManager.assertSchema(response_${index-1}, schema_${index}, '${step.locator?.value || '$'}');\n`;
            break;
          case 'extractData':
            code += `  const body_${index} = await response_${index-1}.json();\n`;
            code += `  const ${step.value?.replace(/\s+/g, '_') || 'extracted_var'} = body_${index}${step.locator?.value ? '.' + step.locator.value : ''};\n`;
            break;
          default: code += `  // ${step.action} not yet mapped\n`;
        }
      });

      code += `});\n`;
    }
    setGeneratedCode(code);
    setShowCode(true);
  };

  const handleQuickRun = () => {
    const runExecution = async () => {
      setIsRunning(true);
      setShowTerminal(true);
      setExecutionLogs([{ type: 'info', message: `🚀 Starting test: ${testName}`, time: new Date().toLocaleTimeString() }]);
      
      let lastResponse = null;
      let lastBody = null;
      let variables = {};
      let authTokensCache = {};

      try {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          const resolve = (v) => {
            if (!v) return v;
            let resolved = v;
            try {
              if (activeEnv) {
                const envVars = parseVariables(activeEnv.variables || '{}');
                Object.entries(envVars).forEach(([key, value]) => {
                  resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
                });
                resolved = resolved.replace(/{{baseUrl}}/g, activeEnv.url || '');
              }
              // Replace dynamically extracted variables
              Object.entries(variables).forEach(([key, value]) => {
                resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
              });
            } catch (e) {}
            return resolved;
          };

          const stepUrl = resolve(step.locator?.value || '/');
          const stepValue = resolve(step.value);
          
          setExecutionLogs(prev => [...prev, { type: 'step', message: `Step ${i + 1}: ${step.action} -> ${stepUrl || stepValue || ''}`, time: new Date().toLocaleTimeString() }]);

          if (['get', 'post', 'put', 'delete'].includes(step.action)) {
            let stepAuthToken = null;
            let stepAuthHeaderName = 'Authorization';
            let stepAuthDefaultHeaders = {};

            if (step.authMethod) {
              if (authTokensCache[step.authMethod]) {
                const cached = authTokensCache[step.authMethod];
                stepAuthToken = cached.token;
                stepAuthHeaderName = cached.headerName;
                stepAuthDefaultHeaders = cached.defaultHeaders;
              } else {
                const methodConfig = project.auth_methods?.find(a => a.name === step.authMethod);
                if (methodConfig) {
                  setExecutionLogs(prev => [...prev, { 
                    type: 'info', 
                    message: `🔐 Authenticating step ${i + 1} with ${methodConfig.name}...`, 
                    time: new Date().toLocaleTimeString() 
                  }]);

                  let authUrl = methodConfig.url;
                  if (authUrl.startsWith('http')) {
                    if (activeEnv?.name) {
                      for (const env of project.environments || []) {
                        if (env.name && env.name !== activeEnv.name) {
                          const searchStr = `.${env.name}.`;
                          const replaceStr = `.${activeEnv.name}.`;
                          if (authUrl.includes(searchStr)) {
                            authUrl = authUrl.replaceAll(searchStr, replaceStr);
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    authUrl = `${activeEnv?.url || ''}${methodConfig.url}`;
                  }

                  let authHeaders = parseHeaders(methodConfig.headers);
                  const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';

                  try {
                    const authRes = await fetch(proxyUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url: authUrl,
                        method: methodConfig.method || 'POST',
                        headers: authHeaders,
                        body: (methodConfig.method !== 'GET' && methodConfig.body) 
                          ? methodConfig.body.replace(/\n/g, '&') 
                          : null,
                        extractCookies: true
                      })
                    });

                    if (authRes.ok) {
                      const authData = await authRes.json();
                      const path = methodConfig.tokenPath || 'access_token';
                      const rawToken = path.split('.').reduce((obj, key) => obj?.[key], authData);

                      if (rawToken) {
                        if (methodConfig.usageType === 'Bearer') {
                          stepAuthToken = `Bearer ${rawToken}`;
                          stepAuthHeaderName = 'Authorization';
                        } else if (methodConfig.usageType === 'Cookie') {
                          stepAuthToken = `access_token=${rawToken}`;
                          stepAuthHeaderName = 'Cookie';
                        } else {
                          stepAuthToken = rawToken;
                          stepAuthHeaderName = methodConfig.headerName || 'X-Auth-Token';
                        }

                        const parsedAuthHeaders = parseHeaders(methodConfig.headers);
                        stepAuthDefaultHeaders = {};
                        Object.entries(parsedAuthHeaders).forEach(([k, v]) => {
                          if (k.toLowerCase() !== 'content-type') {
                            stepAuthDefaultHeaders[k] = v;
                          }
                        });

                        authTokensCache[step.authMethod] = {
                          token: stepAuthToken,
                          headerName: stepAuthHeaderName,
                          defaultHeaders: stepAuthDefaultHeaders
                        };

                        setExecutionLogs(prev => [...prev, { 
                          type: 'success', 
                          message: `✅ Token [${methodConfig.name}] acquired for step ${i + 1}.`, 
                          time: new Date().toLocaleTimeString() 
                        }]);
                      } else {
                        setExecutionLogs(prev => [...prev, { 
                          type: 'error', 
                          message: `❌ Failed to extract token from path: ${path} in step ${i + 1}`, 
                          time: new Date().toLocaleTimeString() 
                        }]);
                      }
                    } else {
                      const errorText = await authRes.text();
                      setExecutionLogs(prev => [...prev, { 
                        type: 'error', 
                        message: `❌ Step ${i + 1} Auth Failed: ${authRes.status} ${errorText}`, 
                        time: new Date().toLocaleTimeString() 
                      }]);
                    }
                  } catch (err) {
                    setExecutionLogs(prev => [...prev, { 
                      type: 'error', 
                      message: `❌ Step ${i + 1} Auth Request Error: ${err.message}`, 
                      time: new Date().toLocaleTimeString() 
                    }]);
                  }
                }
              }
            }

            let combinedHeaders = {
              ...stepAuthDefaultHeaders,
              ...parseHeaders(activeEnv?.headers)
            };
            if (step.headers) {
              combinedHeaders = { ...combinedHeaders, ...parseHeaders(step.headers) };
            }

            if (stepAuthToken) {
              const hasCustomAuth = Object.keys(combinedHeaders).some(
                k => k.toLowerCase() === stepAuthHeaderName.toLowerCase()
              );
              if (!hasCustomAuth) {
                combinedHeaders[stepAuthHeaderName] = stepAuthToken;
              }
            }

            let fetchUrl = stepUrl.startsWith('http') ? stepUrl : `${activeEnv?.url}${stepUrl}`;
            if (step.params) {
              try {
                const parsedParams = parseHeaders(step.params);
                const queryString = new URLSearchParams(parsedParams).toString();
                if (queryString) {
                  fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + queryString;
                }
              } catch (e) {
                console.error('Failed to parse query params:', e);
              }
            }

            try {
              // Route through proxy to avoid CORS
              const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';
              
              // Generate cURL command for debugging
              const requestBody = ['POST', 'PUT', 'PATCH'].includes(step.action.toUpperCase()) ? stepValue : null;
              let curlCmd = `curl -X ${step.action.toUpperCase()} '${fetchUrl}'`;
              Object.entries(combinedHeaders || {}).forEach(([k, v]) => {
                curlCmd += ` \\\n  -H "${k}: ${v}"`;
              });
              if (requestBody) {
                curlCmd += ` \\\n  -d '${requestBody}'`;
              }
              setExecutionLogs(prev => [...prev, { 
                type: 'info', 
                message: `🔍 cURL Command:\n${curlCmd}`, 
                time: new Date().toLocaleTimeString() 
              }]);

              const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: fetchUrl,
                  method: step.action.toUpperCase(),
                  headers: combinedHeaders,
                  body: ['POST', 'PUT'].includes(step.action.toUpperCase()) ? stepValue : null
                })
              });

              lastResponse = response;
              const text = await response.text();
              try { lastBody = JSON.parse(text); } catch(e) { lastBody = text; }

              setExecutionLogs(prev => [...prev, { 
                type: response.ok ? 'success' : 'error', 
                message: `Response: ${response.status} ${response.statusText}`,
                data: lastBody,
                time: new Date().toLocaleTimeString() 
              }]);
            } catch (err) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `Request Failed: ${err.message}`, time: new Date().toLocaleTimeString() }]);
              break;
            }
          } else if (step.action === 'verifyStatus') {
            const expected = parseInt(stepValue) || 200;
            const actual = lastResponse?.status;
            if (actual === expected) {
              setExecutionLogs(prev => [...prev, { type: 'success', message: `Assertion Passed: Status is ${actual}`, time: new Date().toLocaleTimeString() }]);
            } else {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `Assertion Failed: Expected ${expected}, got ${actual}`, time: new Date().toLocaleTimeString() }]);
              break;
            }
          } else if (step.action === 'verifySchema') {
            if (!lastBody) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Schema Validation Failed: No response body available.`, time: new Date().toLocaleTimeString() }]);
              break;
            }

            try {
              const expectedExample = JSON.parse(stepValue || '{}');
              const targetPath = step.locator?.value || '$';
              


              const actualValue = getValueByPath(lastBody, targetPath);
              const { errors, warnings } = validateJsonByExample(actualValue, expectedExample, targetPath);

              if (errors.length > 0) {
                const errMsg = `Assertion Failed (Schema Mismatch):\n` + errors.map(err => `- ${err}`).join('\n');
                setExecutionLogs(prev => [...prev, { 
                  type: 'error', 
                  message: errMsg, 
                  time: new Date().toLocaleTimeString() 
                }]);
                break;
              }

              if (warnings.length > 0) {
                const warnMsg = `Assertion Failed (Extra Properties Detected):\n` + warnings.map(w => `- ${w}`).join('\n');
                setExecutionLogs(prev => [...prev, { 
                  type: 'error', 
                  message: warnMsg + `\n⚠️ (Marking as broken/needs schema update)`, 
                  time: new Date().toLocaleTimeString() 
                }]);
                break;
              }

              setExecutionLogs(prev => [...prev, { 
                type: 'success', 
                message: `✅ Assertion Passed: Response schema matches example.`, 
                time: new Date().toLocaleTimeString() 
              }]);
            } catch (jsonErr) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Invalid Example JSON: ${jsonErr.message}`, time: new Date().toLocaleTimeString() }]);
              break;
            }
          } else if (step.action === 'verifyBody') {
            if (!lastBody) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Body Validation Failed: No response body available.`, time: new Date().toLocaleTimeString() }]);
              break;
            }

            const targetPath = step.locator?.value || '$';


            const actualValue = getValueByPath(lastBody, targetPath);
            let expectedValue = stepValue;
            
            try {
              if (typeof expectedValue === 'string') {
                if (expectedValue.startsWith('"') && expectedValue.endsWith('"')) {
                  expectedValue = expectedValue.slice(1, -1);
                } else if (expectedValue.startsWith("'") && expectedValue.endsWith("'")) {
                  expectedValue = expectedValue.slice(1, -1);
                } else {
                  expectedValue = JSON.parse(expectedValue);
                }
              }
            } catch (e) {
              // keep as string
            }

            const actualStr = typeof actualValue === 'object' ? JSON.stringify(actualValue) : String(actualValue);
            const expectedStr = typeof expectedValue === 'object' ? JSON.stringify(expectedValue) : String(expectedValue);

            if (actualStr === expectedStr) {
              setExecutionLogs(prev => [...prev, { type: 'success', message: `✅ Assertion Passed: Value at ${targetPath} is equal to ${expectedStr}`, time: new Date().toLocaleTimeString() }]);
            } else {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Assertion Failed: Expected ${expectedStr}, got ${actualStr} at ${targetPath}`, time: new Date().toLocaleTimeString() }]);
              break;
            }
          } else if (step.action === 'extractData') {
            if (!lastBody) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Data Extraction Failed: No response body available.`, time: new Date().toLocaleTimeString() }]);
              break;
            }

            const targetPath = step.locator?.value || '$';
            const varName = step.value?.trim() || 'extracted_var';
            
            const extractedValue = getValueByPath(lastBody, targetPath);
            variables[varName] = typeof extractedValue === 'object' ? JSON.stringify(extractedValue) : String(extractedValue);

            setExecutionLogs(prev => [...prev, { 
              type: 'success', 
              message: `ℹ️ Extracted: ${varName} = ${variables[varName]} (from ${targetPath})`, 
              time: new Date().toLocaleTimeString() 
            }]);
          } else if (step.action === 'custom') {
            const code = step.value || '';
            const trimmedCode = code.trim();
            const isGherkin = /^(Given|When|Then|And|But)\s+/i.test(trimmedCode);
            
            if (isGherkin) {
              const waitMatch = trimmedCode.match(/wait for (\d+) second/i);
              if (waitMatch) {
                const secs = parseInt(waitMatch[1]);
                setExecutionLogs(prev => [...prev, { type: 'info', message: `⏳ Waiting for ${secs} seconds...`, time: new Date().toLocaleTimeString() }]);
                await new Promise(r => setTimeout(r, secs * 1000));
              } else {
                setExecutionLogs(prev => [...prev, { 
                  type: 'info', 
                  message: `📝 Custom Gherkin Step: "${trimmedCode}" (Will run in Backend Java runner)`, 
                  time: new Date().toLocaleTimeString() 
                }]);
              }
            } else {
              setExecutionLogs(prev => [...prev, { type: 'info', message: `⚙️ Executing custom JS...`, time: new Date().toLocaleTimeString() }]);
              try {
                const fn = new Function('variables', 'lastBody', 'lastResponse', `return (async () => { ${code} })()`);
                await fn(variables, lastBody, lastResponse);
                setExecutionLogs(prev => [...prev, { type: 'success', message: `✅ Custom JS execution successful.`, time: new Date().toLocaleTimeString() }]);
              } catch (err) {
                setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Custom JS Execution Failed: ${err.message}`, time: new Date().toLocaleTimeString() }]);
                break;
              }
            }
          }
        }
        setExecutionLogs(prev => [...prev, { type: 'info', message: `🏁 Execution Finished.`, time: new Date().toLocaleTimeString() }]);
      } catch (e) {
        setExecutionLogs(prev => [...prev, { type: 'error', message: `Fatal Error: ${e.message}`, time: new Date().toLocaleTimeString() }]);
      }
      setIsRunning(false);
    };

    runExecution();
  };

  const handleRunAll = async () => {
    setIsRunning(true);
    setShowTerminal(true);
    setExecutionLogs([{ type: 'info', message: `🚀 Starting execution for ALL tests in project...`, time: new Date().toLocaleTimeString() }]);

    try {
      const { data: cases, error: caseError } = await testCaseService.getTestCases(project.id);
      if (caseError || !cases || cases.length === 0) {
        setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ No test cases found to run.`, time: new Date().toLocaleTimeString() }]);
        setIsRunning(false);
        return;
      }

      const activeCases = cases.filter(tc => selectedTestCaseIds.includes(tc.id));
      if (activeCases.length === 0) {
        setExecutionLogs(prev => [...prev, { type: 'warning', message: `⚠️ No selected test cases found to run.`, time: new Date().toLocaleTimeString() }]);
        setIsRunning(false);
        return;
      }

      let overallSuccess = true;

      for (const tc of activeCases) {
        setExecutionLogs(prev => [...prev, { 
          type: 'info', 
          message: `\n──────────────────────────────────────────\nRunning Test Case: [${tc.name}]`, 
          time: new Date().toLocaleTimeString() 
        }]);

        const { data: tcSteps, error: stepsError } = await testCaseService.getSteps(tc.id);
        if (stepsError || !tcSteps || tcSteps.length === 0) {
          setExecutionLogs(prev => [...prev, { type: 'warning', message: `⚠️ No steps found in [${tc.name}], skipping...`, time: new Date().toLocaleTimeString() }]);
          continue;
        }

        let lastResponse = null;
        let lastBody = null;
        let variables = {};
        let caseFailed = false;
        let authTokensCache = {};

        // --- STEPS EXECUTION ---
        for (let i = 0; i < tcSteps.length; i++) {
          const step = tcSteps[i];
          const resolve = (v) => {
            if (!v) return v;
            let resolved = v;
            try {
              if (activeEnv) {
                const envVars = parseVariables(activeEnv.variables || '{}');
                Object.entries(envVars).forEach(([key, value]) => {
                  resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
                });
                resolved = resolved.replace(/{{baseUrl}}/g, activeEnv.url || '');
              }
              Object.entries(variables).forEach(([key, value]) => {
                resolved = resolved.replace(new RegExp(`{{${key}}}`, 'g'), value);
              });
            } catch (e) {}
            return resolved;
          };

          const stepUrl = resolve(step.locator?.value || '/');
          const stepValue = resolve(step.value);

          setExecutionLogs(prev => [...prev, { 
            type: 'step', 
            message: `Step ${i + 1}: ${step.action} -> ${stepUrl || stepValue || ''}`, 
            time: new Date().toLocaleTimeString() 
          }]);

          if (['get', 'post', 'put', 'delete'].includes(step.action)) {
            let stepAuthToken = null;
            let stepAuthHeaderName = 'Authorization';
            let stepAuthDefaultHeaders = {};

            if (step.authMethod) {
              if (authTokensCache[step.authMethod]) {
                const cached = authTokensCache[step.authMethod];
                stepAuthToken = cached.token;
                stepAuthHeaderName = cached.headerName;
                stepAuthDefaultHeaders = cached.defaultHeaders;
              } else {
                const methodConfig = project.auth_methods?.find(a => a.name === step.authMethod);
                if (methodConfig) {
                  setExecutionLogs(prev => [...prev, { 
                    type: 'info', 
                    message: `🔐 Authenticating step ${i + 1} with ${methodConfig.name}...`, 
                    time: new Date().toLocaleTimeString() 
                  }]);

                  let authUrl = methodConfig.url;
                  if (authUrl.startsWith('http')) {
                    if (activeEnv?.name) {
                      for (const env of project.environments || []) {
                        if (env.name && env.name !== activeEnv.name) {
                          const searchStr = `.${env.name}.`;
                          const replaceStr = `.${activeEnv.name}.`;
                          if (authUrl.includes(searchStr)) {
                            authUrl = authUrl.replaceAll(searchStr, replaceStr);
                            break;
                          }
                        }
                      }
                    }
                  } else {
                    authUrl = `${activeEnv?.url || ''}${methodConfig.url}`;
                  }

                  let authHeaders = parseHeaders(methodConfig.headers);
                  const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';

                  try {
                    const authRes = await fetch(proxyUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url: authUrl,
                        method: methodConfig.method || 'POST',
                        headers: authHeaders,
                        body: (methodConfig.method !== 'GET' && methodConfig.body) 
                          ? methodConfig.body.replace(/\n/g, '&') 
                          : null,
                        extractCookies: true
                      })
                    });

                    if (authRes.ok) {
                      const authData = await authRes.json();
                      const path = methodConfig.tokenPath || 'access_token';
                      const rawToken = path.split('.').reduce((obj, key) => obj?.[key], authData);

                      if (rawToken) {
                        if (methodConfig.usageType === 'Bearer') {
                          stepAuthToken = `Bearer ${rawToken}`;
                          stepAuthHeaderName = 'Authorization';
                        } else if (methodConfig.usageType === 'Cookie') {
                          stepAuthToken = `access_token=${rawToken}`;
                          stepAuthHeaderName = 'Cookie';
                        } else {
                          stepAuthToken = rawToken;
                          stepAuthHeaderName = methodConfig.headerName || 'X-Auth-Token';
                        }

                        const parsedAuthHeaders = parseHeaders(methodConfig.headers);
                        stepAuthDefaultHeaders = {};
                        Object.entries(parsedAuthHeaders).forEach(([k, v]) => {
                          if (k.toLowerCase() !== 'content-type') {
                            stepAuthDefaultHeaders[k] = v;
                          }
                        });

                        authTokensCache[step.authMethod] = {
                          token: stepAuthToken,
                          headerName: stepAuthHeaderName,
                          defaultHeaders: stepAuthDefaultHeaders
                        };

                        setExecutionLogs(prev => [...prev, { 
                          type: 'success', 
                          message: `✅ Token [${methodConfig.name}] acquired for step ${i + 1}.`, 
                          time: new Date().toLocaleTimeString() 
                        }]);
                      } else {
                        setExecutionLogs(prev => [...prev, { 
                          type: 'error', 
                          message: `❌ Failed to extract token from path: ${path} in step ${i + 1}`, 
                          time: new Date().toLocaleTimeString() 
                        }]);
                      }
                    } else {
                      const errorText = await authRes.text();
                      setExecutionLogs(prev => [...prev, { 
                        type: 'error', 
                        message: `❌ Step ${i + 1} Auth Failed: ${authRes.status} ${errorText}`, 
                        time: new Date().toLocaleTimeString() 
                      }]);
                    }
                  } catch (err) {
                    setExecutionLogs(prev => [...prev, { 
                      type: 'error', 
                      message: `❌ Step ${i + 1} Auth Request Error: ${err.message}`, 
                      time: new Date().toLocaleTimeString() 
                    }]);
                  }
                }
              }
            }

            let combinedHeaders = {
              ...stepAuthDefaultHeaders,
              ...parseHeaders(activeEnv?.headers)
            };
            if (step.headers) {
              combinedHeaders = { ...combinedHeaders, ...parseHeaders(step.headers) };
            }

            if (stepAuthToken) {
              const hasCustomAuth = Object.keys(combinedHeaders).some(
                k => k.toLowerCase() === stepAuthHeaderName.toLowerCase()
              );
              if (!hasCustomAuth) {
                combinedHeaders[stepAuthHeaderName] = stepAuthToken;
              }
            }

            let fetchUrl = stepUrl.startsWith('http') ? stepUrl : `${activeEnv?.url}${stepUrl}`;
            if (step.params) {
              try {
                const parsedParams = parseHeaders(step.params);
                const queryString = new URLSearchParams(parsedParams).toString();
                if (queryString) {
                  fetchUrl += (fetchUrl.includes('?') ? '&' : '?') + queryString;
                }
              } catch (e) {}
            }

            try {
              const proxyUrl = import.meta.env.DEV ? '/proxy' : 'http://localhost:5175/proxy';
              
              // Generate cURL command for debugging
              const requestBody = ['POST', 'PUT', 'PATCH'].includes(step.action.toUpperCase()) ? stepValue : null;
              let curlCmd = `curl -X ${step.action.toUpperCase()} '${fetchUrl}'`;
              Object.entries(combinedHeaders || {}).forEach(([k, v]) => {
                curlCmd += ` \\\n  -H "${k}: ${v}"`;
              });
              if (requestBody) {
                curlCmd += ` \\\n  -d '${requestBody}'`;
              }
              setExecutionLogs(prev => [...prev, { 
                type: 'info', 
                message: `🔍 cURL Command:\n${curlCmd}`, 
                time: new Date().toLocaleTimeString() 
              }]);

              const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: fetchUrl,
                  method: step.action.toUpperCase(),
                  headers: combinedHeaders,
                  body: ['POST', 'PUT'].includes(step.action.toUpperCase()) ? stepValue : null
                })
              });

              lastResponse = response;
              const text = await response.text();
              try { lastBody = JSON.parse(text); } catch(e) { lastBody = text; }

              setExecutionLogs(prev => [...prev, { 
                type: response.ok ? 'success' : 'error', 
                message: `Response: ${response.status} ${response.statusText}`,
                data: lastBody,
                time: new Date().toLocaleTimeString() 
              }]);
              if (!response.ok) {
                caseFailed = true;
                break;
              }
            } catch (err) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `Request Failed: ${err.message}`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }
          } else if (step.action === 'verifyStatus') {
            const expected = parseInt(stepValue) || 200;
            const actual = lastResponse?.status;
            if (actual === expected) {
              setExecutionLogs(prev => [...prev, { type: 'success', message: `Assertion Passed: Status is ${actual}`, time: new Date().toLocaleTimeString() }]);
            } else {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `Assertion Failed: Expected ${expected}, got ${actual}`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }
          } else if (step.action === 'verifySchema') {
            if (!lastBody) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Schema Validation Failed: No response body available.`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }

            try {
              const expectedExample = JSON.parse(stepValue || '{}');
              const targetPath = step.locator?.value || '$';
              const actualValue = getValueByPath(lastBody, targetPath);
              const { errors, warnings } = validateJsonByExample(actualValue, expectedExample, targetPath);

              if (errors.length > 0) {
                const errMsg = `Assertion Failed (Schema Mismatch):\n` + errors.map(err => `- ${err}`).join('\n');
                setExecutionLogs(prev => [...prev, { type: 'error', message: errMsg, time: new Date().toLocaleTimeString() }]);
                caseFailed = true;
                break;
              }

              if (warnings.length > 0) {
                const warnMsg = `Assertion Failed (Extra Properties Detected):\n` + warnings.map(w => `- ${w}`).join('\n');
                setExecutionLogs(prev => [...prev, { type: 'error', message: warnMsg + `\n⚠️ (Marking as broken/needs schema update)`, time: new Date().toLocaleTimeString() }]);
                caseFailed = true;
                break;
              }

              setExecutionLogs(prev => [...prev, { type: 'success', message: `✅ Assertion Passed: Response schema matches example.`, time: new Date().toLocaleTimeString() }]);
            } catch (jsonErr) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Invalid Example JSON: ${jsonErr.message}`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }
          } else if (step.action === 'verifyBody') {
            if (!lastBody) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Body Validation Failed: No response body available.`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }

            const targetPath = step.locator?.value || '$';
            const actualValue = getValueByPath(lastBody, targetPath);
            let expectedValue = stepValue;
            
            try {
              if (typeof expectedValue === 'string') {
                if (expectedValue.startsWith('"') && expectedValue.endsWith('"')) {
                  expectedValue = expectedValue.slice(1, -1);
                } else if (expectedValue.startsWith("'") && expectedValue.endsWith("'")) {
                  expectedValue = expectedValue.slice(1, -1);
                } else {
                  expectedValue = JSON.parse(expectedValue);
                }
              }
            } catch (e) {}

            const actualStr = typeof actualValue === 'object' ? JSON.stringify(actualValue) : String(actualValue);
            const expectedStr = typeof expectedValue === 'object' ? JSON.stringify(expectedValue) : String(expectedValue);

            if (actualStr === expectedStr) {
              setExecutionLogs(prev => [...prev, { type: 'success', message: `✅ Assertion Passed: Value at ${targetPath} is equal to ${expectedStr}`, time: new Date().toLocaleTimeString() }]);
            } else {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Assertion Failed: Expected ${expectedStr}, got ${actualStr} at ${targetPath}`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }
          } else if (step.action === 'extractData') {
            if (!lastBody) {
              setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Data Extraction Failed: No response body available.`, time: new Date().toLocaleTimeString() }]);
              caseFailed = true;
              break;
            }

            const targetPath = step.locator?.value || '$';
            const varName = step.value?.trim() || 'extracted_var';
            const extractedValue = getValueByPath(lastBody, targetPath);
            variables[varName] = typeof extractedValue === 'object' ? JSON.stringify(extractedValue) : String(extractedValue);

            setExecutionLogs(prev => [...prev, { 
              type: 'success', 
              message: `ℹ️ Extracted: ${varName} = ${variables[varName]} (from ${targetPath})`, 
              time: new Date().toLocaleTimeString() 
            }]);
          } else if (step.action === 'custom') {
            const code = step.value || '';
            const trimmedCode = code.trim();
            const isGherkin = /^(Given|When|Then|And|But)\s+/i.test(trimmedCode);
            
            if (isGherkin) {
              const waitMatch = trimmedCode.match(/wait for (\d+) second/i);
              if (waitMatch) {
                const secs = parseInt(waitMatch[1]);
                setExecutionLogs(prev => [...prev, { type: 'info', message: `⏳ Waiting for ${secs} seconds...`, time: new Date().toLocaleTimeString() }]);
                await new Promise(r => setTimeout(r, secs * 1000));
              } else {
                setExecutionLogs(prev => [...prev, { 
                  type: 'info', 
                  message: `📝 Custom Gherkin Step: "${trimmedCode}" (Will run in Backend Java runner)`, 
                  time: new Date().toLocaleTimeString() 
                }]);
              }
            } else {
              setExecutionLogs(prev => [...prev, { type: 'info', message: `⚙️ Executing custom JS...`, time: new Date().toLocaleTimeString() }]);
              try {
                const fn = new Function('variables', 'lastBody', 'lastResponse', `return (async () => { ${code} })()`);
                await fn(variables, lastBody, lastResponse);
                setExecutionLogs(prev => [...prev, { type: 'success', message: `✅ Custom JS execution successful.`, time: new Date().toLocaleTimeString() }]);
              } catch (err) {
                setExecutionLogs(prev => [...prev, { type: 'error', message: `❌ Custom JS Execution Failed: ${err.message}`, time: new Date().toLocaleTimeString() }]);
                caseFailed = true;
                break;
              }
            }
          }
        }

        if (caseFailed) {
          overallSuccess = false;
          setExecutionLogs(prev => [...prev, { 
            type: 'error', 
            message: `❌ Test Case [${tc.name}] FAILED!`, 
            time: new Date().toLocaleTimeString() 
          }]);
        } else {
          setExecutionLogs(prev => [...prev, { 
            type: 'success', 
            message: `✅ Test Case [${tc.name}] PASSED!`, 
            time: new Date().toLocaleTimeString() 
          }]);
        }
      }

      setExecutionLogs(prev => [...prev, { 
        type: 'info', 
        message: `\n──────────────────────────────────────────\n🏁 All tests completed. Status: ${overallSuccess ? 'SUCCESS 🎉' : 'FAILURE ❌'}`, 
        time: new Date().toLocaleTimeString() 
      }]);

    } catch (e) {
      setExecutionLogs(prev => [...prev, { type: 'error', message: `Fatal Error: ${e.message}`, time: new Date().toLocaleTimeString() }]);
    }
    setIsRunning(false);
  };

  const handlePushToGit = async () => {
    if (!project.git_repo_url || !project.git_token) {
      alert('Git configuration is missing for this project. Please configure it in project settings.');
      return;
    }

    setIsPushing(true);
    setShowTerminal(true);
    setExecutionLogs(prev => [...prev, { 
      type: 'info', 
      message: `📦 Initializing Git Sync for ${project.git_repo_url}...`, 
      time: new Date().toLocaleTimeString() 
    }]);

    try {
      await gitService.pushToGitHub(project, currentTestCase, steps);
      setExecutionLogs(prev => [...prev, { 
        type: 'success', 
        message: `✅ Successfully pushed tests to ${project.git_branch || 'main'} branch!`, 
        time: new Date().toLocaleTimeString() 
      }]);
    } catch (error) {
      setExecutionLogs(prev => [...prev, { 
        type: 'error', 
        message: `❌ Git Push Failed: ${error.message}`, 
        time: new Date().toLocaleTimeString() 
      }]);
    } finally {
      setIsPushing(false);
    }
  };

  const buildTree = (cases) => {
    const root = { name: 'root', isFolder: true, children: {} };
    
    // Add empty folders
    emptyFolders.forEach(folderPath => {
      const parts = folderPath.split('/').filter(Boolean);
      let current = root;
      parts.forEach((part) => {
        if (!current.children) current.children = {};
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            isFolder: true,
            children: {}
          };
        }
        current = current.children[part];
      });
    });

    // Add actual test cases
    cases.forEach(tc => {
      const parts = tc.name.split('/').filter(Boolean);
      let current = root;
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        if (!current.children) current.children = {};
        
        if (isLast) {
          current.children[part] = {
            id: tc.id,
            name: part,
            fullName: tc.name,
            isFolder: false
          };
        } else {
          if (!current.children[part]) {
            current.children[part] = {
              name: part,
              isFolder: true,
              children: {}
            };
          }
          current = current.children[part];
        }
      });
    });
    
    return root;
  };

  const renderTreeNode = (node, path = '', depth = 0) => {
    const nodePath = path ? `${path}/${node.name}` : node.name;
    
    if (!node.isFolder) {
      const isActive = currentTestCase?.id === node.id;
      return (
        <div 
          key={node.id}
          className={`w-full flex items-center justify-between group px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            isActive 
              ? 'bg-brand-500/10 text-brand-300 border border-brand-500/20' 
              : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
          onClick={async () => {
            if (isActive) return;
            setLoading(true);
            const targetTc = testCases.find(c => c.id === node.id);
            setCurrentTestCase(targetTc);
            setTestName(targetTc.name);
            const { data: loadedSteps } = await testCaseService.getSteps(node.id);
            setSteps(loadedSteps || []);
            setLoading(false);
          }}
        >
          <div className="flex items-center gap-2 truncate">
            <Terminal size={13} className={isActive ? 'text-brand-400' : 'text-slate-500'} />
            <span className="truncate">{node.name}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteTestCase(node.id, e);
            }}
            className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity p-0.5"
            title={libraryLanguage === 'tr' ? 'Senaryoyu Sil' : 'Delete Test Case'}
          >
            <X size={12} />
          </button>
        </div>
      );
    }
    
    const isExpanded = isFolderExpanded(nodePath);
    const folderChildren = Object.values(node.children || {}).sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return (
      <div key={nodePath} className="flex flex-col">
        <div 
          className="w-full flex items-center justify-between group px-2 py-1.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer select-none"
          style={{ paddingLeft: `${Math.max(8, depth * 16)}px` }}
          onClick={() => toggleFolder(nodePath)}
        >
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-slate-500">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="text-brand-400">
              {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
            </span>
            <span className="truncate">{node.name}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreateTestCaseInFolder(nodePath);
              }}
              className="hover:text-brand-400 p-0.5"
              title={libraryLanguage === 'tr' ? 'Yeni Senaryo Ekle' : 'Add Test Case'}
            >
              <Plus size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(nodePath);
              }}
              className="hover:text-red-400 p-0.5"
              title={libraryLanguage === 'tr' ? 'Klasörü Sil' : 'Delete Folder'}
            >
              <X size={12} />
            </button>
          </div>
        </div>
        
        {isExpanded && (
          <div className="flex flex-col mt-0.5">
            {folderChildren.map(child => renderTreeNode(child, nodePath, depth + 1))}
            {folderChildren.length === 0 && (
              <div 
                className="text-[11px] text-slate-500 italic py-1"
                style={{ paddingLeft: `${Math.max(28, (depth + 1) * 16)}px` }}
              >
                {libraryLanguage === 'tr' ? 'Boş klasör' : 'Empty folder'}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };


  return (
    <div className="flex h-screen bg-dark-950 overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 border-r border-white/5 glass flex flex-col">
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-slate-300">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">Test Explorer</h2>
            <p className="text-[10px] text-brand-400 uppercase tracking-wider">{project?.type || 'HYBRID'} PROJECT</p>
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            <span>Test Cases</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={handleCreateFolder}
                className="hover:text-white transition-colors p-1 hover:bg-white/5 rounded"
                title={libraryLanguage === 'tr' ? 'Yeni Klasör' : 'New Folder'}
              >
                <FolderPlus size={14} />
              </button>
              <button 
                onClick={handleCreateTestCase}
                className="hover:text-white transition-colors p-1 hover:bg-white/5 rounded"
                title={libraryLanguage === 'tr' ? 'Yeni Senaryo' : 'New Test Case'}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-1">
            {(() => {
              const tree = buildTree(testCases);
              const rootChildren = Object.values(tree.children || {}).sort((a, b) => {
                if (a.isFolder && !b.isFolder) return -1;
                if (!a.isFolder && b.isFolder) return 1;
                return a.name.localeCompare(b.name);
              });
              
              if (rootChildren.length === 0) {
                return (
                  <div className="text-center py-10 text-slate-500 text-xs italic">
                    {libraryLanguage === 'tr' ? 'Test senaryosu bulunamadı.' : 'No test cases found.'}
                  </div>
                );
              }
              
              return rootChildren.map(child => renderTreeNode(child, '', 0));
            })()}
          </div>
        </div>
      </aside>

      {/* CENTER: Step Builder */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 border-b border-white/5 glass flex items-center justify-between px-6 z-30">
          <div className="flex items-center gap-3">
            <LayoutList className="text-brand-400" size={20} />
            <input 
              type="text" 
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="bg-transparent text-lg font-bold text-white border-none focus:outline-none focus:ring-0 px-0 py-1"
            />
          </div>
          <div className="flex items-center gap-4">
            {/* Environment Selector */}
            {project.environments && project.environments.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl border border-white/10">
                <Globe size={14} className="text-slate-400" />
                <select 
                  value={activeEnv?.name || ''}
                  onChange={(e) => {
                    const env = project.environments.find(env => env.name === e.target.value);
                    setActiveEnv(env);
                  }}
                  className="bg-transparent border-none text-xs text-slate-300 outline-none cursor-pointer hover:text-white transition-colors"
                >
                  {project.environments.map(env => (
                    <option key={env.name} value={env.name} className="bg-dark-900">{env.name}</option>
                  ))}
                </select>
              </div>
            )}



            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isSaving ? 'text-brand-400' : saveError ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {isSaving ? 'Saving Changes...' : saveError ? 'Save Error' : 'Database Synced'}
                </span>
                <span className="text-[9px] text-slate-500">
                  {saveError ? 'Retry in progress...' : 'Real-time protection active'}
                </span>
              </div>
              <button 
                onClick={() => { setShowStepLibrary(!showStepLibrary); setShowCode(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  showStepLibrary 
                    ? 'bg-brand-500/20 border-brand-500/50 text-brand-400' 
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen size={16} />
                Step Library
              </button>
              {project.type === 'api' && (
                <button 
                  onClick={() => setShowQuickGenerateModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600/90 hover:bg-brand-500 text-white text-sm font-semibold transition-all border border-brand-500/20 shadow-md shadow-brand-500/10 active:scale-95"
                >
                  <Wand2 size={16} />
                  {libraryLanguage === 'tr' ? 'Hızlı Test Üret' : 'Quick Generate'}
                </button>
              )}
              <button 
                onClick={handleGenerateCode}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-all border border-white/10"
              >
                <Code size={16} />
                Preview Code
              </button>
              <div className="relative flex items-center bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/10 border border-emerald-500/20">
                <button 
                  onClick={handleRunAll}
                  disabled={isRunning}
                  className="flex items-center gap-2 px-4 py-2 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-50 border-r border-white/10"
                  title={libraryLanguage === 'tr' ? 'Seçili Testleri Çalıştır' : 'Run Selected Tests'}
                >
                  {isRunning ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Play size={15} fill="currentColor" />
                  )}
                  {isRunning 
                    ? 'Running...' 
                    : (selectedTestCaseIds.length === testCases.length)
                      ? (libraryLanguage === 'tr' ? 'Run All' : 'Run All')
                      : `${libraryLanguage === 'tr' ? 'Run Selected' : 'Run Selected'} (${selectedTestCaseIds.length}/${testCases.length})`
                  }
                </button>
                <button
                  type="button"
                  onClick={() => setShowRunSelectDropdown(!showRunSelectDropdown)}
                  className="px-2 py-2.5 text-white hover:bg-white/5 transition-colors rounded-r-lg"
                  title={libraryLanguage === 'tr' ? 'Testleri Seç' : 'Select Tests'}
                >
                  <ChevronDown size={14} className={`transform transition-transform ${showRunSelectDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showRunSelectDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowRunSelectDropdown(false)} />
                    
                    <div className="absolute right-0 top-full mt-2 w-72 bg-dark-900 border border-white/10 rounded-xl p-3 shadow-2xl z-50 flex flex-col gap-2.5 max-h-80 overflow-y-auto">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>{libraryLanguage === 'tr' ? 'Test Senaryoları' : 'Test Scenarios'}</span>
                        <div className="flex gap-2 font-bold text-brand-400">
                          <button 
                            onClick={() => setSelectedTestCaseIds(testCases.map(c => c.id))}
                            className="hover:text-brand-300"
                          >
                            {libraryLanguage === 'tr' ? 'Tümünü Seç' : 'All'}
                          </button>
                          <span>•</span>
                          <button 
                            onClick={() => setSelectedTestCaseIds([])}
                            className="hover:text-brand-300"
                          >
                            {libraryLanguage === 'tr' ? 'Temizle' : 'None'}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5 overflow-y-auto max-h-56">
                        {testCases.map(tc => {
                          const isSelected = selectedTestCaseIds.includes(tc.id);
                          return (
                            <label 
                              key={tc.id} 
                              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                            >
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setSelectedTestCaseIds(prev => prev.filter(id => id !== tc.id));
                                  } else {
                                    setSelectedTestCaseIds(prev => [...prev, tc.id]);
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded border-white/10 text-brand-500 focus:ring-brand-500 bg-dark-950 focus:ring-offset-dark-900 cursor-pointer"
                              />
                              <span className="truncate">{tc.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button 
                onClick={handleQuickRun}
                disabled={isRunning}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold transition-all shadow-lg shadow-brand-500/20 active:scale-95 disabled:opacity-50"
              >
                {isRunning ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play size={16} fill="currentColor" />
                )}
                {isRunning ? 'Running...' : 'Quick Run'}
              </button>
              <button 
                onClick={handlePushToGit}
                disabled={isPushing}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              >
                {isPushing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CloudUpload size={16} />
                )}
                {isPushing ? 'Syncing...' : 'Sync to Repo'}
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 z-10">
          <div className={`max-w-4xl mx-auto space-y-4 ${showTerminal ? 'pb-96' : 'pb-20'}`}>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4" />
                Loading steps...
              </div>
            ) : (
              <AnimatePresence>
                {steps.map((step, index) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    index={index}
                    projectType={project.type}
                    updateStep={updateStep}
                    removeStep={removeStep}
                    selectedCustomSteps={selectedCustomSteps}
                    libraryLanguage={libraryLanguage}
                    user={user}
                    authMethods={project?.auth_methods || []}
                  />
                ))}
              </AnimatePresence>
            )}

            {!loading && (
              <motion.button
                layout
                onClick={addStep}
                className="w-full py-4 border-2 border-dashed border-white/10 hover:border-brand-500/50 hover:bg-brand-500/5 rounded-2xl flex items-center justify-center gap-2 text-slate-400 hover:text-brand-300 font-medium transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-brand-500/20 flex items-center justify-center transition-colors">
                  <Plus size={18} />
                </div>
                Add New Step
              </motion.button>
            )}
          </div>
        </div>

        <div className="absolute top-1/4 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />

        {/* TERMINAL PANEL */}
        <AnimatePresence>
          {showTerminal && (
            <motion.div 
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="absolute bottom-0 left-0 right-0 h-80 bg-dark-950 border-t border-white/10 z-50 flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-dark-900 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-brand-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Execution Output</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleCopyLogs}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                      logsCopied 
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Copy size={11} />
                    {logsCopied ? (libraryLanguage === 'tr' ? 'Kopyalandı!' : 'Copied!') : (libraryLanguage === 'tr' ? 'Kopyala' : 'Copy')}
                  </button>
                  <button onClick={() => setShowTerminal(false)} className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-all">
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                {executionLogs.map((log, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                    <div className="flex-1">
                      <span className={`whitespace-pre-wrap
                        ${log.type === 'error' ? 'text-rose-400' : ''}
                        ${log.type === 'success' ? 'text-emerald-400' : ''}
                        ${log.type === 'step' ? 'text-brand-400 font-bold' : ''}
                        ${log.type === 'info' ? 'text-slate-300 italic' : ''}
                      `}>
                        {log.message}
                      </span>
                      {log.data && (
                        <pre className="mt-1 p-2 bg-white/5 rounded border border-white/5 text-slate-400 overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
                {isRunning && (
                  <div className="flex items-center gap-2 text-brand-400">
                    <div className="w-1 h-1 bg-brand-400 rounded-full animate-ping" />
                    <span>Executing next step...</span>
                  </div>
                )}
                <div ref={terminalEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* RIGHT SIDEBAR: Code Preview */}
      <AnimatePresence>
        {showCode && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-white/5 glass flex flex-col bg-dark-950 overflow-hidden relative"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between min-w-[400px]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Code size={16} className="text-brand-400" /> Generated Code
              </h3>
              <button onClick={() => setShowCode(false)} className="text-slate-500 hover:text-white transition-colors">
                Close
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto min-w-[400px]">
              <div className="bg-dark-900 rounded-xl p-4 border border-white/10 overflow-x-auto relative group">
                <button className="absolute top-2 right-2 p-1.5 bg-white/10 hover:bg-brand-500 rounded-md text-white opacity-0 group-hover:opacity-100 transition-all text-xs font-medium flex items-center gap-1">
                  <Download size={12} /> Export
                </button>
                <pre className="text-[13px] text-slate-300 font-mono leading-relaxed">
                  <code dangerouslySetInnerHTML={{
                    __html: generatedCode
                      .replace(/import|from|export|class|const|let|async|await|super|if|else/g, '<span class="text-pink-400">$&</span>')
                      .replace(/test\.describe|test\.beforeEach|test/g, '<span class="text-blue-400">$&</span>')
                      .replace(/^(Feature|Scenario|Given|When|Then|And|But)\b/gm, '<span class="text-pink-400 font-bold">$&</span>')
                      .replace(/".*?"|'.*?'/g, '<span class="text-emerald-300">$&</span>')
                      .replace(/\/\/.*/g, '<span class="text-slate-500">$&</span>')
                      .replace(/#.*/g, '<span class="text-slate-500 italic">$&</span>')
                  }} />
                </pre>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* RIGHT SIDEBAR: Step Library */}
      <AnimatePresence>
        {showStepLibrary && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 450, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-white/5 glass flex flex-col bg-dark-950 overflow-hidden relative"
          >
            <div className="p-4 border-b border-white/5 flex items-center justify-between min-w-[450px]">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BookOpen size={16} className="text-brand-400" />
                  Step Catalog
                  <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded-full border border-brand-500/30">
                    {stepDefinitions.length} loaded
                  </span>
                </h3>
                <span className="text-[10px] text-slate-500">
                  {libraryLanguage === 'tr' 
                    ? 'Dropdown\'a eklemek istediğiniz adımları seçin' 
                    : 'Check steps to add them to the action dropdown'}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Language Switcher */}
                <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
                  <button 
                    onClick={() => setLibraryLanguage('tr')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      libraryLanguage === 'tr' 
                        ? 'bg-brand-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    TR
                  </button>
                  <button 
                    onClick={() => setLibraryLanguage('en')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                      libraryLanguage === 'en' 
                        ? 'bg-brand-600 text-white shadow-md' 
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    EN
                  </button>
                </div>
                
                <button onClick={() => setShowStepLibrary(false)} className="text-slate-500 hover:text-white transition-colors text-xs font-semibold">
                  Close
                </button>
              </div>
            </div>
            
            {/* Search Input */}
            <div className="p-4 border-b border-white/5 min-w-[450px] flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text"
                  value={stepSearch}
                  onChange={(e) => setStepSearch(e.target.value)}
                  placeholder={libraryLanguage === 'tr' ? 'Adımlarda ara (örn: wait, token, header...)' : 'Search steps (e.g. wait, token, header...)'}
                  className="w-full bg-dark-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-brand-500 transition-all"
                />
                {stepSearch && (
                  <button onClick={() => setStepSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-[10px]">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-w-[450px]">
              {stepDefinitionsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-xs">
                  <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
                  Parsing step definitions from Cucumber project...
                </div>
              ) : stepDefinitions.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs italic">
                  No step definitions found in CommonSteps.kt.
                </div>
              ) : (
                stepDefinitions
                  .filter(s => {
                    const meta = stepMetadata[s.pattern] || {
                      en: { name: s.name_en || s.name || s.pattern.replace(/^I\s+/, ''), desc: s.desc_en || s.desc || s.description || "" },
                      tr: { name: s.name_tr || s.name || s.pattern, desc: s.desc_tr || s.desc || s.description || "" }
                    };
                    const name = libraryLanguage === 'tr' ? meta.tr.name : meta.en.name;
                    const desc = libraryLanguage === 'tr' ? meta.tr.desc : meta.en.desc;
                    
                    return s.pattern.toLowerCase().includes(stepSearch.toLowerCase()) || 
                           s.type.toLowerCase().includes(stepSearch.toLowerCase()) ||
                           name.toLowerCase().includes(stepSearch.toLowerCase()) ||
                           (desc && desc.toLowerCase().includes(stepSearch.toLowerCase()));
                  })
                  .map((s, idx) => {
                    const isChecked = selectedCustomSteps.some(cs => cs.pattern === s.pattern && cs.type === s.type);
                    
                    const meta = stepMetadata[s.pattern] || {
                      en: { name: s.name_en || s.name || s.pattern.replace(/^I\s+/, ''), desc: s.desc_en || s.desc || s.description || "" },
                      tr: { name: s.name_tr || s.name || s.pattern, desc: s.desc_tr || s.desc || s.description || "" }
                    };
                    const stepName = libraryLanguage === 'tr' ? meta.tr.name : meta.en.name;
                    const stepDesc = libraryLanguage === 'tr' ? meta.tr.desc : meta.en.desc;

                    let typeBadgeColor = 'bg-blue-500/10 border-blue-500/30 text-blue-400';
                    if (s.type === 'When') typeBadgeColor = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
                    if (s.type === 'Then') typeBadgeColor = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
                    if (s.type === 'And') typeBadgeColor = 'bg-purple-500/10 border-purple-500/30 text-purple-400';

                    const patternHtml = s.pattern
                      .replace(/\{string\}/g, '<span class="text-emerald-400 font-bold font-mono">"string"</span>')
                      .replace(/\{int\}/g, '<span class="text-cyan-400 font-bold font-mono">int</span>')
                      .replace(/\{long\}/g, '<span class="text-cyan-400 font-bold font-mono">long</span>');

                    return (
                      <div 
                        key={idx}
                        onClick={() => handleToggleCustomStep(s)}
                        className={`p-4 border rounded-xl cursor-pointer transition-all flex gap-3 relative select-none ${
                          isChecked 
                            ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/5' 
                            : 'bg-white/5 border-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Checkbox wrapper */}
                        <div className="flex items-start pt-0.5">
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => {}} // toggled by card onClick
                            className="w-4 h-4 rounded border-white/10 text-brand-500 focus:ring-brand-500 bg-dark-900 focus:ring-offset-dark-950 cursor-pointer pointer-events-none"
                          />
                        </div>
                        
                        <div className="flex-1 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">
                              {stepName}
                            </span>
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border ${typeBadgeColor}`}>
                              {s.type}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-slate-400 leading-normal">
                            {stepDesc}
                          </p>

                          <div 
                            className="text-[10px] text-slate-300 font-mono bg-dark-950/40 p-2 rounded border border-white/5 select-all leading-normal"
                            dangerouslySetInnerHTML={{ __html: `${s.type} ${patternHtml}` }}
                          />

                          <div className="text-[8px] text-slate-600 font-mono mt-1 border-t border-white/5 pt-1 flex flex-col gap-1">
                            <div className="flex justify-between">
                              <span>fun {s.functionName || 'custom()'}()</span>
                            </div>
                            <div className="text-[9px] text-brand-400/95 font-medium border-t border-white/5 pt-1 mt-0.5 select-all">
                              <span className="font-bold text-slate-500 mr-1">Örnek:</span>
                              {generateExampleUsage(s.type, s.pattern, defaultActor)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickGenerateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-dark-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-5 border-b border-white/5 flex items-center justify-between bg-dark-950/40">
                <div className="flex items-center gap-2.5">
                  <Wand2 className="text-brand-400" size={18} />
                  <h3 className="font-bold text-white text-base">
                    {libraryLanguage === 'tr' ? 'Hızlı Test Adımları Üret' : 'Quick Generate Test Steps'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowQuickGenerateModal(false)}
                  className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-12 gap-4 border-b border-white/5 pb-4 mb-2">
                  <div className="col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                      {libraryLanguage === 'tr' ? 'Hedef Klasör' : 'Target Folder'}
                    </label>
                    <input
                      type="text"
                      list="existing-folders-list"
                      value={generateFolder}
                      onChange={(e) => setGenerateFolder(e.target.value)}
                      placeholder={libraryLanguage === 'tr' ? 'örn: membership (İsteğe bağlı)' : 'e.g. membership (Optional)'}
                      className="w-full bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-brand-500 transition-all"
                    />
                    <datalist id="existing-folders-list">
                      {getExistingFolders().map(folder => (
                        <option key={folder} value={folder} />
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-6">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                      {libraryLanguage === 'tr' ? 'Senaryo (Feature) Adı' : 'Scenario (Feature) Name'}
                    </label>
                    <input
                      type="text"
                      value={generateFeatureName}
                      onChange={(e) => setGenerateFeatureName(e.target.value)}
                      placeholder={libraryLanguage === 'tr' ? 'Boş ise mevcut senaryoya ekler' : 'Blank appends to current'}
                      className="w-full bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-brand-500 transition-all font-semibold"
                    />
                  </div>
                </div>

                {generateError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex flex-col gap-1 font-medium leading-relaxed">
                    <span className="font-bold flex items-center gap-1.5 text-rose-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      {libraryLanguage === 'tr' ? 'Hata Oluştu' : 'Error Occurred'}
                    </span>
                    <span className="font-mono text-[10px] bg-black/35 p-2 rounded border border-rose-500/10 select-text overflow-x-auto whitespace-pre-wrap">
                      {generateError}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                      {libraryLanguage === 'tr' ? 'Metot' : 'Method'}
                    </label>
                    <select
                      value={generateMethod}
                      onChange={(e) => setGenerateMethod(e.target.value)}
                      className="w-full bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-brand-300 outline-none focus:border-brand-500 transition-all font-bold"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                  </div>

                  <div className="col-span-8">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                      {libraryLanguage === 'tr' ? 'Endpoint Yolu' : 'Endpoint Path'}
                    </label>
                    <input
                      type="text"
                      value={generatePath}
                      onChange={(e) => setGeneratePath(e.target.value)}
                      placeholder="/api/v1/users"
                      className="w-full bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 outline-none focus:border-brand-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                    {libraryLanguage === 'tr' ? 'Beklenen Durum Kodu' : 'Expected Status Code'}
                  </label>
                  <input
                    type="number"
                    value={generateExpectedStatus}
                    onChange={(e) => setGenerateExpectedStatus(Number(e.target.value))}
                    className="w-full bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-mono"
                  />
                </div>

                {project.auth_methods && project.auth_methods.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                      {libraryLanguage === 'tr' ? 'Kimlik Doğrulama / Token Türü' : 'Authentication / Token Type'}
                    </label>
                    <select
                      value={generateAuthMethodName}
                      onChange={(e) => setGenerateAuthMethodName(e.target.value)}
                      className="w-full bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-brand-500 transition-all font-bold"
                    >
                      <option value="" className="bg-dark-900">NO TOKEN</option>
                      {project.auth_methods.map(auth => (
                        <option key={auth.name} value={auth.name} className="bg-dark-900">{auth.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                    {libraryLanguage === 'tr' ? 'İstek Başlıkları (Headers)' : 'Request Headers'}
                  </label>
                  <textarea
                    value={generateHeaders}
                    onChange={(e) => setGenerateHeaders(e.target.value)}
                    placeholder="Content-Type: application/json&#10;Authorization: Bearer {{token}}"
                    className="w-full h-20 bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2 text-xs text-brand-300 placeholder-slate-600 outline-none focus:border-brand-500 transition-all font-mono resize-none"
                  />
                </div>

                {['POST', 'PUT', 'PATCH'].includes(generateMethod) && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase">
                      {libraryLanguage === 'tr' ? 'İstek Gövdesi (Body)' : 'Request Body'}
                    </label>
                    <textarea
                      value={generateBody}
                      onChange={(e) => setGenerateBody(e.target.value)}
                      placeholder="{&#10;  &quot;username&quot;: &quot;test_user&quot;&#10;}"
                      className="w-full h-28 bg-dark-950/65 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-brand-300 placeholder-slate-600 outline-none focus:border-brand-500 transition-all font-mono resize-y"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="autoSchema"
                    checked={generateAutoSchema}
                    onChange={(e) => setGenerateAutoSchema(e.target.checked)}
                    className="w-4 h-4 rounded border-white/10 text-brand-500 focus:ring-brand-500 bg-dark-950 focus:ring-offset-dark-900 cursor-pointer"
                  />
                  <label htmlFor="autoSchema" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                    {libraryLanguage === 'tr' 
                      ? 'Yanıtı çekerek Şemayı Otomatik Üret (JSON Schema)' 
                      : 'Fetch response and auto-generate JSON Schema'}
                  </label>
                </div>
                {generateAutoSchema && (
                  <p className="text-[10px] text-slate-500 italic leading-relaxed">
                    {libraryLanguage === 'tr'
                      ? '* Bu işlem, aktif ortam URL\'ini kullanarak arka planda bir deneme isteği gönderir ve dönen JSON yapısından şema üretir.'
                      : '* This performs a background dry-run request using the active environment URL and generates a schema from the returned JSON structure.'}
                  </p>
                )}
              </div>

              <div className="p-4 border-t border-white/5 bg-dark-950/40 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowQuickGenerateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/5"
                >
                  {libraryLanguage === 'tr' ? 'İptal' : 'Cancel'}
                </button>
                <button
                  onClick={handleQuickGenerateSteps}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-lg shadow-brand-500/10 active:scale-95"
                >
                  {libraryLanguage === 'tr' ? 'Adımları Üret' : 'Generate Steps'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default TestBuilderPage;
