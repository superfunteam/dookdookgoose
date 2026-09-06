import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync,copyFileSync,renameSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Local, deterministic packaging of the generated masters. No network or API use.
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const VERSION=1;
const RATE=44100;
const OVERLAP_SECONDS=.04;
const PARTIAL=process.argv.includes('--partial');
let selected=null;
for(const argument of process.argv.slice(2)){
 if(argument==='--partial')continue;
 if(argument.startsWith('--only='))selected=new Set(argument.slice(7).split(','));
 else throw new Error('Usage: node scripts/prepare-audio.mjs [--partial] [--only=ambience/house,sfx/hit]');
}
const temporary=mkdtempSync(join(tmpdir(),'dook-audio-mix-'));
const reportPath=join(ROOT,'assets/audio/mix-report.json');
const plan=JSON.parse(readFileSync(join(ROOT,'assets/audio/plan.json'),'utf8'));
const oldReport=existsSync(reportPath)?JSON.parse(readFileSync(reportPath,'utf8')):null;
const finite=value=>Number.isFinite(Number(value))?Number(value):null;
const db=value=>value>0?20*Math.log10(value):null;
const rounded=value=>value===null?null:Math.round(value*1e6)/1e6;
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');

function command(program,args,{binary=false}={}){
 const result=spawnSync(program,args,{encoding:binary?null:'utf8',maxBuffer:256*1024*1024});
 if(result.error)throw new Error(program+' could not run: '+result.error.message);
 if(result.status!==0)throw new Error(program+' failed: '+String(result.stderr).slice(-5000));
 return result;
}

function probe(file){
 const data=JSON.parse(command('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_name,sample_rate,channels:format=duration,size,bit_rate','-of','json',file]).stdout);
 if(!data.streams?.length)throw new Error('No audio stream in '+file);
 return {codec:data.streams[0].codec_name,sampleRate:Number(data.streams[0].sample_rate),channels:data.streams[0].channels,duration:finite(data.format.duration),bytes:Number(data.format.size),bitRate:finite(data.format.bit_rate)};
}

function decode(file,channels){
 const buffer=command('ffmpeg',['-hide_banner','-loglevel','error','-i',file,'-map','0:a:0','-vn','-ar',String(RATE),'-ac',String(channels),'-c:a','pcm_f32le','-f','f32le','pipe:1'],{binary:true}).stdout;
 if(!buffer.length||buffer.length%(4*channels))throw new Error('Invalid decoded PCM length: '+file);
 const copy=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 return new Float32Array(copy);
}

function analyze(samples,channels){
 let peak=0,power=0;
 for(const sample of samples){if(!Number.isFinite(sample))throw new Error('Audio contains a non-finite PCM sample');peak=Math.max(peak,Math.abs(sample));power+=sample*sample;}
 const rms=Math.sqrt(power/samples.length);
 let seamDelta=0;
 for(let c=0;c<channels;c++)seamDelta=Math.max(seamDelta,Math.abs(samples[c]-samples[samples.length-channels+c]));
 return {frames:samples.length/channels,duration:rounded(samples.length/channels/RATE),samplePeakDb:rounded(db(peak)),rmsDb:rounded(db(rms)),seamDelta:rounded(seamDelta)};
}

function trimEdges(samples,channels,loop){
 const source=analyze(samples,channels),frames=source.frames;
 // An adaptive quiet floor retains intentionally subtle ambience. Only the two
 // contiguous outer edges are considered, never silence within a phrase.
 const thresholdDb=Math.max(-85,Math.min(-50,(source.rmsDb??-70)-18));
 const threshold=10**(thresholdDb/20);
 const active=frame=>{for(let c=0;c<channels;c++)if(Math.abs(samples[frame*channels+c])>threshold)return true;return false;};
 let first=0,last=frames-1;
 while(first<frames&&!active(first))first++;
 while(last>=first&&!active(last))last--;
 if(first===frames)return {samples:samples.slice(),stats:{thresholdDb,leadingSilence:source.duration,trailingSilence:source.duration,start:0,end:source.duration,removed:0,silent:true}};
 const leading=first/RATE,trailing=(frames-1-last)/RATE;
 const start=leading>.08?Math.max(0,first-Math.round((loop?.005:.008)*RATE)):0;
 const end=trailing>.15?Math.min(frames,last+1+Math.round((loop?.005:.07)*RATE)):frames;
 return {samples:samples.slice(start*channels,end*channels),stats:{thresholdDb:rounded(thresholdDb),leadingSilence:rounded(leading),trailingSilence:rounded(trailing),start:rounded(start/RATE),end:rounded(end/RATE),removed:rounded((start+frames-end)/RATE),silent:false}};
}

