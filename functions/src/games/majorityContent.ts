/** Guess the Majority prompts. There's no right answer — only the popular one. */
export interface MajorityItem {
  id: string;
  prompt: string;
  options: string[];
}

export const MAJORITY: MajorityItem[] = [
  { id: "m01", prompt: "Best merienda?", options: ["Turon", "Banana cue", "Puto", "Kwek-kwek"] },
  { id: "m02", prompt: "Rice: how many cups at a family lunch?", options: ["1", "2", "3", "Unli-rice"] },
  { id: "m03", prompt: "Beach or mountains?", options: ["Beach", "Mountains"] },
  { id: "m04", prompt: "Pick a superpower", options: ["Fly", "Invisible", "Teleport", "Read minds"] },
  { id: "m05", prompt: "Best time to sleep in?", options: ["Saturday", "Sunday", "Holidays", "Every day"] },
  { id: "m06", prompt: "Adobo: chicken or pork?", options: ["Chicken", "Pork", "Both together"] },
  { id: "m07", prompt: "What would you bring to a deserted island?", options: ["Phone", "Knife", "Food", "Best friend"] },
  { id: "m08", prompt: "Favorite way to spend a rainy day", options: ["Sleep", "Movies", "Food trip", "Gaming"] },
  { id: "m09", prompt: "Cats or dogs?", options: ["Cats", "Dogs", "Both", "Neither"] },
  { id: "m10", prompt: "Best fast food chicken?", options: ["Jollibee", "McDonald's", "KFC", "Mang Inasal"] },
  { id: "m11", prompt: "Coffee or milk tea?", options: ["Coffee", "Milk tea", "Neither"] },
  { id: "m12", prompt: "Pick a karaoke song genre", options: ["OPM ballad", "K-pop", "Rock", "Disco"] },
  { id: "m13", prompt: "Morning person or night owl?", options: ["Morning", "Night owl"] },
  { id: "m14", prompt: "Dream vacation", options: ["Japan", "Korea", "Europe", "Palawan"] },
  { id: "m15", prompt: "Best Christmas food", options: ["Ham", "Queso de bola", "Spaghetti", "Lechon"] },
  { id: "m16", prompt: "Which would you give up for a year?", options: ["Social media", "Rice", "Coffee", "Air-con"] },
  { id: "m17", prompt: "How do you eat your mango?", options: ["Ripe", "Green with bagoong", "Shake", "Dried"] },
  { id: "m18", prompt: "Pick a pet name for a carabao", options: ["Bantay", "Kalabaw Jr.", "Big Boss", "Chiquito"] },
  { id: "m19", prompt: "Best commute", options: ["Jeepney", "Tricycle", "MRT/LRT", "Motorcycle"] },
  { id: "m20", prompt: "What's the best part of a party?", options: ["Food", "Games", "Videoke", "Chika"] },
  { id: "m21", prompt: "Sweet or savory breakfast?", options: ["Sweet", "Savory"] },
  { id: "m22", prompt: "Best silog", options: ["Tapsilog", "Longsilog", "Tocilog", "Bangsilog"] },
  { id: "m23", prompt: "If you won the lotto, first buy?", options: ["House", "Car", "Travel", "Save it all"] },
  { id: "m24", prompt: "Hardest chore", options: ["Dishes", "Laundry", "Cleaning the CR", "Cooking"] },
];
