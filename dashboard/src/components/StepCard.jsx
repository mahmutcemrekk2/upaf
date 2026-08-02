import React, { useState } from 'react';
import { Trash2, GripVertical, ChevronDown, Settings2, Code2, Shield, Info, BookOpen, FileText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const uiActions = [
  { id: 'navigate', label: 'Navigate To' },
  { id: 'click', label: 'Click' },
  { id: 'fill', label: 'Fill Text' },
  { id: 'check', label: 'Check Box' },
  { id: 'uncheck', label: 'Uncheck Box' },
  { id: 'select', label: 'Select Option' },
  { id: 'waitForElement', label: 'Wait For Element' },
  { id: 'verifyText', label: 'Verify Text' },
  { id: 'verifyVisible', label: 'Verify Visible' },
  { id: 'custom', label: 'Custom Step' },
];

const apiActions = [
  { id: 'get', label: 'GET Request' },
  { id: 'post', label: 'POST Request' },
  { id: 'put', label: 'PUT Request' },
  { id: 'delete', label: 'DELETE Request' },
  { id: 'verifyStatus', label: 'Verify Status Code' },
  { id: 'verifyBody', label: 'Verify Response Body' },
  { id: 'verifySchema', label: 'Verify Response Schema (Example JSON)' },
  { id: 'extractData', label: 'Extract Data (JSONPath)' },
  { id: 'custom', label: 'Custom Step / Code' }
];

const locatorStrategies = [
  { id: 'id', label: 'ID (#)' },
  { id: 'css', label: 'CSS Selector' },
  { id: 'xpath', label: 'XPath' },
  { id: 'data-testid', label: 'Data Test ID' },
  { id: 'text', label: 'Text Content' },
  { id: 'role', label: 'Role' },
  { id: 'jsonpath', label: 'JSONPath' },
];

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

const compileGherkinStep = (type, pattern, fields, paramValues, defaultActor) => {
  let gherkin = pattern;
  fields.forEach(field => {
    let val = paramValues[field.index];
    if (field.label.toLowerCase() === 'actor' && defaultActor) {
      val = defaultActor;
    }
    if (val === undefined || val === '') {
      val = '';
    }
    let formattedVal = val;
    if (field.rawType === 'string') {
      formattedVal = `"${val}"`;
    }
    const placeholder = `{${field.rawType}}`;
    gherkin = gherkin.replace(placeholder, formattedVal);
  });
  return `${type} ${gherkin}`;
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

const StepCard = ({ step, index, projectType, updateStep, removeStep, selectedCustomSteps = [], libraryLanguage = 'tr', user, authMethods = [] }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showParams, setShowParams] = useState(false);

  const isApiAction = ['get', 'post', 'put', 'delete', 'verifyStatus', 'verifyBody', 'extractData', 'verifySchema'].includes(step.action);
  const isRequestAction = ['get', 'post', 'put', 'delete'].includes(step.action);
  const isDataAction = ['verifyBody', 'extractData', 'verifySchema'].includes(step.action);
  
  const requiresLocator = !isApiAction && step.action !== 'navigate' && step.action !== 'custom';
  const requiresValue = ['navigate', 'fill', 'select', 'verifyText', 'post', 'put', 'verifyStatus', 'verifyBody', 'extractData', 'verifySchema', 'custom'].includes(step.action);

  let availableActions = uiActions;
  if (projectType === 'api') availableActions = apiActions;
  else if (projectType === 'hybrid') availableActions = [...apiActions, ...uiActions];

  const customOptions = (selectedCustomSteps || []).map(cs => {
    const meta = cs.meta || stepMetadata[cs.pattern] || {
      en: { name: cs.pattern, desc: "" },
      tr: { name: cs.pattern, desc: "" }
    };
    const name = libraryLanguage === 'tr' ? meta.tr.name : meta.en.name;
    return {
      id: `custom_step:${cs.type}:${cs.pattern}`,
      label: `${cs.type} - ${name}`
    };
  });
  availableActions = [...availableActions, ...customOptions];

  const customStepDef = selectedCustomSteps.find(s => s.pattern === step.customPattern);
  const fields = customStepDef ? parseCustomStepParams(customStepDef.pattern, customStepDef.params) : [];
  const defaultActor = user?.email ? user.email.split('@')[0] : 'user';

  // Extract Step Title and Description for display
  const customStepMeta = (customStepDef && customStepDef.meta) || (step.customPattern ? stepMetadata[step.customPattern] : null) || (customStepDef ? {
    en: { name: customStepDef.name_en || customStepDef.name || customStepDef.pattern, desc: customStepDef.desc_en || customStepDef.desc || customStepDef.description },
    tr: { name: customStepDef.name_tr || customStepDef.name || customStepDef.pattern, desc: customStepDef.desc_tr || customStepDef.desc || customStepDef.description }
  } : null);

  const stepTitle = customStepMeta 
    ? (libraryLanguage === 'tr' ? (customStepMeta.tr?.name || customStepMeta.en?.name) : (customStepMeta.en?.name || customStepMeta.tr?.name))
    : (customStepDef?.name || '');

  const stepDescription = customStepMeta
    ? (libraryLanguage === 'tr' ? (customStepMeta.tr?.desc || customStepMeta.en?.desc) : (customStepMeta.en?.desc || customStepMeta.tr?.desc))
    : (customStepDef?.desc || customStepDef?.description || step.customDesc || '');

  const cleanDescription = (stepDescription && stepDescription !== "Özel adım." && stepDescription !== "Custom step.")
    ? stepDescription
    : null;

  React.useEffect(() => {
    if (step.action === 'custom' && customStepDef && fields.length > 0) {
      let changed = false;
      const newVals = step.customParamValues ? [...step.customParamValues] : [];
      fields.forEach(field => {
        if (field.label.toLowerCase() === 'actor') {
          if (newVals[field.index] !== defaultActor) {
            newVals[field.index] = defaultActor;
            changed = true;
          }
        }
      });
      if (changed || !step.customParamValues) {
        updateStep(index, 'customParamValues', newVals);
        const stepType = step.value?.trim().split(/\s+/)[0] || customStepDef.type || 'Given';
        const compiled = compileGherkinStep(stepType, customStepDef.pattern, fields, newVals, defaultActor);
        updateStep(index, 'value', compiled);
      }
    }
  }, [step.action, customStepDef, fields, defaultActor]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group flex flex-col gap-4 p-5 glass rounded-2xl border border-white/10 hover:border-brand-500/40 bg-dark-950/60 shadow-xl transition-all relative overflow-hidden"
    >
      {/* Accent Indicator Bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isApiAction ? 'bg-brand-500' : 'bg-emerald-500'}`} />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 cursor-grab text-slate-500 hover:text-white transition-colors">
            <GripVertical size={16} />
            <span className="text-[11px] font-bold bg-white/5 px-2 py-0.5 rounded-md border border-white/10 text-slate-300">
              #{index + 1}
            </span>
          </div>

          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isApiAction 
              ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' 
              : step.action === 'custom'
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}>
            {step.action === 'custom' 
              ? (step.value?.trim().split(/\s+/)[0] || customStepDef?.type || 'CUSTOM') 
              : step.action.toUpperCase()}
          </span>

          {stepTitle && (
            <span className="text-xs font-bold text-white truncate max-w-md">
              {stepTitle}
            </span>
          )}
        </div>

        <button
          onClick={() => removeStep(index)}
          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all"
          title="Remove Step"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Inputs Section */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-12 gap-4">
          
          {/* Action Selection */}
          <div className="col-span-12 md:col-span-4">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {libraryLanguage === 'tr' ? 'Adım Yöntemi' : 'Action'}
            </label>
            <div className="relative">
              <select
                value={step.action === 'custom' && step.customPattern 
                  ? `custom_step:${step.value?.trim().split(/\s+/)[0] || 'Given'}:${step.customPattern}` 
                  : step.action}
                onChange={(e) => updateStep(index, 'action', e.target.value)}
                className="w-full appearance-none bg-dark-900/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all font-medium"
              >
                {availableActions.map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Locator / URL / JSONPath Input */}
          {(requiresLocator || isRequestAction || isDataAction) && (
            <div className="col-span-12 md:col-span-5 flex gap-2">
              {!isRequestAction && !isDataAction && (
                <div className="w-1/3">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Target By</label>
                  <div className="relative">
                    <select
                      value={step.locator?.strategy || 'css'}
                      onChange={(e) => {
                        const newLocator = { ...step.locator, strategy: e.target.value };
                        updateStep(index, 'locator', newLocator);
                      }}
                      className="w-full appearance-none bg-dark-900/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-brand-500 outline-none transition-all"
                    >
                      {locatorStrategies.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
              <div className={(!isRequestAction && !isDataAction) ? 'w-2/3' : 'w-full'}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  {isRequestAction ? 'Endpoint URL / Path' : isDataAction ? 'JSONPath' : 'Selector / Value'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={step.locator?.value || ''}
                    onChange={(e) => {
                      const newLocator = { ...step.locator, value: e.target.value, strategy: isRequestAction ? 'endpoint' : isDataAction ? 'jsonpath' : (step.locator?.strategy || 'css') };
                      updateStep(index, 'locator', newLocator);
                    }}
                    placeholder={isRequestAction ? '/api/v1/...' : isDataAction ? '$.data.id' : 'e.g. #submit-btn'}
                    className="flex-1 bg-dark-900/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:border-brand-500 outline-none transition-all font-mono"
                  />
                  {requiresLocator && (
                    <input
                      type="text"
                      value={step.locator?.name || ''}
                      onChange={(e) => {
                        const newLocator = { ...step.locator, name: e.target.value };
                        updateStep(index, 'locator', newLocator);
                      }}
                      placeholder="Name"
                      className="w-1/4 bg-dark-900/80 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-brand-400 focus:border-brand-500 outline-none transition-all"
                      title="Variable name for this element"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons for API */}
          {isRequestAction && (
            <div className="col-span-12 md:col-span-3 flex flex-col justify-end pb-0.5 gap-2 font-semibold">
              <button 
                type="button"
                onClick={() => {
                  setShowAdvanced(!showAdvanced);
                  setShowParams(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                  showAdvanced 
                    ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' 
                    : 'bg-dark-900/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Settings2 size={13} />
                  {libraryLanguage === 'tr' ? 'Başlıklar' : 'Headers'}
                </span>
                {step.headers && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />}
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  setShowParams(!showParams);
                  setShowAdvanced(false);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                  showParams 
                    ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' 
                    : 'bg-dark-900/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Code2 size={13} />
                  {libraryLanguage === 'tr' ? 'Parametreler' : 'Params'}
                </span>
                {step.params && <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />}
              </button>

              {authMethods.length > 0 && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-dark-900/40 rounded-xl border border-white/5 text-[10px] font-bold text-slate-400 hover:border-white/10 transition-all">
                  <span className="flex items-center gap-2">
                    <Shield size={13} className={step.authMethod ? 'text-amber-400' : 'text-slate-500'} />
                    Token:
                  </span>
                  <div className="relative flex items-center">
                    <select
                      value={step.authMethod || ''}
                      onChange={(e) => updateStep(index, 'authMethod', e.target.value)}
                      className="bg-transparent border-none text-[10px] text-right font-bold outline-none cursor-pointer text-slate-300 hover:text-white transition-colors pr-4 appearance-none"
                    >
                      <option value="" className="bg-dark-900 text-left text-xs">NO TOKEN</option>
                      {authMethods.map(auth => (
                        <option key={auth.name} value={auth.name} className="bg-dark-900 text-left text-xs">{auth.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced Section (Headers) */}
        <AnimatePresence>
          {showAdvanced && isRequestAction && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-dark-950/50 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Code2 size={12} /> Custom Headers (JSON or Key: Value)
                  </label>
                </div>
                <textarea
                  value={step.headers || ''}
                  onChange={(e) => updateStep(index, 'headers', e.target.value)}
                  placeholder='{ "Authorization": "Bearer token", "Content-Type": "application/json" }'
                  className="w-full h-24 bg-dark-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-brand-300 font-mono focus:border-brand-500 outline-none transition-all resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Params Section */}
        <AnimatePresence>
          {showParams && isRequestAction && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-dark-950/50 rounded-xl border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Code2 size={12} /> Query Parameters (JSON or Key: Value)
                  </label>
                </div>
                <textarea
                  value={step.params || ''}
                  onChange={(e) => updateStep(index, 'params', e.target.value)}
                  placeholder="currencyCode: TRY&#10;maturity: 32"
                  className="w-full h-24 bg-dark-900/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-brand-300 font-mono focus:border-brand-500 outline-none transition-all resize-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step Parameters Grid for Custom Steps */}
        {step.action === 'custom' && step.customPattern && fields.length > 0 && (
          <div className="bg-dark-900/40 p-4 rounded-xl border border-white/5 space-y-3">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Code2 size={13} className="text-brand-400" />
              {libraryLanguage === 'tr' ? 'ADIM PARAMETRELERİ' : 'STEP PARAMETERS'}
            </label>
            <div className="grid grid-cols-12 gap-3">
              {fields.map((field) => (
                <div key={field.index} className="col-span-12 md:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-300">
                      {field.label}
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400 border border-white/5">
                      {field.rawType}
                    </span>
                  </div>
                  <input
                    type={field.type}
                    value={step.customParamValues?.[field.index] ?? (field.label.toLowerCase() === 'actor' ? defaultActor : '')}
                    disabled={field.label.toLowerCase() === 'actor'}
                    onChange={(e) => {
                      const newVals = [...(step.customParamValues || [])];
                      newVals[field.index] = field.type === 'number' ? Number(e.target.value) : e.target.value;
                      updateStep(index, 'customParamValues', newVals);
                      
                      const stepType = step.value?.trim().split(/\s+/)[0] || customStepDef?.type || 'Given';
                      const compiled = compileGherkinStep(stepType, customStepDef?.pattern || step.customPattern, fields, newVals, defaultActor);
                      updateStep(index, 'value', compiled);
                    }}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    className={`w-full bg-dark-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-brand-300 font-mono focus:border-brand-500 outline-none transition-all ${
                      field.label.toLowerCase() === 'actor' ? 'opacity-60 cursor-not-allowed bg-dark-950/40' : ''
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step Info Box: Title, Description and Example Usage */}
        {step.action === 'custom' && (step.customPattern || customStepDef) && (
          <div className="p-4 bg-brand-500/10 border border-brand-500/20 rounded-2xl space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-brand-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  {stepTitle || (libraryLanguage === 'tr' ? 'Adım Açıklaması' : 'Step Description')}
                </span>
              </div>
              {cleanDescription && (
                <p className="text-xs text-slate-300 leading-relaxed font-normal pl-5">
                  {cleanDescription}
                </p>
              )}
            </div>

            <div className="pt-2.5 border-t border-brand-500/15 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {libraryLanguage === 'tr' ? 'Örnek Kullanım:' : 'Example Usage:'}
              </span>
              <div className="font-mono text-[11px] text-brand-300 bg-dark-950/60 p-2.5 rounded-xl border border-white/5 select-all leading-normal">
                {generateExampleUsage(
                  step.value?.trim().split(/\s+/)[0] || customStepDef?.type || 'Given', 
                  step.customPattern || customStepDef?.pattern, 
                  defaultActor
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payload / Value Section for non-custom steps */}
        {requiresValue && step.action !== 'custom' && (
          <div className="col-span-12">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {['post', 'put'].includes(step.action) 
                ? 'Request Body (Payload)' 
                : step.action === 'extractData' 
                ? 'Variable Name (To Save Into)' 
                : isDataAction 
                ? 'Expected Value / Condition' 
                : 'Input Value'}
            </label>
            {['post', 'put', 'verifyBody', 'verifySchema'].includes(step.action) ? (
              <textarea
                value={step.value || ''}
                onChange={(e) => updateStep(index, 'value', e.target.value)}
                placeholder={
                  step.action === 'verifySchema'
                    ? '{\n  "status": "success",\n  "data": {}\n}'
                    : '{ "username": "upaf_user", "email": "test@upaf.io" }'
                }
                className="w-full h-32 bg-dark-900/80 border border-white/10 rounded-xl px-4 py-3 text-xs text-brand-300 font-mono focus:border-brand-500 outline-none transition-all resize-y"
              />
            ) : (
              <input
                type="text"
                value={step.value || ''}
                onChange={(e) => updateStep(index, 'value', e.target.value)}
                placeholder={step.action === 'extractData' ? 'e.g. myVariableName' : isApiAction ? 'e.g. 200 or "success"' : 'Enter value...'}
                className="w-full bg-dark-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-brand-300 font-mono focus:border-brand-500 outline-none transition-all"
              />
            )}
          </div>
        )}

        {/* Step Notes / Description Input Bar */}
        <div className="border-t border-white/5 pt-2.5 flex items-center gap-2">
          <FileText size={12} className="text-slate-500 shrink-0" />
          <input
            type="text"
            value={(step.description === "Özel adım." || step.description === "Custom step.") ? '' : (step.description || '')}
            onChange={(e) => updateStep(index, 'description', e.target.value)}
            placeholder={
              cleanDescription 
                ? `${cleanDescription}`
                : (libraryLanguage === 'tr' ? 'Adıma özel not veya açıklama ekleyin...' : 'Add step note or description...')
            }
            className="w-full bg-transparent border-none text-[11px] text-slate-400 focus:text-slate-200 outline-none transition-all italic placeholder-slate-600"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default StepCard;
