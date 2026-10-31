import {styleLibrary} from '../web/style-library-model.mjs';
export function themeCss(theme='editorial'){
 if(theme==='editorial')return '';
 if(theme==='bold-pop')return `html,body{background:#FFF2B6;color:#281F21}.backdrop{background:linear-gradient(135deg,#FFF2B6 64%,#F6DCCE 64%)}h1{font-size:55px;letter-spacing:-2px}.content-visual{border:3px solid #281F21;box-shadow:12px 12px 0 #281F21;border-radius:0}.caption{border-radius:0;background:#281F21}.brand em{color:#793A24}`;
 if(theme==='quiet-documentary')return `html,body{background:#EDEAE3;color:#263D3A}.backdrop{background:linear-gradient(90deg,#D9DED4 1px,transparent 1px),#EDEAE3;background-size:80px 100%}h1{font-weight:700;font-size:47px;letter-spacing:-.8px}.content-visual{border:1px solid #9BAFAA;box-shadow:none;background:#F8F7F2}.caption{border-radius:0;background:#263D3A}.brand em{color:#355D50}`;
 if(theme==='dark-cinema')return `
 html,body{background:#142535;color:#EDF5FB}.backdrop{background:radial-gradient(ellipse at 65% 40%,#244D61,#142535 65%)}
 .brand{top:68px}.brand em,.scene-label span,.footer{color:#B7CBD8}h1{font-size:49px;letter-spacing:.2px;line-height:1.3;font-weight:700;max-width:550px}
 .scene-label{border-bottom:1px solid #587383;padding-bottom:14px;height:58px}.visual{top:415px;height:520px;border-top:1px solid #587383;border-bottom:1px solid #587383}
 .paper{width:400px;height:428px;border-radius:0;box-shadow:12px 12px 0 #376176;padding:25px 30px;color:#192E52}.paper-head{padding-bottom:14px}.annotation{font-size:26px;color:#244F68}
 .editing{border-radius:0;border:8px solid #376176;color:#192E52}.edit-scene{color:#192E52}.reel{width:208px;height:208px}.voice-tag{font-size:26px}.voice-caption,.machine-caption{color:#B7CBD8}
 .film-screen{border-radius:2px;background:#EDF5FB;color:#192E52}.deliverables{color:#192E52}.delivery-note{color:#B7CBD8}.caption{background:#EDF5FB;color:#142535;border-radius:2px;border-left:6px solid var(--accent);text-align:left}
 .reel-core,.deliverables b{color:#244F68}.progress{background:#496779}.wave-cursor{background:#EDF5FB}.iso{filter:drop-shadow(0 15px 25px #07121C80)}
 `;
 if(theme==='paper-story')return `
 html,body{background:#F4EFDC;color:#283B2A}.backdrop{background:repeating-linear-gradient(0deg,transparent 0 38px,#DFD9C2 38px 39px),#F4EFDC}
 .brand{top:55px;border-bottom:2px solid #C6C0A8;padding-bottom:20px}.brand em{color:#375B38}.brand-mark{clip-path:none;border-radius:50%;width:23px;height:23px}
 .scene-label{height:40px}.scene-label span,.footer{color:#4E634B}h1{font-size:48px;letter-spacing:-.8px;line-height:1.35;border-left:6px solid var(--accent);padding-left:22px;max-width:590px}
 .visual{top:420px}.paper{background:#FFFEF5;border:1px solid #CDC6AC;border-radius:0;box-shadow:10px 13px 0 #D7D1B5}.paper-head{color:#4E634B;border-color:#D7D1B5}.script-line{background:#CFD2B7}.paper-stamp{color:#4E634B}
 .editing{border:1px solid #CDC6AC;background:#FFFEF5;border-radius:2px;box-shadow:9px 12px 0 #D7D1B5}.reel{background:repeating-conic-gradient(#DDD9BB 0 52deg,#C2C6A6 52deg 60deg);border-color:#CFD2B7;outline-color:#8B9B7B}
 .voice-caption,.machine-caption,.delivery-note{color:#4E634B}.edit-card{border-radius:2px}.film-screen{background:#FFFEF5;border:2px solid #8B9B7B;border-radius:2px}.deliverables b{border-radius:2px;box-shadow:4px 5px 0 #D7D1B5}
 .caption{background:#283B2A;border-radius:2px;padding:20px 26px;text-align:left}.progress{background:#CFD2B7}
 `;
 const s=styleLibrary.find(s=>s.id===theme);
 if(!s)throw Error('INVALID_THEME');
 const [bg,ink,,muted]=s.colors;
 const base=`html,body{background:${bg};color:${ink}}.backdrop{background:${bg}}.brand em,.scene-label span,.footer{color:${ink}}.content-visual{color:${ink};background:${bg};border-color:${muted}}.content-kicker,.content-label,.diagram-note,.story-attribution{color:${ink}}.diagram-node,.comparison>div{background:${muted};color:${ink}}.caption{background:${ink};color:${bg}}.progress{background:${muted}}h1{font-size:48px;line-height:1.3}.content-visual .accent{color:var(--accent)}`;
 const treatments={
  'chalk-talk':`.backdrop{background:repeating-linear-gradient(0deg,transparent 0 79px,#45675B55 79px 80px),${bg}}.content-visual{border:2px dashed ${muted};border-radius:6px;box-shadow:none}h1{border-bottom:2px dashed ${muted};padding-bottom:18px}.caption{border:1px solid ${muted};border-radius:4px}`,
  'comic-ink':`.backdrop{background:radial-gradient(${muted} 1.1px,transparent 1.1px),${bg};background-size:12px 12px}.content-visual{border:4px solid ${ink};border-radius:0;box-shadow:12px 12px 0 ${ink}}h1{font-weight:900;letter-spacing:-1px}.caption{border:3px solid ${ink};border-radius:0;box-shadow:6px 6px 0 var(--accent)}.scene-label{border-bottom:3px solid ${ink}}`,
  'pastel-play':`.backdrop{background:radial-gradient(ellipse at 90% 35%,${muted} 0%,transparent 58%),${bg}}.content-visual{border:2px solid ${muted};border-radius:42px;box-shadow:0 18px 0 ${muted}}h1{font-weight:900;letter-spacing:-1px}.caption{border-radius:28px}`,
  'midnight-tech':`.backdrop{background:linear-gradient(${muted}55 1px,transparent 1px),linear-gradient(90deg,${muted}55 1px,transparent 1px),${bg};background-size:40px 40px}.content-visual{border:1px solid var(--accent);border-radius:0;box-shadow:8px 8px 0 ${muted}}h1{font-size:46px;border-left:5px solid var(--accent);padding-left:20px}.scene-label{border-bottom:1px solid ${muted}}.caption{border-radius:0;border-left:5px solid var(--accent)}`,
  'botanical':`.backdrop{background:radial-gradient(ellipse at 0% 55%,${muted} 0%,transparent 60%),${bg}}.content-visual{border:1px solid ${muted};border-radius:80px 8px 80px 8px;box-shadow:none}h1{font-weight:700;letter-spacing:-.6px}.caption{border-radius:16px 2px 16px 2px}`,
  'sunset-travel':`.backdrop{background:linear-gradient(160deg,${bg} 45%,${muted})}.content-visual{border:10px solid #FFF8EF;border-bottom-width:24px;border-radius:2px;box-shadow:8px 14px 0 ${muted}}h1{font-weight:900;letter-spacing:-1px}.caption{border-radius:2px;border-bottom:4px solid var(--accent)}`,
  'studio-mono':`.backdrop{background:linear-gradient(145deg,${bg} 60%,${muted})}.content-visual{border:1px solid ${muted};border-radius:2px;box-shadow:none}h1{font-size:47px;font-weight:700;letter-spacing:-1px}.brand{border-bottom:1px solid ${muted};padding-bottom:18px}.caption{border-radius:2px}`
 };
 const legacy=['chalk-talk','midnight-tech'].includes(theme)?`.paper,.editing,.edit-card,.film-screen{color:#192E52}.annotation,.timing-note,.reel-core,.deliverables b,.film-screen svg,.active svg,.voice-check,.writing-pen{color:#244F68}.voice-caption,.machine-caption,.delivery-note{color:${ink}}`:'';
 return base+treatments[theme]+legacy;
}
