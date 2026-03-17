import React, { useState, useEffect } from 'react';
import IntelligenceBrief from '../components/IntelligenceBrief';

const NewsPage: React.FC = () => {
  return (
    <div className="p-4 md:p-6">
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">📡 News</h1>
          <p className="text-slate-400 mt-1 text-xs md:text-sm">Daily AI & tech intelligence brief &bull; Auto-updates every day</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ring-1 bg-emerald-500/10 text-emerald-400 ring-emerald-500/20">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Live
        </span>
      </div>
      <IntelligenceBrief />
    </div>
  );
};

export default NewsPage;
