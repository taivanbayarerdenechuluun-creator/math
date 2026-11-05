// Prints the generator's output for a date as JSON (used by tests/12 to compare the database with the generator).
import { generateDaily } from "../src/lib/daily-gen";

console.log(JSON.stringify(generateDaily(process.argv[2])));
