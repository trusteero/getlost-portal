"use client";

import dynamic from 'next/dynamic';

// Dynamically import TopNavigation with SSR disabled to avoid React initialization issues
const TopNavigation = dynamic(
  () => import('./top-navigation').then(mod => ({ default: mod.TopNavigation })),
  { 
    ssr: false,
    loading: () => (
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 md:bg-white/95 md:backdrop-blur-md" style={{ boxShadow: 'var(--shadow-mobile-card)' }}>
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-[68px] flex items-center justify-between gap-3 md:gap-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </header>
    )
  }
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative bg-white md:bg-transparent" style={{ background: 'var(--background-mobile-page)' }}>
      {/* Premium background overlay for added depth - Desktop only */}
      <div 
        className="absolute inset-0 pointer-events-none hidden md:block" 
        style={{ background: 'var(--gradient-page)' }}
      ></div>
      <div 
        className="absolute inset-0 pointer-events-none hidden md:block" 
        style={{ background: 'var(--gradient-page-overlay)' }}
      ></div>
      
      <div className="relative z-10">
        <TopNavigation />
        
        <div 
          className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-8 relative bg-white md:bg-transparent" 
          style={{ background: 'var(--background-mobile-dashboard)' }}
        >
          {/* Dashboard content overlay for premium layering - Desktop only */}
          <div 
            className="absolute inset-0 pointer-events-none rounded-t-3xl hidden md:block" 
            style={{ background: 'var(--gradient-dashboard)' }}
          ></div>
          <div 
            className="absolute inset-0 pointer-events-none rounded-t-3xl hidden md:block" 
            style={{ background: 'var(--gradient-dashboard-overlay)' }}
          ></div>
          
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}