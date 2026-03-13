import React from 'react';
import { motion } from 'motion/react';
import { MessageSquare, Sparkles, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function PillarComparisonChart({ scores }: { scores: Record<string, number> }) {
  const data = Object.entries(scores).map(([name, value]) => ({
    name,
    value,
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[#E8B86D]/10 p-2 rounded-lg border border-[#E8B86D]/20">
          <BarChart3 className="w-4 h-4 text-[#E8B86D]" />
        </div>
        <h3 className="text-sm font-serif italic text-[#F2EDE4]">Alignment Breakdown</h3>
      </div>
      <div className="w-full h-[240px] bg-white/5 border border-white/5 rounded-[2rem] p-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: -20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              tick={{ fill: '#5C5650', fontSize: 10, fontWeight: 600 }}
              width={80}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              contentStyle={{ backgroundColor: '#10101C', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ color: '#E8B86D', fontSize: '12px' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.value >= 70 ? '#5ECFA0' : entry.value >= 40 ? '#E8B86D' : '#F08080'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function TalkCards({ prompts }: { prompts: string[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[#E8B86D]/10 p-2 rounded-lg border border-[#E8B86D]/20">
          <MessageSquare className="w-4 h-4 text-[#E8B86D]" />
        </div>
        <h3 className="text-sm font-serif italic text-[#F2EDE4]">Guided Conversations</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {prompts.map((p, i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.01, x: 4 }}
            className="p-6 bg-white/5 border border-white/5 rounded-2xl relative group cursor-pointer"
          >
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E8B86D] opacity-20 group-hover:opacity-100 transition-opacity rounded-l-2xl"></div>
            <p className="text-sm text-[#F2EDE4] leading-relaxed italic">"{p}"</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AICoach({ summary }: { summary: string }) {
  return (
    <div className="p-8 bg-gradient-to-br from-[#10101C] to-[#08070F] border border-white/5 rounded-[2.5rem] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#E8B86D]/5 blur-[60px] rounded-full pointer-events-none"></div>
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-[#E8B86D]/10 p-2 rounded-lg border border-[#E8B86D]/20">
          <Sparkles className="w-4 h-4 text-[#E8B86D]" />
        </div>
        <h3 className="text-sm font-serif italic text-[#F2EDE4]">Harmony AI Coach</h3>
      </div>
      <p className="text-lg text-[#F2EDE4] font-serif italic leading-relaxed opacity-90">
        "{summary}"
      </p>
      <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
        <div className="text-[9px] text-[#5C5650] uppercase tracking-widest">Personalized for your journey</div>
        <div className="text-[9px] text-[#E8B86D] uppercase tracking-widest font-bold">Read Full Analysis</div>
      </div>
    </div>
  );
}

export function PillarInsights({ pillars }: { pillars: { name: string; score: number; insight: string }[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-[#E8B86D]/10 p-2 rounded-lg border border-[#E8B86D]/20">
          <Sparkles className="w-4 h-4 text-[#E8B86D]" />
        </div>
        <h3 className="text-sm font-serif italic text-[#F2EDE4]">Pillar Deep Dive</h3>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {pillars.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white/5 border border-white/5 rounded-[2rem] relative overflow-hidden group"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[#F2EDE4] uppercase tracking-widest">{p.name}</h4>
              <div className="text-lg font-serif italic text-[#E8B86D]">{p.score}%</div>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full mb-4 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${p.score}%` }}
                className="h-full bg-gradient-to-r from-[#E8B86D] to-[#C4893A]"
              />
            </div>
            <p className="text-sm text-[#5C5650] leading-relaxed italic">
              {p.insight}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
