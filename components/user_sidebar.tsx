"use client"

import React from 'react';
import { Button } from "@/components/ui/button"
import { AlertTriangle, History, Info, Phone, User, Mail, X } from "lucide-react"

interface UserSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onChangeView: (view: string) => void;
}

const menuItems = [
  { id: 'main', icon: AlertTriangle, label: 'Main Dashboard' },
  { id: 'reportHistory', icon: History, label: 'Report History' },
  { id: 'mdrrmoInfo', icon: Info, label: 'MDRRMO-Bulan Info' },
  { id: 'hotlines', icon: Phone, label: 'Bulan Hotlines' },
  { id: 'userProfile', icon: User, label: 'User Profile' },
  { id: 'sendFeedback', icon: Mail, label: 'Send Feedback' },
];

export function UserSidebar({ isOpen, onClose, onChangeView }: UserSidebarProps) {
  // Close sidebar when clicking outside
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Close sidebar when pressing Escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleMenuItemClick = (view: string) => {
    onChangeView(view);
    onClose();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out lg:hidden"
          onClick={handleOverlayClick}
          role="button"
          aria-label="Close menu"
          tabIndex={0}
        />
      )}

      {/* Sidebar */}
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
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="w-full justify-start text-white hover:bg-gray-700 hover:text-white"
                  onClick={() => handleMenuItemClick(item.id)}
                >
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Button>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
