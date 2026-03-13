import React from 'react';
import { motion } from 'motion/react';

export function GlassCard({ children, className = "", delay = 0, ...props }: { children: React.ReactNode, className?: string, delay?: number } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.6, 
        delay, 
        ease: [0.22, 1, 0.36, 1] 
      }}
      className={`bg-[#10101C]/60 backdrop-blur-xl border border-white/5 rounded-[2.5rem] overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
