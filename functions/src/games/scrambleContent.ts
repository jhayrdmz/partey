import type { ScrambleCategory, ScrambleDifficulty } from "../../../shared/engine";

/**
 * Word Scramble words, by category. One word each, letters only, appropriate for all ages.
 * Difficulty comes from the length: easy 3–5 letters, medium 6–8, hard 9+.
 *
 * Every word must have exactly one answer: avoid words whose letters spell another common word
 * (LEMON/MELON, HEART/EARTH, CLOUD/COULD, DANGER/GARDEN…) and US/UK spellings (THEATER). The
 * content test rejects any two words here that are anagrams of each other.
 */
export const SCRAMBLE_WORDS: Record<ScrambleCategory, string[]> = {
  general: [
    "HOUSE", "WATER", "CHAIR", "LIGHT", "HAPPY", "PAPER", "CLOCK", "PARTY", "MONEY", "PHONE", "TRAIN",
    "JOURNEY", "RAINBOW", "KITCHEN", "BIRTHDAY", "HOLIDAY", "BLANKET", "MORNING", "PICTURE", "LIBRARY", "WEEKEND", "FAMILY", "UMBRELLA",
    "ADVENTURE", "KNOWLEDGE", "BEAUTIFUL", "CELEBRATION", "IMPORTANT", "FRIENDSHIP", "IMAGINATION", "WONDERFUL", "EXCELLENT", "COMFORTABLE",
  ],
  animals: [
    "TIGER", "ZEBRA", "MOUSE", "SHEEP", "EAGLE", "PANDA", "CAMEL", "KOALA", "SHARK", "WHALE", "LLAMA", "GOOSE",
    "GIRAFFE", "PENGUIN", "DOLPHIN", "MONKEY", "RABBIT", "TURTLE", "OCTOPUS", "HAMSTER", "LEOPARD", "KANGAROO", "ELEPHANT", "FLAMINGO",
    "ALLIGATOR", "CROCODILE", "BUTTERFLY", "RHINOCEROS", "CHIMPANZEE", "HIPPOPOTAMUS", "PORCUPINE", "CHAMELEON", "GRASSHOPPER", "JELLYFISH",
  ],
  food: [
    "APPLE", "PIZZA", "HONEY", "PASTA", "SALAD", "BACON", "TOAST", "CANDY", "SUSHI", "OLIVE", "JUICE",
    "SANDWICH", "PANCAKE", "NOODLES", "BURRITO", "POPCORN", "AVOCADO", "BROCCOLI", "CABBAGE", "PRETZEL", "MUFFIN", "CINNAMON",
    "CHOCOLATE", "SPAGHETTI", "CAULIFLOWER", "CHEESEBURGER", "STRAWBERRY", "BLUEBERRY", "PINEAPPLE", "WATERMELON",
  ],
  technology: [
    "EMAIL", "ROBOT", "CABLE", "PIXEL", "VIDEO", "RADIO", "DRONE", "MODEM", "WIFI", "BYTE",
    "LAPTOP", "KEYBOARD", "SOFTWARE", "INTERNET", "COMPUTER", "NETWORK", "BROWSER", "TABLET", "WEBSITE", "MONITOR", "BATTERY", "PASSWORD",
    "TECHNOLOGY", "SMARTPHONE", "BLUETOOTH", "CALCULATOR", "PROGRAMMING", "MICROPHONE", "HEADPHONES", "ALGORITHM",
  ],
  geography: [
    "RIVER", "BEACH", "CANAL", "CLIFF", "WORLD", "GLOBE", "JAPAN", "ITALY", "KENYA", "EGYPT", "ASIA", "PERU",
    "VOLCANO", "CANYON", "ISLAND", "MOUNTAIN", "GLACIER", "CAPITAL", "COUNTRY", "EQUATOR", "JUNGLE", "VALLEY", "CANADA", "MEXICO",
    "PHILIPPINES", "AUSTRALIA", "CONTINENT", "PENINSULA", "ARCHIPELAGO", "HEMISPHERE", "LONGITUDE", "SWITZERLAND", "WATERFALL",
  ],
  science: [
    "ATOM", "CELL", "GENE", "ORBIT", "SOLAR", "LUNAR", "FORCE", "COMET", "BRAIN", "VIRUS",
    "PLANET", "GRAVITY", "MAGNET", "OXYGEN", "FOSSIL", "GALAXY", "ENERGY", "PROTEIN", "BACTERIA", "NEUTRON", "CARBON", "MOLECULE",
    "TELESCOPE", "MICROSCOPE", "ELECTRICITY", "LABORATORY", "EXPERIMENT", "PHOTOSYNTHESIS", "ASTRONAUT", "TEMPERATURE", "CHEMISTRY", "EVOLUTION",
  ],
  sports: [
    "GOLF", "CHESS", "GOAL", "COACH", "MEDAL", "RUGBY", "JUDO", "PITCH", "TRACK", "KAYAK", "SURF",
    "TENNIS", "SOCCER", "HOCKEY", "BOXING", "CYCLING", "KARATE", "ARCHERY", "TROPHY", "STADIUM", "SWIMMING", "CRICKET", "REFEREE",
    "BASKETBALL", "VOLLEYBALL", "BADMINTON", "GYMNASTICS", "CHAMPIONSHIP", "SKATEBOARD", "TOURNAMENT", "WRESTLING",
  ],
  entertainment: [
    "MOVIE", "DANCE", "DRAMA", "COMIC", "MAGIC", "PIANO", "OPERA", "DRUMS", "BAND", "JOKE", "CLOWN",
    "CONCERT", "CARTOON", "KARAOKE", "GUITAR", "CIRCUS", "PODCAST", "FESTIVAL", "MUSICAL", "VIOLIN", "TRUMPET", "DIRECTOR", "PUPPET",
    "BLOCKBUSTER", "ANIMATION", "SAXOPHONE", "CELEBRITY", "DOCUMENTARY", "PERFORMANCE", "TELEVISION", "SOUNDTRACK",
  ],
};

export function difficultyOf(word: string): ScrambleDifficulty {
  return word.length <= 5 ? "easy" : word.length <= 8 ? "medium" : "hard";
}

export interface ScrambleWord {
  id: string;
  word: string;
  category: ScrambleCategory;
  difficulty: ScrambleDifficulty;
}

export const ALL_SCRAMBLE_WORDS: ScrambleWord[] = (Object.keys(SCRAMBLE_WORDS) as ScrambleCategory[]).flatMap((category) =>
  SCRAMBLE_WORDS[category].map((word) => ({ id: `scr:${word.toLowerCase()}`, word, category, difficulty: difficultyOf(word) })),
);
