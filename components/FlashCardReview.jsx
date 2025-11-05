'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
// Dodajemy ikonę Głośnika (Volume2)
import { Loader2, Zap, Volume2 } from 'lucide-react'; 

const supabase = createClientComponentClient();

// Stałe do obliczeń SRS (Simplistic SRS: 1, 3, 7, 14, 30...)
const SRS_INTERVALS = [1, 3, 7, 14, 30, 60, 90, 180, 365];

// ====================================================================
// 💡 NOWA FUNKCJA: TEXT-TO-SPEECH
// ====================================================================

/**
 * Czyta podany tekst za pomocą Web Speech API (wbudowane w przeglądarkę).
 * @param {string} textToRead - Tekst do odczytania.
 * @param {string} lang - Kod języka (np. 'pl-PL', 'en-US', 'de-DE').
 */
const speakText = (textToRead, lang = 'pl-PL') => {
    // Sprawdza, czy API jest dostępne w przeglądarce
    if ('speechSynthesis' in window) {
        // Zatrzymuje ewentualne poprzednie czytanie
        window.speechSynthesis.cancel(); 

        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = lang; 
        utterance.rate = 0.9; // Lekkie spowolnienie (opcjonalnie)
        
        window.speechSynthesis.speak(utterance);
    } else {
        console.warn('Text-to-Speech API nie jest wspierane w tej przeglądarce.');
    }
};

// ====================================================================

