import { YoutubeTranscript } from "youtube-transcript";
const cands = process.argv.slice(2);
const NL = /\b(de|het|een|en|van|is|niet|dat|je|ik|we|met|voor|op|te)\b/gi;
for (const id of cands) {
  const out = { id };
  try {
    const o = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`);
    if(!o.ok){ console.log(id,"OEMBED_FAIL",o.status); continue; }
    const j = await o.json(); out.title=j.title; out.ch=j.author_name; out.thumb=j.thumbnail_url;
  } catch(e){ console.log(id,"ERR",e.message); continue; }
  const w = await fetch(`https://www.youtube.com/watch?v=${id}`,{headers:{"user-agent":"Mozilla/5.0","accept-language":"nl"}});
  const html = await w.text();
  out.embeddable = /"playableInEmbed":\s*true/.test(html) && !/"playableInEmbed":\s*false/.test(html);
  const dur = html.match(/"lengthSeconds":"(\d+)"/); out.dur = dur?+dur[1]:null;
  out.nlCaptions = /"languageCode":"nl"/.test(html);
  try {
    const t = await YoutubeTranscript.fetchTranscript(id,{lang:"nl"});
    const text = t.map(s=>s.text).join(" ");
    out.segs = t.length; out.words = text.split(/\s+/).filter(Boolean).length;
    const hits = (text.match(NL)||[]).length; out.nlRatio = +(hits/Math.max(1,out.words)).toFixed(3);
  } catch(e){ out.segs=0; out.words=0; out.nlRatio=0; out.terr=e.message.slice(0,60); }
  out.wpm = out.dur? Math.round(out.words/(out.dur/60)) : null;
  out.PASS = out.embeddable && out.nlCaptions && out.segs>=12 && out.words>=120 && out.nlRatio>0.12 && out.wpm>=40;
  console.log(JSON.stringify(out));
}
