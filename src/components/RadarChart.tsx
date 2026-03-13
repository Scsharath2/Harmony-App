import React from 'react';
import { Radar, RadarChart as ReRadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

const pillars = [
  { id: "Emotional", name: "Emotional" },
  { id: "Conflict", name: "Conflict" },
  { id: "Financial", name: "Financial" },
  { id: "Family", name: "Family" },
  { id: "Life Vision", name: "Life Vision" },
  { id: "Parenting", name: "Parenting" },
  { id: "Intimacy", name: "Intimacy" },
  { id: "Lifestyle", name: "Lifestyle" },
];

export function RadarChart({ scores }: { scores: Record<string, number> }) {
  const data = pillars
    .filter(p => scores[p.id] !== undefined)
    .map(p => ({
      subject: p.name,
      A: scores[p.id],
      fullMark: 100,
    }));

  if (data.length < 3) {
    return (
      <div className="text-center p-6 font-sans text-[11px] text-[#5C5650]">
        Complete more pillars to reveal your Compatibility DNA
      </div>
    );
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ReRadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="rgba(255,255,255,0.05)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#5C5650', fontSize: 10, fontWeight: 500 }}
          />
          <Radar
            name="Compatibility"
            dataKey="A"
            stroke="#E8B86D"
            fill="#E8B86D"
            fillOpacity={0.3}
          />
        </ReRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