function circularOverlap(samples,channels){
 const frames=samples.length/channels;
 const overlap=Math.min(Math.round(OVERLAP_SECONDS*RATE),Math.floor(frames/8));
 if(overlap<2)return {samples,seconds:0};
 const middleFrames=frames-2*overlap;
 const output=new Float32Array((frames-overlap)*channels);
 output.set(samples.subarray(overlap*channels,(frames-overlap)*channels));
 for(let frame=0;frame<overlap;frame++){
  const angle=frame/(overlap-1)*Math.PI/2;
  for(let c=0;c<channels;c++)output[(middleFrames+frame)*channels+c]=samples[(frames-overlap+frame)*channels+c]*Math.cos(angle)+samples[frame*channels+c]*Math.sin(angle);
 }
 // Output wraps from original head[C-1] to head[C], an ordinary adjacent-sample
 // transition. The sole crossfade is inside the loop, with no fade to silence.
 return {samples:output,seconds:overlap/RATE};
}

function softenEdges(samples,channels){
 const frames=samples.length/channels;
 const attack=Math.min(Math.round(.003*RATE),Math.floor(frames/8));
 const release=Math.min(Math.round(.008*RATE),Math.floor(frames/8));
 for(let frame=0;frame<attack;frame++)for(let c=0;c<channels;c++)samples[frame*channels+c]*=frame/Math.max(1,attack-1);
 for(let frame=0;frame<release;frame++)for(let c=0;c<channels;c++)samples[(frames-1-frame)*channels+c]*=frame/Math.max(1,release-1);
 return samples;
}

const rawInput=(file,channels)=>['-f','f32le','-ar',String(RATE),'-ac',String(channels),'-i',file];
function loudness(inputArgs,target){
 const result=command('ffmpeg',['-hide_banner','-nostats',...inputArgs,'-af',`loudnorm=I=${target}:TP=-2:LRA=7:print_format=json`,'-f','null','-']);
 const blocks=String(result.stderr).match(/\{\s*"input_i"[\s\S]*?\}/g);
 if(!blocks?.length)throw new Error('FFmpeg did not return loudness measurements');
 const data=JSON.parse(blocks.at(-1));
 return {integratedLufs:finite(data.input_i),truePeakDb:finite(data.input_tp),rangeLu:finite(data.input_lra),thresholdLufs:finite(data.input_thresh),targetOffsetDb:finite(data.target_offset)};
}

function processAsset(asset){
 const id=asset.kind+'/'+asset.name;
 const master=join(ROOT,'assets/audio/masters',asset.kind+'-'+asset.name+'.mp3');
 const destination=join(ROOT,'public/audio',asset.kind,asset.name+'.mp3');
 const channels=asset.kind==='sfx'?1:2;
 const bitRate=asset.kind==='music'?128:96;
 const target=asset.kind==='ambience'?-28:-20;
 const warnings=[];
 const sourceProbe=probe(master),source=decode(master,channels),sourceStats=analyze(source,channels);
 const trimmed=trimEdges(source,channels,asset.loop===true);
 let pcm=trimmed.samples,overlap=0;
 if(asset.loop){const looped=circularOverlap(pcm,channels);pcm=looped.samples;overlap=looped.seconds;}
 else pcm=softenEdges(pcm,channels);
 const mixInput=analyze(pcm,channels);
 if(mixInput.rmsDb===null||mixInput.rmsDb<-60)warnings.push('Source is silent or has very low RMS; listen and consider regenerating it.');
 if(mixInput.samplePeakDb===null||mixInput.samplePeakDb<-85)warnings.push('No meaningful audible signal detected. Normalization cannot recover a silent source.');
 const raw=join(temporary,asset.kind+'-'+asset.name+'.f32');
 writeFileSync(raw,Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength));
 const measured=loudness(rawInput(raw,channels),target);
 let filter,normalization;
 if(asset.kind==='sfx'){
  const targetPeak=['paws','land'].includes(asset.name)?-8:-4;
  const gain=mixInput.samplePeakDb===null?0:Math.min(12,targetPeak-mixInput.samplePeakDb);
  if(mixInput.samplePeakDb!==null&&targetPeak-mixInput.samplePeakDb>12)warnings.push('Peak normalization reached the +12 dB boost cap.');
  filter=`volume=${gain}dB`;
  normalization={method:'sample-peak',targetPeakDb:targetPeak,gainDb:rounded(gain),maximumBoostDb:12};
 }else if([measured.integratedLufs,measured.truePeakDb,measured.rangeLu,measured.thresholdLufs,measured.targetOffsetDb].every(value=>value!==null)){
  filter=`loudnorm=I=${target}:TP=-2:LRA=7:measured_I=${measured.integratedLufs}:measured_TP=${measured.truePeakDb}:measured_LRA=${measured.rangeLu}:measured_thresh=${measured.thresholdLufs}:offset=${measured.targetOffsetDb}:linear=true:print_format=json`;
  normalization={method:'two-pass-loudnorm',targetIntegratedLufs:target,targetTruePeakDb:-2,targetRangeLu:7};
 }else{
  filter='anull';
  normalization={method:'bypassed-nonfinite-measurement',targetIntegratedLufs:target};
  warnings.push('Loudness measurement is non-finite; normalization was bypassed instead of guessing a gain.');
 }
 const encoded=join(temporary,asset.kind+'-'+asset.name+'.mp3');
 command('ffmpeg',['-hide_banner','-nostats','-y',...rawInput(raw,channels),'-af',filter,'-ar',String(RATE),'-ac',String(channels),'-c:a','libmp3lame','-b:a',bitRate+'k','-map_metadata','-1','-id3v2_version','3',encoded]);
 const finalProbe=probe(encoded),finalPcm=decode(encoded,channels),finalStats=analyze(finalPcm,channels);
 const finalLoudness=loudness(['-i',encoded],target);
 if(finalLoudness.truePeakDb!==null&&finalLoudness.truePeakDb>-.5)warnings.push('Encoded audio has less than 0.5 dB true-peak headroom.');
 if(asset.kind!=='sfx'&&finalLoudness.integratedLufs!==null&&Math.abs(finalLoudness.integratedLufs-target)>1)warnings.push('Encoded loudness is more than 1 LU from the target.');
 if(finalStats.rmsDb===null||finalStats.rmsDb<-60)warnings.push('Shipped audio is silent or has very low RMS.');
 mkdirSync(dirname(destination),{recursive:true});
 copyFileSync(encoded,destination+'.tmp');
 renameSync(destination+'.tmp',destination);
 const result={id,source:'assets/audio/masters/'+asset.kind+'-'+asset.name+'.mp3',output:'public/audio/'+id+'.mp3',sourceSha256:hash(master),outputSha256:hash(destination),loop:asset.loop===true,sourceFormat:sourceProbe,sourcePcm:sourceStats,trim:trimmed.stats,circularOverlapSeconds:rounded(overlap),loopDurationReductionSeconds:rounded(overlap),normalizationInputPcm:mixInput,normalizationInputLoudness:measured,normalization,outputFormat:finalProbe,outputPcm:finalStats,outputLoudness:finalLoudness,warnings};
 console.log(`${id}: ${finalStats.duration.toFixed(3)} s, ${finalProbe.channels} ch, ${bitRate} kbps, ${finalLoudness.integratedLufs??'unmeasurable'} LUFS, ${finalLoudness.truePeakDb??'unmeasurable'} dBTP${warnings.length?' [WARN]':''}`);
 for(const warning of warnings)console.warn(id+': '+warning);
 rmSync(raw);
 return result;
}

