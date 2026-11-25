/** Speed Quiz question bank. `answer` is the index of the correct option. Server-only. */
export interface QuizItem {
  id: string;
  category: string;
  prompt: string;
  options: [string, string, string, string];
  answer: 0 | 1 | 2 | 3;
}

export const QUIZ: QuizItem[] = [
  { id: "q01", category: "Philippines", prompt: "What is the capital of the Philippines?", options: ["Cebu City", "Manila", "Davao City", "Quezon City"], answer: 1 },
  { id: "q02", category: "Philippines", prompt: "How many islands make up the Philippines (approx.)?", options: ["1,700", "4,100", "7,600", "12,000"], answer: 2 },
  { id: "q03", category: "Philippines", prompt: "What is the national fish of the Philippines?", options: ["Tilapia", "Bangus (milkfish)", "Galunggong", "Lapu-lapu"], answer: 1 },
  { id: "q04", category: "Philippines", prompt: "Which volcano is famous for its near-perfect cone shape?", options: ["Taal", "Pinatubo", "Mayon", "Kanlaon"], answer: 2 },
  { id: "q05", category: "Food", prompt: "Which dish is made with tamarind-soured broth?", options: ["Sinigang", "Adobo", "Kare-kare", "Lechon"], answer: 0 },
  { id: "q06", category: "Food", prompt: "Kare-kare is traditionally served with which condiment?", options: ["Toyomansi", "Bagoong", "Banana ketchup", "Vinegar"], answer: 1 },
  { id: "q07", category: "Food", prompt: "Halo-halo is best described as a…", options: ["Noodle soup", "Rice cake", "Shaved ice dessert", "Grilled skewer"], answer: 2 },
  { id: "q08", category: "Philippines", prompt: "Where are the Chocolate Hills?", options: ["Palawan", "Bohol", "Siargao", "Batanes"], answer: 1 },
  { id: "q09", category: "Philippines", prompt: "The Philippine Eagle is also known as the…", options: ["Sea eagle", "Monkey-eating eagle", "Crowned eagle", "Golden eagle"], answer: 1 },
  { id: "q10", category: "Philippines", prompt: "Which festival in Cebu honors the Santo Niño?", options: ["Ati-Atihan", "Pahiyas", "Sinulog", "Panagbenga"], answer: 2 },
  { id: "q11", category: "Science", prompt: "What planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Mercury"], answer: 2 },
  { id: "q12", category: "Science", prompt: "What gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], answer: 2 },
  { id: "q13", category: "Science", prompt: "How many bones are in the adult human body?", options: ["156", "206", "256", "306"], answer: 1 },
  { id: "q14", category: "Science", prompt: "What is H₂O better known as?", options: ["Salt", "Water", "Hydrogen peroxide", "Ozone"], answer: 1 },
  { id: "q15", category: "Science", prompt: "Which is the largest planet in our solar system?", options: ["Saturn", "Neptune", "Earth", "Jupiter"], answer: 3 },
  { id: "q16", category: "Geography", prompt: "Which is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { id: "q17", category: "Geography", prompt: "What is the capital of Japan?", options: ["Kyoto", "Osaka", "Tokyo", "Seoul"], answer: 2 },
  { id: "q18", category: "Geography", prompt: "Which country has the most people?", options: ["United States", "India", "Indonesia", "Brazil"], answer: 1 },
  { id: "q19", category: "Geography", prompt: "Mount Everest sits on the border of Nepal and…", options: ["India", "Bhutan", "China", "Pakistan"], answer: 2 },
  { id: "q20", category: "Geography", prompt: "Which continent is the Sahara Desert in?", options: ["Asia", "Africa", "Australia", "South America"], answer: 1 },
  { id: "q21", category: "Math", prompt: "What is 12 × 12?", options: ["124", "144", "132", "156"], answer: 1 },
  { id: "q22", category: "Math", prompt: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
  { id: "q23", category: "Math", prompt: "What is 15% of 200?", options: ["15", "20", "30", "45"], answer: 2 },
  { id: "q24", category: "Math", prompt: "What is the square root of 81?", options: ["7", "8", "9", "11"], answer: 2 },
  { id: "q25", category: "General", prompt: "How many minutes are in a day?", options: ["1,240", "1,440", "1,640", "2,400"], answer: 1 },
  { id: "q26", category: "General", prompt: "Which animal is known as the 'King of the Jungle'?", options: ["Tiger", "Elephant", "Lion", "Gorilla"], answer: 2 },
  { id: "q27", category: "General", prompt: "What color do you get by mixing blue and yellow?", options: ["Purple", "Green", "Orange", "Brown"], answer: 1 },
  { id: "q28", category: "General", prompt: "How many players are on a basketball team on court?", options: ["4", "5", "6", "7"], answer: 1 },
  { id: "q29", category: "General", prompt: "Which instrument has 88 keys?", options: ["Guitar", "Violin", "Piano", "Harp"], answer: 2 },
  { id: "q30", category: "General", prompt: "What is the fastest land animal?", options: ["Cheetah", "Horse", "Pronghorn", "Greyhound"], answer: 0 },
  { id: "q31", category: "Language", prompt: "What does the Filipino word \"salamat\" mean?", options: ["Hello", "Goodbye", "Thank you", "Please"], answer: 2 },
  { id: "q32", category: "Language", prompt: "\"Kain tayo!\" is an invitation to…", options: ["Dance", "Eat", "Sleep", "Sing"], answer: 1 },
  { id: "q33", category: "Philippines", prompt: "What is the traditional Filipino formal shirt for men?", options: ["Barong Tagalog", "Baro't saya", "Terno", "Malong"], answer: 0 },
  { id: "q34", category: "Philippines", prompt: "Which colorful vehicle is an icon of Philippine streets?", options: ["Tuk-tuk", "Jeepney", "Cable car", "Rickshaw"], answer: 1 },
  { id: "q35", category: "Sports", prompt: "Manny Pacquiao is world-famous for which sport?", options: ["Basketball", "Boxing", "Billiards", "Tennis"], answer: 1 },
  { id: "q36", category: "Sports", prompt: "How many rings are on the Olympic flag?", options: ["4", "5", "6", "7"], answer: 1 },
];
