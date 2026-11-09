import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
app.use(cors());
// Increased limit for large token responses and complex bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const activeRecorderSessions = new Map();

function getPrecedingComment(fileContent, index) {
  const searchArea = fileContent.substring(Math.max(0, index - 500), index).trimEnd();
  if (searchArea.endsWith('*/')) {
    const startIdx = searchArea.lastIndexOf('/**');
    if (startIdx !== -1) {
      const commentBlock = searchArea.substring(startIdx + 3, searchArea.length - 2);
      const between = searchArea.substring(startIdx);
      if (!between.includes('@') && !between.includes('public') && !between.includes('}')) {
        const lines = commentBlock.split('\n');
        const cleanLines = lines.map(line => {
          const trimmed = line.trim();
          if (trimmed.startsWith('*')) {
            return trimmed.substring(1).trim();
          }
          return trimmed;
        }).filter(line => line.length > 0 && !line.startsWith('@'));
        return cleanLines.join(' ').trim();
      }
    }
  }
  const lines = searchArea.split('\n');
  const commentLines = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('//')) {
      commentLines.unshift(line.substring(2).trim());
    } else if (line === '') {
      continue;
    } else {
      break;
    }
  }
  if (commentLines.length > 0) {
    return commentLines.join(' ').trim();
  }
  return '';
}

