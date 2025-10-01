'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload01Icon, Clock01Icon, CreditCardIcon, Logout01Icon } from '@hugeicons/core-free-icons';

const Sidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navigation = [
    {
      name: 'Describe',
      href: '/app/upload',
      icon: <HugeiconsIcon icon={Upload01Icon} size={20} strokeWidth={2} />
    },
    {
      name: 'History',
      href: '/app/history',
      icon: <HugeiconsIcon icon={Clock01Icon} size={20} strokeWidth={2} />
    },
    {
      name: 'Buy Credits',
      href: '/app/buy-credits',
      icon: <HugeiconsIcon icon={CreditCardIcon} size={20} strokeWidth={2} />
    },
    {
      name: 'Payment Requests',
      href: '/app/payment-requests',
      icon: <HugeiconsIcon icon={CreditCardIcon} size={20} strokeWidth={2} />
    }
  ];

  return (
    <div className="flex flex-col w-64 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 h-full shadow-sm">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ImageDescribe
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-md hover:scale-[1.02]'
              )}
            >
              <div className={cn(
                'transition-transform duration-200',
                isActive ? 'scale-110' : 'group-hover:scale-110'
              )}>
                {item.icon}
              </div>
              <span className="ml-3 font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 space-y-4 bg-white/50 backdrop-blur-sm">
        {/* User Info */}
        <div className="flex items-center p-3 bg-white rounded-xl shadow-sm border border-slate-100">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">
              {session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {session?.user?.name || 'User'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {session?.user?.email || 'user@example.com'}
            </p>
            {session?.user?.credits !== undefined && (
              <div className="flex items-center mt-1">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-1"></div>
                <p className="text-xs text-emerald-600 font-semibold">
                  {session.user.credits} credits
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="w-full flex items-center justify-center py-2.5 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all duration-200 rounded-xl font-medium"
        >
          <HugeiconsIcon icon={Logout01Icon} size={16} strokeWidth={2} className="mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;