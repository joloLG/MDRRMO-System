"use client"

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";


interface UserFeedback {
  id: string;
  user_id: string;
  feedback_text: string;
  created_at: string;
  is_read: boolean;
  userName?: string;
  userEmail?: string;
}

export function FeedbackViewer() {
  const [userFeedbacks, setUserFeedbacks] = useState<UserFeedback[]>([]);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch User Feedback
  const fetchUserFeedbacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('user_feedback')
        .select(`
          *,
          users!user_feedback_user_id_fkey(firstName, lastName, email)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const feedbacksWithUsers: UserFeedback[] = data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          feedback_text: item.feedback_text,
          created_at: item.created_at,
          is_read: item.is_read,
          userName: item.users?.firstName ? `${item.users.firstName} ${item.users.lastName || ''}`.trim() : 'Unknown User',
          userEmail: item.users?.email || 'N/A',
        }));
        setUserFeedbacks(feedbacksWithUsers);
        setUnreadFeedbackCount(feedbacksWithUsers.filter(f => !f.is_read).length);
      } else if (error) {
        console.error("Error fetching user feedbacks:", error);
        setError(`Failed to load user feedbacks: ${error.message}`);
      }
    } catch (err: any) {
      console.error("Unexpected error fetching user feedbacks:", err);
      setError(`An unexpected error occurred: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserFeedbacks();

    // Set up real-time channel for user_feedback
    const userFeedbackChannel = supabase
      .channel('user-feedback-viewer-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_feedback' }, () => {
        console.log('Change received on user_feedback, refetching.');
        fetchUserFeedbacks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userFeedbackChannel);
    };
  }, [fetchUserFeedbacks]);

  // Admin Actions: Mark Feedback as Read
  const handleMarkFeedbackAsRead = async (feedbackId: string) => {
    setError(null);
    try {
      const { error } = await supabase
        .from('user_feedback')
        .update({ is_read: true })
        .eq('id', feedbackId);
      if (error) throw error;
      fetchUserFeedbacks(); // Re-fetch to update state and unread count
    } catch (error: any) {
      console.error("Error marking feedback as read:", error);
      setError(`Failed to mark feedback as read: ${error.message}. Please check your Supabase RLS policies for 'user_feedback'.`);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-lg h-full lg:col-span-3">
        <CardHeader className="bg-orange-600 text-white">
          <CardTitle className="flex items-center"><Mail className="mr-3" /> User Feedback</CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center">
          Loading User Feedback...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg h-full lg:col-span-3">
      <CardHeader className="bg-orange-600 text-white">
        <CardTitle className="flex items-center"><Mail className="mr-3" /> User Feedback</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <p className="text-gray-700 mb-4">Review feedback submitted by users. Unread feedback is highlighted.</p>
        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}
        {userFeedbacks.length === 0 ? (
          <p className="text-gray-600 text-center py-4">No user feedback received yet.</p>
        ) : (
          <div className="space-y-4">
            {userFeedbacks.map((feedback) => (
              <div key={feedback.id} className={`p-4 border rounded-lg shadow-sm ${feedback.is_read ? 'bg-gray-50' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">From: {feedback.userName} ({feedback.userEmail})</p>
                    <p className="text-xs text-gray-500">{new Date(feedback.created_at).toLocaleString()}</p>
                  </div>
                  {!feedback.is_read && (
                    <Button size="sm" onClick={() => handleMarkFeedbackAsRead(feedback.id)} className="bg-blue-600 hover:bg-blue-700 text-white">
                      Mark as Read
                    </Button>
                  )}
                </div>
                <p className="text-gray-800 whitespace-pre-wrap">{feedback.feedback_text}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