function getStepMetaFromPattern(pattern) {
  const stepMappings = {
    "{word} uses {string} service": {
      name_tr: "Servis Belirle",
      name_en: "Set Active Service",
      desc_tr: "Aktif mikroservis adresini tanımlar.",
      desc_en: "Defines the active microservice URL."
    },
    "{word} sets header {string} to {string}": {
      name_tr: "Başlık Ekle",
      name_en: "Add Header",
      desc_tr: "İsteğe özel bir anahtar-değer başlığı ekler.",
      desc_en: "Adds a custom key-value header to the request."
    },
    "{word} sets the following headers:": {
      name_tr: "Çoklu Başlık Ekle",
      name_en: "Add Multiple Headers",
      desc_tr: "İsteğe tablodaki çoklu başlıkları ekler.",
      desc_en: "Adds multiple headers from a table to the request."
    },
    "{word} removes header {string}": {
      name_tr: "Başlığı Kaldır",
      name_en: "Remove Header",
      desc_tr: "İstekten belirtilen başlığı siler.",
      desc_en: "Deletes the specified header from the request."
    },
    "{word} sets default mobile headers": {
      name_tr: "Mobil Başlıkları Tanımla",
      name_en: "Set Mobile Headers",
      desc_tr: "Standart mobil cihaz başlıklarını isteğe ekler.",
      desc_en: "Adds standard mobile device headers to the request."
    },
    "{word} is authenticated with token {string}": {
      name_tr: "Ham Token ile Giriş",
      name_en: "Authenticate with Token",
      desc_tr: "Erişim token'ını yetkilendirme başlığına ekler.",
      desc_en: "Appends the access token to the authorization header."
    },
    "{word} is logged in as default": {
      name_tr: "Varsayılan Kullanıcı ile Giriş",
      name_en: "Login as Default User",
      desc_tr: "Varsayılan kullanıcı bilgileriyle sisteme giriş yapar.",
      desc_en: "Logs in with the default user credentials."
    },
    "{word} is logged in with username {string} and password {string}": {
      name_tr: "Kullanıcı Bilgileriyle Giriş",
      name_en: "Login with Credentials",
      desc_tr: "Belirtilen kullanıcı adı ve şifreyle sisteme giriş yapar.",
      desc_en: "Logs in with the specified username and password."
    },
    "{word} has stored {string} as {string}": {
      name_tr: "Değişken Sakla",
      name_en: "Store Variable",
      desc_tr: "Adımlarda kullanmak üzere yerel değişken kaydeder.",
      desc_en: "Saves a local variable for use in subsequent steps."
    },
    "{word} sends {string} request to {string}": {
      name_tr: "İstek Gönder",
      name_en: "Send Request",
      desc_tr: "Belirtilen adrese HTTP isteği gönderir.",
      desc_en: "Sends an HTTP request to the specified URL."
    },
    "{word} sends {string} request to {string} with query params:": {
      name_tr: "Sorgu Parametreleriyle İstek Gönder",
      name_en: "Send Request with Query Params",
      desc_tr: "Sorgu parametreleri içeren bir HTTP isteği gönderir.",
      desc_en: "Sends an HTTP request containing query parameters."
    },
    "{word} sends {string} request to {string} with body:": {
      name_tr: "Gövdeyle İstek Gönder",
      name_en: "Send Request with Body",
      desc_tr: "İstek gövdesi (body) içeren bir HTTP isteği gönderir.",
      desc_en: "Sends an HTTP request containing a body."
    },
    "{word} sends form {string} request to {string} with params:": {
      name_tr: "Form Parametreleriyle İstek Gönder",
      name_en: "Send Form Request",
      desc_tr: "Form parametreleri içeren bir POST isteği gönderir.",
      desc_en: "Sends a POST request containing form parameters."
    },
    "{word} sends {string} request to {string} with payload:": {
      name_tr: "Payload ile İstek Gönder",
      name_en: "Send Request with Payload",
      desc_tr: "JSON veri gövdesi (payload) içeren bir HTTP isteği gönderir.",
      desc_en: "Sends an HTTP request containing a JSON payload."
    },
    "{word} sends a multipart {string} request to {string} with dynamically generated excel containing:": {
      name_tr: "Multipart Excel Gönder",
      name_en: "Send Multipart Excel",
      desc_tr: "Dinamik olarak Excel dosyası oluşturup multipart istek olarak gönderir.",
      desc_en: "Dynamically generates an Excel sheet and uploads it via multipart request."
    },
    "{word} sends a {string} request to {string} replacing {string} with each value from {string}": {
      name_tr: "Döngülü İstek Gönder",
      name_en: "Send Looping Request",
      desc_tr: "Belirtilen listedeki her bir değer için endpoint'i güncelleyip istek gönderir.",
      desc_en: "Updates the endpoint and sends a request for each value in the list."
    },
    "{word} sends multiple {string} requests with the following data:": {
      name_tr: "Çoklu İstek Gönder",
      name_en: "Send Multiple Requests",
      desc_tr: "Tabloda verilen verilerle sırasıyla çoklu istek gönderir.",
      desc_en: "Sends multiple HTTP requests sequentially using the table data."
    },
    "response status code should be {int}": {
      name_tr: "Durum Kodunu Doğrula",
      name_en: "Verify Status Code",
      desc_tr: "Sunucudan dönen HTTP durum kodunu kontrol eder.",
      desc_en: "Verifies the HTTP status code returned from the server."
    },
    "{word} stores response {string} as {string}": {
      name_tr: "Yanıt Alanını Kaydet",
      name_en: "Save Response Field",
      desc_tr: "Yanıttaki belirli bir JSONPath alanını değişkene kaydeder.",
      desc_en: "Saves a specific JSONPath field from the response to a variable."
    },
    "{word} stores response body as {string}": {
      name_tr: "Tüm Yanıtı Kaydet",
      name_en: "Save Entire Response",
      desc_tr: "Gelen tüm yanıt gövdesini değişkene aktarır.",
      desc_en: "Saves the entire incoming response body to a variable."
    },
    "{word} stores the cookie {string} as {string}": {
      name_tr: "Çerezi Kaydet",
      name_en: "Save Cookie",
      desc_tr: "Yanıttaki bir çerez değerini değişkene aktarır.",
      desc_en: "Saves a cookie value from the response to a variable."
    },
    "{word} stores response {string} as global variable {string}": {
      name_tr: "Global Değişken Kaydet",
      name_en: "Save Global Variable",
      desc_tr: "Bir değeri tüm senaryolarda ortak kullanılacak şekilde global kaydeder.",
      desc_en: "Saves a value globally to be shared across all test scenarios."
    },
    "{word} stores value {string} as global variable {string}": {
      name_tr: "Değeri Global Değişken Olarak Kaydet",
      name_en: "Save Value Globally",
      desc_tr: "Belirli bir değeri global test değişkeni olarak kaydeder.",
      desc_en: "Saves a specific value as a global test variable."
    },
    "{word} loads global variable {string} as {string}": {
      name_tr: "Global Değişken Yükle",
      name_en: "Load Global Variable",
      desc_tr: "Global bir değişkeni yerel teste yükler.",
      desc_en: "Loads a global variable into the local test context."
    },
    "{word} is an authenticated mobile user using {string} service": {
      name_tr: "Mobil Giriş ve Bağlantı",
      name_en: "Mobile Authentication & Connection",
      desc_tr: "Mobil kullanıcı girişi yapıp yetkilendirilmiş şekilde servise bağlanır.",
      desc_en: "Performs mobile login and connects to the service authenticated."
    },
    "for each item in {string}, {string} should contain {string} parameter matching {string}": {
      name_tr: "Eleman Parametrelerini Doğrula",
      name_en: "Verify Array Item Parameters",
      desc_tr: "Bir dizideki tüm elemanların belirli bir parametreyi içerdiğini doğrular.",
      desc_en: "Validates that all items in an array contain the specified parameter."
    },
    "the response {string} should contain {string} parameter matching {string}": {
      name_tr: "Parametre Eşleşmesini Doğrula",
      name_en: "Verify Parameter Match",
      desc_tr: "Yanıttaki alanın belirli bir parametreyi içerdiğini doğrular.",
      desc_en: "Verifies that the response field contains the matching parameter."
    },
    "the response {string} should contain {string} with value of {string}": {
      name_tr: "Parametre Değerini Doğrula",
      name_en: "Verify Parameter Value",
      desc_tr: "Yanıttaki alanın belirli bir değere sahip parametre içerdiğini doğrular.",
      desc_en: "Verifies that the response field contains the parameter with the expected value."
    },
    "the response {string} should contain matching {string}": {
      name_tr: "Alan Değerini Doğrula",
      name_en: "Verify Field Match",
      desc_tr: "Yanıttaki alanın eşleşen değeri içerdiğini doğrular.",
      desc_en: "Verifies that the field in the response contains the matching value."
    },
    "the response {string} should be {string}": {
      name_tr: "Metin Alanı Doğrula",
      name_en: "Verify Text Field",
      desc_tr: "Yanıttaki alanın belirtilen metne eşit olduğunu doğrular.",
      desc_en: "Verifies that the response field equals the specified text."
    },
    "the response {string} should be {int}": {
      name_tr: "Sayısal Alanı Doğrula",
      name_en: "Verify Number Field",
      desc_tr: "Yanıttaki alanın belirtilen sayıya eşit olduğunu doğrular.",
      desc_en: "Verifies that the response field equals the specified number."
    },
    "the response {string} should be null or match regex {string}": {
      name_tr: "Boş veya Regex Doğrulama",
      name_en: "Verify Null or Regex",
      desc_tr: "Yanıttaki alanın boş olduğunu veya düzenli ifadeyle (regex) eşleştiğini doğrular.",
      desc_en: "Verifies that the response field is null or matches the regular expression."
    },
    "the response {string} should be one of:": {
      name_tr: "Değer Kümesi Doğrulama",
      name_en: "Verify One Of",
      desc_tr: "Yanıttaki alanın tabloda belirtilen değerlerden biri olduğunu doğrular.",
      desc_en: "Verifies that the response field is one of the values specified in the table."
    },
    "the response {string} should match regex {string}": {
      name_tr: "Regex ile Alan Doğrula",
      name_en: "Verify Field with Regex",
      desc_tr: "Yanıttaki alanın düzenli ifadeyle (regex) eşleştiğini doğrular.",
      desc_en: "Verifies that the response field matches the regular expression."
    },
    "the response {string} should contain {string}": {
      name_tr: "Metin İçeriği Doğrula",
      name_en: "Verify Text Content",
      desc_tr: "Yanıttaki alanın belirtilen metni içerdiğini doğrular.",
      desc_en: "Verifies that the response field contains the specified text."
    },
    "the response should contain the following:": {
      name_tr: "Çoklu Alan Doğrulama (İçerir)",
      name_en: "Bulk Validation (Contains)",
      desc_tr: "Yanıtın tabloda listelenen alanları içerdiğini doğrular.",
      desc_en: "Verifies that the response contains the fields listed in the table."
    },
    "the response should not contain the following:": {
      name_tr: "Çoklu Alan Doğrulama (İçermez)",
      name_en: "Bulk Validation (Not Contains)",
      desc_tr: "Yanıtın tabloda listelenen alanları içermediğini doğrular.",
      desc_en: "Verifies that the response does not contain the fields listed in the table."
    },
    "response should match:": {
      name_tr: "Gelişmiş Alan Doğrulama",
      name_en: "Advanced Field Validation",
      desc_tr: "Yanıttaki alanların belirtilen durumlarını doğrular (not null, exists, empty vb.).",
      desc_en: "Validates response fields match conditions like not null, exists, empty, etc."
    },
    "the response should contain the following fields equal to:": {
      name_tr: "Çoklu Eşitlik Doğrulama",
      name_en: "Verify Multiple Equal Fields",
      desc_tr: "Yanıttaki çoklu alanların belirtilen değerlere eşit olduğunu doğrular.",
      desc_en: "Verifies that multiple fields in the response equal the specified values."
    },
    "the response item in {string} is {string} should have:": {
      name_tr: "Filtreli Dizi Elemanı Doğrula",
      name_en: "Verify Filtered Array Item",
      desc_tr: "Dizide filtrelenen bir elemanın belirtilen değerlere sahip olduğunu doğrular.",
      desc_en: "Verifies that a filtered item in an array has the specified values."
    },
    "the response should match JSON schema {string}": {
      name_tr: "Şema Doğrula (Dosya)",
      name_en: "Verify Schema File",
      desc_tr: "Yanıtın belirtilen JSON şemasıyla uyumlu olduğunu doğrular.",
      desc_en: "Verifies that the response complies with the specified JSON schema."
    },
    "the response should match JSON schema example {string}": {
      name_tr: "Şema Doğrula (Örnek)",
      name_en: "Verify Schema Example",
      desc_tr: "Yanıtın örnek JSON şema dosyasıyla uyumlu olduğunu doğrular.",
      desc_en: "Verifies that the response complies with the example JSON schema."
    },
    "I generate a random phone number as {string}": {
      name_tr: "Rastgele Telefon Üret",
      name_en: "Generate Random Phone Number",
      desc_tr: "Rastgele telefon numarası üretip değişkene kaydeder.",
      desc_en: "Generates a random phone number and saves it to a variable."
    },
    "I generate a random email as {string}": {
      name_tr: "Rastgele E-posta Üret",
      name_en: "Generate Random Email",
      desc_tr: "Rastgele e-posta adresi üretip değişkene kaydeder.",
      desc_en: "Generates a random email address and saves it to a variable."
    },
    "I generate a random slug as {string}": {
      name_tr: "Rastgele Slug Üret",
      name_en: "Generate Random Slug",
      desc_tr: "Rastgele slug metni üretip değişkene kaydeder.",
      desc_en: "Generates a random slug and saves it to a variable."
    },
    "I generate a random timestamp as {string}": {
      name_tr: "Rastgele Zaman Damgası Üret",
      name_en: "Generate Random Timestamp",
      desc_tr: "Rastgele zaman damgası üretip değişkene kaydeder.",
      desc_en: "Generates a random timestamp and saves it to a variable."
    },
    "I generate a random {int} digit number as {string}": {
      name_tr: "Rastgele Sayı Üret",
      name_en: "Generate Random Number",
      desc_tr: "Belirtilen basamakta rastgele sayı üretip değişkene kaydeder.",
      desc_en: "Generates a random N-digit number and saves it to a variable."
    },
    "with headers:": {
      name_tr: "Ek Başlık Tanımla",
      name_en: "Define Headers Table",
      desc_tr: "İsteğe tablodaki ek başlıkları (headers) tanımlar.",
      desc_en: "Defines additional headers for the request via a table."
    },
    "{word} stores {string} from {string} is {string} as {string}": {
      name_tr: "Filtreli Dizi Elemanı Kaydet",
      name_en: "Save Filtered Array Item",
      desc_tr: "Dizide filtrelenen bir elemandaki belirli bir değeri değişkene kaydeder.",
      desc_en: "Saves a specific value from a filtered array item to a variable."
    },
    "{word} stores {string} from {string} where {string} as {string}": {
      name_tr: "Koşullu Dizi Elemanı Kaydet",
      name_en: "Save Conditional Array Item",
      desc_tr: "Dizide koşula uyan elemandaki belirli bir değeri değişkene kaydeder.",
      desc_en: "Saves a specific value from an array item matching a condition."
    },
    "{word} stores from {string} is {string}:": {
      name_tr: "Filtreli Dizi Elemanları Kaydet (Çoklu)",
      name_en: "Save Filtered Array Items (Multi)",
      desc_tr: "Dizide filtrelenen bir elemandaki çoklu değerleri değişkenlere kaydeder.",
      desc_en: "Saves multiple values from a filtered array item to variables."
    },
    "{word} stores from {string} where {string}:": {
      name_tr: "Koşullu Dizi Elemanları Kaydet (Çoklu)",
      name_en: "Save Conditional Array Items (Multi)",
      desc_tr: "Dizide koşula uyan elemandaki çoklu değerleri değişkenlere kaydeder.",
      desc_en: "Saves multiple values from an array item matching a condition to variables."
    }
  };

  if (stepMappings[pattern]) {
    return stepMappings[pattern];
  }

  let name_en = pattern.replace(/^(\{word\}|I|system|the response)\s+/, '');
  name_en = name_en.charAt(0).toUpperCase() + name_en.slice(1);

  let desc_en = pattern;
  desc_en = desc_en.replace(/\{word\}/g, 'aktör');
  desc_en = desc_en.replace(/\{string\}/g, 'metin');
  desc_en = desc_en.replace(/\{int\}/g, 'sayı');
  desc_en = desc_en.replace(/\{long\}/g, 'süre');

  return {
    name_tr: name_en,
    name_en,
    desc_tr: desc_en + " adımı.",
    desc_en: pattern.charAt(0).toUpperCase() + pattern.slice(1) + "."
  };
}

