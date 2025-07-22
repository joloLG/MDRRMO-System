"use client"

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Hotline {
  id: string;
  name: string;
  number: string;
  description?: string;
  last_updated_at?: string;
}

export function HotlinesEditor() {
  const [hotlines, setHotlines] = useState<Hotline[]>([]);
  const [newHotlineName, setNewHotlineName] = useState<string>('');
  const [newHotlineNumber, setNewHotlineNumber] = useState<string>('');
  const [newHotlineDescription, setNewHotlineDescription] = useState<string>('');
  const [hotlineSaveMessage, setHotlineSaveMessage] = useState<string | null>(null);
  const [hotlineSaveError, setHotlineSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch Hotlines for editing
  const fetchHotlinesForEdit = useCallback(async () => {
    setLoading(true);
    setHotlineSaveError(null);
    try {
      const { data, error } = await supabase
        .from('hotlines')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        setHotlines(data as Hotline[]);
      } else if (error) {
        console.error("Error fetching Hotlines for edit:", error);
        setHotlineSaveError(`Failed to load hotlines: ${error.message}`);
      }
    } catch (err: any) {
      console.error("Unexpected error fetching hotlines:", err);
      setHotlineSaveError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHotlinesForEdit();

    // Set up real-time channel for hotlines
    const hotlinesChannel = supabase
      .channel('hotlines-editor-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hotlines' }, () => {
        console.log('Change received on hotlines, refetching.');
        fetchHotlinesForEdit();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(hotlinesChannel);
    };
  }, [fetchHotlinesForEdit]);

  // Admin Actions: Add Hotline
  const handleAddHotline = async () => {
    setHotlineSaveMessage(null);
    setHotlineSaveError(null);
    if (!newHotlineName.trim() || !newHotlineNumber.trim()) {
      setHotlineSaveError("Hotline name and number cannot be empty.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from('hotlines')
        .insert({
          name: newHotlineName,
          number: newHotlineNumber,
          description: newHotlineDescription || null,
          last_updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      setHotlines(prev => [...prev, data as Hotline]);
      setNewHotlineName('');
      setNewHotlineNumber('');
      setNewHotlineDescription('');
      setHotlineSaveMessage("Hotline added successfully!");
    } catch (error: any) {
      console.error("Error adding hotline:", error);
      setHotlineSaveError(`Failed to add hotline: ${error.message}. Please check your Supabase RLS policies for 'hotlines'.`);
    }
  };

  // Admin Actions: Delete Hotline
  const handleDeleteHotline = async (id: string) => {
    setHotlineSaveMessage(null);
    setHotlineSaveError(null);
    try {
      const { error } = await supabase
        .from('hotlines')
        .delete()
        .eq('id', id);
      if (error) throw error;

      setHotlines(prev => prev.filter(h => h.id !== id));
      setHotlineSaveMessage("Hotline deleted successfully!");
    } catch (error: any) {
      console.error("Error deleting hotline:", error);
      setHotlineSaveError(`Failed to delete hotline: ${error.message}. Please check your Supabase RLS policies for 'hotlines'.`);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg h-full lg:col-span-3">
        <CardHeader className="bg-gray-800 text-white">
          <CardTitle className="flex items-center"><Phone className="mr-3" /> Edit Bulan Hotlines</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          Loading Hotlines...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg h-full lg:col-span-3">
      <CardHeader className="bg-gray-800 text-white">
        <CardTitle className="flex items-center"><Phone className="mr-3" /> Edit Bulan Hotlines</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <p className="text-gray-700">Manage the emergency hotline numbers displayed to users.</p>

          {/* Add New Hotline Form */}
          <div className="border p-4 rounded-lg bg-gray-50 space-y-3">
            <h4 className="text-lg font-semibold text-gray-800">Add New Hotline</h4>
            <div>
              <label htmlFor="new-hotline-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                id="new-hotline-name"
                type="text"
                value={newHotlineName}
                onChange={(e) => setNewHotlineName(e.target.value)}
                placeholder="e.g., Police Department"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor="new-hotline-number" className="block text-sm font-medium text-gray-700 mb-1">Number</label>
              <Input
                id="new-hotline-number"
                type="text"
                value={newHotlineNumber}
                onChange={(e) => setNewHotlineNumber(e.target.value)}
                placeholder="e.g., 911 or (056) 123-4567"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor="new-hotline-description" className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <Textarea
                id="new-hotline-description"
                value={newHotlineDescription}
                onChange={(e) => setNewHotlineDescription(e.target.value)}
                rows={2}
                placeholder="e.g., For emergencies and crime reports"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <Button onClick={handleAddHotline} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">
              <Plus className="mr-2 h-4 w-4" /> Add Hotline
            </Button>
            {hotlineSaveMessage && <p className="text-green-600 text-sm mt-2 text-center">{hotlineSaveMessage}</p>}
            {hotlineSaveError && <p className="text-red-600 text-sm mt-2 text-center">{hotlineSaveError}</p>}
          </div>

          {/* Existing Hotlines List */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold text-gray-800">Existing Hotlines</h4>
            {hotlines.length === 0 ? (
              <p className="text-gray-600 text-center">No hotlines added yet.</p>
            ) : (
              hotlines.map((hotline) => (
                <div key={hotline.id} className="flex items-center justify-between p-3 border rounded-md bg-white shadow-sm">
                  <div>
                    <p className="font-medium text-gray-900">{hotline.name}</p>
                    <p className="text-gray-700">{hotline.number}</p>
                    {hotline.description && <p className="text-sm text-gray-500">{hotline.description}</p>}
                  </div>
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteHotline(hotline.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
