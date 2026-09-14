/** One in-flight request per atlas; failed requests may be retried on a later mount. */
export function createArkArtLoader(fetchImage:(url:string)=>Promise<void>) {
  const requests=new Map<string,Promise<void>>();
  return (url:string):Promise<void>=>{
    const existing=requests.get(url);if(existing)return existing;
    const request=fetchImage(url).catch(error=>{requests.delete(url);throw error;});
    requests.set(url,request);return request;
  };
}
export const loadArkArt=createArkArtLoader(url=>new Promise<void>((resolve,reject)=>{
  const image=new Image();image.decoding='async';
  image.onload=()=>resolve();image.onerror=()=>reject(new Error('Illustration unavailable.'));image.src=url;
}));
