async function testServers() {
  try {
    const resApp = await fetch('http://localhost:3000/');
    const htmlApp = await resApp.text();
    console.log('[OK] Vite Main App Status:', resApp.status, '| HTML Length:', htmlApp.length, '| Has App Shell:', htmlApp.includes('id="app-container"'));

    const resRemote = await fetch('http://localhost:3000/remote.html');
    const htmlRemote = await resRemote.text();
    console.log('[OK] Vite Mobile Remote Status:', resRemote.status, '| HTML Length:', htmlRemote.length, '| Has Remote Header:', htmlRemote.includes('Studio Mobile Remote'));

    const resApi = await fetch('http://localhost:8080/api/status');
    const jsonApi = await resApi.json();
    console.log('[OK] Node Backend Status:', resApi.status, '| API Response:', JSON.stringify(jsonApi));

    const resAi = await fetch('http://localhost:8080/api/ai/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' })
    });
    const jsonAi = await resAi.json();
    console.log('[OK] AI Gateway Status:', resAi.status, '| Response Code:', jsonAi.code, '| Message:', jsonAi.error);
  } catch (err) {
    console.error('Server check failed:', err);
    process.exit(1);
  }
}

testServers();
