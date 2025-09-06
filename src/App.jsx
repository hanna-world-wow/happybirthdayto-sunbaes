import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Heart, PartyPopper, Sparkles, Music, Send, ImagePlus, Share2, Trash2, MessageSquareHeart, Wand2, Camera, Cake, Stars, Mic, MicOff, Flame, Users } from "lucide-react";
import Confetti from "react-confetti";
import { createClient } from "@supabase/supabase-js";

const Button = ({ className = "", children, ...props }) => (
  <button
    className={`px-4 py-2 rounded-2xl shadow-sm border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur text-white transition ${className}`}
    {...props}
  >
    {children}
  </button>
);
const Card = ({ className = "", children }) => (
  <div className={`rounded-3xl p-5 bg-white/10 border border-white/20 shadow-lg backdrop-blur ${className}`}>{children}</div>
);

function useQuery() {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

const presetWishes = [
  "오늘 너희 웃음이 세상에서 제일 반짝이길 ✨",
  "올해의 너희는 지난 해보다 더 행복해질 예정!",
  "케이크 칼질은 내가, 소원 빌기는 너희가 🎂",
  "건강 + 행운 + 사랑 3연타 가즈아 💥",
  "너희가 있어서 우리의 오늘이 더 예뻐 💗",
  "올해도 우리 같이 미쳤다 프로젝트 하자 😆",
];

const gradients = [
  "from-fuchsia-500 via-rose-500 to-amber-400",
  "from-indigo-500 via-sky-500 to-emerald-400",
  "from-pink-500 via-purple-500 to-sky-400",
  "from-emerald-500 via-lime-400 to-yellow-400",
  "from-sky-500 via-cyan-400 to-violet-500",
];

function useMicBlowDetector({ enabled, onBlow, threshold = 0.2, holdMs = 900 }) {
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(0);
  const blowStartRef = useRef(0);

  useEffect(() => {
    let stream;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          if (!enabled) { rafRef.current = requestAnimationFrame(loop); return; }
          analyser.getByteTimeDomainData(data);
          let sumSq = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / data.length);
          const now = performance.now();
          if (rms > threshold) {
            if (blowStartRef.current === 0) blowStartRef.current = now;
            if (now - blowStartRef.current > holdMs) {
              onBlow?.();
              blowStartRef.current = 0;
            }
          } else {
            blowStartRef.current = 0;
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        console.warn("Mic permission or init failed", e);
      }
    }
    if (enabled) start();
    return () => {
      cancelAnimationFrame(rafRef.current);
      try { audioCtxRef.current?.close(); } catch {}
      try { stream?.getTracks().forEach(t=>t.stop()); } catch {}
    };
  }, [enabled, onBlow, threshold, holdMs]);
}

