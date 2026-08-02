/**
 * The ultimate, unbreakable cURL parser for UPAF.
 * No more regex nightmares. This one splits the command by flags 
 * and extracts values intelligently, handling all quote types.
 */
export const parseCurl = (curlString) => {
  const result = {
    method: 'GET',
    url: '',
    headers: {},
    body: ''
  };

  if (!curlString) return result;

  // Clean up the string: replace eminiz newlines and multiple spaces
  const cleanCurl = curlString.replace(/\\\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Split the command into tokens but respect quotes
  const tokens = [];
  let currentToken = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < cleanCurl.length; i++) {
    const char = cleanCurl[i];
    if ((char === "'" || char === '"') && (i === 0 || cleanCurl[i-1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
      } else {
        currentToken += char;
      }
    } else if (char === ' ' && !inQuotes) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) tokens.push(currentToken);

  // Process tokens
  const dataParts = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    // URL detection
    if (token.startsWith('http://') || token.startsWith('https://')) {
      result.url = token;
    }
    
    // Flags
    if (token === '-X' || token === '--request') {
      result.method = tokens[++i];
    } else if (token === '-H' || token === '--header') {
      const headerStr = tokens[++i];
      const colonIdx = headerStr.indexOf(':');
      if (colonIdx > -1) {
        const key = headerStr.substring(0, colonIdx).trim();
        const val = headerStr.substring(colonIdx + 1).trim();
        result.headers[key] = val;
      }
    } else if (['-d', '--data', '--data-raw', '--data-urlencode', '--data-binary'].includes(token)) {
      dataParts.push(tokens[++i]);
      result.method = 'POST'; // Any data flag implies POST unless overridden
    }
  }

  // Final assembly
  if (dataParts.length > 0) {
    const contentType = Object.keys(result.headers).find(k => k.toLowerCase() === 'content-type');
    if (result.headers[contentType]?.includes('form-urlencoded')) {
      result.body = dataParts.join('&');
    } else {
      result.body = dataParts.join('');
    }
  }

  return result;
};
