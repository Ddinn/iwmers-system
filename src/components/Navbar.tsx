'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, LayoutDashboard, UserCircle, User } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Your original core navigation links
  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Shelters', path: '/shelters' },
    { name: 'Reports', path: '/reports' },
  ];

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      
      if (session?.user?.user_metadata?.role === 'Admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setIsAdmin(session?.user?.user_metadata?.role === 'Admin');
    });

    return () => authListener.subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/dashboard'); 
  };

  // Hide the navbar on the Auth page to keep the login screen clean
  if (pathname === '/auth') return null;

  return (
    <nav className="bg-[#020617] text-white shadow-md sticky top-0 z-50 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo / System Name */}
          <div className="shrink-0 flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition mr-4">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <ShieldAlert size={20} className="text-white" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight text-slate-100 leading-none block">Atmos</span>
                <span className="hidden sm:block text-[10px] font-bold tracking-widest text-slate-400 uppercase leading-none mt-0.5">
                  IWMERS System
                </span>
              </div>
            </Link>

            {/* 👇 Core Navigation Links (Visible to EVERYONE) 👇 */}
            <div className="hidden md:flex space-x-1">
              {navLinks.map((link) => {
                const isActive = pathname.startsWith(link.path);
                return (
                  <Link 
                    key={link.name} 
                    href={link.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-slate-800 text-white' 
                        : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right Side Navigation Controls */}
          <div className="flex items-center gap-4">

            {/* 👇 ADMIN ONLY EXTRA NAVIGATION 👇 */}
            {isAdmin && (
              <Link 
                href="/admin"
                className={`flex items-center gap-1.5 text-sm font-bold px-3 py-2 rounded-lg transition-colors ${
                  pathname === '/admin' 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                    : 'text-rose-400 hover:bg-rose-500/10 border border-transparent'
                }`}
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Command Center</span>
              </Link>
            )}

            {/* Profile & Logout (Visible to ALL logged-in users) */}
            {isLoggedIn ? (
              <>
                <Link 
                  href="/profile"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    pathname === '/profile' 
                      ? 'bg-slate-800 text-white' 
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <User size={16} />
                  <span className="hidden sm:inline">Profile</span>
                </Link>

                <button 
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-rose-400 transition-colors border border-transparent hover:border-rose-500/30 px-3 py-2 rounded-md hover:bg-rose-500/10"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              /* Visible ONLY when fully logged out */
              <Link 
                href="/auth"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-lg shadow-blue-900/20"
              >
                <UserCircle size={16} />
                System Login
              </Link>
            )}

          </div>
        </div>
      </div>
    </nav>
  );
}