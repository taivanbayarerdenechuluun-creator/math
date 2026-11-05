/**
 * English and Mongolian vocabulary for the generated verbal items. Only common words whose Mongolian equivalent is
 * unambiguous are used, and no word appears in two places that could make an item ambiguous. Like the rest of the
 * Mongolian text it was written without a native-speaker review.
 */
export type T = { en: string; mn: string };
const t = (en: string, mn: string): T => ({ en, mn });

/** Opposites. The first 22 are everyday adjectives (used at the easiest level). */
export const ANTONYMS: [T, T][] = [
  [t("hot", "халуун"), t("cold", "хүйтэн")], [t("big", "том"), t("small", "жижиг")], [t("fast", "хурдан"), t("slow", "удаан")],
  [t("happy", "баяртай"), t("sad", "гунигтай")], [t("new", "шинэ"), t("old", "хуучин")], [t("long", "урт"), t("short", "богино")],
  [t("heavy", "хүнд"), t("light", "хөнгөн")], [t("hard", "хатуу"), t("soft", "зөөлөн")], [t("wet", "нойтон"), t("dry", "хуурай")],
  [t("full", "дүүрэн"), t("empty", "хоосон")], [t("open", "нээлттэй"), t("closed", "хаалттай")], [t("rich", "баян"), t("poor", "ядуу")],
  [t("strong", "хүчтэй"), t("weak", "сул")], [t("near", "ойр"), t("far", "хол")], [t("clean", "цэвэр"), t("dirty", "бохир")],
  [t("thick", "зузаан"), t("thin", "нимгэн")], [t("wide", "өргөн"), t("narrow", "нарийн")], [t("high", "өндөр"), t("low", "нам")],
  [t("sweet", "чихэрлэг"), t("sour", "исгэлэн")], [t("loud", "чанга"), t("quiet", "чимээгүй")], [t("deep", "гүн"), t("shallow", "гүехэн")],
  [t("safe", "аюулгүй"), t("dangerous", "аюултай")],
  [t("day", "өдөр"), t("night", "шөнө")], [t("up", "дээш"), t("down", "доош")], [t("true", "үнэн"), t("false", "худал")],
  [t("friend", "найз"), t("enemy", "дайсан")], [t("morning", "өглөө"), t("evening", "орой")], [t("inside", "дотор"), t("outside", "гадна")],
  [t("brave", "зоригтой"), t("cowardly", "хулчгар")], [t("smooth", "гөлгөр"), t("rough", "барзгар")], [t("north", "хойд"), t("south", "өмнөд")],
  [t("love", "хайр"), t("hate", "үзэн ядалт")], [t("win", "ялах"), t("lose", "ялагдах")], [t("buy", "худалдаж авах"), t("sell", "зарах")],
  [t("give", "өгөх"), t("take", "авах")], [t("begin", "эхлэх"), t("end", "дуусах")], [t("come", "ирэх"), t("go", "явах")],
  [t("push", "түлхэх"), t("pull", "татах")], [t("laugh", "инээх"), t("cry", "уйлах")], [t("remember", "санах"), t("forget", "мартах")],
  [t("ask", "асуух"), t("answer", "хариулах")], [t("build", "барих"), t("destroy", "нураах")], [t("right", "зөв"), t("wrong", "буруу")],
];
export const EASY_ANTONYMS = 22;

