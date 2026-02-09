import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'lime' | 'glass' | 'black' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'black', 
  icon,
  className = '',
  ...props 
}) => {
  const tapAnimation = { scale: 0.92 };
  
  const baseStyles = "inline-flex items-center justify-center font-bold transition-all duration-300 rounded-full select-none";
  
  const variants = {
    lime: "bg-[#D4FF3F] text-black shadow-lg hover:shadow-[#D4FF3F]/40",
    black: "bg-black text-white hover:bg-zinc-800 shadow-md",
    glass: "bg-white/80 backdrop-blur-md text-black border border-black/5",
    ghost: "bg-transparent text-black hover:bg-black/5"
  };

  return (
    <motion.button 
      whileTap={tapAnimation}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props as any}
    >
      {icon && <span>{icon}</span>}
      {children && <span className={icon ? "ml-2" : ""}>{children}</span>}
    </motion.button>
  );
};

export const BubbleGroup: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
  <div className={`flex items-center bg-black/5 backdrop-blur-md rounded-full p-1 gap-1 ${className}`}>
    {children}
  </div>
);