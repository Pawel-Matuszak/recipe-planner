export function linkLabel(l: string) {
  const h = l.toLowerCase();
  if (h.includes("youtu")) return "YouTube";
  if (h.includes("tiktok")) return "TikTok";
  if (h.includes("instagram")) return "Instagram";
  if (h.includes("pinterest")) return "Pinterest";
  if (h.includes("drive.google")) return "Zdjęcie przepisu";
  return "Przepis";
}
