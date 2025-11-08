"use client";

import React, { useState } from 'react';
import { useSession } from "@/lib/auth-client";
import { AccountMenu } from './account-menu';
import { MobileAccountMenu } from './mobile-account-menu';
import Link from 'next/link';

export const TopNavigation = () => {
  const { data: session } = useSession();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  // Get user display name
  const displayName = session?.user?.name || 
                     session?.user?.email?.split('@')[0] || 
                     'Author';

  // Get user initials for avatar
  const getInitials = () => {
    if (session?.user?.name) {
      const names = session.user.name.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return session.user.name.substring(0, 2).toUpperCase();
    }
    if (session?.user?.email) {
      return session.user.email.substring(0, 2).toUpperCase();
    }
    return 'AU';
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 md:bg-white/95 md:backdrop-blur-md" style={{ boxShadow: 'var(--shadow-mobile-card)' }}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 md:h-[68px] flex items-center justify-between gap-3 md:gap-6">
        {/* Left: Brand + Future Nav */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/" className="w-6 h-6 text-amber-500 interactive hover:scale-[1.03]">
            <img src="/logo256.png" alt="Get Lost Logo" className="w-6 h-6" />
          </Link>
          <div className="flex items-center gap-3 pr-4">
            <h1 className="text-base md:text-lg font-semibold tracking-tight text-gray-900 leading-none">
              <span className="md:hidden">Get Lost</span>
              <span className="hidden md:inline">Get Lost Author Dashboard</span>
            </h1>
            {/* Optional divider for future nav */}
            <span className="hidden md:inline-block h-5 w-px bg-gray-200"></span>
            {/* Author name */}
            <span 
              className="hidden md:inline-block max-w-[22ch] truncate text-sm text-gray-600 leading-none" 
              aria-label={`Signed in as ${displayName}`}
            >
              {displayName}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* User Avatar with Menu */}
          <div className="relative">
            <button 
              className="interactive relative w-9 h-9 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden ring-1 ring-gray-200 hover:ring-emerald-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-500 transition-all duration-300"
              style={{ boxShadow: isAccountMenuOpen ? 'var(--glow-focus-ring)' : 'var(--shadow-sm)' }}
              aria-label="Account menu"
              onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
              id="account-menu-button"
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="true"
            >
              <span className="absolute inset-0 grid place-items-center text-sm font-semibold text-gray-700">{getInitials()}</span>
            </button>
            
            {/* Desktop/Tablet Account Menu */}
            <div className="hidden md:block">
              <AccountMenu 
                isOpen={isAccountMenuOpen} 
                onClose={() => setIsAccountMenuOpen(false)} 
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Account Menu */}
      <div className="md:hidden">
        <MobileAccountMenu 
          isOpen={isAccountMenuOpen} 
          onClose={() => setIsAccountMenuOpen(false)} 
        />
      </div>
    </header>
  );
};

