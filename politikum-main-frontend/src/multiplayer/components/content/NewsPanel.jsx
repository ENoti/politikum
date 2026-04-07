import React, { useEffect, useState } from 'react';
import { SERVER } from '../../api.js';

function renderBasicMarkdown(md) {
  const text = String(md || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const out = [];
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul-${out.length}`} className="list-disc ml-5 space-y-1">
        {list.map((li, i) => <li key={i}>{li}</li>)}
      </ul>
    );
    list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      list.push(m[1]);
      continue;
    }
    flushList();
    if (/^\s*#\s+/.test(l)) {
      out.push(<div key={i} className="text-amber-50 font-black text-base">{l.replace(/^\s*#\s+/, '')}</div>);
    } else if (/^\s*##\s+/.test(l)) {
      out.push(<div key={i} className="text-amber-100/90 font-black text-sm">{l.replace(/^\s*##\s+/, '')}</div>);
    } else if (!String(l || '').trim()) {
      out.push(<div key={i} className="h-2" />);
    } else {
      out.push(<div key={i} className="whitespace-pre-wrap">{l}</div>);
    }
  }
  flushList();
  return out;
}

function NewsPanel() {
  const [md, setMd] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${SERVER}/public/news`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !json?.ok) throw new Error(`HTTP ${res.status}`);
        setMd(String(json.markdown || ''));
        setErr('');
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="bg-black/60 backdrop-blur-md p-6 rounded-3xl border border-amber-900/20 shadow-2xl max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-widest text-amber-500/70 font-black">News</div>
        {/* server url hidden */}
      </div>
      {err && (
        <div className="mt-3 text-xs font-mono text-red-300">news error: {err}</div>
      )}
      <div className="mt-3 text-amber-100/80 font-serif text-sm space-y-2">
        {renderBasicMarkdown(md)}
      </div>
      {/* edit hint removed */}
    </div>
  );
}

export default NewsPanel;
