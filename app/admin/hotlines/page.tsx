"use client"

import { HotlinesEditor } from "@/components/admin/hotlines-editor";
import React from "react";

export default function HotlinesPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Bulan Hotlines Management</h1>
      <HotlinesEditor />
    </div>
  );
}
