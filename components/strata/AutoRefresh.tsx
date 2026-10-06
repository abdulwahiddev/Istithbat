
'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { z } from 'zod';
import { IncidentListItem, PipelineRunState } from '@/lib/contracts';
import { pipelineFingerprint } from '@/lib/contracts/sandbox-progress';

/** One lightweight persisted-state poll while investigating; coalesce expensive server refreshes. */
export function AutoRefresh({active,everyMs=1500}:{active:boolean;everyMs?:number}) {
  const router=useRouter();
  const [watchedRun,setWatchedRun]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const pendingRef=useRef(pending);
  pendingRef.current=pending;
  const lastRefresh=useRef(0);
  useEffect(()=>{
    let cancelled=false;
    let signalTimer:ReturnType<typeof setTimeout>;
    const refresh=()=>{
      if(cancelled)return;
      if(pendingRef.current){signalTimer=setTimeout(refresh,1000);return;}
      lastRefresh.current=Date.now();startTransition(()=>router.refresh());
    };
    const signal=(value:string|null)=>{
      try { const data=JSON.parse(value??'null'); if(data?.runId && z.uuid().safeParse(data.runId).success)setWatchedRun(data.runId); } catch { /* Ignore unrelated or old browser signals. */ }
      refresh();
    };
    const storage=(event:StorageEvent)=>{if(event.key==='istithbat-demo-change')signal(event.newValue);};
    const local=()=>{try{signal(localStorage.getItem('istithbat-demo-change'));}catch{refresh();}};
    window.addEventListener('storage',storage);
    window.addEventListener('istithbat-demo-change',local);
    return()=>{cancelled=true;window.removeEventListener('storage',storage);window.removeEventListener('istithbat-demo-change',local);clearTimeout(signalTimer);};
  },[router]);
  useEffect(()=>{
    if(!active&&!watchedRun)return;
    let cancelled=false;
    let timer:ReturnType<typeof setTimeout>;
    let previous:string|undefined;
    let dirty=false;
    let failures=0;
    const deadline=Date.now()+10*60_000;
    async function poll(){
      if(cancelled||Date.now()>deadline)return;
      if(document.visibilityState==='visible') {
        try {
          const response=await fetch(watchedRun?`/api/pipeline/${watchedRun}`:'/api/incidents',{cache:'no-store',signal:AbortSignal.timeout(15_000)});
          if(!response.ok)throw new Error('READ_FAILED');
          const body=await response.json();
          let fingerprint:string, terminal:boolean;
          if(watchedRun){
            const run=PipelineRunState.parse(body);fingerprint=pipelineFingerprint(run);terminal=run.status!=='RUNNING';
          }else{
            const incidents=z.array(IncidentListItem).parse(body);
            fingerprint=JSON.stringify(incidents.map(i=>[i.id,i.pipelineStatus,i.pipelineSteps.map(s=>[s.step,s.itemKey,s.status,s.attempts,s.errorCode])]));
            terminal=!incidents.some(i=>i.pipelineStatus==='RUNNING');
          }
          if(cancelled)return;
          if(previous===undefined||previous!==fingerprint)dirty=true;
          previous=fingerprint;
          if((dirty||terminal)&&!pendingRef.current&&(terminal||Date.now()-lastRefresh.current>=8000)){
            dirty=false;lastRefresh.current=Date.now();startTransition(()=>router.refresh());
          }
          failures=0;
          if(terminal){setWatchedRun(null);return;}
        }catch{if(++failures>=5)return;}
      }
      if(!cancelled)timer=setTimeout(poll,everyMs);
    }
    timer=setTimeout(poll,everyMs);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[active,watchedRun,everyMs,router]);
  return null;
}
