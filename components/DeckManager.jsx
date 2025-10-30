// components/DeckManager.jsx
'use client'; 

import { useState, useEffect, useMemo, useCallback } from 'react';
import Flashcard from './Flashcard';
import AddFlashcardForm from './AddFlashcardForm'; 
// POPRAWIONA LISTA IKON: Usunięto nieużywane ArrowUpRight i ArrowDownRight
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Shuffle, CheckCircle, X } from 'lucide-react'; 
import { supabase } from '@/utils/supabaseClient';

// Funkcja do mieszania tablicy (Algorytm Fishera-Yatesa)
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
};

export default function DeckManager() {
  const [cards, setCards] = useState([]); 
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showMastered, setShowMastered] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Wszystkie'); 
  
  // 🚨 NOWY STAN: Przechowuje aktualną kolejność wyświetlania po losowaniu, 
  // działa na kartach ZANIM ZOSTANĄ PRZEFILTROWANE.
  const [shuffledCards, setShuffledCards] = useState([]);
  // Używamy go jako bazowego zbioru dla cards. To zapewni, że shuffle działa,
  // a filtry działają na już przetasowanej kolekcji.


  // Logika filtrowania - Zawsze filtruje najpierw posortowane/potasowane karty.
  const cardsToFilter = useMemo(() => {
	// Używamy Potasowanych kart jeśli istnieją, w przeciwnym razie używamy bazowego stanu 'cards'
    return shuffledCards.length > 0 ? shuffledCards : cards;
  }, [cards, shuffledCards]);
  
  
  const filteredCards = useMemo(() => {
    let tempCards = cardsToFilter; // Używamy nowej kolekcji

    // 1. Filtr opanowania (is_mastered)
    if (!showMastered) {
        tempCards = tempCards.filter(card => !card.is_mastered); 
    }

    // 2. Filtr kategorii
    if (selectedCategory !== 'Wszystkie') {
        const normCategory = selectedCategory.toLowerCase().trim();
        tempCards = tempCards.filter(card => 
            card.category && card.category.toLowerCase().trim() === normCategory
        );
    }

    return tempCards;
  }, [cardsToFilter, showMastered, selectedCategory]); // Zależność od cardsToFilter


  // Lista unikalnych kategorii dla dropdowna (Używa bazowego stanu cards)
  const uniqueCategories = useMemo(() => {
    const categories = new Set(cards
        .map(card => card.category)
        .filter(category => category) 
        .map(category => category.trim()) 
    );
    return ['Wszystkie', ...Array.from(categories)];
  }, [cards]);


  const isDeckEmpty = useMemo(() => filteredCards.length === 0, [filteredCards.length]);
  const currentCard = isDeckEmpty ? null : filteredCards[currentIndex];

  // --- LOGIKA BAZY DANYCH ---

  const fetchCards = useCallback(async () => {
    if (!supabase) {
      console.error("KLIENT SUPABASE JEST NIEDOSTĘPNY. Sprawdź .env.local.");
      setIsLoading(false);
      return;
    }
      
    setIsLoading(true);
    const { data, error } = await supabase
      .from('cards')
      .select('id, created_at, strona_a, strona_b, is_mastered, jezyk, category')
      .order('id', { ascending: false });

    if (error) {
      console.error('Błąd podczas ładowania fiszek:', error);
    } else {
      setCards(data);
	  // 🚨 WAŻNE: Po przeładowaniu z DB, resetujemy stan potasowanych kart,
	  // aby domyślnie używany był porządek z bazy.
	  setShuffledCards([]); 
      
      // Upewnienie się, że currentIndex jest w zakresie po przeładowaniu danych
      if (data.length > 0 && currentIndex >= data.length) {
        setCurrentIndex(0);
      }
    }
    setIsLoading(false);
  }, [currentIndex]); 

  const handleSuccessCallback = useCallback(() => {
      fetchCards();
      setCurrentIndex(0); 
  }, [fetchCards]);


  // USTAWIANIE SUBSKRYPCJI (REALTIME) 
  useEffect(() => {
    if (!supabase) {
      fetchCards(); 
      return;
    }
    fetchCards(); 

    const channel = supabase
      .channel('public:cards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        (payload) => {
          fetchCards(); 
        }
      )
      .subscribe(); 

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCards]);


  // 🚨 EFEKT: Resetuj Index po zmianie filtrów (showMastered lub selectedCategory)
  useEffect(() => {
	// Upewniamy się, że po zmianie filtru, currentCard jest resetowany do 0
	setCurrentIndex(0);
  }, [showMastered, selectedCategory]); 


  // USUWANIE KARTY
  const handleDeleteCard = async (cardIdToDelete) => {
    if (!supabase) return; 
    
    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardIdToDelete);

    if (error) {
      console.error('Błąd podczas usuwania fiszki:', error);
    } 
  };
  
  // USTAWIENIE STATUSU OPANOWANIA
  const handleSetMastered = async (cardId, status) => {
    if (!supabase || !currentCard) return; 

    // Przejście do następnej karty PRZED asynchronicznym zapisem
    if (filteredCards.length > 1) {
        handleNext();
    } else {
        setCurrentIndex(0);
    }

    // Zapis do bazy danych
    const { error } = await supabase
      .from('cards')
      .update({ is_mastered: status })
      .eq('id', cardId);

    if (error) {
      console.error('Błąd podczas aktualizacji statusu:', error);
      if (filteredCards.length > 1) {
        handlePrev();
      }
      return;
    }
  };


  // PRZEWIJANIE 
  const handleNext = () => {
    if (isDeckEmpty) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % filteredCards.length);
  };

  const handlePrev = () => {
    if (isDeckEmpty) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + filteredCards.length) % filteredCards.length);
  };
  
  // 🚨 NAPRAWIONA LOGIKA LOSOWANIA: 
  // Losowanie odbywa się na kartachToFilter, a nie na bazowych "cards".
  const handleShuffle = () => {
    if (isDeckEmpty) return;
    
	// Losujemy bazowy zbiór, a nie tylko przefiltrowane karty. 
	// To zapewnia, że jeśli filtry zostaną zmienione, kolejność pozostanie losowa.
    const shuffledBaseCards = shuffleArray([...cardsToFilter]); 
	setShuffledCards(shuffledBaseCards);
    setCurrentIndex(0); 
  };


  if (isLoading && cards.length === 0) {
    return (
        <div className="flex justify-center items-center h-64 w-full max-w-2xl mt-8">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mr-3" />
            <p className="text-xl text-gray-700">Ładowanie fiszek z Supabase...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-2xl p-4">
      
	  {/* PASEK LEVELU ZOSTAŁ USUNIĘTY NA ŻYCZENIE */}

      {/* Panel Filtrów */}
      <div 
          className="flex flex-wrap justify-center gap-4 mb-4 p-4 bg-white rounded-lg shadow-md w-full">
        {/* Przełącznik "Pokaż/Ukryj opanowane" */}
        <button
          onClick={() => {
            setShowMastered(!showMastered);
            // setCurrentIndex(0) jest teraz obsługiwane przez useEffect
          }}
          className={`px-4 py-2 text-sm font-medium rounded-full transition ${
            showMastered 
            ? 'bg-green-500 text-white hover:bg-green-600' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {showMastered ? '✅ Pokazuję Wszystkie Karty' : '📚 Tylko do Powtórki'}
        </button>

        {/* SELECT DLA KATEGORII */}
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            // setCurrentIndex(0) jest teraz obsługiwane przez useEffect
          }}
          className="px-4 py-2 text-sm font-medium rounded-full border border-gray-300 bg-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        >
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'Wszystkie' ? 'Wszystkie Kategorie' : cat}
            </option>
          ))}
        </select>

      </div>

      <div className="w-full">
        {isDeckEmpty ? (
          // Widok pustej talii
          <div className="w-full max-w-lg h-64 mx-auto p-6 flex flex-col items-center justify-center bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-300 shadow-inner">
            <BookOpen className="w-8 h-8 mb-3" />
            <p className="font-semibold text-center">
                {
                  showMastered 
                  ? 'Talia fiszek jest pusta! Dodaj nowe karty poniżej.' 
                  : 'Talia do powtórki jest pusta. Wszystko opanowane! Gratulacje!'
                }
              </p>
              {selectedCategory !== 'Wszystkie' && <p className='mt-2 text-sm'>Spróbuj zmienić kategorię!</p>}
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm font-medium text-gray-500 text-center">
              Słówko **{currentIndex + 1}** z **{filteredCards.length}**               
              {currentCard.is_mastered && <span className="ml-2 text-green-500 font-bold">(Opanowane)</span>}
              {currentCard.category && 
                <span className="ml-2 text-blue-500 font-medium text-xs bg-blue-100 px-2 py-1 rounded-full">
                  Kategoria: {currentCard.category}
                </span>
              }
            </p>
            
            {/* 1. RENDEROWANIE FISZKI */}
            <Flashcard 
                card={currentCard} 
                onDelete={handleDeleteCard} 
                onSetMastered={handleSetMastered} 
            /> 
            
            {/* Przyciski Statusu */}
            <div className="flex justify-center gap-4 w-full max-w-lg mx-auto mt-4">
                <button
                    onClick={() => handleSetMastered(currentCard.id, true)}
                    className="flex items-center px-6 py-3 bg-green-500 text-white rounded-lg font-semibold transition hover:bg-green-600"
                >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Umiem
                </button>
                <button
                    onClick={() => handleSetMastered(currentCard.id, false)}
                    className="flex items-center px-6 py-3 bg-red-500 text-white rounded-lg font-semibold transition hover:bg-red-600"
                >
                    <X className="w-5 h-5 mr-2" />
                    Muszę powtórzyć
                </button>
            </div>
            
            {/* Przyciski Nawigacji */}
            <div className="flex justify-between w-full max-w-lg mx-auto mt-8">
              <button 
                onClick={handlePrev}
                className="flex items-center px-6 py-3 bg-gray-200 text-gray-700 rounded-full font-semibold transition hover:bg-gray-300 disabled:opacity-50"
                disabled={filteredCards.length <= 1}
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Poprzednia
              </button>
              
              <button 
                onClick={handleNext}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold transition hover:bg-indigo-700 disabled:opacity-50"
                disabled={filteredCards.length <= 1}
              >
                Następna
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            </div>

            {/* Przycisk Losowania */}
            <div className="mt-4 text-center">
              <button
                onClick={handleShuffle}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-full text-indigo-600 border border-indigo-600 bg-white hover:bg-indigo-50 transition"
                disabled={filteredCards.length <= 1}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Potasuj talię ({filteredCards.length} kart)
              </button>
            </div>

          </>
        )}
      </div>

      {/* Sekcja Dodawania */}
      <AddFlashcardForm onSuccess={handleSuccessCallback} /> 
    </div>
  );
}