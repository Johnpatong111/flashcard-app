// components/DeckManager.jsx
'use client'; 

import { useState, useEffect, useMemo, useCallback } from 'react';
import Flashcard from './Flashcard';
import AddFlashcardForm from './AddFlashcardForm'; 
// Dodajemy ikony strzałek: ArrowUpRight, ArrowDownRight
import { ChevronLeft, ChevronRight, BookOpen, Loader2, Shuffle, CheckCircle, X, ArrowUpRight, ArrowDownRight } from 'lucide-react'; 
import { supabase } from '@/utils/supabaseClient';


// STAŁA: MAPA POZIOMÓW SŁOWNICTWA (Definicja poza komponentem)
const LEVELS_MAP = [
    { level: 'A0 (Start)', threshold: 0, nextThreshold: 100 },
    { level: 'A1 (Basic)', threshold: 100, nextThreshold: 500 },
    { level: 'A1+ (Plus)', threshold: 500, nextThreshold: 1000 },
    { level: 'A2 (Elementary)', threshold: 1000, nextThreshold: 2000 },
    { level: 'B1 (Intermediate)', threshold: 2000, nextThreshold: 4000 },
    { level: 'B2 (Upper Intermediate)', threshold: 4000, nextThreshold: 8000 },
    { level: 'C1 (Advanced)', threshold: 8000, nextThreshold: 15000 },
    { level: 'C2 (Proficiency)', threshold: 15000, nextThreshold: 20000 }, 
];


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
  
  // Przechowuje aktualną kolejność wyświetlania (mieszaną lub domyślną)
  const [displayOrder, setDisplayOrder] = useState([]); 

  // --- STAN DLA PASKA POSTĘPU ---
  const [initialMasteredCount, setInitialMasteredCount] = useState(0); 


  // --- LOGIKA LEVEL SYSTEM ---

  // totalMasteredCards używa initialMasteredCount dopóki cards nie są w pełni załadowane
  const totalMasteredCards = useMemo(() => {
    // Po pełnym załadowaniu kart, używamy dokładnej liczby
    if (!isLoading && cards.length > 0) {
        return cards.filter(card => card.is_mastered).length;
    }
    // Przed pełnym załadowaniem, używamy szybko pobranej lub optymistycznie zaktualizowanej liczby
    return initialMasteredCount;
  }, [cards, isLoading, initialMasteredCount]);


  const playerLevel = useMemo(() => {
    let currentLevelData = LEVELS_MAP[0];
    
    for (const levelData of LEVELS_MAP) {
        if (totalMasteredCards >= levelData.threshold) {
            currentLevelData = levelData;
        } else {
            break; 
        }
    }

    const progressTotal = currentLevelData.nextThreshold - currentLevelData.threshold;
    const progressMade = totalMasteredCards - currentLevelData.threshold;
    const progressPercent = progressTotal > 0 ? (progressMade / progressTotal) * 100 : 100;
    const wordsToNextLevel = currentLevelData.nextThreshold - totalMasteredCards;


    return {
        ...currentLevelData,
        masteredCount: totalMasteredCards,
        progressPercent: Math.min(100, progressPercent), 
        wordsToNextLevel: wordsToNextLevel > 0 ? wordsToNextLevel : 0 
    };
  }, [totalMasteredCards]);


  // Logika filtrowania - Zwraca TYLKO przefiltrowane karty
  const filteredCards = useMemo(() => {
    let tempCards = cards;

    if (!showMastered) {
        tempCards = tempCards.filter(card => !card.is_mastered); 
    }

    if (selectedCategory !== 'Wszystkie') {
        const normCategory = selectedCategory.toLowerCase().trim();
        // Zapewnia obsługę null lub undefined dla card.category
        tempCards = tempCards.filter(card => 
            card.category && card.category.toLowerCase().trim() === normCategory
        );
    }
    // Zwracamy listę kart, ale ich kolejność ustalana jest przez displayOrder
    return tempCards;
  }, [cards, showMastered, selectedCategory]);
  
  // Lista unikalnych kategorii
  const uniqueCategories = useMemo(() => {
    const categories = new Set(cards
        .map(card => card.category)
        .filter(category => category) 
        .map(category => category.trim())
    );
    return ['Wszystkie', ...Array.from(categories)];
  }, [cards]);
  
  // Lista kart do faktycznego wyświetlania (filtrowana + posortowana/pomieszana)
  const cardsToDisplay = useMemo(() => {
    // Jeśli displayOrder jest pusty (na starcie), użyj filteredCards
    if (displayOrder.length === 0) {
      return filteredCards;
    }
    // Jeśli displayOrder istnieje, filtruj karty zgodnie z tym porządkiem
    // i upewnij się, że karty pasują do bieżących filtrów
    return displayOrder.filter(card => filteredCards.some(fCard => fCard.id === card.id));
  }, [filteredCards, displayOrder]);


  const isDeckEmpty = useMemo(() => cardsToDisplay.length === 0, [cardsToDisplay.length]);
  const currentCard = isDeckEmpty ? null : cardsToDisplay[currentIndex];

  // --- FUNKCJA: Szybkie pobranie tylko liczby opanowanych kart ---
  const fetchMasteredCount = useCallback(async () => {
    if (!supabase) return;
    try {
      const { count, error } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true }) 
        .eq('is_mastered', true); 

      if (error) {
        console.error('Błąd podczas liczenia opanowanych kart:', error);
      } else {
        setInitialMasteredCount(count || 0);
      }
    } catch (err) {
      console.error("Błąd podczas łączenia w celu liczenia:", err);
    } 
  }, []);
  // -------------------------------------------------------------------

  // --- LOGIKA BAZY DANYCH (GŁÓWNE ŁADOWANIE FISZEK) ---

  const fetchCards = useCallback(async () => {
    if (!supabase) {
      console.error("KLIENT SUPABASE JEST NIEDOSTĘPNY. Sprawdź .env.local.");
      setIsLoading(false);
      return;
    }
      
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, created_at, strona_a, strona_b, is_mastered, jezyk, category')
        .order('id', { ascending: false });

      if (error) {
        console.error('Błąd podczas ładowania fiszek:', error);
      } else {
        setCards(data);
        // Po pełnym załadowaniu, nadpisujemy initialMasteredCount na wypadek, gdyby Realtime nie zadziałał
        setInitialMasteredCount(data.filter(card => card.is_mastered).length);
        setDisplayOrder(data); 
        
        if (data.length > 0 && currentIndex >= data.length) {
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      console.error("Krytyczny błąd podczas łączenia z Supabase:", err);
    } finally {
      setIsLoading(false); // ZAWSZE KOŃCZYMY ŁADOWANIE GŁÓWNE
    }
  }, [currentIndex]); 

  const handleSuccessCallback = useCallback(() => {
      fetchCards();
      fetchMasteredCount(); // Aktualizujemy licznik po dodaniu
      setCurrentIndex(0); 
  }, [fetchCards, fetchMasteredCount]);


  // USTAWIANIE SUBSKRYPCJI (REALTIME) 
  useEffect(() => {
    if (!supabase) {
      fetchCards(); 
      return;
    }
    
    // PRIORYTET: Natychmiastowe pobranie liczby dla paska postępu
    fetchMasteredCount(); 
    
    // Główne pobieranie fiszek
    fetchCards(); 

    const channel = supabase
      .channel('public:cards')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cards' },
        (payload) => {
          fetchCards(); 
          fetchMasteredCount(); // Aktualizuj licznik przy każdej zmianie z bazy
        }
      )
      .subscribe(); 

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCards, fetchMasteredCount]);


  // EFEKT: Resetuj Index i Kolejność Wyświetlania przy zmianie Filtrów
  useEffect(() => {
    // Zapewnia, że po zmianie filtru, currentCard jest resetowany do 0
    setCurrentIndex(0);
    
    // Gdy filtry się zmieniają, resetujemy displayOrder do filteredCards
    setDisplayOrder(filteredCards);
    
  }, [showMastered, selectedCategory, filteredCards.length]);

  
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
  
  // USTAWIENIE STATUSU OPANOWANIA (POPRAWIONA LOGIKA OPTYMISTYCZNA)
  const handleSetMastered = async (cardId, status) => {
    if (!supabase || !currentCard) return; 

    const wasMastered = currentCard.is_mastered;
    const isMasteredNow = status;
    
    // Optymistyczna aktualizacja licznika TYLKO jeśli status się zmienia
    if (wasMastered !== isMasteredNow) {
        setInitialMasteredCount(prevCount => prevCount + (isMasteredNow ? 1 : -1));
    }
    
    // Natychmiastowa aktualizacja głównego stanu kart (dla UI)
    setCards(prevCards => 
      prevCards.map(card => 
        card.id === cardId ? { ...card, is_mastered: status } : card
      )
    );

    // Po aktualizacji statusu, przejdź do następnej karty
    if (cardsToDisplay.length > 1) {
        handleNext();
    } else {
        setCurrentIndex(0);
    }

    // Aktualizacja w bazie danych
    const { error } = await supabase
      .from('cards')
      .update({ is_mastered: status })
      .eq('id', cardId);

    if (error) {
      console.error('Błąd podczas aktualizacji statusu:', error);
      // W przypadku błędu, Realtime w tle powinien przywrócić poprawny stan
      return;
    }
  };


  // PRZEWIJANIE (używa cardsToDisplay)
  const handleNext = () => {
    if (isDeckEmpty) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % cardsToDisplay.length);
  };

  const handlePrev = () => {
    if (isDeckEmpty) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + cardsToDisplay.length) % cardsToDisplay.length);
  };
  
  // LOSOWANIE (Aktualizuje tylko displayOrder, nie cards)
  const handleShuffle = () => {
    if (isDeckEmpty) return;
    // Mieszamy TYLKO aktualnie wyświetlane, przefiltrowane karty
    const shuffledDisplayOrder = shuffleArray([...cardsToDisplay]); 
    setDisplayOrder(shuffledDisplayOrder);
    setCurrentIndex(0); 
  };


  // Warunek blokujący wyświetlanie jeśli trwa ładowanie GŁÓWNYCH fiszek
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
      
      {/* PASEK LEVELU: ZAWSZE WIDOCZNY Z LEPSZYMI KOLORAMI I IKONAMI */}
      <div className="w-full max-w-2xl mx-auto my-4 p-4 bg-gradient-to-br from-purple-50 to-indigo-100 rounded-xl shadow-md border border-indigo-200">
        <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-bold text-purple-800 flex items-center">
                🏅 Twój Poziom: <span className="font-extrabold ml-1">{playerLevel.level}</span>
            </span>
            <span className="text-xs text-indigo-700">
                **{playerLevel.masteredCount}** słów opanowanych
            </span>
        </div>
        {/* Zmieniony pasek postępu: kolor niebiesko-cyjanowy / procentowa szerokość */}
        <div className="h-3 bg-gray-300 rounded-full overflow-hidden">
            <div 
                // NOWA ZMIANA KOLORU NA NIEBIESKO-CYJANOWY GRADIENT
                className="h-full bg-gradient-to-r from-blue-400 to-cyan-600 transition-all duration-500" 
                style={{ width: `${playerLevel.progressPercent}%` }} 
            />
        </div>
        {/* Informacja o postępie w procentach (kolor dopasowany do paska) */}
        <div className="flex justify-center">
            <p className="text-sm font-bold text-blue-600 mt-2">
                {Math.round(playerLevel.progressPercent)}% Postępu
            </p>
        </div>
        
        <p className="text-xs text-indigo-800 mt-1 text-right flex items-center justify-end">
            {playerLevel.progressPercent < 100 
                ? (
                  <span className="flex items-center">
                    {/* Ikona również zmieniona na niebieski, aby pasowała do paska */}
                    <ArrowUpRight className="w-3 h-3 text-blue-600 mr-1" />
                    Jeszcze **{playerLevel.wordsToNextLevel}** słów do poziomu 
                    <span className="font-semibold ml-1">
                      {LEVELS_MAP.find(l => l.threshold === playerLevel.nextThreshold)?.level || 'C2+'}
                    </span>
                  </span>
                )
                : (
                  <span className="flex items-center text-green-700 font-semibold">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Gratulacje! Osiągnięto maksymalny poziom! 🚀
                  </span>
                )
            }
        </p>
      </div>
      {/* KONIEC PASEK LEVELU */}

      {/* Panel Filtrów */}
      <div 
          className="flex flex-wrap justify-center gap-4 mb-4 p-4 bg-white rounded-lg shadow-md w-full">
        {/* Przełącznik "Pokaż/Ukryj opanowane" */}
        <button
          onClick={() => {
            setShowMastered(!showMastered);
            // current Index zostanie zresetowany przez useEffect
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
            // current Index zostanie zresetowany przez useEffect
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
              Słówko <span className="font-bold">{currentIndex + 1}</span> z <span className="font-bold">{cardsToDisplay.length}</span>
              {currentCard.is_mastered && <span className="ml-2 text-green-500 font-bold">(Opanowane)</span>}
              {currentCard.category && 
                <span className="ml-2 text-blue-500 font-medium text-xs bg-blue-100 px-2 py-1 rounded-full">
                  Kategoria: {currentCard.category}
                </span>
              }
            </p>
            
            {/* RENDEROWANIE FISZKI */}
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
                disabled={cardsToDisplay.length <= 1}
              >
                <ChevronLeft className="w-5 h-5 mr-2" />
                Poprzednia
              </button>
              
              <button 
                onClick={handleNext}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold transition hover:bg-indigo-700 disabled:opacity-50"
                disabled={cardsToDisplay.length <= 1}
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
                disabled={cardsToDisplay.length <= 1}
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Potasuj talię ({cardsToDisplay.length} kart)
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