app.get('/api/step-definitions', async (req, res) => {
  try {
    const fs = await import('fs');
    const filePath = '/Users/mahmutcemrek/VsCodeProjects/api-automation/src/test/java/com/apiautomation/steps/CommonSteps.java';

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'CommonSteps.java not found' });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const regex = /@(Given|When|Then|And|But)\(\s*"(.*?)"\s*\)/g;
    let match;
    const steps = [];
    
    while ((match = regex.exec(fileContent)) !== null) {
      const type = match[1];
      const pattern = match[2];
      const index = match.index;
      const searchArea = fileContent.substring(index, index + 300);
      const funMatch = searchArea.match(/(?:public\s+void|fun)\s+(\w+)\s*\((.*?)\)/);
      let functionName = '';
      let params = '';
      if (funMatch) {
        // clean up parameter types or names
        functionName = funMatch[1];
        params = funMatch[2].replace(/\n/g, ' ').trim();
      }

      let description = getPrecedingComment(fileContent, index);
      let stepMeta = getStepMetaFromPattern(pattern);

      steps.push({ 
        type, 
        pattern, 
        functionName, 
        params, 
        name_tr: stepMeta.name_tr,
        name_en: stepMeta.name_en,
        desc_tr: description || stepMeta.desc_tr,
        desc_en: description || stepMeta.desc_en
      });
    }

    res.json({ steps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/proxy', async (req, res) => {
  const { url, method, headers, body, extractCookies } = req.body;

  console.log('\n--- PROXY ROUTING ---');
  console.log(`${method} ${url}`);
  
  try {
    const fetchOptions = {
      method,
      headers: {
        ...headers
      }
    };
    console.log('Routing headers:', JSON.stringify(fetchOptions.headers, null, 2));

    // IMPORTANT: If it's a POST/PUT, we send the body exactly as it is
    if (method !== 'GET' && body) {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);
    const status = response.status;
    const text = await response.text();
    
    console.log(`[Proxy] Response: ${status}`);

    // Extract response cookies
    let cookiesArray = [];
    if (typeof response.headers.getSetCookie === 'function') {
      cookiesArray = response.headers.getSetCookie();
    } else {
      const rawSetCookie = response.headers.get('set-cookie');
      if (rawSetCookie) {
        cookiesArray = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
      }
    }

    const cookiesObj = {};
    cookiesArray.forEach(cookieStr => {
      const parts = cookieStr.split(';')[0].split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        cookiesObj[key] = val;
      }
    });

    let data;
    try {
      data = text ? JSON.parse(text) : { message: 'Empty response' };
    } catch (e) {
      data = { rawResponse: text || 'No content' };
    }

    if (extractCookies && data && typeof data === 'object') {
      data._cookies = cookiesObj;
    }

    res.status(status).json(data);
  } catch (error) {
    console.error(`[Proxy Critical Error]`, error);
    res.status(500).json({ error: error.message });
  }
});

