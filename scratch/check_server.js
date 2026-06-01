const http = require('http');

function checkRoute(url) {
  return new Promise((resolve) => {
    try {
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          resolve({
            success: true,
            statusCode: res.statusCode,
            headers: res.headers || {},
            body: data.substring(0, 500)
          });
        });
      });
      
      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });
    } catch (e) {
      resolve({
        success: false,
        error: e.message
      });
    }
  });
}

async function run() {
  console.log('============================================================');
  console.log('🌐 DIAGNOSING PORT 3000 NEXT.JS SERVER');
  console.log('============================================================\n');

  console.log('Connecting to http://localhost:3000/api/delivery/orders ...');
  const result = await checkRoute('http://localhost:3000/api/delivery/orders');
  
  if (!result.success) {
    console.log('❌ Connection failed:', result.error);
    console.log('\n🔍 ANALYSIS: The Next.js development server is NOT running.');
    console.log('   Please start the server by running:');
    console.log('   "npm run dev"');
  } else {
    console.log('✅ Connected successfully!');
    console.log(`- Status Code: ${result.statusCode}`);
    console.log(`- Content-Type: ${result.headers['content-type'] || 'None'}`);
    console.log(`- Response body: ${result.body}`);
    
    if (result.statusCode === 404) {
      console.log('\n🔍 ANALYSIS: The server returned a 404.');
      console.log('   This means the Next.js app is running but the route is not found.');
    }
  }
  
  console.log('\n============================================================');
}

run();
