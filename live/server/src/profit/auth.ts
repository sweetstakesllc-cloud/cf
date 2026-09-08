import {createHmac,timingSafeEqual} from 'node:crypto';
export function verifyShopifyToken(token:string,clientId:string,secret:string,store:string,now=Date.now()):string|null{
 try{
  const parts=token.split('.');if(parts.length!==3||token.length>8000)return null;
  const [header,payload,signature]=parts as [string,string,string];
  if(JSON.parse(Buffer.from(header,'base64url').toString()).alg!=='HS256')return null;
  const expected=createHmac('sha256',secret).update(`${header}.${payload}`).digest();const supplied=Buffer.from(signature,'base64url');
  if(expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return null;
  const claims=JSON.parse(Buffer.from(payload,'base64url').toString());const seconds=Math.floor(now/1000);
  if(claims.aud!==clientId||claims.dest!==`https://${store}`||claims.iss!==`https://${store}/admin`||typeof claims.sub!=='string'||!/^\d+$/.test(claims.sub))return null;
  if(typeof claims.exp!=='number'||claims.exp<=seconds||typeof claims.nbf!=='number'||claims.nbf>seconds+5||typeof claims.iat!=='number'||claims.iat>seconds+5)return null;
  return claims.sub;
 }catch{return null;}
}
