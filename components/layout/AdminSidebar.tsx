'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { HugeiconsIcon } from '@hugeicons/react';
import { 
  DashboardSquare01Icon, 
  UserGroupIcon, 
  CreditCardIcon, 
  Analytics01Icon,
  Settings02Icon,
  Logout01Icon 
} from '@hugeicons/core-free-icons';

const AdminSidebar = () => {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: <HugeiconsIcon icon={DashboardSquare01Icon} size={20} strokeWidth={2} />
    },
    {
      name: 'Users',
      href: '/admin/users',
      icon: <HugeiconsIcon icon={UserGroupIcon} size={20} strokeWidth={2} />
    },
    {
      name: 'Credits',
      href: '/admin/credits',
      icon: <HugeiconsIcon icon={CreditCardIcon} size={20} strokeWidth={2} />
    },
    {
      name: 'Payments',
      href: '/admin/payments',
      icon: <HugeiconsIcon icon={Analytics01Icon} size={20} strokeWidth={2} />
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: <HugeiconsIcon icon={Settings02Icon} size={20} strokeWidth={2} />
    }
  ];

  return (
    <div className="flex flex-col w-64 bg-gradient-to-b from-slate-50 to-white border-r border-slate-200 h-full shadow-sm">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Admin Panel
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
              {session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase() || 'A'}
            </span>
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {session?.user?.name || 'Admin'}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {session?.user?.email || 'admin@example.com'}
            </p>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-emerald-400 rounded-full mr-1"></div>
              <p className="text-xs text-emerald-600 font-semibold">
                Administrator
              </p>
            </div>
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

export default AdminSidebar;