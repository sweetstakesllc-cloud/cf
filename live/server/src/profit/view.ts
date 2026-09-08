import {readFileSync} from 'node:fs';
const template=readFileSync(new URL('./page.html',import.meta.url),'utf8');
export const profitScript=readFileSync(new URL('./app.js',import.meta.url),'utf8');
export function profitPage(clientId:string,store:string,preview:boolean):string{
 const config=JSON.stringify({clientId,store,preview}).replaceAll('<','\\u003c');
 return template.replace('__CONFIG__',config).replace('__APP_BRIDGE__',preview?'':`<meta name="shopify-api-key" content="${clientId.replace(/[^a-zA-Z0-9]/g,'')}"><script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>`);
}
