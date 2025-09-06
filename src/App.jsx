import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, Stars, Sparkles, Gift, Mic, MicOff, Flame, Wand2, Share2, Music, Send, Users, Cake } from "lucide-react";
import Confetti from "react-confetti";
import { createClient } from "@supabase/supabase-js";

// ---- tiny ui ----
const Button = ({ className = "", children, ...props }) => (
  <button className={`px-4 py-2 rounded-2xl shadow-sm border border-white/20 bg-white/10 hover:bg-white/20 backdrop-blur text-white transition ${className}`} {...props}>
    {children}
  </button>
);
const Card = ({ className = "", children }) => (
  <div className={`rounded-3xl p-5 bg-white/10 border border-white/20 shadow-lg backdrop-blur ${className}`}>{children}</div>
);

function useQuery() { return useMemo(() => new URLSearchParams(window.location.search), []); }

const presetWishes = [
  "오늘 너희 웃음이 세상에서 제일 반짝이길 ✨",
  "올해의 너희는 지난 해보다 더 행복해질 예정!",
  "케이크 칼질은 내가, 소원 빌기는 너희가 🎂",
  "건강 + 행운 + 사랑 3연타 가즈아 💥",
  "너희가 있어서 우리의 오늘이 더 예뻐 💗",
  
];

const gradients = [
  "from-fuchsia-500 via-rose-500 to-amber-400",
  "from-indigo-500 via-sky-500 to-emerald-400",
  "from-pink-500 via-purple-500 to-sky-400",
  "from-emerald-500 via-lime-400 to-yellow-400",
  "from-sky-500 via-cyan-400 to-violet-500",
];

// ------ Mic Blow Detector with live level ------
function useMicBlowDetector({ enabled, onBlow, threshold = 0.16, holdMs = 500, onLevel }) {
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(0);
  const blowStartRef = useRef(0);
  useEffect(() => {
    let stream;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const Ctx = window.AudioContext || window.webkitAudioContext; const ctx = new Ctx();
        try { await ctx.resume?.(); } catch {}
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser(); an.fftSize = 2048; src.connect(an); analyserRef.current = an;
        const buf = new Uint8Array(analyserRef.current.fftSize);
        const loop = () => {
          if (!analyserRef.current) return;
          an.getByteTimeDomainData(buf);
          let s = 0; for (let i=0;i<buf.length;i++){ const v=(buf[i]-128)/128; s += v*v; }
          const rms = Math.sqrt(s/buf.length); // ~0..0.6
          onLevel?.(rms);
          const now = performance.now();
          if (enabled) {
            if (rms > threshold) {
              if (!blowStartRef.current) blowStartRef.current = now;
              if (now - blowStartRef.current > holdMs) { onBlow?.(rms); blowStartRef.current = 0; }
            } else { blowStartRef.current = 0; }
          }
          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (e) { console.warn("Mic init failed", e); }
    }
    if (enabled) start();
    return () => { cancelAnimationFrame(rafRef.current); try{audioCtxRef.current?.close();}catch{} try{stream?.getTracks().forEach(t=>t.stop());}catch{} };
  }, [enabled, onBlow, threshold, holdMs, onLevel]);
}

// ------- Supabase helper -------
function useSupabase() {
  const [url, setUrl] = useState(() => localStorage.getItem("sb_url") || "");
  const [key, setKey] = useState(() => localStorage.getItem("sb_key") || "");
  const client = useMemo(() => (url && key ? createClient(url, key) : null), [url, key]);
  const persist = () => { localStorage.setItem("sb_url", url); localStorage.setItem("sb_key", key); };
  return { client, url, key, setUrl, setKey, persist };
}

