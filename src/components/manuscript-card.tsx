"use client";

import { Check, Lock, MoreVertical, Download, Eye, Trash2, Loader2, CreditCard, X } from "lucide-react";
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProgressStep {
  id: string;
  title: string;
  status: 'complete' | 'locked' | 'processing';
  action: string;
  price: string | null;
  buttonText: string;
}

interface ManuscriptCardProps {
  id: string;
  title: string;
  subtitle: string;
  wordCount: string | null;
  genre: string | null;
  steps: ProgressStep[];
  coverImage: string;
  hasPrecannedContent?: boolean;
  manuscriptStatus?: "queued" | "working_on" | "ready_to_purchase";
  hasViewedReport?: boolean;
  isSample?: boolean;
  onDelete?: () => void;
}

export const ManuscriptCard = ({ 
  id,
  title,
  subtitle, 
  wordCount, 
  genre, 
  steps, 
  coverImage,
  hasPrecannedContent = false,
  manuscriptStatus = "queued",
  hasViewedReport = false,
  isSample = false,
  onDelete
}: ManuscriptCardProps) => {
  const isManuscriptReady = manuscriptStatus === "ready_to_purchase";
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unlockingFeature, setUnlockingFeature] = useState<string | null>(null);
  const [updatedSteps, setUpdatedSteps] = useState<ProgressStep[]>(steps);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [pendingFeature, setPendingFeature] = useState<ProgressStep | null>(null);

  // Sync updatedSteps with steps prop when it changes (from parent refresh)
  useEffect(() => {
    setUpdatedSteps(steps);
  }, [steps]);

  const handleUnlockClick = (step: ProgressStep) => {
    // If it's free (summary), unlock immediately without confirmation
    if (step.price === 'Free') {
      handleUnlockFeature(step.id);
      return;
    }

    // For paid features, show confirmation dialog
    setPendingFeature(step);
    setShowPurchaseDialog(true);
  };

  const handleConfirmPurchase = async () => {
    if (!pendingFeature) return;
    
    const featureId = pendingFeature.id;
    
    // Check if this is a paid feature (not free)
    if (pendingFeature.price !== 'Free' && pendingFeature.price !== 'Unlocked') {
      try {
        // Try to create Stripe checkout session
        const checkoutResponse = await fetch('/api/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId: id,
            featureType: featureId,
          }),
        });

        if (checkoutResponse.ok) {
          // Stripe checkout available, redirect to Stripe
          const { url } = await checkoutResponse.json();
          if (url) {
            window.location.href = url;
            return;
          }
        } else if (checkoutResponse.status === 503) {
          // Stripe not configured, use simulated purchase
          const error = await checkoutResponse.json();
          if (error.useSimulated) {
            console.log('Stripe not configured, using simulated purchase');
            setShowPurchaseDialog(false);
            setPendingFeature(null);
            await handleUnlockFeature(featureId);
            return;
          }
        }
        
        // If we get here, there was an error
        const error = await checkoutResponse.json();
        throw new Error(error.error || 'Failed to create checkout session');
      } catch (error) {
        console.error('Failed to initiate payment:', error);
        alert('Failed to start payment. Please try again.');
        return;
      }
    } else {
      // Free feature, unlock directly
      setShowPurchaseDialog(false);
      setPendingFeature(null);
      await handleUnlockFeature(featureId);
    }
  };

  const handleCancelPurchase = () => {
    setShowPurchaseDialog(false);
    setPendingFeature(null);
  };

  const handleUnlockFeature = async (featureType: string) => {
    if (unlockingFeature) return; // Prevent double-clicks
    
    setUnlockingFeature(featureType);
    try {
      const response = await fetch(`/api/books/${id}/features/${featureType}`, {
        method: "POST",
      });

      if (response.status === 402) {
        // Payment required - redirect to checkout
        const error = await response.json();
        if (error.redirectToCheckout) {
          // Try to create checkout session
          try {
            const checkoutResponse = await fetch('/api/checkout/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookId: id,
                featureType: featureType,
              }),
            });

            if (checkoutResponse.ok) {
              const { url } = await checkoutResponse.json();
              if (url) {
                window.location.href = url;
                return;
              }
            }
          } catch (checkoutError) {
            console.error('Failed to create checkout session:', checkoutError);
            alert('Failed to start payment. Please try again.');
            return;
          }
        }
        throw new Error(error.error || "Payment required");
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to unlock feature");
      }

      const data = await response.json();
      
      // Update the step status locally - set to processing if asset not uploaded yet
      setUpdatedSteps(prevSteps => 
        prevSteps.map(step => 
          step.id === featureType 
            ? { ...step, status: 'processing' as const, price: 'Processing', buttonText: 'Processing...' }
            : step
        )
      );

      // Don't navigate after purchase - wait for admin to upload asset
      // Dispatch event to refresh books data immediately
      // The main dashboard polling will handle automatic updates
      window.dispatchEvent(new CustomEvent('refreshBooks'));
    } catch (error: any) {
      console.error("Failed to unlock feature:", error);
      alert(error.message || "Failed to unlock feature. Please try again.");
    } finally {
      setUnlockingFeature(null);
    }
  };

  const handleStageAction = (stepId: string, stepTitle: string) => {
    switch (stepId) {
      case 'manuscript-report':
        // Navigate to book detail page with report hash
        router.push(`/dashboard/book/${id}#report`);
        break;
      case 'marketing-assets':
        router.push(`/dashboard/book/${id}/marketing-assets`);
        break;
      case 'book-covers':
        router.push(`/dashboard/book/${id}/covers`);
        break;
      case 'landing-page':
        router.push(`/dashboard/book/${id}/landing-page`);
        break;
    }
  };

  const renderStageButton = (step: ProgressStep) => {
    if (!step.buttonText) return null;
    
    const isAvailable = step.status === 'complete';
    const isProcessing = step.status === 'processing';
    const isUnlocking = unlockingFeature === step.id;
    const isComingSoon = step.buttonText === 'Coming soon';
    
    // For manuscript-report, check if it's queued or working_on (show text without spinner)
    const isManuscriptStatus = step.id === 'manuscript-report' && 
      (step.buttonText === 'Queued' || step.buttonText === 'Working on Report');
    
    let buttonClass: string;
    if (isAvailable) {
      buttonClass = "w-full md:w-auto btn-premium-emerald text-white text-sm font-semibold px-4 py-2 rounded h-10 min-w-[120px] max-w-full whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500";
    } else if (isProcessing) {
      buttonClass = "w-full md:w-auto premium-card text-gray-500 text-sm font-medium px-4 py-2 rounded h-10 min-w-[120px] max-w-full whitespace-nowrap focus:outline-none cursor-not-allowed opacity-75";
    } else if (isComingSoon) {
      buttonClass = "w-full md:w-auto premium-card text-gray-500 text-sm font-medium px-4 py-2 rounded h-10 min-w-[120px] max-w-full whitespace-nowrap focus:outline-none cursor-not-allowed opacity-75";
    } else {
      buttonClass = "w-full md:w-auto premium-card hover:premium-card text-gray-900 text-sm font-medium px-4 py-2 rounded h-10 min-w-[120px] max-w-full whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-sapphire-500 backdrop-blur-sm";
    }
      
    return (
      <button 
        className={buttonClass}
        onClick={() => {
          if (isAvailable && !isComingSoon) {
            handleStageAction(step.id, step.title);
          } else if (!isProcessing && !isComingSoon) {
            handleUnlockClick(step);
          }
        }}
        disabled={isUnlocking || isProcessing || isComingSoon}
      >
        {isUnlocking ? (
          <>
            <Loader2 className="w-4 h-4 inline-block align-middle mr-2 animate-spin" />
            Unlocking...
          </>
        ) : isProcessing && !isManuscriptStatus ? (
          <>
            <Loader2 className="w-4 h-4 inline-block align-middle mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          step.buttonText
        )}
      </button>
    );
  };

  return (
    <section className="premium-card rounded-xl overflow-hidden border-0 group transition-all duration-300 md:hover:shadow-lg md:focus-within:shadow-lg">
      <div className="flex flex-col md:grid md:grid-cols-[320px_minmax(0,1fr)] gap-0">
        {/* Mobile: Book Cover on Top / Desktop: Left Column */}
        <aside className="book-glow-panel-large p-4 md:p-8 flex items-center justify-center min-h-[200px] md:min-h-[500px] md:sticky md:top-0 md:self-start relative overflow-hidden">
          <div className="relative mx-auto w-32 md:w-48 z-10">
            {/* Mobile: Flat cover display */}
            <div className="md:hidden relative">
              <img
                src={coverImage || "/placeholder.svg"}
                alt={title}
                loading="lazy"
                className="w-full h-auto object-contain rounded-lg border border-gray-200"
                style={{ boxShadow: 'var(--shadow-mobile-cover)' }}
                onError={(e) => {
                  console.error(`[ManuscriptCard] Failed to load cover image: ${coverImage}`);
                  console.error(`[ManuscriptCard] Error event:`, e);
                  console.error(`[ManuscriptCard] Current src: ${e.currentTarget.src}`);
                  // Fallback to placeholder
                  if (e.currentTarget.src !== '/placeholder.svg') {
                    e.currentTarget.src = '/placeholder.svg';
                  }
                }}
                onLoad={() => {
                  console.log(`[ManuscriptCard] Successfully loaded cover: ${coverImage}`);
                }}
              />
              {/* Sample report label on cover */}
              {isSample && (
                <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-[10px] font-bold py-1.5 px-2 text-center rounded-t-lg shadow-lg uppercase tracking-wide">
                  Sample Report
                </div>
              )}
              {/* Subtle precanned content indicator */}
              {hasPrecannedContent && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400/60 border border-amber-500/40 shadow-sm cursor-help" 
                           aria-label="Demo content indicator" />
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">Demo content</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {/* Desktop: 3D cover display */}
            <div className="hidden md:block perspective-1000">
              <div 
                className="max-w-52 max-h-72 relative transform rotate-y-15 transition-all duration-500 hover:rotate-y-8 rounded-xl group"
                style={{ 
                  boxShadow: 'var(--shadow-book-base)',
                  filter: 'drop-shadow(var(--shadow-inner-glow))'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-book-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-book-base)';
                }}
              >
                <img
                  src={coverImage || "/placeholder.svg"}
                  alt={title}
                  onError={(e) => {
                    console.error(`[ManuscriptCard] Failed to load cover image: ${coverImage}`);
                    console.error(`[ManuscriptCard] Error event:`, e);
                    // Fallback to placeholder
                    if (e.currentTarget.src !== '/placeholder.svg') {
                      e.currentTarget.src = '/placeholder.svg';
                    }
                  }}
                  onLoad={() => {
                    console.log(`[ManuscriptCard] Successfully loaded cover: ${coverImage}`);
                  }}
                  loading="lazy"
                  className="w-full h-auto object-contain rounded-xl transition-all duration-500"
                />
                {/* Sample report label on cover */}
                {isSample && (
                  <div className="absolute top-0 left-0 right-0 bg-blue-600 text-white text-xs font-bold py-2 px-3 text-center rounded-t-xl shadow-lg z-20 uppercase tracking-wide">
                    Sample Report
                  </div>
                )}
                {/* Subtle precanned content indicator */}
                {hasPrecannedContent && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400/60 border border-amber-500/40 shadow-sm z-10 cursor-help" 
                             aria-label="Demo content indicator" />
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">Demo content</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {/* Enhanced 3D spine */}
                <div 
                  className="absolute inset-y-0 left-0 w-3 rounded-l-xl transition-all duration-500"
                  style={{ background: 'var(--gradient-book-spine)' }}
                ></div>
                <div className="absolute top-2 bottom-2 left-0 w-px bg-white/20 rounded-full"></div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-transparent to-white/5 pointer-events-none"></div>
                
                {/* Enhanced glow background panel */}
                <div 
                  className="absolute -inset-4 rounded-2xl -z-10 transition-all duration-500 group-hover:scale-105"
                  style={{ background: 'var(--gradient-book-panel-large)' }}
                ></div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile: Content Below / Desktop: Right Column */}
        <div className="flex-1 p-4 md:p-6 relative md:border-l md:border-gray-100">
          {/* Three-dot menu */}
          <div className="absolute top-4 md:top-6 right-4 md:right-6">
            <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button 
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  role="button"
                  aria-label="More options"
                >
                  <MoreVertical className="w-4 h-4 text-gray-500 inline-block align-middle" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-56 rounded-lg bg-white shadow-lg ring-1 ring-black/5 p-1"
                role="menu"
              >
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/dashboard/book/${id}`);
                    setIsMenuOpen(false);
                  }} 
                  className="h-9 px-3 hover:bg-gray-50 focus:bg-gray-50 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                  role="menuitem"
                >
                  <Eye className="w-4 h-4 mr-3 inline-block align-middle" />
                  View Details
                </DropdownMenuItem>
                
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => {
                      onDelete();
                      setIsMenuOpen(false);
                    }}
                    className="h-9 px-3 text-red-600 hover:bg-red-50 focus:bg-red-50 focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
                    role="menuitem"
                  >
                    <Trash2 className="w-4 h-4 mr-3 inline-block align-middle" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col gap-4">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
                {isSample && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Sample report
                  </span>
                )}
              </div>
              <p className="text-base text-gray-600 font-medium mb-1">{subtitle}</p>
              {(wordCount || genre) && (
                <p className="text-sm text-gray-500 leading-relaxed">
                  {wordCount ? wordCount : ''}
                  {wordCount && genre ? ' • ' : ''}
                  {genre ? genre.replace(/^[A-Z]+\d+\s*/, '') : ''}
                </p>
              )}
            </div>

            {/* Enhanced Progress Tracker - Mobile: Horizontal Scroll, Desktop: 5 Column Grid */}
            <div className="tracker relative mt-4 mb-6">
              {/* Mobile: Horizontal scrollable tracker */}
              <div className="md:hidden relative">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-200 z-0 rounded-full"></div>
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-emerald-500 z-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${(updatedSteps.slice(0, 5).filter(step => step.status === 'complete').length / Math.max(updatedSteps.slice(0, 5).length - 1, 1)) * 100}%`
                  }}
                ></div>

                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-20"></div>
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-20"></div>

                <div
                  className="flex gap-8 overflow-x-auto no-scrollbar snap-x snap-mandatory px-6 pb-1 z-10 scroll-smooth"
                  role="tablist"
                  aria-label="Progress steps"
                >
                  {updatedSteps.slice(0, 5).map((step) => (
                    <button
                      key={step.id}
                      className={`snap-center shrink-0 relative z-10 h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300 ${
                        step.status === 'complete' 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                      role="tab"
                      aria-selected={step.status === 'complete'}
                      title={step.title}
                    >
                      {step.status === 'complete' && <Check className="w-3 h-3 inline-block align-middle mr-1" />}
                      {step.status === 'locked' && <Lock className="w-3 h-3 inline-block align-middle mr-1" />}
                      <span>{step.title}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop/Tablet: Grid-aligned tracker */}
              <div className="hidden md:grid md:grid-cols-5 md:gap-6 relative md:items-start">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-gray-200 z-0 rounded-full"></div>
                <div 
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-emerald-500 transition-all duration-500 z-0 rounded-full"
                  style={{
                    width: `${(updatedSteps.slice(0, 5).filter(step => step.status === 'complete').length / 5) * 100}%`,
                    boxShadow: updatedSteps.some(step => step.status === 'complete') ? 'var(--glow-progress-line)' : 'none'
                  }}
                ></div>
                
                {updatedSteps.slice(0, 5).map((step) => (
                  <div key={step.id} className="md:col-span-1 flex md:justify-center">
                    <button 
                      className={`relative z-10 flex items-center gap-1.5 h-7 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-300 ${
                        step.status === 'complete' 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-white border border-gray-300 text-gray-700'
                      }`}
                      title={step.title}
                    >
                      {step.status === 'complete' && <Check className="w-4 h-4 inline-block align-middle" />}
                      {step.status === 'locked' && <Lock className="w-4 h-4 inline-block align-middle" />}
                      <span>
                        {step.title === 'Free Summary' ? (
                          <>
                            <span className="sm:hidden">Summary</span>
                            <span className="hidden sm:inline">Free Summary</span>
                          </>
                        ) : step.title === 'Manuscript Report' ? (
                          <>
                            <span className="sm:hidden">Report</span>
                            <span className="hidden sm:inline">Manuscript Report</span>
                          </>
                        ) : step.title === 'Marketing Assets' ? (
                          <>
                            <span className="sm:hidden">Assets</span>
                            <span className="hidden sm:inline">Marketing Assets</span>
                          </>
                        ) : step.title === 'Book Covers' ? (
                          <>
                            <span className="sm:hidden">Covers</span>
                            <span className="hidden sm:inline">Book Covers</span>
                          </>
                        ) : step.title === 'Landing Page' ? (
                          <>
                            <span className="sm:hidden">Page</span>
                            <span className="hidden sm:inline">Landing Page</span>
                          </>
                        ) : (
                          step.title
                        )}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Sections Grid - Mobile: Single Column, Desktop: 5 Column Grid */}
          <div className="flex flex-col space-y-6 md:space-y-0 md:grid md:grid-cols-5 md:gap-6 items-stretch">
            {updatedSteps.slice(0, 5).map((step) => {
              // Dim other features until manuscript is ready (except manuscript-report itself)
              // Also dim summary if it's locked (no preview report uploaded)
              // Dim marketing, covers, and landing pages only if they're locked (not complete)
              const isMarketingOrCoverOrLanding = step.id === "marketing-assets" || step.id === "book-covers" || step.id === "landing-page";
              const shouldDim = (!isManuscriptReady && step.id !== "manuscript-report") || 
                                (step.id === "summary" && step.status === "locked") ||
                                (isMarketingOrCoverOrLanding && step.status === "locked"); // Only dim if locked, not if complete
              return (
              <div 
                key={step.id} 
                className={`flex flex-col items-start justify-start h-full text-left transition-opacity ${
                  shouldDim ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                {/* Top Section */}
                <div className="w-full">
                  <h3 className="text-base font-semibold text-gray-900 tracking-wide leading-6 min-h-[24px]">{step.title}</h3>
                  
                  <div className="text-sm text-gray-600 leading-6 break-words min-h-[72px]">
                    {step.action && (
                      <p className={step.id === "manuscript-report" ? "" : "line-clamp-3"}>{step.action}</p>
                    )}
                  </div>
                </div>
                
                {/* Bottom Section - Aligned */}
                <div className="mt-auto flex flex-col gap-2 w-full">
                  {/* Price/Status */}
                  {step.price === 'Free' ? (
                    <span className="mt-4 text-sm font-semibold text-emerald-600 leading-5">Free</span>
                  ) : step.price === 'Unlocked' ? (
                    <span className="mt-4 text-sm font-semibold text-emerald-600 leading-5">Unlocked</span>
                  ) : step.price && (
                    <span className="mt-4 text-emerald-600 font-medium text-sm leading-5">{step.price}</span>
                  )}
                  
                  {/* Button */}
                  <div className="w-full md:w-auto">
                    {renderStageButton(step)}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={(open) => {
        if (!open) {
          handleCancelPurchase();
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Confirm Purchase
            </DialogTitle>
            <DialogDescription>
              You are about to unlock a premium feature for your manuscript.
            </DialogDescription>
          </DialogHeader>
          {pendingFeature && (
            <div className="py-4">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Feature</p>
                  <p className="text-base text-gray-700">{pendingFeature.title}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Price</p>
                  <p className="text-2xl font-bold text-emerald-600">{pendingFeature.price}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-1">Description</p>
                  <p className="text-sm text-gray-600">{pendingFeature.action}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelPurchase}
              disabled={unlockingFeature === pendingFeature?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              disabled={unlockingFeature === pendingFeature?.id || !pendingFeature}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {unlockingFeature === pendingFeature?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Confirm Purchase
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};

