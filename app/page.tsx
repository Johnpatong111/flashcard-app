'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DeckManager from '../components/DeckManager';
import LoginPage from '../components/LoginPage'; 
import { Loader2 } from 'lucide-react';

const supabase = createClientComponentClient();

export default function Home() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsLoading(false);
    };

    fetchSession();

    // Nasłuchuj na zmiany stanu autoryzacji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 1. Stan ładowania początkowego
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // 2. Jeśli jest sesja, pokaż DeckManager i przycisk wylogowania
  if (session) {
    // 🚨 WAŻNE: Przekazujemy ID użytkownika do DeckManager, ale nie musi on już sam sprawdzać sesji.
    const currentUserId = session.user.id; 
    
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
        <div className="w-full max-w-2xl flex justify-end">
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 text-sm font-medium rounded-lg text-red-600 border border-red-600 bg-white hover:bg-red-50 transition mb-4"
            >
              Wyloguj ({session.user.email})
            </button>
        </div>
        
        <DeckManager currentUserId={currentUserId} /> 
      </main>
    );
  }

  // 3. Jeśli nie ma sesji, pokaż stronę logowania
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
      <LoginPage />
    </main>
  );
}