"use client";

import React, { useState, useRef, useEffect } from 'react';
import { User, Settings, HelpCircle, LogOut, LayoutDashboard } from 'lucide-react';
import { signOut } from "@/lib/auth-client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountMenu = ({ isOpen, onClose }: AccountMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    await signOut();
    router.push('/');
    onClose();
  };

  return (
    <div 
      ref={menuRef}
      className="absolute right-0 mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black/5 p-1 text-sm z-50 animate-in fade-in-0 zoom-in-95"
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="account-menu-button"
    >
      <Link
        href="/dashboard"
        className="interactive w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-3 text-gray-700 hover:text-gray-900"
        onClick={onClose}
        role="menuitem"
      >
        <LayoutDashboard size={16} className="text-gray-400" />
        Dashboard
      </Link>
      
      <div className="my-1 h-px bg-gray-200" role="separator"></div>
      
      <Link
        href="/dashboard/settings"
        className="interactive w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-3 text-gray-700 hover:text-gray-900"
        onClick={onClose}
        role="menuitem"
      >
        <User size={16} className="text-gray-400" />
        Profile
      </Link>
      
      <Link
        href="/dashboard/settings"
        className="interactive w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-3 text-gray-700 hover:text-gray-900"
        onClick={onClose}
        role="menuitem"
      >
        <Settings size={16} className="text-gray-400" />
        Account Settings
      </Link>
      
      {isAdmin && (
        <Link
          href="/admin"
          className="interactive w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-3 text-gray-700 hover:text-gray-900"
          onClick={onClose}
          role="menuitem"
        >
          <User size={16} className="text-gray-400" />
          Admin Panel
        </Link>
      )}
      
      <button
        className="interactive w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-3 text-gray-700 hover:text-gray-900"
        onClick={onClose}
        role="menuitem"
      >
        <HelpCircle size={16} className="text-gray-400" />
        Help & Support
      </button>
      
      <div className="my-1 h-px bg-gray-200" role="separator"></div>
      
      <button
        className="interactive w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-red-600 hover:text-red-700 flex items-center gap-3"
        onClick={handleLogout}
        role="menuitem"
      >
        <LogOut size={16} className="text-red-400" />
        Log Out
      </button>
    </div>
  );
};

