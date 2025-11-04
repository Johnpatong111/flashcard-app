'use client';

import { useState, useEffect } from 'react';
// Zmieniam import na createClientComponentClient, bo używasz go w innych plikach
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Loader2 } from 'lucide-react';

// 💡 Upewnij się, że ścieżki importu są poprawne!
import FlashcardReview from './FlashcardReview'; // Ścieżka relatywna, jeśli są w tym samym katalogu
import AddFlashcardForm from './AddFlashcardForm'; // Twój istniejący komponent

const supabase = createClientComponentClient();

export default function Dashboard() {
    const [currentUserId, setCurrentUserId] = useState(null);
    const [isLoadingUser, setIsLoadingUser] = useState(true);
    // Używamy tego wyzwalacza do odświeżania listy fiszek do powtórek
    const [refreshTrigger, setRefreshTrigger] = useState(0); 

    // 🛠️ Funkcja pobierająca aktualnego użytkownika i jego ID
    useEffect(() => {
        const fetchUser = async () => {
            setIsLoadingUser(true);
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
                setCurrentUserId(user.id);
            } else {
                setCurrentUserId(null); // Użytkownik nie jest zalogowany
                // Tutaj można dodać router.push('/login'); jeśli jesteś w Next.js
            }
            setIsLoadingUser(false);
        };

        fetchUser();
        // Zależność jest pusta, by pobrać użytkownika tylko raz przy ładowaniu komponentu
    }, []);

    // 🔄 Funkcja wywoływana po dodaniu nowej fiszki
    const handleCardAdded = () => {
        // Zwiększamy licznik, co spowoduje ponowne renderowanie FlashcardReview
        // i wywoła funkcję fetchCardsForReview (przez zależność [refreshTrigger] lub po prostu key)
        setRefreshTrigger(prev => prev + 1);
    };

    if (isLoadingUser) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="ml-3 text-gray-600">Ładowanie sesji...</p>
            </div>
        );
    }
    
    if (!currentUserId) {
        // Ekran widoczny, gdy użytkownik nie jest zalogowany (zgodnie ze zrzutem)
        return (
            <div className="container mx-auto p-4 max-w-4xl text-center">
                <h1 className="text-3xl font-bold mb-8">Flashcards by Hubert</h1>
                <div className="p-20 text-red-700 bg-red-50 border border-red-300 rounded-xl shadow-md">
                    <p className="text-xl">
                        Zaloguj się, aby zobaczyć swoje fiszki!
                    </p>
                </div>
            </div>
        );
    }

    // --- Widok dla zalogowanego użytkownika ---
    return (
        <div className="container mx-auto p-4 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8 text-gray-800">Flashcards by Hubert</h1>

            {/* 1. Tryb Powtórek */}
            <FlashcardReview 
                currentUserId={currentUserId} 
                key={refreshTrigger} 
            />

            <hr className="my-10 border-t border-gray-200" />
            
            {/* 2. Formularz Dodawania Fiszki */}
            <AddFlashcardForm 
                currentUserId={currentUserId} 
                onSuccess={handleCardAdded} 
            />

            {/* Inne elementy (np. Przegląd wszystkich fiszek) */}
        </div>
    );
}