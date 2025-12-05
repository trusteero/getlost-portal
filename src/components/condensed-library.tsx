"use client";

import React from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';

interface ProgressStep {
  id: string;
  status: 'complete' | 'locked' | 'processing';
}

interface CondensedManuscript {
  id: string;
  title: string;
  coverImage: string;
  genre: string;
  steps: ProgressStep[];
  isSample?: boolean;
}

interface CondensedLibraryProps {
  manuscripts: CondensedManuscript[];
  activeManuscriptId?: string;
}

function MiniTracker({ steps }: { steps: ProgressStep[] }) {
  const unlockedCount = steps.filter(step => step.status === 'complete').length;
  const totalSteps = steps.length;

  return (
    <div className="flex flex-col gap-1">
      {/* Progress dots */}
      <div className="flex gap-1.5 items-center">
        {steps.slice(0, 5).map((step, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              step.status === 'complete'
                ? 'bg-emerald-500'
                : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
      {/* Status text */}
      <div className="text-xs text-gray-500 font-normal">
        {unlockedCount} of {totalSteps} unlocked
      </div>
    </div>
  );
}

export function CondensedLibrary({ 
  manuscripts, 
  activeManuscriptId 
}: CondensedLibraryProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold text-gray-900 tracking-wide">Your manuscripts</h2>
      
      <div className="relative">
        {/* Scrollable manuscripts container */}
        <div className="flex gap-3 overflow-x-auto snap-x pb-2 scroll-smooth no-scrollbar">
          {manuscripts.map((manuscript) => {
            const unlockedSteps = manuscript.steps.filter(step => step.status === 'complete');
            const statusLabel = `${manuscript.title}: ${unlockedSteps.length} of ${manuscript.steps.length} stages completed`;
            
            return (
              <button
                key={manuscript.id}
                onClick={() => {
                  // Scroll to detailed card
                  const element = document.getElementById(`detail-${manuscript.id}`);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                aria-controls={`detail-${manuscript.id}`}
                aria-label={statusLabel}
                className={`snap-start min-w-[14rem] flex items-center gap-3 p-3 premium-card rounded-xl border-0 text-left transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-emerald-500 group ${
                  activeManuscriptId === manuscript.id 
                    ? 'premium-card-active shadow-lg' 
                    : 'hover:shadow-lg'
                }`}
              >
                {/* Small Cover - Mobile: Flat, Desktop: 3D */}
                <div className="w-16 h-20 rounded-lg book-glow-panel overflow-hidden flex-shrink-0 transition-all duration-400 group-hover:shadow-lg relative">
                  {/* Mobile: Simple flat cover */}
                  <div className="md:hidden relative h-full">
                    <img
                      src={manuscript.coverImage}
                      alt={manuscript.title}
                      loading="lazy"
                      className="w-full h-20 object-cover rounded-lg border border-gray-200"
                      style={{ boxShadow: 'var(--shadow-mobile-cover)' }}
                    />
                    {/* Sample report label on cover */}
                    {manuscript.isSample && (
                      <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-[8px] font-bold py-0.5 px-1 text-center rounded-t-lg shadow-md uppercase">
                        SAMPLE
                      </div>
                    )}
                  </div>
                  
                  {/* Desktop: 3D enhanced cover */}
                  <div className="hidden md:block relative h-full">
                    <div className="perspective-1000 h-full">
                      <div 
                        className="h-full relative transform rotate-y-12 transition-all duration-400 group-hover:rotate-y-6 rounded-lg"
                        style={{ boxShadow: 'var(--shadow-sm)' }}
                      >
                        <img
                          src={manuscript.coverImage}
                          alt={manuscript.title}
                          loading="lazy"
                          className="w-full h-20 object-cover rounded-lg transition-all duration-400"
                        />
                        {/* Sample report label on cover */}
                        {manuscript.isSample && (
                          <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-[8px] font-bold py-0.5 px-1 text-center rounded-t-lg shadow-md z-10 uppercase">
                            SAMPLE
                          </div>
                        )}
                        {/* Enhanced 3D spine for small covers */}
                        <div 
                          className="absolute inset-y-0 left-0 w-1 rounded-l-lg transition-all duration-400"
                          style={{ background: 'var(--gradient-book-spine)' }}
                        ></div>
                        {/* Spine highlight */}
                        <div className="absolute top-1 bottom-1 left-0 w-px bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                    {/* Enhanced background glow for hero effect - Desktop only */}
                    <div 
                      className="absolute -inset-1 rounded-xl -z-10 opacity-80 group-hover:opacity-100 transition-opacity duration-400"
                      style={{ background: 'var(--gradient-book-panel)' }}
                    ></div>
                  </div>
                </div>

                {/* Title and Progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-base font-bold text-gray-900 truncate">
                      {manuscript.title}
                    </div>
                    {manuscript.isSample && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 shrink-0">
                        Sample
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 font-normal mb-2">
                    {manuscript.genre.replace(/^[A-Z]+\d+\s*/, '')}
                  </div>
                  <MiniTracker steps={manuscript.steps} />
                </div>
              </button>
            );
          })}
          
          {/* "+" button as the last item in the scrollable area */}
          <button
            onClick={() => {
              // Trigger upload modal - this will be handled by parent component
              const event = new CustomEvent('openUploadModal');
              window.dispatchEvent(event);
            }}
            className="flex-shrink-0 self-stretch w-16 rounded-xl premium-card flex items-center justify-center transition-all duration-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 group"
            aria-label="Add new manuscript"
          >
            <Plus className="w-8 h-8 text-emerald-500 transition-transform duration-300 group-hover:scale-110" />
          </button>
        </div>
      </div>
    </section>
  );
}

