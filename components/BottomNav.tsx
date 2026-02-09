
import React from 'react';
import { motion } from 'framer-motion';
import { AppView } from '../types';

interface BottomNavProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  onAdd: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onViewChange, onAdd }) => {
  const navItems = [
    { id: 'dashboard', icon: 'home', label: 'Home' },
    { id: 'timeline', icon: 'map', label: 'Map' },
    { id: 'ar', icon: 'view_in_ar', label: 'AR' }
  ];

  return (
    <div className="fixed bottom-8 left-0 right-0 z-50 flex items-end justify-center px-4 pointer-events-none gap-4">
      {/* Navigation Pill - 3 Items */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#2f3033]/90 backdrop-blur-xl h-20 rounded-full px-6 flex items-center justify-between gap-6 pointer-events-auto shadow-[0_8px_32px_rgba(0,0,0,0.3)] border border-white/5"
      >
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id as AppView)}
              className="relative flex flex-col items-center justify-center w-12 h-12 group"
            >
              <span 
                className={`material-symbols-outlined text-[28px] transition-colors duration-300 ${isActive ? 'text-[#D4FF3F]' : 'text-zinc-400 group-hover:text-white'}`}
                style={{ fontVariationSettings: `'FILL' ${isActive ? 1 : 0}, 'wght' 400` }}
              >
                {item.icon}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="nav-dot"
                  className="absolute -bottom-1 w-1 h-1 bg-[#D4FF3F] rounded-full"
                />
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Floating Action Button (Squircle) - Replaced Blue with Lime */}
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.92 }}
        onClick={onAdd}
        className="w-20 h-20 bg-[#D4FF3F] text-black rounded-[24px] flex items-center justify-center pointer-events-auto shadow-[0_8px_24px_rgba(212,255,63,0.2)] hover:bg-[#bfff00] transition-colors"
      >
        <span className="material-symbols-outlined text-[36px]">add</span>
      </motion.button>
    </div>
  );
};
