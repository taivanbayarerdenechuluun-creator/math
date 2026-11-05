import { L, Ls, type QDef } from "./types";

const q = (diff: QDef["diff"], prompt: string, right: string, wrong: string[], explanation: string): QDef => ({
  cat: "verbal", diff, prompt, right: L(right), wrong: Ls(...wrong), explanation,
});

export const verbal: QDef[] = [
  q(1, "Hot is to Cold as Up is to …", "Down", ["Over", "High", "Side"], "Hot and cold are opposites, and so are up and down."),
  q(1, "Which word means the same as “happy”?", "Joyful", ["Angry", "Tired", "Hungry"], "“Joyful” is a synonym of happy."),
  q(1, "Bird is to Nest as Bee is to …", "Hive", ["Honey", "Flower", "Wing"], "A nest is where a bird lives; a hive is where bees live."),
  q(2, "Which word is the opposite of “ancient”?", "Modern", ["Old", "Historic", "Aged"], "The other three mean old; “modern” is the opposite."),
  q(2, "Doctor is to Hospital as Teacher is to …", "School", ["Student", "Chalk", "Exam"], "A doctor works in a hospital; a teacher works in a school."),
  q(2, "“Meticulous” describes someone who is …", "Very careful about details", ["Careless", "Quick-tempered", "Generous"], "Meticulous means showing great attention to detail."),
  q(3, "Pen is to Write as Knife is to …", "Cut", ["Sharp", "Kitchen", "Fork"], "A pen is used to write; a knife is used to cut."),
  q(3, "Which word is closest in meaning to “ephemeral”?", "Short-lived", ["Eternal", "Fragile", "Beautiful"], "Ephemeral means lasting for a very short time."),
  q(3, "“Although the experiment failed, the team learned valuable lessons.” Which best describes the relationship in this sentence?", "A contrast between the outcome and a benefit", ["A cause and its effect", "A sequence of unrelated events", "A comparison of two teams"], "“Although” signals contrast: the experiment failed, yet something good came of it."),
  q(4, "Which word is the opposite of “benevolent”?", "Malicious", ["Generous", "Careless", "Timid"], "Benevolent means kind and well-meaning; malicious means intending harm."),
  q(4, "Gregarious is to Sociable as Taciturn is to …", "Reserved", ["Talkative", "Friendly", "Loud"], "Gregarious and sociable are near-synonyms, as are taciturn and reserved (saying little)."),
  q(4, "No reptiles are mammals. All snakes are reptiles. Which conclusion follows?", "No snakes are mammals", ["All mammals are snakes", "Some snakes are mammals", "No reptiles are snakes"], "Snakes are inside the reptile group, which has no overlap with mammals."),
  q(5, "To “obfuscate” is to …", "Make unclear or confusing", ["Make clear", "Remove completely", "Celebrate"], "Obfuscate means to make something obscure or difficult to understand."),
  q(5, "Verbose is to Concise as Opaque is to …", "Transparent", ["Cloudy", "Solid", "Dark"], "Verbose and concise are opposites; so are opaque and transparent."),
  q(5, "A “perfunctory” inspection is one that is …", "Done with minimal effort", ["Thorough", "Carefully planned", "Deliberately cruel"], "Perfunctory means carried out routinely, with little care or interest."),
];
