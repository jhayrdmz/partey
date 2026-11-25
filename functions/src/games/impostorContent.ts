import type { ImpostorCategory } from "../../../shared/engine";

/**
 * Secret words for The Impostor, by category. Pick words everyone in the room knows and that
 * have many possible one-word clues. Ids are stable so a room doesn't repeat words.
 */
export const IMPOSTOR_WORDS: Record<ImpostorCategory, string[]> = {
  food: [
    "Adobo", "Sinigang", "Lechon", "Halo-halo", "Lumpia", "Pancit", "Sisig", "Balut",
    "Pizza", "Sushi", "Burger", "Ice cream", "Taho", "Bibingka", "Spaghetti", "Fried chicken",
    "Mango", "Popcorn", "Chocolate", "Ramen", "Donut", "Kare-kare", "Turon", "Barbecue",
  ],
  animals: [
    "Carabao", "Tarsier", "Elephant", "Giraffe", "Penguin", "Dolphin", "Shark", "Eagle",
    "Kangaroo", "Panda", "Lion", "Snake", "Crocodile", "Butterfly", "Octopus", "Owl",
    "Monkey", "Chicken", "Frog", "Turtle", "Camel", "Bee", "Whale", "Gecko",
  ],
  places: [
    "Beach", "Airport", "Hospital", "Library", "Mall", "Church", "Jeepney terminal", "Palengke",
    "Cinema", "Zoo", "School", "Gym", "Boracay", "Space station", "Volcano", "Farm",
    "Museum", "Restaurant", "Bank", "Karaoke bar", "Basketball court", "Bakery", "Hotel", "Jungle",
  ],
  objects: [
    "Umbrella", "Toothbrush", "Electric fan", "Smartphone", "Guitar", "Mirror", "Pillow", "Scissors",
    "Candle", "Ladder", "Rice cooker", "Backpack", "Clock", "Tsinelas", "Sunglasses", "Key",
    "Camera", "Balloon", "Hammer", "Remote control", "Basketball", "Microphone", "Book", "Bicycle",
  ],
  movies: [
    "Titanic", "Frozen", "Avatar", "Jurassic Park", "Toy Story", "The Lion King", "Harry Potter", "Star Wars",
    "Spider-Man", "Finding Nemo", "Shrek", "Jaws", "The Avengers", "Coco", "Up", "Inside Out",
    "Batman", "Godzilla", "Home Alone", "Barbie", "Moana", "Cars", "Minions", "Encanto",
  ],
};

export interface ImpostorWord {
  id: string;
  word: string;
  category: ImpostorCategory;
}

export const ALL_IMPOSTOR_WORDS: ImpostorWord[] = (Object.keys(IMPOSTOR_WORDS) as ImpostorCategory[]).flatMap((category) =>
  IMPOSTOR_WORDS[category].map((word) => ({ id: `imp:${category}:${word.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, word, category })),
);
