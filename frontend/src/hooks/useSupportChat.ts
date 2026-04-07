/**
 * Support Chat Hook
 * Manages the support chat drawer state and messages
 * ALL DATA IS REAL - NO MOCK DATA
 * Uses Backend-First pattern - all operations go through the backend API
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSupportConversations,
  createSupportConversation,
  getSupportMessages,
  sendSupportMessage,
  closeSupportConversation,
  addSupportMessageReaction,
  SupportMessage as ApiSupportMessage,
} from '@/lib/api';

// Types - matching backend API response
export interface SupportMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  created_at: string;
  feedback?: 'like' | 'dislike' | null;
  is_truncated?: boolean;
  citations?: Array<{
    title: string;
    url?: string;
    source?: string;
  }>;
  suggested_actions?: Array<{
    label: string;
    action_type: string;
    payload?: Record<string, unknown>;
  }>;
}

export interface ConversationContext {
  workspaceId?: string;
  businessId?: string;
  gstin?: string;
  userId?: string;
  module?: string;
  route?: string;
  currentTab?: string;
  currentSection?: string;
  context?: {
    selectedBusiness?: string;
    selectedGstin?: string;
    currentTab?: string;
    currentSection?: string;
  };
}

interface UseSupportChatReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  messages: SupportMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string, context?: ConversationContext) => Promise<void>;
  loadConversations: () => Promise<void>;
  addReaction: (messageId: string, reaction: 'like' | 'dislike') => Promise<void>;
  currentConversationId: string | null;
}

export function useSupportChat(): UseSupportChatReturn {
  const { user, currentOrganization, currentGstProfile } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  // Build context from auth
  const buildContext = useCallback((): ConversationContext => ({
    workspaceId: currentOrganization?.id,
    businessId: currentOrganization?.id,
    gstin: currentGstProfile?.gstin,
    userId: user?.id,
    context: {
      selectedGstin: currentGstProfile?.gstin,
    },
  }), [user, currentOrganization, currentGstProfile]);

  // Load conversations - Backend API only
  const loadConversations = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    const workspaceId = currentOrganization?.id;
    
    if (!workspaceId) {
      setError('No workspace selected. Please select a workspace to use support chat.');
      setLoading(false);
      return;
    }
    
    try {
      // Fetch conversations from backend API
      const conversations = await getSupportConversations(workspaceId);
      
      if (conversations && Array.isArray(conversations) && conversations.length > 0) {
        // Use the most recent conversation
        const conv = conversations[0];
        setCurrentConversationId(conv.id);
        
        // Load messages for this conversation
        const msgs = await getSupportMessages(conv.id);
        
        if (msgs && Array.isArray(msgs)) {
          setMessages(msgs.map((m: ApiSupportMessage) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            role: m.sender_type === 'user' ? 'user' : m.sender_type === 'assistant' ? 'assistant' : 'system',
            text: m.content,
            created_at: m.created_at,
            feedback: m.feedback || null,
            is_truncated: m.is_truncated,
            citations: m.citations,
            suggested_actions: m.suggested_actions,
          })));
        }
      } else {
        // No conversation exists, create one
        const newConv = await createSupportConversation(workspaceId, 'Support Chat');
        setCurrentConversationId(newConv.id);
        setMessages([]);
      }
    } catch (err: unknown) {
      console.error('Failed to load conversations:', err);
      if (err instanceof Error) {
        if (err.message.includes('fetch failed') || err.message.includes('network') || err.message.includes('DNS') || err.message.includes('Failed to fetch')) {
          setError('Unable to connect to support. Please check your internet connection and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load conversations. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, currentOrganization?.id]);

  // Send a message - Backend API only
  const sendMessage = useCallback(async (text: string, context?: ConversationContext) => {
    let convId = currentConversationId;
    
    if (!user || !convId) {
      // Create a new conversation if none exists
      await loadConversations();
      convId = currentConversationId;
      if (!convId) {
        setError('Failed to create conversation. Please try again.');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const ctx = context || buildContext();
      
      // Send message to backend API with full context
      const assistantResponse = await sendSupportMessage(
        convId,
        text,
        {
          workspaceId: ctx.workspaceId,
          businessId: ctx.businessId,
          gstin: ctx.gstin,
          userId: ctx.userId,
          module: ctx.module,
          route: ctx.route,
          currentTab: ctx.currentTab,
          currentSection: ctx.currentSection,
          selectedGstin: ctx.context?.selectedGstin,
          selectedBusiness: ctx.context?.selectedBusiness,
        }
      );

      // Add the user message to local state immediately
      const userMessage: SupportMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: convId,
        role: 'user',
        text: text,
        created_at: new Date().toISOString(),
        feedback: null,
      };
      setMessages(prev => [...prev, userMessage]);

      // Add assistant message to local state
      const assistantMessage: SupportMessage = {
        id: assistantResponse.id,
        conversation_id: assistantResponse.conversation_id,
        role: 'assistant',
        text: assistantResponse.content,
        created_at: assistantResponse.created_at,
        feedback: assistantResponse.feedback || null,
        is_truncated: assistantResponse.is_truncated,
        citations: assistantResponse.citations,
        suggested_actions: assistantResponse.suggested_actions,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      if (err instanceof Error) {
        if (err.message.includes('fetch failed') || err.message.includes('network') || err.message.includes('DNS') || err.message.includes('Failed to fetch')) {
          setError('Unable to connect to support. Please check your internet connection.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to send message. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [user, currentConversationId, buildContext, loadConversations]);

  // Add reaction to a message - Backend API only
  const addReaction = useCallback(async (messageId: string, reaction: 'like' | 'dislike') => {
    try {
      await addSupportMessageReaction(messageId, reaction);
      
      // Update local state
      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId ? { ...msg, feedback: reaction } : msg
        )
      );
    } catch (err: unknown) {
      console.error('Failed to add reaction:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add reaction';
      setError(errorMessage);
    }
  }, []);

  // Load conversations when drawer opens
  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
    }
  }, [isOpen, user, loadConversations]);

  return {
    isOpen,
    open,
    close,
    toggle,
    messages,
    loading,
    error,
    sendMessage,
    loadConversations,
    addReaction,
    currentConversationId,
  };
}