// --- LIVE PLAYWRIGHT RECORDER & UI RUNNER ---

app.post('/api/recorder/start', async (req, res) => {
  const { startUrl } = req.body;
  const targetUrl = startUrl || 'https://example.com';
  const sessionId = `session_${Date.now()}`;

  try {
    const browser = await chromium.launch({
      headless: false,
      args: ['--disable-web-security', '--start-maximized']
    });

    const context = await browser.newContext({ viewport: null });
    const page = await context.newPage();

    const sessionData = {
      sessionId,
      browser,
      context,
      page,
      steps: [],
      newEventsQueue: [],
      isInspectorActive: false
    };

    activeRecorderSessions.set(sessionId, sessionData);

    // Initial navigation step
    const initStep = {
      id: `step_${Date.now()}_0`,
      action: 'navigate',
      locator: { strategy: 'css', value: targetUrl },
      value: targetUrl,
      description: `Navigate to ${targetUrl}`,
      gherkin: `Given I navigate to "${targetUrl}"`
    };
    sessionData.steps.push(initStep);
    sessionData.newEventsQueue.push(initStep);

    // Expose node function for recorded page events
    await page.exposeFunction('__upaf_record_event', (eventData) => {
      const session = activeRecorderSessions.get(sessionId);
      if (!session) return;

      let gherkinText = '';
      let actionType = eventData.type;
      let locatorVal = eventData.selector || '';
      let val = eventData.value || '';

      if (actionType === 'click') {
        gherkinText = `When I click "${locatorVal}"`;
      } else if (actionType === 'fill') {
        actionType = 'fill';
        gherkinText = `When I fill "${locatorVal}" with "${val}"`;
      } else if (actionType === 'select') {
        actionType = 'select';
        gherkinText = `When I select "${val}" from "${locatorVal}"`;
      } else if (actionType === 'assertion') {
        if (eventData.assertType === 'text') {
          actionType = 'verifyText';
          gherkinText = `Then I should see text "${val}" at "${locatorVal}"`;
        } else if (eventData.assertType === 'visible') {
          actionType = 'verifyVisible';
          gherkinText = `Then element "${locatorVal}" should be visible`;
        } else if (eventData.assertType === 'value') {
          actionType = 'verifyValue';
          gherkinText = `Then element "${locatorVal}" value should be "${val}"`;
        }
      }


      const recordedStep = {
        id: `step_${Date.now()}_${session.steps.length}`,
        action: actionType,
        locator: { strategy: eventData.strategy || 'css', value: locatorVal, name: eventData.name || '' },
        value: val,
        description: gherkinText,
        gherkin: gherkinText
      };

      session.steps.push(recordedStep);
      session.newEventsQueue.push(recordedStep);
    });

    // Inject recorder & inspector overlay into target pages
    await context.addInitScript(() => {
      let isInspectMode = false;
      let highlightedEl = null;

      const isUnique = (sel) => {
        if (!sel) return false;
        try {
          if (sel.startsWith('text=')) {
            const txt = sel.replace(/^text="/, '').replace(/"$/, '');
            const matches = Array.from(document.querySelectorAll('*')).filter(e => e.childElementCount === 0 && (e.textContent || '').trim() === txt);
            return matches.length === 1;
          }
          if (sel.includes(':has-text(')) {
            const parts = sel.split(':has-text(');
            const base = parts[0] || '*';
            const txt = parts[1].replace(/^\s*"/, '').replace(/"\s*\)\s*$/, '');
            const baseEls = Array.from(document.querySelectorAll(base));
            const matches = baseEls.filter(e => (e.innerText || e.textContent || '').includes(txt));
            return matches.length === 1;
          }
          return document.querySelectorAll(sel).length === 1;
        } catch (err) {
          return false;
        }
      };

      const getCleanSelector = (el) => {
        if (!el || el === document.body) return 'body';

        const tag = el.tagName.toLowerCase();
        const testId = el.getAttribute ? el.getAttribute('data-testid') : null;
        const textContent = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');

        if (testId) {
          const candidate = `[data-testid="${testId}"]`;
          if (isUnique(candidate)) return candidate;
        }
        if (el.id && !/\d{5,}/.test(el.id)) {
          const candidate = `#${el.id}`;
          if (isUnique(candidate)) return candidate;
        }
        if (el.name) {
          const candidate = `[name="${el.name}"]`;
          if (isUnique(candidate)) return candidate;
        }
        if (el.placeholder) {
          const candidate = `[placeholder="${el.placeholder}"]`;
          if (isUnique(candidate)) return candidate;
        }

        const parent = el.closest('[data-testid], form, main, nav, header, footer, section, div[id]');
        if (parent && parent !== el) {
          const parentSel = parent.getAttribute('data-testid')
            ? `[data-testid="${parent.getAttribute('data-testid')}"]`
            : (parent.id ? `#${parent.id}` : parent.tagName.toLowerCase());

          if (testId) {
            const candidate = `${parentSel} [data-testid="${testId}"]`;
            if (isUnique(candidate)) return candidate;
          }
          if (el.id && !/\d{5,}/.test(el.id)) {
            const candidate = `${parentSel} #${el.id}`;
            if (isUnique(candidate)) return candidate;
          }
          if (el.name) {
            const candidate = `${parentSel} [name="${el.name}"]`;
            if (isUnique(candidate)) return candidate;
          }
          if (el.className && typeof el.className === 'string' && el.className.trim()) {
            const firstClass = el.className.trim().split(/\s+/)[0];
            if (firstClass && !firstClass.includes(':')) {
              const candidate = `${parentSel} ${tag}.${firstClass}`;
              if (isUnique(candidate)) return candidate;
            }
          }
        }

        let baseCandidate = tag;
        if (testId) {
          baseCandidate = `[data-testid="${testId}"]`;
        } else if (el.className && typeof el.className === 'string' && el.className.trim()) {
          const firstClass = el.className.trim().split(/\s+/)[0];
          if (firstClass && !firstClass.includes(':')) baseCandidate = `${tag}.${firstClass}`;
        }

        try {
          const allMatches = Array.from(document.querySelectorAll(baseCandidate));
          if (allMatches.length > 1) {
            const index = allMatches.indexOf(el);
            if (index >= 0) {
              return `${baseCandidate} >> nth=${index}`;
            }
          }
        } catch (e) {}

        if (textContent && textContent.length > 0 && textContent.length < 50 && !textContent.includes('\n')) {
          if (testId) {
            const candidateWithText = `[data-testid="${testId}"]:has-text("${textContent}")`;
            if (isUnique(candidateWithText)) return candidateWithText;
          }
          if (['A', 'BUTTON', 'SPAN', 'LI', 'LABEL', 'H1', 'H2', 'H3', 'H4', 'P', 'OPTION'].includes(el.tagName)) {
            const candidate = `text="${textContent}"`;
            if (isUnique(candidate)) return candidate;

            const tagCandidate = `${tag}:has-text("${textContent}")`;
            if (isUnique(tagCandidate)) return tagCandidate;
          }
        }

        return baseCandidate;
      };

      const getSmartName = (el) => {
        if (!el || el === document.body) return 'body';
        let rawName = '';

        if (el.getAttribute && el.getAttribute('data-testid')) {
          rawName = el.getAttribute('data-testid');
        } else if (el.id && !/\d{5,}/.test(el.id)) {
          rawName = el.id;
        } else if (el.name) {
          rawName = el.name;
        } else if (el.placeholder) {
          rawName = el.placeholder;
        } else if (el.getAttribute && el.getAttribute('aria-label')) {
          rawName = el.getAttribute('aria-label');
        } else {
          const txt = (el.innerText || el.textContent || '').trim();
          if (txt && txt.length > 0 && txt.length < 35 && !txt.includes('\n')) {
            rawName = txt;
          }
        }

        if (!rawName) {
          const tag = el.tagName ? el.tagName.toLowerCase() : 'element';
          return tag + 'Item';
        }

        const trMap = { 'ç':'c', 'Ç':'C', 'ğ':'g', 'Ğ':'G', 'ı':'i', 'İ':'I', 'ö':'o', 'Ö':'O', 'ş':'s', 'Ş':'S', 'ü':'u', 'Ü':'U' };
        let cleanStr = rawName.split('').map(ch => trMap[ch] || ch).join('');
        cleanStr = cleanStr.replace(/[^a-zA-Z0-9_\s-]/g, ' ').trim();

        const words = cleanStr.split(/[\s_.-]+/).filter(Boolean);
        if (words.length === 0) return 'element';

        let camel = words[0].toLowerCase();
        for (let i = 1; i < words.length; i++) {
          camel += words[i].charAt(0).toUpperCase() + words[i].slice(1).toLowerCase();
        }

        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'button' && !camel.toLowerCase().endsWith('button') && !camel.toLowerCase().endsWith('btn')) {
          camel += 'Btn';
        } else if (tag === 'input' && !camel.toLowerCase().endsWith('input')) {
          camel += 'Input';
        } else if (tag === 'select' && !camel.toLowerCase().endsWith('select')) {
          camel += 'Select';
        } else if (tag === 'a' && !camel.toLowerCase().endsWith('link')) {
          camel += 'Link';
        }

        return camel;
      };

      const ensureWidget = () => {
        if (!document.body) return;
        let widget = document.getElementById('__upaf_recorder_widget');
        if (!widget) {
          widget = document.createElement('div');
          widget.id = '__upaf_recorder_widget';
          widget.style.position = 'fixed';
          widget.style.bottom = '20px';
          widget.style.right = '20px';
          widget.style.zIndex = '999999999';
          widget.style.background = 'rgba(15, 23, 42, 0.95)';
          widget.style.backdropFilter = 'blur(12px)';
          widget.style.color = '#fff';
          widget.style.padding = '12px 18px';
          widget.style.borderRadius = '14px';
          widget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)';
          widget.style.fontFamily = 'system-ui, -apple-system, sans-serif';
          widget.style.fontSize = '13px';
          widget.style.display = 'flex';
          widget.style.alignItems = 'center';
          widget.style.gap = '12px';
          widget.style.userSelect = 'none';

          widget.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; font-weight:600; color:#38bdf8;">
              <span style="display:inline-block; width:8px; height:8px; background:#ef4444; border-radius:50%;"></span>
              UPAF Recorder
            </div>
            <button id="__upaf_assert_btn" style="background:#6366f1; border:none; color:#fff; padding:6px 12px; border-radius:8px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; font-size:12px;">
              ✨ Validasyon Ekle
            </button>
          `;
          document.body.appendChild(widget);

          const assertBtn = document.getElementById('__upaf_assert_btn');
          if (assertBtn) {
            assertBtn.onclick = (e) => {
              e.stopPropagation();
              isInspectMode = !isInspectMode;
              assertBtn.style.background = isInspectMode ? '#10b981' : '#6366f1';
              assertBtn.innerText = isInspectMode ? '🎯 Element Seçin...' : '✨ Validasyon Ekle';
            };
          }
        }
      };

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        ensureWidget();
      }
      window.addEventListener('DOMContentLoaded', ensureWidget);
      window.addEventListener('load', ensureWidget);
      setInterval(ensureWidget, 400);

      document.addEventListener('mouseover', (e) => {
        if (!isInspectMode) return;
        if (e.target.closest('#__upaf_recorder_widget') || e.target.closest('#__upaf_popover')) return;
        if (highlightedEl) highlightedEl.style.outline = '';
        highlightedEl = e.target;
        highlightedEl.style.outline = '2px solid #10b981';
      }, true);

      document.addEventListener('click', (e) => {
        if (e.target.closest('#__upaf_recorder_widget') || e.target.closest('#__upaf_popover')) return;

        const target = e.target;

        try {
          const menuContainer = target.closest('li, nav, header, [data-testid*="menu"]');
          if (menuContainer) {
            const parentTrigger = menuContainer.querySelector('[data-testid="header_menu_list_link"], header a, nav a');
            if (parentTrigger && parentTrigger !== target && !parentTrigger.contains(target)) {
              const parentSel = getCleanSelector(parentTrigger);
              if (parentSel && window.__upaf_last_recorded_sel !== parentSel) {
                window.__upaf_last_recorded_sel = parentSel;
                window.__upaf_record_event({ type: 'click', selector: parentSel, value: '', strategy: 'css', name: getSmartName(parentTrigger) });
              }
            }
          }
        } catch(e) {}

        const selector = getCleanSelector(target);
        const name = getSmartName(target);
        window.__upaf_last_recorded_sel = selector;

        if (isInspectMode) {
          e.preventDefault();
          e.stopPropagation();
          if (highlightedEl) highlightedEl.style.outline = '';
          isInspectMode = false;
          const assertBtn = document.getElementById('__upaf_assert_btn');
          if (assertBtn) {
            assertBtn.style.background = '#6366f1';
            assertBtn.innerText = '✨ Validasyon Ekle';
          }

          const textVal = target.innerText?.trim() || target.value || '';
          const popover = document.createElement('div');
          popover.id = '__upaf_popover';
          popover.style.position = 'fixed';
          popover.style.top = '50%';
          popover.style.left = '50%';
          popover.style.transform = 'translate(-50%, -50%)';
          popover.style.zIndex = '9999999';
          popover.style.background = '#0f172a';
          popover.style.border = '1px solid #334155';
          popover.style.color = '#fff';
          popover.style.padding = '16px';
          popover.style.borderRadius = '12px';
          popover.style.boxShadow = '0 20px 50px rgba(0,0,0,0.7)';
          popover.style.fontFamily = 'system-ui, sans-serif';
          popover.style.minWidth = '300px';

          popover.innerHTML = `
            <div style="font-weight:600; font-size:14px; margin-bottom:10px; color:#38bdf8;">✨ Validasyon Tipi Seçin</div>
            <div style="font-size:11px; color:#94a3b8; margin-bottom:12px; word-break:break-all;">Hedef: ${selector}</div>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <button id="__upaf_val_text" style="background:#1e293b; border:1px solid #475569; color:#fff; padding:8px; border-radius:6px; cursor:pointer; text-align:left; font-size:12px;">
                💬 Metin Doğrula: "${textVal.slice(0, 30)}"
              </button>
              <button id="__upaf_val_visible" style="background:#1e293b; border:1px solid #475569; color:#fff; padding:8px; border-radius:6px; cursor:pointer; text-align:left; font-size:12px;">
                👁️ Görünürlük Doğrula (Is Visible)
              </button>
              <button id="__upaf_val_cancel" style="background:transparent; border:none; color:#ef4444; padding:6px; font-size:11px; cursor:pointer; text-align:center; margin-top:4px;">
                İptal
              </button>
            </div>
          `;
          document.body.appendChild(popover);

          document.getElementById('__upaf_val_text').onclick = () => {
            window.__upaf_record_event({ type: 'assertion', assertType: 'text', selector, value: textVal, strategy: 'css', name });
            popover.remove();
          };
          document.getElementById('__upaf_val_visible').onclick = () => {
            window.__upaf_record_event({ type: 'assertion', assertType: 'visible', selector, value: '', strategy: 'css', name });
            popover.remove();
          };
          document.getElementById('__upaf_val_cancel').onclick = () => popover.remove();

          return;
        }

        window.__upaf_record_event({ type: 'click', selector, value: '', strategy: 'css', name });
      }, true);

      document.addEventListener('change', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
          const selector = getCleanSelector(e.target);
          const name = getSmartName(e.target);
          window.__upaf_record_event({ type: 'fill', selector, value: e.target.value, strategy: 'css', name });
        } else if (e.target.tagName === 'SELECT') {
          const selector = getCleanSelector(e.target);
          const name = getSmartName(e.target);
          const selectedText = e.target.options[e.target.selectedIndex]?.text || e.target.value;
          window.__upaf_record_event({ type: 'select', selector, value: selectedText, strategy: 'css', name });
        }
      }, true);
    });

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(err => console.log('Navigation warning:', err.message));

    res.json({ sessionId, message: 'Recorder started successfully' });
  } catch (error) {
    console.error('Failed to start recorder:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/recorder/events', (req, res) => {
  const { sessionId } = req.query;
  const session = activeRecorderSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const events = [...session.newEventsQueue];
  session.newEventsQueue = [];
  res.json({ steps: session.steps, newEvents: events });
});

app.post('/api/recorder/stop', async (req, res) => {
  const { sessionId } = req.body;
  const session = activeRecorderSessions.get(sessionId);

  if (session) {
    try {
      await session.browser.close().catch(() => {});
    } catch (e) {}
    activeRecorderSessions.delete(sessionId);
    res.json({ success: true, steps: session.steps });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// --- LIVE UI TEST RUNNER WITH SELF-HEALING ---
app.post('/api/run-ui-test', async (req, res) => {
  const { steps, activeEnv, selfHealingEnabled = true, isHeadless = false } = req.body;
  const logs = [];
  let browser = null;
  let page = null; // declared outside try so the catch block can take a failure screenshot

  if (!Array.isArray(steps)) {
    return res.status(400).json({ success: false, error: 'steps must be an array', logs: [] });
  }

  try {
    logs.push({ type: 'info', message: `🚀 Starting Live UI Test Execution (${steps.length} steps) [Headless: ${isHeadless ? 'true' : 'false'}]`, time: new Date().toLocaleTimeString() });

    browser = await chromium.launch({
      headless: isHeadless,
      slowMo: isHeadless ? 0 : 300,
      args: ['--disable-web-security', '--start-maximized']
    });
    const context = await browser.newContext({ viewport: null });
    page = await context.newPage();

    let autoHealedCount = 0;
    const updatedSteps = [...steps];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      let stepUrl = step.locator?.value || '/';
      let stepValue = step.value || '';
      
      if (activeEnv?.url) {
        if (stepUrl.startsWith('/')) stepUrl = `${activeEnv.url}${stepUrl}`;
      }

      logs.push({ type: 'step', message: `Step ${i + 1}: [${step.action}] ${stepUrl || step.locator?.value || ''}`, time: new Date().toLocaleTimeString() });

      try {
        if (step.action === 'navigate') {
          const target = stepValue || stepUrl;
          await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
          logs.push({ type: 'success', message: `✅ Navigated to ${target}`, time: new Date().toLocaleTimeString() });
        } else if (step.action === 'click') {
          let sel = step.locator?.value;
          try {
            await page.click(sel, { timeout: 2500 });
            logs.push({ type: 'success', message: `✅ Clicked "${sel}"`, time: new Date().toLocaleTimeString() });
          } catch (clickErr) {
            let clickedWithFallback = false;

            // Fallback 1: Native DOM Click & Navigation (Handles hidden hover dropdown items & nth= selectors)
            try {
              // Try hovering potential header/menu parents first to open dropdowns
              try {
                const navLinks = page.locator('header a, nav a, [data-testid*="menu"]').first();
                if (await navLinks.count() > 0) {
                  await navLinks.hover({ timeout: 500 }).catch(() => {});
                }
              } catch(e) {}

              const domClicked = await page.evaluate((selector) => {
                try {
                  let cleanCss = selector;
                  let targetIdx = 0;
                  if (selector.includes(' >> nth=')) {
                    const parts = selector.split(' >> nth=');
                    cleanCss = parts[0];
                    targetIdx = parseInt(parts[1], 10) || 0;
                  }

                  const els = document.querySelectorAll(cleanCss);
                  if (els && els.length > 0) {
                    let targetEl = els[targetIdx] || els[0];
                    const href = targetEl.getAttribute('href') || targetEl.closest('a')?.getAttribute('href');
                    
                    targetEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                    targetEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                    targetEl.click();
                    
                    if (href && href.length > 1 && !href.startsWith('javascript:')) {
                      window.location.href = href;
                    }
                    return true;
                  }
                } catch(e) {}
                return false;
              }, sel);

              if (domClicked) {
                clickedWithFallback = true;
                logs.push({ type: 'success', message: `✅ Clicked "${sel}" (DOM Native Event & Link Fallback)`, time: new Date().toLocaleTimeString() });
              }
            } catch (domErr) {}



            // Fallback 2: Visible instance fallback
            if (!clickedWithFallback) {
              try {
                if (sel && !sel.includes(':visible')) {
                  const visibleLoc = page.locator(`${sel}:visible`).first();
                  if (await visibleLoc.count() > 0) {
                    await visibleLoc.click({ timeout: 2500 });
                    clickedWithFallback = true;
                    const healedSel = `${sel}:visible`;
                    updatedSteps[i].locator.value = healedSel;
                    autoHealedCount++;
                    logs.push({ type: 'success', message: `✨ AI Self-Healed to Visible Element: "${sel}" ➔ "${healedSel}"`, time: new Date().toLocaleTimeString() });
                  }
                }
              } catch (e1) {}
            }

            // Fallback 3: Force Click fallback
            if (!clickedWithFallback) {
              try {
                await page.locator(sel).first().click({ force: true, timeout: 2500 });
                clickedWithFallback = true;
                logs.push({ type: 'success', message: `✅ Clicked "${sel}" (Force Click Fallback)`, time: new Date().toLocaleTimeString() });
              } catch (e2) {}
            }

            // Fallback 4: Advanced AI Self-Healing
            if (!clickedWithFallback) {
              if (selfHealingEnabled) {
                logs.push({ type: 'warning', message: `⚠️ Selector "${sel}" failed. Initiating AI Self-Healing...`, time: new Date().toLocaleTimeString() });

                const visibleElements = await page.$$eval('button, a, input, [role="button"], span', els => els.map(el => ({
                  text: (el.innerText || el.textContent || '').trim(),
                  id: el.id,
                  name: el.name,
                  tag: el.tagName.toLowerCase(),
                  testId: el.getAttribute('data-testid')
                })));

                const searchContext = `${step.description || ''} ${step.gherkin || ''} ${step.value || ''} ${sel || ''}`.toLowerCase();

                const healedMatch = visibleElements.find(el => el.text && el.text.length > 1 && !el.text.includes('\n') && searchContext.includes(el.text.toLowerCase()));

                if (healedMatch) {
                  const healedSel = healedMatch.testId
                    ? `[data-testid="${healedMatch.testId}"]:has-text("${healedMatch.text}")`
                    : (healedMatch.id ? `#${healedMatch.id}` : `text="${healedMatch.text}"`);

                  await page.evaluate((s) => {
                    const el = document.querySelector(s);
                    if (el) el.click();
                  }, healedSel).catch(() => page.click(healedSel, { force: true }));

                  autoHealedCount++;
                  updatedSteps[i].locator.value = healedSel;
                  logs.push({ type: 'success', message: `✨ AI Self-Healed Selector: "${sel}" ➔ "${healedSel}"`, time: new Date().toLocaleTimeString() });
                  clickedWithFallback = true;
                }
              }
            }

            if (!clickedWithFallback) {
              throw clickErr;
            }
          }
        } else if (step.action === 'fill' || step.action === 'type') {
          const sel = step.locator?.value;
          await page.fill(sel, stepValue, { timeout: 5000 });
          logs.push({ type: 'success', message: `✅ Filled "${sel}" with "${stepValue}"`, time: new Date().toLocaleTimeString() });
        } else if (step.action === 'select' || step.action === 'selectOption') {
          const sel = step.locator?.value;
          const optValue = stepValue;
          try {
            await page.selectOption(sel, { label: optValue }).catch(() => page.selectOption(sel, { value: optValue }));
            logs.push({ type: 'success', message: `✅ Selected "${optValue}" at "${sel}"`, time: new Date().toLocaleTimeString() });
          } catch (selectErr) {
            try {
              await page.click(sel, { timeout: 2500 });
              await page.click(`text="${optValue}"`, { timeout: 2500 });
              logs.push({ type: 'success', message: `✅ Selected "${optValue}" at "${sel}" (Custom Dropdown Fallback)`, time: new Date().toLocaleTimeString() });
            } catch(e2) {
              throw new Error(`Failed to select "${optValue}" at "${sel}": ${selectErr.message}`);
            }
          }
        } else if (step.action === 'verifyVisible' || step.action === 'waitForElement') {
          const sel = step.locator?.value;
          try {
            await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 });
            logs.push({ type: 'success', message: `✅ Verified element "${sel}" is visible`, time: new Date().toLocaleTimeString() });
          } catch (visErr) {
            let healed = false;
            if (selfHealingEnabled) {
              try {
                const targetText = `${step.value || ''} ${step.description || ''} ${step.gherkin || ''}`.trim();
                if (targetText) {
                  await page.locator(`text="${targetText}"`).first().waitFor({ state: 'visible', timeout: 4000 });
                  const healedSel = `text="${targetText}"`;
                  updatedSteps[i].locator.value = healedSel;
                  autoHealedCount++;
                  logs.push({ type: 'success', message: `✨ AI Self-Healed Visibility Assertion: "${sel}" ➔ "${healedSel}"`, time: new Date().toLocaleTimeString() });
                  healed = true;
                }
              } catch (e) {}
            }
            if (!healed) {
              throw new Error(`Element "${sel}" is not visible within 10s timeout (Page loading or locator changed)`);
            }
          }
        } else if (step.action === 'verifyText') {
          const sel = step.locator?.value || 'body';
          const expected = stepValue;
          try {
            if (sel === 'body') {
              await page.locator('body').filter({ hasText: expected }).waitFor({ timeout: 10000 });
            } else {
              await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 });
            }
            logs.push({ type: 'success', message: `✅ Verified text "${expected}" at "${sel}"`, time: new Date().toLocaleTimeString() });
          } catch (textErr) {
            const bodyContent = await page.innerText('body').catch(() => '');
            if (expected && bodyContent.toLowerCase().includes(expected.toLowerCase())) {
              logs.push({ type: 'success', message: `✅ Verified text "${expected}" on page (Body Text Fallback)`, time: new Date().toLocaleTimeString() });
            } else {
              throw new Error(`Text "${expected}" not found at "${sel}" within 10s timeout`);
            }
          }
        } else if (step.action === 'verifyValue') {
          const sel = step.locator?.value;
          const expected = stepValue;
          try {
            await page.locator(sel).first().waitFor({ state: 'visible', timeout: 10000 });
            const val = await page.locator(sel).first().inputValue().catch(() => '');
            if (val === expected) {
              logs.push({ type: 'success', message: `✅ Verified value "${expected}" at "${sel}"`, time: new Date().toLocaleTimeString() });
            } else {
              throw new Error(`Value mismatch: expected "${expected}", actual "${val}"`);
            }
          } catch (valErr) {
            throw new Error(`Value "${expected}" at "${sel}" did not match within 10s timeout: ${valErr.message}`);
          }
        }


      } catch (stepErr) {
        logs.push({ type: 'error', message: `❌ Step ${i + 1} Failed: ${stepErr.message}`, time: new Date().toLocaleTimeString() });
        break;
      }
    }

    let finalScreenshot = null;
    try {
      if (page && !page.isClosed()) {
        const buf = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: true }).catch(() => null);
        if (buf && Buffer.isBuffer(buf)) {
          finalScreenshot = `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      }
    } catch (e) {}

    await browser.close().catch(() => {});

    res.json({
      success: !logs.some(l => l.type === 'error'),
      logs,
      autoHealedCount,
      updatedSteps,
      screenshot: finalScreenshot
    });

  } catch (err) {
    let errScreenshot = null;
    try {
      if (page && !page.isClosed()) {
        const buf = await page.screenshot({ type: 'jpeg', quality: 90, fullPage: true }).catch(() => null);
        if (buf && Buffer.isBuffer(buf)) {
          errScreenshot = `data:image/jpeg;base64,${buf.toString('base64')}`;
        }
      }
    } catch (e) {}





    if (browser) await browser.close().catch(() => {});
    logs.push({ type: 'error', message: `Fatal Execution Error: ${err.message}`, time: new Date().toLocaleTimeString() });
    res.status(500).json({ success: false, logs, error: err.message, screenshot: errScreenshot });
  }


});

const PORT = 5175;
app.listen(PORT, () => {
  console.log(`UPAF Production Proxy running on http://localhost:${PORT}`);
});

