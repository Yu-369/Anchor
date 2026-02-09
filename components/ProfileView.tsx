
import React from 'react';
import { Place } from '../types';

export const ProfileView: React.FC<{ places: Place[] }> = ({ places }) => {
  // User requested to remove the explorer/account section.
  // We will keep this view minimal for now, serving as an "About" or "Settings" placeholder.
  
  return (
    <div className="h-full w-full bg-black text-white p-8 pt-20 flex flex-col">
      <h1 className="text-3xl font-title mb-8">Settings</h1>
      
      <div className="space-y-4">
        <div className="bg-[#1A1C1E] p-6 rounded-[24px] border border-white/5 flex items-center justify-between">
           <span className="font-medium text-lg">Location Accuracy</span>
           <span className="text-[#D4FF3F] font-bold">High</span>
        </div>

        <div className="bg-[#1A1C1E] p-6 rounded-[24px] border border-white/5 flex items-center justify-between">
           <span className="font-medium text-lg">Notifications</span>
           <div className="w-12 h-6 bg-zinc-700 rounded-full relative">
              <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
           </div>
        </div>

        <div className="bg-[#1A1C1E] p-6 rounded-[24px] border border-white/5 flex items-center justify-between">
           <span className="font-medium text-lg">Clear History</span>
           <button className="text-red-400 font-bold uppercase text-sm">Action</button>
        </div>
      </div>

      <div className="mt-auto mb-32 text-center">
         <p className="text-zinc-600 text-sm">Anchor v1.2.0</p>
      </div>
    </div>
  );
};
