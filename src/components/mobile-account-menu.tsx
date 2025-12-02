"use client";

import React, { useRef, useEffect, useState } from 'react';
import { User, Settings, HelpCircle, LogOut, X, LayoutDashboard } from 'lucide-react';
import { signOut } from "@/lib/auth-client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface MobileAccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileAccountMenu = ({ isOpen, onClose }: MobileAccountMenuProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const response = await fetch("/api/admin/check");
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
      }
    };

    checkAdminStatus();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
      // Continue with redirect even if signOut fails
    }
    onClose();
    // Always redirect after sign out attempt
    router.push('/');
    // Force a hard reload to ensure session is cleared
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
      onClick={(e) => {
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <div className="absolute top-0 right-0 w-full max-w-sm bg-white shadow-xl animate-in slide-in-from-right">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Account</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-2">
          <Link
            href="/dashboard"
            className="interactive w-full text-left p-4 rounded-lg hover:bg-gray-50 flex items-center gap-4 text-gray-700 hover:text-gray-900"
            onClick={onClose}
          >
            <LayoutDashboard size={20} className="text-gray-400" />
            <span className="text-base font-medium">Dashboard</span>
          </Link>
          
          <div className="my-2 h-px bg-gray-200" />
          
          <Link
            href="/dashboard/settings"
            className="interactive w-full text-left p-4 rounded-lg hover:bg-gray-50 flex items-center gap-4 text-gray-700 hover:text-gray-900"
            onClick={onClose}
          >
            <User size={20} className="text-gray-400" />
            <span className="text-base font-medium">Profile</span>
          </Link>
          
          <Link
            href="/dashboard/settings"
            className="interactive w-full text-left p-4 rounded-lg hover:bg-gray-50 flex items-center gap-4 text-gray-700 hover:text-gray-900"
            onClick={onClose}
          >
            <Settings size={20} className="text-gray-400" />
            <span className="text-base font-medium">Account Settings</span>
          </Link>
          
          {isAdmin && (
            <Link
              href="/admin"
              className="interactive w-full text-left p-4 rounded-lg hover:bg-gray-50 flex items-center gap-4 text-gray-700 hover:text-gray-900"
              onClick={onClose}
            >
              <User size={20} className="text-gray-400" />
              <span className="text-base font-medium">Admin Panel</span>
            </Link>
          )}
          
          <button
            className="interactive w-full text-left p-4 rounded-lg hover:bg-gray-50 flex items-center gap-4 text-gray-700 hover:text-gray-900"
            onClick={onClose}
          >
            <HelpCircle size={20} className="text-gray-400" />
            <span className="text-base font-medium">Help & Support</span>
          </button>
          
          <div className="my-2 h-px bg-gray-200" />
          
          <button
            className="interactive w-full text-left p-4 rounded-lg hover:bg-gray-50 text-red-600 hover:text-red-700 flex items-center gap-4"
            onClick={handleLogout}
          >
            <LogOut size={20} className="text-red-400" />
            <span className="text-base font-medium">Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

