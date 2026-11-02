export class PollEtags{
 constructor(){this.values=new Map();}
 headers(path,{polling,conditional,userId}){const tag=polling&&conditional?this.values.get(userId+'|'+path):null;return tag?{'If-None-Match':tag}:{};}
 observe(path,{polling,userId,etag}){if(polling){const key=userId+'|'+path;if(etag)this.values.set(key,etag);else this.values.delete(key);}}
 clear(){this.values.clear();}
}
