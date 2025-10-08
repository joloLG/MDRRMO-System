"use client"

import React from 'react';
import { Button } from "@/components/ui/button"
import { AlertTriangle, History, Info, Phone, User, Mail, X, Download } from "lucide-react"
import { useAppStore } from '@/lib/store';

interface UserSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeView: (view: string) => void;
}

const menuItems = [
  { id: 'main', icon: AlertTriangle, label: 'Main Dashboard', type: 'internal' },
  { id: 'reportHistory', icon: History, label: 'Report History', type: 'internal' },
  { id: 'mdrrmoInfo', icon: Info, label: 'MDRRMO-Bulan Info', type: 'internal', path: '/mdrrmo-info' },
  { id: 'hotlines', icon: Phone, label: 'Bulan Hotlines', type: 'internal', path: '/hotlines' },
  { id: 'userProfile', icon: User, label: 'User Profile', type: 'internal' },
  { id: 'sendFeedback', icon: Mail, label: 'Send Feedback', type: 'internal' },
];

export function UserSidebar({ isOpen, onClose, onChangeView }: UserSidebarProps) {
  const installPromptEvent = useAppStore(state => state.installPromptEvent);
  const setInstallPromptEvent = useAppStore(state => state.setInstallPromptEvent);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleMenuItemClick = (item: { id: string; type: string; path?: string }) => {
    if (item.type === 'internal' && item.path) {
      const fullPath = window.location.origin + item.path;
      window.location.href = fullPath;
      onClose();
    } else if (item.type === 'internal') {
      onChangeView(item.id);
      onClose();
    } else if (item.type === 'external' && item.path) {
      window.location.href = item.path;
      onClose();
    }
  };

  const handleInstallClick = () => {
    if (!installPromptEvent) return;
    (installPromptEvent as any).prompt();
    setInstallPromptEvent(null);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out lg:hidden"
          onClick={handleOverlayClick}
          role="button"
          aria-label="Close menu"
          tabIndex={0}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-800 text-white shadow-lg z-50 transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:static lg:z-auto ${
          isOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full lg:absolute'
        }`}
        aria-label="Main navigation"
      >
        <div className="h-full flex flex-col">
          <div className="p-4 flex items-center justify-between border-b border-gray-700">
            <h2 className="text-xl font-bold">Menu</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white lg:hidden"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {installPromptEvent && (
              <Button
                variant="ghost"
                className="w-full justify-start text-white bg-green-600 hover:bg-green-700 hover:text-white"
                onClick={handleInstallClick}
              >
                <Download className="mr-3 h-5 w-5 flex-shrink-0" />
                <span className="truncate">Install App</span>
              </Button>
            )}
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-gray-700 hover:text-white"
                  onClick={() => handleMenuItemClick(item as any)}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.type === 'external' && (
                    <span className="ml-auto text-xs text-gray-400">↗</span>
                  )}
                </Button>
              );
            })}
          </nav>
          <div className="mt-auto p-4 text-xs text-gray-400 border-t border-gray-700">
            MDRRMO Emergency App 2025 ©
          </div>
        </div>
      </aside>
    </>
  );
}
