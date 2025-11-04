'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// 💡 IMPORTUJEMY TYP SESSION Z GŁÓWNEJ BIBLIOTEKI SUPABASE
import { Session } from '@supabase/supabase-js'; 

// 🚨 PAMIĘTAJ O ZMIANIE NAZW:
// Zmieniliśmy nazwę komponentu zarządzającego powtórkami na FlashcardReview, 
// a wcześniej sugerowaliśmy DeckManager. Jeśli używasz DeckManager, 
// upewnij się, że ten import jest poprawny:
import DeckManager from '../components/DeckManager'; // lub FlashcardReview, jeśli go tak nazwałeś
import LoginPage from '../components/LoginPage'; 
import { Loader2 } from 'lucide-react';

const supabase = createClientComponentClient();

export default function Home() {
  // ✅ POPRAWIONA DEKLARACJA STANU: Akceptuje Session LUB null
  const [session, setSession] = useState<Session | null>(null); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      // Teraz setSession(session) jest poprawne, ponieważ 'session' jest typu Session | null
      setSession(session); 
      setIsLoading(false);
    };

    fetchSession();

    // Nasłuchuj na zmiany stanu autoryzacji
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // newSession jest typu Session | null, co jest zgodne z deklaracją useState
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
    // Używamy opcjonalnego łańcuchowania, aby upewnić się, że user istnieje, 
    // chociaż w tym bloku sesja nie jest null
    const currentUserId = session.user?.id; 
    
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center p-4">
        <div className="w-full max-w-2xl flex justify-end">
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-4 py-2 text-sm font-medium rounded-lg text-red-600 border border-red-600 bg-white hover:bg-red-50 transition mb-4"
            >
              Wyloguj ({session.user?.email})
            </button>
        </div>
        
        {/* Upewnij się, że DeckManager jest poprawną ścieżką do Twojego komponentu powtórek */}
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