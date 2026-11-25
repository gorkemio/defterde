(function(){
 'use strict';let context=null,enabled=true,last=0;
 window.Tangram.sound={set(value){enabled=value;},play(kind='place'){
  if(!enabled)return;const now=Date.now();if(now-last<100)return;last=now;
  try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context=context||new Audio();
   if(context.state==='suspended')context.resume().catch(()=>{});
   if(context.state!=='running')return;
   const duration=kind==='move'?.09:.055,buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
   for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,2);
   const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
   source.buffer=buffer;filter.type='lowpass';filter.frequency.value=kind==='move'?1200:700;gain.gain.value=kind==='move'?.025:.055;
   source.connect(filter).connect(gain).connect(context.destination);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};source.start();
  }catch{/* Ses desteklenmese de oyun sürer. */}
 }};
})();
