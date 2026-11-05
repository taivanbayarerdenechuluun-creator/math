import type { Lang } from "./i18n";

// The API answers in English. The interface shows the Mongolian equivalent when it is in Mongolian; text with no
// entry passes through unchanged. server-errors.test.ts fails if a user-facing API message has no entry here.
const SIZE = /^(File|Image) too large \(max (\d+) KB\)\.$/;

export const ERRORS_MN: Record<string, string> = {
  "Invalid request.": "Хүсэлт буруу байна.",
  "Not found.": "Олдсонгүй.",
  "Assessment not found.": "Тест олдсонгүй.",
  "Please sign in.": "Нэвтэрнэ үү.",
  "Too many requests.": "Хэт олон хүсэлт илгээлээ.",
  "Too many requests. Try again later.": "Хэт олон хүсэлт илгээлээ. Дараа дахин оролдоно уу.",
  "Too many requests. Please wait a few minutes before asking for another email.": "Хэт олон хүсэлт илгээлээ. Дахин имэйл авахын өмнө хэдэн минут хүлээнэ үү.",
  "Too many attempts.": "Хэт олон оролдлого хийлээ.",
  "Too many attempts. Try again later.": "Хэт олон оролдлого хийлээ. Дараа дахин оролдоно уу.",
  "Too many uploads.": "Хэт олон файл байршууллаа.",
  "Time is up.": "Хугацаа дууслаа.",
  "Timed answers are final.": "Хугацаатай асуултын хариулт эцсийнх.",
  "Session already submitted.": "Энэ тестийг аль хэдийн илгээсэн байна.",
  "Question not part of this session.": "Энэ асуулт тухайн тестэд хамаарахгүй.",
  "Invalid option.": "Сонголт буруу байна.",
  "You already completed today's challenge.": "Та өнөөдрийн даалгаврыг аль хэдийн гүйцэтгэсэн байна.",
  "INTELLIQ is under maintenance. Please try again shortly.": "INTELLIQ засвартай байна. Түр хүлээгээд дахин оролдоно уу.",
  "The site is under maintenance.": "Сайт засвартай байна.",
  "Registration is currently closed.": "Бүртгэл одоогоор хаалттай байна.",
  "This account has been suspended.": "Энэ бүртгэл түдгэлзсэн байна.",
  "An account with this email already exists.": "Энэ имэйлээр бүртгэл аль хэдийн үүссэн байна.",
  "Invalid email or password.": "Имэйл эсвэл нууц үг буруу байна.",
  "Invalid credentials.": "Нэвтрэх мэдээлэл буруу байна.",
  "Incorrect password.": "Нууц үг буруу байна.",
  "Password required.": "Нууц үг шаардлагатай.",
  "This reset link is invalid or has expired.": "Энэ сэргээх холбоос буруу эсвэл хугацаа нь дууссан байна.",
  "We could not send the email right now. Please try again later.": "Имэйл илгээж чадсангүй. Түр хүлээгээд дахин оролдоно уу.",
  "No file uploaded.": "Файл илгээгээгүй байна.",
  "Empty file.": "Файл хоосон байна.",
  "Unsupported file type. Use PNG, JPEG, WebP or GIF.": "Дэмжигдээгүй файлын төрөл. PNG, JPEG, WebP эсвэл GIF ашиглана уу.",
  "AI feedback is temporarily unavailable. The rule-based feedback above is unaffected.": "AI санал түр боломжгүй байна. Дээрх дүрэмд суурилсан санал өөрчлөгдөөгүй.",
  "AI feedback is not configured on this server.": "Энэ серверт AI санал тохируулаагүй байна.",
  "You are the only administrator. Promote another admin before deleting this account.": "Та цорын ганц админ байна. Бүртгэлээ устгахын өмнө өөр админ томилно уу.",
  // validation messages (src/lib/validation.ts)
  "Please enter your name (2–60 characters).": "Нэрээ оруулна уу (2–60 тэмдэгт).",
  "Please enter a valid email address.": "Зөв имэйл хаяг оруулна уу.",
  "Password must be at least 10 characters": "Нууц үг дор хаяж 10 тэмдэгттэй байх ёстой",
  "Add a lowercase letter": "Жижиг үсэг нэмнэ үү",
  "Add an uppercase letter": "Том үсэг нэмнэ үү",
  "Add a number": "Тоо нэмнэ үү",
  // defaults used by the interface itself when the server sent no message
  "Something went wrong.": "Алдаа гарлаа.",
  "Failed.": "Амжилтгүй боллоо.",
  "Upload failed.": "Байршуулалт амжилтгүй боллоо.",
  "Error": "Алдаа",
};

export function localizeError(msg: string, lang: Lang): string {
  if (lang !== "mn") return msg;
  const size = msg.match(SIZE);
  if (size) return `${size[1] === "File" ? "Файл" : "Зураг"} хэт том байна (дээд тал нь ${size[2]} KB).`;
  return ERRORS_MN[msg] ?? msg;
}
