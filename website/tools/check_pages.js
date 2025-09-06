const fs = require('fs');
const http = require('http');
const https = require('https');

const pages = ['/login','/tickets.html','/admin.html','/analytics.html','/transcript/1'];
const host = 'http://localhost:4000';

function fetch(path){
    return new Promise((res,rej)=>{
        http.get(host+path, r=>{
            let data='';
            r.on('data',c=>data+=c.toString());
            r.on('end',()=>res({status:r.statusCode,body:data}));
        }).on('error', e=> rej(e));
    });
}

(async ()=>{
    for(const p of pages){
        try{
            const r = await fetch(p);
            const body = r.body || '';
            const has = /\$\{|%24%7B/.test(body);
            console.log('---', p, 'status=', r.status, 'len=', body.length, 'placeholder=', has);
            const preview = body.replace(/\r|\n/g,' ').slice(0,800);
            console.log(preview);
        }catch(e){
            console.log('---', p, 'ERROR', e.message);
        }
    }
})();
