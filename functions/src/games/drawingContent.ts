import type { DrawCategory } from "../../../shared/engine";

/**
 * Draw & Guess prompts, by category. To add one, append a string to its category.
 *
 *   "Prompt"                       the artist sees "Prompt"; guessing "prompt" wins
 *   "Prompt|Alias|Other alias"     also accept these guesses (other common names)
 *
 * Keep prompts drawable, known to everyone in the room (kids included) and appropriate for all
 * ages: one word or a short phrase. Guesses ignore case, accents, spaces, punctuation, a leading
 * "a/an/the" and a plural "s". Ids come from the prompt text, so don't rename prompts lightly:
 * a room uses them to avoid repeats.
 */
export const DRAW_PROMPTS: Record<DrawCategory, string[]> = {
  animals: [
    "Cat", "Dog", "Elephant", "Giraffe", "Penguin", "Snake", "Fish", "Butterfly", "Spider", "Octopus",
    "Turtle|Tortoise", "Rabbit|Bunny", "Lion", "Monkey", "Owl", "Shark", "Frog", "Bee", "Snail", "Crab",
    "Kangaroo", "Whale", "Duck", "Pig", "Horse", "Dinosaur", "Bat", "Jellyfish", "Peacock", "Zebra",
  ],
  food: [
    "Pizza", "Ice cream", "Banana", "Hamburger|Burger", "Hotdog|Hot dog", "Watermelon", "Birthday cake|Cake", "Donut|Doughnut",
    "Popcorn", "Egg", "Spaghetti|Pasta", "French fries|Fries", "Apple", "Coffee", "Lollipop|Candy", "Sandwich", "Carrot",
    "Grapes", "Pineapple", "Milk", "Taco", "Cupcake", "Corn", "Bread", "Cheese", "Strawberry", "Orange juice|Juice",
    "Sushi", "Pancakes|Pancake", "Chocolate",
  ],
  objects: [
    "Umbrella", "Toothbrush", "Scissors", "Glasses|Eyeglasses|Spectacles", "Clock", "Key", "Lamp", "Chair", "Ladder", "Candle",
    "Mirror", "Pillow", "Television|TV", "Smartphone|Phone|Cellphone", "Backpack|Bag", "Light bulb|Lightbulb|Bulb", "Hammer",
    "Camera", "Balloon", "Book", "Bicycle|Bike", "Electric fan|Fan", "Comb", "Broom", "Guitar", "Headphones", "Bucket",
    "Spoon", "Socks", "Door",
  ],
  places: [
    "Beach", "School", "Hospital", "Airport", "Library", "Zoo", "Farm", "Castle", "Volcano", "Island",
    "Park", "Jungle|Forest", "Desert", "Mountain", "Church", "Bridge", "Playground", "Lighthouse", "Supermarket|Grocery",
    "Swimming pool|Pool", "Museum", "Space|Outer space", "Igloo", "Restaurant", "Train station", "Waterfall", "Camping|Campsite",
    "Bakery", "Cinema|Movie theater", "City",
  ],
  movies: [
    "Superhero", "Robot", "Pirate", "Ghost", "Mermaid", "Dragon", "Wizard", "Alien", "Princess", "Zombie",
    "Cowboy", "Ninja", "Unicorn", "Spaceship|Rocket", "Clown", "Magician", "Treasure map", "Fairy", "Vampire",
    "Monster", "Snowman", "Knight", "Movie ticket|Ticket", "Movie camera", "Microphone|Mic", "Karaoke", "Piano",
    "Drum|Drums", "Video game|Game controller", "Concert",
  ],
  sports: [
    "Basketball", "Soccer|Football", "Swimming", "Tennis", "Boxing", "Volleyball", "Baseball", "Bowling", "Skateboard|Skateboarding",
    "Surfing", "Badminton", "Golf", "Running|Marathon", "Cycling", "Skiing", "Ping pong|Table tennis", "Karate",
    "Fishing", "Chess", "Trophy", "Medal", "Gymnastics", "Archery", "Ice skating|Skating", "Hiking", "Jump rope|Skipping rope",
    "Weightlifting", "Diving", "Sumo|Sumo wrestling", "Whistle",
  ],
  school: [
    "Pencil", "Eraser", "Ruler", "Notebook", "Blackboard|Chalkboard", "Teacher", "Classroom", "Calculator",
    "Globe", "Microscope", "Crayons|Crayon", "Glue", "Paintbrush", "School bus|Bus", "Report card", "Graduation",
    "Alphabet|ABC", "Map", "Computer", "Science|Experiment", "Homework", "Bell|School bell", "Stapler", "Lunchbox|Lunch box",
    "Flag", "Telescope", "Magnet", "Dictionary", "Test|Exam", "Recess",
  ],
  filipino: [
    "Jeepney|Jeep", "Tricycle", "Halo-halo|Halo halo", "Balut", "Lechon", "Bahay kubo|Nipa hut", "Sampaguita", "Carabao|Kalabaw",
    "Tarsier", "Sari-sari store|Sari sari store|Sari-sari", "Tinikling", "Banig", "Parol", "Salakot", "Barong|Barong Tagalog", "Bangka|Boat",
    "Mango|Manga", "Adobo", "Pandesal|Pan de sal", "Taho", "Tsinelas|Slippers", "Sipa", "Fiesta", "Sungka",
    "Kalesa|Calesa", "Rice|Kanin", "Banana cue|Banana-cue", "Philippine eagle|Eagle", "Chocolate Hills", "Ube",
  ],
};

export interface DrawPrompt {
  id: string;
  /** What the artist sees and the reveal shows. */
  word: string;
  /** Accepted answers (the word first), as written. */
  answers: string[];
  category: DrawCategory;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const ALL_DRAW_PROMPTS: DrawPrompt[] = (Object.keys(DRAW_PROMPTS) as DrawCategory[]).flatMap((category) =>
  DRAW_PROMPTS[category].map((entry) => {
    const answers = entry.split("|").map((a) => a.trim()).filter(Boolean);
    return { id: `draw:${category}:${slug(answers[0])}`, word: answers[0], answers, category };
  }),
);
