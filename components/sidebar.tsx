"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, BarChart, Settings, FileText, History } from "lucide-react" // Added History icon

interface SidebarProps {
  // onMenuItemClick prop is no longer directly used for internal rendering but can remain if other logic needs it
  // For opening new tabs, we'll use direct window.open calls
}

export function Sidebar({}: SidebarProps) { // Removed onMenuItemClick from props as it's not directly used here for new tab logic
  const [isOpen, setIsOpen] = useState(false);

  const handleLinkClick = (path: string) => {
    window.open(path, '_blank'); // Open the specified path in a new tab
    setIsOpen(false); // Close sidebar after clicking a menu item
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {/* Removed lg:hidden here to make the menu button visible on all screen sizes */}
        <Button variant="ghost" size="icon" className="mr-2">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] sm:w-[300px] flex flex-col"
        aria-describedby={undefined} // Keep this to suppress the accessibility warning
      >
        <SheetHeader>
          <SheetTitle>Admin Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-4">
          <Button variant="ghost" className="justify-start" onClick={() => handleLinkClick("/admin/charts")}>
            <BarChart className="mr-2 h-4 w-4" /> View Charts
          </Button>
          <Button variant="ghost" className="justify-start" onClick={() => handleLinkClick("/admin/data")}>
            <Settings className="mr-2 h-4 w-4" /> Edit Data
          </Button>
          <Button variant="ghost" className="justify-start" onClick={() => handleLinkClick("/admin/report")}>
            <FileText className="mr-2 h-4 w-4" /> Make a Report
          </Button>
          <Button variant="ghost" className="justify-start" onClick={() => handleLinkClick("/admin/report-history")}> {/* NEW BUTTON */}
            <History className="mr-2 h-4 w-4" /> View History of Report
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  )
}