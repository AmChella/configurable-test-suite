#!/usr/bin/env node
/*
 * Orchestrates starting the server, waiting for readiness, running ONLY the upload scenario, then shutting down.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SCENARIO_FILE = path.resolve(__dirname, '../data/ui-scenarios/upload_test_case.json');

function wait(ms){return new Promise(r=>setTimeout(r, ms));}

async function waitForHealth(url='http://localhost:4001/health', timeoutMs=15000){
  const start = Date.now();
  while(Date.now() - start < timeoutMs){
    try {
      const ok = await new Promise((resolve)=>{
        const req = http.get(url, (res)=>{ resolve(res.statusCode === 200); });
        req.on('error', ()=>resolve(false));
        req.setTimeout(2000, ()=>{ req.destroy(); resolve(false); });
      });
      if(ok) return true;
    } catch {}
    await wait(500);
  }
  return false;
}

(async ()=>{
  console.log('[runner] Starting server...');
  const server = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run','serve'], { stdio:'inherit' });

  const ready = await waitForHealth();
  if(!ready){
    console.error('[runner] Server did not become healthy in time. Exiting.');
    server.kill('SIGTERM');
    process.exit(1);
  }
  console.log('[runner] Server is healthy. Running upload scenario...');

  const env = { ...process.env, SCENARIOS_FILE: SCENARIO_FILE };
  const test = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test','--','--grep','Upload Test Case'], { stdio:'inherit', env });

  test.on('close', (code)=>{
    console.log(`[runner] Test process exited with code ${code}`);
    server.kill('SIGTERM');
    server.on('close', ()=> process.exit(code));
  });

  process.on('SIGINT', ()=>{ server.kill('SIGTERM'); process.exit(130); });
})();
