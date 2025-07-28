"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
// Added new icons for the admin-specific menu items
import { Menu, BarChart, Settings, FileText, History, Info, Phone, Mail, X, MapPin } from "lucide-react"

type AdminViewType = 'main' | 'editMdrrmoInfo' | 'editHotlines' | 'viewFeedback';

interface SidebarProps {
  // Existing props (empty in your original code, kept as is)
  // New optional props for admin dashboard integration
  onAdminViewChange?: (view: AdminViewType | string) => void;
  currentAdminView?: string;
  unreadFeedbackCount?: number;
}

export function Sidebar({ onAdminViewChange, currentAdminView, unreadFeedbackCount }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Handles navigation for admin views - opens in new tab for admin
  const handleNavigation = (path: string) => {
    // Open in new tab for admin
    window.open(path, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };
  
  // Helper function to check if a path is active
  const isActive = (path: string) => {
    return typeof window !== 'undefined' ? window.location.pathname.includes(path) : false;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {/* The menu button for the sidebar */}
        <Button variant="ghost" size="icon" className="mr-2">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] sm:w-[300px] flex flex-col"
        aria-describedby={undefined}
      >
        <SheetHeader>
          <SheetTitle>Admin Menu</SheetTitle>
          {/* The close button is intentionally removed as per previous instruction */}
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-4">
          {/* Navigation items using in-app routing */}
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigation('/admin/charts')}
          >
            <BarChart className="mr-2 h-4 w-4" /> View Charts
          </Button>
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigation('/admin/data')}
          >
            <Settings className="mr-2 h-4 w-4" /> Edit Data
          </Button>
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigation('/admin/report')}
          >
            <FileText className="mr-2 h-4 w-4" /> Make a Report
          </Button>
          <Button 
            variant="ghost" 
            className="justify-start" 
            onClick={() => handleNavigation('/admin/report-history')}
          >
            <History className="mr-2 h-4 w-4" /> View History of Report
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isActive('mdrrmo-info') ? 'bg-blue-100 text-blue-800' : ''}`}
            onClick={() => handleNavigation('/admin/mdrrmo-info')}
          >
            <Info className="mr-2 h-4 w-4" /> Edit MDRRMO Info
          </Button>
          <Button
            variant="ghost"
            className={`justify-start ${isActive('hotlines') ? 'bg-blue-100 text-blue-800' : ''}`}
            onClick={() => handleNavigation('/admin/hotlines')}
          >
            <Phone className="mr-2 h-4 w-4" /> Edit Hotlines
          </Button>
          <Button
            variant="ghost"
            className={`justify-start relative ${isActive('feedback') ? 'bg-blue-100 text-blue-800' : ''}`}
            onClick={() => handleNavigation('/admin/feedback')}
          >
            <Mail className="mr-2 h-4 w-4" /> See Users Feedback
            {unreadFeedbackCount !== undefined && unreadFeedbackCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadFeedbackCount}
              </span>
            )}
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  )
}