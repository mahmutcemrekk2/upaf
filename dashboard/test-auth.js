
async function testAuth() {
  const url = 'https://auth-server-auth.qa.hesap.com/oauth2/token';
  const headers = {
    'Accept': 'application/json',
    'X-Channel-Id': 'CUSTOMER',
    'X-App-Deviceid': '6d33e6fd-4432-47c0-b774-6ab53cffeb83',
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-App-Platform': 'WEB'
  };
  const body = 'client_id=public-customer-web&grant_type=client_credentials&scope=cookie&client_secret=public-customer-web-secret';

  console.log('--- TEST AUTH START ---');
  console.log('Target URL:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: body
    });

    const status = response.status;
    const text = await response.text();
    
    console.log('Status Code:', status);
    console.log('Response Body:', text);
    
    if (status === 200) {
      console.log('✅ SUCCESS! The problem is in the Dashboard Proxy.');
    } else {
      console.log('❌ FAILED (401)! The problem is in the credentials/data.');
    }
  } catch (error) {
    console.error('Execution Error:', error.message);
  }
}

testAuth();
