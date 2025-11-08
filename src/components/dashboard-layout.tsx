"use client";

import { TopNavigation } from "./top-navigation";

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