export default function App() {
  const q = useQuery();
  const defaultFriends = ["혜진", "성현"]; // 기본 값
  const friends = (q.get("name") ? q.get("name").split(",").map(s=>s.trim()).filter(Boolean) : defaultFriends);
  const fromParam = q.get("from") || "한나";
  const myDefault = q.get("me") || "한나"; // 누가 불었는지 기록용 기본값
  const theme = parseInt(q.get("theme") || "0", 10) % gradients.length;

  const [runConfetti, setRunConfetti] = useState(true);
  useEffect(()=>{ const t=setTimeout(()=>setRunConfetti(false),6000); return ()=>clearTimeout(t); },[]);

  const gradient = gradients[theme];
  const room = `birthday-${friends.join("&")}`;

  // Wishes (moved ABOVE candles per request)
  const [wish, setWish] = useState(0);
  const randomizeWish = () => setWish((w)=>(w + Math.ceil(Math.random()*(presetWishes.length-1))) % presetWishes.length);

  // Mic + candles 30 on a long cake
  const CANDLE_COUNT = 30;
  const [candles, setCandles] = useState(() => Array(CANDLE_COUNT).fill(true)); // true = lit
  const [micOn, setMicOn] = useState(false);
  const [level, setLevel] = useState(0);
  const [threshold, setThreshold] = useState(0.16);
  const [holdMs, setHoldMs] = useState(500);
  const litCount = candles.filter(Boolean).length;

  const [myName, setMyName] = useState(myDefault);

  // Supabase: blows + guestbook
  const { client, url, key, setUrl, setKey, persist } = useSupabase();
  const [blows, setBlows] = useState([]); // {id,name,candle_index,created_at}
  const [guestbook, setGuestbook] = useState([]);
  const [guestName, setGuestName] = useState("");
  const [guestMsg, setGuestMsg] = useState("");
  const [realtimeOn, setRealtimeOn] = useState(true);

  // load blows & subscribe
  useEffect(()=>{
    if(!client) return; let channel;
    (async()=>{
      const { data } = await client.from("blows").select("id,name,candle_index,created_at,room").eq("room", room).order("created_at", { ascending:false });
      setBlows(data||[]);
      if(realtimeOn){
        channel = client.channel(`blows-${room}`).on("postgres_changes", { event:"INSERT", schema:"public", table:"blows", filter:`room=eq.${room}` }, (payload)=>{
          setBlows(prev=>[payload.new, ...prev]);
        }).subscribe();
      }
    })();
    return ()=>{ if(channel) client.removeChannel(channel); };
  }, [client, room, realtimeOn]);

  // reflect remote blows to local candles (idempotent)
  useEffect(()=>{
    // extinguish first N candles according to number of remote blows
    const n = (blows||[]).length;
    setCandles(prev => prev.map((v, i) => i < n ? false : true));
  }, [blows]);

  // handle blow locally + insert
  const handleBlow = async () => {
    // extinguish next lit candle index
    const idx = candles.findIndex(v=>v===true);
    if (idx === -1) return;
    // optimistic local update
    setCandles(cs => cs.map((v,i)=> i===idx ? false : v));
    // store to supabase if available
    if(client){
      await client.from("blows").insert({ name: myName || "익명", candle_index: idx, room });
    }
  };

  useMicBlowDetector({ enabled: micOn && litCount>0, onBlow: handleBlow, threshold, holdMs, onLevel: setLevel });

  const relightAll = async () => {
    setCandles(Array(CANDLE_COUNT).fill(true));
    // optional: clear blows table for this room (manual SQL would be safer; here we just add a reset mark or ignore)
  };

  // Scoreboard aggregation
  const scores = useMemo(()=>{
    const m = new Map();
    for(const b of blows){ if(b.room!==room) continue; m.set(b.name || "익명", (m.get(b.name||"익명")||0)+1); }
    return Array.from(m.entries()).sort((a,b)=> b[1]-a[1]);
  }, [blows, room]);

  // Guestbook (Supabase only)
  useEffect(()=>{
    if(!client) return; let ch;
    (async()=>{
      const { data } = await client.from("guestbook").select("id,name,message,created_at,room").eq("room", room).order("created_at", { ascending:false });
      setGuestbook(data||[]);
      if(realtimeOn){
        ch = client.channel(`guestbook-${room}`).on("postgres_changes", { event:"INSERT", schema:"public", table:"guestbook", filter:`room=eq.${room}` }, (payload)=>{
          setGuestbook(prev=>[payload.new, ...prev]);
        }).subscribe();
      }
    })();
    return ()=>{ if(ch) client.removeChannel(ch); };
  }, [client, room, realtimeOn]);

  const submitGuestbook = async () => {
    const name = (guestName.trim() || "익명").slice(0,30);
    const message = guestMsg.trim(); if(!message) return;
    if(client){ await client.from("guestbook").insert({ name, message, room }); setGuestMsg(""); }
  };

  const copyLink = async () => {
    const u = new URL(window.location.href);
    u.searchParams.set("name", friends.join(","));
    u.searchParams.set("from", fromParam);
    u.searchParams.set("me", myName || "한나");
    u.searchParams.set("theme", String(theme));
    await navigator.clipboard.writeText(u.toString());
    alert("링크가 복사되었어요! 친구에게 보내보세요 ✨");
  };

  return (
    <div className={`min-h-screen text-white bg-gradient-to-br ${gradient} relative overflow-x-hidden`}>
      {runConfetti && <Confetti numberOfPieces={450} recycle={false} />}

      <header className="max-w-6xl mx-auto px-5 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-2"><PartyPopper className="w-6 h-6"/><span className="font-semibold tracking-wide">Birthday Splash</span></div>
        <div className="flex items-center gap-2">
          <input className="px-3 py-2 rounded-xl bg-white/10 border border-white/30 placeholder-white/70 text-white w-36" placeholder="내 이름" value={myName} onChange={(e)=>setMyName(e.target.value)} />
          <Button onClick={copyLink}><Share2 className="w-4 h-4 mr-1"/>공유</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 pb-24">
        {/* HERO */}
        <section className="text-center pt-8">
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.8 }}>
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-4">
              <Stars className="w-4 h-4"/>
              <span className="text-sm">오늘은 {friends.join(" & ")} 의 날 ✨</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight drop-shadow-sm">Happy Birthday, {friends.join(" & ")}! 🎉</h1>
            <p className="mt-3 text-white/90 max-w-2xl mx-auto">from {fromParam}</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button onClick={()=>setRunConfetti(true)}><PartyPopper className="w-4 h-4 mr-1"/>한 번 더 뿌리기</Button>
            </div>
          </motion.div>
        </section>

        {/* 1) WISH (moved above candles) */}
        <AnimatePresence mode="wait">
          <motion.section key={wish} initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }} transition={{ duration:0.35 }} className="mt-10">
            <Card className="text-center">
              <div className="flex items-center justify-center gap-2 text-lg"><Gift className="w-5 h-5"/><span>{presetWishes[wish]}</span></div>
              <div className="mt-3"><Button onClick={randomizeWish} className="bg-white/20"><Sparkles className="w-4 h-4 mr-1"/>랜덤 축사 뽑기</Button></div>
            </Card>
          </motion.section>
        </AnimatePresence>

        {/* 2) CANDLES + LONG CAKE + DASHBOARD */}
        <section className="mt-8">
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2"><Flame className="w-5 h-5"/><h3 className="font-semibold">생일 초 불기 (총 {CANDLE_COUNT}개)</h3></div>
              <div className="flex items-center gap-2">
                <Button onClick={()=>setMicOn(m=>!m)}>{micOn ? (<><Mic className="w-4 h-4 mr-1"/>마이크 ON</>):(<><MicOff className="w-4 h-4 mr-1"/>마이크 OFF</>)}</Button>
                <Button onClick={relightAll}>모두 다시 켜기</Button>
              </div>
            </div>

            {/* Cake + 30 candles */}
            <div className="mt-6">
              <div className="relative mx-auto max-w-full overflow-x-auto">
                <div className="min-w-[900px] mx-auto">
                  {/* candles row */}
                  <div className="flex justify-between px-4" style={{transform:'translateY(0)'}}>
                    {candles.map((lit, i)=>(
                      <div key={i} className="flex flex-col items-center" title={`Candle ${i+1}`}> 
                        {/* flame */}
                        <div className={`w-5 h-5 ${lit?"opacity-100":"opacity-0"} relative -mb-2`}>
                          <div className="w-5 h-5 rounded-full blur-[6px] bg-amber-300 animate-[flicker_0.12s_infinite_alternate]" />
                          <div className="w-2 h-3 rounded-full bg-yellow-200 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        {/* wick & body */}
                        <div className="w-[2px] h-3 bg-black/70" />
                        <div className="w-4 h-8 bg-white rounded-sm shadow-inner relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-200" />
                          <div className="absolute inset-x-0 top-0 h-1 bg-pink-200/80" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* cake body */}
                  <div className="mt-2 h-24 rounded-2xl bg-gradient-to-b from-pink-200/90 to-rose-200/80 border border-white/30 shadow-inner flex items-end">
                    <div className="w-full h-10 bg-white/70 rounded-b-2xl" />
                  </div>
                </div>
              </div>
            </div>

            {/* Controls & meters */}
            <div className="mt-6 grid md:grid-cols-3 gap-4 items-center">
              <div>
                <div className="text-xs opacity-80 mb-1">민감도(Threshold): {threshold.toFixed(2)}</div>
                <input type="range" min="0.08" max="0.35" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="w-full"/>
              </div>
              <div>
                <div className="text-xs opacity-80 mb-1">길게 불기 시간(ms): {holdMs}</div>
                <input type="range" min="300" max="1200" step="50" value={holdMs} onChange={(e)=>setHoldMs(parseInt(e.target.value))} className="w-full"/>
              </div>
              <div>
                <div className="text-xs opacity-80 mb-1">입력 레벨</div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white/80" style={{ width: `${Math.min(100, Math.round(level*200))}%` }} /></div>
                <div className="text-[10px] opacity-70 mt-1">RMS: {level.toFixed(3)}</div>
              </div>
            </div>

            {/* Dashboard */}
            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <Card>
                <div className="flex items-center gap-2"><Users className="w-5 h-5"/><h4 className="font-semibold">대시보드 · 누가 몇 개 껐나</h4></div>
                <div className="mt-3 text-sm opacity-90">남은 초: {litCount} / {CANDLE_COUNT}</div>
                <ul className="mt-2 space-y-2">
                  {scores.length===0 && <li className="text-sm opacity-80">아직 기록이 없어요. 마이크 ON 후 불어보세요!</li>}
                  {scores.map(([name,count])=> (
                    <li key={name} className="flex items-center justify-between bg-white/10 border border-white/10 rounded-xl px-3 py-2">
                      <span className="font-semibold">{name}</span>
                      <span>{count} 개</span>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <div className="text-sm opacity-90">내 이름</div>
                <div className="flex gap-2 mt-2">
                  <input className="px-3 py-2 rounded-xl bg-white/10 border border-white/30 text-white flex-1" value={myName} onChange={(e)=>setMyName(e.target.value)} />
                  <Button onClick={handleBlow}><Flame className="w-4 h-4 mr-1"/>수동으로 끄기</Button>
                </div>
                <div className="text-xs opacity-80 mt-3">* 수동 끄기는 테스트용 버튼이에요. 실제로는 마이크 ON 후 불어주세요.</div>
              </Card>
            </div>

            {/* Supabase Keys */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-2"><Wand2 className="w-4 h-4"/><span className="text-sm opacity-90">Supabase 연결 (blows/guestbook 사용)</span></div>
              <div className="flex flex-wrap gap-2">
                <input className="px-3 py-2 rounded-xl bg-white/10 border border-white/30 placeholder-white/70 text-white w-60" placeholder="Supabase URL" value={url} onChange={(e)=>setUrl(e.target.value)} />
                <input className="px-3 py-2 rounded-xl bg-white/10 border border-white/30 placeholder-white/70 text-white w-80" placeholder="Anon Key" value={key} onChange={(e)=>setKey(e.target.value)} />
                <Button onClick={()=>{persist(); alert("저장 완료! 새로고침하면 적용돼요.");}}>저장</Button>
              </div>
            </div>
          </Card>
        </section>

        {/* 3) Guestbook ONLY (messages/photos 삭제) */}
        <section className="mt-10">
          <Card>
            <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5"/><h3 className="font-semibold">게스트북</h3></div>
            <div className="text-sm opacity-80">축하 한마디 남겨주세요 ✨</div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <input className="px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white flex-1 min-w-[160px]" placeholder="이름(선택)" value={guestName} onChange={(e)=>setGuestName(e.target.value)} />
              <input className="px-3 py-2 rounded-xl bg-white/20 border border-white/30 text-white flex-[2] min-w-[240px]" placeholder="메시지" value={guestMsg} onChange={(e)=>setGuestMsg(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') submitGuestbook(); }} />
              <Button onClick={submitGuestbook}><Send className="w-4 h-4 mr-1"/>남기기</Button>
            </div>
            <div className="mt-4 space-y-3 max-h-96 overflow-auto pr-2">
              {guestbook.length===0 && <div className="text-sm opacity-80">아직 메시지가 없어요. 첫 메시지를 남겨보세요!</div>}
              {guestbook.map((g)=> (
                <div key={g.id} className="bg-white/10 border border-white/10 rounded-2xl p-3">
                  <div className="text-sm opacity-90">{new Date(g.created_at).toLocaleString()}</div>
                  <div className="font-semibold">{g.name || "익명"}</div>
                  <div className="whitespace-pre-wrap">{g.message}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-5 pb-10 text-center opacity-90">
        <div className="inline-flex items-center gap-2 text-sm"><Cake className="w-4 h-4"/> Made for {friends.join(" & ")} · from {fromParam}</div>
      </footer>

      <style>{`
        @keyframes flicker { from { transform: translateY(-1px) scale(1); opacity: .95 } to { transform: translateY(1px) scale(1.05); opacity: 1 } }
      `}</style>
    </div>
  );
}
