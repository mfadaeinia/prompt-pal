import { YoutubeTranscript } from 'youtube-transcript';
try {
  const r = await YoutubeTranscript.fetchTranscript('ucsSnoeTPMc');
  console.error("count", r.length);
  process.stdout.write(JSON.stringify(r));
} catch (e) {
  console.error("ERR", e.message);
}
