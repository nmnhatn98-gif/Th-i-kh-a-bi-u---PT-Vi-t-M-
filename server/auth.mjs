import { createPublicKey, verify } from 'node:crypto';
export function createFirebaseVerifier(projectId,{fetchFn=fetch,now=()=>Date.now()}={}) {
  let certificates={},expires=0,pending;
  async function keys(){
    if(now()<expires)return certificates;
    pending??=(async()=>{const r=await fetchFn('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Không xác minh được phiên đăng nhập.');certificates=await r.json();const seconds=Math.min(3600,Number(r.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300));expires=now()+seconds*1000;return certificates;})();
    try{return await pending;}finally{pending=null;}
  }
  return async function(token){
    try{
      if(typeof token!=='string'||token.length>16000)throw Error();
      const parts=token.split('.');if(parts.length!==3)throw Error();
      const header=JSON.parse(Buffer.from(parts[0],'base64url')),payload=JSON.parse(Buffer.from(parts[1],'base64url'));
      if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error();
      const cert=(await keys())[header.kid];if(!cert||!verify('RSA-SHA256',Buffer.from(parts.slice(0,2).join('.')),createPublicKey(cert),Buffer.from(parts[2],'base64url')))throw Error();
      const seconds=now()/1000;
      if(payload.aud!==projectId||payload.iss!==`https://securetoken.google.com/${projectId}`||typeof payload.sub!=='string'||!payload.sub.length||payload.sub.length>128||!Number.isFinite(payload.exp)||payload.exp<=seconds||!Number.isFinite(payload.iat)||payload.iat>seconds+30||!Number.isFinite(payload.auth_time)||payload.auth_time>seconds+30||payload.email_verified!==true||typeof payload.email!=='string')throw Error();
      return {uid:payload.sub,email:payload.email.toLowerCase().trim()};
    }catch{throw Object.assign(Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'),{status:401,code:'unauthenticated'});}
  };
}