const report={version:VERSION,sampleRate:RATE,partial:PARTIAL,selection:selected?[...selected]:null,expectedAssets:plan.assets.length,assets:[],missing:[],warnings:[],processedAssets:0,reusedAssets:0};
function saveReport(){writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');}
try{
 const known=new Set(plan.assets.map(asset=>asset.kind+'/'+asset.name));
 if(selected)for(const id of selected)if(!known.has(id))throw new Error('Unknown --only asset: '+id);
 for(const asset of plan.assets){
  if(!['music','sfx','ambience'].includes(asset.kind)||!/^[a-z0-9-]+$/.test(asset.name))throw new Error('Invalid asset kind/name in audio plan');
  const master=join(ROOT,'assets/audio/masters',asset.kind+'-'+asset.name+'.mp3');
  if(!existsSync(master))report.missing.push(asset.kind+'/'+asset.name);
 }
 if(report.missing.length&&!PARTIAL)throw new Error('Missing required generated masters: '+report.missing.join(', ')+'. Use --partial only while generation is still in progress.');
 for(const asset of plan.assets){
  const id=asset.kind+'/'+asset.name;
  if(report.missing.includes(id))continue;
  const previous=oldReport?.version===VERSION?oldReport.assets?.find(item=>item.id===id):null;
  const intact=previous&&previous.loop===(asset.loop===true)&&existsSync(join(ROOT,previous.output))&&previous.sourceSha256===hash(join(ROOT,previous.source))&&previous.outputSha256===hash(join(ROOT,previous.output));
  if(intact){report.assets.push(previous);report.reusedAssets++;continue;}
  if(selected&&!selected.has(id)){
   if(!PARTIAL)throw new Error('Unprepared or changed asset outside --only selection: '+id+'. Include it or run without --only.');
   report.missing.push(id);continue;
  }
  report.assets.push(processAsset(asset));
  report.processedAssets++;
  saveReport();
 }
 report.preparedAssets=report.assets.length;
 report.outputBytes=report.assets.reduce((total,asset)=>total+asset.outputFormat.bytes,0);
 report.warnings=report.assets.flatMap(asset=>asset.warnings.map(message=>({id:asset.id,message})));
 saveReport();
 console.log(`Prepared ${report.preparedAssets}/${report.expectedAssets} assets (${(report.outputBytes/1024/1024).toFixed(2)} MiB); ${report.processedAssets} processed, ${report.reusedAssets} unchanged files verified. Report: assets/audio/mix-report.json`);
}catch(error){
 report.error=error.message;
 saveReport();
 throw error;
}finally{
 rmSync(temporary,{recursive:true,force:true});
}
