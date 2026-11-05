import { L, Ls, type QDef } from "./types";

const q = (diff: QDef["diff"], prompt: string, right: string, wrong: string[], explanation: string): QDef => ({
  cat: "numerical", diff, prompt, right: L(right), wrong: Ls(...wrong), explanation,
});

export const numerical: QDef[] = [
  q(1, "What comes next?  5, 10, 15, 20, ?", "25", ["30", "24", "22"], "The series adds 5 each time, so 20 + 5 = 25."),
  q(1, "Calculate: 12 + 7 × 2", "26", ["38", "21", "30"], "Multiplication comes first: 7 × 2 = 14, then 12 + 14 = 26."),
  q(1, "A jacket costs $40 and is discounted by 25%. What is the sale price?", "$30", ["$35", "$25", "$10"], "25% of $40 is $10, so the price is $40 − $10 = $30."),
  q(2, "What comes next?  3, 6, 12, 24, ?", "48", ["36", "30", "42"], "Each term is double the previous one: 24 × 2 = 48."),
  q(2, "What comes next?  2, 5, 10, 17, 26, ?", "37", ["35", "38", "40"], "The differences are 3, 5, 7, 9, so the next difference is 11: 26 + 11 = 37. (Terms are n² + 1.)"),
  q(2, "If 4 pens cost $6, how much do 10 pens cost at the same price?", "$15", ["$12", "$16", "$20"], "One pen costs $1.50, so 10 pens cost $15."),
  q(3, "What comes next?  1, 1, 2, 3, 5, 8, ?", "13", ["11", "12", "15"], "Each term is the sum of the previous two (Fibonacci): 5 + 8 = 13."),
  q(3, "A train travels 270 km in 3 hours. At the same speed, how long does it take to travel 450 km?", "5 hours", ["4.5 hours", "6 hours", "7 hours"], "Speed is 90 km/h, so 450 ÷ 90 = 5 hours."),
  q(3, "What comes next?  2, 3, 5, 7, 11, ?", "13", ["12", "14", "15"], "These are the prime numbers; the next prime after 11 is 13."),
  q(4, "What comes next?  3, 4, 7, 11, 18, ?", "29", ["25", "28", "30"], "Each term is the sum of the previous two: 11 + 18 = 29."),
  q(4, "What comes next?  2, 6, 12, 20, 30, ?", "42", ["40", "44", "36"], "The differences are 4, 6, 8, 10, so the next is 12: 30 + 12 = 42. (Terms are n × (n + 1).)"),
  q(4, "A number is increased by 20%, then the result is decreased by 20%. Compared with the original number, the final result is…", "4% lower", ["The same", "4% higher", "2% lower"], "1.2 × 0.8 = 0.96, which is 4% lower than the original."),
  q(5, "What comes next?  2, 3, 5, 9, 17, 33, ?", "65", ["57", "64", "69"], "The differences are 1, 2, 4, 8, 16, so the next is 32: 33 + 32 = 65. (Terms are 2ⁿ + 1.)"),
  q(5, "Two numbers add up to 50 and differ by 12. What is the larger number?", "31", ["28", "32", "38"], "Let the numbers be x and x + 12: 2x + 12 = 50, so x = 19 and the larger is 31."),
  q(5, "5 workers build a wall in 12 days. Working at the same rate, how many days would 3 workers need?", "20 days", ["15 days", "18 days", "24 days"], "The job is 5 × 12 = 60 worker-days; 60 ÷ 3 = 20 days."),
];