export type Category = { key: string; name: T; article: string; members: T[]; hard?: boolean };
export const CATEGORIES: Category[] = [
  { key: "animal", name: t("Animal", "Амьтан"), article: "an animal", members: [t("dog", "нохой"), t("cat", "муур"), t("horse", "морь"), t("cow", "үхэр"), t("sheep", "хонь"), t("goat", "ямаа"), t("camel", "тэмээ"), t("wolf", "чоно"), t("tiger", "бар"), t("bear", "баавгай"), t("fox", "үнэг"), t("rabbit", "туулай")] },
  { key: "bird", name: t("Bird", "Шувуу"), article: "a bird", members: [t("eagle", "бүргэд"), t("crow", "хэрээ"), t("swan", "хун"), t("duck", "нугас"), t("pigeon", "тагтаа"), t("owl", "шар шувуу")] },
  { key: "fruit", name: t("Fruit", "Жимс"), article: "a fruit", members: [t("apple", "алим"), t("pear", "лийр"), t("banana", "банан"), t("lemon", "нимбэг"), t("grape", "усан үзэм"), t("watermelon", "тарвас"), t("peach", "тоор"), t("cherry", "интоор")] },
  { key: "vegetable", name: t("Vegetable", "Хүнсний ногоо"), article: "a vegetable", members: [t("carrot", "лууван"), t("potato", "төмс"), t("onion", "сонгино"), t("cabbage", "байцаа"), t("garlic", "сармис"), t("turnip", "манжин")] },
  { key: "colour", name: t("Colour", "Өнгө"), article: "a colour", members: [t("red", "улаан"), t("blue", "цэнхэр"), t("green", "ногоон"), t("yellow", "шар"), t("white", "цагаан"), t("black", "хар"), t("brown", "бор"), t("grey", "саарал")] },
  { key: "vehicle", name: t("Vehicle", "Тээврийн хэрэгсэл"), article: "a vehicle", members: [t("car", "машин"), t("bus", "автобус"), t("train", "галт тэрэг"), t("plane", "онгоц"), t("bicycle", "унадаг дугуй"), t("ship", "усан онгоц"), t("truck", "ачааны машин"), t("tram", "трамвай"), t("boat", "завь")] },
  { key: "body", name: t("Body part", "Биеийн эрхтэн"), article: "a part of the body", members: [t("hand", "гар"), t("foot", "хөл"), t("head", "толгой"), t("eye", "нүд"), t("ear", "чих"), t("nose", "хамар"), t("mouth", "ам"), t("heart", "зүрх"), t("back", "нуруу"), t("finger", "хуруу")] },
  { key: "furniture", name: t("Furniture", "Тавилга"), article: "a piece of furniture", hard: true, members: [t("chair", "сандал"), t("table", "ширээ"), t("bed", "ор"), t("sofa", "буйдан"), t("shelf", "тавиур"), t("wardrobe", "шүүгээ")] },
  { key: "tool", name: t("Tool", "Багаж"), article: "a tool", hard: true, members: [t("hammer", "алх"), t("saw", "хөрөө"), t("drill", "өрөм"), t("knife", "хутга"), t("scissors", "хайч"), t("axe", "сүх"), t("shovel", "хүрз"), t("needle", "зүү")] },
  { key: "job", name: t("Profession", "Мэргэжил"), article: "a profession", members: [t("doctor", "эмч"), t("teacher", "багш"), t("driver", "жолооч"), t("farmer", "тариачин"), t("cook", "тогооч"), t("singer", "дуучин"), t("painter", "зураач"), t("pilot", "нисгэгч"), t("builder", "барилгачин"), t("lawyer", "хуульч"), t("writer", "зохиолч")] },
  { key: "planet", name: t("Planet", "Гараг"), article: "a planet", members: [t("Mars", "Ангараг"), t("Venus", "Сугар"), t("Jupiter", "Бархасбадь"), t("Saturn", "Санчир"), t("Mercury", "Буд"), t("Earth", "Дэлхий"), t("Neptune", "Далай ван"), t("Uranus", "Тэнгэрийн ван")] },
  { key: "instrument", name: t("Musical instrument", "Хөгжмийн зэмсэг"), article: "a musical instrument", hard: true, members: [t("piano", "төгөлдөр хуур"), t("violin", "хийл"), t("drum", "бөмбөр"), t("flute", "лимбэ"), t("guitar", "гитар"), t("horse-head fiddle", "морин хуур")] },
];

/** [part, whole] */
export const PART_WHOLE: [T, T][] = [
  [t("wheel", "дугуй"), t("car", "машин")], [t("page", "хуудас"), t("book", "ном")], [t("petal", "дэлбээ"), t("flower", "цэцэг")],
  [t("branch", "мөчир"), t("tree", "мод")], [t("sleeve", "ханцуй"), t("shirt", "цамц")], [t("roof", "дээвэр"), t("house", "байшин")],
  [t("wing", "далавч"), t("bird", "шувуу")], [t("string", "утас"), t("violin", "хийл")],
];

/** [adult, young] */
export const YOUNG: [T, T][] = [
  [t("dog", "нохой"), t("puppy", "гөлөг")], [t("cat", "муур"), t("kitten", "зулзага")], [t("horse", "морь"), t("foal", "унага")],
  [t("sheep", "хонь"), t("lamb", "хурга")], [t("cow", "үхэр"), t("calf", "тугал")], [t("goat", "ямаа"), t("kid", "ишиг")],
];

/** [country, capital] */
export const CAPITALS: [T, T][] = [
  [t("Mongolia", "Монгол"), t("Ulaanbaatar", "Улаанбаатар")], [t("Japan", "Япон"), t("Tokyo", "Токио")], [t("France", "Франц"), t("Paris", "Парис")],
  [t("Germany", "Герман"), t("Berlin", "Берлин")], [t("Russia", "Орос"), t("Moscow", "Москва")], [t("China", "Хятад"), t("Beijing", "Бээжин")],
  [t("Italy", "Итали"), t("Rome", "Ром")], [t("Egypt", "Египет"), t("Cairo", "Каир")], [t("Kazakhstan", "Казахстан"), t("Astana", "Астана")],
  [t("the United Kingdom", "Их Британи"), t("London", "Лондон")], [t("South Korea", "Өмнөд Солонгос"), t("Seoul", "Сөүл")],
  [t("Turkey", "Турк"), t("Ankara", "Анкара")], [t("Spain", "Испани"), t("Madrid", "Мадрид")], [t("Canada", "Канад"), t("Ottawa", "Оттава")],
];

/** [tool, the person who uses it] */
export const TOOL_USER: [T, T][] = [
  [t("needle", "зүү"), t("tailor", "оёдолчин")], [t("pen", "үзэг"), t("writer", "зохиолч")], [t("brush", "сойз"), t("painter", "зураач")],
  [t("plough", "анжис"), t("farmer", "тариачин")], [t("hammer", "алх"), t("carpenter", "мужаан")],
];