function Candle({ lit }) {
  return (
    <div className="flex flex-col items-center mx-3">
      <div className="relative">
        <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-6 h-6 ${lit ? "opacity-100" : "opacity-0"}`}>
          <div className="w-6 h-6 rounded-full blur-[6px] bg-amber-300 animate-[flicker_0.12s_infinite_alternate]" />
          <div className="w-3 h-4 rounded-full bg-yellow-200 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[2px] h-3 bg-black/70" />
        <div className="w-8 h-24 bg-white rounded-md shadow-inner relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-200" />
          <div className="absolute inset-x-0 top-0 h-2 bg-pink-200/80" />
        </div>
      </div>
    </div>
  );
}

function useSupabase() {
  const [url, setUrl] = useState(() => localStorage.getItem("sb_url") || "");
  const [key, setKey] = useState(() => localStorage.getItem("sb_key") || "");
  const client = useMemo(() => {
    if (url && key) return createClient(url, key);
    return null;
  }, [url, key]);
  const persist = () => {
    localStorage.setItem("sb_url", url);
    localStorage.setItem("sb_key", key);
  };
  return { client, url, key, setUrl, setKey, persist };
}

export default function App() {
  const q = useQuery();
  const defaultFriends = ["혜진", "성현"];
  const namesParam = q.get("name");
  const friends = namesParam ? namesParam.split(",").map(s=>s.trim()).filter(Boolean) : defaultFriends;
  const fromParam = q.get("from") || "한나";
  const theme = parseInt(q.get("theme") || "0", 10) % gradients.length;

  const [runConfetti, setRunConfetti] = useState(true);
  const [wish, setWish] = useState(0);
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bd_messages") || "[]"); } catch { return []; }
  });
  const [photos, setPhotos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bd_photos") || "[]"); } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [showTips, setShowTips] = useState(true);
  const [showMusic, setShowMusic] = useState(false);
  const [musicUrl, setMusicUrl] = useState(() => localStorage.getItem("bd_music") || "");

  const [litCount, setLitCount] = useState(3);
  const [micOn, setMicOn] = useState(false);

  const { client, url, key, setUrl, setKey, persist } = useSupabase();
  const room = `birthday-${friends.join("&")}`;
  const [guestbook, setGuestbook] = useState([]);
  const [guestName, setGuestName] = useState("");
  const [guestMsg, setGuestMsg] = useState("");
  const [realtimeOn, setRealtimeOn] = useState(false);

  useEffect(() => { const t = setTimeout(() => setRunConfetti(false), 6000); return () => clearTimeout(t); }, []);
  useEffect(() => { localStorage.setItem("bd_messages", JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem("bd_photos", JSON.stringify(photos)); }, [photos]);

  useMicBlowDetector({
    enabled: micOn && litCount > 0,
    onBlow: () => setLitCount((c) => Math.max(0, c - 1)),
    threshold: 0.22,
    holdMs: 800,
  });

  const relight = () => setLitCount(3);
  const randomizeWish = () => setWish((w) => (w + Math.ceil(Math.random() * (presetWishes.length - 1))) % presetWishes.length);
  const gradient = gradients[theme];

  const copyLink = async () => {
    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set("name", friends.join(","));
    urlObj.searchParams.set("theme", String(theme));
    urlObj.searchParams.set("from", fromParam);
    await navigator.clipboard.writeText(urlObj.toString());
    alert("링크가 복사되었어요! 친구에게 보내보세요 ✨");
  };

  useEffect(() => {
    let channel;
    (async () => {
      if (!client) {
        try {
          const local = JSON.parse(localStorage.getItem("bd_guestbook") || "[]");
          setGuestbook(local.filter((g)=> g.room === room).sort((a,b)=> b.created_at.localeCompare(a.created_at)));
        } catch {}
        return;
      }
      const { data, error } = await client
        .from("guestbook")
        .select("id,name,message,created_at,room")
        .eq("room", room)
        .order("created_at", { ascending: false });
      if (!error) setGuestbook(data || []);

      if (realtimeOn) {
        channel = client
          .channel(`guestbook-${room}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "guestbook", filter: `room=eq.${room}` }, (payload) => {
            setGuestbook((prev) => [payload.new, ...prev]);
          })
          .subscribe();
      }
    })();
    return () => { if (channel) client?.removeChannel(channel); };
  }, [client, room, realtimeOn]);

  const submitGuestbook = async () => {
    const name = guestName.trim() || "익명";
    const message = guestMsg.trim();
    if (!message) return;
    const entry = { id: Date.now(), name, message, created_at: new Date().toISOString(), room };

    if (!client) {
      const local = JSON.parse(localStorage.getItem("bd_guestbook") || "[]");
      const newList = [entry, ...local];
      localStorage.setItem("bd_guestbook", JSON.stringify(newList));
      setGuestbook((gb) => [entry, ...gb]);
      setGuestMsg("");
      return;
    }
    const { error } = await client.from("guestbook").insert({ name, message, room });
    if (!error) setGuestMsg("");
  };

  return (
    <div className={`min-h-screen text-white bg-gradient-to-br ${gradient} relative overflow-x-hidden`}>
      {runConfetti && <Confetti numberOfPieces={400} recycle={false} />}

      <header className="max-w-5xl mx-auto px-5 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PartyPopper className="w-6 h-6" />
          <span className="font-semibold tracking-wide">Birthday Splash</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowTips((v) => !v)} className="hidden md:inline-flex"><Wand2 className="w-4 h-4 mr-1"/>Tips</Button>
          <Button onClick={copyLink}><Share2 className="w-4 h-4 mr-1"/>공유</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 pb-24">
        <section className="text-center pt-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-4">
              <Stars className="w-4 h-4"/>
              <span className="text-sm">오늘은 {friends.join(" & ")} 의 날 ✨</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-sm">
              Happy Birthday, {friends.join(" & ")}! 🎉
            </h1>
            <p className="mt-3 text-white/90 max-w-2xl mx-auto">
              from {fromParam} · 소원 빌 준비 됐지? 아래에서 메시지 남기고, 사진 올리고, 촛불도 꺼보자!
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => setRunConfetti(true)}><PartyPopper className="w-4 h-4 mr-1"/>한 번 더 뿌리기</Button>
              <Button onClick={() => randomizeWish()} className="bg-white/20"><Sparkles className="w-4 h-4 mr-1"/>랜덤 축사 뽑기</Button>
            </div>
          </motion.div>
        </section>

        <section className="mt-10">
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2"><Flame className="w-5 h-5"/><h3 className="font-semibold">생일 초 불기</h3></div>
              <div className="flex items-center gap-2">
                <Button onClick={() => setMicOn((m) => !m)}>
                  {micOn ? (<><Mic className="w-4 h-4 mr-1"/>마이크 ON</>) : (<><MicOff className="w-4 h-4 mr-1"/>마이크 OFF</>)}
                </Button>
                <Button onClick={relight}>다시 켜기</Button>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-center">
              <div className="flex items-end">
                {[0,1,2].map((i)=> <Candle key={i} lit={i < litCount} />)}
              </div>
            </div>
            <p className="text-sm opacity-90 mt-3">마이크 ON 후 촛불에 대고 길게 후— 불면 하나씩 꺼져요. (조용한 환경: 잘 꺼짐 / 시끄러우면 가까이서 불어주세요)</p>
          </Card>
        </section>

        <AnimatePresence mode="wait">
          <motion.section key={wish} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="mt-10">
            <Card className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg">
                <Gift className="w-5 h-5"/>
                <span>{presetWishes[wish]}</span>
              </div>
            </Card>
          </motion.section>
        </AnimatePresence>

        {showMusic && (
          <section className="mt-6">
            <Card>
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5"/>
                <div className="text-sm opacity-90">유튜브 공유 링크나 MP3 URL을 입력하면 배경음악으로 재생돼요.</div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                <input
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-white/20 border border-white/30 outline-none placeholder-white/70 text-white"
                  placeholder="예: https://www.youtube.com/embed/5vheNbQlsyU?autoplay=1&mute=0"
                  value={musicUrl}
                  onChange={(e) => { setMusicUrl(e.target.value); localStorage.setItem("bd_music", e.target.value); }}
                />
                <Button onClick={()=>{ const demo = "https://www.youtube.com/embed/5vheNbQlsyU?autoplay=1&mute=0"; setMusicUrl(demo); localStorage.setItem("bd_music", demo); }}>데모 넣기</Button>
              </div>
              {musicUrl && (<div className="mt-4 aspect-video w-full"><iframe className="w-full h-full rounded-2xl" src={musicUrl} allow="autoplay; encrypted-media" /></div>)}
            </Card>
          </section>
        )}

        <section className="mt-10 grid md:grid-cols-2 gap-6">
          <Card>
            <div className="flex items-center gap-2 mb-3"><MessageSquareHeart className="w-5 h-5"/><h3 className="font-semibold">축하 메시지 남기기</h3></div>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-xl bg-white/20 border border-white/30 outline-none placeholder-white/70 text-white"
                placeholder={`예: ${friends[0]}, ${friends[1]} 오늘도 빛나!`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e)=>{ if(e.key==='Enter') { if (input.trim()) setMessages([{ id: Date.now(), text: input.trim() }, ...messages]); setInput(""); } }}
              />
              <Button onClick={()=>{ if (input.trim()) setMessages([{ id: Date.now(), text: input.trim() }, ...messages]); setInput(""); }}><Send className="w-4 h-4 mr-1"/>남기기</Button>
            </div>
            <div className="mt-4 space-y-3 max-h-72 overflow-auto pr-2">
              {messages.length === 0 && (<div className="text-white/80 text-sm">첫 번째 메시지를 남겨보세요 💬</div>)}
              {messages.map((m) => (
                <div key={m.id} className="flex items-start gap-2 bg-white/10 rounded-2xl p-3 border border-white/10">
                  <Heart className="w-4 h-4 mt-1"/>
                  <div className="flex-1 whitespace-pre-wrap">{m.text}</div>
                  <button aria-label="delete" onClick={() => setMessages(messages.filter((x)=>x.id!==m.id))} className="opacity-80 hover:opacity-100">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-3"><Camera className="w-5 h-5"/><h3 className="font-semibold">사진 업로드</h3></div>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e)=>{
                  const f = e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const p={ id: Date.now(), dataUrl: r.result }; setPhotos([p,...photos]); }; r.readAsDataURL(f);
                }} />
                <span className="inline-flex items-center px-3 py-2 rounded-2xl bg-white/20 border border-white/30"><ImagePlus className="w-4 h-4 mr-1"/>사진 선택</span>
              </label>
              <span className="text-sm opacity-90">업로드한 사진은 이 브라우저에만 저장돼요 (localStorage).</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 max-h-72 overflow-auto pr-1">
              {photos.length === 0 && <div className="text-white/80 text-sm col-span-3">아직 사진이 없어요 📸</div>}
              {photos.map((p)=> (
                <div key={p.id} className="relative group">
                  <img src={p.dataUrl} alt="uploaded" className="w-full h-28 object-cover rounded-xl border border-white/20" />
                  <button onClick={()=>setPhotos(photos.filter((x)=>x.id!==p.id))} className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 rounded-full p-1">
                    <Trash2 className="w-4 h-4 text-white"/>
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-10">
          <Card>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2"><Users className="w-5 h-5"/><h3 className="font-semibold">게스트북 (실시간 가능)</h3></div>
              <div className="flex items-center gap-2">
                <input className="px-3 py-2 rounded-xl bg-white/10 border border-white/30 placeholder-white/70 text-white w-48" placeholder="Supabase URL" value={url} onChange={(e)=>setUrl(e.target.value)} />
                <input className="px-3 py-2 rounded-xl bg-white/10 border border-white/30 placeholder-white/70 text-white w-56" placeholder="Anon Key" value={key} onChange={(e)=>setKey(e.target.value)} />
                <Button onClick={()=>{persist(); alert("저장 완료! 새로고침하면 적용돼요.");}}>저장</Button>
                <Button onClick={()=>setRealtimeOn((v)=>!v)}>{realtimeOn?"실시간 ON":"실시간 OFF"}</Button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 flex-wrap">
              <input className="px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white flex-1 min-w-[160px]" placeholder="이름(선택)" value={guestName} onChange={(e)=>setGuestName(e.target.value)} />
              <input className="px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white flex-[2] min-w-[240px]" placeholder="메시지" value={guestMsg} onChange={(e)=>setGuestMsg(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitGuestbook(); }} />
              <Button onClick={submitGuestbook}><Send className="w-4 h-4 mr-1"/>남기기</Button>
            </div>

            <div className="mt-4 space-y-3 max-h-80 overflow-auto pr-2">
              {guestbook.length===0 && <div className="text-sm opacity-80">아직 메시지가 없어요. 첫 메시지를 남겨보세요!</div>}
              {guestbook.map((g)=> (
                <div key={g.id} className="bg-white/10 border border-white/10 rounded-2xl p-3">
                  <div className="text-sm opacity-90">{new Date(g.created_at).toLocaleString()}</div>
                  <div className="font-semibold">{g.name || "익명"}</div>
                  <div className="whitespace-pre-wrap">{g.message}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-xs opacity-80">
              * Supabase를 쓰려면 테이블 <code>guestbook</code> (id bigserial or uuid default, name text, message text, room text, created_at timestamptz default now()) 를 만들어 주세요. URL/Key는 위 입력칸에 저장. 설정하지 않으면 브라우저 localStorage로 동작합니다.
            </div>
          </Card>
        </section>

        {showTips && (
          <section className="mt-10">
            <Card>
              <h3 className="font-semibold flex items-center gap-2 mb-2"><Wand2 className="w-5 h-5"/>사용 꿀팁</h3>
              <ul className="list-disc pl-5 space-y-2 text-white/90">
                <li><strong>이름 여러 명:</strong> 주소 끝에 <code>?name=혜진,성현</code> 처럼 쉼표로 여러 명 가능.</li>
                <li><strong>보낸 사람:</strong> <code>&from=한나</code> 로 서명 변경.</li>
                <li><strong>테마 변경:</strong> <code>&theme=1</code> ~ <code>4</code> 로 그라디언트 테마.</li>
                <li><strong>공유:</strong> 우상단 <em>공유</em> 버튼으로 현재 설정 링크 복사.</li>
                <li><strong>촛불 불기:</strong> <em>마이크 ON</em> 후 길게 후—. 다시 켜기는 버튼!</li>
                <li><strong>게스트북 실시간:</strong> Supabase URL/Key 저장 → 실시간 ON → 자동 업데이트.</li>
              </ul>
            </Card>
          </section>
        )}
      </main>

      <footer className="max-w-5xl mx-auto px-5 pb-10 text-center opacity-90">
        <div className="inline-flex items-center gap-2 text-sm">
          <Cake className="w-4 h-4"/> Made with love for {friends.join(" & ")} · from {fromParam} 💜
        </div>
      </footer>

      <style>{`
        @keyframes flicker { from { transform: translateY(-1px) scale(1); opacity: .95 } to { transform: translateY(1px) scale(1.05); opacity: 1 } }
      `}</style>
    </div>
  );
}
