"use client"

import { MdrrmoInfoEditor } from "@/components/admin/mdrrmo-info-editor";
import React from "react";

export default function MdrrmoInfoPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">MDRRMO Information Management</h1>
      <MdrrmoInfoEditor />
    </div>
  );
}