export default function FlashcardReview({ currentUserId }) {
    const [cards, setCards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isFlipped, setIsFlipped] = useState(false);
    const [error, setError] = useState(null);

    // 🛠️ FUNKCJA POMOCNICZA: Oblicza nową datę recenzji (BEZ ZMIAN)
    const calculateNextReviewDate = (currentInterval, performanceRating) => {
        if (performanceRating === 'bad') {
            return {
                newInterval: SRS_INTERVALS[0], // 1 dzień
                newRepetitions: 0,
            };
        }

        const currentIndex = SRS_INTERVALS.indexOf(currentInterval);
        let nextIndex;

        if (performanceRating === 'good') {
            nextIndex = currentIndex < SRS_INTERVALS.length - 1 ? currentIndex + 1 : SRS_INTERVALS.length - 1;
        } else { // performanceRating === 'easy'
            nextIndex = currentIndex < SRS_INTERVALS.length - 2 ? currentIndex + 2 : SRS_INTERVALS.length - 1;
        }

        const newInterval = SRS_INTERVALS[nextIndex];
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);
        
        return {
            newInterval: newInterval,
            newDate: nextDate.toISOString().split('T')[0], // YYYY-MM-DD
        };
    };


    const fetchCardsForReview = useCallback(async () => {
        // ... (Logika fetchCardsForReview pozostaje bez zmian) ...
        if (!currentUserId) {
            setError('Błąd: Użytkownik nie jest zalogowany.');
            setIsLoading(false);
            return;
        }

        // --- DIAGNOSTYKA (Jeśli ID jest poprawne) ---
        console.log("ŁADOWANIE FISZEK: rozpoczęte dla Użytkownika ID:", currentUserId);
        // ---------------------------------------------

        setIsLoading(true);
        setError(null);
        
        try {
            const today = new Date().toISOString().split('T')[0];

            const { data, error: fetchError } = await supabase
                .from('user_cards')
                .select(`
                    *,
                    card:cards (strona_a, strona_b, category, jezyk, przyklad, koniugacja) 
                `)
                .eq('user_id', currentUserId)
                .lte('next_review_date', today)
                .order('next_review_date', { ascending: true });
            
            if (fetchError) throw fetchError;

            // Zapewnienie, że dane są w dobrym formacie i czyszczenie koniugacji
            setCards(data.filter(card => card.card !== null).map(card => {
                const cardData = card.card;
                
                return {
                    strona_a: cardData.strona_a,
                    strona_b: cardData.strona_b,
                    category: cardData.category,
                    jezyk: cardData.jezyk,
                    przyklad: cardData.przyklad,
                    // Czyszczenie wartości z nadmiarowych białych znaków
                    koniugacja: cardData.koniugacja ? cardData.koniugacja.trim() : null, 
                    userCardId: card.id, 
                    currentInterval: card.repetition_interval,
                };
            }));

        } catch (err) {
            console.error('Błąd ładowania kart:', err);
            setError('Nie udało się załadować fiszek do powtórki. Sprawdź RLS dla SELECT.');
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId]);

    // 🚀 Funkcja aktualizująca postęp karty (Główna logika SRS - BEZ ZMIAN)
    const handleGrade = async (performanceRating) => {
        setIsFlipped(false);

        const currentCard = cards[currentCardIndex];
        if (!currentCard) return;

        const { newInterval, newDate } = calculateNextReviewDate(
            currentCard.currentInterval, 
            performanceRating
        );
        
        const { error: updateError } = await supabase
            .from('user_cards')
            .update({ 
                repetition_interval: newInterval,
                next_review_date: newDate,
                is_mastered: newInterval > SRS_INTERVALS[SRS_INTERVALS.length - 2],
            })
            .eq('id', currentCard.userCardId)
            .eq('user_id', currentUserId);
        
        if (updateError) {
            console.error('Błąd aktualizacji postępu:', updateError);
            setError('Nie udało się zaktualizować postępu karty. Sprawdź RLS dla UPDATE.');
            return;
        }

        const nextIndex = currentCardIndex + 1;
        if (nextIndex < cards.length) {
            setCurrentCardIndex(nextIndex);
            setIsFlipped(false);
        } else {
            setCards([]); 
        }
    };


    // --- KLUCZOWA ZMIANA Z DIAGNOSTYKĄ ID (BEZ ZMIAN) ---
    useEffect(() => {
        // --- KLUCZOWA DIAGNOSTYKA: WERYFIKACJA ID (MUSI SIĘ WYŚWIETLIĆ) ---
        console.log("KOMPONENT FLASHCARD REVIEW ZOSTAŁ ZAMONTOWANY");
        console.warn("AKTUALNA WARTOŚĆ currentUserId:", currentUserId); // Używam warn, by log był bardziej widoczny!
        // ------------------------------------------------------------------
        
        if (currentUserId) {
            fetchCardsForReview();
        } else {
             // Ten błąd powinien się wyświetlić, jeśli użytkownik jest niezalogowany
             console.error("BŁĄD KRYTYCZNY: Komponent FlashcardReview nie otrzymał currentUserId (jest null/undefined)!");
             setIsLoading(false);
             setError('Błąd: Nie udało się załadować danych użytkownika (brak ID). Upewnij się, że jesteś zalogowany.');
        }
    }, [currentUserId, fetchCardsForReview]); 
    // -----------------------------------------


    // --- RENDEROWANIE (BEZ ZMIAN W STANACH ŁADOWANIA/BŁĘDU) ---
    
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-48 bg-white rounded-xl shadow-lg border border-gray-100">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="ml-3 text-gray-600">Ładowanie fiszek...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
                <p className="font-bold">Błąd!</p>
                <p>{error}</p>
            </div>
        );
    }

    if (cards.length === 0) {
        return (
            <div className="p-10 bg-yellow-50 rounded-xl shadow-lg border border-yellow-200 text-center">
                <span className="text-4xl">📚</span>
                <p className="mt-3 text-lg font-semibold text-yellow-800">
                    Świetna robota! Wszystkie karty do powtórki zostały ukończone.
                </p>
                <button
                    onClick={fetchCardsForReview}
                    className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                >
                    Spróbuj odświeżyć
                </button>
            </div>
        );
    }
    
    const currentCard = cards[currentCardIndex];
    const totalCount = cards.length;
    const remainingCount = totalCount - currentCardIndex;


    // --- DIAGNOSTYKA W KONSOLI (BEZ ZMIAN) ---
    if (currentCard) {
        console.log("KARTA POBRANA Z SUPABASE (PO CZYSZCZENIU):", currentCard);
        console.log("Wartość koniugacja:", currentCard.koniugacja);
    }
    // --- KONIEC DIAGNOSTYKI W KONSOLI ---


    // Optymalne sprawdzenie dla koniugacji (czy jest niepustym stringiem)
    const hasConjugation = typeof currentCard.koniugacja === 'string' && currentCard.koniugacja.trim() !== '';

    // --- DIAGNOSTYKA WIDOCZNA NA EKRANIE (BEZ ZMIAN) ---
    const isConjugationCheckFailed = isFlipped && currentCard.category === 'czasowniki' && !hasConjugation;
    // --- KONIEC DIAGNOSTYKI WIDOCZNEJ NA EKRANIE ---


    return (
        <div className="space-y-4">
            {/* Nagłówek i Postęp */}
            <div className="flex justify-between items-center text-gray-600">
                <h3 className="text-xl font-semibold flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-indigo-500"/> 
                    Tryb Powtórek
                </h3>
                <span className="text-sm font-medium">
                    Pozostało: {remainingCount} z {totalCount}
                </span>
            </div>

            {/* Karta Fiszek */}
            <div 
                // Usunąłem click handler z tego div, aby umożliwić działanie przycisku głośnika bez odwracania
                className={`w-full p-8 rounded-xl shadow-xl transition-transform duration-500 transform cursor-pointer 
                    ${isFlipped ? 'bg-indigo-50 border-2 border-indigo-200' : 'bg-white border border-gray-100'}
                    ${isFlipped && currentCard.category === 'czasowniki' && hasConjugation ? 'h-auto min-h-64' : 'h-64'}`}
                // Przenosimy kliknięcie na dedykowany przycisk (poniżej) lub na treść fiszki
                onClick={() => setIsFlipped(!isFlipped)} 
            >
                <p className="text-sm font-medium text-gray-500 mb-2">
                    {isFlipped ? 'Strona B' : 'Strona A'}
                </p>
                
                {/* Treść (Strona A lub B) */}
                <div className="relative">
                    <h4 className="text-3xl font-bold text-center mt-4">
                        {isFlipped ? currentCard.strona_b : currentCard.strona_a}
                    </h4>

                    {/* ==================================================================== */}
                    {/* 🎙️ NOWY ELEMENT: IKONA GŁOŚNIKA (Wyświetlana tylko na Stronie B) */}
                    {/* Zabezpieczenie przed błędem, jeśli strona_b jest pusta */}
                    {isFlipped && currentCard.strona_b && (
                        <button
                            onClick={(e) => {
                                // WAŻNE: Zatrzymuje propagację zdarzenia, aby NIE odwrócić karty
                                e.stopPropagation(); 
                                // Używamy 'jezyk' fiszki do dobrania głosu
                                const langCode = currentCard.jezyk === 'hiszpanski' ? 'es-ES' : 
                                                 currentCard.jezyk === 'angielski' ? 'en-US' : 
                                                 'pl-PL'; 
                                speakText(currentCard.strona_b, langCode);
                            }}
                            className="absolute top-0 right-0 p-2 text-indigo-600 hover:text-indigo-800 transition-colors rounded-full hover:bg-indigo-100"
                            aria-label="Odtwórz odpowiedź głosowo"
                        >
                            <Volume2 className="w-6 h-6" />
                        </button>
                    )}
                    {/* ==================================================================== */}
                </div>

                {/* 💡 SEKCJA: Koniugacja (wyświetlana tylko na Stronie B dla Czasowników) */}
                {isFlipped && currentCard.category === 'czasowniki' && hasConjugation && (
                    <div className="mt-6 p-4 bg-indigo-100 border border-indigo-300 rounded-lg text-sm text-gray-800 text-left">
                        <p className="font-bold text-indigo-700 mb-2">Koniugacja (Formy):</p>
                        <p className="whitespace-pre-line">
                            {currentCard.koniugacja}
                        </p>
                    </div>
                )}

                {/* --- SEKCJA DIAGNOSTYCZNA WIDOCZNA NA EKRANIE --- (BEZ ZMIAN) */}
                {isConjugationCheckFailed && (
                    <div className="mt-6 p-4 bg-red-100 border border-red-400 rounded-lg text-sm text-red-700 text-center">
                        <p className="font-bold">DIAGNOSTYKA: Błąd danych koniugacji!</p>
                        <p>Pole 'koniugacja' jest puste lub brakuje go w karcie pobranej z Supabase.</p>
                        <p className="text-xs mt-2">Sprawdź konsolę (F12) - to jest klucz!</p>
                    </div>
                )}
                {/* --- KONIEC SEKCJI DIAGNOSTYCZNEJ --- */}
                
                {/* Przykład (jeśli jest) */}
                {isFlipped && currentCard.przyklad && (
                    <p className="text-center text-sm text-gray-600 mt-4 italic">
                        Przykład: "{currentCard.przyklad}"
                    </p>
                )}
            </div>

            {/* Przyciski Oceny */}
            {isFlipped && (
                <div className="flex justify-between gap-3 pt-2">
                    <button
                        onClick={() => handleGrade('bad')}
                        className="flex-1 py-3 text-sm font-semibold rounded-lg text-white bg-red-500 hover:bg-red-600 transition-colors"
                    >
                        Źle (1 dzień)
                    </button>
                    <button
                        onClick={() => handleGrade('good')}
                        className="flex-1 py-3 text-sm font-semibold rounded-lg text-white bg-yellow-500 hover:bg-yellow-600 transition-colors"
                    >
                        Dobrze ({SRS_INTERVALS[SRS_INTERVALS.indexOf(currentCard.currentInterval) < SRS_INTERVALS.length - 1 ? SRS_INTERVALS.indexOf(currentCard.currentInterval) + 1 : SRS_INTERVALS.length - 1]} dni)
                    </button>
                    <button
                        onClick={() => handleGrade('easy')}
                        className="flex-1 py-3 text-sm font-semibold rounded-lg text-white bg-green-500 hover:bg-green-600 transition-colors"
                    >
                        Łatwo (Długi interwał)
                    </button>
                </div>
            )}
            
            {!isFlipped && (
                <button
                    onClick={() => setIsFlipped(true)}
                    className="w-full py-3 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                >
                    Sprawdź odpowiedź
                </button>
            )}
        </div>
    );
}