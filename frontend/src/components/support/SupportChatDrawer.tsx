/**
 * Support Chat Drawer Component
 * ClearTax-like floating chat drawer
 */

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Loader2, History, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupportChat, SupportMessage } from '@/hooks/useSupportChat';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Starter prompts to show when no messages
const STARTER_PROMPTS = [
  "How do I file GSTR-1?",
  "What is IMS in GST?",
  "How to configure DSC?",
  "Explain workspace security",
];

export function SupportChatButton() {
  const { open } = useSupportChat();
  
  return (
    <Button
      onClick={open}
      className="fixed bottom-6 left-6 h-14 w-14 rounded-full bg-corporate-primary hover:bg-corporate-primaryHover shadow-lg flex items-center justify-center z-50"
      size="icon"
    >
      <MessageCircle className="h-6 w-6 text-white" />
    </Button>
  );
}

export function SupportChatDrawer() {
  const { 
    isOpen, 
    close, 
    messages, 
    loading, 
    error, 
    sendMessage, 
    addReaction 
  } = useSupportChat();
  
  const [inputValue, setInputValue] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Get current module from route
  const getCurrentModule = () => {
    const path = location.pathname;
    if (path.includes('/gstr1')) return 'gstr1';
    if (path.includes('/gstr3b')) return 'gstr3b';
    if (path.includes('/ims')) return 'ims';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/profile')) return 'profile';
    if (path.includes('/workspace')) return 'workspace';
    if (path.includes('/subscriptions')) return 'subscriptions';
    return 'general';
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle send message
  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;
    
    const messageText = inputValue.trim();
    setInputValue('');
    
    await sendMessage(messageText, {
      route: location.pathname,
      module: getCurrentModule(),
    });
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle starter prompt click
  const handleStarterPrompt = async (prompt: string) => {
    setInputValue(prompt);
    await sendMessage(prompt, {
      route: location.pathname,
      module: getCurrentModule(),
    });
  };

  // Toggle message expansion
  const toggleExpand = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Format timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20" 
        onClick={close}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-corporate-primary to-corporate-dark text-white">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold">Ask Support</span>
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Beta</span>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={() => {
                // TODO: Show conversation history list
                alert('Conversation history coming soon!');
              }}
              title="History"
            >
              <History className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={close} title="Minimize">
              <Minimize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="h-16 w-16 bg-corporate-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-corporate-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">How can I help you today?</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Ask questions about GST, your account, or any features
                </p>
              </div>
              
              <div className="space-y-2">
                {STARTER_PROMPTS.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full text-left justify-start h-auto py-3 px-4"
                    onClick={() => handleStarterPrompt(prompt)}
                    disabled={loading}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isExpanded={expandedMessages.has(message.id)}
                  onToggleExpand={() => toggleExpand(message.id)}
                  onAddReaction={addReaction}
                  formatTime={formatTime}
                />
              ))}
              
              {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-sm px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                  <Button 
                    variant="link" 
                    className="h-auto p-0 text-red-600 underline ml-1"
                    onClick={() => sendMessage(inputValue)}
                  >
                    Retry
                  </Button>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input Area */}
        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask anything..."
              disabled={loading}
              className="flex-1"
            />
            <Button 
              onClick={handleSend} 
              disabled={!inputValue.trim() || loading}
              size="icon"
              className="bg-corporate-primary hover:bg-corporate-primaryHover"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: SupportMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onAddReaction: (messageId: string, reaction: 'like' | 'dislike') => void;
  formatTime: (dateString: string) => string;
}

function MessageBubble({ message, isExpanded, onToggleExpand, onAddReaction, formatTime }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const showExpand = message.text.length > 300 && message.role === 'assistant';

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-corporate-primary text-white rounded-br-md"
            : "bg-slate-100 text-slate-900 rounded-bl-md"
        )}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {showExpand && !isExpanded ? (
            <>
              {message.text.slice(0, 300)}...
              <button
                onClick={onToggleExpand}
                className={cn(
                  "ml-1 underline",
                  isUser ? "text-white/80 hover:text-white" : "text-corporate-primary hover:text-corporate-primaryHover"
                )}
              >
                See more
              </button>
            </>
          ) : (
            message.text
          )}
        </div>
        
        {showExpand && isExpanded && (
          <button
            onClick={onToggleExpand}
            className={cn(
              "text-xs underline mt-1",
              isUser ? "text-white/80 hover:text-white" : "text-corporate-primary hover:text-corporate-primaryHover"
            )}
          >
            Show less
          </button>
        )}
        
        <div className={cn(
          "flex items-center justify-end gap-2 mt-2",
          isUser ? "text-white/70" : "text-slate-400"
        )}>
          <span className="text-xs">{formatTime(message.created_at)}</span>
          
          {!isUser && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAddReaction(message.id, 'like')}
                className={cn(
                  "p-1 rounded hover:bg-slate-200/50 transition-colors",
                  message.feedback === 'like' && "text-green-500"
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onAddReaction(message.id, 'dislike')}
                className={cn(
                  "p-1 rounded hover:bg-slate-200/50 transition-colors",
                  message.feedback === 'dislike' && "text-red-500"
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportChatDrawer;
