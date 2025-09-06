const fs = require('fs');
const http = require('http');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'server.js');
const content = fs.readFileSync(serverFile, 'utf8');

// Simple regex to find app.get('/path', ... res.sendFile(path.join(__dirname, 'public', 'file')))
const sendFileRegex = /app\.get\(\s*['\"]([^'\"]+)['\"][\s\S]*?res\.sendFile\(path\.join\(__dirname,\s*'public'\s*,\s*'([^']+)'\)\)/g;
let m; const routes = [];
while((m = sendFileRegex.exec(content)) !== null){
    routes.push({ route: m[1], file: m[2] });
}

// Deduplicate
const uniq = Array.from(new Map(routes.map(r=>[r.route,r])).values());

function fetchRoute(route){
    return new Promise((res,rej)=>{
        http.get('http://localhost:4000' + route, r=>{
            let data='';
            r.on('data',c=>data+=c.toString());
            r.on('end',()=>res({status:r.statusCode, body:data}));
        }).on('error', e=> res({error: e.message}));
    });
}

(async ()=>{
    console.log('Found', uniq.length, 'sendFile routes to test');
    for(const r of uniq){
        try{
            const res = await fetchRoute(r.route);
            if(res.error){
                console.log('---', r.route, 'ERROR', res.error);
                continue;
            }
            const body = res.body || '';
            const has = /\$\{|%24%7B/.test(body);
            console.log('---', r.route, 'status=', res.status, 'len=', body.length, 'placeholder=', has, '-> file=', r.file);
        }catch(e){
            console.log('---', r.route, 'EXCEPTION', e.message);
        }
    }
})();
