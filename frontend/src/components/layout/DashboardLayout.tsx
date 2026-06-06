import { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { SupportChatButton, SupportChatDrawer } from '@/components/support/SupportChatDrawer';

interface DashboardLayoutProps {
  children: ReactNode;
  title?: string;
}

export function DashboardLayout({ children, title }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader title={title} />
          <main className="flex-1 p-6 bg-background overflow-auto flex flex-col relative min-h-0">
            {children}
          </main>
        </div>
      </div>
      {/* Support Chat - visible on all pages */}
      <SupportChatButton />
      <SupportChatDrawer />
    </SidebarProvider>
  );
}
