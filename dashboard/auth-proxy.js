import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
// Increased limit for large token responses and complex bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

const PORT = 5175;
app.listen(PORT, () => {
  console.log(`UPAF Production Proxy running on http://localhost:${PORT}`);
});
