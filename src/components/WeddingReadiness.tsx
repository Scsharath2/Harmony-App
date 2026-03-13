import React, { useState } from 'react';
import { motion } from 'motion/react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

const C = {
  gold: "#E8B86D",
  goldDim: "#9B7340",
  goldSoft: "rgba(232,184,109,0.13)",
  sage: "#5ECFA0",
  sky: "#60B4F0",
  violet: "#A78BFA",
  text: "#F2EDE4",
  muted: "#5C5650",
  gradGold: "linear-gradient(135deg,#E8B86D,#C4893A)",
};

function scoreFrame(s: number) {
  if (s >= 85) return { label: "Beautifully Aligned",  color: "#5ECFA0", insight: "You two are deeply in sync here. Nurture this — it's a real strength." };
  if (s >= 70) return { label: "Strongly Connected",   color: "#60B4F0", insight: "A solid foundation. Keep the conversation open and it will only deepen." };
  if (s >= 50) return { label: "Rich to Explore",      color: "#E8B86D", insight: "This is where your most rewarding pre-wedding conversations live." };
  return        { label: "Growth Opportunity",         color: "#A78BFA", insight: "Different perspectives here are a gift — this is exactly what Harmony is for." };
}

const pillars = [
  { id:"Emotional",   name:"Emotional",   icon:"💛", color:"#F0B429" },
  { id:"Conflict",    name:"Conflict",    icon:"🌊", color:"#60A5FA" },
  { id:"Financial",   name:"Financial",   icon:"🌿", color:"#34D399" },
  { id:"Family",      name:"Family",      icon:"🏡", color:"#A78BFA" },
  { id:"Life Vision", name:"Life Vision", icon:"🌅", color:"#38BDF8" },
  { id:"Parenting",   name:"Parenting",   icon:"🌱", color:"#FB923C" },
  { id:"Intimacy",    name:"Intimacy",    icon:"🕯️", color:"#F472B6" },
  { id:"Lifestyle",   name:"Lifestyle",   icon:"☀️", color:"#A3E635" },
];

export function WeddingReadiness({ scores, nameA, nameB }: { scores: Record<string, number>, nameA: string, nameB: string }) {
  const values = Object.values(scores);
  const overall = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const strengths = sorted.slice(0, 3);
  const conversations = sorted.slice(-3);

  const data = [{ name: 'Overall', value: overall, fill: '#E8B86D' }];

  const readinessLabel = overall >= 85 ? "Beautifully Ready" : overall >= 70 ? "Wonderfully Prepared" : overall >= 50 ? "Lovingly Growing" : "Just Beginning";
  const readinessMsg = overall >= 85
    ? "You two have done the rare and beautiful work of genuinely knowing each other. Walk toward your wedding day with confidence."
    : overall >= 70
    ? "You have a strong, honest foundation. A few meaningful conversations will make your wedding day even more grounded."
    : overall >= 50
    ? "Every couple starts somewhere. You've taken the most courageous step — choosing to understand each other before the big day."
    : "The fact that you're here, doing this together, already says everything about the marriage you're building.";

  return (
    <div className="space-y-8">
      <div className="text-center p-10 bg-gradient-to-br from-[#E8B86D]/10 to-[#A78BFA]/10 border border-[#E8B86D]/30 rounded-[2.5rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[#E8B86D]/10 blur-[60px] rounded-full pointer-events-none"></div>
        <div className="text-[9px] tracking-[0.4em] text-[#5C5650] uppercase mb-4">Wedding Readiness</div>
        
        <div className="relative w-48 h-48 mx-auto mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart 
              cx="50%" 
              cy="50%" 
              innerRadius="70%" 
              outerRadius="100%" 
              barSize={10} 
              data={data} 
              startAngle={90} 
              endAngle={450}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                background
                dataKey="value"
                cornerRadius={30}
                fill="#E8B86D"
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-serif font-bold bg-gradient-to-br from-[#E8B86D] to-[#C4893A] bg-clip-text text-transparent">
              {overall}<span className="text-xl">%</span>
            </div>
          </div>
        </div>

        <div className="text-2xl font-serif italic text-[#F2EDE4] mb-4">{readinessLabel}</div>
        <p className="text-xs text-[#5C5650] leading-relaxed max-w-[300px] mx-auto">{readinessMsg}</p>
      </div>

      <div className="space-y-4">
        <div className="text-[9px] tracking-[0.3em] text-[#5ECFA0] uppercase mb-4">✨ Your Shared Strengths</div>
        {strengths.map(([id, s]) => {
          const p = pillars.find(pl => pl.id === id);
          const f = scoreFrame(s);
          return (
            <motion.div 
              key={id} 
              whileHover={{ x: 4 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-br from-[#5ECFA0]/10 to-[#5ECFA0]/5 border border-[#5ECFA0]/20 rounded-2xl"
            >
              <div className="w-10 h-10 rounded-xl bg-[#5ECFA0]/20 border border-[#5ECFA0]/30 flex items-center justify-center text-xl shrink-0">{p?.icon}</div>
              <div className="flex-1">
                <div className="text-xs font-bold text-[#5ECFA0]">{p?.name}</div>
                <div className="text-[10px] text-[#5C5650] mt-1 leading-relaxed">{f.insight}</div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-lg font-bold text-[#5ECFA0]">{s}</div>
                <div className="text-[9px] text-[#5C5650]">%</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="text-[9px] tracking-[0.3em] text-[#E8B86D] uppercase mb-4">💬 Conversations to Have</div>
        {conversations.map(([id, s]) => {
          const p = pillars.find(pl => pl.id === id);
          return (
            <motion.div 
              key={id} 
              whileHover={{ x: 4 }}
              className="flex items-center gap-4 p-4 bg-gradient-to-br from-[#E8B86D]/10 to-[#E8B86D]/5 border border-[#E8B86D]/20 rounded-2xl"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E8B86D]/20 border border-[#E8B86D]/30 flex items-center justify-center text-xl shrink-0">{p?.icon}</div>
              <div className="flex-1">
                <div className="text-xs font-bold text-[#E8B86D]">{p?.name}</div>
                <div className="text-[10px] text-[#5C5650] mt-1 leading-relaxed">Your richest pre-wedding conversation — couples who explore this early build the deepest foundations.</div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-lg font-bold text-[#E8B86D]">{s}</div>
                <div className="text-[9px] text-[#5C5650]">%</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
