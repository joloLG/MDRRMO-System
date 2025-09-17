"use client"

import React, { useState, useEffect, useCallback } from "react";
interface FeedbackReply {
  id: string;
  feedback_id: string;
  reply_text: string;
  created_at: string;
  admin_id: string;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";


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
  const router = useRouter();
  const [userFeedbacks, setUserFeedbacks] = useState<UserFeedback[]>([]);
  const [unreadFeedbackCount, setUnreadFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reply state
  const [replies, setReplies] = useState<FeedbackReply[]>([]);
  const [replyInput, setReplyInput] = useState<{ [feedbackId: string]: string }>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

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

  // Fetch replies for all feedback
  const fetchReplies = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('feedback_replies')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) {
        setReplies(data);
      }
    } catch (err: any) {
      // Ignore for now
    }
  }, []);

  useEffect(() => {
    fetchUserFeedbacks();
    fetchReplies();

    // Real-time for user_feedback
    const userFeedbackChannel = supabase
      .channel('user-feedback-viewer-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_feedback' }, () => {
        fetchUserFeedbacks();
      })
      .subscribe();

    // Real-time for feedback_replies
    const repliesChannel = supabase
      .channel('feedback-replies-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_replies' }, () => {
        fetchReplies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userFeedbackChannel);
      supabase.removeChannel(repliesChannel);
    };
  }, [fetchUserFeedbacks, fetchReplies]);
  // Send reply
  const handleSendReply = async (feedbackId: string) => {
    setSendingReply(true);
    setReplyError(null);
    try {
      const replyText = replyInput[feedbackId]?.trim();
      if (!replyText) {
        setReplyError('Reply cannot be empty.');
        setSendingReply(false);
        return;
      }
      // Get admin id from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setReplyError('Admin not authenticated.');
        setSendingReply(false);
        return;
      }
      const { error } = await supabase
        .from('feedback_replies')
        .insert({
          feedback_id: feedbackId,
          reply_text: replyText,
          admin_id: user.id,
          created_at: new Date().toISOString(),
        });
      if (error) throw error;
      setReplyInput((prev) => ({ ...prev, [feedbackId]: '' }));
      setReplyingId(null);
    } catch (err: any) {
      setReplyError(err.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

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
        <CardHeader className="bg-orange-600 text-white flex flex-row justify-between items-center">
          <div className="flex items-center">
            <CardTitle className="flex items-center">
              <Mail className="mr-3" /> User Feedback
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 text-center">
          Loading User Feedback...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Back Button for Admin Dashboard */}
      <div className="flex justify-start mb-4">
        <Button
          variant="outline"
          className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          onClick={() => router.push('/')} 
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    <Card className="shadow-lg h-full lg:col-span-3">
      <CardHeader className="bg-orange-600 text-white flex flex-row justify-between items-center">
        <div className="flex items-center">
          <CardTitle className="flex items-center">
            <Mail className="mr-3" /> User Feedback
          </CardTitle>
        </div>
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

                {/* Replies Section */}
                <div className="mt-3 ml-4 border-l-2 border-gray-200 pl-4">
                  {replies.filter(r => r.feedback_id === feedback.id).length > 0 && (
                    <div className="mb-2">
                      <span className="font-semibold text-sm text-gray-700">Replies:</span>
                      <ul className="mt-1 space-y-1">
                        {replies.filter(r => r.feedback_id === feedback.id).map(r => (
                          <li key={r.id} className="text-sm text-gray-800 bg-gray-100 rounded px-2 py-1">
                            <span className="font-medium text-blue-700">Admin:</span> {r.reply_text}
                            <span className="ml-2 text-xs text-gray-500">{new Date(r.created_at).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {replyingId === feedback.id ? (
                    <div className="flex flex-col gap-2 mt-2">
                      <textarea
                        className="border rounded p-2 text-sm"
                        rows={2}
                        value={replyInput[feedback.id] || ''}
                        onChange={e => setReplyInput(prev => ({ ...prev, [feedback.id]: e.target.value }))}
                        placeholder="Type your reply..."
                        disabled={sendingReply}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSendReply(feedback.id)} disabled={sendingReply} className="bg-green-600 hover:bg-green-700 text-white">
                          {sendingReply ? 'Sending...' : 'Send'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setReplyingId(null)} disabled={sendingReply}>Cancel</Button>
                      </div>
                      {replyError && <span className="text-xs text-red-600">{replyError}</span>}
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setReplyingId(feedback.id)}>
                      Reply
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
