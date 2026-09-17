import {randomUUID} from 'node:crypto';
import express from 'express';
import {SpeakeasyPracticeService} from './service.js';

export function registerSpeakeasyPractice(app:express.Express):void {
  const service=new SpeakeasyPracticeService(randomUUID,Date.now),router=express.Router();
  router.use(express.json({limit:'4kb'}));
  router.use((_req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  router.post('/',(_req,res)=>{
    const session=service.create();
    if(!session){res.status(503).json({ok:false,reason:'CAPACITY'});return;}
    res.status(201).json({ok:true,...session});
  });
  router.use((req,res,next)=>{
    const auth=req.headers.authorization;
    if(!auth?.startsWith('Bearer ')||auth.length>120){res.status(401).json({ok:false,reason:'SESSION_EXPIRED'});return;}
    next();
  });
  const token=(req:express.Request)=>req.headers.authorization!.slice(7);
  router.get('/',(req,res)=>res.json(service.read(token(req))));
  router.post('/command',(req,res)=>res.json(service.command(token(req),req.body)));
  router.delete('/',(req,res)=>{service.remove(token(req));res.status(204).end();});
  router.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    const malformed=error instanceof SyntaxError || (typeof error==='object'&&error!==null&&'type' in error&&error.type==='entity.too.large');
    res.status(malformed?400:500).json({ok:false,reason:malformed?'INVALID_COMMAND':'INTERNAL_ERROR'});
  });
  app.use('/api/speakeasy-practice',router);
}
